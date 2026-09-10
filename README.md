# Stroomaansluitingen — v14 field fix

Deze versie corrigeert het uitlezen van `TOTAAL_VERMOGEN` en de blauwe/rode
aansluitingen.

Aanpassingen:
- exacte veldnamen worden eerst gebruikt;
- daarna wordt ook op alias en betekenisvolle tokens gezocht;
- numerieke waarden worden robuust geparsed, ook bij waarden zoals `63,0`,
  `63 A` of Belgische duizendtallen;
- totale stroomsterkte blijft altijd zichtbaar, zoals in de Arcade-expressie;
- blauwe CEE-sectie wordt getoond zodra één van de blauwe waarden niet 0 is;
- rode CEE-sectie werkt hetzelfde;
- in de browserconsole staat een tabel `Opgeloste attribuutvelden`;
- bij elke selectie worden de ruwe relevante waarden gelogd.

De popup blijft volledig uitgeschakeld.

Na deployment moet de console tonen:

`Stroomaansluitingen app v14.0.0`
