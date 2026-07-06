# Fakturace — návod

Lokální business systém: faktury, výdaje s AI analýzou, klienti, dashboard s grafy, správa souborů na disku a daňová hlášení.

## Spuštění

**Poklepej na `start.command`** — spustí se lokální server a otevře se http://localhost:4321.

(Bez serveru jde otevřít i samotný `index.html`, ale pak se soubory ukládají jen do prohlížeče a AI analýza nefunguje.)

## Dashboard

Úvodní obrazovka s přehledem businessu:
- **Dlaždice**: zaplaceno, fakturováno, čeká na zaplacení, po splatnosti, **výdaje** a **zisk** (zaplaceno − výdaje)
- **Graf po měsících**: fakturováno vs. zaplaceno — najetím myší na sloupec vidíš přesné částky
- **Stav faktur**, **top klienti** a **výdaje po měsících** vybraného roku
- Rok přepneš vpravo nahoře

## Faktury

- **⬇ Export** — chytré exportní centrum: filtry (období / rok / od–do, podle data vystavení nebo zaplacení, stav, klient) a formáty:
  - *do souboru*: PDF pro tisk (všechny faktury v jednom PDF), Excel (XLSX), CSV, ISDOC (ZIP), Standardní XML
  - *účetní programy*: **Pohoda, Money S3, Abra Flexi, Ježek DUEL, EKONOM** — plně kompatibilní datové struktury
  - koncepty se neexportují nikdy, stornované jen když je zaškrtneš
- **Statistiky nahoře**: všechny faktury a zaplacené za posledních 12 měsíců, nezaplacené vč. po splatnosti, po splatnosti za celou dobu, počet konceptů.
- **Koncepty**: rozdělanou fakturu ulož tlačítkem „💾 Uložit jako koncept" — nepočítá se do příjmů ani statistik; v seznamu má tlačítko **Dokončit**.
- **Storno**: vystavenou fakturu jde stornovat (⊘ Storno) — přestane se počítat, jde obnovit. Koncepty a stornované se neexportují do XML.
- **Řazení** Nejnovější/Nejstarší v hlavičce.
- Dashboard má navíc pohled **„posl. 12 měsíců"** (výchozí) i jednotlivé roky.

## 🤖 AI analýza faktur

Nahraj PDF faktur do **Souborů**, zaškrtni je a klikni **Analyzovat vybrané** (nebo 🤖 u jednoho souboru). Ollama u každého dokumentu:
1. **pozná, jestli je to tvoje vydaná faktura** (příjem — podle tvého IČO v Nastavení) **nebo přijatá** (výdaj),
2. vytáhne protistranu, částku, datum, číslo faktury, splatnost a kategorii,
3. ukáže ti vše ke kontrole — typ i hodnoty můžeš přepsat,
4. po uložení: **vydané faktury se importují mezi Faktury** (klient se založí automaticky; v dashboardu se objeví i jejich rok, třeba 2025), **přijaté se uloží do Výdajů** a soubor se **automaticky zařadí do správné složky** s obdobím.

Duplicitní čísla faktur se přeskakují, takže analýzu můžeš pustit klidně opakovaně.

