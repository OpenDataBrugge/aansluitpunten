# Stroomaansluitingen

Deze versie is aangepast aan het nieuwe schema van de stroomaansluitingen.

Belangrijkste wijziging:
- `BLAUW_230V_32A` is vervangen door twee afzonderlijke velden:
  - `BLAUW_230V_32A_2F`
  - `BLAUW_230V_32A_3F`
- in de detailweergave worden deze getoond als `CEE 32 A — 2F` en `CEE 32 A — 3F`;
- de automatische veldherkenning en laagselectie verwachten beide nieuwe velden.

Bestanden gebruiken geen versienummer in de bestandsnaam, zodat updates eenvoudiger rechtstreeks over de bestaande GitHub Pages-bestanden kunnen worden geplaatst.

Update v27.1.0:
- toont `OPMERKINGEN` onder de aansluitingen in de detailzijbalk en bij gebiedsselectie;
- verbergt de sectie wanneer opmerkingen leeg zijn;
- behoudt regeleinden en geeft tekst veilig weer via `textContent`.

Update v27.2.0:
- de bestaande zoekbalk zoekt nu zowel op adres (de standaard ArcGIS-adreszoeker) als op het veld `AANSLUITPUNT_ID` in de stroompuntenlaag;
- standaard worden alle zoekbronnen tegelijk doorzocht, met suggesties bij het invoeren van een ID;
- na het selecteren van een ID-zoekresultaat wordt het aansluitpunt op de kaart getoond en opent de volledige detailfiche (ook vanuit de gebiedsselectie);
- de zoekfunctie is in de hulppagina vermeld.
