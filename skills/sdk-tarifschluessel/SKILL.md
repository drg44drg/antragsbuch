---
name: sdk-tarifschluessel
description: Ordnet SDK-Tarifkürzel (z. B. A107a, S30a, PG3AD, ZG50, TA6, BEa, AB1F) anhand des offiziellen Tarifschlüssels ein und liefert Beschreibung, Kategorie (Ambulant, Stationär, Zahn, Pflege, Tagegeld …), Beihilfe ja/nein, Voll oder Zusatz, Tarifwelt (a/n/u/z) und Zielgruppe (bKV, Gruppe, GKV-Mitglieder). Diesen Skill immer verwenden, wenn eine Excel- oder CSV-Datei der SDK eine Tarifspalte enthält und geprüft, angereichert, gefiltert oder ausgewertet werden soll – Provisionsabrechnung, Bestandsliste, Beitragsanpassungsliste (BAP), Antragsbuch, Aktionsliste, Veränderungsdienst – und bei Fragen wie „Was ist Tarif X?", „Wer hat eine Vollversicherung?", „Welche Kunden sind Beihilfe?", „Voll oder Zusatz?", „alte oder neue Tarifwelt / Unisex?", „Tarife kategorisieren", „Tarifschlüssel", „Tarifkürzel erklären", auch wenn das Wort Tarifschlüssel nicht fällt.
---

# SDK-Tarifschlüssel

Tarifkürzel der SDK sind für Außenstehende nicht lesbar: `A20a` ist ein Beihilfetarif, `A107a` nicht; `PG3AD` ist eine
Pflegeergänzung mit Dynamik. Raten führt hier zu falschen Auswertungen. Dieser Skill bringt das offizielle Verzeichnis
mit (787 Tarife mit Beschreibung, Stand 11.06.2021) und ein Skript, das damit ganze Tabellen einordnet.

## Grundsatz

Nachschlagen statt schätzen. Die Einordnung kommt aus `references/tarifschluessel.csv`, nicht aus dem Aussehen des Kürzels.
Was nicht im Verzeichnis steht, wird als **unbekannt** ausgewiesen und dem Nutzer genannt – nicht stillschweigend einer
Kategorie zugeschlagen. Das Verzeichnis ist von 2021: Neuere Tarife und fast alle Leben-Tarife (z. B. `SBUx`) fehlen.

## Schnell nachschlagen

```bash
python3 scripts/tarif_einordnen.py nachschlagen A107a S30a "TA6/160" BE375
```

Für wenige Tarife genügt auch ein Blick in `references/tarifschluessel.csv` (Spalten `Tarif;Beschreibung`).

## Eine Tabelle prüfen und anreichern

Erst prüfen (ändert nichts, zeigt Abdeckung und unbekannte Tarife), dann anreichern:

```bash
python3 scripts/tarif_einordnen.py pruefen DATEI.xlsx --spalte Tarif --blatt Abrechnung
python3 scripts/tarif_einordnen.py excel   DATEI.xlsx --spalte Tarif --blatt Abrechnung --summe Monatsbeitrag --aus DATEI_tarife.xlsx
python3 scripts/tarif_einordnen.py csv     DATEI.csv  --spalte Tarif
```

- `--spalte` ist der Spaltenname (Groß-/Kleinschreibung und Sonderzeichen egal); die Kopfzeile wird in den ersten 30 Zeilen gesucht.
- `--summe` nennt optional eine Betragsspalte; dann enthält die Auswertung neben der Anzahl auch die Summe je Kategorie.
- Die Eingabedatei bleibt unverändert. Geschrieben wird eine Kopie mit acht Zusatzspalten rechts
  (`Tarif (erkannt)`, `Beschreibung`, `Kategorie`, `Beihilfe`, `Voll/Zusatz`, `Tarifwelt`, `Zielgruppe`, `Status`)
  und einem Blatt `Tarif-Auswertung`. Vorhandene Formatierung bleibt erhalten; `.xlsm` behält seine Makros.
- Unbekannte Zeilen sind rot, abgeleitete gelb markiert.

Kundendaten in diesen Dateien sind vertraulich: lokal arbeiten, nichts an externe Dienste geben, die Datei nicht in ein Repository legen.

