# ArcGIS Copy-ID app

Deze starter laadt de bestaande ArcGIS Online WebMap:

`b7e5456ea5054b3dbb1d9c4802a34ca`

en voegt aan de popup een echte **Kopieer ID**-actie toe. Na één klik wordt de ingestelde attribuutwaarde naar het systeem-/Windows-klembord geschreven.

## 1. Eerst controleren

Open `config.js`.

De belangrijkste instelling is:

```js
copyField: "ID"
```

Dit moet de **echte field name** van het attribuut zijn, niet alleen de alias die in ArcGIS Online wordt getoond.

Als jouw veld bijvoorbeeld `asset_id` heet:

```js
copyField: "asset_id"
```

## 2. Publieke versus beveiligde WebMap

### Publieke WebMap

Laat dit leeg:

```js
oauthClientId: ""
```

### Beveiligde WebMap / alleen organisatie of groep

Maak in ArcGIS Online OAuth-credentials voor user authentication aan en zet de Client ID hier:

```js
oauthClientId: "JOUW_CLIENT_ID"
```

Gebruik bij de OAuth-credentials als redirect URL de uiteindelijke URL van de app, bijvoorbeeld:

`https://jouw-app.azurestaticapps.net/`

Als je later een eigen domein gebruikt, voeg ook dat domein als geldige redirect URL toe.

## 3. Lokaal testen

Door browserbeveiliging is het beter de app via een lokale webserver te draaien en niet rechtstreeks met `file://`.

Bijvoorbeeld in de map van dit project:

```bash
python -m http.server 8000
```

Open daarna:

`http://localhost:8000`

Voor OAuth-testen moet ook deze lokale URL als toegestane redirect URL in de OAuth-credentials staan.

## 4. Naar GitHub zetten

Maak een lege GitHub repository en plaats deze bestanden in de root:

- `index.html`
- `app.js`
- `config.js`
- `styles.css`
- `staticwebapp.config.json`

## 5. Azure Static Web Apps

In Azure Portal:

1. Create resource → **Static Web App**
2. Kies je subscription en resource group
3. Plan: voor een proof-of-concept kan **Free**; voor productie is **Standard** logischer
4. Source: **GitHub**
5. Selecteer repository en branch `main`
6. Framework/build preset: **Custom**
7. App location: `/`
8. Geen API-location
9. Bij een pure statische app is geen npm-build nodig

Als Azure een GitHub Actions workflow aanmaakt, kun je voor deze app de frontend-build overslaan:

```yaml
app_location: "/"
output_location: ""
skip_app_build: true
```

Na deployment krijg je een HTTPS-adres zoals:

`https://<naam>.azurestaticapps.net/`

HTTPS is belangrijk voor de moderne Clipboard API.

## 6. Testscenario

1. Open de app.
2. Klik een feature aan.
3. De bestaande popup uit de WebMap verschijnt.
4. Onderaan de popup staat **Kopieer ID**.
5. Klik één keer op die actie.
6. De waarde van het ingestelde veld staat in het Windows-klembord.
7. Plak hem in het formulier met de normale plakactie.

Als het veld niet bestaat, wordt in de browserconsole een lijst van beschikbare attributen geschreven. Daarmee is de juiste field name snel te vinden.

## Bestanden

- `index.html` — kaartcomponent en standaard kaarttools
- `app.js` — OAuth, popup-action en clipboardlogica
- `config.js` — WebMap-ID, OAuth Client ID en het te kopiëren veld
- `styles.css` — schermvullende kaart en feedbackmelding
- `staticwebapp.config.json` — eenvoudige Azure Static Web Apps routing
