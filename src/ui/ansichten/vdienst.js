/* Antragsbuch – Veränderungsdienst: generischer CSV/XLSX-Import mit Spaltenzuordnung. */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h, U = AB.util, M = AB.model, V = AB.vdienst, App = AB.app;

  AB.ansichten.vdienst = { titel: 'Veränderungsdienst', icon: 'vdienst', unter: 'Setzt den Status „Policiert" und ergänzt Vertragsnummern',
    oeffne: function (r, name) { App.zustand.vdienst = { daten: r, name: name, blatt: 0 }; App.zeige('vdienst'); },
    zeige: function (el, aktionen, z) {
      var p = App.p;
      var wahl = h('input', { type: 'file', hidden: true, accept: '.csv,.txt,.xlsx,.xlsm', onchange: function () { App.importiere(Array.from(wahl.files)); wahl.value = ''; } });
      if (!z.daten) {
        el.appendChild(h('div.ablage.gross.rein', null, wahl, D.icon('hoch'), h('h2', null, 'Veränderungsdienst hier ablegen'),
          h('p.muted', { style: { maxWidth: '600px', margin: 0 } }, 'CSV- oder Excel-Datei (.xlsx) mit Vertragsnummer, Name, Datum, Vorgang und Beitrag. Beim ersten Mal ordnen Sie die Spalten zu – die Zuordnung wird für das nächste Mal gemerkt.'),
          D.btn('Datei auswählen', function () { wahl.click(); }, { klasse: 'haupt-btn' })));
        if (p.vdienst.importe.length) {
          var tb = h('tbody');
          p.vdienst.importe.slice().reverse().forEach(function (i) { tb.appendChild(h('tr', null, h('td', null, new Date(i.datum).toLocaleString('de-DE')), h('td', null, i.datei), h('td.num', null, i.zeilen), h('td.num', null, i.uebernommen))); });
          el.appendChild(h('div.karte', null, h('h3', null, 'Bisherige Importe'), h('table.einfach', null, h('thead', null, h('tr', null, ['Datum', 'Datei', 'Zeilen', 'Übernommen'].map(function (t) { return h('th', null, t); }))), tb)));
        }
        return;
      }
      var blatt = z.daten.blaetter[z.blatt] || z.daten.blaetter[0], zl = blatt.zeilen;
      var kIdx = V.kopfzeile(zl), kopf = (zl[kIdx] || []).map(function (c) { return c == null ? '' : String(c); }), sig = V.signatur(kopf);
      if (!z.map || z.sig !== sig) { z.map = Object.assign({}, p.vdienst.zuordnungen[sig] || V.rate(kopf)); z.sig = sig; z.gemerkt = !!p.vdienst.zuordnungen[sig]; z.ab = null; }
      var spalten = [['', '– nicht vorhanden –']].concat(kopf.map(function (k, i) { return [String(i), (k || 'Spalte ' + (i + 1))]; }));
      var raster = h('div.formraster');
      V.FELDER.forEach(function (f) {
        raster.appendChild(D.feld(f.name, D.auswahl(spalten, z.map[f.id] == null ? '' : String(z.map[f.id]), function (v) { if (v === '') delete z.map[f.id]; else z.map[f.id] = +v; z.ab = null; App.zeige('vdienst'); }), 's3'));
      });
      var vorschau = h('table.einfach'), vk = h('tr');
      kopf.forEach(function (k) { vk.appendChild(h('th', null, k)); });
      vorschau.appendChild(h('thead', null, vk));
      var vb = h('tbody'); zl.slice(kIdx + 1, kIdx + 4).forEach(function (r) { var tr = h('tr'); kopf.forEach(function (_, i) { tr.appendChild(h('td', null, r[i] == null ? '' : String(r[i]))); }); vb.appendChild(tr); });
      vorschau.appendChild(vb);
      el.appendChild(h('div.karte.rein', null, h('div.leiste', null, h('h3', null, '1 · Spalten zuordnen'), h('span.muted.klein', null, '„' + z.name + '"' + (z.gemerkt ? ' · gemerkte Zuordnung verwendet' : ' · Vorschlag – bitte prüfen')), h('span.frei'),
        z.daten.blaetter.length > 1 ? D.auswahl(z.daten.blaetter.map(function (b, i) { return [String(i), 'Blatt: ' + b.name]; }), String(z.blatt), function (v) { z.blatt = +v; z.map = null; App.zeige('vdienst'); }, { style: { width: '220px' } }) : null,
        D.btn('Andere Datei', function () { App.zustand.vdienst = {}; App.zeige('vdienst'); }, { klasse: 'leise' })),
        h('div', { style: { marginTop: '10px' } }, raster), h('details', { style: { marginTop: '8px' } }, h('summary.klein', null, 'Vorschau der ersten Zeilen'), h('div', { style: { overflowX: 'auto' } }, vorschau))));
      if (z.map.vnr == null && z.map.name == null) { el.appendChild(h('div.meldung.warn', null, 'Bitte mindestens die Spalte „Vertragsnummer" oder „Name" zuordnen.')); return; }
      var saetze = V.lies(zl, kIdx, z.map), erg = V.ordneZu(saetze, p.antraege, p.einstellungen.toleranzBeitrag);
      if (!z.ab) { z.ab = new Set(); erg.treffer.forEach(function (t, i) { if (t.sicher) z.ab.add(i); }); }
      var tb2 = h('tbody'), btn = D.btn('', uebernimm, { klasse: 'haupt-btn', icon: 'haken' });
      function beschrifte() { btn.lastChild.textContent = z.ab.size + ' Treffer übernehmen'; btn.disabled = !z.ab.size; }
      btn.appendChild(document.createTextNode('')); beschrifte();
      erg.treffer.forEach(function (t, i) {
        tb2.appendChild(h('tr', null, h('td', null, h('input', { type: 'checkbox', checked: z.ab.has(i), onchange: function () { if (this.checked) z.ab.add(i); else z.ab.delete(i); beschrifte(); } })),
          h('td', null, h('b', null, M.vnName(t.antrag)), h('div.mini', null, U.fmtDatum(t.antrag.eingang) + ' · ' + M.tarife(t.antrag) + ' · ' + U.fmtEuro(M.beitrag(t.antrag)))),
          h('td', null, t.satz.name || '–', h('div.mini', null, 'Zeile ' + t.satz.zeile + (t.satz.vorgang ? ' · ' + t.satz.vorgang : ''))), h('td', null, t.satz.vnr || '–'),
          h('td.num', null, t.satz.beitrag == null ? '–' : U.fmtEuro(t.satz.beitrag)), h('td', null, U.fmtDatum(t.satz.datum) || '–'),
          h('td', null, h('span.marke-s' + (t.sicher ? '.gut' : '.warn'), null, t.art === 'vnr' ? 'Vertragsnummer' : 'Name ' + t.punkte + ' %')), h('td.klein', null, t.aktion)));
      });
      function uebernimm() {
        M.sichere(p, 'Vor Veränderungsdienst „' + z.name + '"');
        var n = V.uebernimm(erg.treffer.filter(function (_, i) { return z.ab.has(i); }));
        p.vdienst.zuordnungen[sig] = z.map;
        p.vdienst.importe.push({ datum: new Date().toISOString(), datei: z.name, zeilen: saetze.length, uebernommen: n });
        App.zustand.vdienst = {}; App.geaendert();
        D.toast(n + (n === 1 ? ' Antrag' : ' Anträge') + ' aktualisiert. Die Spaltenzuordnung ist gemerkt.');
      }
      el.appendChild(h('div.karte.rein', null, h('div.leiste', null, h('h3', null, '2 · Treffer prüfen'), h('span.muted.klein', null, saetze.length + ' Zeilen gelesen · ' + erg.treffer.length + ' Treffer · ' + erg.ohne.length + ' ohne passenden Antrag'), h('span.frei'), btn),
        erg.treffer.length ? h('div', { style: { overflowX: 'auto', marginTop: '8px' } }, h('table.einfach', null, h('thead', null, h('tr', null, ['', 'Antrag', 'Zeile im Veränderungsdienst', 'Vertragsnr.', 'Beitrag', 'Datum', 'Treffer über', 'Aktion'].map(function (t) { return h('th', null, t); }))), tb2))
          : h('p.muted', null, 'Kein eingereichter Antrag passt zu den Zeilen dieser Datei.'),
        h('p.mini', null, 'Treffer über die Vertragsnummer sind vorausgewählt. Treffer über den Namen bitte prüfen – erst mit Haken werden sie übernommen.')));
    } };
})(globalThis.AB = globalThis.AB || {});
