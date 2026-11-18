# Quelltext schützen und Lizenz hinterlegen

Stand 14.11.2026. Einschätzung aus technischer Sicht; die rechtlichen Punkte sind nicht anwaltlich geprüft.

## Kurzfassung

Eine HTML-Datei, die offline im Browser läuft, lässt sich **nicht** geheim halten: Der Browser braucht den Programmtext
im Klartext, also kann ihn auch jeder Nutzer lesen. Schützen lässt sich deshalb nicht das Lesen, sondern
**das unbemerkte Weiterverwenden**. Dafür gibt es drei wirksame Hebel, die zusammen ausreichen:

1. **Lizenzschlüssel mit Signatur** (eingebaut): Gültige Schlüssel kann nur ausstellen, wer Ihre geheime Schlüsseldatei hat.
2. **Verteil-Version mit verkleinertem Quelltext** (eingebaut): macht das Lesen und Umbauen mühsam.
3. **Urheberrecht und Lizenzvertrag** (zu erledigen): macht das Kopieren rechtlich angreifbar.

## Was eingebaut ist

### Lizenzschlüssel

| Baustein | Wie es funktioniert |
|---|---|
| Schlüsselpaar | Sie erzeugen es einmal im `lizenz-werkzeug.html`. Der geheime Teil liegt passwortverschlüsselt in Ihrer Schlüsseldatei und verlässt Ihren Rechner nie. |
| Prägen | Das Werkzeug trägt den öffentlichen Teil in eine `antragsbuch.html` ein. Erst diese geprägte Datei prüft Lizenzen. Eine ungeprägte Datei läuft ohne Einschränkung. |
| Lizenz | Eine Zeile Text (`AB1-…`), gebunden an eine Vermittlernummer und ein Ablaufdatum, digital signiert (ECDSA P-256). Fälschen oder Verlängern ohne Ihre Schlüsseldatei ist praktisch ausgeschlossen. |
| Testzeitraum | Ohne Schlüssel läuft eine geprägte Datei eine einstellbare Zahl von Tagen (Vorgabe 30). |
| Vorwarnung | Einstellbar (Vorgabe 30 Tage vor Ablauf) erscheint ein Hinweis mit Knopf „Verlängern". |
| Kulanz | Nach Ablauf läuft die App einstellbar weiter (Vorgabe 14 Tage). |
| Lesemodus | Danach: ansehen, suchen, Excel/PDF-Export ja – erfassen, einlesen, ändern nein. Die Daten bleiben vollständig erhalten. |
| Verlängern | Sie schicken einen neuen Schlüssel. Eine neue App-Datei ist dafür nicht nötig. |

**Ablauf für Sie:** Schlüsselpaar erzeugen → `dist/antragsbuch.html` prägen → geprägte Datei verteilen → je ADP eine Lizenz ausstellen.
Nach jedem App-Update die neue Datei wieder prägen (mit derselben Schlüsseldatei – alte Lizenzen gelten weiter).

**Grenzen, ehrlich benannt:**

- Wer programmieren kann, kann in seiner Kopie die Prüfung entfernen. Die Signatur verhindert gefälschte Schlüssel, nicht das Umbauen der Datei.
- Der Testzeitraum hängt am Datum des ersten Starts auf dem Gerät und am Projekt. Mit gelöschten Browserdaten und neuem Projekt beginnt er neu.
- Die App vertraut der Uhr des Rechners. Wer die Systemzeit zurückstellt, verlängert sich die Lizenz – im Firmenumfeld unüblich und auffällig.
- Eine Lizenz für Nummer 900401 läuft auf jedem Rechner, auf dem diese Nummer eingetragen ist. Das ist gewollt (Zweitgerät), bindet aber nicht an eine Person.

### Verteil-Version

`npm run build:schutz` erzeugt `dist/antragsbuch.html`: Kommentare entfernt, Namen gekürzt, alles in wenigen langen Zeilen.
Funktional identisch (dieselbe Testreihe läuft dagegen), rund 20 % kleiner. Das hält Neugierige ab und macht einen Umbau
zu einer Arbeit von Tagen statt Minuten. Ein Fachmann kommt trotzdem durch.

## Was zusätzlich möglich wäre

