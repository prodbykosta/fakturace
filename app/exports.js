/* =====================================================================
   EXPORTNÍ CENTRUM — faktury * 3) Zobrazení a tisk do formátu kompatibilních XML.
 *    Formáty připravené pro kompatibilní export do účetních systémů.
   Sdílí globální scope s app.js (store, escXml, invoiceTotal, …).
   ===================================================================== */

/* ---------------- pomůcky ---------------- */
const rubyNum = v => Number.isInteger(v) ? v + ".0" : String(v);
const csvComment = () => `<!-- Generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")} (Fakturace) -->`;
const uuid4 = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0;
  return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
})).toUpperCase();
/* rozdělit "Renneská třída 766/40" → ["Renneská třída", "766", "40"] */
function splitStreet(street) {
  const m = String(street || "").trim().match(/^(.*?)\s+(\d+[a-zA-Z]?)(?:\/(\d+[a-zA-Z]?))?$/);
  return m ? [m[1], m[2], m[3] || ""] : [String(street || ""), "", ""];
}
const bankParts = () => {
  const m = String(store.settings.bankAccount || "").match(/^(?:(\d+)-)?(\d+)\/(\d+)$/);
  return m ? { prefix: m[1] || "", no: m[2], code: m[3] } : { prefix: "", no: "", code: "" };
};
const clientOf = inv => clientById(inv.clientId) || { name: "—", street: "", city: "", zip: "", ico: "", dic: "" };
const linesText = inv => inv.lines.map(l => l.name).join("\n");
const shorten = (s, n) => s.length > n ? s.slice(0, n - 3).trimEnd() + "..." : s;

/* ---------------- mini ZIP writer (metoda store) ---------------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function makeZip(files) { /* files: [{name, text}] */
  const enc = new TextEncoder();
  const chunks = [], central = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const u16 = v => [v & 0xFF, (v >> 8) & 0xFF];
  const u32 = v => [v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >>> 24) & 0xFF];
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.text === "string" ? enc.encode(f.text) : f.text;
    const crc = crc32(data);
    const head = new Uint8Array([
      0x50, 0x4B, 0x03, 0x04, ...u16(20), ...u16(0x0800), ...u16(0),
      ...u16(dosTime), ...u16(dosDate), ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(name.length), ...u16(0)
    ]);
    chunks.push(head, name, data);
    central.push({ name, data, crc, offset });
    offset += head.length + name.length + data.length;
  }
  const centralStart = offset;
  for (const c of central) {
    const rec = new Uint8Array([
      0x50, 0x4B, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0),
      ...u16(dosTime), ...u16(dosDate), ...u32(c.crc), ...u32(c.data.length), ...u32(c.data.length),
      ...u16(c.name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(c.offset)
    ]);
    chunks.push(rec, c.name);
    offset += rec.length + c.name.length;
  }
  chunks.push(new Uint8Array([
    0x50, 0x4B, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length),
    ...u32(offset - centralStart), ...u32(centralStart), ...u16(0)
  ]));
  return new Blob(chunks, { type: "application/zip" });
}

