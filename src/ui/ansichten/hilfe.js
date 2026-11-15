/* Antragsbuch – Hilfe: Ablauf als animiertes Schaubild, häufige Fragen, Kurzanleitung, Tour. */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h;
  function abschnitt(titel, inhalt) { return h('section', null, h('h3', null, titel), inhalt); }
  function liste(art, punkte) { return h(art, null, punkte.map(function (p) { return h('li', null, p); })); }

  var ABLAUF = [
    { nr: 1, titel: 'Antrag eintragen', kurz: 'am Tag der Einreichung', icon: 'antraege', ziel: 'antraege', knopf: 'Zu den Anträgen',
      was: 'Sobald Sie einen Antrag einreichen, erfassen Sie ihn: Name, Bereich, Vorgangsart, Tarif und Beitrag. Das dauert unter einer Minute (Taste N).',
      wann: 'Sofort bei Einreichung. Die Bearbeitungsampel beginnt ab diesem Tag zu zählen.', datei: 'Keine Datei nötig.' },
    { nr: 2, titel: 'Policierung abwarten', kurz: 'Veränderungsdienst einlesen', icon: 'vdienst', ziel: 'vdienst', knopf: 'Zum Veränderungsdienst',
      was: 'Der Versicherer bearbeitet den Antrag. Lesen Sie den Veränderungsdienst ein: Passende Anträge werden „Policiert" und erhalten ihre Vertragsnummer. Ohne Veränderungsdienst setzen Sie den Status von Hand.',
      wann: 'Sobald der Veränderungsdienst vorliegt. Wird die Ampel vorher gelb oder rot, lohnt eine Nachfrage.', datei: 'Veränderungsdienst als CSV oder Excel. Der genaue Dateiname wird noch ergänzt.' },
    { nr: 3, titel: 'Abrechnung einlesen', kurz: 'ab dem 6. des Folgemonats', icon: 'hoch', ziel: 'abgleich', knopf: 'Zum Abgleich',
      was: 'Die Provisionsabrechnung ins Fenster ziehen. Die Datei ist kumuliert seit Januar – Sie lesen jeden Monat einfach die neueste ein. Die App erkennt, welche Buchungen neu sind.',
      wann: 'Monatlich, etwa ab dem 6. Die App erinnert Sie in der Übersicht daran.', datei: 'Provisionsabrechnung als CSV, unverändert aus dem Portal. Der genaue Dateiname wird noch ergänzt.' },
    { nr: 4, titel: 'Abgleich prüfen', kurz: 'fünf Listen durchgehen', icon: 'abgleich', ziel: 'abgleich', knopf: 'Zum Abgleich',
      was: 'Die App ordnet Buchungen Ihren Anträgen zu. „Gleich" ist erledigt. Prüfen Sie „Abweichung" (Betrag passt nicht), „Offen" (keine Buchung), „Neu ohne Antrag" (Buchung ohne Eintrag) und „Storno".',
      wann: 'Direkt nach dem Einlesen. Zuordnungsvorschläge bestätigen Sie mit einem Klick.', datei: 'Keine weitere Datei.' },
    { nr: 5, titel: 'Klären und nachhalten', kurz: 'exportieren, reklamieren', icon: 'runter', ziel: 'antraege', knopf: 'Zu den Anträgen',
      was: 'Was hängt oder nicht stimmt, geben Sie gezielt weiter: Anträge anhaken und die Prioritätenliste exportieren, oder eine Abweichung reklamieren. Korrekturen in späteren Abrechnungen ordnet die App von selbst zu.',
      wann: 'Bei roten Ampeln, offenen Nachbearbeitungen und Abweichungen. Danach beginnt der Kreis mit dem nächsten Antrag von vorn.', datei: 'Export als Excel oder PDF.' }
  ];
  var FAQ = [
    ['Wo sind meine Daten gespeichert?', 'In Ihrer Projektdatei – den Speicherort haben Sie beim Anlegen selbst gewählt – und als Sicherung im Browser dieses Rechners. Nichts wird ins Internet übertragen; das ist im Programm gesperrt.'],
    ['Muss ich speichern?', 'Nein. Jede Änderung wird automatisch gespeichert. Unten links steht „Gespeichert um …". Kann der Browser nicht direkt in Dateien schreiben, erscheint dort ein Hinweis; dann bitte regelmäßig „Kopie herunterladen".'],
    ['Die Abrechnung enthält doch wieder alle Monate – lese ich etwas doppelt ein?', 'Nein. Die Datei ist kumuliert, und jeder Import ersetzt den Stand des Jahres. Die App vergleicht mit dem letzten Import und markiert nur die neuen Buchungen. Bestätigte Zuordnungen und abgehakte Buchungen bleiben erhalten.'],
    ['Ich habe die Vertragsnummer noch nicht. Was nun?', 'Bei Neugeschäft tragen Sie sie nach der Policierung nach – oder gar nicht von Hand: Der Veränderungsdienst ergänzt sie, und im Abgleich schlägt die App passende Buchungen vor (über Name, Beitrag, Beginn und Tarif).'],
    ['Was bedeutet die Ampel?', 'Sie zählt Werktage seit der Einreichung, ohne Wochenenden und Feiertage. Grün: im Rahmen. Gelb: Frist erreicht. Rot: überfällig oder Nachbearbeitung offen. Die Fristen je Bereich stehen in den Einstellungen.'],
    ['Warum ist ein policierter Antrag noch nicht „Abgerechnet"?', 'Die Provision wird erst mit der Abrechnung des Folgemonats gebucht, etwa am 6. Solange ist das normal. Gelb wird der Antrag erst, wenn die Abrechnung vorliegen müsste und keine Buchung enthält.'],
    ['Die Provision weicht ab. Was tue ich?', 'Zuerst in den Einstellungen prüfen, ob Ihr Faktor stimmt (Startwerte sind Beispiele). Stimmt Ihr Faktor, ist es ein Fall für die Reklamation. Ist die Abweichung in Ordnung, klicken Sie „Akzeptieren".'],
    ['Was mache ich mit „Neu ohne Antrag"?', 'Das sind Buchungen ohne Ihren Eintrag, etwa Dynamik oder Beitragsanpassung. „Antrag" legt einen Antrag daraus an, „Zuordnen" hängt sie an einen bestehenden, der Haken markiert sie als „kein Antrag nötig".'],
    ['Wie gebe ich Fälle zur Klärung weiter?', 'In der Antragsliste die Fälle anhaken und oben „Prioritätenliste exportieren" wählen – als Excel oder als PDF über „Drucken".'],
    ['Ich finde einen Kunden nicht in meinen Anträgen.', 'F4 (Name) oder F3 (Vertragsnummer) durchsucht auch die gesamte Abrechnung. Die Kundenakte zeigt Buchungen und Tarife, und von dort legen Sie direkt einen Antrag an.'],
    ['Wie schütze ich meine Datei mit einem Passwort?', 'Unter Einstellungen → Passwortschutz. Die Projektdatei und die Sicherung im Browser werden dann verschlüsselt und beim Öffnen wird das Passwort abgefragt. Achtung: Ohne Passwort sind die Daten nicht wiederherstellbar – bitte sicher notieren. Exporte nach Excel oder PDF sind nicht verschlüsselt.'],
    ['Darf ich Gesundheitsangaben eintragen?', 'Nein. In Bemerkung und Nachbearbeitung gehören keine Diagnosen oder Gesundheitsdetails. Schreiben Sie „Unterlagen nachgefordert", nicht den medizinischen Grund.'],
    ['Kann ich die Projektdatei weitergeben?', 'Bitte nicht – sie enthält alle Kundendaten. Für die Weitergabe gibt es die Exporte. Bei Fragen zur App helfen die Beispieldaten von der Startseite.'],
    ['Ich habe etwas falsch gemacht. Kann ich zurück?', 'Ja. Unter Einstellungen → Sicherungsstände liegen die letzten zehn Stände; vor jedem Import und vor jedem Löschen wird automatisch einer angelegt.'],
    ['Ich habe bisher kein Antragsbuch geführt. Kann ich die App trotzdem nutzen?', 'Ja. Lesen Sie nur Ihre Provisionsabrechnung ein und öffnen Sie „Meine Produktion": Dort sehen Sie Monate, Sparten, Kategorien, Neugeschäft, Erhöhungen, Storno und Provision. Über die Kundensuche (F3/F4) finden Sie jeden Vertrag der Abrechnung.'],
    ['Kann ich mein altes Excel-Antragsbuch übernehmen?', 'Ja. Die Excel-Datei ins Fenster ziehen; die App erkennt das Blatt und übernimmt Monat, Sparte, Tarif, Beitrag, Status und Provision. Danach die Abrechnung desselben Jahres einlesen: Unter Abgleich → Offen schlägt die App die Vertragsnummern über Beitrag und Provision vor – die sicheren mit einem Klick.'],
    ['Die Abrechnung ist von einem anderen Jahr als mein Projekt.', 'Bei einem leeren Projekt stellt die App das Jahr von selbst um. Sind schon Anträge erfasst, fragt sie nach.'],
    ['Wie sehe ich, wo ich je Sparte im Team stehe?', 'Im Reiter „Team": Sobald die Teamdatei aus der Sammelmappe eingelesen ist, zeigt eine Tabelle je Sparte Ihren Wert, den Median und einen Pfeil in fünf Stufen – von „Spitze" (oberste 20 %) bis „deutlich darunter".'],
    ['Wie halte ich eine Aktion (z. B. ein Anschreiben an 30 Kunden) nach?', 'Im Reiter „Aktionen" legen Sie die Aktion an und lesen die Kundenliste als Excel oder CSV ein. Je Kunde tragen Sie bis zu drei Kontakte ein (T Telefon, M E-Mail/Brief, P persönlich, O nicht erreicht, X kein Interesse); das Datum hält die App beim ersten Eintrag fest. Dazu das Ergebnis (Termin, Angebot, Abschluss, Absage) und beim Abschluss den Monatsbeitrag. Quoten und Diagramme entstehen von selbst, die Liste lässt sich als Excel oder PDF ausgeben. Mit „Antrag" erfassen Sie direkt einen Antrag zum Kunden.'],
    ['Warum zeigt „Meine Produktion" zwei verschiedene Beträge?', 'Der Netto-Beitrag ist die Summe der Beitragsänderungen aller Buchungen. Die Nettoproduktion ist die bewertete Produktion (Spalte „Produktion" der Abrechnung) – diese Größe steht auch in den Monatsscheiben und im Bonus-Reporting. Für Ziele und Bonus zählt die Nettoproduktion.'],
    ['Wie prüfe ich mein Bonus-Reporting?', 'Im Reiter „Bonus" tragen Sie links die Werte und das Datum Ihres letzten Bonus-Reportings ein. Die Vorschau darunter stellt daneben, was seitdem in der Abrechnung gebucht wurde und was im Antragsbuch beantragt, aber noch nicht abgerechnet ist – jeweils mit den Positionsnummern der Anträge. Weicht die bestätigte Zahl von den vor dem Stand gebuchten Anträgen ab, erscheint ein Hinweis. Mit „Überprüfung Bonus exportieren" erhalten Sie eine Excel-Datei mit Zusammenfassung und allen Positionen für Rückfragen.'],
    ['Was ist die Positionsnummer (Pos.)?', 'Jeder Antrag erhält beim Erfassen eine feste laufende Nummer, wie die Zeilennummer im Excel-Antragsbuch. Sie ändert sich nie und wird nach dem Löschen nicht neu vergeben. Sie steht in der Antragsliste, in allen Exporten und in der Bonus-Vorschau.'],
    ['Wo stehe ich im ADP-Wettbewerb?', 'Im Reiter „Bonus" tragen Sie die Werte aus Ihrem Bonus-Reporting ein. Die App zeigt Grundbonus, Zusatzboni und was bis zum nächsten Ziel fehlt. Maßgeblich bleibt die Auswertung des Versicherers.'],
    ['Was bedeutet „Lesemodus"?', 'Die Lizenz ist abgelaufen oder es fehlt ein Schlüssel. Sie können alles ansehen, suchen und exportieren, aber nichts ändern. Ihre Daten bleiben erhalten. Einen neuen Schlüssel tragen Sie unter Einstellungen → Lizenz ein.'],
    ['Was ist der Unterschied zwischen ADP und Management?', 'ADP sehen ihr eigenes Antragsbuch und ihren Platz im Team ohne Namen der Kollegen. Führungskräfte schalten auf „Management" und vergleichen ADP aus Abrechnung und Monatsscheiben.']
  ];

  AB.ansichten.hilfe = { titel: 'Hilfe', icon: 'hilfe', unter: 'Ablauf, häufige Fragen und Kurzanleitung', zeige: function (el, aktionen, z) {
    aktionen.appendChild(D.btn('Tour starten', AB.tour.start, { klasse: 'haupt-btn', icon: 'funke' }));
    // ---------- Ablauf ----------
    var aktiv = z.schritt || 0, auto = !z.schritt, timer = null;
    var reihe = h('div.prozess-reihe'), detail = h('div.prozess-detail');
    ABLAUF.forEach(function (s, i) {
      if (i) reihe.appendChild(h('div.prozess-pfeil', { 'aria-hidden': 'true' }, D.s('svg', { viewBox: '0 0 60 16', preserveAspectRatio: 'none' },
        D.s('line', { x1: 0, y1: 8, x2: 50, y2: 8 }), D.s('path', { d: 'M48 2l9 6-9 6', fill: 'none' }))));
      reihe.appendChild(h('button.prozess-schritt', { type: 'button', onclick: function () { auto = false; clearInterval(timer); waehle(i); } },
        h('span.prozess-nr', null, String(s.nr)), D.icon(s.icon), h('b', null, s.titel), h('small', null, s.kurz)));
    });
    function waehle(i) {
      aktiv = z.schritt = i;
      var s = ABLAUF[i], knoepfe = reihe.querySelectorAll('.prozess-schritt'), pfeile = reihe.querySelectorAll('.prozess-pfeil');
      knoepfe.forEach(function (k, n) { k.classList.toggle('aktiv', n === i); k.classList.toggle('fertig', n < i); });
      pfeile.forEach(function (p, n) { p.classList.toggle('aktiv', n === i - 1); p.classList.toggle('fertig', n < i - 1); });
      D.leere(detail);
      D.anhaengen(detail, [h('div', null, h('h3', null, s.nr + ' · ' + s.titel), h('p', null, s.was)),
        h('dl', null, h('dt', null, 'Wann'), h('dd', null, s.wann), h('dt', null, 'Datei'), h('dd', null, s.datei)),
        D.btn(s.knopf, function () { AB.app.zeige(s.ziel); }, { klasse: 'klein-btn' })]);
      detail.classList.remove('rein'); void detail.offsetWidth; detail.classList.add('rein');
    }
    el.appendChild(h('div.karte.prozess.rein', null, h('div.leiste', null, h('h3', null, 'So läuft es: vom Antrag bis zur Provision'), h('span.frei'),
      h('span.mini', null, 'Schritt anklicken für Details')), reihe, detail,
      h('div.mini', { style: { marginTop: '8px' } }, 'Nach Schritt 5 beginnt der Kreis von vorn: Jeder Monat bringt neue Anträge und eine neue Abrechnung.')));
    waehle(aktiv);
    if (auto && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(function () {
      if (!reihe.isConnected) { clearInterval(timer); return; }
      waehle((aktiv + 1) % ABLAUF.length); z.schritt = 0;
    }, 4200);

    // ---------- FAQ ----------
    var q = h('input', { type: 'search', placeholder: 'Frage suchen …', oninput: function () { zeichneFaq(); } }), faqBox = h('div.faq');
    function zeichneFaq() {
      var w = AB.util.falte(q.value).split(/\s+/).filter(Boolean);
      D.leere(faqBox);
      FAQ.filter(function (f) { var t = AB.util.falte(f[0] + ' ' + f[1]); return w.every(function (x) { return t.indexOf(x) >= 0; }); }).forEach(function (f) {
        faqBox.appendChild(h('details', w.length ? { open: true } : null, h('summary', null, f[0]), h('p', null, f[1])));
      });
      if (!faqBox.firstChild) faqBox.appendChild(h('p.muted', null, 'Keine passende Frage gefunden.'));
    }
    zeichneFaq();
    el.appendChild(h('div.karte.rein', null, h('div.leiste', null, h('h3', null, 'Häufige Fragen'), h('span.frei'), h('div.suche', { style: { maxWidth: '280px' } }, D.icon('suche'), q)), faqBox));

    // ---------- Kurzanleitung ----------
    el.appendChild(h('div.karte.rein', null, h('h3', { style: { marginBottom: '10px' } }, 'Kurzanleitung'), h('div.hilfe', null,
      abschnitt('Speichern', h('p', null, 'Beim Anlegen wählen Sie einmal den Speicherort der Projektdatei. Danach speichert die App jede Änderung automatisch. Zusätzlich liegt eine Kopie im Browser; ist sie neuer als die Datei, bietet die App die Wiederherstellung an.')),
      abschnitt('Antrag erfassen', liste('ul', [
        'Pflicht: Eingangsdatum, Name, Vorname, Bereich, Vorgangsart, Tarif, Beitrag. Minder- und Stornobeträge zählen automatisch negativ.',
        'Je Person und Tarif eine Position – so rechnet auch der Versicherer ab.',
        'Die erwartete Provision kommt aus Ihren Regeln (Einstellungen) und lässt sich je Antrag überschreiben.',
        'Nachbearbeitung: im Antrag eintragen, was offen ist – ohne Gesundheitsangaben.'])),
      abschnitt('Die fünf Listen im Abgleich', liste('ul', [
        'Gleich: Buchung gefunden, Beitrag und Provision stimmen. Status wird „Abgerechnet".',
        'Abweichung: gefunden, aber Beitrag oder Provision weicht ab.',
        'Offen: nach der eingestellten Frist (Standard 60 Tage) noch keine Buchung; darüber stehen Zuordnungsvorschläge.',
        'Neu ohne Antrag: Buchungen ohne passenden Antrag.',
        'Storno: Rückbuchungen (X) mit Grund und Ende der Stornohaftung.'])),
      abschnitt('Ordner statt Hochladen', h('p', null, 'Unter Einstellungen → Import-Ordner verbinden Sie einmal den Ordner, in dem Sie Abrechnungen ablegen. Neue Dateien liest die App dann von selbst ein. Nach einem Browser-Neustart fragt der Browser einmal nach der Erlaubnis.')),
      abschnitt('Team und Management', h('p', null, 'ADP: Teamdatei der Führungskraft ablegen – Sie sehen Ihren Platz, den Median, Ihr Ziel und je Sparte einen Pfeil in fünf Stufen. Führungskräfte schalten oben auf „Management", legen Abrechnung und Sammelmappe (Monatsscheiben je ADP) ab, vergleichen ADP per Häkchen und erzeugen eine Teamdatei ohne Namen.')),
      abschnitt('Aktionen', h('p', null, 'Kundenlisten nachhalten: Aktion anlegen, Liste einlesen, je Kunde Kontakt und Ergebnis eintragen. Überfällig ist, wer nach dem Zieldatum noch nicht bearbeitet wurde. Bitte keine Gesundheitsangaben in die Notiz schreiben.')),
      abschnitt('Meine Produktion und Bonus', h('p', null, '„Meine Produktion" wertet allein die eigene Abrechnung aus – ohne dass ein Antrag erfasst sein muss. „Bonus" rechnet den Stand im ADP-Wettbewerb aus den Werten des Bonus-Reportings.')),
      abschnitt('Export, Druck, Darstellung', h('p', null, 'Jede Liste hat „Excel" (formatiert, mit Farben; mit Umschalt-Taste als CSV) und „Drucken" – im Druckdialog „Als PDF speichern" wählen. Oben rechts wechseln Sie zwischen Auto, Hell und Dunkel.')),
      abschnitt('Datenschutz', h('p', null, 'Die App arbeitet vollständig offline; eine Internetverbindung ist im Programm gesperrt. Alle Daten liegen in Ihrer Projektdatei und im Browser dieses Geräts. Geben Sie die Projektdatei nicht weiter und tragen Sie keine Gesundheitsangaben ein.')),
      abschnitt('Tasten', liste('ul', ['N – neuer Antrag', '/ – in die Suche springen', 'F3 / F4 – Kundensuche nach Nummer / Name', 'Enter – speichern · Strg+Enter – speichern & nächster', 'Alt+P – weitere Position · Esc – Dialog schließen'])))));
  } };
})(globalThis.AB = globalThis.AB || {});