### Nastavení AI
V záložce **Nastavení** dole: adresa Ollamy (standardně http://localhost:11434), tlačítkem **Načíst** stáhneš seznam modelů a vybereš (funguje `qwen2.5:7b`; pro skeny/fotky je potřeba vision model, např. `ollama pull qwen2.5vl`). PDF s textem se čtou přes `pdftotext`, skeny přes vision model.

## Příjmy

Samostatná záložka pro příjmy mimo faktury: výplaty od Apple/Google, provize, úroky… Přidáš ručně („Nový příjem"), nebo nahraješ **výpis/report (i CSV!)** do Souborů a dáš Analyzovat — AI pozná, že jde o výplatu, a vytáhne finální vyplacenou částku a zdroj. V dashboardu se ostatní příjmy ukazují v dlaždici **Příjmy** (faktury + ostatní), ve **žluté sérii grafu** a v **Zisku**.

## Výdaje

Evidence nákladů: ručně („Nový výdaj") nebo z AI analýzy přijatých faktur. **Export CSV** — oddělovač `;`, otevře se rovnou v českém Excelu.

## Soubory

**Složky jako ve Finderu** — na úvodní obrazovce vidíš složky (Nezařazené, Faktury, Hlášení, Příjmy, Smlouvy, Podklady, Ostatní), kliknutím vejdeš dovnitř, drobečková navigace nahoře tě vrátí zpět. Hledání prohledává všechny složky najednou. Složky jsou **skutečné podsložky `app/data/` na disku** — když v aplikaci změníš složku souboru (select ve sloupci Složka), fyzicky se přesune.

**Doporučený postup**: soubory prostě **přetáhni myší** kamkoli do záložky Soubory (nebo rovnou na konkrétní složku) — spadnou do **Nezařazené**. Pak klikni „🤖 Analyzovat vybrané" bez zaškrtnutí — nabídne celou složku Nezařazené — a AI je roztřídí: faktury naimportuje a přesune do složky Faktury s obdobím, ostatní zařadí podle typu. **Výsledek analýzy se uloží k souboru** (řádek 🤖 pod názvem) a jde v něm i hledat. Když AI zařadí špatně, souboru změň složku ručně.

**⇄ Konvertor**: u každého souboru je tlačítko převodu — CSV → PDF (tabulka), text → PDF, obrázky/HEIC → PDF nebo PNG, PDF → PNG. U převodu do PDF se nejdřív otevře **náhled**, kde si nastavíš **velikost v %** (50–150, jako při exportu z Apple Notes) a **orientaci stránky**; pak teprve uložíš. **Výsledek se uloží jako nový soubor do stejné složky** (PDF renderuje na pozadí Chrome).

**Hromadné akce**: zaškrtni libovolné soubory (checkbox mají všechny, i CSV) — objeví se lišta s akcemi **Analyzovat / Převést do PDF / Přesunout do složky / Smazat**, plus „Vybrat vše". **Hromadný převod do PDF** ukáže náhled prvního souboru, nastavíš % a orientaci jednou a uloží se PDF všech vybraných najednou.

> Data se ukládají do úložiště prohlížeče (localStorage). Ukládají se **pro konkrétní prohlížeč** — když otevřeš aplikaci v jiném prohlížeči, data tam nebudou. Proto si občas stáhni zálohu: **Nastavení → Záloha a obnova dat**.

## První kroky

1. **Nastavení** — vyplň svoje údaje (jméno, adresa, IČO, bankovní účet — IBAN se dopočítá sám, patička faktury).
2. **Klienti** — přidej odběratele (jméno, IČO, adresa).
3. **Faktury** — klikni na „+ Nová faktura“:
   - číslo faktury a variabilní symbol se předvyplní automaticky (formát `RRRR-MM-ČČ`),
   - vybereš klienta, splatnost (7/14/21/30… dní), přidáš položky (popis, počet, cena),
   - zaokrouhlení celkové částky na celé koruny je ve výchozím stavu zapnuté.

## PDF faktury

V seznamu faktur klikni na **Náhled / PDF** → **🖨 Uložit jako PDF / Tisk**. V tiskovém dialogu:
- cíl: **Uložit jako PDF**,
- vypni „Záhlaví a zápatí“ (Headers and footers).

Na faktuře je automaticky **QR Platba** (standard SPAYD České bankovní asociace) — obsahuje IBAN, částku, variabilní symbol a jméno klienta. Většina bankovních aplikací ji bez problému načte.

## XML export faktur

- Jednotlivá faktura: v náhledu tlačítko **⬇ Stáhnout XML**.
- Všechny faktury: tlačítko **Export vše (XML)** — univerzální formát kompatibilní se zavedenými účetními programy.

## Hlášení pro MOJE daně

Záložka **Hlášení**:

- **+ Souhrnné hlášení** — vyplníš měsíc, řádky (stát, DIČ odběratele, kód plnění — pro služby „3“, hodnota v Kč) a údaje poplatníka (zapamatují se pro příště). Stáhneš XML (formát EPO/DPHSHV).
- **+ Přiznání DPH** — vyplníš jen řádky, které potřebuješ (pro identifikovanou osobu typicky ř. 5 — přijetí služby z EU, ř. 21 — poskytnutí služeb do EU). Řádky 62 a 64 se dopočítají samy. Stáhneš XML (formát EPO/DPHDP3).

XML pak nahraješ na **mojedane.cz** → Elektronická podání pro finanční správu → **Načtení souboru**, zkontroluješ, doplníš případné detaily a odešleš.

- **⬆ Nahrát PDF do archivu** — uložíš si potvrzená hlášení (PDF z MOJE daní) ke každému měsíci, ať máš přehled. PDF jde i připojit k existujícímu hlášení.

## Tipy

- Kódy finančního úřadu (`c_ufo`) a územního pracoviště (`c_pracufo`) najdeš v předchozích podáních nebo je nech prázdné a doplň až na portálu.
- Chceš-li aplikaci na web: stačí nahrát složku `app/` na libovolný statický hosting (Netlify, GitHub Pages, Forpsi…). Data ale zůstávají vždy jen v prohlížeči uživatele.
