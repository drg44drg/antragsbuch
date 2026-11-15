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
      var p = App.p, filter = z.bereich || z.tarif || z.beihilfe ? { bereich: z.bereich || '', tarif: z.tarif || '', beihilfe: z.beihilfe || '' } : null;
      var kz = filter ? AB.kennzahlen.rechne(p, App.erg, App.zeilen, null, filter) : App.kz, mon = z.monat == null ? null : z.monat, k = mon == null ? kz.jahr : kz.monate[mon];
      aktionen.appendChild(D.btn('Neuer Antrag', function () { AB.maske.oeffne(null); }, { klasse: 'haupt-btn', icon: 'plus', taste: 'N' }));
      if (!p.antraege.length && !App.zeilen.length) {
        el.appendChild(h('div.karte.rein', { style: { textAlign: 'center', padding: '50px 20px' } }, h('h2', null, 'Noch keine Anträge'),
          h('p.muted', null, 'Erfassen Sie den ersten Antrag oder ziehen Sie eine Provisionsabrechnung (CSV) ins Fenster.'),
          D.btn('Ersten Antrag erfassen', function () { AB.maske.oeffne(null); }, { klasse: 'haupt-btn', icon: 'plus' })));
        return;
      }
      // Zeitraum
      var wahl = [['j', 'Jahr']].concat(U.MONATE_KURZ.map(function (m, i) { return [String(i), m]; }));
      var tarife = {}; p.antraege.forEach(function (a) { if (!z.bereich || a.bereich === z.bereich) a.positionen.forEach(function (ps) { if (ps.tarif) tarife[ps.tarif] = 1; }); });
      if (kz.erinnerung) el.appendChild(h('div.meldung.warn.rein', { role: 'status' }, h('b', null, 'Erinnerung: '), kz.erinnerung.text + ' Einfach die CSV-Datei ins Fenster ziehen.'));
      el.appendChild(h('div.leiste', null, D.seg(wahl, mon == null ? 'j' : String(mon), function (v) { z.monat = v === 'j' ? null : +v; App.zeige('uebersicht'); }),
        D.auswahl([['', 'Alle Bereiche']].concat(M.BEREICHE.map(function (b) { return [b.id, b.name]; })), z.bereich || '', function (v) { z.bereich = v; z.tarif = ''; App.zeige('uebersicht'); }, { style: { width: '176px' }, title: 'Nach Bereich filtern' }),
        D.auswahl([['', 'Alle Tarife']].concat(Object.keys(tarife).sort(function (a, b) { return a.localeCompare(b, 'de', { numeric: true }); }).map(function (t) { return [t, t]; })), z.tarif || '', function (v) { z.tarif = v; App.zeige('uebersicht'); }, { style: { width: '150px' }, title: 'Nach Tarif filtern' }),
        D.auswahl([['', 'Beihilfe: alle'], ['ja', 'Nur Beihilfe'], ['nein', 'Ohne Beihilfe']], z.beihilfe || '', function (v) { z.beihilfe = v; App.zeige('uebersicht'); }, { style: { width: '142px' }, title: 'Nach Beihilfe filtern' }),
        filter ? D.btn('Filter aufheben', function () { z.bereich = z.tarif = z.beihilfe = ''; App.zeige('uebersicht'); }, { klasse: 'klein-btn leise', icon: 'x' }) : null));
      var th = AB.analyse.heute(U.heute()), tippAus = false; try { tippAus = localStorage.getItem('antragsbuch-tipp-aus') === U.heute(); } catch (e0) { /* privat */ }
      if (!tippAus) {
        var tipp = h('div.tipp.rein', null, D.icon('funke'), h('div', null,
          th.tag ? h('div', null, h('b', null, (th.tag.inTagen === 0 ? 'Heute: ' : th.tag.inTagen === 1 ? 'Morgen: ' : 'In ' + th.tag.inTagen + ' Tagen: ') + th.tag.name), ' – ' + th.tag.idee + '.') : null,
          h('div', null, h('b', null, U.MONATE[+U.heute().slice(5, 7) - 1] + ': ' + th.monat.titel), ' – ' + th.monat.text),
          h('div.muted', null, 'Tipp der Woche: ' + th.woche)),
          D.btn('', function () { try { localStorage.setItem('antragsbuch-tipp-aus', U.heute()); } catch (e1) { /* privat */ } tipp.remove(); }, { icon: 'x', klasse: 'leise klein-btn', titel: 'Für heute ausblenden' }));
        el.appendChild(tipp);
      }
      el.appendChild(h('div.leiste', null, h('div.hinweise', null, App.kz.hinweise.map(function (hw) {
          return h('button.hinweis.' + hw.art, { type: 'button', onclick: function () { App.zeige(hw.ziel, hw.ziel === 'abgleich' ? { reiter: hw.filter } : { spezial: hw.filter }); } }, hw.text);
        }))));
      var titel = (mon == null ? 'im Jahr ' + p.jahr : 'im ' + U.MONATE[mon]) + (filter ? ' · ' + [z.bereich ? M.bereich[z.bereich].kurz : '', z.tarif, z.beihilfe === 'ja' ? 'Beihilfe' : z.beihilfe === 'nein' ? 'ohne Beihilfe' : ''].filter(Boolean).join(' · ') : '');
      var verlauf = function (f) { var w = kz.monate.map(function (m) { return m[f]; }); while (w.length > 2 && !w[w.length - 1]) w.pop(); return w; };
      var gv = M.grundverguetung(p, mon);
      el.appendChild(h('div.raster.r-4', null,
        kachel('Anträge ' + titel, k.antraege, ganz, mon == null ? 'Ø ' + U.fmtZahl(kz.schnitt.antraege, 1) + ' je Monat' : 'Jahr: ' + kz.jahr.antraege, { akzent: true, i: 0, funke: mon == null ? verlauf('antraege') : null, klick: function () { App.zeige('antraege', { monat: mon == null ? '' : String(mon), status: '', spezial: '', ampel: '', bereich: z.bereich || '', tarif: z.tarif || '', beihilfe: z.beihilfe || '' }); } }),
        kachel('Brutto · eingetragen', k.brutto, euro0, k.dynamikAnz ? 'davon aus Dynamik ' + U.fmtEuro0(k.dynamik) + ' (' + U.fmtZahl(k.brutto ? k.dynamik / k.brutto * 100 : 0, 0) + ' %)' : 'alle erfassten Anträge' + (mon == null ? ' · Ø ' + U.fmtEuro0(kz.schnitt.brutto) : ''), { einheit: '€', i: 1 }),
        kachel('Voraussichtlich netto · policiert', k.voraussichtlich, euro0, k.policiertAnz + ' policiert, noch nicht abgerechnet (' + U.fmtEuro0(k.policiert) + ')', { einheit: '€', punkt: 'var(--s3)', i: 2 }),
        kachel('Netto · abgerechnet', k.abgerechnet, euro0, k.abgerechnetAnz + (k.abgerechnetAnz === 1 ? ' Antrag' : ' Anträge') + ' in der Abrechnung', { einheit: '€', punkt: 'var(--good)', i: 3 }),
        kachel('Offen', k.offenAnz, ganz, U.fmtEuro(k.offen) + ' unterwegs · ' + kz.jahr.ampel.rot + ' rot, ' + kz.jahr.ampel.gelb + ' gelb', { punkt: 'var(--s6)', i: 2, klick: function () { App.zeige('antraege', { status: 'offen', monat: mon == null ? '' : String(mon), spezial: '', ampel: '', bereich: z.bereich || '', tarif: z.tarif || '' }); } }),
        kachel('Storno', k.stornoAnz, ganz, U.fmtEuro(k.storno) + ' · Quote ' + U.fmtZahl(k.stornoQuote * 100, 1) + ' %', { punkt: 'var(--crit)', i: 4 }),
        kachel('Provision Ist', k.provIst, euro0, 'Soll ' + U.fmtEuro(k.provSoll), { einheit: '€', i: 5 }),
        kachel('Auszahlung abgerechneter Fälle', gv.summe + k.provIst, euro0, (gv.gesetzt ? 'Fixum ' + U.fmtEuro0(gv.jeMonat) + (gv.monate === 1 ? '' : ' × ' + gv.monate) + ' + abgerechnete Provision ' + U.fmtEuro0(k.provIst) : 'Karrierestufe in den Einstellungen wählen – hier klicken') + (k.provOffen > 0.005 ? ' · voraussichtlich noch ' + U.fmtEuro0(k.provOffen) + ' aus offenen Anträgen' : ''), { einheit: '€', punkt: 'var(--s1)', i: 6, klick: function () { App.zeige('einstellungen'); } })));

      // Diagramme
      var dBalken = h('div'), dRing = h('div'), dLinie = h('div'), dQuer = h('div');
      el.appendChild(h('div.raster.r-21', null,
        h('div.karte.rein', null, h('div.leiste', null, h('h3', null, 'Anträge je Monat nach'), D.seg([['bereich', 'Bereich'], ['status', 'Status']], z.balken || 'bereich', function (v) { z.balken = v; App.zeige('uebersicht'); })), h('div.unter', null, (z.balken === 'status' ? 'nach aktuellem Status' : 'in den Produktfarben') + ' · Klick auf einen Monat filtert die Übersicht'), dBalken),
        h('div.karte.rein', null, h('div.leiste', null, h('h3', null, 'Beitrag nach'), D.seg([['bereich', 'Bereich'], ['kategorie', 'Kategorie']], z.ring || 'bereich', function (v) { z.ring = v; App.zeige('uebersicht'); })),
          h('div.unter', null, titel + ' · Beihilfe: ' + k.beihilfeAnz + (k.beihilfeAnz === 1 ? ' Antrag, ' : ' Anträge, ') + U.fmtEuro(k.beihilfe)), dRing)));
      // Bearbeitung: was wartet am längsten?
      var warte = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '1px' } }), wl = kz.jahr.warten.slice(0, 7);
      wl.forEach(function (w) {
        var a = w.antrag;
        warte.appendChild(h('button.wartezeile', { type: 'button', title: w.ampel.grund, onclick: function () { AB.maske.oeffne(a); } }, AB.ampelPunkt(w.ampel),
          h('span', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, h('b', null, M.vnName(a)), h('small', null, M.bereich[a.bereich].kurz + ' · ' + M.tarife(a) + ' · ' + w.ampel.grund)),
          AB.geld(M.beitrag(a)), h('span.marke-s' + (w.ampel.stufe === 'rot' ? '.krit' : w.ampel.stufe === 'gelb' ? '.warn' : '.gut'), null, w.ampel.wt + ' WT')));
      });
      if (!wl.length) warte.appendChild(h('div.muted.klein', { style: { padding: '14px 4px' } }, 'Nichts wartet – alle Anträge sind policiert oder abgerechnet.'));
      el.appendChild(h('div.raster.r-2', null,
        h('div.karte.rein', null, h('div.leiste', null, h('h3', null, 'Bearbeitung: wartet am längsten'), h('span.frei'),
          kz.jahr.warten.length ? D.btn('Alle ' + kz.jahr.warten.length + ' · auswählen & senden', function () { App.zeige('antraege', { ampel: 'gelbrot', status: '', monat: '', spezial: '', suche: '', bereich: z.bereich || '', tarif: z.tarif || '' }); }, { klasse: 'klein-btn' }) : null),
          h('div.unter', null, 'Ampel nach Werktagen seit Einreichung (WT) · Fristen in den Einstellungen'), warte),
        h('div.karte.rein', null, h('h3', null, z.ring === 'kategorie' ? 'Positionen je Kategorie' : 'Stückzahlen je Bereich'), h('div.unter', null, titel), dQuer)));
      el.appendChild(h('div.karte.rein', null, h('h3', null, 'Provision: Soll und Ist'), h('div.unter', null, 'aufgelaufen nach Eingangsmonat der Anträge'), dLinie));
      requestAnimationFrame(function () {
        var ms = kz.monate;
        G.balken(dBalken, { titel: 'Anträge je Monat', kategorien: U.MONATE_KURZ, kategorienLang: U.MONATE, format: ganz, klick: function (i) { z.monat = z.monat === i ? null : i; App.zeige('uebersicht'); },
          reihen: z.balken !== 'status' ? M.BEREICHE.filter(function (b) { return ms.some(function (m) { return m.bereiche[b.id] && m.bereiche[b.id].stueck; }); }).map(function (b) { return { name: b.kurz, farbe: G.bereichFarbe(b.id), werte: ms.map(function (m) { return m.bereiche[b.id] ? m.bereiche[b.id].stueck : 0; }) }; }) : [{ name: 'Abgerechnet', farbe: G.FARBEN[0], werte: ms.map(function (m) { return m.abgerechnetAnz; }) },
            { name: 'Policiert', farbe: G.FARBEN[2], werte: ms.map(function (m) { return m.policiertAnz; }) },
            { name: 'Eingereicht/Reklamiert', farbe: G.FARBEN[1], werte: ms.map(function (m) { return m.offenAnz - m.policiertAnz; }) },
            { name: 'Storno', farbe: G.FARBEN[4], werte: ms.map(function (m) { return m.stornoAnz; }) },
            { name: 'Abgelehnt/Widerruf/Absage', farbe: G.FARBEN[3], werte: ms.map(function (m) { return m.abgewiesenAnz; }) }] });
        var pname = { pflegepflicht: 'Pflegepflicht (in Voll)', pflegezusatz: 'Pflegezusatz' };
        var bereiche = Object.keys(k.produkt).map(function (id) { return { name: pname[id] || (M.bereich[id] ? M.bereich[id].kurz : id), wert: k.produkt[id].beitrag, stueck: k.produkt[id].stueck, farbe: G.bereichFarbe(id) }; });
        if (!bereiche.length) bereiche = M.BEREICHE.map(function (b, i) { return { name: b.kurz, wert: k.bereiche[b.id].beitrag, stueck: k.bereiche[b.id].stueck, i: i, farbe: G.bereichFarbe(b.id) }; });
        if (z.ring === 'kategorie') bereiche = Object.keys(k.kategorien).map(function (n) { return { name: n, wert: k.kategorien[n].beitrag, stueck: k.kategorien[n].stueck }; });
        var top = bereiche.filter(function (b) { return b.wert > 0; }).sort(function (a, b) { return b.wert - a.wert; });
        G.ring(dRing, { titel: 'Beitrag nach Bereich', format: U.fmtEuro, mitte: { wert: U.fmtEuro0(k.brutto + k.minder), label: 'Beitrag' },
          teile: top.map(function (b, i) { return { name: b.name, wert: b.wert, farbe: b.farbe || (i < 5 ? G.FARBEN[i] : G.GRAU) }; }) });
        var sS = 0, sI = 0, letzter = -1;
        ms.forEach(function (m, i) { if (m.antraege) letzter = i; });
        G.linie(dLinie, { titel: 'Provision Soll und Ist, aufgelaufen', kategorien: U.MONATE_KURZ, kategorienLang: U.MONATE, format: U.fmtEuro,
          reihen: [{ name: 'Ist (abgerechnet)', farbe: G.FARBEN[0], flaeche: true, stark: true, werte: ms.map(function (m, i) { sI += m.provIst; return i <= letzter ? U.runde(sI) : null; }) },
            { name: 'Soll (erwartet)', farbe: G.FARBEN[1], werte: ms.map(function (m, i) { sS += m.provSoll; return i <= letzter ? U.runde(sS) : null; }) }] });
        G.quer(dQuer, { format: ganz, zeilen: bereiche.filter(function (b) { return b.stueck; }).sort(function (a, b) { return b.stueck - a.stueck; }).slice(0, 10)
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
        D.exportBtn('Monatsuebersicht_' + p.jahr, function () { var t = AB.kennzahlen.alsTabelle(kopf, zeilen); [1, 5, 6].forEach(function (c) { t.spalten[c].typ = 'ganz'; }); t.summe = summe;
          return Object.assign({ name: 'Monatsübersicht', titel: 'Monatsübersicht ' + p.jahr + (filter ? ' – ' + titel : ''), unter: AB.ansichten.uebersicht.unter() + ' · Stand ' + U.fmtDatum(U.heute()) }, t); },
          function () { return AB.csv.schreibe(kopf, zeilen.concat([summe])); }, { klasse: 'klein-btn' }),
        D.btn('Drucken', function () { D.drucke('Monatsübersicht ' + p.jahr, AB.ansichten.uebersicht.unter() + ' · Stand ' + U.fmtDatum(U.heute()),
          kopf.map(function (t, i) { return { t: t, r: i > 0 }; }), zeilen.map(function (r) { return r.map(fz); }), summe.map(fz)); }, { klasse: 'klein-btn', icon: 'druck' })),
        h('div', { style: { overflowX: 'auto', marginTop: '8px' } }, h('table.einfach', null, h('thead', null, h('tr', null, kopf.map(function (t, i) { return h('th', { style: i ? { textAlign: 'right' } : null }, t); }))), tb))));
    } };
})(globalThis.AB = globalThis.AB || {});