## Status verstehen

| Status | Bedeutung | Was tun |
|---|---|---|
| bekannt | steht exakt im Tarifschlüssel | verwenden |
| abgeleitet | nicht exakt gefunden, aber zugeordnet: Zusatz abgeschnitten (`TA6/160` → `TA6`), Endung ergänzt (`A107` → Familie `A107a/n/u`), Stamm (`BE375` → `BE…`), Schreibweise (`zg50` → `ZG50`) | dem Nutzer als „bitte prüfen" nennen |
| unbekannt | nicht im Verzeichnis | auflisten, nachfragen, nicht raten |

Zellen mit mehreren Tarifen (`AM13, S3, Z6, TA6/ 160`) werden zerlegt; die Zusatzspalten zeigen dann alle Werte mit ` | ` getrennt.

## Was aus der Beschreibung abgeleitet wird

Details und Grenzfälle stehen in `references/kategorien.md` – lesen, wenn eine Auswertung nach Kategorie, Beihilfe oder
Voll/Zusatz gefragt ist oder ein Ergebnis unplausibel wirkt. Kurzfassung:

- **Kategorie:** Ambulant, Stationär, Zahn, Pflegepflicht, Pflegezusatz, Krankentagegeld, Krankenhaustagegeld,
  Beitragsentlastung, Naturheilverfahren, Vorsorge, Unfall, Ausland, Sozialtarif, Leben und Vorsorge, Ergänzung.
- **Beihilfe:** ja, wenn die Beschreibung „Beihilfeberechtigte" oder „Beamtenanwärter" nennt.
- **Tarifwelt** (Endung): `a` alte Welt (Bisex, vor 2009) · `n` neue Welt (Bisex, 2009–2013) · `u` Unisex · `z` modifizierte Kostensätze.
- **Zielgruppe:** Firmen (bKV), Gruppenversicherung, Kooperationspartner, mhplus, GKV-Mitglieder.

## Typische Aufgaben

**„Wer hat eine Vollversicherung?"** Eine Person ist vollversichert, wenn sie mindestens einen ambulanten oder stationären
Tarif mit `Voll/Zusatz = Voll` hat, der kein reiner Zusatz ist. Tagegeld, Pflegepflicht oder Beitragsentlastung allein
genügen nicht. Je Vertrag und Person gruppieren, dann prüfen; Beihilfe gesondert ausweisen.

**Provisionsabrechnung:** Die Spalte „Tarifgruppe" der Abrechnung (Vollversicherung, Zusatzversicherung, Firmentarife,
Gruppentarife …) ist die Sicht des Abrechnungssystems und bleibt führend für die Provision. Der Tarifschlüssel ergänzt sie
um die fachliche Feinheit (Beihilfe, Zahn, Pflege). Beide Spalten nebeneinander zeigen, nicht eine durch die andere ersetzen.

**Beitragsanpassungsliste:** Tarifwelt und Kategorie anreichern, dann je Kunde zeigen, welche Bausteine betroffen sind.

**In anderem Code verwenden:** `from tarif_einordnen import einordnen, zerlege` – `einordnen("A20a")` liefert ein
Wörterbuch mit `beschreibung`, `kategorie`, `beihilfe`, `art`, `welt`, `zielgruppe`, `status`, `hinweis`.
Für JavaScript-Projekte die CSV einlesen und die Regeln aus `references/kategorien.md` übernehmen.

## Ergebnis berichten

Dem Nutzer immer drei Dinge nennen: die Abdeckung (wie viele Zeilen bekannt, abgeleitet, unbekannt), die Liste der
unbekannten und abgeleiteten Kürzel, und den Stand des Verzeichnisses (11.06.2021). So kann er beurteilen, wie belastbar
die Auswertung ist, und fehlende Tarife nachliefern.

## Verzeichnis pflegen

Neue Tarife als Zeile `Tarif;Beschreibung` in `references/tarifschluessel.csv` ergänzen – in der Wortwahl des
Tarifschlüssels („Ambulanter Tarif - Beihilfeberechtigte"), weil die Kategorie aus der Beschreibung abgeleitet wird.
Die Spalten Gruppe, Schlüssel, VT und Geschlecht des Originals werden bewusst nicht geführt.
