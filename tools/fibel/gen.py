# Erzeugt die Fibel als HTML (Druckvorlage für das PDF).
import html, sys, os, urllib.parse
e = html.escape
def wiki(b): return 'https://de.wikipedia.org/w/index.php?search=' + urllib.parse.quote(b)
def yt(b): return 'https://www.youtube.com/results?search_query=' + urllib.parse.quote(b + ' einfach erklärt')

# (Begriff, Fachwort, Erklärung, Im Antragsbuch, So sagen Sie es dem ADP, Suchwort Wikipedia)
K = [
 ('Daten und Technik', 'Wie das Programm mit Dateien umgeht', [
  ('Einlesen ohne Doppelzählung', 'Idempotenz', 'Ein Vorgang ist idempotent, wenn man ihn beliebig oft wiederholen kann und das Ergebnis gleich bleibt.', 'Dieselbe Abrechnung zweimal einzulesen ändert nichts. Der Januar aus der Februar-Datei zählt nicht noch einmal.', '„Sie können die Datei ruhig noch einmal einlesen – es wird nichts doppelt.“', 'Idempotenz'),
  ('Ergänzen statt ersetzen', 'Upsert, Zusammenführen (Merge)', 'Neue Daten werden in den Bestand eingefügt: Vorhandenes wird erkannt, Neues kommt dazu, nichts wird gelöscht.', 'Fehlt in einer neueren Abrechnung ein Monat, bleiben die alten Buchungen erhalten und werden als „fehlt in der neuesten Abrechnung“ markiert.', '„Eine neue Datei ergänzt nur. Verloren geht nichts.“', 'Datenabgleich'),
  ('Abgleich', 'Reconciliation, Soll-Ist-Abgleich', 'Zwei Quellen werden gegeneinandergehalten, um Übereinstimmungen und Abweichungen zu finden.', 'Antragsbuch (was ich eingereicht habe) gegen Abrechnung (was gebucht wurde): gleich, Abweichung, offen, abgerechnet ohne Antrag, Storno.', '„Die App legt Ihre Anträge neben die Abrechnung und zeigt, wo es nicht passt.“', 'Soll-Ist-Vergleich'),
  ('Eindeutiges Merkmal', 'Schlüssel', 'Ein Merkmal oder eine Kombination, die einen Datensatz eindeutig erkennbar macht.', 'Vertragsnummer plus Personennummer plus Tarifgruppe plus Buchungsmonat. Fehlt die Vertragsnummer, hilft der Vergleich über Beitrag und Provision.', '„Tragen Sie die Vertragsnummer nach, sobald Sie sie haben – dann findet die App die Buchung sicher.“', 'Schlüssel (Datenbank)'),
  ('Eine Wahrheit', 'Single Source of Truth', 'Für jede Angabe gibt es genau eine maßgebliche Quelle.', 'Für Geld ist das die Abrechnung, für „neue Person oder Bestand“ das Antragsbuch, für den Bonus das Bonus-Reporting.', '„Maßgeblich ist immer die Abrechnung der SDK. Die App hilft beim Nachvollziehen.“', 'Single Source of Truth'),
  ('Prüfung auf Unsinn', 'Plausibilitätskontrolle', 'Eingaben werden geprüft, bevor sie übernommen werden.', 'Pflichtfelder im Antrag, Warnung bei möglicher Dublette, Nachfrage bei Datei im falschen Feld.', '„Wenn die App nachfragt, hat sie etwas Ungewöhnliches bemerkt.“', 'Plausibilitätskontrolle'),
  ('Lokal statt Cloud', 'Offline-Anwendung, Datenhoheit', 'Das Programm läuft im Browser auf dem eigenen Rechner und überträgt nichts.', 'Eine einzige HTML-Datei, kein Server, keine Installation. Die Projektdatei liegt dort, wo der ADP sie speichert.', '„Ihre Kundendaten verlassen Ihren Rechner nicht.“', 'Webanwendung'),
  ('Verschlüsselung', 'AES-256', 'Ein anerkanntes Verfahren, das Daten ohne Passwort unlesbar macht.', 'Die Projektdatei lässt sich mit Passwort schützen. Ohne Passwort kann sie niemand öffnen – auch wir nicht.', '„Merken Sie sich das Passwort gut. Es lässt sich nicht zurücksetzen.“', 'Advanced Encryption Standard'),
  ('Sicherungsstand', 'Snapshot, Versionierung', 'Ein festgehaltener Zustand, zu dem man zurückkehren kann.', 'Vor jedem Import und vor dem Jahreswechsel legt die App einen Sicherungsstand an; die letzten zehn bleiben.', '„Wenn etwas schiefgeht, holen Sie den Stand von vorher zurück.“', 'Versionsverwaltung'),
  ('Automatische Prüfungen', 'Test, Regressionstest', 'Kleine Programme, die nach jeder Änderung prüfen, ob alles Bisherige noch richtig rechnet.', 'Rund 90 Tests laufen bei jedem Umbau, darunter Fälle aus echten Abrechnungen.', '„Jede neue Fassung wird gegen die alten Fälle geprüft.“', 'Regressionstest'),
 ]),
 ('Prozesse', 'Vom Antrag bis zum Geld', [
  ('Ablauf', 'Geschäftsprozess, Workflow', 'Eine feste Folge von Schritten mit klaren Zuständen.', 'Eingereicht → policiert → abgerechnet; daneben abgelehnt, widerrufen, storniert, reklamiert.', '„Jeder Antrag hat immer genau einen Status. Sie sehen auf einen Blick, wo er steht.“', 'Geschäftsprozess'),
  ('Zugesagte Bearbeitungszeit', 'Service-Level, SLA', 'Eine vereinbarte Frist, in der etwas erledigt sein soll.', 'Die Ampel zählt Werktage seit der Einreichung: grün, ab 5 Tagen gelb, ab 10 Tagen rot.', '„Rot heißt: nachfragen.“', 'Service-Level-Agreement'),
  ('Liegezeit', 'Durchlaufzeit', 'Die Zeit von Anfang bis Ende eines Vorgangs.', 'Von der Einreichung bis zur Policierung und bis zur Abrechnung.', '„Je schneller policiert wird, desto früher zählt es für Ihren Bonus.“', 'Durchlaufzeit'),
  ('Stichtag', 'Cut-off, Produktionsschluss', 'Ein Datum, das entscheidet, in welchen Zeitraum etwas fällt.', 'Was bis zum 18. Dezember verarbeitet ist, zählt im laufenden Jahr – auch mit Beginn 1. Januar. Später Verarbeitetes zählt im Folgejahr.', '„Für das Jahresergebnis zählt nicht, wann Sie einreichen, sondern wann policiert wird.“', 'Stichtag'),
  ('Zuordnung zum richtigen Jahr', 'Periodenabgrenzung', 'Vorgänge werden dem Zeitraum zugerechnet, zu dem sie sachlich gehören.', 'Der Jahreswechsel nimmt offene Anträge ins neue Jahr mit; abgerechnete bleiben im alten.', '„Im Januar sehen Sie Ihre offenen Dezember-Anträge im neuen Jahr.“', 'Periodenabgrenzung'),
  ('Nachvollziehbarkeit', 'Audit-Trail, Historie', 'Wer hat wann was geändert – lückenlos festgehalten.', 'Jeder Statuswechsel steht mit Datum und Quelle (von Hand, Abgleich, Veränderungsdienst) in der Historie des Antrags.', '„Sie können jederzeit zeigen, wann was passiert ist.“', 'Audit Trail'),
  ('Feste Nummer', 'Laufende Nummer, Referenz', 'Eine unveränderliche Kennung, auf die man sich beziehen kann.', 'Jeder Antrag hat eine Positionsnummer, die in Listen, Exporten und der Bonus-Prüfung steht.', '„Nennen Sie bei Rückfragen einfach die Positionsnummer.“', 'Referenznummer'),
  ('Beanstandung', 'Reklamation', 'Ein förmlicher Hinweis, dass etwas fehlt oder falsch ist.', 'Fehlt eine Provision, füllt die App das Reklamationsformular vor.', '„Reklamieren Sie mit Beleg – die App liefert ihn.“', 'Reklamation'),
 ]),
 ('Zahlen und Steuerung', 'Was die Kennzahlen bedeuten', [
  ('Messgröße', 'Kennzahl, KPI', 'Eine Zahl, an der man Erfolg oder Handlungsbedarf abliest.', 'Brutto (eingetragen), voraussichtlich netto (policiert), netto (abgerechnet), Stornoquote, Nettoproduktion.', '„Drei Zahlen reichen für den Anfang: eingetragen, policiert, abgerechnet.“', 'Kennzahl'),
  ('Bewertete Produktion', 'Nettoproduktion', 'Die Produktion, wie sie der Versicherer für Ziele und Bonus wertet – nach Abzug von Abgängen.', 'Sie steht in der Abrechnung in der Spalte „Produktion“ und stimmt mit Monatsscheiben und Bonus-Reporting überein.', '„Für Ziel und Bonus zählt die Nettoproduktion, nicht die Summe der Beitragsänderungen.“', 'Nettoproduktion Versicherung'),
  ('Mitte statt Schnitt', 'Median', 'Der Wert in der Mitte: die Hälfte liegt darunter, die Hälfte darüber. Ausreißer verzerren ihn nicht.', 'Der „mittlere Antrag“ in der Analyse und das „Mittelfeld“ im Team sind Mediane.', '„Ein einzelner großer Antrag hebt den Schnitt, aber nicht die Mitte.“', 'Median'),
  ('Vergleich mit dem Plan', 'Soll-Ist-Vergleich, Zielerreichungsgrad', 'Der Stand wird am Ziel gemessen, zeitanteilig oder fürs ganze Jahr.', 'Meine Ziele je Produkt, Stand zur Karrierestufe, Zeitzielerreichung je Bank.', '„Sie sehen nicht nur, wo Sie stehen, sondern wo Sie heute stehen müssten.“', 'Soll-Ist-Vergleich'),
  ('Fortschreibung aufs Jahr', 'Hochrechnung, Forecast', 'Aus dem bisherigen Verlauf wird das Jahresende geschätzt.', 'Produktion ÷ vergangene Monate × 12 – als Richtwert.', '„Wenn es so weiterläuft, landen Sie bei …“', 'Hochrechnung'),
  ('Vergleich mit anderen', 'Benchmark', 'Die eigene Leistung wird an einer Vergleichsgruppe gemessen.', 'Platz im Team ohne Namen, Abstand zum Mittelfeld und zum nächsten Platz, Pfeile je Sparte.', '„Es geht nicht um Platz 18, sondern um die 300 Euro bis zum Mittelfeld.“', 'Benchmarking'),
  ('Wenige bringen viel', 'Pareto-Prinzip, 80/20', 'Ein kleiner Teil der Ursachen erzeugt den großen Teil der Wirkung.', 'Die zehn größten Anträge und die Größenklassen zeigen, woher der Beitrag wirklich kommt.', '„Schauen Sie, was Ihre zehn größten Anträge gemeinsam haben.“', 'Pareto-Prinzip'),
  ('Wie viele Produkte je Kunde', 'Durchdringung, Cross-Selling-Quote', 'Anteil der Kunden, die mehr als ein Produkt haben.', 'Personen mit einem, zwei oder drei Tarifen; Vollversicherte mit und ohne Beitragsentlastung.', '„Wer schon einmal Ja gesagt hat, sagt es leichter wieder.“', 'Cross-Selling'),
  ('Rückbuchung nach Haftungszeit', 'Storno, Provisionshaftung', 'Endet ein Vertrag früh, wird die Provision anteilig zurückgebucht.', 'Zusatz 12 Monate, Vollversicherung 60 Monate; je Monat ohne Beitrag ein Zwölftel bzw. Sechzigstel.', '„Die Provision ist erst nach der Haftungszeit ganz verdient.“', 'Stornoquote'),
  ('Bestand nutzen', 'Bestandsausschöpfung', 'Wie viel Neugeschäft aus dem vorhandenen Bestand entsteht.', 'Im Bonus: KV-Nettoproduktion je 1.000 € Bestand, mit Schwellen je Karrierestufe.', '„Ihr Bestand ist Ihr bester Markt.“', 'Bestandskunde'),
 ]),
 ('Vertrieb', 'Vom Kontakt zum Abschluss', [
  ('Verkaufstrichter', 'Sales Funnel, Pipeline', 'Aus vielen Kontakten werden weniger Termine und noch weniger Abschlüsse.', 'Aktionen: nicht bearbeitet → kontaktiert → Termin → Abschluss, mit Quoten.', '„Jede Stufe hat ihre Quote. Mehr Kontakte oben heißt mehr Abschlüsse unten.“', 'Verkaufstrichter'),
  ('Mehr beim selben Kunden', 'Cross-Selling und Up-Selling', 'Cross-Selling: ein weiteres Produkt. Up-Selling: eine höhere Stufe desselben Produkts.', '„Da ist mehr zu holen“ und künftig die Rechnung „eine Tarifstufe höher“.', '„Zahnzusatz vorhanden – stationär und Pflege sind der nächste Schritt.“', 'Upselling'),
  ('Kunden bringen Kunden', 'Empfehlungsmarketing', 'Zufriedene Kunden nennen neue Interessenten.', 'Geplant: Empfehlung erfragt, erhalten, Abschluss – mit Quote.', '„Fragen Sie 30 Tage nach dem Abschluss. Das ist der beste Moment.“', 'Empfehlungsmarketing'),
  ('Wieder melden', 'Wiedervorlage, Follow-up', 'Ein Termin, an dem ein Vorgang wieder auf den Tisch kommt.', 'Geplant: Datum und Anlass je Kunde, Liste „Heute fällig“.', '„Die meisten Abschlüsse entstehen beim zweiten Kontakt.“', 'Wiedervorlage'),
  ('Kundenpflege mit System', 'CRM', 'Alle Kontakte und Vorgänge zu einem Kunden an einer Stelle.', 'Die Kundensuche (F3, F4) zeigt Anträge und Buchungen eines Kunden zusammen.', '„Vor dem Anruf ein Blick in die Kundenakte.“', 'Customer-Relationship-Management'),
  ('Passender Schutz', 'Bedarfsanalyse', 'Erst den Bedarf ermitteln, dann das Produkt wählen.', 'Die Rechenhilfe „Krankentagegeld: reicht es?“ zeigt Bedarf, Lücke und Deckung.', '„Nicht der Preis entscheidet, sondern die Lücke.“', 'Bedarfsanalyse'),
  ('Begrüßung nach dem Abschluss', 'Onboarding, Welcome Call', 'Der erste Kontakt nach dem Abschluss festigt die Entscheidung.', 'Geplant: Kontaktplan mit Zufriedenheitsanruf nach 30 Tagen und Jahresgespräch.', '„Ein Anruf nach vier Wochen verhindert manchen Widerruf.“', 'Onboarding'),
 ]),
 ('Führung und Einführung', 'Wie man so ein Werkzeug einführt', [
  ('Klare Ziele', 'Zielvereinbarung, SMART', 'Ziele sind spezifisch, messbar, erreichbar, bedeutsam und terminiert.', 'Jahresziel je Produkt, verteilt auf die Monate, mit Vorjahr daneben.', '„Ein Ziel ohne Zahl und Datum ist ein Wunsch.“', 'SMART (Projektmanagement)'),
  ('Kleinste brauchbare Fassung', 'Minimum Viable Product, MVP', 'Die erste Version, die echten Nutzen bringt und Rückmeldungen ermöglicht.', 'Antrag eintragen, Abrechnung einlesen, Abweichungen sehen – alles Weitere baut darauf auf.', '„Fangen Sie mit dem Eintragen an. Der Rest kommt von selbst.“', 'Minimum Viable Product'),
  ('Beweis im Kleinen', 'Proof of Concept, Pilot', 'Ein begrenzter Versuch zeigt, dass es in der Praxis funktioniert.', 'Ein Parallelmonat mit 10 bis 20 echten Anträgen und zwei, drei ADP.', '„Wir probieren es einen Monat nebenher aus.“', 'Proof of Concept'),
  ('Menschen mitnehmen', 'Change Management', 'Veränderungen planvoll einführen: erklären, üben, Rückmeldung aufnehmen.', 'Tour, Hilfe, Beispielprojekt – und Rückmeldungen der ADP sammeln.', '„Sagen Sie mir, was Sie stört. Das fließt in die nächste Fassung ein.“', 'Veränderungsmanagement'),
  ('Wer ist betroffen', 'Stakeholder', 'Alle, die ein Interesse am Vorhaben haben oder es beeinflussen.', 'ADP, Führungskräfte, Innendienst, Datenschutz, IT, Banken.', '„Für wen muss das gut sein, damit es bleibt?“', 'Stakeholder'),
  ('Lohnt es sich', 'Business Case', 'Nutzen und Aufwand werden nachvollziehbar gegenübergestellt.', 'Gefundene Provisionsdifferenzen, gesparte Zeit, höhere Stückzahl je ADP.', '„Was hat es gebracht – in Euro und in Stunden?“', 'Business Case'),
 ]),
 ('Datenschutz und Recht', 'Was erlaubt ist und was schützt', [
  ('Nur das Nötige', 'Datenminimierung (DSGVO)', 'Es werden nur Daten verarbeitet, die für den Zweck nötig sind.', 'Keine Geburtsdaten, keine Gesundheitsangaben; Notizen in eigener Verantwortung.', '„Tragen Sie keine Diagnosen ein.“', 'Datenschutz-Grundverordnung'),
  ('Schutz des Programms', 'Urheberrecht an Software, Lizenz', 'Software ist geschützt; die Lizenz regelt, wer sie wie nutzen darf.', 'Schutzvermerk in der Datei, signierter Lizenzschlüssel mit Ablauf, Lesemodus danach.', '„Die Datei ist für Sie persönlich lizenziert.“', 'Softwarelizenz'),
  ('Keine Zusage', 'Haftungsausschluss, Disclaimer', 'Ein Hinweis, dass Angaben unverbindlich sind.', 'Bei jedem Start: Arbeitshilfe, maßgeblich sind die Abrechnungen und Richtlinien des Versicherers.', '„Die App hilft beim Nachvollziehen. Verbindlich ist die Abrechnung.“', 'Disclaimer'),
 ]),
]
BILD_ABLAUF = '''<svg viewBox="0 0 760 120" role="img" aria-label="Ablauf: eingetragen, policiert, abgerechnet"><g font-family="Helvetica,Arial,sans-serif" font-size="14">
<rect x="10" y="30" width="200" height="60" rx="10" fill="#ecebfb" stroke="#5a48cf"/><text x="110" y="56" text-anchor="middle" font-weight="700">Eingetragen</text><text x="110" y="76" text-anchor="middle" fill="#55546a">Brutto · Antragsbuch</text>
<rect x="280" y="30" width="200" height="60" rx="10" fill="#e6f5ef" stroke="#1a9a6c"/><text x="380" y="56" text-anchor="middle" font-weight="700">Policiert</text><text x="380" y="76" text-anchor="middle" fill="#55546a">voraussichtlich netto</text>
<rect x="550" y="30" width="200" height="60" rx="10" fill="#e8f0fb" stroke="#2a74cf"/><text x="650" y="56" text-anchor="middle" font-weight="700">Abgerechnet</text><text x="650" y="76" text-anchor="middle" fill="#55546a">Netto · Abrechnung</text>
<path d="M214 60h58m-10-7l10 7-10 7M484 60h58m-10-7l10 7-10 7" stroke="#1b1a2b" stroke-width="2" fill="none"/>
<text x="243" y="22" text-anchor="middle" fill="#55546a" font-size="12">Veränderungsdienst</text><text x="513" y="22" text-anchor="middle" fill="#55546a" font-size="12">Provisionsabrechnung</text></g></svg>'''
BILD_IMPORT = '''<svg viewBox="0 0 760 150" role="img" aria-label="Ein Import ergänzt, er löscht nicht"><g font-family="Helvetica,Arial,sans-serif" font-size="13">
<text x="10" y="18" font-weight="700">Bisheriger Stand</text><text x="270" y="18" font-weight="700">Neue Datei</text><text x="530" y="18" font-weight="700">Ergebnis</text>
<g><rect x="10" y="28" width="200" height="28" rx="6" fill="#ecebfb"/><text x="20" y="47">Januar · Kunde A · 10 €</text><rect x="10" y="62" width="200" height="28" rx="6" fill="#ecebfb"/><text x="20" y="81">Februar · Kunde B · 20 €</text></g>
<g><rect x="270" y="62" width="200" height="28" rx="6" fill="#e8f0fb"/><text x="280" y="81">Februar · Kunde B · 20 €</text><rect x="270" y="96" width="200" height="28" rx="6" fill="#e8f0fb"/><text x="280" y="115">März · Kunde C · 30 €</text></g>
<g><rect x="530" y="28" width="220" height="28" rx="6" fill="#fdf0d5"/><text x="540" y="47">Januar · A · 10 €  (bleibt)</text><rect x="530" y="62" width="220" height="28" rx="6" fill="#e6f5ef"/><text x="540" y="81">Februar · B · 20 €  (einmal)</text><rect x="530" y="96" width="220" height="28" rx="6" fill="#e6f5ef"/><text x="540" y="115">März · C · 30 €  (neu)</text></g>
<path d="M214 76h48m-9-6l9 6-9 6M474 76h48m-9-6l9 6-9 6" stroke="#1b1a2b" stroke-width="2" fill="none"/><text x="238" y="68" text-anchor="middle" font-size="16">+</text><text x="498" y="68" text-anchor="middle" font-size="16">=</text>
<text x="10" y="144" fill="#55546a" font-size="12">Nichts zählt doppelt, nichts geht verloren – auch wenn in der neuen Datei der Januar fehlt.</text></g></svg>'''
BILD_TRICHTER = '''<svg viewBox="0 0 760 150" role="img" aria-label="Verkaufstrichter"><g font-family="Helvetica,Arial,sans-serif" font-size="13" text-anchor="middle">
<polygon points="130,10 630,10 580,42 180,42" fill="#ecebfb"/><text x="380" y="31">30 Kunden angeschrieben</text>
<polygon points="183,46 577,46 530,78 230,78" fill="#dcd8f8"/><text x="380" y="67">18 erreicht</text>
<polygon points="233,82 527,82 480,114 280,114" fill="#c5bff3"/><text x="380" y="103">7 Termine</text>
<polygon points="283,118 477,118 440,146 320,146" fill="#5a48cf"/><text x="380" y="137" fill="#fff" font-weight="700">3 Abschlüsse</text></g></svg>'''
BILD_SOLL = '''<svg viewBox="0 0 760 90" role="img" aria-label="Soll-Ist-Vergleich"><g font-family="Helvetica,Arial,sans-serif" font-size="13">
<text x="10" y="20" font-weight="700">Jahresziel 6.000 €</text><rect x="10" y="30" width="740" height="18" rx="9" fill="#ecebf3"/><rect x="10" y="30" width="330" height="18" rx="9" fill="#5a48cf"/>
<line x1="442" y1="24" x2="442" y2="54" stroke="#1b1a2b" stroke-width="2.5"/><text x="442" y="72" text-anchor="middle" fill="#55546a">Soll bis heute (Juli): 3.500 €</text><text x="175" y="72" text-anchor="middle" fill="#5a48cf" font-weight="700">Stand: 2.680 €</text>
<text x="750" y="72" text-anchor="end" fill="#c93a3a">820 € darunter</text></g></svg>'''
BILDER = {0: ('Ein Import ergänzt, er löscht nicht', BILD_IMPORT), 1: ('Vom Antrag bis zur Abrechnung', BILD_ABLAUF), 2: ('Soll-Ist-Vergleich: Stand gegen das Soll bis heute', BILD_SOLL), 3: ('Der Verkaufstrichter einer Aktion', BILD_TRICHTER)}

