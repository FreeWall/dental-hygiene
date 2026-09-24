# Dentální hygiena 3D 🦷✨

3D hra do mobilu (i počítače) o práci dentální hygienistky. Běží v prohlížeči bez instalace.

Na procedurálně vymodelovaných ústech (28 zubů, dásně s papilami, patro, jazyk, rty) čistíš zuby realistickým postupem:

1. **Indikátor plaku** – nový plak se obarví růžově, starý modrofialově
2. **Airflow** – biofilm a pigmenty (kámen neodstraní!)
3. **Ultrazvuk** – supragingivální kámen (typicky linguálně na dolních řezácích a bukálně u horních molárů)
4. **Gracey kyreta** – tmavý subgingivální kámen u okraje dásně, pracuje jen tahy
5. **Leštění** – gumový kalíšek s pastou, jen na čistých plochách, pozor na přehřátí
6. **Fluoridace** – lak na závěr
7. **Sonda** – najdi kazy a zapiš je do karty (FDI číslování)

Pacient reaguje: bolí ho dáseň, citlivé krčky, přehřátý zub, kucká se, když neodsáváš vodu. Zanícené dásně krvácí
(kuřák méně – nikotin maskuje zánět). Na konci je hodnocení, instruktáž pacienta a kvízová otázka ze školy.

Pacienti: Fantom Franta (výuka), studentka Tereza (káva), kuřák pan Karel, puberťák Adam (plak, gingivitida, kazy),
pan Josef (masivní kámen, recese, chybějící zuby) a náhodný pacient.

## Spuštění pro vývoj

```bash
npm install
npm run dev
```

Vite vypíše i adresu v lokální síti (`Network: http://192.168.x.x:5173`) – tu stačí otevřít v mobilu na stejné Wi-Fi.

## Zveřejnění (aby hra šla otevřít odkazem)

```bash
npm run build
```

Vznikne složka `dist/` – čistě statický web (≈ 175 kB gzip). Stačí ji nahrát na libovolný hosting, např.:

- **Netlify Drop** – https://app.netlify.com/drop, přetáhnout složku `dist` myší → hned máš odkaz.
- **GitHub Pages** – nahrát obsah `dist/` do větve `gh-pages` (cesty jsou relativní, funguje i v podsložce).
- **Cloudflare Pages / Vercel** – build příkaz `npm run build`, výstupní složka `dist`.

Po první návštěvě funguje hra i offline a jde přidat na plochu („Přidat na plochu“) – pak se otevírá přes celou obrazovku na šířku.

## Ovládání

- vyber nástroj dole a táhni prstem po zubech – nástroj pracuje kousek **nad prstem** (kroužek), aby prst nezakrýval místo
- tah mimo zuby = otáčení, dva prsty = přiblížení a posun, dvojklep = přiblížit místo
- **Odsát** vlevo dole drž druhým palcem (nebo v menu zapni asistentku)
- **Kontrola** zvýrazní zbytky nánosů, **Karta** ukáže stav zubů a klepnutím na zub na něj zaměří kameru
- na počítači: myš, kolečko = zoom, pravé tlačítko = posun, klávesy 1–7 = nástroje, mezerník = odsávání

## Struktura

| soubor | obsah |
| --- | --- |
| `src/anatomy.js` | rozměry zubů (Wheeler), zubní oblouk, FDI číslování |
| `src/toothGeometry.js` | procedurální tvary řezáků, špičáků, premolárů a molárů |
| `src/mouth.js` | dásně s papilami a recesí, patro s patrovými řasami, jazyk, voda v ústech |
| `src/face.js` | rty a obličej (dolní ret se hýbe s čelistí) |
| `src/materials.js` | shadery skloviny (plak, pigment, kámen, kaz, lesk, fluorid) a dásní (zánět, krev) |
| `src/patients.js` | pacienti a rozmístění nánosů podle predilekčních míst |
| `src/game.js` | nástroje, komfort pacienta, voda, hodnocení, tutoriál |
| `src/ui.js`, `index.html`, `src/style.css` | rozhraní, karta pacienta (odontogram), kvíz |
| `src/quiz.js` | kvízové otázky z dentální hygieny |
| `tools/` | ladicí skripty pro screenshoty v headless prohlížeči (pro hru nejsou potřeba) |

Všechno (geometrie, textury i zvuky) je generované kódem – žádné externí assety. Postaveno na [three.js](https://threejs.org).
