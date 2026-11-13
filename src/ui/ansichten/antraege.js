/* Antragsbuch – Antragsliste mit Sofortsuche, Filtern, Sortierung, Export und Druck. */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h, U = AB.util, M = AB.model, App = AB.app;
  var suchCache = new WeakMap();
  function text(a) { var c = suchCache.get(a); if (!c || c.g !== a.geaendert) { c = { g: a.geaendert, t: M.suchtext(a) }; suchCache.set(a, c); } return c.t; }
  AB.statusMarke = function (a) { return h('span.status.' + a.status, null, M.name('status', a.status)); };
  AB.geld = function (v, farbig) { return h('span.num' + (farbig && v < -0.004 ? '.minus' : farbig && v > 0.004 ? '.plus' : ''), null, U.fmtEuro(v)); };

  AB.ansichten.antraege = { titel: 'Anträge', icon: 'antraege', fest: true,
    unter: function () { return App.p.antraege.length + ' Anträge im Projekt'; },
    zeige: function (el, aktionen, z) {
      var p = App.p, erg = App.erg, ohneNr = {};
      erg.ohneNr.forEach(function (r) { ohneNr[r.antrag.id] = 1; });
      aktionen.appendChild(D.btn('Neuer Antrag', function () { AB.maske.oeffne(null); }, { klasse: 'haupt-btn', icon: 'plus', taste: 'N' }));
      var suche = h('input', { type: 'search', placeholder: 'Suchen: Name, Vertragsnummer, Tarif, Betrag …', value: z.suche || '', oninput: function () { z.suche = suche.value; filtere(); } });
      var monate = [['', 'Alle Monate']].concat(U.MONATE.map(function (m, i) { return [String(i), m]; }));
      var stat = [['', 'Alle Status'], ['offen', 'Offen (unterwegs)']].concat(M.STATUS.map(function (s) { return [s.id, s.name]; }));
      var fM = D.auswahl(monate, z.monat || '', function (v) { z.monat = v; filtere(); }, { style: { width: '150px' } });
      var fB = D.auswahl([['', 'Alle Bereiche']].concat(M.BEREICHE.map(function (b) { return [b.id, b.name]; })), z.bereich || '', function (v) { z.bereich = v; filtere(); }, { style: { width: '180px' } });
      var fS = D.auswahl(stat, z.status || '', function (v) { z.status = v; filtere(); }, { style: { width: '170px' } });
      var chip = h('button.chip' + (z.spezial === 'ohneNr' ? '.aktiv' : ''), { type: 'button', onclick: function () { z.spezial = z.spezial === 'ohneNr' ? '' : 'ohneNr'; chip.classList.toggle('aktiv'); filtere(); } },
        'Ohne Vertragsnummer', h('b', null, String(erg.ohneNr.length)));
      el.appendChild(h('div.leiste', null, h('div.suche', null, D.icon('suche'), suche), fM, fB, fS, erg.ohneNr.length ? chip : null, h('span.frei'),
        D.btn('CSV', function () { D.lade('Antraege_' + p.jahr + '.csv', AB.kennzahlen.exportAntraege(p, erg, tab.zeilen())); }, { icon: 'runter', titel: 'Angezeigte Anträge als CSV für Excel' }),
        D.btn('Drucken', drucke, { icon: 'druck' })));
      var box = h('div', { style: { flex: 1, minHeight: 0, display: 'flex' } });
      el.appendChild(box);
      var R = function (a) { return erg.proAntrag[a.id] || {}; };
      var tab = AB.tabelle(box, { hoehe: 50, sort: z.sort || { i: 0, ab: true }, leer: 'Keine Anträge gefunden. Mit „Neuer Antrag" (Taste N) legen Sie einen an.',
        klick: function (a) { AB.maske.oeffne(a); },
        spalten: [
          { t: 'Eingang', b: '92px', w: function (a) { return U.fmtDatum(a.eingang); }, s: function (a) { return a.eingang; }, absteigend: true },
          { t: 'Versicherungsnehmer', b: 'minmax(150px, 1.5fr)', k: 'zwei', w: function (a) { return [h('span', { style: { fontWeight: 600 } }, M.vnName(a)), h('small', null, a.bemerkung || (a.firma || ''))]; }, s: function (a) { return M.vnName(a); } },
          { t: 'Bereich · Vorgang', b: 'minmax(120px, 1fr)', k: 'zwei', w: function (a) { return [h('span', null, M.bereich[a.bereich] ? M.bereich[a.bereich].kurz : a.bereich), h('small', null, M.name('vorgang', a.vorgang))]; }, s: function (a) { return a.bereich + a.vorgang; } },
          { t: 'Tarif(e)', b: 'minmax(90px, 1fr)', w: function (a) { return M.tarife(a); }, s: function (a) { return M.tarife(a); } },
          { t: 'Beitrag', b: '104px', r: true, w: function (a) { return AB.geld(M.beitrag(a), true); }, s: function (a) { return M.beitrag(a); } },
          { t: 'Vertragsnr.', b: '112px', w: function (a) { return a.vertragsnummer || (ohneNr[a.id] ? h('span.marke-s.warn', { title: 'Vertragsnummer nachtragen' }, 'fehlt') : h('span.mini', null, '–')); }, s: function (a) { return a.vertragsnummer; } },
          { t: 'Status', b: '128px', w: function (a) { return AB.statusMarke(a); }, s: function (a) { return a.status; } },
          { t: 'Prov. Soll', b: '104px', r: true, w: function (a) { var r = R(a); return r.soll ? [r.soll.ueberschrieben ? h('span.marke-s.warn', { title: 'manuell überschrieben' }, 'm') : null, U.fmtEuro(r.sollP)] : ''; }, s: function (a) { return R(a).sollP; } },
          { t: 'Prov. Ist', b: '104px', r: true, w: function (a) { var r = R(a); return r.buendel && r.buendel.length ? U.fmtEuro(r.istP) : h('span.mini', null, '–'); }, s: function (a) { var r = R(a); return r.buendel && r.buendel.length ? r.istP : null; } }
        ],
        fuss: function (zl) {
          var b = 0, s = 0, i = 0;
          zl.forEach(function (a) { var r = R(a); b += M.beitrag(a); s += r.sollP || 0; i += (r.buendel && r.buendel.length ? r.istP : 0); });
          return [zl.length + ' Antr.', '', '', '', U.fmtEuro(b), '', '', U.fmtEuro(s), U.fmtEuro(i)];
        } });
      function filtere() {
        var q = U.falte(z.suche || '').split(/\s+/).filter(Boolean);
        tab.setze(p.antraege.filter(function (a) {
          if (z.monat !== '' && z.monat != null && (!a.eingang || +a.eingang.slice(5, 7) - 1 !== +z.monat || +a.eingang.slice(0, 4) !== +p.jahr)) return false;
          if (z.bereich && a.bereich !== z.bereich) return false;
          if (z.status === 'offen' ? !M.istOffen(a) : z.status && a.status !== z.status) return false;
          if (z.spezial === 'ohneNr' && !ohneNr[a.id]) return false;
          if (q.length) { var t = text(a); for (var i = 0; i < q.length; i++) if (t.indexOf(q[i]) < 0) return false; }
          return true;
        }));
      }
      function drucke() {
        var zl = tab.zeilen(), b = 0, s = 0;
        var titel = 'Anträge ' + (z.monat ? U.MONATE[+z.monat] + ' ' : '') + p.jahr;
        D.drucke(titel, AB.ansichten.uebersicht.unter() + ' · ' + zl.length + ' Anträge · Stand ' + U.fmtDatum(U.heute()),
          [{ t: 'Eingang' }, { t: 'Versicherungsnehmer' }, { t: 'Bereich' }, { t: 'Vorgang' }, { t: 'Tarif(e)' }, { t: 'Beitrag', r: 1 }, { t: 'Vertragsnr.' }, { t: 'Status' }, { t: 'Prov. Soll', r: 1 }, { t: 'Prov. Ist', r: 1 }],
          zl.map(function (a) { var r = R(a); b += M.beitrag(a); s += r.sollP || 0;
            return [U.fmtDatum(a.eingang), M.vnName(a), M.bereich[a.bereich].kurz, M.name('vorgang', a.vorgang), M.tarife(a), U.fmtEuro(M.beitrag(a)), a.vertragsnummer, M.name('status', a.status), U.fmtEuro(r.sollP), r.buendel && r.buendel.length ? U.fmtEuro(r.istP) : '']; }),
          ['Summe', '', '', '', '', U.fmtEuro(b), '', '', U.fmtEuro(s), '']);
      }
      filtere();
      if (z.suche) suche.focus();
    } };
})(globalThis.AB = globalThis.AB || {});
