/* Antragsbuch – Übersicht / Dashboard. */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h, U = AB.util, M = AB.model, G = AB.dia, App = AB.app;

  function kachel(lbl, wert, format, neben, opt) {
    opt = opt || {};
    var w = h('span.num'), k = h('div.karte.kachel.rein' + (opt.akzent ? '.akzent' : ''), { style: { animationDelay: (opt.i || 0) * 45 + 'ms' } },
      h('div.lbl', null, opt.punkt ? h('span.punkt', { style: { background: opt.punkt } }) : null, lbl), h('div.wert', null, w, opt.einheit ? h('small', null, opt.einheit) : null),
      h('div.neben', { title: neben }, neben));
    D.zaehle(w, wert, format);
    if (opt.funke) k.appendChild(G.funke(opt.funke, opt.akzent ? '#fff' : 'var(--accent)'));
    if (opt.klick) { k.style.cursor = 'pointer'; k.addEventListener('click', opt.klick); }
    return k;
  }
  var ganz = function (v) { return U.fmtZahl(v, 0); }, euro0 = function (v) { return U.fmtZahl(v, 0); };

  AB.ansichten.uebersicht = { titel: 'Übersicht', icon: 'start',
    unter: function () { var e = App.p.einstellungen; return 'Jahr ' + App.p.jahr + (e.name ? ' · ' + e.name : '') + (e.vermittlernummer ? ' · Vermittler ' + e.vermittlernummer : ''); },
    zeige: function (el, aktionen, z) {
      var p = App.p, kz = App.kz, mon = z.monat == null ? null : z.monat, k = mon == null ? kz.jahr : kz.monate[mon];
      aktionen.appendChild(D.btn('Neuer Antrag', function () { AB.maske.oeffne(null); }, { klasse: 'haupt-btn', icon: 'plus', taste: 'N' }));
      if (!p.antraege.length && !App.zeilen.length) {
        el.appendChild(h('div.karte.rein', { style: { textAlign: 'center', padding: '50px 20px' } }, h('h2', null, 'Noch keine Anträge'),
          h('p.muted', null, 'Erfassen Sie den ersten Antrag oder ziehen Sie eine Provisionsabrechnung (CSV) ins Fenster.'),
          D.btn('Ersten Antrag erfassen', function () { AB.maske.oeffne(null); }, { klasse: 'haupt-btn', icon: 'plus' })));
        return;
      }
      // Zeitraum
      var wahl = [['j', 'Jahr']].concat(U.MONATE_KURZ.map(function (m, i) { return [String(i), m]; }));
      el.appendChild(h('div.leiste', null, D.seg(wahl, mon == null ? 'j' : String(mon), function (v) { z.monat = v === 'j' ? null : +v; App.zeige('uebersicht'); }),
        h('span.frei'), h('div.hinweise', null, kz.hinweise.map(function (hw) {
          return h('button.hinweis.' + hw.art, { type: 'button', onclick: function () { App.zeige(hw.ziel, hw.ziel === 'abgleich' ? { reiter: hw.filter } : { spezial: hw.filter }); } }, hw.text);
        }))));
      var titel = mon == null ? 'im Jahr ' + p.jahr : 'im ' + U.MONATE[mon];
      var verlauf = function (f) { var w = kz.monate.map(function (m) { return m[f]; }); while (w.length > 2 && !w[w.length - 1]) w.pop(); return w; };
      el.appendChild(h('div.raster.r-6', null,
        kachel('Anträge ' + titel, k.antraege, ganz, mon == null ? 'Ø ' + U.fmtZahl(kz.schnitt.antraege, 1) + ' je Monat' : 'Jahr: ' + kz.jahr.antraege, { akzent: true, i: 0, funke: mon == null ? verlauf('antraege') : null, klick: function () { App.zeige('antraege', { monat: mon == null ? '' : String(mon), status: '', spezial: '' }); } }),
        kachel('Beitrag brutto', k.brutto, euro0, 'netto ' + U.fmtEuro(k.netto) + (mon == null ? ' · Ø ' + U.fmtEuro0(kz.schnitt.brutto) : ''), { einheit: '€', i: 1 }),
        kachel('Offen', k.offenAnz, ganz, U.fmtEuro(k.offen) + ' Beitrag unterwegs', { punkt: 'var(--s6)', i: 2, klick: function () { App.zeige('antraege', { status: 'offen', monat: mon == null ? '' : String(mon), spezial: '' }); } }),
        kachel('Abgerechnet', k.abgerechnetAnz, ganz, U.fmtEuro(k.abgerechnet) + ' Beitrag', { punkt: 'var(--good)', i: 3 }),
        kachel('Storno', k.stornoAnz, ganz, U.fmtEuro(k.storno) + ' · Quote ' + U.fmtZahl(k.stornoQuote * 100, 1) + ' %', { punkt: 'var(--crit)', i: 4 }),
        kachel('Provision Ist', k.provIst, euro0, 'Soll ' + U.fmtEuro(k.provSoll), { einheit: '€', i: 5 })));

      // Diagramme
      var dBalken = h('div'), dRing = h('div'), dLinie = h('div'), dQuer = h('div');
      el.appendChild(h('div.raster.r-21', null,
        h('div.karte.rein', null, h('h3', null, 'Anträge je Monat'), h('div.unter', null, 'nach aktuellem Status · Klick auf einen Monat filtert die Übersicht'), dBalken),
        h('div.karte.rein', null, h('h3', null, 'Beitrag nach Bereich'), h('div.unter', null, titel + ', ohne abgelehnte Anträge'), dRing)));
      el.appendChild(h('div.raster.r-2', null,
        h('div.karte.rein', null, h('h3', null, 'Provision: Soll und Ist'), h('div.unter', null, 'aufgelaufen nach Eingangsmonat der Anträge'), dLinie),
        h('div.karte.rein', null, h('h3', null, 'Stückzahlen je Bereich'), h('div.unter', null, titel), dQuer)));
      requestAnimationFrame(function () {
        var ms = kz.monate;
        G.balken(dBalken, { titel: 'Anträge je Monat nach Status', kategorien: U.MONATE_KURZ, kategorienLang: U.MONATE, format: ganz, klick: function (i) { z.monat = z.monat === i ? null : i; App.zeige('uebersicht'); },
          reihen: [{ name: 'Abgerechnet', farbe: G.FARBEN[0], werte: ms.map(function (m) { return m.abgerechnetAnz; }) },
            { name: 'Offen', farbe: G.FARBEN[1], werte: ms.map(function (m) { return m.offenAnz; }) },
            { name: 'Storno', farbe: G.FARBEN[2], werte: ms.map(function (m) { return m.stornoAnz; }) },
            { name: 'Abgelehnt/Widerruf/Absage', farbe: G.FARBEN[3], werte: ms.map(function (m) { return m.abgewiesenAnz; }) }] });
        var bereiche = M.BEREICHE.map(function (b, i) { return { name: b.kurz, wert: k.bereiche[b.id].beitrag, stueck: k.bereiche[b.id].stueck, i: i }; });
        var top = bereiche.filter(function (b) { return b.wert > 0; }).sort(function (a, b) { return b.wert - a.wert; });
        G.ring(dRing, { titel: 'Beitrag nach Bereich', format: U.fmtEuro, mitte: { wert: U.fmtEuro0(k.brutto + k.minder), label: 'Beitrag' },
          teile: top.map(function (b, i) { return { name: b.name, wert: b.wert, farbe: i < 5 ? G.FARBEN[i] : G.GRAU }; }) });
        var sS = 0, sI = 0, letzter = -1;
        ms.forEach(function (m, i) { if (m.antraege) letzter = i; });
        G.linie(dLinie, { titel: 'Provision Soll und Ist, aufgelaufen', kategorien: U.MONATE_KURZ, kategorienLang: U.MONATE, format: U.fmtEuro,
          reihen: [{ name: 'Ist (abgerechnet)', farbe: G.FARBEN[0], flaeche: true, stark: true, werte: ms.map(function (m, i) { sI += m.provIst; return i <= letzter ? U.runde(sI) : null; }) },
            { name: 'Soll (erwartet)', farbe: G.FARBEN[1], werte: ms.map(function (m, i) { sS += m.provSoll; return i <= letzter ? U.runde(sS) : null; }) }] });
        G.quer(dQuer, { format: ganz, zeilen: bereiche.filter(function (b) { return b.stueck; }).sort(function (a, b) { return b.stueck - a.stueck; })
          .map(function (b) { return { name: b.name, wert: b.stueck, zusatz: U.fmtEuro(b.wert) + ' Beitrag' }; }) });
      });

      // Monatstabelle (zugleich Tabellenansicht der Diagramme)
      var kopf = ['Monat', 'Anträge', 'Brutto', 'Storno', 'Netto', 'Offen', 'Abgerechnet', 'Provision Soll', 'Provision Ist', 'Gebucht lt. Abrechnung'];
      var reihe = function (name, m) { return [name, m.antraege, m.brutto, m.storno, m.netto, m.offenAnz, m.abgerechnetAnz, m.provSoll, m.provIst, m.provBuchung]; };
      var zeilen = kz.monate.map(function (m, i) { return reihe(U.MONATE[i], m); }), summe = reihe('Jahr ' + p.jahr, kz.jahr);
      var fz = function (v, i) { return i === 0 ? v : (i === 1 || i === 5 || i === 6) ? U.fmtZahl(v, 0) : U.fmtEuro(v); };
      var tb = h('tbody');
      zeilen.concat([summe]).forEach(function (r, ri) {
        var tr = h('tr', ri === 12 ? { style: { fontWeight: 650 } } : (mon === ri ? { style: { background: 'var(--accent-soft)' } } : null));
        r.forEach(function (c, i) { tr.appendChild(h('td' + (i ? '.num' : ''), { style: i ? { textAlign: 'right' } : null }, fz(c, i))); });
        tb.appendChild(tr);
      });
      el.appendChild(h('div.karte.rein', null, h('div.leiste', null, h('h3', null, 'Monatsübersicht'), h('span.frei'),
        D.btn('CSV', function () { D.lade('Monatsuebersicht_' + p.jahr + '.csv', AB.csv.schreibe(kopf, zeilen.concat([summe]))); }, { klasse: 'klein-btn', icon: 'runter' }),
        D.btn('Drucken', function () { D.drucke('Monatsübersicht ' + p.jahr, AB.ansichten.uebersicht.unter() + ' · Stand ' + U.fmtDatum(U.heute()),
          kopf.map(function (t, i) { return { t: t, r: i > 0 }; }), zeilen.map(function (r) { return r.map(fz); }), summe.map(fz)); }, { klasse: 'klein-btn', icon: 'druck' })),
        h('div', { style: { overflowX: 'auto', marginTop: '8px' } }, h('table.einfach', null, h('thead', null, h('tr', null, kopf.map(function (t, i) { return h('th', { style: i ? { textAlign: 'right' } : null }, t); }))), tb))));
    } };
})(globalThis.AB = globalThis.AB || {});