/* ---------------- POHODA (Stormware dataPack) ---------------- */
function pohodaXml(list) {
  const s = store.settings;
  const bank = bankParts();
  const items = list.map(inv => {
    const c = clientOf(inv);
    return `  <dat:dataPackItem id="${escXml(inv.number)}" version="2.0">
    <inv:invoice version="2.0">
      <inv:invoiceHeader>
        <inv:invoiceType>issuedInvoice</inv:invoiceType>
        <inv:number>
          <typ:numberRequested>${escXml(inv.number)}</typ:numberRequested>
        </inv:number>
        <inv:symVar>${escXml(inv.vs)}</inv:symVar>
        <inv:date>${inv.issuedOn}</inv:date>
        <inv:dateTax>${inv.issuedOn}</inv:dateTax>
        <inv:dateAccounting>${inv.issuedOn}</inv:dateAccounting>
        <inv:dateDue>${inv.dueOn}</inv:dateDue>
        <inv:classificationVAT>
          <typ:classificationVATType>nonSubsume</typ:classificationVATType>
        </inv:classificationVAT>
        <inv:text>${escXml(shorten(inv.lines.map(l => l.name).join(" "), 240))}</inv:text>
        <inv:partnerIdentity>
          <typ:address>
            <typ:company>${escXml(c.name)}</typ:company>
            <typ:city>${escXml(c.city)}</typ:city>
            <typ:street>${escXml(c.street)}</typ:street>
            <typ:zip>${escXml((c.zip || "").replace(/\s/g, ""))}</typ:zip>
            <typ:country>
              <typ:ids>CZ</typ:ids>
            </typ:country>
            <typ:ico>${escXml(c.ico)}</typ:ico>
            <typ:dic>${escXml(c.dic)}</typ:dic>
          </typ:address>
        </inv:partnerIdentity>
        <inv:myIdentity>
          <typ:address>
            <typ:company>${escXml(s.name)}</typ:company>
            <typ:city>${escXml(s.city)}</typ:city>
            <typ:street>${escXml(s.street)}</typ:street>
            <typ:zip>${escXml((s.zip || "").replace(/\s/g, ""))}</typ:zip>
            <typ:ico>${escXml(s.ico)}</typ:ico>
            <typ:dic>${escXml(s.dic)}</typ:dic>
          </typ:address>
        </inv:myIdentity>
        <inv:numberOrder></inv:numberOrder>
        <inv:paymentType>
          <typ:paymentType>draft</typ:paymentType>
        </inv:paymentType>
        <inv:account>
          <typ:accountNo>${escXml(bank.no)}</typ:accountNo>
          <typ:bankCode>${escXml(bank.code)}</typ:bankCode>
        </inv:account>
        <inv:note>${escXml(shorten(linesText(inv), 240))}</inv:note>
        <inv:intNote/>
      </inv:invoiceHeader>
      <inv:invoiceDetail>
${inv.lines.map(l => `        <inv:invoiceItem>
          <inv:text>${escXml(l.name)}</inv:text>
          <inv:quantity>${rubyNum(l.qty)}</inv:quantity>
          <inv:unit>${escXml(l.unit)}</inv:unit>
          <inv:payVAT>false</inv:payVAT>
          <inv:rateVAT>none</inv:rateVAT>
          <inv:homeCurrency>
            <typ:unitPrice>${rubyNum(l.unitPrice)}</typ:unitPrice>
            <typ:price>${rubyNum(l.qty * l.unitPrice)}</typ:price>
          </inv:homeCurrency>
        </inv:invoiceItem>`).join("\n")}
      </inv:invoiceDetail>
      <inv:invoiceSummary>
        <inv:homeCurrency>
          <typ:priceNone>${rubyNum(invoiceTotal(inv).subtotal + invoiceTotal(inv).vatTotal)}</typ:priceNone>
        </inv:homeCurrency>
      </inv:invoiceSummary>
    </inv:invoice>
  </dat:dataPackItem>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
${csvComment()}
<dat:dataPack id="fa001" ico="${escXml(s.ico)}" application="Fakturace" version="2.0" note="Import FA" xmlns:dat="http://www.stormware.cz/schema/version_2/data.xsd" xmlns:inv="http://www.stormware.cz/schema/version_2/invoice.xsd" xmlns:int="http://www.stormware.cz/schema/version_2/intDoc.xsd" xmlns:typ="http://www.stormware.cz/schema/version_2/type.xsd">
${items}
</dat:dataPack>
`;
}

/* ---------------- MONEY S3 ---------------- */
function moneyXml(list) {
  const s = store.settings;
  const bank = bankParts();
  const year = new Date().getFullYear();
  const myAddr = `        <Adresa>
          <Ulice>${escXml(s.street)}</Ulice>
          <Misto>${escXml(s.city)}</Misto>
          <PSC>${escXml((s.zip || "").replace(/\s/g, ""))}</PSC>
          <Stat>Česká republika</Stat>
          <KodStatu>CZ</KodStatu>
        </Adresa>`;
  const items = list.map(inv => {
    const c = clientOf(inv);
    const cAddr = `          <Ulice>${escXml(c.street)}</Ulice>
          <Misto>${escXml(c.city)}</Misto>
          <PSC>${escXml((c.zip || "").replace(/\s/g, ""))}</PSC>
          <Stat>Česká republika</Stat>
          <KodStatu>CZ</KodStatu>`;
    return `    <FaktVyd>
      <Doklad>${escXml(inv.number)}</Doklad>
      <Popis>${escXml(shorten(inv.lines[0] ? inv.lines[0].name : "", 50))}</Popis>
      <Vystaveno>${inv.issuedOn}</Vystaveno>
      <DatUcPr>${inv.issuedOn}</DatUcPr>
      <PlnenoDPH>${inv.issuedOn}</PlnenoDPH>
      <Splatno>${inv.dueOn}</Splatno>
      <KodDPH/>
      ${inv.paidOn ? `<Uhrazeno>${inv.paidOn}</Uhrazeno>` : ""}
      <Uhrada>převodem</Uhrada>
      <ZjednD>0</ZjednD>
      <VarSymbol>${escXml(inv.vs)}</VarSymbol>
      <Ucet>BAN</Ucet>
      <CObjednavk></CObjednavk>
      <Druh>N</Druh>
      <Dobropis>0</Dobropis>
      <PredKontac>FV002</PredKontac>
      <Poznamka/>
      <TextZaFa>${escXml(s.footerNote)}</TextZaFa>
      <TextPredDL>${escXml(linesText(inv))}</TextPredDL>
      <DodOdb>
        <ObchNazev>${escXml(c.name)}</ObchNazev>
        <ObchAdresa>
${cAddr}
        </ObchAdresa>
        <FaktNazev>${escXml(c.name)}</FaktNazev>
        <ICO>${escXml(c.ico)}</ICO>
        <DIC>${escXml(c.dic)}</DIC>
        <FaktAdresa>
${cAddr}
        </FaktAdresa>
        <Nazev>${escXml(c.name)}</Nazev>
        <PlatceDPH>${c.dic ? 1 : 0}</PlatceDPH>
      </DodOdb>
      <SeznamPolozek>
${inv.lines.map((l, i) => `        <Polozka>
          <Popis>${escXml(shorten(l.name, 50))}</Popis>
          <PocetMJ>${rubyNum(l.qty)}</PocetMJ>
          <SazbaDPH>${l.vatRate || 0}</SazbaDPH>
          <Cena>${rubyNum(l.qty * l.unitPrice)}</Cena>
          <CenaTyp>0</CenaTyp>
          <Valuty>0</Valuty>
          <Poradi>${i + 1}</Poradi>
          <NesklPolozka>
            <MJ>${escXml(l.unit)}</MJ>
            <Zaloha>0</Zaloha>
            <Protizapis>0</Protizapis>
          </NesklPolozka>
          <CenaPoSleve>1</CenaPoSleve>
        </Polozka>`).join("\n")}
      </SeznamPolozek>
      <SouhrnDPH>
        <Zaklad0>${rubyNum(invoiceTotal(inv).subtotal)}</Zaklad0>
      </SouhrnDPH>
      <Celkem>${rubyNum(invoiceTotal(inv).total)}</Celkem>
      <MojeFirma>
        <Nazev>${escXml(s.name)}</Nazev>
${myAddr}
        <ObchNazev>${escXml(s.name)}</ObchNazev>
        <ObchAdresa>
${myAddr.replace(/ {8}<\/?Adresa>\n?/g, "").replace(/^ {10}/gm, "          ")}
        </ObchAdresa>
        <ICO>${escXml(s.ico)}</ICO>
        <DIC>${escXml(s.dic)}</DIC>
        <Banka></Banka>
        <Ucet>${escXml(bank.no)}</Ucet>
        <KodBanky>${escXml(bank.code)}</KodBanky>
        <MenaSymb>Kč</MenaSymb>
        <MenaKod>CZK</MenaKod>
      </MojeFirma>
    </FaktVyd>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
${csvComment()}
<MoneyData HospRokOd="${year}-01-01" HospRokDo="${year}-12-31" description="Fakturace">
  <SeznamFaktVyd>
${items}
  </SeznamFaktVyd>
</MoneyData>
`;
}

/* ---------------- ABRA FLEXI (winstrom) ---------------- */
function flexiXml(list) {
  const s = store.settings;
  const items = list.map(inv => {
    const c = clientOf(inv);
    return `  <faktura-vydana update="ignore">
    <id>code:${escXml(inv.number)}</id>
    <kod>${escXml(inv.number)}</kod>
    <nazev>Faktura č. ${escXml(inv.number)}</nazev>
    <typDokl>code:FA_FAKTURA</typDokl>
    <zaokrJakSumK>zaokrJak.matem</zaokrJakSumK>
    <zaokrNaSumK>zaokrNa.zadne</zaokrNaSumK>
    <datVyst>${inv.issuedOn}</datVyst>
    <duzpPuv>${inv.issuedOn}</duzpPuv>
    <duzpUcto>${inv.issuedOn}</duzpUcto>
    <datUcto>${inv.issuedOn}</datUcto>
    <datSplat>${inv.dueOn}</datSplat>
    ${inv.paidOn ? `<datUhr>${inv.paidOn}</datUhr>` : ""}
    <uvodTxt></uvodTxt>
    <zavTxt>${escXml(s.footerNote)}</zavTxt>
    <poznam/>
    <varSym>${escXml(inv.vs)}</varSym>
    <nazFirmy>${escXml(c.name)}</nazFirmy>
    <ic>${escXml(c.ico)}</ic>
    <dic>${escXml(c.dic)}</dic>
    <mesto>${escXml(c.city)}</mesto>
    <psc>${escXml((c.zip || "").replace(/\s/g, ""))}</psc>
    <ulice>${escXml(c.street)}</ulice>
    <stat>code:CZ</stat>
    <formaUhradyCis>code:PREVOD</formaUhradyCis>
    <mena>code:CZK</mena>
    <kurz>1.0</kurz>
    <buc>${escXml(s.bankAccount)}</buc>
    <polozkyFaktury>
${inv.lines.map(l => `      <faktura-vydana-polozka>
        <nazev>${escXml(l.name)}</nazev>
        <mnozMj>${rubyNum(l.qty)}</mnozMj>
        <typCenyDphK>typCeny.bezDph</typCenyDphK>
        <typSzbDphK>typSzbDph.dphOsv</typSzbDphK>
        <szbDph>${l.vatRate || 0}</szbDph>
        <cenaMj>${rubyNum(l.unitPrice)}</cenaMj>
      </faktura-vydana-polozka>`).join("\n")}
    </polozkyFaktury>
  </faktura-vydana>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
${csvComment()}
<winstrom atomic="false">
  <typ-faktury-vydane update="ignore">
    <id>code:FA_FAKTURA</id>
    <kod>FA_FAKTURA</kod>
    <nazev>Faktura z Fakturace</nazev>
    <typDoklK>typDokladu.faktura</typDoklK>
    <ucetni>true</ucetni>
    <zaokrJakSumK>zaokrJak.matem</zaokrJakSumK>
    <zaokrNaSumK>zaokrNa.zadne</zaokrNaSumK>
  </typ-faktury-vydane>
${items}
</winstrom>
`;
}

/* ---------------- JEŽEK DUEL ---------------- */
function duelXml(list) {
  const bank = bankParts();
  const items = list.map(inv => {
    const c = clientOf(inv);
    const [ul, cp, co] = splitStreet(c.street);
    return `  <ZavazekPohledavka>
    <DATUM_VYSTAVENI>${inv.issuedOn}</DATUM_VYSTAVENI>
    <DATUM_SPLATNOSTI>${inv.dueOn}</DATUM_SPLATNOSTI>
    <PZ>P</PZ>
    <UCTOVAT_PREDPIS>1</UCTOVAT_PREDPIS>
    <DOKLAD_CISLO>${escXml(inv.vs)}</DOKLAD_CISLO>
    <VAR_SYMBOL>${escXml(inv.vs)}</VAR_SYMBOL>
    <DAL_SYMBOL>${escXml(inv.number)}</DAL_SYMBOL>
    <POPIS>${escXml(linesText(inv))}</POPIS>
    <FIRMA>
      <NAZEV>${escXml(c.name)}</NAZEV>
      <ADRESA1>${escXml(ul)}</ADRESA1>
      <CISLO_POPISNE_1>${escXml(cp)}</CISLO_POPISNE_1>
      <CISLO_ORIENTACNI_1>${escXml(co)}</CISLO_ORIENTACNI_1>
      <MISTO>${escXml(c.city)}</MISTO>
      <PSC>${escXml((c.zip || "").replace(/\s/g, ""))}</PSC>
      <ICO>${escXml(c.ico)}</ICO>
      <DIC>${escXml(c.dic)}</DIC>
    </FIRMA>
    <MENA>
      <MENA_ZKRATKA>CZK</MENA_ZKRATKA>
      <MENA_KURZ>1.0</MENA_KURZ>
    </MENA>
    <CELKEM>${rubyNum(invoiceTotal(inv).total)}</CELKEM>
    <BANKOVNI_UCET>${escXml(bank.no)}</BANKOVNI_UCET>
    <BANKOVNI_KOD>${escXml(bank.code)}</BANKOVNI_KOD>
  </ZavazekPohledavka>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
${csvComment()}
<ZavazkyPohledavky>
${items}
</ZavazkyPohledavky>
`;
}

/* ---------------- ISDOC (a EKONOM) ---------------- */
function isdocParty(name, street, city, zip, ico, dic) {
  const [ul, cp, co] = splitStreet(street);
  return `    <Party>
      <PartyIdentification>
        <ID>${escXml(ico)}</ID>
      </PartyIdentification>
      <PartyName>
        <Name>${escXml(name)}</Name>
      </PartyName>
      <PostalAddress>
        <StreetName>${escXml(ul)}</StreetName>
        <BuildingNumber>${escXml(co ? cp + "/" + co : cp)}</BuildingNumber>
        <CityName>${escXml(city)}</CityName>
        <PostalZone>${escXml((zip || "").replace(/\s/g, ""))}</PostalZone>
        <Country>
          <IdentificationCode>CZ</IdentificationCode>
          <Name>Česká republika</Name>
        </Country>
      </PostalAddress>${dic ? `
      <PartyTaxScheme>
        <CompanyID>${escXml(dic)}</CompanyID>
        <TaxScheme>VAT</TaxScheme>
      </PartyTaxScheme>` : ""}
    </Party>`;
}
function isdocInvoice(inv, withXmlns) {
  const s = store.settings;
  const c = clientOf(inv);
  const t = invoiceTotal(inv);
  const bank = bankParts();
  const vat = !!s.vatPayer;
  const supplier = isdocParty(s.name, s.street, s.city, s.zip, s.ico, s.dic);
  const customer = isdocParty(c.name, c.street, c.city, c.zip, c.ico, c.dic);
  return `<Invoice${withXmlns ? ` xmlns="http://isdoc.cz/namespace/2013" version="6.0.2"` : ""}>
  <DocumentType>1</DocumentType>
  <ID>${escXml(inv.number)}</ID>
  <UUID>${uuid4()}</UUID>
  <IssuingSystem>Fakturace</IssuingSystem>
  <IssueDate>${inv.issuedOn}</IssueDate>
  <VATApplicable>${vat}</VATApplicable>
  <ElectronicPossibilityAgreementReference/>
  <Note></Note>
  <LocalCurrencyCode>CZK</LocalCurrencyCode>
  <CurrRate>1.0</CurrRate>
  <RefCurrRate>1</RefCurrRate>
  <AccountingSupplierParty>
${supplier}
  </AccountingSupplierParty>
  <SellerSupplierParty>
${supplier}
  </SellerSupplierParty>
  <AccountingCustomerParty>
${customer}
  </AccountingCustomerParty>
  <BuyerCustomerParty>
${customer}
  </BuyerCustomerParty>
  <InvoiceLines>
${inv.lines.map((l, i) => {
    const base = l.qty * l.unitPrice;
    const tax = base * (vat ? (l.vatRate || 0) : 0) / 100;
    return `    <InvoiceLine>
      <ID>${i + 1}</ID>
      <InvoicedQuantity unitCode="${escXml(l.unit)}">${rubyNum(l.qty)}</InvoicedQuantity>
      <LineExtensionAmount>${rubyNum(base)}</LineExtensionAmount>
      <LineExtensionAmountTaxInclusive>${rubyNum(base + tax)}</LineExtensionAmountTaxInclusive>
      <LineExtensionTaxAmount>${rubyNum(tax)}</LineExtensionTaxAmount>
      <UnitPrice>${rubyNum(l.unitPrice)}</UnitPrice>
      <UnitPriceTaxInclusive>${rubyNum(l.unitPrice * (1 + (vat ? (l.vatRate || 0) : 0) / 100))}</UnitPriceTaxInclusive>
      <ClassifiedTaxCategory>
        <Percent>${vat ? (l.vatRate || 0) : 0}</Percent>
        <VATCalculationMethod>0</VATCalculationMethod>
        <VATApplicable>${vat && (l.vatRate || 0) > 0}</VATApplicable>
      </ClassifiedTaxCategory>
      <Note></Note>
      <Item>
        <Description>${escXml(l.name)}</Description>
      </Item>
    </InvoiceLine>`;
  }).join("\n")}
  </InvoiceLines>
  <TaxTotal>
    <TaxSubTotal>
      <TaxableAmount>${rubyNum(t.subtotal)}</TaxableAmount>
      <TaxAmount>${rubyNum(t.vatTotal)}</TaxAmount>
      <TaxInclusiveAmount>${rubyNum(t.subtotal + t.vatTotal)}</TaxInclusiveAmount>
      <AlreadyClaimedTaxableAmount>0</AlreadyClaimedTaxableAmount>
      <AlreadyClaimedTaxAmount>0</AlreadyClaimedTaxAmount>
      <AlreadyClaimedTaxInclusiveAmount>0</AlreadyClaimedTaxInclusiveAmount>
      <DifferenceTaxableAmount>${rubyNum(t.subtotal)}</DifferenceTaxableAmount>
      <DifferenceTaxAmount>${rubyNum(t.vatTotal)}</DifferenceTaxAmount>
      <DifferenceTaxInclusiveAmount>${rubyNum(t.subtotal + t.vatTotal)}</DifferenceTaxInclusiveAmount>
      <TaxCategory>
        <Percent>0</Percent>
      </TaxCategory>
    </TaxSubTotal>
    <TaxAmount>${rubyNum(t.vatTotal)}</TaxAmount>
  </TaxTotal>
  <LegalMonetaryTotal>
    <TaxExclusiveAmount>${rubyNum(t.subtotal)}</TaxExclusiveAmount>
    <TaxInclusiveAmount>${rubyNum(t.subtotal + t.vatTotal)}</TaxInclusiveAmount>
    <AlreadyClaimedTaxExclusiveAmount>0</AlreadyClaimedTaxExclusiveAmount>
    <AlreadyClaimedTaxInclusiveAmount>0</AlreadyClaimedTaxInclusiveAmount>
    <DifferenceTaxExclusiveAmount>${rubyNum(t.subtotal)}</DifferenceTaxExclusiveAmount>
    <DifferenceTaxInclusiveAmount>${rubyNum(t.subtotal + t.vatTotal)}</DifferenceTaxInclusiveAmount>
    <PayableRoundingAmount>${rubyNum(t.roundingAdjustment)}</PayableRoundingAmount>
    <PaidDepositsAmount>0</PaidDepositsAmount>
    <PayableAmount>${rubyNum(t.total)}</PayableAmount>
  </LegalMonetaryTotal>
  <PaymentMeans>
    <Payment>
      <PaidAmount>${rubyNum(t.total)}</PaidAmount>
      <PaymentMeansCode>42</PaymentMeansCode>
      <Details>
        <PaymentDueDate>${inv.dueOn}</PaymentDueDate>
        <ID>${escXml(bank.no)}</ID>
        <BankCode>${escXml(bank.code)}</BankCode>
        <Name></Name>
        <IBAN>${escXml(s.iban || czIban(s.bankAccount))}</IBAN>
        <BIC>${escXml(s.swift)}</BIC>
        <VariableSymbol>${escXml(inv.vs)}</VariableSymbol>
      </Details>
    </Payment>
  </PaymentMeans>
</Invoice>`;
}
function ekonomXml(list) {
  return `<?xml version="1.0" encoding="UTF-8"?>
${csvComment()}
<Invoices>
${list.map(inv => isdocInvoice(inv, true).replace(/^/gm, "  ")).join("\n")}
</Invoices>
`;
}
function isdocZip(list) {
  return makeZip(list.map(inv => ({
    name: `${inv.number}.isdoc`,
    text: `<?xml version="1.0" encoding="UTF-8"?>\n${isdocInvoice(inv, true)}\n`
  })));
}

/* ---------------- CSV a XLSX ---------------- */
function invoicesCsv(list) {
  const rows = [["Číslo", "VS", "Klient", "IČO klienta", "DIČ klienta", "Vystaveno", "Splatnost", "Zaplaceno", "Stav", "Měna", "Celkem"]];
  for (const inv of list) {
    const c = clientOf(inv);
    rows.push([inv.number, inv.vs, c.name, c.ico, c.dic, inv.issuedOn, inv.dueOn, inv.paidOn || "",
      invoiceStatus(inv)[1], "CZK", csvNum(invoiceTotal(inv).total.toFixed(2))]);
  }
  return toCsv(rows);
}
function invoicesXlsx(list) {
  const esc = s => escXml(String(s ?? ""));
  const header = ["Číslo", "VS", "Klient", "IČO klienta", "Vystaveno", "Splatnost", "Zaplaceno", "Stav", "Celkem (Kč)"];
  const rowsXml = [header.map(h => `<c t="inlineStr"><is><t>${esc(h)}</t></is></c>`).join("")]
    .concat(list.map(inv => {
      const c = clientOf(inv);
      const cells = [inv.number, inv.vs, c.name, c.ico, inv.issuedOn, inv.dueOn, inv.paidOn || "", invoiceStatus(inv)[1]];
      return cells.map(v => `<c t="inlineStr"><is><t>${esc(v)}</t></is></c>`).join("") +
        `<c t="n"><v>${invoiceTotal(inv).total}</v></c>`;
    }))
    .map((cells, i) => `<row r="${i + 1}">${cells}</row>`).join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Faktury" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
  return makeZip([
    { name: "[Content_Types].xml", text: types },
    { name: "_rels/.rels", text: rels },
    { name: "xl/workbook.xml", text: workbook },
    { name: "xl/_rels/workbook.xml.rels", text: wbRels },
    { name: "xl/worksheets/sheet1.xml", text: sheet }
  ]);
}

/* ---------------- filtr + UI ---------------- */
function exportFilteredInvoices() {
  const f = document.getElementById("export-form").elements;
  const dateOf = i => f.dateBy.value === "paid" ? (i.paidOn || "") : i.issuedOn;
  let list = store.invoices.filter(i => i.status !== "draft" && i.docType !== "proforma");
  const statuses = [...document.querySelectorAll('#export-form [name="exp-status"]:checked')].map(ch => ch.value);
  list = list.filter(i => statuses.includes(invoiceStatus(i)[0] === "overdue" ? "issued" : invoiceStatus(i)[0]));
  if (f.period.value === "custom") {
    const from = f.dateFrom.value || "0000", to = f.dateTo.value || "9999";
    list = list.filter(i => dateOf(i) >= from && dateOf(i) <= to);
  } else if (f.period.value !== "all") {
    list = list.filter(i => dateOf(i).slice(0, 4) === f.period.value);
  }
  if (f.client.value) list = list.filter(i => i.clientId === f.client.value);
  return list.sort((a, b) => a.issuedOn.localeCompare(b.issuedOn));
}

const EXPORT_FORMATS = {
  pdf: { label: "PDF pro tisk (vše v jednom)", group: "Do souboru" },
  xlsx: { label: "Excel (XLSX)", group: "Do souboru", ext: ".xlsx" },
  csv: { label: "CSV", group: "Do souboru", ext: ".csv" },
  isdoc: { label: "ISDOC (ZIP)", group: "Do souboru", ext: ".isdoc.zip" },
  fakturace: { label: "Standardní XML", group: "Do souboru", ext: ".xml" },
  pohoda: { label: "Pohoda", group: "Účetní programy", ext: ".pohoda.xml" },
  money: { label: "Money S3", group: "Účetní programy", ext: ".money.xml" },
  flexi: { label: "Abra Flexi", group: "Účetní programy", ext: ".flexibee.xml" },
  duel: { label: "Ježek DUEL", group: "Účetní programy", ext: ".duel.xml" },
  ekonom: { label: "EKONOM", group: "Účetní programy", ext: ".ekonom.xml" }
};

function openExportModal() {
  const modal = document.getElementById("export-modal");
  const f = document.getElementById("export-form").elements;
  /* roky */
  const years = [...new Set(store.invoices.map(i => i.issuedOn.slice(0, 4)))].sort().reverse();
  f.period.innerHTML = `<option value="all">Celá historie</option>` +
    years.map(y => `<option value="${y}">${y}</option>`).join("") +
    `<option value="custom">Zadat od–do</option>`;
  if (years[0]) f.period.value = years[0];
  /* klienti */
  f.client.innerHTML = `<option value="">všichni klienti</option>` +
    store.clients.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join("");
  /* formáty */
  const groups = {};
  for (const [k, v] of Object.entries(EXPORT_FORMATS)) (groups[v.group] = groups[v.group] || []).push([k, v.label]);
  f.format.innerHTML = Object.entries(groups).map(([g, opts]) =>
    `<optgroup label="${g}">${opts.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</optgroup>`).join("");
  updateExportCount();
  modal.hidden = false;
}
function updateExportCount() {
  const list = exportFilteredInvoices();
  const el = document.getElementById("export-count");
  el.textContent = list.length
    ? `Bude exportováno ${list.length} faktur za ${fmtMoney(list.reduce((a, i) => a + invoiceTotal(i).total, 0))}.`
    : "Filtru neodpovídá žádná faktura.";
  document.getElementById("export-form").elements.dateFrom.closest(".export-range").hidden =
    document.getElementById("export-form").elements.period.value !== "custom";
}
document.getElementById("export-form").addEventListener("input", updateExportCount);

function runExport() {
  const list = exportFilteredInvoices();
  if (!list.length) { alert("Filtru neodpovídá žádná faktura."); return; }
  const fmt = document.getElementById("export-form").elements.format.value;
  const stamp = todayISO();
  const base = `faktury-${stamp}`;
  if (fmt === "pdf") { showMultiPreview(list); document.getElementById("export-modal").hidden = true; return; }
  let content, mime = "application/xml";
  if (fmt === "fakturace") content = invoicesXml(list);
  if (fmt === "pohoda") content = pohodaXml(list);
  if (fmt === "money") content = moneyXml(list);
  if (fmt === "flexi") content = flexiXml(list);
  if (fmt === "duel") content = duelXml(list);
  if (fmt === "ekonom") content = ekonomXml(list);
  if (fmt === "csv") { content = invoicesCsv(list); mime = "text/csv;charset=utf-8"; }
  if (fmt === "isdoc") { downloadBlob(base + ".isdoc.zip", isdocZip(list)); document.getElementById("export-modal").hidden = true; return; }
  if (fmt === "xlsx") { downloadBlob(base + ".xlsx", invoicesXlsx(list)); document.getElementById("export-modal").hidden = true; return; }
  downloadFile(base + EXPORT_FORMATS[fmt].ext, content, mime);
  document.getElementById("export-modal").hidden = true;
}
function downloadBlob(name, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
document.getElementById("open-export").addEventListener("click", () => {
  if (!store.invoices.length) { alert("Žádné faktury k exportu."); return; }
  openExportModal();
});
document.getElementById("export-run").addEventListener("click", runExport);

/* hromadný PDF náhled (každá faktura = 1 stránka) */
function showMultiPreview(list) {
  const paper = document.getElementById("invoice-paper");
  paper.className = "";
  paper.innerHTML = list.map(inv => `<div class="paper">${invoicePaperHtml(inv)}</div>`).join("");
  previewInvoice = null;
  document.getElementById("preview-xml").hidden = true;
  document.querySelectorAll(".tab").forEach(t => (t.hidden = true));
  document.querySelector(".topbar").style.display = "none";
  document.getElementById("preview-wrap").hidden = false;
  window.scrollTo(0, 0);
  document.title = `Faktury (${list.length}×)`;
}