o = ['<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Fibel zum Antragsbuch</title><style>',
 '@page{size:A4;margin:16mm 15mm 18mm}body{font-family:Helvetica,Arial,sans-serif;font-size:10pt;line-height:1.42;color:#1b1a2b;margin:0}',
 'h1{font-size:25pt;margin:0 0 4mm;letter-spacing:-.01em}h2{font-size:15pt;margin:0 0 1mm;color:#5a48cf;break-after:avoid}.unter{color:#55546a;margin:0 0 4mm}',
 '.titel{padding:28mm 0 10mm}.titel p{font-size:11.5pt;max-width:150mm;color:#55546a}.auge{font-size:9pt;letter-spacing:.1em;text-transform:uppercase;color:#5a48cf;font-weight:700}',
 '.kapitel{break-before:page}.b{break-inside:avoid;border-top:1px solid #dddbe8;padding:3mm 0}.b h3{font-size:11.5pt;margin:0 0 .5mm}.fach{color:#5a48cf;font-weight:700;font-size:9pt}',
 '.b p{margin:1mm 0}.zeile{display:grid;grid-template-columns:31mm 1fr;gap:2mm;margin-top:1mm}.zeile b{color:#55546a;font-weight:700;font-size:8.6pt;padding-top:.4mm}',
 '.adp{background:#f3f2f9;border-radius:2mm;padding:1.4mm 2.4mm;font-style:italic}.links{font-size:8.4pt;margin-top:1.2mm}.links a{color:#2a74cf;margin-right:4mm}',
 'figure{margin:3mm 0 5mm;break-inside:avoid}figure svg{width:100%;height:auto}figcaption{font-size:8.6pt;color:#55546a;margin-top:1mm}',
 '.inhalt{columns:2;column-gap:10mm;font-size:9.5pt}.inhalt div{break-inside:avoid;margin-bottom:3mm}.inhalt b{color:#5a48cf}.hinweis{font-size:8.6pt;color:#55546a;border-top:1px solid #dddbe8;padding-top:3mm;margin-top:6mm}',
 '</style></head><body>']
