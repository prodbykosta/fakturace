<div align="center">
  <h1>Fakturace</h1>
  <p>Moderní fakturační systém s lokální AI inteligencí.</p>
</div>

---

## 🎬 Demo

![Fakturace Demo](fakturace.gif)

*Ukázka systému v akci – správa faktur, interaktivní dashboard a plynulé moderní rozhraní.*

👉 **[Vyzkoušet živou ukázku v prohlížeči](https://prodbykosta.com/fakturace/)**

---

### 🆓 Zdarma a lokální alternativa k placeným fakturačním systémům
Vystavení faktury během pár sekund, jednoduchá správa a dokonalý přehled nad vašimi financemi i účetními soubory. Vše přehledně na jednom místě, přímo ve vašem počítači.

### 🤖 Pokročilá umělá inteligence (Ollama) s Auto-tříděním
Lokální AI analýza přijatých i vydanových faktur! Stačí do aplikace přetáhnout PDF nebo fotku z telefonu a umělá inteligence sama rozpozná částku, datum, dodavatele a zařadí soubor do správné složky. Vše funguje **100% lokálně** na vašem počítači bez nutnosti nahrávat data na cizí servery.

---

## ✨ Klíčové vlastnosti:

**🖥️ Windows, macOS i Linux: Běží všude**
Systém je postavený na odlehčeném Node.js serveru a spouští se přímo ve vašem oblíbeném prohlížeči. Na Macu stačí kliknout na `start.command` a je hotovo!

**📊 Komplexní Dashboard a Statistiky**
Úvodní obrazovka nabízí okamžitý přehled o zdraví vašeho podnikání. Interaktivní grafy příjmů a výdajů po měsících, sledování faktur po splatnosti a top klienti na jednom místě.

**📥 Inteligentní Exporty (XML, PDF, ISDOC)**
Spolupracujte se svou účetní bez bolesti. Exportujte do formátů:
* Standardní XML (plně kompatibilní s účetními programy)
* PDF pro tisk (všechny faktury v jednom souboru)
* ISDOC
* Excel (XLSX) a CSV

**💼 Multiměnovost a QR Platby**
- Automatické generování SPAYD QR kódů (CZK) i SEPA QR kódů (EUR).
- Plná podpora cizích měn (CZK, EUR, USD, GBP).

**📁 Integrovaný správce souborů**
Zapomeňte na nepořádek ve složkách. Aplikace obsahuje zabudovaného správce souborů, který je zrcadlem vaší skutečné složky `app/data/`. Soubory umí sama třídit, přesouvat a konvertovat fotky do PDF.

---

## 👥 Pro koho je systém ideální:
* **Freelancery a živnostníky** hledající moderní a rychlý způsob fakturace.
* **Malé a střední firmy**, které chtějí mít data stoprocentně pod svou kontrolou.
* **Uživatele**, kteří chtějí automatizovat zadávání výdajů pomocí umělé inteligence.

---

## 🛠️ Instalace a Spuštění (Tutoriál):

Instalace vám zabere doslova minutu. Nepotřebujete žádné databáze ani složité nastavování.

1. **Stažení Node.js**
   Jděte na [nodejs.org](https://nodejs.org/) a nainstalujte si základní verzi.
2. **Spuštění serveru**
   * **Mac/Linux:** Ve složce `app` stačí dvojklik na soubor `start.command`.
   * **Windows:** Otevřete terminál ve složce `app` a napište `node server.js`.
3. **Hotovo!**
   Prohlížeč se automaticky otevře na `http://localhost:4321`.

📖 **Podrobný manuál k používání a řešení nejčastějších problémů najdete v souboru [app/NAVOD.md](app/NAVOD.md).**

### 🌍 Spuštění na veřejném serveru (VPS) a Ochrana heslem
Aplikace je primárně stavěná pro běh na vašem lokálním PC. Pokud byste si ji ale chtěli nasadit na veřejný server (VPS), obsahuje vestavěnou ochranu **Basic Auth**.
Stačí ji spustit s proměnnou prostředí `APP_PASSWORD`:
```bash
APP_PASSWORD=mojetajneheslo node server.js
```
Jakmile aplikaci takto spustíte, kompletně se zamkne a prohlížeč si před jakýmkoliv přístupem k souborům či API vyžádá toto heslo.

### Zapnutí AI analýzy (Ollama)
Chcete využívat lokální umělou inteligenci pro čtení faktur?
1. Stáhněte si **[Ollama](https://ollama.com/)** a nainstalujte ji.
2. V terminálu spusťte `ollama run qwen2.5` (případně `ollama run qwen2.5-vl` pro fotky, nebo model dle vašeho výběru).
3. Přejděte do nastavení Fakturace a AI je připravena k použití!

### ⚙️ Dodatečné požadavky systému (OS Permissions)
Fakturace je navržena tak, aby fungovala ihned a bez dalšího nastavování oprávnění na jakémkoliv operačním systému (Windows, macOS, Linux). Vše běží v izolovaném lokálním serveru. Pro **automatické generování PDF na pozadí** je pouze vyžadováno, abyste měli na počítači nainstalovaný prohlížeč **Google Chrome** nebo **Microsoft Edge** (server si ho sám najde v typických složkách systému a na pozadí pomocí něj skrytě vykreslí PDF). Žádná speciální práva (jako přístup k mikrofonu nebo kameře) nejsou potřeba.

---

## 🛡️ Soukromí a Bezpečnost:
Vaše data jsou **jen vaše**. Veškerá data (klienti, faktury, nastavení) jsou ukládána do `localStorage` vašeho vlastního webového prohlížeče a do lokálních složek na disku. Nikdy neopouštějí váš počítač. Aplikace nevyžaduje internetové připojení k fungování (vyjma načítání Google Fontů). Pro bezpečný přenos dat na jiný počítač stačí v Nastavení využít funkci **Zálohování**. Dále server v základním nastavení naslouchá výhradně na adrese `127.0.0.1` (localhost), takže je systém kompletně izolovaný i od vaší místní sítě – žádné otevřené porty ven.

---

## ⚠️ Právní ujednání
Tento software je poskytován "tak jak je" a slouží jako pomocný nástroj pro podnikatele. Vygenerované dokumenty, faktury a exporty je doporučeno vždy zkontrolovat. Autor softwaru nenese žádnou odpovědnost za formální, právní nebo účetní správnost vytvořených dokumentů, za případné škody, ušlý zisk nebo komplikace vzniklé používáním aplikace. Za správnost daňových a účetních dokladů zodpovídá vždy uživatel.

---

## 🤝 Přispívání
Budu rád za kohokoliv, kdo se zapojí a pomůže aplikaci vylepšit! Systém byl navržen tak, aby byl maximálně jednoduchý a upravitelný. Za jakoukoliv pomoc s přidáváním nových funkcí, jazyků nebo účetních standardů budu velmi rád a je vítána! 🙏

---

Made by Martin Kostelka (kosta)
