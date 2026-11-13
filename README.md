# Antragsbuch 2026

Offline-Web-App für Außendienstpartner (ADP) und Führungskräfte: Anträge erfassen,
Provisionsabrechnung einlesen, automatisch abgleichen, Team vergleichen.

**Auslieferung:** eine Datei – `antragsbuch.html`. Doppelklick, läuft in Edge/Chrome unter `file://`.
Keine Installation, kein Server, kein Netzwerkzugriff (per Content-Security-Policy gesperrt und per Test geprüft).

## Entwicklung

```bash
npm test            # Unit-Tests (Kern) + Browser-Tests der gebündelten Datei
npm run build       # bündelt src/ → antragsbuch.html
npm run testdaten   # schreibt synthetische Testdaten nach testdaten/
```

Benötigt nur Node.js (ab 20). Die Browser-Tests laufen, wenn Playwright vorhanden ist, sonst werden sie übersprungen.
Es gibt keine Laufzeit-Abhängigkeiten und keine Fremdbibliotheken im Bündel.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `src/core/util.js` | Zahlen- und Datumsformate, Vertragsnummern, Namensvergleich |
| `src/core/csv.js` | Kodierung (UTF-8 / Windows-1252), Trennzeichen, CSV lesen und schreiben |
| `src/core/xlsx.js` | Excel-Leser (ZIP + `DecompressionStream`) |
| `src/core/statement.js` | Provisionsabrechnung: Spalten über Namen, Kumulativ-Vergleich |
| `src/core/provision.js` | Regeltabelle und erwartete Provision |
| `src/core/model.js` | Projekt, Antrag, Status, Prüfungen, Migration, Sicherungsstände |
| `src/core/abgleich.js` | Bündelung, Zuordnung in Stufen, fünf Ergebnislisten |
| `src/core/kennzahlen.js` | Dashboard-Kennzahlen, CSV-Exporte |
| `src/core/team.js` | Monatsscheiben, Team-Position, Management-Auswertung je ADP |
| `src/core/vdienst.js` | Veränderungsdienst (generischer Import, gekapselt) |
| `src/core/import.js` | Erkennt jede Datei am Inhalt; läuft im Web Worker |
| `src/ui/` | Speicher (Datei + IndexedDB + Ordner), Tabelle, Diagramme, Ansichten |
| `tools/testdaten.js` | Synthetische Testdaten – keine echten Personen |
| `build.js` | Bündelt alles in eine HTML-Datei |

## Projektdatei (JSON, `schema: 1`)

`format`, `schema`, `projektId`, `jahr`, `einstellungen`, `regeln`, `tarife`, `antraege`,
`abrechnung` (spaltenweise gepackt), `importe`, `zuordnungen`, `ignoriert`, `vdienst`, `team`, `sicherungen`.
Ältere Stände hebt `AB.model.migriere` auf das aktuelle Schema; neuere werden mit klarer Meldung abgelehnt.

## Fachliche Festlegungen

- **Kumulierte Abrechnung:** Jeder Import ersetzt den Stand. Jede Zeile merkt sich, in welchem Import sie
  erstmals auftauchte (Schlüssel: Vertragsnummer, Personennummer, Tarif, Buchungsdatum, Provisionsart,
  Beitragsdifferenz, Provision; identische Zeilen über Anzahl).
- **Bündel:** Vertrag × Person × Tarifgruppe × Buchungsmonat.
- **Storno:** Rückbuchungen (X) werden dem abgerechneten Antrag zugeordnet. Der Status „Storno" wird erst
  gesetzt, wenn die Rückbuchung die einstellbare Schwelle (Standard 90 % des Beitrags) erreicht.
- **Abweichung:** Der Antrag gilt als abgerechnet, bleibt aber in der Liste, bis die Abweichung akzeptiert wird.
- **Nicht geprüft:** „Umstellung ohne Provision" und GKV.
- **Teamdaten für ADP:** ohne Namen, Vermittlernummern durch Pseudonyme ersetzt.
- **Datensparsamkeit:** Die Straße des Versicherungsnehmers wird nicht gespeichert.