n = sum(len(k[2]) for k in K)
o.append('<section class="titel"><div class="auge">Antragsbuch · Begleitheft</div><h1>Die Fibel zum Antragsbuch</h1><p>%d Begriffe aus Technik, Prozessen, Kennzahlen, Vertrieb und Führung – jeweils in einem Satz erklärt, mit dem Beispiel aus dem Antragsbuch und einem Satz, mit dem Sie es einem Außendienstpartner erklären.</p></section>' % n)
o.append('<h2>Inhalt</h2><div class="inhalt">' + ''.join('<div><b>%s</b><br>%s</div>' % (e(t), e(' · '.join(x[0] for x in bs))) for t, _, bs in K) + '</div>')
o.append('<p class="hinweis">Die Verweise führen auf die Suche bei Wikipedia und YouTube, damit sie auch dann funktionieren, wenn ein Artikel umbenannt wird. Einzelne Fundstellen wurden nicht geprüft. Stand der Beispiele: Antragsbuch 3.9.</p>')
for i, (titel, unter, bs) in enumerate(K):
    o.append('<section class="kapitel"><h2>%d · %s</h2><p class="unter">%s</p>' % (i + 1, e(titel), e(unter)))
    if i in BILDER: o.append('<figure>%s<figcaption>%s</figcaption></figure>' % (BILDER[i][1], e(BILDER[i][0])))
    for kurz, fach, erkl, app, adp, such in bs:
        o.append('<div class="b"><h3>%s</h3><div class="fach">Fachwort: %s</div><p>%s</p><div class="zeile"><b>Im Antragsbuch</b><span>%s</span></div><div class="zeile"><b>Für den ADP</b><span class="adp">%s</span></div><div class="links"><a href="%s">Wikipedia: %s</a><a href="%s">Videos dazu</a></div></div>'
                 % (e(kurz), e(fach), e(erkl), e(app), e(adp), wiki(such), e(such), yt(fach.split(',')[0])))
    o.append('</section>')
o.append('</body></html>')
open(os.path.join(sys.argv[1], 'fibel.html'), 'w').write('\n'.join(o)); print(n, 'Begriffe')
