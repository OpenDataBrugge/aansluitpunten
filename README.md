# Stroomaansluitingen — v13 Arcade-sidebar

Deze versie doet twee belangrijke dingen:

1. De popup op de kaart is volledig verwijderd.
   - De featurelaag-popups worden uitgeschakeld.
   - Kaartklikken worden met `hitTest()` afgehandeld.
   - De aangeklikte feature vult alleen het zijpaneel.

2. Het zijpaneel volgt de aangeleverde Arcade-expressie:
   - donkerblauwe header `Elektrisch aansluitpunt`;
   - ID in de header;
   - kopieerknop blijft behouden;
   - locatie met `Adres` en `Omschrijving_locatie`;
   - `TOTAAL_VERMOGEN` als totale stroomsterkte;
   - gewoon stopcontact;
   - blauwe CEE-groep 230 V;
   - rode CEE-groep 380 V;
   - rijen met waarde 0 worden niet getoond;
   - footer met ID.

Exact gebruikte velden:
- `AANSLUITPUNT_ID`
- `Adres`
- `Omschrijving_locatie`
- `TOTAAL_VERMOGEN`
- `STOPCONTACT_16A`
- `BLAUW_230V_16A`
- `BLAUW_230V_32A`
- `BLAUW_230V_63A`
- `ROOD_380V_16A`
- `ROOD_380V_32A`
- `ROOD_380V_63A`
- `ROOD_380V_125A`
- `ROOD_380V_250A`

De teller en vorige/volgende navigatie blijven werken en zoomen naar niveau 16.5.

Na deployment hoort in de console te staan:

`Stroomaansluitingen app v13.0.0`
