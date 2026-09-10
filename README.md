# ArcGIS Copy-ID app — GitHub Pages

Deze statische webapp laadt de publieke ArcGIS Online WebMap van Stad Brugge:

`b7e5456ea5054b3dbb1d9c4802a34ca7`

en voegt aan de popup een echte **Kopieer ID**-actie toe.

De knop kopieert het attribuut:

`AANSLUITPUNT_ID`

naar het systeem-/Windows-klembord.

## Publiceren met GitHub Pages

### 1. Maak een repository
Maak op GitHub een nieuwe repository, bijvoorbeeld:

`arcgis-aansluitpunten`

Een publieke repository is de eenvoudigste optie voor GitHub Pages.

### 2. Upload deze bestanden naar de root van de repository

- `index.html`
- `app.js`
- `config.js`
- `styles.css`
- `.nojekyll`

`README.md` mag ook mee.

### 3. Zet GitHub Pages aan

Ga in de repository naar:

**Settings → Pages**

Onder **Build and deployment**:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/(root)`

Klik op **Save**.

### 4. Open de app

Voor een repository met naam `arcgis-aansluitpunten` wordt de standaard URL:

`https://JOUW-GITHUB-GEBRUIKERSNAAM.github.io/arcgis-aansluitpunten/`

GitHub Pages gebruikt HTTPS. Dat is belangrijk voor `navigator.clipboard.writeText()`.

### 5. Test

1. Open de GitHub Pages URL.
2. Klik een aansluitpunt op de kaart aan.
3. De popup verschijnt.
4. Klik op **Kopieer ID**.
5. De waarde uit `AANSLUITPUNT_ID` staat in het Windows-klembord.
6. Plak de waarde in het formulier.

## Configuratie

In `config.js` staat:

```js
export const CONFIG = {
  webmapId: "b7e5456ea5054b3dbb1d9c4802a34ca7",
  portalUrl: "https://stadbrugge.maps.arcgis.com",
  oauthClientId: "",
  copyField: "AANSLUITPUNT_ID",
  copyActionTitle: "Kopieer ID"
};
```

Omdat de WebMap en lagen publiek zijn, hoeft `oauthClientId` niet te worden ingevuld.

## Opmerking

De site zelf is publiek bereikbaar wanneer je een publieke GitHub Pages repository gebruikt. Dat verandert niets aan de ArcGIS rechten; in jouw geval zijn kaart en lagen al publiek.


## ArcGIS Online organisatie

De app gebruikt expliciet de Stad Brugge ArcGIS Online-organisatie:

`https://stadbrugge.maps.arcgis.com`

De WebMap-ID is:

`b7e5456ea5054b3dbb1d9c4802a34ca7`

De volledige WebMap-ID uit de gedeelde Map Viewer-URL is 32 tekens lang en eindigt op `7`.


## v2 - fix voor `#load() Failed to load web map`

In de vorige versie stond `portalUrl` alleen in onze eigen `config.js`.
Dat configureert de ArcGIS SDK niet automatisch.

Deze versie:
1. zet `esriConfig.portalUrl` expliciet;
2. maakt zelf een `WebMap` aan;
3. geeft de Stad Brugge portal expliciet mee in `portalItem.portal`;
4. koppelt die WebMap daarna aan het `<arcgis-map>` component.

Dit volgt het patroon uit de ArcGIS Maps SDK-documentatie voor portal items.
