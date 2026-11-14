/* Antragsbuch – Kundensuche und Kundenakte: alles zu einem Vertrag aus Anträgen UND Abrechnung (F3 Nummer, F4 Name). */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h, U = AB.util, M = AB.model;
  var cache = { ref: null, liste: null };

  /** Alle Verträge aus Abrechnung und Anträgen, je Vertragsnummer zusammengeführt. */
  function vertraege() {
    var App = AB.app, p = App.p;
    if (cache.ref === App.zeilen && cache.n === p.antraege.length && cache.g === p.geaendert) return cache.liste;
    var map = new Map();
    function merke(k, name, vorn) {
      if (!name) return;
      var f = U.namensTeile(name).sort().join(' ');
      if (k.nk[f]) return;
      k.nk[f] = 1; if (vorn) k.namen.unshift(name); else k.namen.push(name);
    }
    function hol(vn, vnr) { var k = map.get(vn); if (!k) { k = { vn: vn, vnr: vnr, namen: [], nk: {}, zeilen: [], antraege: [], mbd: 0, prov: 0, tg: {} }; map.set(vn, k); } return k; }
    App.zeilen.forEach(function (z) {
      var k = hol(U.normVnr(z.vnr), z.vnr);
      k.zeilen.push(z); k.mbd += z.mbd; k.prov += z.prov; k.tg[z.tg] = 1;
      merke(k, z.vnName, false); if (k.namen.length < 6) merke(k, z.vpName, false);
    });
    p.antraege.forEach(function (a) {
      var vn = U.normVnr(a.vertragsnummer), k = hol(vn || 'antrag:' + a.id, a.vertragsnummer);
      k.antraege.push(a); merke(k, M.vnName(a), true);
    });
    var liste = Array.from(map.values());
    liste.forEach(function (k) { k.nameSuch = U.falte(k.namen.join(' ')); k.such = U.falte(k.namen.join(' ') + ' ' + k.vnr + ' ' + k.vn + ' ' + k.zeilen.slice(0, 40).map(function (z) { return z.plz + ' ' + z.ort + ' ' + z.gvnr; }).join(' ')); });
    cache = { ref: App.zeilen, n: p.antraege.length, g: p.geaendert, liste: liste };
    return liste;
  }

  AB.kundensuche = function (modus, start) {
    var App = AB.app, p = App.p, aktiv = null, timer;
    var dlg = D.dialog('Kundensuche', {});
    var q = h('input', { type: 'search', value: start || '', placeholder: modus === 'nummer' ? 'Vertrags- / Mitgliedsnummer …' : 'Name, Ort, PLZ oder Nummer …', oninput: function () { clearTimeout(timer); timer = setTimeout(suche, 120); }, onkeydown: function (ev) { if (ev.key === 'Escape') { ev.preventDefault(); dlg.zu(); } } });
    var treffer = h('div.treffer'), detail = h('div.detail'), info = h('div.mini');
    D.anhaengen(dlg.rumpf, [h('div.leiste', null, h('div.suche', { style: { maxWidth: 'none' } }, D.icon('suche'), q), h('span.mini', null, 'F3 Nummer · F4 Name')), info, h('div.akte', null, treffer, detail)]);
    function suche() {
      var w = U.falte(q.value).split(/\s+/).filter(Boolean), nr = U.normVnr(q.value);
      D.leere(treffer);
      if (!w.length) { info.textContent = vertraege().length + ' Verträge aus Abrechnung und Anträgen durchsuchbar.'; D.leere(detail); return; }
      var gef = vertraege().filter(function (k) { return (modus === 'nummer' && nr) ? k.vn.indexOf(nr) === 0 : w.every(function (x) { return k.such.indexOf(x) >= 0; }); });
      var imNamen = function (k) { return w.every(function (x) { return k.nameSuch.indexOf(x) >= 0; }) ? 1 : 0; };
      gef.sort(function (a, b) { return imNamen(b) - imNamen(a) || (b.antraege.length ? 1 : 0) - (a.antraege.length ? 1 : 0) || b.zeilen.length - a.zeilen.length; });
      info.textContent = gef.length + ' Treffer' + (gef.length > 40 ? ' – die ersten 40 werden angezeigt' : '');
      gef.slice(0, 40).forEach(function (k, i) {
        var b = h('button', { type: 'button', onclick: function () { zeige(k, b); } }, h('b', null, k.namen[0] || 'Vertrag ' + k.vnr),
          h('small', null, (k.vnr || 'ohne Vertragsnummer') + ' · ' + k.zeilen.length + ' Buchungen · ' + k.antraege.length + (k.antraege.length === 1 ? ' Antrag' : ' Anträge')));
        treffer.appendChild(b);
        if (i === 0) zeige(k, b);
      });
      if (!gef.length) D.leere(detail).appendChild(h('p.muted', null, 'Nichts gefunden.'));
    }
    function zeige(k, knopf) {
      if (aktiv) aktiv.classList.remove('aktiv'); aktiv = knopf; knopf.classList.add('aktiv');
      D.leere(detail);
      var erlaubt = {}; p.einstellungen.provisionsarten.forEach(function (x) { erlaubt[x] = 1; });
      var eigene = k.zeilen.filter(function (z) { return erlaubt[z.part]; }), sB = 0, sP = 0;
      eigene.forEach(function (z) { sB += z.mbd; sP += z.prov; });
      var bestand = {}; k.zeilen.forEach(function (z) { var key = z.pnr + '|' + z.tarif; if (!bestand[key] || bestand[key].bdat <= z.bdat) bestand[key] = z; });
      var akt = Object.keys(bestand).map(function (x) { return bestand[x]; }).filter(function (z) { return z.mb > 0.005; });
      detail.appendChild(h('div.leiste', null, h('h3', null, k.namen[0] || 'Vertrag ' + k.vnr), h('span.marke-s', null, k.vnr || 'ohne Nummer'),
        Object.keys(k.tg).map(function (g) { return h('span.marke-s', null, M.bereich[M.bereichAusGruppe(g)].kurz); }), h('span.frei'),
        D.btn('Neuer Antrag zu diesem Kunden', function () {
          var t = String(k.namen[0] || '').split(','), start = { vertragsnummer: k.vnr || '', vn: { name: (t[0] || '').trim(), vorname: (t[1] || '').trim() }, vorgang: k.zeilen.length ? 'mehr' : 'neu' };
          if (k.zeilen.length) start.bereich = M.bereichAusGruppe(k.zeilen[0].tg);
          dlg.zu(); AB.maske.oeffne(null, { start: start });
        }, { klasse: 'klein-btn haupt-btn', icon: 'plus' })));
      if (k.namen.length > 1) detail.appendChild(h('div.mini', null, 'Personen: ' + k.namen.join(' · ')));
      // Anträge
      detail.appendChild(h('h3', { style: { marginTop: '14px' } }, 'Anträge (' + k.antraege.length + ')'));
      if (!k.antraege.length) detail.appendChild(h('div.muted.klein', null, 'Kein Antrag erfasst.'));
      k.antraege.forEach(function (a) {
        var am = AB.ampelVon(a);
        detail.appendChild(h('button.wartezeile', { type: 'button', style: { width: '100%', boxSizing: 'border-box' }, onclick: function () { dlg.zu(); AB.maske.oeffne(a); } }, AB.ampelPunkt(am) || h('span'),
          h('span', null, U.fmtDatum(a.eingang) + ' · ' + M.bereich[a.bereich].kurz + ' · ' + M.name('vorgang', a.vorgang) + ' · ' + M.tarife(a), h('small', null, am.grund || (a.nachbearbeitung.status === 'offen' ? 'Nachbearbeitung offen' : a.bemerkung || ''))),
          AB.geld(M.beitrag(a)), AB.statusMarke(a)));
      });
      // Aktueller Stand laut Abrechnung
      if (akt.length) {
        detail.appendChild(h('h3', { style: { marginTop: '14px' } }, 'Tarife laut letzter Buchung'));
        detail.appendChild(h('div.leiste', null, akt.map(function (z) { return h('span.chip', { style: { cursor: 'default' }, title: z.tg + ' · Person ' + z.pnr }, z.tarif, h('b', null, U.fmtEuro(z.mb))); })));
      }
      // Buchungen
      detail.appendChild(h('div.leiste', { style: { marginTop: '14px' } }, h('h3', null, 'Buchungen (' + eigene.length + (eigene.length !== k.zeilen.length ? ' von ' + k.zeilen.length : '') + ')'),
        h('span.muted.klein', null, 'Summe ' + U.fmtEuro(sB) + ' Beitrag · ' + U.fmtEuro(sP) + ' Provision')));
      if (eigene.length) {
        var tb = h('tbody');
        eigene.slice().sort(function (x, y) { return x.bdat < y.bdat ? 1 : -1; }).slice(0, 200).forEach(function (z) {
          tb.appendChild(h('tr', null, h('td', null, U.fmtDatum(z.bdat)), h('td', null, z.pnr), h('td', null, z.tarif), h('td.num', { style: { textAlign: 'right' } }, U.fmtEuro(z.mbd)),
            h('td.num', { style: { textAlign: 'right' } }, U.fmtEuro(z.prov)), h('td', null, z.part + (z.st ? ' · X' : '')), h('td.klein', null, z.stgrund || (z.shEnde ? 'Haftung bis ' + U.fmtDatum(z.shEnde) : ''))));
        });
        detail.appendChild(h('table.einfach', null, h('thead', null, h('tr', null, ['Buchung', 'Pers.', 'Tarif', 'Beitragsdiff.', 'Provision', 'Art', 'Hinweis'].map(function (t) { return h('th', null, t); }))), tb));
      } else detail.appendChild(h('div.muted.klein', null, k.zeilen.length ? 'Nur Buchungen in ausgeblendeten Provisionsarten.' : 'Keine Buchungen in der Abrechnung.'));
    }
    D.anhaengen(dlg.fuss, [h('span.mini', null, 'Durchsucht Anträge und die eingelesene Abrechnung – auch Kunden, zu denen kein Antrag erfasst wurde.'), h('span', { style: { flex: 1 } }), D.btn('Schließen', dlg.zu, { taste: 'Esc' })]);
    suche(); q.focus();
  };
})(globalThis.AB = globalThis.AB || {});
