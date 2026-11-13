/* Antragsbuch – Kurzanleitung (eine Seite). */
(function (AB) {
  'use strict';
  var h = AB.dom.h;
  function abschnitt(titel, inhalt) { return h('section', null, h('h3', null, titel), inhalt); }
  function liste(art, punkte) { return h(art, null, punkte.map(function (p) { return h('li', null, p); })); }
  AB.ansichten.hilfe = { titel: 'Hilfe', icon: 'hilfe', unter: 'Kurzanleitung auf einer Seite', zeige: function (el) {
    el.appendChild(h('div.karte.rein', null, h('div.hilfe', null,
      abschnitt('1 · So arbeiten Sie', liste('ol', [
        'Antrag erfassen: Taste N oder „Neuer Antrag". Enter speichert, Strg+Enter speichert und öffnet den nächsten.',
        'Monatlich die Provisionsabrechnung (CSV) ins Fenster ziehen. Die App gleicht automatisch ab.',
        'Im Reiter „Abgleich" die Listen Abweichung, Offen und Neu ohne Antrag durchgehen.',
        'Die Übersicht zeigt jederzeit Stand, Beiträge und Provision je Monat und Jahr.'])),
      abschnitt('2 · Speichern', h('p', null, 'Beim Anlegen wählen Sie einmal den Speicherort der Projektdatei. Danach speichert die App jede Änderung automatisch (Anzeige unten links: „Gespeichert um …"). Zusätzlich liegt eine Kopie im Browser; ist sie neuer als die Datei, bietet die App die Wiederherstellung an. Vor jedem Import entsteht ein Sicherungsstand (Einstellungen → Sicherungsstände).')),
      abschnitt('3 · Antrag erfassen', liste('ul', [
        'Pflicht: Eingangsdatum, Name, Vorname, Bereich, Vorgangsart, Tarif, Beitrag. Minder- und Stornobeträge zählen automatisch negativ.',
        'Je Person und Tarif eine Position – so rechnet auch der Versicherer ab.',
        'Vertragsnummer: Bestandsgeschäft sofort, Neugeschäft nach Policierung. Die App erinnert daran.',
        'Die erwartete Provision kommt aus Ihren Regeln (Einstellungen) und lässt sich je Antrag überschreiben.'])),
      abschnitt('4 · Die fünf Listen im Abgleich', liste('ul', [
        'Gleich: Buchung gefunden, Beitrag und Provision stimmen. Status wird „Abgerechnet".',
        'Abweichung: gefunden, aber Beitrag oder Provision weicht ab. Regel prüfen, Antrag korrigieren oder „Akzeptieren".',
        'Offen: nach der eingestellten Frist (Standard 60 Tage) noch keine Buchung. Darüber stehen Zuordnungsvorschläge für Anträge ohne Vertragsnummer – ein Klick bestätigt.',
        'Neu ohne Antrag: Buchungen ohne passenden Antrag (Dynamik, Beitragsanpassung, vergessener Antrag). Als Antrag übernehmen, zuordnen oder abhaken.',
        'Storno: Rückbuchungen (X) mit Grund und Ende der Stornohaftung.'])),
      abschnitt('5 · Abrechnung einlesen', h('p', null, 'Die Datei des Versicherers ist kumuliert seit Januar. Jeder Import ersetzt den Stand des Jahres; neue Buchungen sind mit „neu" markiert. Kodierung, Trennzeichen, Zahlen und Datum erkennt die App selbst. „Umstellung ohne Provision" und GKV werden nicht gegen die Abrechnung geprüft. Welche Provisionsarten zählen, stellen Sie über die Schalter im Abgleich ein (Hierarchie und Legacy sind für ADP ausgeblendet).')),
      abschnitt('6 · Ordner statt Hochladen', h('p', null, 'Unter Einstellungen → Import-Ordner verbinden Sie einmal den Ordner, in dem Sie Abrechnungen ablegen. Neue Dateien liest die App dann von selbst ein. Nach einem Browser-Neustart fragt der Browser einmal nach der Erlaubnis.')),
      abschnitt('7 · Veränderungsdienst', h('p', null, 'CSV oder Excel ablegen, Spalten einmal zuordnen (wird gemerkt), Treffer prüfen und übernehmen. Treffer setzen den Status „Policiert" und tragen die Vertragsnummer ein.')),
      abschnitt('8 · Team und Management', h('p', null, 'ADP: Teamdatei der Führungskraft ablegen – Sie sehen Ihren Platz, den Median und die Spannweite, ohne Namen der Kollegen. Führungskräfte schalten oben auf „Management": Abrechnung und Monatsscheiben ablegen, ADP per Häkchen vergleichen (Neugeschäft, Erhöhung, Storno, Sparten) und eine Teamdatei ohne Namen für die ADP erzeugen.')),
      abschnitt('9 · Export, Druck, Darstellung', h('p', null, 'Jede Liste hat „CSV" (für Excel) und „Drucken". Oben rechts wählen Sie Hell, Dunkel oder Auto.')),
      abschnitt('10 · Datenschutz', h('p', null, 'Die App arbeitet vollständig offline. Es gibt keine Internetverbindung, keine Übertragung und keine Auswertung durch Dritte – technisch im Programm gesperrt. Alle Daten liegen in Ihrer Projektdatei und im Browser dieses Geräts. Geben Sie die Projektdatei nicht weiter.')),
      abschnitt('Tasten', liste('ul', ['N – neuer Antrag', '/ – in die Suche springen', 'Enter – speichern · Strg+Enter – speichern & nächster', 'Alt+P – weitere Position · Esc – Dialog schließen'])))));
  } };
})(globalThis.AB = globalThis.AB || {});
