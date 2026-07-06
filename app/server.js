/* =====================================================================
   Fakturace — lokální server
   Spuštění:  node server.js   (nebo poklepáním na start.command)
   - servíruje aplikaci na http://localhost:4321
   - ukládá soubory do podsložek data/<Kategorie>/
   - extrahuje text z PDF (pdftotext) a převádí PDF/obrázky na PNG (sips)
   - proxuje požadavky na lokální Ollamu (kvůli CORS)
   Bez npm závislostí.
   ===================================================================== */
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const tls = require("tls");
const { execFile } = require("child_process");

const PORT = process.env.PORT || 4321;
const ROOT = __dirname;
const DATA = path.join(ROOT, "data");
const META = path.join(DATA, "files.json");

if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });

/* ---------------- metadata souborů ---------------- */
function loadMeta() {
  try { return JSON.parse(fs.readFileSync(META, "utf8")); } catch { return []; }
}
function saveMeta(list) { fs.writeFileSync(META, JSON.stringify(list, null, 2)); }

const sanitizeName = n => path.basename(String(n)).replace(/[\/\\:*?"<>|]/g, "_").slice(0, 180) || "soubor";
const sanitizeCategory = c => String(c || "Ostatní").replace(/[\\.:*?"<>|]/g, "").trim().slice(0, 60) || "Ostatní";

function uniquePath(dir, name) {
  let p = path.join(dir, name);
  if (!fs.existsSync(p)) return p;
  const ext = path.extname(name), base = name.slice(0, name.length - ext.length);
  for (let i = 1; ; i++) {
    p = path.join(dir, `${base}-${i}${ext}`);
    if (!fs.existsSync(p)) return p;
  }
}

/* ---------------- pomůcky ---------------- */
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
  ".pdf": "application/pdf", ".md": "text/markdown; charset=utf-8", ".ico": "image/x-icon"
};
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}
function readBody(req, limitMb = 50) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", c => {
      size += c.length;
      if (size > limitMb * 1024 * 1024) { reject(new Error("Soubor je moc velký")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}
async function findPdftotext() {
  for (const p of ["/opt/homebrew/bin/pdftotext", "/usr/local/bin/pdftotext", "pdftotext", "C:\\Program Files\\xpdf-tools-win-4.04\\bin64\\pdftotext.exe"]) {
    try { await run(p, ["-v"]); return p; } catch { /* zkusit další */ }
  }
  return null;
}
let PDFTOTEXT = null;
findPdftotext().then(p => { PDFTOTEXT = p; });

const CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
];
const CHROME = CHROME_PATHS.find(p => fs.existsSync(p)) || null;

/* jednoduchý SMTP TLS klient (bez závislostí) */
function simpleSendMail(opts) {
  return new Promise((resolve, reject) => {
    const { host, port, user, pass, from, to, subject, text, pdfBuffer, pdfName } = opts;
    const socket = tls.connect(port, host, { rejectUnauthorized: false }, () => {
      let step = 0;
      let boundary = "----=_NextPart_" + crypto.randomBytes(16).toString("hex");
      let body = `From: ${from}\r\nTo: ${to}\r\nSubject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n` +
        `--${boundary}\r\nContent-Type: text/plain; charset="utf-8"\r\n\r\n${text}\r\n\r\n`;
      if (pdfBuffer) {
        body += `--${boundary}\r\nContent-Type: application/pdf; name="${pdfName}"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="${pdfName}"\r\n\r\n${pdfBuffer.toString("base64")}\r\n\r\n`;
      }
      body += `--${boundary}--\r\n.\r\n`;

      const cmds = [
        `EHLO localhost`,
        `AUTH LOGIN`,
        Buffer.from(user).toString("base64"),
        Buffer.from(pass).toString("base64"),
        `MAIL FROM:<${from.match(/<([^>]+)>/)?.[1] || from}>`,
        `RCPT TO:<${to.match(/<([^>]+)>/)?.[1] || to}>`,
        `DATA`,
        body,
        `QUIT`
      ];

      socket.on("data", data => {
        const str = data.toString();
        if (str.match(/^[45]\d{2}/)) return reject(new Error("SMTP Error: " + str)), socket.destroy();
        if (step < cmds.length) socket.write(cmds[step++] + "\r\n");
      });
      socket.on("end", resolve);
      socket.on("error", reject);
    });
  });
}

/* uložit nový soubor do data/<kategorie>/ + zapsat metadata */
function storeNewFile(name, category, buf, type, ai) {
  const meta = loadMeta();
  const cat = sanitizeCategory(category);
  const dir = path.join(DATA, cat);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = uniquePath(dir, sanitizeName(name));
  fs.writeFileSync(filePath, buf);
  const rec = {
    id: crypto.randomBytes(8).toString("hex"),
    name: path.basename(filePath), category: cat,
    period: "", note: "", ai: ai || "",
    size: buf.length, type: type || "", addedAt: Date.now()
  };
  meta.push(rec); saveMeta(meta);
  return rec;
}

/* ---------------- server ---------------- */
const AUTH_PASS = process.env.APP_PASSWORD || "";

const server = http.createServer(async (req, res) => {
  try {
    if (AUTH_PASS) {
      const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
      const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');
      if (password !== AUTH_PASS && login !== AUTH_PASS) {
        res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Fakturace"' });
        return res.end('Přístup odepřen');
      }
    }
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const parts = url.pathname.split("/").filter(Boolean);

    /* ---- API ---- */
    if (parts[0] === "api") {
      if (parts[1] === "ping") return json(res, 200, { ok: true, pdftotext: !!PDFTOTEXT });

      if (parts[1] === "files") {
        const meta = loadMeta();

        if (req.method === "GET" && !parts[2]) {
          const enriched = meta.map(m => {
            try {
              const st = fs.statSync(path.join(DATA, m.category, m.name));
              return { ...m, birthtime: st.birthtime, mtime: st.mtime };
            } catch (e) { return m; }
          });
          return json(res, 200, enriched);
        }

        if (req.method === "POST" && !parts[2]) {
          const b = JSON.parse(await readBody(req));
          const category = sanitizeCategory(b.category);
          const dir = path.join(DATA, category);
          fs.mkdirSync(dir, { recursive: true });
          const filePath = uniquePath(dir, sanitizeName(b.name));
          const buf = Buffer.from(b.dataBase64 || "", "base64");
          fs.writeFileSync(filePath, buf);
          const rec = {
            id: crypto.randomBytes(8).toString("hex"),
            name: path.basename(filePath), category,
            period: b.period || "", note: b.note || "",
            size: buf.length, type: b.type || "", addedAt: Date.now()
          };
          meta.push(rec); saveMeta(meta);
          return json(res, 200, rec);
        }

        const rec = meta.find(m => m.id === parts[2]);
        if (!rec) return json(res, 404, { error: "Soubor nenalezen" });
        const recPath = () => path.join(DATA, rec.category, rec.name);

        if (req.method === "PATCH") {
          const b = JSON.parse(await readBody(req));
          if (b.category !== undefined && sanitizeCategory(b.category) !== rec.category) {
            const newCat = sanitizeCategory(b.category);
            const newDir = path.join(DATA, newCat);
            fs.mkdirSync(newDir, { recursive: true });
            const newPath = uniquePath(newDir, rec.name);
            if (fs.existsSync(recPath())) {
              try { fs.renameSync(recPath(), newPath); } catch (e) { console.error(e); }
            }
            rec.category = newCat; rec.name = path.basename(newPath);
          }
          if (b.period !== undefined) rec.period = String(b.period).slice(0, 10);
          if (b.note !== undefined) rec.note = String(b.note).slice(0, 500);
          if (b.ai !== undefined) rec.ai = String(b.ai).slice(0, 300);
          saveMeta(meta);
          return json(res, 200, rec);
        }

        if (req.method === "DELETE") {
          try { fs.unlinkSync(recPath()); } catch { /* soubor už neexistuje */ }
          saveMeta(meta.filter(m => m.id !== rec.id));
          return json(res, 200, { ok: true });
        }

        if (req.method === "GET" && parts[3] === "content") {
          const buf = fs.readFileSync(recPath());
          /* ?inline=1 → zobrazit v prohlížeči (náhled PDF/obrázku), jinak stáhnout */
          const disp = url.searchParams.get("inline") ? "inline" : "attachment";
          res.writeHead(200, {
            "Content-Type": rec.type || MIME[path.extname(rec.name).toLowerCase()] || "application/octet-stream",
            "Content-Disposition": `${disp}; filename*=UTF-8''${encodeURIComponent(rec.name)}`
          });
          return res.end(buf);
        }

        if (req.method === "GET" && parts[3] === "text") {
          if (!PDFTOTEXT) return json(res, 200, { text: null, error: "pdftotext není nainstalovaný (brew install poppler)" });
          if (!/\.pdf$/i.test(rec.name)) return json(res, 200, { text: null });
          try {
            const out = await run(PDFTOTEXT, ["-layout", "-enc", "UTF-8", recPath(), "-"]);
            return json(res, 200, { text: out });
          } catch (e) { return json(res, 200, { text: null, error: e.message }); }
        }

        if (req.method === "GET" && parts[3] === "png") {
          try {
            const tmp = path.join(os.tmpdir(), `fakt-${rec.id}.png`);
            await run("sips", ["-s", "format", "png", recPath(), "--out", tmp]);
            await run("sips", ["-Z", "1400", tmp]);
            const b64 = fs.readFileSync(tmp).toString("base64");
            fs.unlinkSync(tmp);
            return json(res, 200, { base64: b64 });
          } catch (e) { return json(res, 200, { base64: null, error: e.message }); }
        }

        if (req.method === "GET" && parts[3] === "dimensions") {
          if (!/\.pdf$/i.test(rec.name)) return json(res, 200, { width: null, height: null });
          try {
            const out = await run("pdfinfo", [recPath()]);
            const match = out.match(/Page size:\s+([0-9.]+)\s+x\s+([0-9.]+)/);
            if (match) {
              return json(res, 200, { width: Number(match[1]), height: Number(match[2]) });
            }
            return json(res, 200, { width: null, height: null });
          } catch (e) { return json(res, 200, { width: null, height: null, error: e.message }); }
        }
      }

      /* HTML → PDF přes headless Chrome, uloží se rovnou mezi soubory */
      if (parts[1] === "htmlpdf" && req.method === "POST") {
        if (!CHROME) return json(res, 200, { error: "Chrome nenalezen — PDF převod není dostupný" });
        const b = JSON.parse(await readBody(req));
        const tmpHtml = path.join(os.tmpdir(), `fakt-conv-${Date.now()}.html`);
        const tmpPdf = tmpHtml.replace(".html", ".pdf");
        fs.writeFileSync(tmpHtml, String(b.html || ""));
        try {
          const args = ["--headless", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${tmpPdf}`];
          if (b.landscape) args.splice(3, 0, "--landscape");
          args.push("file://" + tmpHtml);
          await run(CHROME, args);
          const buf = fs.readFileSync(tmpPdf);
          let rec;
          if (b.preview) {
            fs.unlinkSync(tmpPdf);
            return json(res, 200, { preview: true, base64: buf.toString("base64") });
          } else if (b.replaceFileId) {
            const meta = loadMeta();
            const oldRec = meta.find(m => m.id === b.replaceFileId);
            if (oldRec) {
              try { fs.unlinkSync(path.join(DATA_DIR, oldRec.category, oldRec.name)); } catch {}
              oldRec.category = b.category || "Ostatní";
              const dir = path.join(DATA_DIR, oldRec.category);
              fs.mkdirSync(dir, { recursive: true });
              oldRec.name = path.basename(uniquePath(dir, b.name || "prevod.pdf"));
              fs.writeFileSync(path.join(dir, oldRec.name), buf);
              oldRec.size = buf.length;
              oldRec.addedAt = Date.now();
              saveMeta(meta);
              rec = oldRec;
            } else {
              rec = storeNewFile(b.name || "prevod.pdf", b.category || "Ostatní", buf, "application/pdf", b.ai || "");
            }
          } else {
            rec = storeNewFile(b.name || "prevod.pdf", b.category || "Ostatní", buf, "application/pdf", b.ai || "");
          }
          return json(res, 200, rec);
        } catch (e) {
          return json(res, 200, { error: "Převod do PDF selhal: " + e.message });
        } finally {
          try { fs.unlinkSync(tmpHtml); } catch { /* ok */ }
          try { fs.unlinkSync(tmpPdf); } catch { /* ok */ }
        }
      }

      /* Odeslání emailu (s podporou PDF přílohy generované z HTML) */
      if (parts[1] === "email" && req.method === "POST") {
        const b = JSON.parse(await readBody(req));
        if (!b.to || !b.subject || !b.text) return json(res, 400, { error: "Chybí parametry" });
        if (!b.smtpHost || !b.smtpUser) return json(res, 400, { error: "SMTP není nakonfigurováno" });

        let pdfBuffer = null;
        if (b.html && CHROME) {
          const tmpHtml = path.join(os.tmpdir(), `email-conv-${Date.now()}.html`);
          const tmpPdf = tmpHtml.replace(".html", ".pdf");
          fs.writeFileSync(tmpHtml, String(b.html));
          try {
            await run(CHROME, ["--headless", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${tmpPdf}`, "file://" + tmpHtml]);
            pdfBuffer = fs.readFileSync(tmpPdf);
          } catch (e) {
            console.error("PDF generation failed:", e);
          } finally {
            try { fs.unlinkSync(tmpHtml); } catch {}
            try { fs.unlinkSync(tmpPdf); } catch {}
          }
        }

        try {
          await simpleSendMail({
            host: b.smtpHost, port: Number(b.smtpPort) || 465, user: b.smtpUser, pass: b.smtpPass,
            from: b.smtpFrom || b.smtpUser, to: b.to, subject: b.subject, text: b.text,
            pdfBuffer, pdfName: b.pdfName || "dokument.pdf"
          });
          return json(res, 200, { ok: true });
        } catch (e) {
          return json(res, 500, { error: e.message });
        }
      }

      /* soubor → PNG (sips), výsledek se uloží mezi soubory */
      if (parts[1] === "files" && parts[3] === "topng" && req.method === "POST") {
        const meta2 = loadMeta();
        const rec2 = meta2.find(m => m.id === parts[2]);
        if (!rec2) return json(res, 404, { error: "Soubor nenalezen" });
        try {
          const tmp = path.join(os.tmpdir(), `fakt-${rec2.id}-out.png`);
          await run("sips", ["-s", "format", "png", path.join(DATA, rec2.category, rec2.name), "--out", tmp]);
          const buf = fs.readFileSync(tmp);
          fs.unlinkSync(tmp);
          const outName = rec2.name.replace(/\.[^.]+$/, "") + ".png";
          const saved = storeNewFile(outName, rec2.category, buf, "image/png", `Převedeno z ${rec2.name}`);
          return json(res, 200, saved);
        } catch (e) { return json(res, 200, { error: "Převod na PNG selhal: " + e.message }); }
      }

      /* ARES — údaje firmy podle IČO (proxy kvůli CORS) */
      if (parts[1] === "ares" && req.method === "GET") {
        const ico = String(parts[2] || "").replace(/\s/g, "").padStart(8, "0");
        if (!/^\d{8}$/.test(ico)) return json(res, 200, { error: "IČO musí mít 8 číslic" });
        try {
          const r = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`, {
            headers: { "Accept": "application/json" },
            signal: AbortSignal.timeout(15000)
          });
          if (r.status === 404) return json(res, 200, { error: "Subjekt s tímto IČO v ARES není" });
          if (!r.ok) return json(res, 200, { error: `ARES vrátil chybu ${r.status}` });
          const d = await r.json();
          const s = d.sidlo || {};
          const streetName = s.nazevUlice || s.nazevCastiObce || s.nazevObce || "";
          const num = s.cisloDomovni ? String(s.cisloDomovni) + (s.cisloOrientacni ? "/" + s.cisloOrientacni + (s.cisloOrientacniPismeno || "") : "") : "";
          return json(res, 200, {
            name: d.obchodniJmeno || "",
            ico: d.ico || ico,
            dic: d.dic ? "CZ" + String(d.dic).replace(/^CZ/i, "") : "",
            street: [streetName, num].filter(Boolean).join(" "),
            city: s.nazevObce || "",
            zip: s.psc ? String(s.psc).replace(/(\d{3})(\d{2})/, "$1 $2") : ""
          });
        } catch (e) {
          return json(res, 200, { error: "ARES neodpovídá: " + e.message });
        }
      }

      if (parts[1] === "ollama" && req.method === "POST") {
        const b = JSON.parse(await readBody(req));
        const base = (b.url || "http://localhost:11434").replace(/\/+$/, "");
        const target = base + (b.path || "/api/chat");
        try {
          const r = await fetch(target, {
            method: b.method || (b.body ? "POST" : "GET"),
            headers: { "Content-Type": "application/json" },
            body: b.body ? JSON.stringify(b.body) : undefined,
            signal: AbortSignal.timeout(300000)
          });
          const text = await r.text();
          res.writeHead(r.status, { "Content-Type": "application/json; charset=utf-8" });
          return res.end(text);
        } catch (e) {
          return json(res, 502, { error: "Ollama neodpovídá: " + e.message });
        }
      }

      return json(res, 404, { error: "Neznámá API cesta" });
    }

    /* ---- statické soubory aplikace ---- */
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/") rel = "/index.html";
    const filePath = path.normalize(path.join(ROOT, rel));
    if (!filePath.startsWith(ROOT) || filePath.startsWith(DATA) || rel.includes("..")) {
      res.writeHead(403); return res.end("Zakázáno");
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404); return res.end("Nenalezeno");
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`✅ Fakturace běží na http://localhost:${PORT}`);
  console.log(`   Soubory se ukládají do: ${DATA}`);
});
server.on("error", e => {
  if (e.code === "EADDRINUSE") {
    console.log(`ℹ️  Server už běží — otevři http://localhost:${PORT}`);
    process.exit(0);
  }
  throw e;
});
