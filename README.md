# ArcGIS Copy-ID app — v4

Deze versie is specifiek aangepast op de consolefout waarbij GitHub Pages nog
probeerde te laden via:

`https://stadbrugge.maps.arcgis.com/sharing/rest/portals/self`

Voor deze publieke WebMap gebruikt de app nu hard-coded:

`https://www.arcgis.com`

## Configuratie

- WebMap ID: `b7e5456ea5054b3dbb1d9c4802a34ca7`
- Te kopiëren veld: `AANSLUITPUNT_ID`
- Geen OAuth nodig
- Appversie in console: `Aansluitpunten app v4.0.0`

## Belangrijk bij GitHub

Vervang ALLE oude bestanden in de repository door deze versie, in het bijzonder:

- `index.html`
- `app.js`
- `config.js`
- `styles.css`
- `.nojekyll`

Commit en push daarna de wijzigingen.

Open na de nieuwe Pages-deploy de website met Ctrl+F5.

De browserconsole moet nu letterlijk tonen:

`Aansluitpunten app v4.0.0`

en:

`portalUrl: 'https://www.arcgis.com'`

Als er nog `stadbrugge.maps.arcgis.com` of een WebMap-ID zonder de laatste `7`
in de console staat, wordt nog een oude deployment of een oud bestand geladen.
