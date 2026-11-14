/* Antragsbuch – geführte Tour: hebt nacheinander die wichtigsten Stellen hervor und erklärt sie. */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h;
  var T = AB.tour = {};
  T.SCHRITTE = [
    { ansicht: 'uebersicht', titel: 'Willkommen im Antragsbuch', text: 'In zwei Minuten zeigt Ihnen die Tour, was wo ist. Mit „Weiter" (oder Pfeil rechts) geht es voran, mit Esc beenden Sie die Tour jederzeit. Tipp: Mit den Beispieldaten von der Startseite sehen Sie überall gefüllte Listen.' },
    { ansicht: 'uebersicht', sel: '#nav', titel: 'Die Bereiche', text: 'Links wechseln Sie zwischen Übersicht, Anträgen, Abgleich, Veränderungsdienst, Team, Einstellungen und Hilfe. Die Zahl am Abgleich zeigt, wie viele Fälle auf Sie warten.' },
    { ansicht: 'uebersicht', sel: '#aktionen .haupt-btn', titel: 'Antrag erfassen', text: 'Taste N oder dieser Knopf. Beispiel: Muster, Anna · Vollversicherung · Neu · Tarif A107 · 250,50 €. Enter speichert, Strg+Enter speichert und öffnet gleich den nächsten.' },
    { ansicht: 'antraege', sel: '.vt', titel: 'Ihre Anträge', text: 'Die Ampel zählt Werktage seit der Einreichung: Grün ist im Rahmen, Gelb hat die Frist erreicht, Rot ist überfällig oder in Nachbearbeitung. Ein Klick auf eine Zeile öffnet den Antrag.' },
    { ansicht: 'antraege', sel: '.vt-kopf', titel: 'Prioritätenliste exportieren', text: 'Haken Sie links die Anträge an, die jemand vorziehen oder ansehen soll. Dann erscheint oben eine Leiste: als Excel oder als PDF exportieren – mit Kunde, Tarif, Beitrag und Wartezeit.' },
    { ansicht: 'antraege', sel: '.suche', titel: 'Suchen und finden', text: 'Die Suche filtert sofort über alle Felder. F4 öffnet die Kundensuche nach Name, F3 nach Vertragsnummer – auch für Kunden, die nur in der Abrechnung stehen.' },
    { ansicht: 'vdienst', sel: '#inhalt .ablage, #inhalt .karte', titel: 'Veränderungsdienst', text: 'Kommt der Veränderungsdienst, ziehen Sie die Datei einfach ins Fenster. Passende Anträge werden „Policiert" und bekommen ihre Vertragsnummer – Sie müssen nichts abtippen.' },
    { ansicht: 'abgleich', sel: '#inhalt .ablage', titel: 'Provisionsabrechnung einlesen', text: 'Ab etwa dem 6. des Monats liegt die neue Abrechnung vor. Datei hierher ziehen – fertig. Die Datei ist kumuliert seit Januar; die App erkennt selbst, was neu ist.' },
    { ansicht: 'abgleich', sel: '.reiter', titel: 'Die fünf Listen', text: 'Gleich: alles stimmt. Abweichung: Beitrag oder Provision passt nicht. Offen: noch keine Buchung. Neu ohne Antrag: Buchung ohne Ihren Eintrag. Storno: Rückbuchungen. Arbeiten Sie Abweichung und Offen zuerst ab.' },
    { ansicht: 'uebersicht', sel: '.kurz', titel: 'Kurzüberblick', text: 'Immer im Blick: wie viele Anträge offen sind, wie viele rot oder gelb, und die Produktion des Monats. Ein Klick klappt mehr Zahlen auf.' },
    { ansicht: 'uebersicht', sel: '.speicher', titel: 'Es geht nichts verloren', text: 'Jede Änderung wird automatisch gespeichert – hier sehen Sie, wann zuletzt. Zusätzlich liegt eine Sicherung im Browser, und vor jedem Import entsteht ein Sicherungsstand.' },
    { ansicht: 'hilfe', sel: '.prozess', titel: 'Der Ablauf auf einen Blick', text: 'In der Hilfe finden Sie den Ablauf als Schaubild, häufige Fragen und die Kurzanleitung. Die Tour starten Sie dort jederzeit neu. Viel Erfolg!' }
  ];

  T.start = function () {
    if (!AB.app.p || document.getElementById('tour')) return;
    var i = 0, S = T.SCHRITTE;
    var licht = h('div.tour-licht'), titel = h('h3'), text = h('p'), zaehler = h('span.mini');
    var zurueck = D.btn('Zurück', function () { geh(i - 1); }, { klasse: 'klein-btn leise' });
    var weiter = D.btn('Weiter', function () { geh(i + 1); }, { klasse: 'klein-btn haupt-btn' });
    var karte = h('div.karte.tour-karte', { role: 'dialog', 'aria-label': 'Tour' }, titel, text,
      h('div.leiste', null, zaehler, h('span.frei'), D.btn('Beenden', ende, { klasse: 'klein-btn leise' }), zurueck, weiter));
    var box = h('div#tour', null, licht, karte);
    document.body.appendChild(box);
    function ende() { box.remove(); document.removeEventListener('keydown', taste, true); window.removeEventListener('resize', lege); try { localStorage.setItem('antragsbuch-tour', '1'); } catch (e) { /* privat */ } }
    function taste(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); ende(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); geh(i + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); geh(i - 1); }
    }
    function lege() {
      var s = S[i], el = s.sel ? document.querySelector(s.sel) : null, kb = karte.getBoundingClientRect(), W = innerWidth, H = innerHeight;
      if (!el || !el.getClientRects().length) {
        licht.style.cssText = 'left:50%;top:50%;width:0;height:0;';
        karte.style.left = Math.round((W - kb.width) / 2) + 'px'; karte.style.top = Math.round((H - kb.height) / 2) + 'px';
        return;
      }
      var r = el.getBoundingClientRect(), p = 6;
      var x = Math.max(4, r.left - p), y = Math.max(4, r.top - p), w = Math.min(W - 8, r.width + 2 * p), hh = Math.min(H - 8, r.height + 2 * p);
      licht.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + hh + 'px;';
      // Karte dorthin, wo am meisten Platz ist: unten, oben, rechts, links – sonst Mitte
      var kx, ky;
      if (H - (y + hh) > kb.height + 20) { ky = y + hh + 12; kx = x; }
      else if (y > kb.height + 20) { ky = y - kb.height - 12; kx = x; }
      else if (W - (x + w) > kb.width + 20) { kx = x + w + 12; ky = y; }
      else if (x > kb.width + 20) { kx = x - kb.width - 12; ky = y; }
      else { kx = W - kb.width - 24; ky = H - kb.height - 24; }
      karte.style.left = Math.max(12, Math.min(W - kb.width - 12, kx)) + 'px';
      karte.style.top = Math.max(12, Math.min(H - kb.height - 12, ky)) + 'px';
    }
    function geh(n) {
      if (n < 0) return;
      if (n >= S.length) { ende(); return; }
      i = n;
      var s = S[i];
      if (AB.app.ansicht !== s.ansicht) AB.app.zeige(s.ansicht);
      titel.textContent = s.titel; text.textContent = s.text; zaehler.textContent = 'Schritt ' + (i + 1) + ' von ' + S.length;
      zurueck.disabled = i === 0; weiter.firstChild.textContent = i === S.length - 1 ? 'Fertig' : 'Weiter';
      requestAnimationFrame(function () { lege(); setTimeout(lege, 350); });
      weiter.focus();
    }
    document.addEventListener('keydown', taste, true);
    window.addEventListener('resize', lege);
    geh(0);
  };

  /** Beim ersten Öffnen eines Projekts einmal anbieten. */
  T.biete = function () {
    var gesehen; try { gesehen = localStorage.getItem('antragsbuch-tour'); } catch (e) { gesehen = '1'; }
    if (gesehen) return;
    try { localStorage.setItem('antragsbuch-tour', '1'); } catch (e) { /* privat */ }
    D.toast('Neu hier? Die Tour zeigt in zwei Minuten, was wo ist.', { dauer: 15000, aktion: ['Tour starten', T.start] });
  };
})(globalThis.AB = globalThis.AB || {});
