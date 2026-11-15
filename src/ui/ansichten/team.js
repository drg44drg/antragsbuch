/* Antragsbuch – Team: eigene Position (ADP) bzw. ADP-Vergleich für Führungskräfte (Management). */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h, U = AB.util, G = AB.dia, T = AB.team, App = AB.app;
  var euro0 = function (v) { return U.fmtZahl(v, 0); };

  function kachel(lbl, wert, format, neben, opt) {
    opt = opt || {};
    var w = h('span.num'), k = h('div.karte.kachel.rein' + (opt.akzent ? '.akzent' : ''), null, h('div.lbl', null, opt.punkt ? h('span.punkt', { style: { background: opt.punkt } }) : null, lbl),
      h('div.wert', null, w, opt.einheit ? h('small', null, opt.einheit) : null), h('div.neben', { title: neben }, neben));
    if (typeof wert === 'number') D.zaehle(w, wert, format); else w.textContent = wert;
    return k;
  }
  function ablage(text) {
    var wahl = h('input', { type: 'file', hidden: true, accept: '.xlsx,.xlsm,.csv,.json', onchange: function () { App.importiere(Array.from(wahl.files)); } });
    return h('div.ablage.gross.rein', null, wahl, D.icon('hoch'), h('h2', null, 'Teamdaten hier ablegen'), h('p.muted', { style: { maxWidth: '620px', margin: 0 } }, text), D.btn('Datei auswählen', function () { wahl.click(); }, { klasse: 'haupt-btn' }));
  }
  var KURZ = { 'Vollversicherung': 'Voll', 'Zusatzversicherung (Art Leben)': 'Zusatz (Leben)', 'Zusatzversicherung (Art Schaden)': 'Zusatz (Schaden)', 'Firmentarife': 'bKV/Firma',
    'Gruppentarife': 'Gruppe', 'Lebensversicherung (Standard)': 'Leben', 'Unfallversicherung': 'Unfall' };
  function kurzGruppe(g) { return KURZ[g] || g; }
  /** Teamzeile zu einer Vermittlernummer – auch wenn die Teamdaten pseudonymisiert sind. */
  function teamZeile(p, nr) {
    if (!p.team) return null;
    var ps = T.pseudo(nr);
    return p.team.zeilen.find(function (x) { return x.nr === nr || x.nr === ps; }) || null;
  }
  function nameVon(p, nr) {
    var z = teamZeile(p, nr);
    var alias = (p.einstellungen.adpNamen || {})[nr];
    return alias || (z && z.name) || (nr === p.einstellungen.vermittlernummer ? (p.einstellungen.name || 'Ich') : /^p/.test(nr) ? 'ADP (anonym)' : '');
  }

  // ---------- ADP: eigene Position ----------
  function zeigeAdp(el, p) {
    if (!p.team) { el.appendChild(ablage('Ihre Führungskraft kann Ihnen eine Teamdatei geben (oder die Monatsscheiben als Excel). Sie sehen dann, wo Sie im Team stehen – ohne Namen und Zahlen einzelner Kollegen.')); return; }
    var pos = T.position(p.team, p.einstellungen.vermittlernummer), lm = pos.letzterMonat;
    if (pos.ich && pos.ich.gesamt) el.appendChild(h('div.meldung.warn', null, 'Ihre Vermittlernummer ist die Summenzeile des Teams – für den ADP-Vergleich bitte oben auf „Management" umschalten.'));
    else if (!pos.ich) {
      var nrFeld = h('input', { type: 'text', inputMode: 'numeric', maxLength: 7, placeholder: 'z. B. 900402', value: p.einstellungen.vermittlernummer || '', style: { width: '130px' }, onkeydown: function (ev) { if (ev.key === 'Enter') setze(); } });
      var setze = function () {
        var v = nrFeld.value.replace(/\D/g, '');
        if (v.length !== 6) { nrFeld.classList.add('fehler'); D.toast('Die Vermittlernummer hat sechs Ziffern.', { krit: true }); return; }
        p.einstellungen.vermittlernummer = v; App.geaendert();
        if (!T.findeEigene(p.team, v)) D.toast('Die Nummer ' + v + ' kommt in den Teamdaten nicht vor.', { krit: true });
      };
      el.appendChild(h('div.meldung.warn.leiste', null, h('b', null, p.einstellungen.vermittlernummer ? 'Die Vermittlernummer ' + p.einstellungen.vermittlernummer + ' steht nicht in den Teamdaten.' : 'Wer sind Sie?'),
        h('span', null, 'Tragen Sie Ihre sechsstellige Vermittlernummer ein, dann sehen Sie Ihren Platz:'), nrFeld, D.btn('Übernehmen', setze, { klasse: 'klein-btn haupt-btn' })));
    }
    var y = pos.ytd || { n: 0, median: 0 }, m = lm >= 0 ? pos.monate[lm] : null, hat = y.wert != null;
    var einzeln = !!p.team.einzeln, fd = pos.gesamt ? pos.gesamt.werte.reduce(function (a, b) { return a + (b || 0); }, 0) : 0, fdM = pos.gesamt && lm >= 0 ? pos.gesamt.werte[lm] || 0 : 0;
    if (einzeln) el.appendChild(h('div.meldung', null, 'Diese Datei enthält nur Ihr eigenes Blatt und die Gesamtsumme der Filialdirektion. Ein Platz im Team und ein Median lassen sich daraus nicht bestimmen – dafür wird die Sammelmappe mit allen ADP-Blättern benötigt.'));
    el.appendChild(h('div.raster.r-4', null,
      einzeln ? kachel('Mein Anteil an der Filialdirektion', hat && fd ? U.fmtZahl(y.wert / fd * 100, 1) + ' %' : '–', null, 'aufgelaufen bis ' + (lm >= 0 ? U.MONATE[lm] : '–'), { akzent: true })
        : (function () {
            // Vordere Hälfte: Platz zeigen. Hintere Hälfte: zeigen, wie nah das Mittelfeld und der nächste Platz sind.
            var summen = p.team.zeilen.filter(function (zz) { return !zz.gesamt; }).map(function (zz) { var s = 0; for (var mm = 0; mm <= Math.max(lm, 0); mm++) s += zz.werte[mm] || 0; return s; }).sort(function (a, b) { return b - a; });
            var naechster = hat ? summen.filter(function (s) { return s > y.wert + 0.005; }).pop() : null, bisNaechster = naechster != null ? naechster - y.wert : 0;
            if (hat && y.rang > Math.ceil(y.n / 2)) return kachel('Bis zum Mittelfeld', Math.max(0, y.median - y.wert), euro0, (bisNaechster > 0 ? 'nächster Platz: noch ' + U.fmtEuro0(bisNaechster) + ' · ' : '') + 'heute Platz ' + y.rang + ' von ' + y.n, { akzent: true, einheit: '€' });
            return kachel('Mein Platz im Team', hat ? 'Platz ' + y.rang : '–', null, 'von ' + y.n + (bisNaechster > 0 ? ' · nächster Platz: noch ' + U.fmtEuro0(bisNaechster) : y.rang === 1 && hat ? ' · vorn' : '') + ' · bis ' + (lm >= 0 ? U.MONATE[lm] : '–'), { akzent: true });
          })(),
      kachel('Meine Nettoproduktion', hat ? y.wert : '–', euro0, 'aufgelaufen ' + p.team.jahr, { einheit: '€' }),
      einzeln ? kachel('Filialdirektion gesamt', fd, euro0, 'Nettoproduktion ' + p.team.jahr, { einheit: '€' }) : kachel('Team-Median', y.median, euro0, hat ? (Math.abs(y.wert - y.median) < 0.5 ? 'Sie liegen genau in der Mitte' : y.wert >= y.median ? 'Sie liegen ' + U.fmtEuro0(y.wert - y.median) + ' darüber' : 'Sie liegen ' + U.fmtEuro0(y.median - y.wert) + ' darunter') : 'Mitte des Teams', { einheit: '€', punkt: hat ? (y.wert >= y.median ? 'var(--good)' : 'var(--warn)') : null }),
      kachel(lm >= 0 ? U.MONATE[lm] : 'Letzter Monat', m && m.wert != null ? m.wert : '–', euro0, einzeln ? (fdM ? U.fmtZahl((m && m.wert || 0) / fdM * 100, 1) + ' % der Filialdirektion' : '') : m ? 'Median ' + U.fmtEuro0(m.median) + (m.rang ? ' · Platz ' + m.rang + ' von ' + m.n : '') : '', { einheit: '€' })));
    if (pos.ziel && hat) {
      var zj = pos.ziel, gleichesJahr = zj.jahr === p.team.jahr, quoteZ = gleichesJahr ? y.wert / zj.wert : null;
      el.appendChild(h('div.karte.rein.leiste', { style: { padding: '12px 18px' } }, h('b', null, 'Mein Ziel ' + zj.jahr + ': ' + U.fmtEuro0(zj.wert)),
        h('span.muted.klein', null, gleichesJahr ? 'erreicht ' + U.fmtZahl(quoteZ * 100, 0) + ' % · noch ' + U.fmtEuro0(Math.max(0, zj.wert - y.wert)) : 'Ergebnis ' + p.team.jahr + ': ' + U.fmtEuro0(y.wert) + ' – das Ziel liegt ' + (zj.wert >= y.wert ? U.fmtEuro0(zj.wert - y.wert) + ' darüber' : U.fmtEuro0(y.wert - zj.wert) + ' darunter')),
        gleichesJahr ? h('div', { style: { flex: 1, height: '10px', borderRadius: '99px', background: 'var(--surface-2)', overflow: 'hidden', minWidth: '120px' } }, h('div.hb.dia', { style: { height: '100%', width: Math.min(100, quoteZ * 100) + '%', background: 'var(--s1)', borderRadius: '99px' } })) : null));
    }
    var sv = T.spartenVergleich(p.team, p.einstellungen.vermittlernummer, lm >= 0 ? lm : 11);
    if (sv.length) {
      var stb = h('tbody');
      if (einzeln) {
        // Einzel-Auswertung: eigene Sparten gegen die Summe der Filialdirektion
        var fdS = pos.gesamt && pos.gesamt.sparten || {}, su = function (w) { var x = 0; for (var mm = 0; mm <= lm; mm++) x += (w && w[mm]) || 0; return x; };
        sv.forEach(function (s) {
          var sp = T.SPARTEN.find(function (x) { return x[1] === s.name || x[0] === s.name; }), g = sp ? su(fdS[sp[0]]) : 0, ant = g > 0 ? s.wert / g * 100 : null;
          stb.appendChild(h('tr', null, h('td', { style: { fontWeight: 600 } }, s.name), h('td.num', { style: { textAlign: 'right' } }, U.fmtEuro0(s.wert)), h('td.num.muted', { style: { textAlign: 'right' } }, g ? U.fmtEuro0(g) : '–'),
            h('td.num', { style: { textAlign: 'right' } }, ant == null ? '–' : U.fmtZahl(ant, 1) + ' %'),
            h('td', { style: { width: '30%' } }, h('div', { style: { position: 'relative', height: '10px', borderRadius: '99px', background: 'var(--surface-2)' } }, h('div.hb.dia', { style: { position: 'absolute', left: 0, top: 0, bottom: 0, width: Math.max(0, Math.min(100, (ant || 0) * 10)) + '%', background: 'var(--s0)', borderRadius: '99px' } })))));
        });
        el.appendChild(h('div.karte.rein', null, h('h3', null, 'Meine Sparten und die Filialdirektion'), h('div.unter', null, 'aufgelaufen bis ' + (lm >= 0 ? U.MONATE[lm] : '–') + ' · Balken: mein Anteil, voller Balken = 10 %'),
          h('div', { style: { overflowX: 'auto' } }, h('table.einfach', null, h('thead', null, h('tr', null, ['Sparte', 'Mein Wert', 'Filialdirektion', 'Mein Anteil', ''].map(function (t, i) { return h('th', { style: i >= 1 && i <= 3 ? { textAlign: 'right' } : null }, t); }))), stb))));
      } else {
      sv.forEach(function (s) {
        var dreh = { 5: -90, 4: -45, 3: 0, 2: 45, 1: 90 }[s.stufe], farbe = s.stufe >= 4 ? 'var(--good-ink)' : s.stufe === 3 ? 'var(--text-2)' : s.stufe === 2 ? 'var(--warn-ink)' : 'var(--crit-ink)';
        var pfeil = D.s('svg', { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', role: 'img', 'aria-label': T.STUFEN[s.stufe] },
          D.s('path', { d: 'M4 12h15M13 6l6 6-6 6', transform: 'rotate(' + dreh + ' 12 12)' }));
        pfeil.style.color = farbe; pfeil.style.transition = 'transform .5s';
        var anteil = s.max > 0 ? Math.max(0, Math.min(100, s.wert / s.max * 100)) : 0, med = s.max > 0 ? Math.max(0, Math.min(100, s.median / s.max * 100)) : 0;
        stb.appendChild(h('tr', null, h('td', { style: { fontWeight: 600 } }, s.name), h('td', { style: { width: '34px' } }, pfeil), h('td', null, T.STUFEN[s.stufe]),
          h('td.num', { style: { textAlign: 'right' } }, U.fmtEuro0(s.wert)), h('td.num.muted', { style: { textAlign: 'right' } }, U.fmtEuro0(s.median)), h('td.num', { style: { textAlign: 'right' } }, s.rang + ' von ' + s.n),
          h('td', { style: { width: '26%' } }, h('div', { title: 'Balken: mein Wert im Verhältnis zum Besten · Strich: Median', style: { position: 'relative', height: '10px', borderRadius: '99px', background: 'var(--surface-2)' } },
            h('div.hb.dia', { style: { position: 'absolute', left: 0, top: 0, bottom: 0, width: anteil + '%', background: s.stufe >= 3 ? 'var(--s1)' : 'var(--s0)', borderRadius: '99px' } }),
            h('div', { style: { position: 'absolute', left: med + '%', top: '-3px', bottom: '-3px', width: '2px', background: 'var(--text)' } })))));
      });
      el.appendChild(h('div.karte.rein', null, h('h3', null, 'Meine Sparten im Teamvergleich'), h('div.unter', null, 'aufgelaufen bis ' + (lm >= 0 ? U.MONATE[lm] : '–') + ' · Pfeil nach oben: oberste 20 % des Teams, schräg oben: über dem Schnitt, rechts: Mittelfeld, schräg unten: darunter, nach unten: unterste 20 %'),
        h('div', { style: { overflowX: 'auto' } }, h('table.einfach', null, h('thead', null, h('tr', null, ['Sparte', '', 'Einordnung', 'Mein Wert', 'Team-Median', 'Platz', 'Ich gegen den Besten'].map(function (t, i) { return h('th', { style: i >= 3 && i <= 5 ? { textAlign: 'right' } : null }, t); }))), stb))));
      }
    } else if (!pos.ich || !pos.ich.sparten) el.appendChild(h('div.meldung', null, 'Für den Vergleich je Sparte (Voll, Zusatz, bKV, Pflege …) wird die Sammelmappe mit den Produktscheiben je ADP benötigt – bzw. die daraus erzeugte Teamdatei Ihrer Führungskraft.'));
    var dL = h('div'), dQ = h('div');
    el.appendChild(h('div.raster.r-21', null,
      h('div.karte.rein', einzeln ? { style: { gridColumn: '1 / -1' } } : null, h('h3', null, einzeln ? 'Mein Verlauf' : 'Mein Verlauf im Teamvergleich'), h('div.unter', null, 'Nettoproduktion je Monat' + (einzeln ? '' : ' · das Band zeigt die mittlere Hälfte des Teams')), dL),
      einzeln ? null : h('div.karte.rein', null, h('h3', null, 'Rangfolge (anonym)'), h('div.unter', null, 'aufgelaufen · Ihr Balken ist hervorgehoben'), dQ)));
    if (!einzeln) el.appendChild(h('p.mini', null, 'So entsteht die Rangfolge: Für jeden Vermittler wird die Nettoproduktion von Januar bis ' + (lm >= 0 ? U.MONATE[lm] : 'heute') + ' aufaddiert und absteigend sortiert; Platz 1 hat den höchsten Wert. Die Summenzeile des Teams' + (pos.gesamt ? ' (' + U.fmtEuro0(pos.gesamt.werte.reduce(function (s, w) { return s + (w || 0); }, 0)) + ')' : '') + ' zählt nicht mit. Der Median ist der Wert in der Mitte: die Hälfte liegt darüber, die Hälfte darunter. Quelle: Monatsscheiben Nettoproduktion' + (p.team.stand ? ', Stand ' + U.fmtDatum(p.team.stand) : '') + '. Kollegen erscheinen ohne Namen und Nummer.'));
    requestAnimationFrame(function () {
      var bis = function (f) { return pos.monate.map(function (x, i) { return x && i <= lm ? f(x) : null; }); };
      G.linie(dL, { titel: 'Nettoproduktion im Teamvergleich', kategorien: U.MONATE_KURZ, kategorienLang: U.MONATE, format: U.fmtEuro0, hoehe: 260,
        reihen: (hat ? [{ name: 'Ich', farbe: G.FARBEN[0], stark: true, flaeche: true, werte: bis(function (x) { return x.wert; }) }] : []).concat(einzeln ? [] : [{ name: 'Team-Median', farbe: G.FARBEN[1], werte: bis(function (x) { return x.median; }) }]),
        band: einzeln ? null : { name: 'Mittlere Hälfte', unten: bis(function (x) { return x.q1; }), oben: bis(function (x) { return x.q3; }) } });
      var kum = p.team.zeilen.filter(function (z) { return !z.gesamt; }).map(function (z) { return { ich: pos.ich === z, wert: z.werte.reduce(function (s, w) { return s + (w || 0); }, 0) }; }).sort(function (a, b) { return b.wert - a.wert; });
      if (!einzeln) G.quer(dQ, { format: U.fmtEuro0, zeilen: kum.map(function (k, i) { return { name: k.ich ? 'Ich' : 'Platz ' + (i + 1), wert: k.wert, farbe: k.ich ? G.FARBEN[0] : G.GRAU }; }) });
    });
  }

  // ---------- Management: ADP-Vergleich ----------
  function zeigeMgmt(el, aktionen, p, z, eigen) {
    if (eigen && !App.zeilen.length) { el.appendChild(ablage('Legen Sie Ihre Provisionsabrechnung (CSV) ab. Die App zeigt daraus Ihre Produktion nach Monaten, Sparten, Kategorien, Neugeschäft, Erhöhungen und Storno – auch wenn Sie keinen einzigen Antrag erfasst haben.')); return; }
    if (!App.zeilen.length && !p.team) { el.appendChild(ablage('Legen Sie Ihre Provisionsabrechnung (mit Hierarchie-Buchungen) und die Monatsscheiben (Excel) ab. Die App erkennt beide Dateien automatisch und wertet sie je ADP aus.')); return; }
    var w = eigen ? (App.wuerfelEigen && App.wuerfelEigen.ref === App.zeilen ? App.wuerfelEigen.w : (App.wuerfelEigen = { ref: App.zeilen, w: T.wuerfel(App.zeilen, p.jahr, true) }).w) : (App.wuerfel || (App.wuerfel = T.wuerfel(App.zeilen, p.jahr)));
    if (!z.arten) z.arten = new Set(w.arten.filter(function (a) { return eigen ? (a === 'Abschluss' || a === 'Erhöhung' || a === 'Manuell' || a === 'Kündigungsrücknahme') : (a === 'Hierarchie' || a === 'Abschluss' || a === 'Erhöhung'); }));
    if (!eigen && w.arten.indexOf('Hierarchie') < 0 && App.zeilen.length) el.appendChild(h('div.meldung.warn.leiste', null, h('span', { style: { flex: 1 } }, 'Diese Abrechnung enthält keine Hierarchie-Buchungen – sie gehört einem einzelnen ADP. Die Nummern in der Liste sind beteiligte Partner (Spalte „Beteiligte Vermittler"), keine ADP.'),
      D.btn('Zu „Meine Produktion"', function () { App.zeige('produktion'); }, { klasse: 'klein-btn haupt-btn' })));
    if (!z.farben) z.farben = {};
    if (z.von == null) { z.von = 0; z.bis = 11; }
    if (eigen) z.mass = 'beitrag';
    if (!z.mass) z.mass = App.zeilen.length ? 'beitrag' : 'scheiben';
    var f = { arten: z.arten, gruppen: z.gruppe ? new Set([z.gruppe]) : null, monate: [z.von, z.bis], beihilfe: z.beihilfe || '' };
    var alle = T.auswertung(w, f), nrs = Object.keys(alle.proAdp);
    var scheibe = {}, vergeben = new Set();
    var merke = function (nr, t) { var s = 0; for (var m = z.von; m <= z.bis; m++) s += t.werte[m] || 0; scheibe[nr] = { summe: s, zeile: t }; vergeben.add(t); };
    nrs.forEach(function (nr) { var t = teamZeile(p, nr); if (t && !t.gesamt) merke(nr, t); });
    if (!eigen) (p.team ? p.team.zeilen : []).forEach(function (t) { if (!t.gesamt && !vergeben.has(t)) { nrs.push(t.nr); merke(t.nr, t); } });
    var wertVon = function (nr) { return z.mass === 'scheiben' ? (scheibe[nr] ? scheibe[nr].summe : 0) : (alle.proAdp[nr] ? alle.proAdp[nr].netto : 0); };
    nrs.sort(function (a, b) { return wertVon(b) - wertVon(a); });
    if (eigen) z.wahl = new Set(nrs);
    if (!z.wahl) z.wahl = new Set(nrs.slice(0, 5));
    nrs.slice().forEach(function (nr) { if (z.wahl.has(nr) && z.farben[nr] == null) { for (var c = 0; c < 5; c++) if (Object.keys(z.farben).every(function (k) { return z.farben[k] !== c; })) { z.farben[nr] = c; break; } } });
    Object.keys(z.farben).forEach(function (nr) { if (!z.wahl.has(nr)) delete z.farben[nr]; });
    var farbe = function (nr) { return z.farben[nr] != null ? G.FARBEN[z.farben[nr]] : G.GRAU; };
    var gew = T.auswertung(w, Object.assign({}, f, { adps: z.wahl })).gesamt;
    var neu = function () { App.zeige(eigen ? 'produktion' : 'team'); };

    if (!eigen) aktionen.appendChild(D.btn('Teamdatei für ADP', function () {
      if (!p.team) { D.toast('Bitte zuerst die Monatsscheiben einlesen.'); return; }
      D.lade('Teamdatei_' + p.team.jahr + (p.team.stand ? '_' + p.team.stand : '') + '.json', JSON.stringify({ format: 'antragsbuch-team', team: T.pseudonymisiere(p.team) }), 'application/json');
      D.toast('Teamdatei erzeugt – ohne Namen und Vermittlernummern. ADP ziehen sie einfach in ihr Antragsbuch.');
    }, { icon: 'runter', titel: 'Pseudonymisierte Teamdatei erzeugen, die Sie an Ihre ADP weitergeben können' }));

    if (!eigen && p.team && p.team.pseudonym) el.appendChild(h('div.meldung', null, 'Die Teamdaten sind ohne Namen gespeichert (im ADP-Modus eingelesen). Für Namen die Monatsscheiben im Management-Modus noch einmal ablegen.'));
    // Filterzeile
    var mOpt = U.MONATE.map(function (m, i) { return [String(i), m]; });
    el.appendChild(h('div.leiste', null,
      eigen ? null : D.seg([['beitrag', 'Beitrag lt. Abrechnung'], ['scheiben', 'Nettoproduktion lt. Monatsscheiben']], z.mass, function (v) { z.mass = v; neu(); }),
      h('span.klein.muted', null, 'von'), D.auswahl(mOpt, String(z.von), function (v) { z.von = +v; if (z.bis < z.von) z.bis = z.von; neu(); }, { style: { width: '124px' } }),
      h('span.klein.muted', null, 'bis'), D.auswahl(mOpt, String(z.bis), function (v) { z.bis = +v; if (z.von > z.bis) z.von = z.bis; neu(); }, { style: { width: '124px' } }),
      D.auswahl([['', 'Alle Tarifgruppen']].concat(w.gruppen.map(function (g) { return [g, g]; })), z.gruppe || '', function (v) { z.gruppe = v; neu(); }, { style: { width: '210px' } }),
      D.auswahl([['', 'Beihilfe: alle'], ['ja', 'Nur Beihilfe'], ['nein', 'Ohne Beihilfe']], z.beihilfe || '', function (v) { z.beihilfe = v; neu(); }, { style: { width: '140px' }, title: 'Nach Beihilfe filtern' }),
      h('span.frei'), w.arten.map(function (a) { var an = z.arten.has(a); return h('button.chip' + (an ? '.aktiv' : ''), { type: 'button', title: 'Provisionsart ' + a, onclick: function () { if (an) z.arten.delete(a); else z.arten.add(a); neu(); } }, a); })));

    // ADP-Liste mit Checkboxen
    var liste = h('div.adpliste', { style: { maxHeight: '560px' } });
    nrs.forEach(function (nr) {
      var a = alle.proAdp[nr], an = z.wahl.has(nr), nm = nameVon(p, nr);
      liste.appendChild(h('label.adp', { title: nr + (nm ? ' ' + nm : '') }, h('input', { type: 'checkbox', checked: an, onchange: function () { if (this.checked) z.wahl.add(nr); else z.wahl.delete(nr); neu(); } }),
        h('i', { style: { background: an ? farbe(nr) : 'transparent', border: an ? 'none' : '1px solid var(--line-2)' } }),
        h('span.n', null, nm || nr, h('small', null, nm ? nr : (a ? a.n + ' Buchungen' : ''))), h('span.num', { style: { fontWeight: 600 } }, U.fmtEuro0(wertVon(nr)))));
    });
    var links = h('div.karte.rein', { style: { padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'start' } },
      h('div.leiste', { style: { padding: '0 8px' } }, h('h3', null, 'ADP (' + z.wahl.size + '/' + nrs.length + ')'), h('span.frei'),
        D.btn('Alle', function () { z.wahl = new Set(nrs); neu(); }, { klasse: 'klein-btn leise' }), D.btn('Keine', function () { z.wahl = new Set(); neu(); }, { klasse: 'klein-btn leise' })), liste,
      h('div.mini', { style: { padding: '0 8px' } }, 'Bis zu fünf ausgewählte ADP erhalten eine eigene Farbe; weitere erscheinen grau.'));

    var storno = Math.abs(gew.kat.storno), plus = gew.plus || 0;
    // Die Nettoproduktion zählt über alle Provisionsarten (auch Legacy-Korrekturen), damit sie zu Monatsscheiben und Bonus passt.
    var prodAlle = eigen ? T.auswertung(w, Object.assign({}, f, { adps: z.wahl, arten: null })).gesamt.produktion : 0;
    var hatProd = eigen && Math.abs(prodAlle) > 0.005;
    var kacheln = h('div.raster.' + (hatProd ? 'r-5' : 'r-4'), null,
      hatProd ? kachel('Meine Nettoproduktion', prodAlle, euro0, 'wie in Monatsscheiben und Bonus · alle Provisionsarten', { akzent: true, einheit: '€' }) : null,
      kachel(eigen ? 'Mein Netto-Beitrag' : 'Netto-Beitrag (Auswahl)', gew.netto, euro0, U.fmtZahl(gew.n, 0) + ' Buchungen' + (hatProd ? ' · Beitragsänderung' : eigen ? ' · Provision ' + U.fmtEuro0(gew.prov) : ' · ' + z.wahl.size + ' ADP'), { akzent: !hatProd, einheit: '€' }),
      kachel('Neugeschäft', gew.kat.neu, euro0, U.fmtZahl(gew.katN.neu, 0) + ' Buchungen', { einheit: '€', punkt: G.FARBEN[0] }),
      kachel('Erhöhungen', gew.kat.mehr, euro0, U.fmtZahl(gew.katN.mehr, 0) + ' Buchungen', { einheit: '€', punkt: G.FARBEN[2] }),
      kachel('Storno + Reduzierung', gew.kat.storno + gew.kat.minder, euro0, 'Stornoquote ' + U.fmtZahl(plus ? storno / plus * 100 : 0, 1) + ' %', { einheit: '€', punkt: 'var(--crit)' }));
    var dKat = h('div'), dRing = h('div'), dLin = h('div'), dQuer = h('div');
    var rechts = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 } }, kacheln,
      h('div.raster.r-21', null,
        h('div.karte.rein', null, h('h3', null, 'Beitrag je Monat nach Kategorie'), h('div.unter', null, (eigen ? 'laut Abrechnung' : 'ausgewählte ADP') + ' · Zugänge nach oben, Abgänge nach unten'), dKat),
        h('div.karte.rein', null, h('div.leiste', null, h('h3', null, 'Mix nach'), D.seg([['gruppe', 'Sparte'], ['kategorie', 'Kategorie']], z.ring || 'gruppe', function (v) { z.ring = v; neu(); })),
          h('div.unter', null, 'Netto-Beitrag · davon Beihilfe ' + U.fmtEuro0(gew.beihilfe)), dRing)),
      h('div.raster.r-2', null,
        h('div.karte.rein', null, h('h3', null, eigen ? 'Beitrag und Provision je Monat' : 'ADP im Verlauf'), h('div.unter', null, eigen ? 'Netto-Beitrag und gebuchte Provision laut Abrechnung' : (z.mass === 'scheiben' ? 'Nettoproduktion lt. Monatsscheiben' : 'Netto-Beitrag lt. Abrechnung') + ' · gestrichelt: Median aller ADP'), dLin),
        h('div.karte.rein', null, h('h3', null, eigen ? 'Wo kommt es her?' : 'Rangfolge'), h('div.unter', null, eigen ? 'Netto-Beitrag nach Kategorie' : 'ausgewählte ADP im gewählten Zeitraum'), dQuer)));
    el.appendChild(eigen ? rechts : h('div', { style: { display: 'grid', gridTemplateColumns: '268px minmax(0, 1fr)', gap: '16px' } }, links, rechts));

    requestAnimationFrame(function () {
      var kats = [['neu', 'Neugeschäft', 0], ['mehr', 'Erhöhung', 2], ['minder', 'Reduzierung', 3], ['storno', 'Storno', 1]], proMonat = {};
      w.zellen.forEach(function (c) {
        if (!z.arten.has(c.art) || (z.gruppe && c.tg !== z.gruppe) || !z.wahl.has(c.adp) || c.kat === 'sonst' || (z.beihilfe && (z.beihilfe === 'ja') !== c.bh)) return;
        (proMonat[c.kat] = proMonat[c.kat] || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])[c.m] += c.plus + c.minus;
      });
      G.balken(dKat, { titel: 'Beitrag je Monat nach Kategorie', kategorien: U.MONATE_KURZ, kategorienLang: U.MONATE, format: U.fmtEuro, hoehe: 250,
        reihen: kats.map(function (k) { return { name: k[1], farbe: G.FARBEN[k[2]], werte: (proMonat[k[0]] || []).map(function (v) { return U.runde(v); }) }; }) });
      var quelle = z.ring === 'kategorie' ? gew.sparten : gew.gruppen;
      var gr = Object.keys(quelle).map(function (g) { return { name: z.ring === 'kategorie' ? g : kurzGruppe(g), wert: quelle[g] }; }).sort(function (a, b) { return b.wert - a.wert; });
      G.ring(dRing, { titel: 'Netto-Beitrag nach Tarifgruppe', format: U.fmtEuro, mitte: { wert: U.fmtEuro0(gew.netto), label: 'netto' }, teile: gr.map(function (g, i) { return { name: g.name, wert: g.wert, farbe: i < 5 ? G.FARBEN[i] : G.GRAU }; }) });
      var reihe = function (nr) { return z.mass === 'scheiben' ? (scheibe[nr] ? scheibe[nr].zeile.werte : []) : (alle.proAdp[nr] ? alle.proAdp[nr].monate : []); };
      var letzter = -1; nrs.forEach(function (nr) { reihe(nr).forEach(function (v, i) { if (v) letzter = Math.max(letzter, i); }); });
      var schnitt = function (arr) { return U.MONATE.map(function (_, i) { return i >= z.von && i <= Math.min(z.bis, letzter) ? (arr[i] || 0) : null; }); };
      var med = U.MONATE.map(function (_, i) { return i >= z.von && i <= Math.min(z.bis, letzter) ? U.median(nrs.map(function (nr) { return reihe(nr)[i] || 0; })) : null; });
      var gewaehlt = nrs.filter(function (nr) { return z.wahl.has(nr); });
      var bunt = gewaehlt.filter(function (nr) { return z.farben[nr] != null; }), grau = gewaehlt.filter(function (nr) { return z.farben[nr] == null; });
      if (eigen) {
        G.linie(dLin, { titel: 'Beitrag und Provision je Monat', kategorien: U.MONATE_KURZ, kategorienLang: U.MONATE, format: U.fmtEuro, hoehe: 250,
          reihen: [{ name: 'Netto-Beitrag', farbe: G.FARBEN[0], stark: true, flaeche: true, werte: schnitt(gew.monate) }, { name: 'Provision', farbe: G.FARBEN[1], werte: schnitt(gew.provMonate) }] });
        var spq = Object.keys(gew.sparten).map(function (k) { return { name: k, wert: U.runde(gew.sparten[k]), zusatz: gew.spartenDetail[k].n + ' Buchungen · Provision ' + U.fmtEuro(gew.spartenDetail[k].prov) }; }).sort(function (a, b) { return b.wert - a.wert; });
        G.quer(dQuer, { format: U.fmtEuro0, zeilen: spq.slice(0, 12) });
        return;
      }
      G.linie(dLin, { titel: 'ADP im Verlauf', kategorien: U.MONATE_KURZ, kategorienLang: U.MONATE, format: U.fmtEuro, hoehe: 250,
        reihen: grau.slice(0, 20).map(function (nr) { return { name: nameVon(p, nr) || nr, farbe: G.GRAU, werte: schnitt(reihe(nr)) }; })
          .concat(bunt.map(function (nr) { return { name: nameVon(p, nr) || nr, farbe: farbe(nr), werte: schnitt(reihe(nr)), stark: true }; }))
          .concat([{ name: 'Median aller ADP', farbe: 'var(--text-3)', strich: true, werte: med }]) });
      G.quer(dQuer, { format: U.fmtEuro0, zeilen: gewaehlt.slice(0, 14).map(function (nr) { var a = alle.proAdp[nr]; return { name: nameVon(p, nr) || nr, wert: wertVon(nr), farbe: farbe(nr), zusatz: a ? a.n + ' Buchungen' : '' }; }) });
    });

    if (eigen) {
      var ek = ['Kategorie', 'Neugeschäft', 'Erhöhung', 'Reduzierung', 'Storno', 'Netto-Beitrag', 'Buchungen', 'Provision', 'Nettoproduktion'];
      var ez = Object.keys(gew.spartenDetail).map(function (k) { var d = gew.spartenDetail[k]; return [k, U.runde(d.neu), U.runde(d.mehr), U.runde(d.minder), U.runde(d.storno), U.runde(d.netto), d.n, U.runde(d.prov), U.runde(d.produktion)]; }).sort(function (a, b) { return b[5] - a[5]; });
      var es = ['Summe', U.runde(gew.kat.neu), U.runde(gew.kat.mehr), U.runde(gew.kat.minder), U.runde(gew.kat.storno), U.runde(gew.netto), gew.n, U.runde(gew.prov), U.runde(gew.produktion)];
      var etb = h('tbody');
      ez.concat([es]).forEach(function (r, ri) { var tr = h('tr', ri === ez.length ? { style: { fontWeight: 650 } } : null); r.forEach(function (c, i) { tr.appendChild(h('td' + (i ? '.num' : ''), { style: i ? { textAlign: 'right' } : null }, i === 0 ? c : i === 6 ? U.fmtZahl(c, 0) : U.fmtEuro(c))); }); etb.appendChild(tr); });
      el.appendChild(h('div.karte.rein', null, h('div.leiste', null, h('h3', null, 'Meine Produktion nach Kategorie'), h('span.muted.klein', null, U.MONATE[z.von] + ' bis ' + U.MONATE[z.bis] + ' ' + p.jahr), h('span.frei'),
        D.exportBtn('Meine_Produktion_' + p.jahr, function () { var t = AB.kennzahlen.alsTabelle(ek, ez); t.spalten[6].typ = 'ganz'; t.spalten[0].b = 30; t.summe = es;
          return Object.assign({ name: 'Meine Produktion', titel: 'Meine Produktion ' + p.jahr, unter: U.MONATE[z.von] + ' bis ' + U.MONATE[z.bis] + ' · ' + Array.from(z.arten).join(', ') + ' · Stand ' + U.fmtDatum(U.heute()) }, t); },
          function () { return AB.csv.schreibe(ek, ez.concat([es])); }, { klasse: 'klein-btn' })),
        h('div', { style: { overflowX: 'auto', marginTop: '8px' } }, h('table.einfach', null, h('thead', null, h('tr', null, ek.map(function (t, i) { return h('th', { style: i ? { textAlign: 'right' } : null }, t); }))), etb)),
        h('p.mini', null, 'Quelle ist allein Ihre Provisionsabrechnung. Neugeschäft = Beitragsdifferenz entspricht dem Monatsbeitrag; Erhöhung = positiver Mehrbeitrag; Reduzierung = negativer Beitrag bei fortbestehendem Tarif; Storno = Tarif endet oder Stornogrund vorhanden. Die Kategorie stammt aus dem Tarifschlüssel. Über die Schalter oben nehmen Sie Provisionsarten wie „Bestand" hinzu.')));
      return;
    }
    // Vergleichstabelle
    var rang = {}; nrs.slice().sort(function (a, b) { return (scheibe[b] ? scheibe[b].summe : -1e12) - (scheibe[a] ? scheibe[a].summe : -1e12); }).forEach(function (nr, i) { if (scheibe[nr]) rang[nr] = i + 1; });
    var kopf = ['ADP', 'Nummer', 'Neugeschäft', 'Erhöhung', 'Reduzierung', 'Storno', 'Netto-Beitrag', 'Stornoquote %', 'Buchungen', 'Provision', 'Monatsscheiben', 'Rang'];
    var zl = nrs.filter(function (nr) { return z.wahl.has(nr); }).map(function (nr) {
      var a = alle.proAdp[nr] || { kat: {}, plus: 0, n: 0, netto: 0, prov: 0 };
      return [nameVon(p, nr) || '–', nr, a.kat.neu || 0, a.kat.mehr || 0, a.kat.minder || 0, a.kat.storno || 0, a.netto, a.plus ? U.runde(Math.abs(a.kat.storno || 0) / a.plus * 100) : 0, a.n, a.prov, scheibe[nr] ? scheibe[nr].summe : '', rang[nr] || ''];
    });
    var tb = h('tbody');
    zl.forEach(function (r) { var tr = h('tr'); r.forEach(function (c, i) { tr.appendChild(h('td' + (i > 1 ? '.num' : ''), { style: i > 1 ? { textAlign: 'right' } : null }, i > 1 && typeof c === 'number' ? (i === 7 ? U.fmtZahl(c, 1) : i === 8 || i === 11 ? U.fmtZahl(c, 0) : U.fmtEuro(c)) : c)); }); tb.appendChild(tr); });
    el.appendChild(h('div.karte.rein', null, h('div.leiste', null, h('h3', null, 'Vergleichstabelle'), h('span.muted.klein', null, U.MONATE[z.von] + ' bis ' + U.MONATE[z.bis] + ' ' + p.jahr), h('span.frei'),
      D.exportBtn('ADP-Vergleich_' + p.jahr, function () { var t = AB.kennzahlen.alsTabelle(kopf, zl); t.spalten[7].typ = 'prozent'; t.spalten[8].typ = t.spalten[11].typ = 'ganz'; t.spalten[0].b = 26;
        t.farbe = function (w, r, c) { return c === 7 ? (w[7] >= 30 ? 'krit' : w[7] >= 15 ? 'warn' : null) : c === 6 && w[6] < 0 ? 'krit' : null; };
        return Object.assign({ name: 'ADP-Vergleich', titel: 'ADP-Vergleich ' + p.jahr, unter: U.MONATE[z.von] + ' bis ' + U.MONATE[z.bis] + ' · ' + Array.from(z.arten).join(', ') + ' · Stand ' + U.fmtDatum(U.heute()) }, t); },
        function () { return AB.csv.schreibe(kopf, zl); }, { klasse: 'klein-btn' }),
      D.btn('Drucken', function () { D.drucke('ADP-Vergleich ' + p.jahr, U.MONATE[z.von] + ' bis ' + U.MONATE[z.bis] + ' · ' + Array.from(z.arten).join(', ') + ' · Stand ' + U.fmtDatum(U.heute()), kopf.map(function (t, i) { return { t: t, r: i > 1 }; }),
        zl.map(function (r) { return r.map(function (c, i) { return i > 1 && typeof c === 'number' ? U.fmtZahl(c, i === 8 || i === 11 ? 0 : 2) : c; }); })); }, { klasse: 'klein-btn', icon: 'druck' })),
      h('div', { style: { overflowX: 'auto', marginTop: '8px' } }, h('table.einfach', null, h('thead', null, h('tr', null, kopf.map(function (t, i) { return h('th', { style: i > 1 ? { textAlign: 'right' } : null }, t); }))), tb)),
      h('p.mini', null, 'Kategorien aus der Abrechnung: Neugeschäft = Beitragsdifferenz entspricht dem Monatsbeitrag; Erhöhung = positiver Mehrbeitrag; Reduzierung = negativer Beitrag bei fortbestehendem Tarif; Storno = Tarif endet oder Stornogrund vorhanden. Der ADP ist der Vermittler mit der Rolle „Geschrieben".')));
  }

  AB.ansichten.team = { icon: 'team', titel: function () { return App.modus() === 'mgmt' ? 'Management' : 'Team'; },
    unter: function () { var t = App.p.team; return App.modus() === 'mgmt' ? 'ADP-Vergleich aus Abrechnung und Monatsscheiben' + (t && t.stand ? ' · Monatsscheiben Stand ' + U.fmtDatum(t.stand) : '') : 'Wo stehe ich im Team?'; },
    _eigen: function (el, aktionen, p, z) { zeigeMgmt(el, aktionen, p, z, true); },
    zeige: function (el, aktionen, z) { if (App.modus() === 'mgmt') zeigeMgmt(el, aktionen, App.p, z); else zeigeAdp(el, App.p); } };
})(globalThis.AB = globalThis.AB || {});

(function (AB) {
  'use strict';
  var App = AB.app;
  AB.ansichten.produktion = { icon: 'chart', titel: 'Meine Produktion',
    unter: function () { var e = App.p.einstellungen; return 'Auswertung der eigenen Abrechnung ' + App.p.jahr + (e.vermittlernummer ? ' · Vermittler ' + e.vermittlernummer : '') + ' – ohne Antragsbuch nutzbar'; },
    zeige: function (el, aktionen, z) { AB.ansichten.team._eigen(el, aktionen, App.p, z); } };
})(globalThis.AB = globalThis.AB || {});
