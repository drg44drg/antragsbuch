/* Antragsbuch – Unternehmeragentur: Abrechnung zwischen Agenturleiter und Untervermittler.
   Beide Seiten stellen ein, wie gerechnet wird (je Sparte Kranken, Leben, Unfall). Der Untervermittler erzeugt daraus seine
   Abrechnung an die Agentur, der Agenturleiter rechnet aus seiner Sicht nach und vergleicht Buchung für Buchung. */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h, U = AB.util, App = AB.app, G = AB.agentur;
  function kachel(lbl, wert, neben, akzent) { return h('div.karte.kachel.rein' + (akzent ? '.akzent' : ''), null, h('div.lbl', null, lbl), h('div.wert', null, h('span.num', null, wert)), h('div.neben', { title: neben }, neben)); }
  function sichere() { App.geaendert({ still: true, ohneRechnen: true }); }
  function neu() { App.zeige('agentur'); }
  function zahlFeld(obj, key, label, stellen, platz, nachher) {
    var f = h('input', { type: 'text', inputMode: 'decimal', value: obj[key] == null || obj[key] === '' ? '' : U.fmtZahl(+obj[key], stellen), placeholder: platz || '', style: { textAlign: 'right' }, 'aria-label': label,
      onchange: function () { var v = f.value.trim() === '' ? null : U.parseZahl(f.value); if (v != null && (isNaN(v) || v < 0)) { f.classList.add('fehler'); return; } if (App.gesperrt()) return; obj[key] = v; if (nachher) nachher(); sichere(); setTimeout(neu, 0); } });
    return f;
  }

  /** Einstellungen der Abrechnung: Satz der Agentur, je Sparte Art und Wert, Bankgeschäft, laufende Provisionen. */
  function regelKarte(r, titel, unter, nachher) {
    var zeilen = G.SPARTEN.map(function (s) {
      var rg = r[s.id];
      return h('tr', null, h('td', null, h('b', null, s.name)),
        h('td', null, D.auswahl(s.arten, rg.art, function (v) { if (App.gesperrt()) return; rg.art = v; if (nachher) nachher(); sichere(); neu(); })),
        h('td', { style: { width: '130px' } }, zahlFeld(rg, 'wert', 'Satz ' + s.name, 2, rg.art === 'anteil' ? 'z. B. 5,5' : rg.art === 'promille' ? 'z. B. 20' : 'z. B. 80', nachher)),
        h('td.muted.klein', null, rg.art === 'anteil' ? 'MB von ' + U.fmtZahl(r.agMb, 2) + ' MB' : rg.art === 'promille' ? '‰ der Bewertungssumme' : '% der Provision'));
    });
    return h('div', null, h('h4', { style: { margin: '12px 0 4px' } }, titel), unter ? h('div.mini', { style: { marginBottom: '6px' } }, unter) : null,
      h('div.formraster', null, D.feld('Satz der Agentur (MB)', zahlFeld(r, 'agMb', 'Monatsbeiträge der Agentur', 2, '7', nachher), 's2'),
        D.feld('Bankgeschäft', D.auswahl([['', 'anteilig wie Normalgeschäft'], ['fest', 'fester Overhead der Agentur je MB']], r.bank || '', function (v) { if (App.gesperrt()) return; r.bank = v; sichere(); neu(); }), 's3'),
        D.feld('Laufende Provisionen', D.auswahl([['', 'voll an den Untervermittler'], ['anteilig', 'anteilig nach dem Satz der Sparte']], r.laufend || '', function (v) { if (App.gesperrt()) return; r.laufend = v; sichere(); neu(); }), 's3')),
      h('table.einfach', { style: { marginTop: '8px' } }, h('thead', null, h('tr', null, ['Sparte', 'Gerechnet als', 'Satz', ''].map(function (t) { return h('th', null, t); }))), h('tbody', null, zeilen)));
  }
  /** Zeitraum: ganzes Jahr, Quartal oder Monate von–bis. */
  function zeitraum(z) {
    if (z.von == null) { z.von = 0; z.bis = 11; }
    var mOpt = U.MONATE.map(function (m, i) { return [String(i), m]; });
    var q = [['Jahr', 0, 11], ['Q1', 0, 2], ['Q2', 3, 5], ['Q3', 6, 8], ['Q4', 9, 11]];
    return h('div.leiste', null, h('span.klein.muted', null, 'Zeitraum'), q.map(function (x) { var an = z.von === x[1] && z.bis === x[2]; return h('button.chip' + (an ? '.aktiv' : ''), { type: 'button', onclick: function () { z.von = x[1]; z.bis = x[2]; neu(); } }, x[0]); }),
      h('span.klein.muted', null, 'oder von'), D.auswahl(mOpt, String(z.von), function (v) { z.von = +v; if (z.bis < z.von) z.bis = z.von; neu(); }, { style: { width: '124px' } }),
      h('span.klein.muted', null, 'bis'), D.auswahl(mOpt, String(z.bis), function (v) { z.bis = +v; if (z.von > z.bis) z.von = z.bis; neu(); }, { style: { width: '124px' } }));
  }
  function zeitText(z, p) { return z.von === 0 && z.bis === 11 ? 'Jahr ' + p.jahr : z.von === z.bis ? U.MONATE[z.von] + ' ' + p.jahr : U.MONATE[z.von] + ' bis ' + U.MONATE[z.bis] + ' ' + p.jahr; }

  /** Ergebnis: Kacheln, Tabelle je Sparte und je Monat, Export. */
  function ergebnis(el, a, opt) {
    var fehlt = Object.keys(a.fehlt).map(function (s) { return G.SPARTEN.filter(function (x) { return x.id === s; })[0].name; });
    el.appendChild(h('div.raster.r-4', null,
      kachel('Provision lt. Abrechnung', U.fmtEuro0(a.summe.prov), U.fmtZahl(a.summe.n, 0) + ' Buchungen'),
      kachel(opt.anspruchTitel, U.fmtEuro0(a.summe.an), fehlt.length ? 'ohne ' + fehlt.join(', ') + ' (kein Satz)' : 'nach den Einstellungen oben', true),
      kachel('Overhead Agentur', U.fmtEuro0(a.summe.oh), 'Provision minus Anspruch'),
      kachel('Gewertete Produktion', U.fmtEuro0(a.summe.prod), 'Spalte „Produktion“ der Abrechnung')));
    if (fehlt.length) el.appendChild(h('div.meldung.warn', null, 'Für ' + fehlt.join(', ') + ' ist kein Satz eingestellt. Diese Buchungen zählen noch nicht zum Anspruch.'));
    var kopf = ['', 'Provision gebucht', opt.anspruchKurz, 'Overhead Agentur', 'Produktion', 'Buchungen'];
    var zeile = function (n, x) { return [n, x.prov, x.an, x.oh, x.prod, x.n]; };
    var sp = G.SPARTEN.filter(function (s) { return a.sparten[s.id].n; }).map(function (s) { return zeile(s.name, a.sparten[s.id]); });
    var mo = []; for (var m = Math.max(0, a.erster); m <= a.letzter; m++) if (a.monate[m].n) mo.push(zeile(U.MONATE[m], a.monate[m]));
    var summe = zeile('Summe', a.summe);
    var tab = function (titel, zl) {
      var tb = h('tbody'); zl.concat([summe]).forEach(function (r, ri) { var tr = h('tr', ri === zl.length ? { style: { fontWeight: 650 } } : null); r.forEach(function (c, i) { tr.appendChild(h('td' + (i ? '.num' : ''), { style: i ? { textAlign: 'right' } : null }, i === 0 ? c : i === 5 ? U.fmtZahl(c, 0) : U.fmtEuro(c))); }); tb.appendChild(tr); });
      return h('div', { style: { overflowX: 'auto' } }, h('table.einfach', null, h('thead', null, h('tr', null, [titel].concat(kopf.slice(1)).map(function (t, i) { return h('th', { style: i ? { textAlign: 'right' } : null }, t); }))), tb));
    };
    var t = function () { var spalten = [{ t: 'Zeile', b: 16 }, { t: 'Provision gebucht', typ: 'euro', b: 18 }, { t: opt.anspruchKurz, typ: 'euro', b: 20 }, { t: 'Overhead Agentur', typ: 'euro', b: 18 }, { t: 'Produktion', typ: 'euro', b: 14 }, { t: 'Buchungen', typ: 'ganz', b: 11 }];
      return { name: 'Abrechnung', titel: opt.titel, unter: opt.unter, spalten: spalten, zeilen: sp.concat([['', '', '', '', '', '']], mo), summe: summe }; };
    el.appendChild(h('div.karte.rein', null, h('div.leiste', null, h('h3', null, opt.titel), h('span.muted.klein', null, opt.quelle), h('span.frei'), opt.knoepfe || null,
        D.exportBtn(opt.datei, t, null, { klasse: 'klein-btn' }),
        D.btn('Drucken', function () { var x = t(); D.drucke(x.titel, x.unter, x.spalten.map(function (c, i) { return { t: c.t, r: i > 0 }; }), x.zeilen.concat([x.summe]).map(function (r) { return r.map(function (c, i) { return i && typeof c === 'number' ? (i === 5 ? U.fmtZahl(c, 0) : U.fmtEuro(c)) : c; }); })); }, { klasse: 'klein-btn', icon: 'druck' })),
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px', marginTop: '8px' } }, tab('Sparte', sp), tab('Monat', mo)),
      opt.fuss || null));
  }
  function stufenText(ns, wer) {
    if (!ns) return null;
    return h('div.meldung', null, h('b', null, 'Nächste Stufe ' + ns.stufe.id + ' (' + U.fmtZahl(ns.stufe.mb, 1) + ' MB, ab ' + U.fmtZahl(ns.ab, 0) + ' € Produktion): '),
      'Im selben Zeitraum ' + (wer || '') + U.fmtEuro0(ns.provision) + ' mehr Provision' + (ns.gp ? ' und ' + U.fmtEuro0(ns.gp) + ' mehr Grundpauschale (' + ns.monate + ' Monate)' : '') + '.');
  }
  function stufenAuswahl(obj, r) {
    return D.auswahl([['', 'frei eingestellt']].concat(G.MODELL.map(function (m) { return [m.id, m.id + ' · ' + U.fmtZahl(m.mb, 1) + ' MB · GP ' + U.fmtZahl(m.gp, 0) + ' €']; })), obj.stufe || '', function (v) {
      if (App.gesperrt()) return; var m = G.stufe(v); obj.stufe = v; if (m) { r.kv.art = 'anteil'; r.kv.wert = m.mb; obj.gp = m.gp; obj.gpSdk = m.gpSdk; } sichere(); neu(); });
  }

  // ---------- Untervermittler: meine Abrechnung an die Agentur ----------
  function zeigeUv(el, aktionen, z, p, e) {
    var r = e.eigen = G.regeln(e.eigen), ich = e.ich || (e.ich = {});
    var opt = { jahr: p.jahr, von: z.von, bis: z.bis };
    el.appendChild(h('div.karte.rein', null, h('h3', null, 'So rechne ich mit der Agentur ab'),
      h('div.unter', null, 'Grundlage ist Ihre Provisionsabrechnung. Stellen Sie ein, was Sie je Sparte beanspruchen. Die App rechnet jede Buchung und erzeugt die Abrechnung für die Agentur.'),
      h('div.formraster', { style: { marginTop: '10px' } }, D.feld('Meine Stufe im Agenturmodell', stufenAuswahl(ich, r), 's4'), D.feld('Grundpauschale (je Monat)', zahlFeld(ich, 'gp', 'Grundpauschale je Monat', 0, 'z. B. 2.250'), 's3')),
      regelKarte(r, 'Was ich beanspruche', 'Bei „MB vom Satz der Agentur“ steht in Ihrer Abrechnung die Provision zum Satz der Agentur. Ihr Anteil ist Ihr Satz geteilt durch den Satz der Agentur.')));
    el.appendChild(zeitraum(z));
    if (!App.zeilen.length) { el.appendChild(h('div.meldung', null, 'Lesen Sie Ihre Provisionsabrechnung ein (Einlesen → Provisionsabrechnung). Dann erscheint hier Ihre Abrechnung an die Agentur.')); return; }
    var a = G.abrechnung(App.zeilen, r, opt), gpSumme = ich.gp ? ich.gp * a.monateMitDaten : 0;
    var unter = 'Untervermittler ' + (p.einstellungen.vermittlernummer || '') + (p.einstellungen.name ? ' · ' + p.einstellungen.name : '') + ' · ' + zeitText(z, p) + ' · erstellt ' + U.fmtDatum(U.heute());
    ergebnis(el, a, { anspruchTitel: 'Mein Anspruch', anspruchKurz: 'Mein Anspruch', titel: 'Abrechnung an die Agentur', unter: unter, quelle: zeitText(z, p), datei: 'Abrechnung_Agentur_' + (p.einstellungen.vermittlernummer || '') + '_' + p.jahr,
      knoepfe: D.btn('Datei für die Agentur', function () {
        if (!p.einstellungen.vermittlernummer) { D.toast('Bitte zuerst Ihre Vermittlernummer in den Einstellungen eintragen.', { krit: true }); return; }
        D.lade('Agenturabrechnung_' + p.einstellungen.vermittlernummer + '_' + p.jahr + '_' + (z.von + 1) + '-' + (z.bis + 1) + '.json', JSON.stringify(G.erzeugeAbrechnung(p, a, r, opt)), 'application/json');
        D.toast('Datei gespeichert. Senden Sie sie an Ihre Agentur, dort wird sie Buchung für Buchung geprüft.');
      }, { klasse: 'klein-btn haupt-btn', icon: 'runter', titel: 'Abrechnungsdatei mit allen Buchungen und Ihrem Anspruch für die Agentur' }),
      fuss: gpSumme ? h('p', { style: { margin: '10px 0 0' } }, 'Dazu Grundpauschale: ' + a.monateMitDaten + ' Monate × ' + U.fmtEuro0(ich.gp) + ' = ', h('b', null, U.fmtEuro0(gpSumme)), '. Gesamt ', h('b', null, U.fmtEuro0(a.summe.an + gpSumme)), '.') : null });
    if (ich.stufe) el.appendChild(stufenText(G.naechsteStufe(App.zeilen, r, opt, ich.stufe), 'hätten Sie '));
  }

  // ---------- Agenturleiter: je Untervermittler ----------
  function zeigeAgentur(el, aktionen, z, p, e) {
    var ein = p.agenturEingang || (p.agenturEingang = {}), abr = p.agenturAbr || (p.agenturAbr = {});
    var nrn = Object.keys(e.untervermittler).concat(Object.keys(ein), Object.keys(abr)).filter(function (n, i, a) { return n && a.indexOf(n) === i; }).sort();
    if (!nrn.length) { el.appendChild(h('div.karte.rein', { style: { textAlign: 'center', padding: '46px 20px' } }, h('h2', null, 'Noch kein Untervermittler angelegt'),
      h('p.muted', { style: { maxWidth: '640px', margin: '8px auto 14px' } }, 'Legen Sie Untervermittler unter Einstellungen → Unternehmeragentur an oder lesen Sie eine Abrechnung des Versicherers für Ihren Untervermittler ein. Steht der Untervermittler in Ihrer eigenen Abrechnung als Beteiligter, genügt die Nummer.'),
      D.btn('Datei einlesen', function () { App.einleseDialog(); }, { klasse: 'haupt-btn', icon: 'hoch' }))); return; }
    var nr = nrn.indexOf(z.nr) >= 0 ? z.nr : nrn[0], datei = ein[nr] || null, ab = abr[nr] || null;
    var uv = e.untervermittler[nr] || (e.untervermittler[nr] = { name: (datei && datei.name) || '' });
    // Übernahme älterer Einstellungen (ein Satz für alles)
    if (!uv.regeln) uv.regeln = { agMb: e.agMb, kv: { art: 'anteil', wert: uv.mb != null ? uv.mb : null }, bank: uv.bank || '', laufend: uv.laufend || '' };
    var r = uv.regeln = G.regeln(uv.regeln);
    if (!App.agenturZeilen) App.agenturZeilen = {};
    var quelle, zeilen;
    if (ab) { zeilen = App.agenturZeilen[nr] && App.agenturZeilen[nr].ref === ab.gepackt ? App.agenturZeilen[nr].z : (App.agenturZeilen[nr] = { ref: ab.gepackt, z: AB.abrechnung.entpacke(ab.gepackt) }).z; quelle = 'aus der Abrechnung des Untervermittlers („' + ab.datei + '“)'; }
    else { zeilen = G.zeilenFuer(App.zeilen, nr); quelle = 'aus meiner Abrechnung, Buchungen mit Beteiligung ' + nr; }
    var fName = h('input', { type: 'text', value: uv.name || '', placeholder: 'Name', 'aria-label': 'Name des Untervermittlers', onchange: function () { if (App.gesperrt()) return; uv.name = fName.value.trim(); sichere(); } });
    var unterMin = (r.kv.art === 'anteil' && r.kv.wert != null && r.kv.wert < G.MIN.mb) || (uv.gp != null && uv.gp < G.MIN.gp);
    el.appendChild(h('div.karte.rein', null, h('div.leiste', null, h('h3', null, 'Untervermittler'), nrn.map(function (n) { return h('button.chip' + (n === nr ? '.aktiv' : ''), { type: 'button', onclick: function () { z.nr = n; neu(); } }, n + ((e.untervermittler[n] || {}).name ? ' · ' + e.untervermittler[n].name : '')); }), h('span.frei'),
        D.btn('', function () { D.frage('Untervermittler entfernen?', 'Abrechnung, Datei und Einstellungen zu ' + nr + ' werden aus dem Projekt entfernt.', 'Entfernen', { gefahr: true }).then(function (ja) { if (!ja || App.gesperrt()) return; delete ein[nr]; delete abr[nr]; delete e.untervermittler[nr]; App.geaendert({ ohneRechnen: true }); neu(); }); }, { icon: 'muell', klasse: 'leise gefahr', titel: 'Untervermittler mit seinen Dateien entfernen' })),
      h('div.formraster', { style: { marginTop: '10px' } }, D.feld('Name', fName, 's3'), D.feld('Stufe im Agenturmodell', stufenAuswahl(uv, r), 's3'),
        D.feld('Grundpauschale an ihn', zahlFeld(uv, 'gp', 'Grundpauschale an den Untervermittler', 0, 'je Monat'), 's2'),
        D.feld('Grundpauschale vom Versicherer', zahlFeld(uv, 'gpSdk', 'Grundpauschale des Versicherers für den Untervermittler', 0, 'je Monat'), 's2'),
        D.feld('Tätigkeitsbeginn', h('input', { type: 'date', value: uv.beginn || '', 'aria-label': 'Tätigkeitsbeginn des Untervermittlers', onchange: function () { if (App.gesperrt()) return; uv.beginn = this.value; sichere(); neu(); } }), 's2')),
      regelKarte(r, 'Was dem Untervermittler zusteht', null),
      unterMin ? h('div.meldung.warn', { style: { marginTop: '8px' } }, 'Laut Agenturmodell müssen mindestens ' + U.fmtZahl(G.MIN.gp, 0) + ' € Grundpauschale und ' + G.MIN.mb + ' MB weitergegeben werden.') : null));
    el.appendChild(zeitraum(z));
    var opt = { jahr: p.jahr, von: z.von, bis: z.bis };
    if (!zeilen.length) el.appendChild(h('div.meldung', null, ab ? 'Im gewählten Jahr enthält die Abrechnung des Untervermittlers keine Buchungen.' : 'In Ihrer Abrechnung gibt es keine Buchungen mit Beteiligung ' + nr + '. Lesen Sie die Abrechnung des Versicherers für ihn ein (Einlesen → Abrechnung eines Untervermittlers).'));
    else {
      var a = G.abrechnung(zeilen, r, opt), mon = a.monateMitDaten, gpW = uv.gp ? uv.gp * mon : 0, gpS = uv.gpSdk ? uv.gpSdk * mon : 0;
      var kv = AB.team.nettoproduktion(zeilen, p.jahr).kv, ph = G.gpPhase(uv.beginn, U.heute(), kv);
      ergebnis(el, a, { anspruchTitel: 'Anspruch Untervermittler', anspruchKurz: 'Anspruch Untervermittler', titel: 'Abrechnung mit ' + nr + (uv.name ? ' · ' + uv.name : ''), quelle: quelle,
        unter: 'Untervermittler ' + nr + (uv.name ? ' · ' + uv.name : '') + ' · ' + zeitText(z, p) + ' · Stand ' + U.fmtDatum(U.heute()), datei: 'Agenturabrechnung_' + nr + '_' + p.jahr,
        fuss: h('div', null,
          gpW || gpS ? h('p', { style: { margin: '10px 0 0' } }, 'Grundpauschale für ' + mon + ' Monate: vom Versicherer ' + U.fmtEuro0(gpS) + ', an den Untervermittler ' + U.fmtEuro0(gpW) + ', bei der Agentur bleiben ', h('b', null, U.fmtEuro0(gpS - gpW)), '.') : null,
          ph ? h('div.mini', { style: { marginTop: '6px' } }, ph.phase === 'anlauf' ? 'Anlaufzeit bis ' + U.fmtDatum(ph.anlaufBis) + (ph.einarbeitung ? ', Einarbeitungspauschale bis ' + U.fmtDatum(ph.einarbeitungBis) : '') + '.' + (ph.frueherStaffel ? ' Mit ' + U.fmtEuro0(kv) + ' Netto-KV-Eigenproduktion wäre die Staffel mit ' + U.fmtEuro0(ph.frueherStaffel) + ' im Monat möglich.' : '') : 'Staffel: bei ' + U.fmtEuro0(kv) + ' Netto-KV-Eigenproduktion ' + (ph.gp ? U.fmtEuro0(ph.gp) + ' im Monat.' : 'keine Grundvergütung.')) : null,
          h('p.mini', null, 'Je Buchung: Bei „MB vom Satz der Agentur“ steht dem Untervermittler der Anteil Satz ÷ Satz der Agentur zu. „Fester Overhead“ beim Bankgeschäft: Die Agentur behält je Buchung die Differenz der MB. Stornos mindern den Anspruch im selben Verhältnis. Maßgeblich ist der Vertrag zwischen Agentur und Untervermittler.')) });
      if (uv.stufe) el.appendChild(stufenText(G.naechsteStufe(zeilen, r, opt, uv.stufe), 'hätte der Untervermittler '));
      if (datei && G.istAbrechnungsdatei(datei)) pruefeAbrechnung(el, p, nr, datei, G.abrechnung(zeilen, r, { jahr: p.jahr, von: datei.zeitraum ? datei.zeitraum.von : 0, bis: datei.zeitraum ? datei.zeitraum.bis : 11 }), z);
    }
    if (datei && !G.istAbrechnungsdatei(datei)) pruefePosten(el, p, nr, datei, zeilen.length ? zeilen : App.zeilen, r, z);
    if (!datei) el.appendChild(h('div.mini', null, 'Eine Abrechnungsdatei des Untervermittlers liegt nicht vor. Er erzeugt sie in seinem Antragsbuch im Reiter „Agentur“ (Rolle Untervermittler). Lesen Sie sie über Einlesen ein, dann prüft die App jede Buchung gegen Ihre Rechnung.'));
  }

  /** Abrechnungsdatei des Untervermittlers Buchung für Buchung gegen die eigene Rechnung. */
  function pruefeAbrechnung(el, p, nr, datei, eigen, z) {
    var v = G.vergleicheAbrechnung(datei, eigen), g = v.summe.gesamt || { gefordert: 0, anspruch: 0, differenz: 0 };
    var zr = datei.zeitraum ? (datei.zeitraum.von === 0 && datei.zeitraum.bis === 11 ? 'Jahr' : U.MONATE[datei.zeitraum.von] + ' bis ' + U.MONATE[datei.zeitraum.bis]) : 'Jahr';
    el.appendChild(h('div.karte.rein', null, h('div.leiste', null, h('h3', null, 'Abrechnung des Untervermittlers prüfen'), h('span.muted.klein', null, 'Datei vom ' + U.fmtDatum((datei.erstellt || '').slice(0, 10)) + ' · ' + zr + ' ' + datei.jahr), h('span.frei'),
        D.btn('', function () { D.frage('Datei entfernen?', 'Die Abrechnungsdatei von ' + nr + ' wird aus dem Projekt entfernt.', 'Entfernen', { gefahr: true }).then(function (ja) { if (!ja || App.gesperrt()) return; delete p.agenturEingang[nr]; App.geaendert({ ohneRechnen: true }); neu(); }); }, { icon: 'muell', klasse: 'leise gefahr', titel: 'Datei entfernen' })),
      h('div.raster.r-4', { style: { marginTop: '8px' } },
        kachel('Gefordert', U.fmtEuro0(g.gefordert), datei.zeilen.length + ' Buchungen in der Datei'), kachel('Anspruch nach meiner Rechnung', U.fmtEuro0(g.anspruch), 'gleiche Buchungen'),
        kachel('Differenz', U.fmtEuro0(g.differenz), Math.abs(g.differenz) <= 0.5 ? 'passt' : g.differenz > 0 ? 'mehr gefordert' : 'weniger gefordert'),
        kachel('Ergebnis', v.anzahl.ok + ' stimmen', v.anzahl.abweichung + ' Abweichung · ' + v.anzahl.fehlt + ' nicht bei mir · ' + v.anzahl.nichtGefordert + ' nicht gefordert' + (v.anzahl.offen ? ' · ' + v.anzahl.offen + ' ohne Satz' : ''))),
      h('table.einfach', { style: { marginTop: '10px' } }, h('thead', null, h('tr', null, ['Sparte', 'Gefordert', 'Anspruch', 'Differenz', 'Regel des Untervermittlers'].map(function (t, i) { return h('th', { style: i && i < 4 ? { textAlign: 'right' } : null }, t); }))),
        h('tbody', null, G.SPARTEN.filter(function (s) { return v.summe[s.id]; }).map(function (s) { var x = v.summe[s.id], rg = datei.regeln && datei.regeln[s.id];
          return h('tr', null, h('td', null, s.name), h('td.num', { style: { textAlign: 'right' } }, U.fmtEuro(x.gefordert)), h('td.num', { style: { textAlign: 'right' } }, U.fmtEuro(x.anspruch)), h('td.num', { style: { textAlign: 'right', color: Math.abs(x.differenz) > 0.5 ? 'var(--crit-ink)' : null } }, U.fmtEuro(x.differenz)),
            h('td.muted.klein', null, rg && rg.wert != null ? U.fmtZahl(rg.wert, 2) + ' ' + (rg.art === 'anteil' ? 'MB von ' + U.fmtZahl(datei.regeln.agMb, 2) : rg.art === 'promille' ? '‰' : '%') : 'kein Satz')); })))));
    var filter = D.auswahl([['', 'Alle Buchungen'], ['abweichung', 'Abweichung'], ['fehlt', 'Nicht in meiner Abrechnung'], ['nichtGefordert', 'Nicht gefordert'], ['offen', 'Kein Satz'], ['ok', 'Stimmt überein']], z.filterAbr || 'abweichung', function (w) { z.filterAbr = w; setze(); }, { style: { width: '260px' } });
    var tz = function () { return { name: 'Prüfung', titel: 'Prüfung der Abrechnung von ' + nr, unter: zr + ' ' + datei.jahr + ' · geprüft am ' + U.fmtDatum(U.heute()),
      spalten: [{ t: 'Buchungsdatum', typ: 'datum', b: 13 }, { t: 'Vertragsnummer', b: 15 }, { t: 'Tarif', b: 12 }, { t: 'Sparte', b: 10 }, { t: 'Provision gebucht', typ: 'euro', b: 16 }, { t: 'Gefordert', typ: 'euro', b: 13 }, { t: 'Anspruch', typ: 'euro', b: 13 }, { t: 'Differenz', typ: 'euro', b: 12 }, { t: 'Ergebnis', b: 24 }],
      zeilen: v.zeilen.map(function (x) { return [U.fmtDatum(x.bdat), x.vnr, x.tarif, x.sparte.toUpperCase(), x.prov, x.gefordert, x.anspruch == null ? '' : x.anspruch, x.differenz == null ? '' : x.differenz, G.URTEIL_ABR[x.urteil]]; }),
      farbe: function (w, r, c) { return c !== 8 ? null : /^stimmt/.test(w[8]) ? 'gut' : /^Abweichung/.test(w[8]) ? 'krit' : 'warn'; } }; };
    el.appendChild(h('div.leiste', null, filter, h('span.frei'), D.exportBtn('Pruefung_' + nr + '_' + datei.jahr, tz, null, { klasse: 'klein-btn' })));
    var box = h('div', { style: { height: '420px', display: 'flex', flex: 'none' } }); el.appendChild(box);
    var marke = { ok: '.gut', abweichung: '.krit', fehlt: '.warn', offen: '.warn', nichtGefordert: '.warn' };
    var tab = AB.tabelle(box, { hoehe: 46, leer: 'Keine Buchungen mit diesem Ergebnis.', spalten: [
      { t: 'Gebucht', b: '100px', w: function (x) { return U.fmtDatum(x.bdat); }, s: function (x) { return x.bdat; } },
      { t: 'Vertrag · Tarif', b: 'minmax(150px, 1fr)', k: 'zwei', w: function (x) { return [h('span', null, x.vnr || '–'), h('small', null, x.tarif + ' · ' + x.sparte.toUpperCase())]; }, s: function (x) { return x.vnr; } },
      { t: 'Gebucht', b: '110px', r: true, w: function (x) { return U.fmtEuro(x.prov); }, s: function (x) { return x.prov; } },
      { t: 'Gefordert', b: '110px', r: true, w: function (x) { return U.fmtEuro(x.gefordert); }, s: function (x) { return x.gefordert; } },
      { t: 'Anspruch', b: '110px', r: true, w: function (x) { return x.anspruch == null ? '–' : U.fmtEuro(x.anspruch); }, s: function (x) { return x.anspruch || 0; } },
      { t: 'Differenz', b: '100px', r: true, w: function (x) { return x.differenz == null ? '–' : h('span.num', { style: Math.abs(x.differenz) > 0.02 ? { color: 'var(--crit-ink)', fontWeight: 650 } : null }, U.fmtEuro(x.differenz)); }, s: function (x) { return x.differenz || 0; } },
      { t: 'Ergebnis', b: '200px', w: function (x) { return h('span.marke-s' + marke[x.urteil], null, G.URTEIL_ABR[x.urteil]); }, s: function (x) { return x.urteil; } }] });
    function setze() { tab.setze(v.zeilen.filter(function (x) { return !(z.filterAbr || 'abweichung') || x.urteil === (z.filterAbr || 'abweichung'); })); }
    if (z.filterAbr === undefined && !v.anzahl.abweichung) z.filterAbr = '';
    filter.value = z.filterAbr == null ? 'abweichung' : z.filterAbr;
    setze();
  }

  /** Ältere Prüfdatei (ausgewählte Anträge mit geforderter Provision) gegen die Abrechnung. Satz aus der Kranken-Regel. */
  function pruefePosten(el, p, nr, datei, zeilen, r, z) {
    var kv = r.kv, anspruch = kv.wert == null ? null : kv.art === 'anteil' ? { art: 'prozent', wert: Math.min(1, kv.wert / (r.agMb || G.AGENTUR_MB)) * 100 } : { art: 'prozent', wert: kv.wert };
    var erg = G.pruefe(datei, zeilen, anspruch), s = erg.summe;
    el.appendChild(h('div.karte.rein', null, h('div.leiste', null, h('h3', null, 'Prüfdatei mit Anträgen'), h('span.muted.klein', null, 'vom ' + U.fmtDatum((datei.erstellt || '').slice(0, 10)) + ' · ' + datei.posten.length + ' Posten · Satz aus der Kranken-Regel'), h('span.frei'),
        D.btn('', function () { D.frage('Prüfdatei entfernen?', 'Die Prüfdatei von ' + nr + ' wird aus dem Projekt entfernt.', 'Entfernen', { gefahr: true }).then(function (ja) { if (!ja || App.gesperrt()) return; delete p.agenturEingang[nr]; App.geaendert({ ohneRechnen: true }); neu(); }); }, { icon: 'muell', klasse: 'leise gefahr', titel: 'Prüfdatei entfernen' })),
      h('div.raster.r-4', { style: { marginTop: '8px' } },
        kachel('Gefordert', U.fmtEuro0(s.gefordert), datei.posten.length + ' Posten'), kachel('Anspruch laut Abrechnung', U.fmtEuro0(s.anspruch), anspruch ? 'für die gefundenen Posten' : 'Kranken-Satz fehlt'),
        kachel('Differenz', U.fmtEuro0(s.differenz), s.differenz > 0.5 ? 'mehr gefordert' : s.differenz < -0.5 ? 'weniger gefordert' : 'passt'),
        kachel('Ergebnis', s.ok + ' von ' + datei.posten.length, s.abweichung + ' Abweichung · ' + s.fehlt + ' nicht in der Abrechnung' + (s.ohneNr ? ' · ' + s.ohneNr + ' ohne Nummer' : '')))));
    var name = 'Agenturpruefung_' + nr + '_' + p.jahr;
    el.appendChild(h('div.leiste', null, h('span.frei'), D.exportBtn(name, function () { return Object.assign({ name: 'Prüfung', titel: 'Prüfung der Abrechnung ' + p.jahr, unter: 'Untervermittler ' + nr + ' · geprüft am ' + U.fmtDatum(U.heute()) }, G.tabelle(erg)); }, null, { klasse: 'klein-btn' })));
    var box = h('div', { style: { height: Math.min(520, 110 + erg.zeilen.length * 50) + 'px', display: 'flex', flex: 'none' } }); el.appendChild(box);
    var marke = { ok: '.gut', abweichung: '.krit', fehlt: '.warn', ohneNr: '.warn' };
    AB.tabelle(box, { hoehe: 50, leer: 'Keine Posten.', spalten: [
      { t: 'Pos.', b: '50px', r: true, w: function (x) { return h('span.num.muted', null, x.pos || ''); }, s: function (x) { return +x.pos || 0; } },
      { t: 'Kunde · Vertrag', b: 'minmax(160px, 1.4fr)', k: 'zwei', w: function (x) { return [h('span', { style: { fontWeight: 600 } }, x.kunde || '–'), h('small', null, (x.vnr || 'ohne Vertragsnummer') + ' · ' + x.tarife)]; }, s: function (x) { return x.kunde; } },
      { t: 'In der Abrechnung', b: '128px', k: 'zwei', w: function (x) { return [h('span.marke-s' + (x.inAbrechnung ? '.gut' : '.warn'), null, x.inAbrechnung ? 'ja' : 'nein'), h('small', null, x.inAbrechnung ? 'gebucht ' + U.fmtDatum(x.gebuchtAm) : '')]; }, s: function (x) { return x.inAbrechnung ? 1 : 0; } },
      { t: 'Gefordert', b: '104px', r: true, w: function (x) { return U.fmtEuro(x.gefordert); }, s: function (x) { return x.gefordert; } },
      { t: 'Anspruch', b: '104px', r: true, w: function (x) { return x.anspruch == null ? '–' : U.fmtEuro(x.anspruch); }, s: function (x) { return x.anspruch || 0; } },
      { t: 'Differenz', b: '104px', r: true, w: function (x) { return x.differenz == null ? '–' : U.fmtEuro(x.differenz); }, s: function (x) { return x.differenz || 0; } },
      { t: 'Ergebnis', b: '190px', w: function (x) { return h('span.marke-s' + marke[x.urteil], null, G.URTEIL[x.urteil]); }, s: function (x) { return x.urteil; } }] }).setze(erg.zeilen);
  }

  AB.ansichten.agentur = { titel: 'Agentur', icon: 'team',
    unter: function () { return G.einstellung(App.p).modus === 'untervermittler' ? 'Meine Abrechnung an die Agentur ' + App.p.jahr : 'Abrechnung mit den Untervermittlern ' + App.p.jahr; },
    sichtbar: function () { var m = App.p && G.einstellung(App.p).modus; return m === 'agenturist' || m === 'untervermittler'; },
    zeige: function (el, aktionen, z) {
      var p = App.p, e = G.einstellung(p);
      aktionen.appendChild(D.btn('Datei einlesen', function () { App.einleseDialog(); }, { klasse: 'haupt-btn', icon: 'hoch' }));
      if (e.modus === 'untervermittler') zeigeUv(el, aktionen, z, p, e); else zeigeAgentur(el, aktionen, z, p, e);
    } };
})(globalThis.AB = globalThis.AB || {});