| Maßnahme | Wirkung | Preis | Empfehlung |
|---|---|---|---|
| Stärkere Verschleierung (Kontrollfluss, Zeichenketten verschlüsseln) | Lesen wird deutlich mühsamer | Datei größer und langsamer, Fehlersuche schwerer, Virenscanner schlagen eher an | nur bei konkretem Anlass |
| Kernlogik als WebAssembly | Abgleich und Lizenzprüfung nicht mehr als lesbares JavaScript | eigener Build, höherer Pflegeaufwand; weiterhin rückübersetzbar | derzeit nicht |
| Persönliche Kopie je ADP (unsichtbare Kennung in der Datei) | Taucht eine Kopie woanders auf, sehen Sie, von wem sie stammt | je ADP eine eigene Datei prägen | sinnvoll, wenn Sie verkaufen – klein zu bauen |
| Lizenz an Gerät binden | Schlüssel läuft nur auf einem Rechner | Browser liefern keine verlässliche Gerätekennung; Ärger bei neuem Rechner | nicht empfohlen |
| Prüfung über einen Server (Online-Aktivierung, Sperrliste) | Echtes Sperren aus der Ferne | braucht Internet und einen Betreiber, widerspricht der IT-Freigabe und dem Datenschutzkonzept | nicht empfohlen |
| Installierbares Programm statt HTML | Code besser verpackt, Lizenzierung üblich | Installation, Admin-Rechte, Signierung, Updates – genau das sollte vermieden werden | nicht empfohlen |
| Repository privat halten | Der lesbare Quelltext mit Kommentaren und Tests bleibt bei Ihnen | keiner | **ja – bitte prüfen, ob das GitHub-Repository privat ist** |

## Rechtlicher Schutz

- **Urheberrecht:** Computerprogramme sind nach §§ 69a ff. UrhG geschützt, ohne Anmeldung. Kopieren, Umarbeiten und Verbreiten
  braucht Ihre Zustimmung. Der Vermerk „© 2026 Lukas Dragowski. Alle Rechte vorbehalten." steht im Dateikopf, im Starthinweis,
  unter Einstellungen → Urheberrecht und in der Hilfe (seit Version 4.4).
- **Wer ist Urheber?** Sie haben die Anforderungen entwickelt und das Werk beauftragt; der Programmtext ist mit KI-Unterstützung entstanden.
  Ob und wie weit KI-erzeugter Code urheberrechtlich geschützt ist, ist rechtlich nicht abschließend geklärt. Das spricht für einen
  **Lizenzvertrag**, der unabhängig vom Urheberrecht trägt.
- **Arbeitgeber/Versicherer:** Der Rechteinhaber ist selbstständiger Handelsvertreter nach § 84 HGB und hat die App aus eigener Initiative
  entwickeln lassen; § 69b UrhG (Arbeitnehmer) greift damit nicht. Zu prüfen bleibt nur, ob der Vertretervertrag eine Klausel zu Arbeitsergebnissen enthält.
- **Lizenzvertrag (eine Seite):** einfaches, nicht übertragbares Nutzungsrecht für eine Vermittlernummer und ein Jahr; kein Weitergeben,
  kein Verändern; Hilfsmittel ohne Gewähr für die Richtigkeit, maßgeblich bleibt die Abrechnung des Versicherers; Haftung im zulässigen Rahmen begrenzt;
  Daten bleiben beim Nutzer; nach Ablauf Lesemodus.
- **Geschäftsgeheimnis:** Der kommentierte Quelltext im privaten Repository ist als Geschäftsgeheimnis schützbar, wenn Sie ihn tatsächlich
  geheim halten (privates Repository, Schlüsseldatei getrennt aufbewahren).

## Empfehlung

1. Repository auf „privat" prüfen.
2. Für die Family-and-Friends-Phase: ungeprägte Datei verteilen, kein Lizenzzwang, Rückmeldungen sammeln.
3. Vor einem Verkauf: Zustimmung des Versicherers und Lizenzvertrag klären (siehe rechtliche Einschätzung).
4. Dann: Schlüsselpaar erzeugen, `dist/antragsbuch.html` prägen, Jahreslizenzen ausstellen.
5. Schlüsseldatei an zwei Orten sichern (z. B. Rechner und verschlüsselter Stick); das Passwort getrennt davon.

## Noch zu entscheiden

- Laufzeit der Lizenzen: Kalenderjahr oder zwölf Monate ab Ausstellung?
- Testzeitraum, Vorwarnung, Kulanz: Vorgaben 30 / 30 / 14 Tage übernehmen?
- Soll je ADP eine persönliche Kopie mit Kennung erzeugt werden?
