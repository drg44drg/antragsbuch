/* Antragsbuch – Einstellungen: Stammdaten, Toleranzen, Provisionsregeln, Tarifliste, Ordner, Sicherungen. */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h, U = AB.util, M = AB.model, Sp = AB.speicher, App = AB.app;
  function zahl(wert, setze, attrs) {
    var i = h('input', Object.assign({ type: 'text', inputMode: 'decimal', value: String(wert == null ? '' : wert).replace('.', ','), onchange: function () {
      var n = U.parseZahl(i.value); if (isNaN(n)) { i.classList.add('fehler'); return; } i.classList.remove('fehler'); setze(n); App.geaendert({ still: true });
    } }, attrs || {}));
    return i;
  }
  function text(wert, setze, attrs) { var i = h('input', Object.assign({ type: 'text', value: wert || '', onchange: function () { setze(i.value.trim()); App.geaendert({ still: true }); } }, attrs || {})); return i; }

  AB.ansichten.einstellungen = { titel: 'Einstellungen', icon: 'einstellungen', unter: 'Gelten für dieses Projekt und werden in der Projektdatei gespeichert',
    zeige: function (el, aktionen, z) {
      var p = App.p, e = p.einstellungen;
      // Stammdaten + Toleranzen
      el.appendChild(h('div.raster.r-2', null,
        h('div.karte', null, h('h3', null, 'Meine Angaben'), h('div.formraster', { style: { marginTop: '10px' } },
          D.feld('Vermittlernummer', text(e.vermittlernummer, function (v) { e.vermittlernummer = v; }, { inputMode: 'numeric' }), 's4'),
          D.feld('Name (für Ausdrucke)', text(e.name, function (v) { e.name = v; }), 's5'),
          D.feld('Jahr', zahl(p.jahr, function (v) { p.jahr = Math.round(v); }), 's3'))),
        h('div.karte', null, h('h3', null, 'Abgleich'), h('div.formraster', { style: { marginTop: '10px' } },
          D.feld('Toleranz Beitrag (€)', zahl(e.toleranzBeitrag, function (v) { e.toleranzBeitrag = Math.abs(v); }), 's3'),
          D.feld('Toleranz Provision (€)', zahl(e.toleranzProvision, function (v) { e.toleranzProvision = Math.abs(v); }), 's3'),
          D.feld('„Offen" nach Tagen', zahl(e.offenTage, function (v) { e.offenTage = Math.max(0, Math.round(v)); }), 's3'),
          D.feld('Storno ab % Rückbuchung', zahl(e.stornoSchwelle, function (v) { e.stornoSchwelle = Math.min(100, Math.max(1, v)); }), 's3'),
          h('label.schalter.s12', null, h('input', { type: 'checkbox', checked: !!e.pruefeProvision, onchange: function () { e.pruefeProvision = this.checked; App.geaendert({ still: true }); } }), 'Auch die Provision gegen meine Regeln prüfen (sonst nur den Beitrag)'),
          h('div.feld.s12', null, h('span', null, 'Provisionsarten im Abgleich'), h('div.leiste', null, AB.abrechnung.PROVISIONSARTEN.map(function (a) {
            var an = e.provisionsarten.indexOf(a) >= 0;
            return h('button.chip' + (an ? '.aktiv' : ''), { type: 'button', onclick: function () { if (an) e.provisionsarten = e.provisionsarten.filter(function (x) { return x !== a; }); else e.provisionsarten.push(a); App.geaendert(); } }, a);
          })))))));

      // Provisionsregeln
      var regelBox = h('div');
      M.BEREICHE.forEach(function (b, bi) {
        var tb = h('tbody');
        M.VORGAENGE.forEach(function (v) {
          var r = p.regeln[b.id + '|' + v.id], einheit = h('td.mini');
          var setzeEinheit = function () { einheit.textContent = (AB.provision.ARTEN.find(function (a) { return a.id === r.art; }) || {}).einheit || ''; };
          setzeEinheit();
          tb.appendChild(h('tr', null, h('td', { style: { width: '26%' } }, v.name),
            h('td', { style: { width: '36%' } }, D.auswahl(AB.provision.ARTEN.map(function (a) { return [a.id, a.name]; }), r.art, function (w) { r.art = w; setzeEinheit(); App.geaendert({ still: true }); })),
            h('td', { style: { width: '14%' } }, zahl(r.wert, function (n) { r.wert = n; }, { style: { textAlign: 'right' } })), einheit));
        });
        var erste = p.regeln[b.id + '|neu'];
        regelBox.appendChild(h('details', bi === 0 ? { open: true } : null, h('summary', null, b.name, h('span.mini', { style: { marginLeft: '10px', fontWeight: 400 } }, 'Neu: ' + U.fmtZahl(erste.wert, 2) + ' ' + ((AB.provision.ARTEN.find(function (a) { return a.id === erste.art; }) || {}).einheit || ''))),
          h('table.einfach', { style: { maxWidth: '820px', marginBottom: '8px' } }, h('thead', null, h('tr', null, ['Vorgangsart', 'Berechnungsart', 'Faktor / Satz', 'Einheit'].map(function (t) { return h('th', null, t); }))), tb)));
      });
      el.appendChild(h('div.karte', null, h('div.leiste', null, h('h3', null, 'Provisionsregeln'), h('span.frei'),
        D.btn('Beispielwerte wiederherstellen', function () { D.frage('Regeln zurücksetzen?', 'Alle Faktoren werden auf die Beispiel-Startwerte gesetzt (5,5 / 4,5 / 3 / 2,8 / 1,5 Monatsbeiträge).', 'Zurücksetzen').then(function (ja) { if (ja) { p.regeln = AB.provision.standardRegeln(); App.geaendert(); } }); }, { klasse: 'klein-btn leise' })),
        h('div.unter', null, 'Bereich × Vorgangsart → Faktor und Berechnungsart. Die Startwerte sind Beispiele – bitte an Ihre Karrierestufe anpassen. Pflegepflicht erfassen Sie als eigene Position mit Bereich „Pflege". Die Bank-Teilung wird je Antrag abgezogen.'), regelBox));

      // Tarifliste
      var tSuche = h('input', { type: 'search', placeholder: 'Tarif suchen …', value: z.tsuche || '', oninput: function () { z.tsuche = tSuche.value; zeichneTarife(); } }), tListe = h('div.leiste', { style: { maxHeight: '170px', overflow: 'auto', alignItems: 'flex-start' } });
      var tNeu = h('input', { type: 'text', placeholder: 'Neuer Tarif', style: { width: '170px' }, onkeydown: function (ev) { if (ev.key === 'Enter') hinzu(); } });
      function hinzu() { if (tNeu.value.trim() && M.erweitereTarife(p, [{ name: tNeu.value.trim() }], 'manuell')) { tNeu.value = ''; App.geaendert({ still: true }); zeichneTarife(); } tNeu.focus(); }
      function zeichneTarife() {
        var q = U.falte(z.tsuche || ''); D.leere(tListe);
        var treffer = p.tarife.filter(function (t) { return !q || U.falte(t.name + ' ' + t.gruppe).indexOf(q) >= 0; });
        treffer.slice(0, 300).forEach(function (t) {
          tListe.appendChild(h('span.chip', { title: (t.gruppe || 'ohne Tarifgruppe') + ' · ' + (t.quelle === 'abrechnung' ? 'aus Abrechnung' : 'manuell'), style: { cursor: 'default' } }, t.name,
            h('button', { type: 'button', style: { all: 'unset', cursor: 'pointer', color: 'var(--text-3)' }, title: 'Entfernen', onclick: function () { p.tarife = p.tarife.filter(function (x) { return x !== t; }); App.geaendert({ still: true }); zeichneTarife(); } }, '×')));
        });
        if (treffer.length > 300) tListe.appendChild(h('span.mini', null, '… und ' + (treffer.length - 300) + ' weitere'));
        if (!treffer.length) tListe.appendChild(h('span.muted.klein', null, 'Keine Tarife. Die Liste füllt sich automatisch aus importierten Abrechnungen und erfassten Anträgen.'));
      }
      zeichneTarife();
      el.appendChild(h('div.karte', null, h('div.leiste', null, h('h3', null, 'Tarifliste (' + p.tarife.length + ')'), h('span.frei'), h('div.suche', { style: { maxWidth: '240px' } }, D.icon('suche'), tSuche), tNeu, D.btn('Hinzufügen', hinzu, { klasse: 'klein-btn', icon: 'plus' })),
        h('div.unter', null, 'Vorschläge für das Feld „Tarif" in der Antragsmaske. Freitext bleibt immer möglich.'), tListe));

      // Ordner + Datei + Sicherungen
      var ordnerText = h('span.muted.klein', null, '…'), ordnerBtns = h('div.leiste');
      Sp.ordnerStatus(p).then(function (st) {
        D.leere(ordnerBtns);
        if (!Sp.ordnerMoeglich) { ordnerText.textContent = 'Dieser Browser unterstützt keine Ordner-Überwachung (Edge oder Chrome verwenden). Dateien können Sie jederzeit ins Fenster ziehen.'; return; }
        ordnerText.textContent = st === 'kein' ? 'Kein Ordner verbunden. Wählen Sie den Ordner, in dem Sie Abrechnungen und Monatsscheiben ablegen – neue Dateien werden beim Öffnen und bei jedem Wechsel ins Fenster automatisch eingelesen.'
          : st === 'verbunden' ? 'Verbunden mit „' + Sp.ordner.name + '". Neue CSV-/Excel-Dateien werden automatisch erkannt und eingelesen.' : 'Ordner „' + Sp.ordner.name + '" ist gemerkt – der Browser verlangt nach jedem Neustart eine kurze Bestätigung.';
        D.anhaengen(ordnerBtns, [
          D.btn(st === 'kein' ? 'Ordner verbinden' : 'Anderen Ordner wählen', function () { Sp.verbindeOrdner(p).then(function (n) { D.toast('Ordner „' + n + '" verbunden.'); return App.pruefeOrdner(true); }).then(function () { App.zeige('einstellungen'); }).catch(function (err) { if (err.name !== 'AbortError') D.toast(err.message, { krit: true }); }); }, { icon: 'ordner', klasse: st === 'kein' ? 'haupt-btn' : '' }),
          st !== 'kein' ? D.btn(st === 'erlaubnis' ? 'Zugriff bestätigen und prüfen' : 'Jetzt prüfen', function () { App.pruefeOrdner(true).then(function () { App.zeige('einstellungen'); }); }, { klasse: st === 'erlaubnis' ? 'haupt-btn' : '' }) : null,
          st !== 'kein' ? D.btn('Trennen', function () { Sp.trenneOrdner(p).then(function () { App.zeige('einstellungen'); }); }, { klasse: 'leise' }) : null]);
      });
      var sb = h('tbody');
      p.sicherungen.slice().reverse().forEach(function (s) {
        sb.appendChild(h('tr', null, h('td', null, new Date(s.am).toLocaleString('de-DE')), h('td', null, s.anlass), h('td.num', null, s.antraege + ' Anträge'),
          h('td', { style: { textAlign: 'right' } }, D.btn('Wiederherstellen', function () { D.frage('Sicherungsstand wiederherstellen?', 'Anträge, Zuordnungen und Einstellungen werden auf den Stand vom ' + new Date(s.am).toLocaleString('de-DE') + ' zurückgesetzt. Der jetzige Stand wird vorher gesichert.', 'Wiederherstellen').then(function (ja) { if (ja) { M.stelleWiederHer(p, s.id); App.geaendert(); D.toast('Sicherungsstand wiederhergestellt.'); } }); }, { klasse: 'klein-btn' }))));
      });
      el.appendChild(h('div.raster.r-2', null,
        h('div.karte', null, h('h3', null, 'Import-Ordner'), h('div', { style: { margin: '6px 0 10px' } }, ordnerText), ordnerBtns),
        h('div.karte', null, h('h3', null, 'Projektdatei'), h('div.muted.klein', { style: { margin: '6px 0 10px' } }, Sp.handle ? 'Automatisches Speichern in „' + Sp.dateiname + '". Zusätzlich liegt ein Spiegel im Browser.' : 'Das Projekt ist nur im Browser gesichert. Verbinden Sie es mit einer Datei oder laden Sie regelmäßig eine Kopie herunter.'),
          h('div.leiste', null, !Sp.handle && Sp.fsa ? D.btn('In Datei speichern …', function () { Sp.neuDatei(p).then(function (ok) { if (ok) { Sp.uebernimm(p, Sp.handle, Sp.dateiname); Sp.plane(p); App.zeige('einstellungen'); } }).catch(function (err) { if (err.name !== 'AbortError') D.toast(err.message, { krit: true }); }); }, { klasse: 'haupt-btn' }) : null,
            D.btn('Kopie herunterladen', function () { Sp.ladeHerunter(p); }, { icon: 'runter' }), D.btn('Projekt schließen', function () { Sp.jetzt().then(App.schliesse); }, { klasse: 'leise' })))));
      el.appendChild(h('div.karte', null, h('h3', null, 'Sicherungsstände'), h('div.unter', null, 'Vor jedem Import wird automatisch ein Stand angelegt; die letzten 10 bleiben im Projekt. Gesichert werden Anträge, Zuordnungen und Einstellungen (die Abrechnung lässt sich jederzeit neu einlesen).'),
        p.sicherungen.length ? h('table.einfach', null, sb) : h('div.muted.klein', null, 'Noch keine Sicherungsstände.')));
    } };
})(globalThis.AB = globalThis.AB || {});
