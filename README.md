# Stroomaansluitingen — v24 totaal vermogen als volledige veldwaarde

Deze versie bouwt voort op v23.

Probleem opgelost:
- `TOTAAL_VERMOGEN` werd altijd als een getal geïnterpreteerd;
- een waarde zoals `150 (MKT2+EVN2)` kon daardoor niet als getal worden geparsed
  en werd als `0 A` weergegeven.

Nieuw gedrag:
- zuiver numerieke waarden blijven mooi weergegeven, bv. `150` → `150 A`;
- tekstwaarden worden volledig en exact weergegeven, bv.
  `150 (MKT2+EVN2)` → `150 (MKT2+EVN2)`;
- dit geldt zowel voor selectie van één punt als voor de detailkaarten bij
  een gebiedsselectie.

Alle andere functies uit v23 blijven behouden.

Na deployment moet de console tonen:

`Stroomaansluitingen app v24.0.0`
