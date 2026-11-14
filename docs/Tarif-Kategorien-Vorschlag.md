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

## Zuordnung der Tarife

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

## Offene Fragen

1. Was bedeuten die Endungen `a`, `u`, `n` (z. B. A107a / A107n / A103u)?
2. Ist `VP` die Pflegepflichtversicherung? Dann gehört sie in den Bereich „Pflege" mit eigenem Provisionsfaktor.
3. Stehen Beihilfe-Tarife immer mit `B` am Anfang – außer `BE` (Beitragsentlastung)?
4. Was sind `AE`, `AZ`, `RE`, `W`, `WG`, `NH`, `10`, `V`, `GKVP` und die Endungen `K` und `M`?

Sobald das bestätigt ist, wird daraus ein Filter „Kategorie" im Dashboard und im Management-Vergleich
(z. B. „Voll mit Beihilfe", „Pflegezusatz", „Zahn").
