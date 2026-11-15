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
      was: 'Die App ordnet Buchungen Ihren Anträgen zu. „Gleich" ist erledigt. Prüfen Sie „Abweichung" (Betrag passt nicht), „Offen" (noch nicht abgerechnet), „Abgerechnet ohne Antrag" (die Abrechnung enthält etwas, wozu im Antragsbuch kein Antrag steht) und „Storno".',
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
    ['Was ist mit „Antrag" gemeint?', 'Ein Antrag ist hier immer die Zeile, die Sie im Antragsbuch erfassen – mit Kunde, Tarif und Beitrag. Es wird kein Dokument und kein PDF des Kunden hochgeladen oder gespeichert.'],
    ['Was mache ich mit „Abgerechnet ohne Antrag"?', 'Die Abrechnung enthält etwas, wozu im Antragsbuch kein Antrag steht – etwa eine Dynamik, eine Beitragsanpassung oder ein Geschäft, das noch nicht eingetragen wurde. Die App schlägt je Zeile vor, was es vermutlich ist. Eindeutige Dynamik-Erhöhungen übernehmen Sie mit „Dynamik übernehmen" in einem Schritt. Alles andere können Sie prüfen, müssen es aber nicht: „Antrag" legt den Antrag nach dem Vorschlag an (danach änderbar), „Zuordnen" hängt die Zeile an einen bestehenden Antrag, der Haken markiert sie als „kein Antrag nötig". Mit dem Filter „Nur zu prüfende" sehen Sie die unklaren Fälle.'],
    ['Wie wird bei einem Storno zurückgebucht?', 'Nach den Provisionsrichtlinien haftet die Provision in der Zusatzversicherung, bKV und bei Gruppentarifen 12 Monate, in der Vollversicherung (einschließlich Krankentagegeld und Pflegepflicht) 60 Monate. Für jeden Monat ohne vollen Beitrag wird 1/12 bzw. 1/60 der Provision zurückgebucht; bei einer Reduzierung im ersten Jahr 1/12 der Differenzprovision. Stirbt die versicherte Person, gibt es kein Storno. Die Liste „Storno" zeigt deshalb den zurückgebuchten Anteil, z. B. „10/12 zurück". Das Kennzeichen X in der Abrechnung steht für Storno oder Verrechnung: Zeilen ohne Provisionswirkung (etwa ein Tarifwechsel) erscheinen als „Verrechnung" und zählen nicht als Storno.'],
    ['Was ist der Unterschied zwischen Storno und Reklamation?', 'Storno ist eine Rückbuchung der SDK in der Abrechnung (Kennzeichen X): Beitrag und Provision werden ganz oder teilweise zurückgenommen. Eine Reklamation stoßen Sie selbst an, wenn eine Provision fehlt oder falsch ist.'],
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
    ['Was zeigt „Auszahlung abgerechneter Fälle"?', 'Ihr Fixum nach Karrierestufe (Einstellungen) plus die Provision, die tatsächlich in der Abrechnung steht. Offene Anträge sind darin nicht enthalten; was daraus voraussichtlich noch kommt, steht klein darunter.'],
    ['Was bedeuten Brutto, voraussichtlich netto und netto?', 'Brutto ist alles, was Sie eingetragen haben. Voraussichtlich netto sind die Anträge, die laut Veränderungsdienst policiert oder schon abgerechnet sind. Netto ist, was in der Abrechnung steht. Die Policierung kommt meist früher als die Abrechnung; für den Bonus zählt ein Antrag ab der Policierung.'],
    ['Warum muss ich „Neu oder Bestand" angeben?', 'Für den Bonus zählen nur neue Personen: in der Vollversicherung, wer komplett neu abschließt (mit Pflegepflichtversicherung), und jede Kindernachversicherung – dafür gibt es die eigene Auswahl „Kindernachversicherung", sie zählt auch ohne Pflegepflicht. In der bKV zählt, wer bisher nicht versichert war. Bei „Speichern & nächster" wird die Angabe übernommen. Veränderungen im Bestand zählen nicht. Mit der Angabe beim Eintragen stimmt die Bonus-Vorschau von Anfang an.'],
    ['Wie trage ich eine Lebens- oder Rentenversicherung ein?', 'Bereich „Leben" wählen und im Feld „Produkt" tippen: ein Teilwort wie „BU" oder „Riester" genügt, mit Stern findet „*91" auch BU-Plus (T91). Dazu Tarifgruppe, Beitragszahlungsdauer in Jahren und gegebenenfalls „Einmalbeitrag". Die erwartete Provision rechnet die App nach den Provisionsrichtlinien: 30 ‰ der Wertungssumme, bei der Produktlinie classic 20 ‰ mit Laufzeitfaktor; mit Bank die Hälfte.'],
    ['Kann ich die Farbe des Programms ändern?', 'Ja. In den Einstellungen unter „Akzentfarbe" wählen Sie eine Farbe oder lassen mit „Multicolor würfeln" bei jedem Klick eine neue Farbserie vorschlagen. Die Vorschau zeigt das Ergebnis; erst „Übernehmen" schaltet das Programm um. Hell, Dunkel oder Auto stellen Sie mit dem Knopf oben rechts ein. Die Produktfarben in den Diagrammen und die Ampel ändern sich nicht.'],
    ['Wie lese ich eine Datei ein, ohne sie zu verwechseln?', 'Der Knopf „Einlesen" öffnet fünf getrennte Felder: Provisionsabrechnung, Mein bisheriges Antragsbuch, Veränderungsdienst, Team und Auswertung, Projektdatei. Ziehen Sie die Datei auf das passende Feld oder klicken Sie darauf. Die App prüft den Inhalt: Legen Sie zum Beispiel eine Abrechnung ins Feld für das Antragsbuch, fragt sie nach, bevor etwas eingelesen wird.'],
    ['Sind die angezeigten Provisionen verbindlich?', AB.app.HINWEIS.join(' ')],
    ['Wie trage ich mehrere versicherte Personen ein?', 'Der Versicherungsnehmer steht oben im Antrag. Jede versicherte Person bekommt eigene Positionen mit ihrer Personennummer – so bucht auch die Abrechnung: je Person und Tarif eine Zeile. Mit den Knöpfen „Partner/in" und „Kind" legt die Maske die nächste Person mit denselben Tarifen an; Sie tragen nur noch Namen und Beiträge ein. Weicht die versicherte Person vom Versicherungsnehmer ab, schreiben Sie ihren Namen in das Feld „Versicherte Person".'],
    ['Wo trage ich meine Ziele ein?', 'In „Analyse" und in „Meine Produktion" steht die Karte „Meine Ziele". Tragen Sie je Produkt Ihr Jahresziel in Euro Monatsbeitrag ein; es wird in der Projektdatei gespeichert. Die App vergleicht es mit Ihrem Stand – mit der Nettoproduktion laut Abrechnung oder, solange keine eingelesen ist, mit dem eingetragenen Beitrag – und zeigt, ob Sie über oder unter dem gleichmäßigen Verlauf liegen und was je Monat noch nötig ist.'],
    ['Wie verteile ich mein Ziel auf die Monate, und wie nutze ich das Vorjahr?', 'Unter der Zieltabelle stehen zwölf Felder in Prozent, vorbelegt mit 100 ÷ 12. Ändern Sie einzelne Monate (etwa August weniger, Dezember mehr) und klicken Sie auf „Rest gleichmäßig verteilen": Ihre gesetzten Monate bleiben, die übrigen füllen auf 100 % auf. Mit „Vorjahr einlesen" wählen Sie die Abrechnung oder Projektdatei des Vorjahres; dann stehen die Vorjahreswerte je Produkt und die Vorjahresanteile je Monat daneben, und „Verteilung wie im Vorjahr" übernimmt sie als Vorschlag. Gespeichert wird nur die Zusammenfassung.'],
    ['Was zeigt der Reiter „Banken"?', 'Er erscheint, sobald Ihre Abrechnung Buchungen mit einer beteiligten Bank enthält. Je Bank sehen Sie Produktion, Anteil Zusatz und Dynamik, Personen und Verträge, den Monatsverlauf und ein Kreisdiagramm nach Produkt. Tragen Sie die Planproduktion der Bank ein, dann zeigt die App den Zeitzielerreichungsgrad. „Reporting" erzeugt eine Excel-Datei für die Bank, das Druckersymbol ein PDF. Bestand, Vorjahre und Bonifikation der Bank stehen nicht in Ihrer Abrechnung und fehlen deshalb.'],
    ['Was zeigt der Reiter „Analyse"?', 'Ihren mittleren, größten und kleinsten Antrag, die Verteilung nach Größe, den Schnitt je Produktklasse, Anträge mit Familie und was ein etwas größerer Antrag an Beitrag und Provision bringen würde.'],
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
        'Abgerechnet ohne Antrag: Die Abrechnung enthält etwas, wozu im Antragsbuch kein Antrag steht – mit Vorschlag, was es ist.',
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
