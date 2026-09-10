# Stroomaansluitingen — v15 beste laagselectie

Deze versie corrigeert een waarschijnlijke oorzaak van het ontbreken van de
blauwe CEE-aansluitingen.

In eerdere versies werd de **eerste** featurelaag gekozen die
`AANSLUITPUNT_ID` bevatte. Als de WebMap meerdere lagen met dat veld heeft, kan
daardoor een laag gekozen worden waarin `BLAUW_230V_*` of `TOTAAL_VERMOGEN`
niet aanwezig is.

v15:
- onderzoekt alle featurelagen met `AANSLUITPUNT_ID`;
- scoort ze op de volledige veldset uit de Arcade-expressie;
- kiest automatisch de laag met de meeste relevante velden;
- geeft extra gewicht aan `TOTAAL_VERMOGEN` en de drie blauwe 230 V-velden;
- logt in de console alle kandidaatlagen en de gekozen laag;
- logt de werkelijke field names als belangrijke velden nog ontbreken.

Na deployment moet de console tonen:

`Stroomaansluitingen app v15.0.0`

Zoek daarna in de console naar:
- `Kandidaatlagen voor stroomaansluitingen`
- `Gekozen doellaag`
- `Opgeloste attribuutvelden`
