# Regeln zur Einordnung

Quelle: Tarifschlüssel SDK, Stand 11.06.2021 (787 Tarife). Die Regeln stehen auch in `scripts/tarif_einordnen.py`.

## Kategorie

Geprüft wird die Beschreibung, in dieser Reihenfolge; die erste passende Regel gewinnt.

| Beschreibung enthält | Kategorie |
|---|---|
| Pflegepflicht | Pflegepflicht |
| Pflege (Pflegeergänzung, Pflegetagegeld, Pflegevorsorge) | Pflegezusatz |
| Beitragsentlastung | Beitragsentlastung |
| Krankentagegeld | Krankentagegeld |
| Krankenhaustagegeld | Krankenhaustagegeld |
| Notlagentarif (auch Schatten-) | Sozialtarif · Notlagentarif |
| Basistarif (auch Schatten-) | Sozialtarif · Basistarif |
| Standardtarif | Sozialtarif · Standardtarif |
| Unfall | Unfall |
| Ausland | Ausland |
| Sterbegeld, Renten, Beitragsfreistellung | Leben und Vorsorge |
| Zahn | Zahn |
| Naturheil, Heilpraktiker | Naturheilverfahren |
| Vorsorgetarif | Vorsorge |
| ambulant | Ambulant |
| stationär | Stationär |
| Gesetzlicher Zuschlag | Gesetzlicher Zuschlag |
| Ergänzungstarif | Ergänzung |

Die Reihenfolge ist wichtig: „Zahnersatz- u. Heilpraktikertarif" ist Zahn, „Ergänzungstarif Ambulant / Zahnersatz" ist Zahn,
„Pflegepflichtversicherung" darf nicht bei Pflegezusatz landen.

## Beihilfe

Ja, wenn die Beschreibung „Beihilfeberechtigte" oder „Beamtenanwärter" enthält. Beispiele:

- `A20a`, `A30a`, `A50a` – Ambulanter Tarif - Beihilfeberechtigte → Beihilfe
- `A100a`, `A103a`, `A107a` – Ambulanter Tarif → keine Beihilfe
- `S20a`, `S30a` – Beihilfe · `S101a`, `S103a` – keine Beihilfe
- `Ba`, `BW1a`, `BW2a` – Ergänzungstarife für Beihilfeberechtigte (Bund, Baden-Württemberg)
- `BA30a`, `BS30a`, `BZa` – Beamtenanwärter
- `R…`, `Wa` – stationär für Beihilfeberechtigte (Regel- bzw. Wahlleistungen)

Faustregel der Praxis, aber nicht als Ersatz für das Verzeichnis: Bei `A`/`S` mit zweistelliger Zahl ist die Zahl der
Erstattungssatz (Beihilfe), dreistellige Nummern sind Normaltarife.

## Voll oder Zusatz

- **Zusatz:** Beschreibung nennt Ergänzungstarif, Zusatzversicherung, Zahnersatz, GKV-Mitglieder, mhplus oder Tagegeld –
  und ist nicht Beihilfe. Außerdem Pflegezusatz, Ausland, Naturheilverfahren, Vorsorge.
- **Voll:** ambulante und stationäre Tarife ohne diese Merkmale, alle Beihilfetarife, Pflegepflicht, Sozialtarife,
  Beitragsentlastung, gesetzlicher Zuschlag.
- **Unfall / Leben:** eigene Arten.

Grenzfall Krankentagegeld (`TA…`): Im Verzeichnis ohne Zusatz-Merkmal; in der Abrechnung in der Tarifgruppe
Vollversicherung geführt. Für „Wer ist vollversichert?" nicht als Nachweis werten.

## Tarifwelt (Endung)

| Endung | Bedeutung |
|---|---|
| a | alte Tarifwelt: Bisex, ohne Verteilung der Schwangerschaftskosten (KV-Voll vor 2009) |
| n | neue Tarifwelt: Bisex, 2009 bis 2013 |
| u | Unisex |
| z | modifizierte Kostensätze |

Nur auswerten, wenn der Tarif mit dieser Endung im Verzeichnis steht – `TA6`, `ZP7` oder `PV` haben keine Tarifwelt.

## Pflege

- `PN`, `PB` – Pflegepflicht Bestand (B = Beihilfe) · `PPN`, `PPB` – Pflegepflicht Neuzugang. Die Pflegepflicht zählt zur KV-Vollversicherung.
- Pflegezusatz sind `PG`, `PE`, `PEV`, `PS`; im Neugeschäft erscheinen nur noch `PG` und `PEV`.
- `VT` – gesetzlicher Zuschlag (10 %): zählt zum Beitrag, löst aber keine Provision aus.
- `PG1`–`PG5` – Pflegeergänzung nach Pflegegrad; `A` ambulant, `S` stationär, `D` mit Dynamik
- `PE1`–`PE3`, `PEV…`, `PV` – Pflegetagegeld bzw. Pflegeergänzung

## Bekannte Lücken

- Leben und Unfall: Verkauft werden heute nur noch Tarife der Stuttgarter; deren Verzeichnis wird nachgeliefert.
- Leben-Tarife der Abrechnung fehlen fast vollständig: `SBUv/w/x/y/z`, `Tu/Tv/Tw/Ty`, `BTv/BTw`, `N2x/N2z/N3x`, `L2`, `DTv`, `R`.
  Vorsicht bei abweichender Schreibweise: `Ty` wird als `TY` (Rentenversicherung 2005/2006) abgeleitet – das ist unbestätigt.
- Laut Auftraggeber gibt es keinen neueren Tarifschlüssel; AP-, ZP-, SP- und AB-Tarife (Budget) sind enthalten.
- Beträge oder Stufen hinter dem Kürzel (`TA6/160`, `BE375`, `BE MAX`) stehen nicht im Verzeichnis; das Skript ordnet sie der Familie zu.
