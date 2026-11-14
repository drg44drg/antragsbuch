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
    if (!pos.ich || pos.ich.gesamt) el.appendChild(h('div.meldung.warn', null, pos.ich ? 'Ihre Vermittlernummer ist die Summenzeile des Teams – für den ADP-Vergleich bitte oben auf „Management" umschalten.' : 'Ihre Vermittlernummer wurde in den Teamdaten nicht gefunden. Bitte in den Einstellungen prüfen – angezeigt wird nur die Teamverteilung.'));
    var y = pos.ytd || { n: 0, median: 0 }, m = lm >= 0 ? pos.monate[lm] : null, hat = y.wert != null;
    el.appendChild(h('div.raster.r-4', null,
      kachel('Mein Platz im Team', hat ? 'Platz ' + y.rang : '–', null, 'von ' + y.n + ' · aufgelaufen bis ' + (lm >= 0 ? U.MONATE[lm] : '–'), { akzent: true }),
      kachel('Meine Nettoproduktion', hat ? y.wert : '–', euro0, 'aufgelaufen ' + p.team.jahr, { einheit: '€' }),
      kachel('Team-Median', y.median, euro0, hat ? (Math.abs(y.wert - y.median) < 0.5 ? 'Sie liegen genau in der Mitte' : y.wert >= y.median ? 'Sie liegen ' + U.fmtEuro0(y.wert - y.median) + ' darüber' : 'Sie liegen ' + U.fmtEuro0(y.median - y.wert) + ' darunter') : 'Mitte des Teams', { einheit: '€', punkt: hat ? (y.wert >= y.median ? 'var(--good)' : 'var(--warn)') : null }),
      kachel(lm >= 0 ? U.MONATE[lm] : 'Letzter Monat', m && m.wert != null ? m.wert : '–', euro0, m ? 'Median ' + U.fmtEuro0(m.median) + (m.rang ? ' · Platz ' + m.rang + ' von ' + m.n : '') : '', { einheit: '€' })));
    var dL = h('div'), dQ = h('div');
    el.appendChild(h('div.raster.r-21', null,
      h('div.karte.rein', null, h('h3', null, 'Mein Verlauf im Teamvergleich'), h('div.unter', null, 'Nettoproduktion je Monat · das Band zeigt die mittlere Hälfte des Teams'), dL),
      h('div.karte.rein', null, h('h3', null, 'Rangfolge (anonym)'), h('div.unter', null, 'aufgelaufen · Ihr Balken ist hervorgehoben'), dQ)));
    el.appendChild(h('p.mini', null, 'Quelle: Monatsscheiben Nettoproduktion' + (p.team.stand ? ', Stand ' + U.fmtDatum(p.team.stand) : '') + '. Kollegen werden ohne Namen und Nummer dargestellt.'));
    requestAnimationFrame(function () {
      var bis = function (f) { return pos.monate.map(function (x, i) { return x && i <= lm ? f(x) : null; }); };
      G.linie(dL, { titel: 'Nettoproduktion im Teamvergleich', kategorien: U.MONATE_KURZ, kategorienLang: U.MONATE, format: U.fmtEuro0, hoehe: 260,
        reihen: (hat ? [{ name: 'Ich', farbe: G.FARBEN[0], stark: true, flaeche: true, werte: bis(function (x) { return x.wert; }) }] : []).concat([{ name: 'Team-Median', farbe: G.FARBEN[1], werte: bis(function (x) { return x.median; }) }]),
        band: { name: 'Mittlere Hälfte', unten: bis(function (x) { return x.q1; }), oben: bis(function (x) { return x.q3; }) } });
      var kum = p.team.zeilen.filter(function (z) { return !z.gesamt; }).map(function (z) { return { ich: pos.ich === z, wert: z.werte.reduce(function (s, w) { return s + (w || 0); }, 0) }; }).sort(function (a, b) { return b.wert - a.wert; });
      G.quer(dQ, { format: U.fmtEuro0, zeilen: kum.map(function (k, i) { return { name: k.ich ? 'Ich' : 'Platz ' + (i + 1), wert: k.wert, farbe: k.ich ? G.FARBEN[0] : G.GRAU }; }) });
    });
  }

  // ---------- Management: ADP-Vergleich ----------
  function zeigeMgmt(el, aktionen, p, z) {
    if (!App.zeilen.length && !p.team) { el.appendChild(ablage('Legen Sie Ihre Provisionsabrechnung (mit Hierarchie-Buchungen) und die Monatsscheiben (Excel) ab. Die App erkennt beide Dateien automatisch und wertet sie je ADP aus.')); return; }
    var w = App.wuerfel || (App.wuerfel = T.wuerfel(App.zeilen, p.jahr));
    if (!z.arten) z.arten = new Set(w.arten.filter(function (a) { return a === 'Hierarchie' || a === 'Abschluss' || a === 'Erhöhung'; }));
    if (!z.farben) z.farben = {};
    if (z.von == null) { z.von = 0; z.bis = 11; }
    if (!z.mass) z.mass = App.zeilen.length ? 'beitrag' : 'scheiben';
    var f = { arten: z.arten, gruppen: z.gruppe ? new Set([z.gruppe]) : null, monate: [z.von, z.bis] };
    var alle = T.auswertung(w, f), nrs = Object.keys(alle.proAdp);
    var scheibe = {}, vergeben = new Set();
    var merke = function (nr, t) { var s = 0; for (var m = z.von; m <= z.bis; m++) s += t.werte[m] || 0; scheibe[nr] = { summe: s, zeile: t }; vergeben.add(t); };
    nrs.forEach(function (nr) { var t = teamZeile(p, nr); if (t && !t.gesamt) merke(nr, t); });
    (p.team ? p.team.zeilen : []).forEach(function (t) { if (!t.gesamt && !vergeben.has(t)) { nrs.push(t.nr); merke(t.nr, t); } });
    var wertVon = function (nr) { return z.mass === 'scheiben' ? (scheibe[nr] ? scheibe[nr].summe : 0) : (alle.proAdp[nr] ? alle.proAdp[nr].netto : 0); };
    nrs.sort(function (a, b) { return wertVon(b) - wertVon(a); });
    if (!z.wahl) z.wahl = new Set(nrs.slice(0, 5));
    nrs.slice().forEach(function (nr) { if (z.wahl.has(nr) && z.farben[nr] == null) { for (var c = 0; c < 5; c++) if (Object.keys(z.farben).every(function (k) { return z.farben[k] !== c; })) { z.farben[nr] = c; break; } } });
    Object.keys(z.farben).forEach(function (nr) { if (!z.wahl.has(nr)) delete z.farben[nr]; });
    var farbe = function (nr) { return z.farben[nr] != null ? G.FARBEN[z.farben[nr]] : G.GRAU; };
    var gew = T.auswertung(w, Object.assign({}, f, { adps: z.wahl })).gesamt;
    var neu = function () { App.zeige('team'); };

    aktionen.appendChild(D.btn('Teamdatei für ADP', function () {
      if (!p.team) { D.toast('Bitte zuerst die Monatsscheiben einlesen.'); return; }
      D.lade('Teamdatei_' + p.team.jahr + (p.team.stand ? '_' + p.team.stand : '') + '.json', JSON.stringify({ format: 'antragsbuch-team', team: T.pseudonymisiere(p.team) }), 'application/json');
      D.toast('Teamdatei erzeugt – ohne Namen und Vermittlernummern. ADP ziehen sie einfach in ihr Antragsbuch.');
    }, { icon: 'runter', titel: 'Pseudonymisierte Teamdatei erzeugen, die Sie an Ihre ADP weitergeben können' }));

    if (p.team && p.team.pseudonym) el.appendChild(h('div.meldung', null, 'Die Teamdaten sind ohne Namen gespeichert (im ADP-Modus eingelesen). Für Namen die Monatsscheiben im Management-Modus noch einmal ablegen.'));
    // Filterzeile
    var mOpt = U.MONATE.map(function (m, i) { return [String(i), m]; });
    el.appendChild(h('div.leiste', null,
      D.seg([['beitrag', 'Beitrag lt. Abrechnung'], ['scheiben', 'Nettoproduktion lt. Monatsscheiben']], z.mass, function (v) { z.mass = v; neu(); }),
      h('span.klein.muted', null, 'von'), D.auswahl(mOpt, String(z.von), function (v) { z.von = +v; if (z.bis < z.von) z.bis = z.von; neu(); }, { style: { width: '124px' } }),
      h('span.klein.muted', null, 'bis'), D.auswahl(mOpt, String(z.bis), function (v) { z.bis = +v; if (z.von > z.bis) z.von = z.bis; neu(); }, { style: { width: '124px' } }),
      D.auswahl([['', 'Alle Tarifgruppen']].concat(w.gruppen.map(function (g) { return [g, g]; })), z.gruppe || '', function (v) { z.gruppe = v; neu(); }, { style: { width: '230px' } }),
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
    var kacheln = h('div.raster.r-4', null,
      kachel('Netto-Beitrag (Auswahl)', gew.netto, euro0, U.fmtZahl(gew.n, 0) + ' Buchungen · ' + z.wahl.size + ' ADP', { akzent: true, einheit: '€' }),
      kachel('Neugeschäft', gew.kat.neu, euro0, U.fmtZahl(gew.katN.neu, 0) + ' Buchungen', { einheit: '€', punkt: G.FARBEN[0] }),
      kachel('Erhöhungen', gew.kat.mehr, euro0, U.fmtZahl(gew.katN.mehr, 0) + ' Buchungen', { einheit: '€', punkt: G.FARBEN[2] }),
      kachel('Storno + Reduzierung', gew.kat.storno + gew.kat.minder, euro0, 'Stornoquote ' + U.fmtZahl(plus ? storno / plus * 100 : 0, 1) + ' %', { einheit: '€', punkt: 'var(--crit)' }));
    var dKat = h('div'), dRing = h('div'), dLin = h('div'), dQuer = h('div');
    var rechts = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 } }, kacheln,
      h('div.raster.r-21', null,
        h('div.karte.rein', null, h('h3', null, 'Beitrag je Monat nach Kategorie'), h('div.unter', null, 'ausgewählte ADP · Zugänge nach oben, Abgänge nach unten'), dKat),
        h('div.karte.rein', null, h('h3', null, 'Sparten-Mix'), h('div.unter', null, 'Netto-Beitrag nach Tarifgruppe'), dRing)),
      h('div.raster.r-2', null,
        h('div.karte.rein', null, h('h3', null, 'ADP im Verlauf'), h('div.unter', null, (z.mass === 'scheiben' ? 'Nettoproduktion lt. Monatsscheiben' : 'Netto-Beitrag lt. Abrechnung') + ' · gestrichelt: Median aller ADP'), dLin),
        h('div.karte.rein', null, h('h3', null, 'Rangfolge'), h('div.unter', null, 'ausgewählte ADP im gewählten Zeitraum'), dQuer)));
    el.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: '268px minmax(0, 1fr)', gap: '16px' } }, links, rechts));

    requestAnimationFrame(function () {
      var kats = [['neu', 'Neugeschäft', 0], ['mehr', 'Erhöhung', 2], ['minder', 'Reduzierung', 3], ['storno', 'Storno', 1]], proMonat = {};
      w.zellen.forEach(function (c) {
        if (!z.arten.has(c.art) || (z.gruppe && c.tg !== z.gruppe) || !z.wahl.has(c.adp) || c.kat === 'sonst') return;
        (proMonat[c.kat] = proMonat[c.kat] || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])[c.m] += c.plus + c.minus;
      });
      G.balken(dKat, { titel: 'Beitrag je Monat nach Kategorie', kategorien: U.MONATE_KURZ, kategorienLang: U.MONATE, format: U.fmtEuro, hoehe: 250,
        reihen: kats.map(function (k) { return { name: k[1], farbe: G.FARBEN[k[2]], werte: (proMonat[k[0]] || []).map(function (v) { return U.runde(v); }) }; }) });
      var gr = Object.keys(gew.gruppen).map(function (g) { return { name: kurzGruppe(g), wert: gew.gruppen[g] }; }).sort(function (a, b) { return b.wert - a.wert; });
      G.ring(dRing, { titel: 'Netto-Beitrag nach Tarifgruppe', format: U.fmtEuro, mitte: { wert: U.fmtEuro0(gew.netto), label: 'netto' }, teile: gr.map(function (g, i) { return { name: g.name, wert: g.wert, farbe: i < 5 ? G.FARBEN[i] : G.GRAU }; }) });
      var reihe = function (nr) { return z.mass === 'scheiben' ? (scheibe[nr] ? scheibe[nr].zeile.werte : []) : (alle.proAdp[nr] ? alle.proAdp[nr].monate : []); };
      var letzter = -1; nrs.forEach(function (nr) { reihe(nr).forEach(function (v, i) { if (v) letzter = Math.max(letzter, i); }); });
      var schnitt = function (arr) { return U.MONATE.map(function (_, i) { return i >= z.von && i <= Math.min(z.bis, letzter) ? (arr[i] || 0) : null; }); };
      var med = U.MONATE.map(function (_, i) { return i >= z.von && i <= Math.min(z.bis, letzter) ? U.median(nrs.map(function (nr) { return reihe(nr)[i] || 0; })) : null; });
      var gewaehlt = nrs.filter(function (nr) { return z.wahl.has(nr); });
      var bunt = gewaehlt.filter(function (nr) { return z.farben[nr] != null; }), grau = gewaehlt.filter(function (nr) { return z.farben[nr] == null; });
      G.linie(dLin, { titel: 'ADP im Verlauf', kategorien: U.MONATE_KURZ, kategorienLang: U.MONATE, format: U.fmtEuro, hoehe: 250,
        reihen: grau.slice(0, 20).map(function (nr) { return { name: nameVon(p, nr) || nr, farbe: G.GRAU, werte: schnitt(reihe(nr)) }; })
          .concat(bunt.map(function (nr) { return { name: nameVon(p, nr) || nr, farbe: farbe(nr), werte: schnitt(reihe(nr)), stark: true }; }))
          .concat([{ name: 'Median aller ADP', farbe: 'var(--text-3)', strich: true, werte: med }]) });
      G.quer(dQuer, { format: U.fmtEuro0, zeilen: gewaehlt.slice(0, 14).map(function (nr) { var a = alle.proAdp[nr]; return { name: nameVon(p, nr) || nr, wert: wertVon(nr), farbe: farbe(nr), zusatz: a ? a.n + ' Buchungen' : '' }; }) });
    });

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
    zeige: function (el, aktionen, z) { if (App.modus() === 'mgmt') zeigeMgmt(el, aktionen, App.p, z); else zeigeAdp(el, App.p); } };
})(globalThis.AB = globalThis.AB || {});
