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
