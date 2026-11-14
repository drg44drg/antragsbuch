# Tarif-Kategorien – Vorschlag zur Prüfung

Stand 14.11.2026. Der Ordner „ADP-Gewinnung" mit den Prospekten war im verbundenen Google Drive nicht auffindbar.
Dieser Vorschlag ist deshalb aus zwei vorhandenen Quellen abgeleitet:

1. **Tarifgruppe je Tarif** aus der Provisionsabrechnung – verlässlich, die App nutzt sie bereits.
2. **Produkthierarchie** aus den Monatsscheiben – liefert die Kategorien, aber keine Zuordnung einzelner Tarife.

Die feinere Zuordnung (Spalte „Unterkategorie") ist aus den Tarifkürzeln **geraten** und muss bestätigt werden.

## Kategorien laut Produkthierarchie

- **Kranken**
  - Vollversicherung: mit Beihilfe · nicht Beihilfe (Ambulant, Beitragsentlastung, Kompakttarif, Stationär, Zahn) · Auslandskranken · Vorsorge & Prävention
  - Pflegepflichtversicherung
  - Pflegezusatz: ergänzend · gefördert
  - Sonstige Zusatzversicherung: ambulant · Krankenhaustagegeld · Krankentagegeld · stationär · Zahn
  - Betriebliche Krankenversicherung: F-Tarif · fakultativ (F) · G-Tarif · obligatorisch (O) · R-Tarife
  - Mitglieder Krankenversicherung
- **Unfall:** betrieblich · Mitglieder · sonstige
- **Leben** (in der Abrechnung als eigene Sparte LV)

## Bestätigt (von Ihnen bzw. aus dem Tarifbuch, Abschnitt „Beihilfeberechtigte")

| Kürzel | Bedeutung | Quelle |
|---|---|---|
| Endung `a` | alte Tarifwelt: Bisex, ohne Verteilung der Schwangerschaftskosten (KV-Voll vor 2009) | Ihre Angabe |
| Endung `n` | neue Tarifwelt: Bisex, 2009 bis 2013 | Ihre Angabe |
| Endung `u` | Unisex-Tarife | Ihre Angabe |
| `PG1`–`PG5` | Pflegeergänzung nach Pflegegrad | Ihre Angabe, Tarifbuch |
| `PG…D` | wie oben, mit Dynamik über das 70. Lebensjahr | Ihre Angabe |
| `PEV`, `PZ`, `PZM` | Pflegeergänzung | Tarifbuch |
| `S`, `R`, `W` (Beihilfe) | stationäre Heilbehandlung | Tarifbuch |
| `A` (Beihilfe) | ambulante Heilbehandlung | Tarifbuch |
| `Z`, `ZE` (Beihilfe) | Zahn-Ergänzung | Tarifbuch |
| `B`, `BW1`, `BW2` | Beihilfe-Ergänzungstarife | Tarifbuch |
| `NH` | Naturheilverfahren | Tarifbuch |
| `10` | Krankenhaustagegeld | Tarifbuch |
| `PPB` | Pflegepflicht für Beihilfeberechtigte | Tarifbuch |

Diese Regeln sind in der App hinterlegt (Tarif-Hinweis in Kundenakte und Tarifliste).

## Bitte absegnen – hier bin ich nicht sicher

| Nr. | Frage | Mein Vorschlag | Ihre Antwort |
|---|---|---|---|
| 1 | `A20`, `A30`, `S20`, `S30`, `Z…` gibt es in Voll **und** Beihilfe. Woran erkenne ich in der Abrechnung den Beihilfetarif? | An der Zahl = Erstattungssatz (A20 = 20 %, A30 = 30 %)? Dann wären `A20/A30/A35/A40/A75/A80` und `S20/S25/S30` Beihilfe, `A100–A109` und `S1/S3/S101–S103` Normaltarife. | |
| 2 | `BA30`, `BS30`, `BZ`, `BAE`, `BSE` | Beihilfe (ambulant / stationär / Zahn / Ergänzung) | |
| 3 | `VP` (Beiträge um 5–11 €) | Pflegepflicht? Oder Vorsorge? | |
| 4 | `AM10`–`AM33` | Ambulant, modular (neue Tarifgeneration) | |
| 5 | `AE…`, `AZ…`, `SE…`, `RE…` | Ergänzungstarife zu ambulant / stationär | |
| 6 | `TA2`–`TA52` in der Vollversicherung | Krankentagegeld, Zahl = Karenzwoche? | |
| 7 | `ZS75`, `Z260` | Zahn | |
| 8 | `WG`, `WGZ3/4`, `V` (Zusatz Art Leben) | unklar | |
| 9 | `ZG30/50/70`, `ZGB`, `ZH40`, `ZP1–ZP9` | Zahnzusatz | |
| 10 | `SG1/SG2`, `SP1/SP2/SPU` | stationäre Zusatz | |
| 11 | `AG`, `AG80`, `AGZ`, `AP1–AP9` | ambulante Zusatz | |
| 12 | `GKVP` und die Endungen `K` und `M` (Zusatz Art Schaden) | Kollektiv / Mitglieder? | |
| 13 | Gruppentarife: `…FR`/`…OR` = R-Tarife, `…G`/`…Gz` = G-Tarif | so übernehmen? | |
| 14 | Leben: `SBU…` = Berufsunfähigkeit; `T…`, `BT…`, `N…`, `L2`, `DT…`, `R` | Unterarten offen | |
| 15 | Wo steht die Pflegepflicht in der Abrechnung (`PVN`, `PPN`, `PPB`)? Im Reklamationsbeispiel kommt „PPN" vor. | eigener Bereich „Pflege" mit eigenem Faktor | |

## Unterlagen

Prospekte oder Bedingungswerke habe ich nicht gefunden – weder im Repository noch im verbundenen Google Drive.
Hilfreich wären als Upload: `1.591_Bedingungen_Vollversicherung_Beihilfe.pdf`, das allgemeine Tarifbuch (`1.700_…`)
und je ein Prospekt für Vollversicherung, Zusatz und bKV.

## Zuordnung nach Tarifgruppe (Arbeitsstand)

| Tarifgruppe (Abrechnung) | Bereich in der App | Kürzel-Muster | Unterkategorie (Vorschlag) | Sicher? |
|---|---|---|---|---|
| Vollversicherung | Voll | `A…` (A20, A30, A75, A80, A100–A109), `AM10–AM33` | Ambulant | bitte bestätigen |
| Vollversicherung | Voll | `S…` (S1, S3, S20–S30, S101–S103), `SE…` | Stationär | bitte bestätigen |
| Vollversicherung | Voll | `Z…` (Z6, Z8, Z9, Z260, ZS75) | Zahn | bitte bestätigen |
| Vollversicherung | Voll | `BE…` (BEa, BEu, BEn; im alten Antragsbuch „BE560", „BE MAX") | Beitragsentlastung | ziemlich sicher |
| Vollversicherung | Voll | `BA…`, `BS…`, `BZ…`, `BAE…`, `BSE…`, `B` + a/u/n | **Beihilfe** | bitte bestätigen |
| Vollversicherung | Voll | `TA…` (TA2–TA52) | Krankentagegeld | bitte bestätigen |
| Vollversicherung | ? | `VP` (kleine Beiträge um 5–11 €) | Pflegepflicht **oder** Vorsorge | **offen** |
| Vollversicherung | ? | `AE…`, `AZ…`, `RE…`, `R30u`, `W…` | unklar | **offen** |
| Zusatz (Art Leben) | Zusatz | `PG1–PG5` (A, S, AD, SD), `PEV…`, `PGU` | Pflegezusatz | ziemlich sicher |
| Zusatz (Art Leben) | Zusatz | `ZG…`, `ZGB`, `ZH40` | Zahnzusatz | bitte bestätigen |
| Zusatz (Art Leben) | Zusatz | `SG…`, `SP…` | Stationäre Zusatz | bitte bestätigen |
| Zusatz (Art Leben) | Zusatz | `AG…`, `AGZ` | Ambulante Zusatz | bitte bestätigen |
| Zusatz (Art Leben) | Zusatz | `TG6` | Tagegeld | bitte bestätigen |
| Zusatz (Art Leben) | Zusatz | `WG…`, `NH`, `10`, `V` | unklar | **offen** |
| Zusatz (Art Schaden) | Zusatz | `ZP1–ZP9` | Zahn | bitte bestätigen |
| Zusatz (Art Schaden) | Zusatz | `AP1–AP9` | Ambulant | bitte bestätigen |
| Zusatz (Art Schaden) | Zusatz | `GKVP`, Endung `K` / `M` | unklar (Kollektiv? Mitglieder?) | **offen** |
| Firmentarife | bKV | Endung `F` / `Fz` | fakultativ | ziemlich sicher |
| Firmentarife | bKV | Endung `O` | obligatorisch | ziemlich sicher |
| Gruppentarife | Gruppe | Endung `FR` / `OR` | R-Tarife | bitte bestätigen |
| Gruppentarife | Gruppe | Endung `G` / `Gz` | G-Tarif | bitte bestätigen |
| Unfallversicherung | Unfall | `UT`, `UB`, `U350`, `U500` | Unfall | sicher |
| Lebensversicherung (Standard) | Leben | `SBU…`, `T…`, `BT…`, `N…`, `L2`, `DT…`, `R` | Leben (BU, Risiko, Rente) | Bereich sicher, Unterart offen |

