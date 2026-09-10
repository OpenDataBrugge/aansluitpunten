# Stroomaansluitingen — v6 Experience-look

Deze versie is visueel verder afgestemd op de bestaande Stad Brugge Experience:

- blauwe header met compacte Brugge-wordmark;
- linker detailkolom van ongeveer 500 px;
- paginering `< 1 van 263 >`;
- grote `ID:`-titel;
- donkerblauwe kaart `Elektrisch aansluitpunt`;
- locatieblok;
- lichtblauw blok voor totale stroomsterkte indien zo'n attribuut bestaat;
- aansluitingen/waardenblok indien passende velden bestaan;
- éénklik `Kopieer` in het detailblok;
- aparte lijstweergave via de knop `Lijst`;
- mobiele uitschuifbare zijbalk;
- bestaande WebMap, symbologie en popup blijven behouden.

## Configuratie

- WebMap: `b7e5456ea5054b3dbb1d9c4802a34ca7`
- Kopieerveld: `AANSLUITPUNT_ID`
- Publieke ArcGIS Online-content; geen OAuth vereist.

## Publiceren

Vervang in de root van de GitHub Pages repository:

- `index.html`
- `app.js`
- `config.js`
- `styles.css`
- `.nojekyll`

Commit/push en doe na de nieuwe Pages deployment een `Ctrl+F5`.

In de browserconsole hoort te staan:

`Stroomaansluitingen app v6.0.0`

## Automatische veldherkenning

De app zoekt zelf velden waarvan naam of alias lijkt op:

- locatie/adres/straat/plaats;
- stroomsterkte/ampère/current;
- aansluiting/CEE/spanning/voltage/fase/aantal.

Als die velden niet bestaan, worden de betreffende detailblokken automatisch verborgen.
