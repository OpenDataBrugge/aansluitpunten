# Stroomaansluitingen — v12 clean rebuild

Deze versie is schoon opnieuw opgebouwd om de conflicterende CSS uit v8-v11 te verwijderen.

Belangrijkste fix:
- het blok **Selecteer een stroomaansluiting** is exact 116 px hoog;
- zodra een punt geselecteerd is, verdwijnt dat blok via `.is-hidden { display:none !important; }`;
- er zijn geen dubbele `.empty-details`/`.details-zone` CSS-regels meer;
- details nemen daarna meteen de bovenkant van het zijpaneel in;
- teller/navigatie, zoom 16.5, compacte popup en Kopieer ID blijven behouden.

Na deployment moet de console tonen:

`Stroomaansluitingen app v12.0.0`
