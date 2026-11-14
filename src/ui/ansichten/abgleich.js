/* Antragsbuch – Abgleich: Import per Ablage, fünf Ergebnislisten als Reiter. */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h, U = AB.util, M = AB.model, App = AB.app;
  var REITER = [['gleich', 'Gleich'], ['abweichung', 'Abweichung'], ['offen', 'Offen'], ['neu', 'Neu ohne Antrag'], ['storno', 'Storno']];

  /** Einzelbuchungen eines oder mehrerer Bündel anzeigen. */
  AB.zeigeBuchungen = function (titel, buendel) {
    var d = D.dialog(titel, { klasse: 'mittel' }), tb = h('tbody'), sB = 0, sP = 0;
    buendel.forEach(function (b) { b.zeilen.forEach(function (z) {
      sB += z.mbd; sP += z.prov;
      tb.appendChild(h('tr', null, h('td', null, U.fmtDatum(z.bdat)), h('td', null, z.vnr), h('td', null, z.pnr), h('td', null, z.vpName || z.vnName || ''), h('td', null, z.tarif),
        h('td.num', { style: { textAlign: 'right' } }, U.fmtEuro(z.mbd)), h('td.num', { style: { textAlign: 'right' } }, U.fmtEuro(z.prov)),
        h('td', null, z.part + (z.st ? ' · X' : '')), h('td', null, z.stgrund || (z.shEnde ? 'Haftung bis ' + U.fmtDatum(z.shEnde) : ''))));
    }); });
    tb.appendChild(h('tr', { style: { fontWeight: 650 } }, h('td', { colSpan: 5 }, 'Summe'), h('td.num', { style: { textAlign: 'right' } }, U.fmtEuro(sB)), h('td.num', { style: { textAlign: 'right' } }, U.fmtEuro(sP)), h('td'), h('td')));
    d.rumpf.appendChild(h('table.einfach', null, h('thead', null, h('tr', null, ['Buchung', 'Vertrag', 'Pers.', 'Person', 'Tarif', 'Beitragsdiff.', 'Provision', 'Art', 'Hinweis'].map(function (t) { return h('th', null, t); }))), tb));
    d.fuss.appendChild(h('span', { style: { flex: 1 } })); d.fuss.appendChild(D.btn('Schließen', d.zu, { klasse: 'haupt-btn' }));
  };

  function waehleAntrag(buendel) {
    var p = App.p, d = D.dialog('Buchung einem Antrag zuordnen', { klasse: 'mittel' });
    var q = h('input', { type: 'search', placeholder: 'Antrag suchen …', oninput: zeichne }), liste = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', minHeight: '240px' } });
    function zeichne() {
      var w = U.falte(q.value).split(/\s+/).filter(Boolean);
      D.leere(liste);
      p.antraege.filter(function (a) { var t = M.suchtext(a); return w.every(function (x) { return t.indexOf(x) >= 0; }); }).slice(0, 40).forEach(function (a) {
        liste.appendChild(h('button.wahl', { type: 'button', style: { padding: '9px 14px' }, onclick: function () {
          buendel.forEach(function (b) { p.zuordnungen[b.key] = a.id; delete p.ignoriert[b.key]; });
          if (!U.normVnr(a.vertragsnummer)) a.vertragsnummer = buendel[0].vnr;
          d.zu(); App.geaendert(); D.toast('Zugeordnet zu ' + M.vnName(a) + '.');
        } }, h('div', { style: { flex: 1 } }, h('b', null, M.vnName(a)), h('span', null, U.fmtDatum(a.eingang) + ' · ' + M.name('bereich', a.bereich) + ' · ' + M.name('vorgang', a.vorgang) + ' · ' + (a.vertragsnummer || 'ohne Vertragsnr.'))), AB.geld(M.beitrag(a))));
      });
      if (!liste.firstChild) liste.appendChild(h('div.muted', null, 'Kein Antrag gefunden.'));
    }
    D.anhaengen(d.rumpf, [h('div.muted.klein', null, 'Vertrag ' + buendel[0].vnr + ' · ' + U.fmtEuro(buendel.reduce(function (s, b) { return s + b.mbd; }, 0)) + ' Beitragsdifferenz. Die Zuordnung bleibt über spätere Importe erhalten.'), q, liste]);
    q.value = buendel[0].vnName ? buendel[0].vnName.split(',')[0] : ''; zeichne(); q.focus();
  }

  AB.ansichten.abgleich = { titel: 'Abgleich', icon: 'abgleich', fest: true,
    unter: function () { var i = App.p.importe.filter(function (x) { return x.typ === 'Abrechnung'; }).pop(); return i ? 'Abrechnungsstand: „' + i.datei + '" vom ' + new Date(i.datum).toLocaleString('de-DE') : 'Noch keine Abrechnung eingelesen'; },
    zeige: function (el, aktionen, z) {
      var p = App.p, erg = App.erg, e = p.einstellungen;
      var imp = p.importe.filter(function (x) { return x.typ === 'Abrechnung'; }), letzter = imp[imp.length - 1];
      var wahl = h('input', { type: 'file', hidden: true, accept: '.csv,.txt,.xlsx,.xlsm', onchange: function () { App.importiere(Array.from(wahl.files)); wahl.value = ''; } });
      function historie() {
        var d = D.dialog('Importhistorie', { klasse: 'mittel' }), tb = h('tbody');
        p.importe.slice().reverse().forEach(function (i) {
          tb.appendChild(h('tr', null, h('td', null, new Date(i.datum).toLocaleString('de-DE')), h('td', null, i.typ), h('td', null, i.datei), h('td.num', { style: { textAlign: 'right' } }, U.fmtZahl(i.zeilen, 0)),
            h('td.num', { style: { textAlign: 'right' } }, i.provisionssumme != null ? U.fmtEuro(i.provisionssumme) : ''), h('td.num', { style: { textAlign: 'right' } }, i.neu != null ? U.fmtZahl(i.neu, 0) : ''), h('td.num', { style: { textAlign: 'right' } }, i.entfallen || '')));
        });
        d.rumpf.appendChild(h('table.einfach', null, h('thead', null, h('tr', null, ['Datum', 'Art', 'Datei', 'Zeilen', 'Provisionssumme', 'Neu', 'Entfallen'].map(function (t) { return h('th', null, t); }))), tb));
        d.rumpf.appendChild(h('p.mini', null, 'Die Abrechnung ist kumuliert seit Jahresbeginn: Jeder Import ersetzt den Stand des Jahres. „Neu" zählt die Buchungen, die im vorherigen Import noch nicht enthalten waren.'));
      }
      if (!letzter) {
        el.appendChild(h('div.ablage.gross.rein', null, wahl, D.icon('hoch'), h('h2', null, 'Provisionsabrechnung hier ablegen'),
          h('p.muted', { style: { maxWidth: '560px', margin: 0 } }, 'Die CSV-Datei des Versicherers unverändert ins Fenster ziehen. Kodierung, Trennzeichen und Zahlenformat werden automatisch erkannt. Die Datei verlässt Ihren Computer nicht.'),
          D.btn('Datei auswählen', function () { wahl.click(); }, { klasse: 'haupt-btn' })));
        return;
      }
      el.appendChild(h('div.ablage', null, wahl, D.icon('hoch'),
        h('div', { style: { flex: 1, minWidth: 0 } }, h('b', null, 'Neue Abrechnung hier ablegen'), h('div.klein.muted', null,
          'Aktueller Stand: ' + U.fmtZahl(letzter.zeilen, 0) + ' Zeilen · ' + U.fmtEuro(letzter.provisionssumme) + ' Provision · ' + U.fmtZahl(letzter.neu, 0) + ' neu im letzten Import' + (letzter.entfallen ? ' · ' + letzter.entfallen + ' entfallen' : ''))),
        D.btn('Datei auswählen', function () { wahl.click(); }), D.btn('Importhistorie', historie, { klasse: 'leise' })));

      // Reiter + Filter
      if (!z.reiter) z.reiter = erg.abweichung.length ? 'abweichung' : erg.vorschlaege.length ? 'offen' : 'gleich';
      var monate = {};
      erg.buendel.liste.forEach(function (b) { monate[b.monat] = 1; });
      var mOpt = [['', 'Kumuliert (alle Monate)']].concat(Object.keys(monate).sort().map(function (m) { return [m, U.monatName(m)]; }));
      var zaehl = { gleich: erg.gleich.length, abweichung: erg.abweichung.length, offen: erg.offen.length, neu: erg.neu.filter(function (b) { return !b.ignoriert; }).length, storno: erg.storno.length };
      var artChips = AB.abrechnung.PROVISIONSARTEN.map(function (a) {
        var an = e.provisionsarten.indexOf(a) >= 0;
        return h('button.chip' + (an ? '.aktiv' : ''), { type: 'button', title: 'Provisionsart ' + a + (an ? ' ausblenden' : ' einblenden'), onclick: function () {
          if (an) e.provisionsarten = e.provisionsarten.filter(function (x) { return x !== a; }); else e.provisionsarten.push(a);
          App.geaendert();
        } }, a);
      });
      el.appendChild(h('div.leiste', null,
        h('div.reiter', { role: 'tablist' }, REITER.map(function (r) { return h('button' + (z.reiter === r[0] ? '.aktiv' : ''), { type: 'button', role: 'tab', onclick: function () { z.reiter = r[0]; App.zeige('abgleich'); } }, r[1], h('span.zahl', null, zaehl[r[0]])); })),
        h('span.frei'), D.auswahl(mOpt, z.monat || '', function (v) { z.monat = v; App.zeige('abgleich'); }, { style: { width: '210px' }, title: 'Buchungsmonat' })));
      var werkzeug = h('div.leiste');
      el.appendChild(werkzeug);
      var box = h('div', { style: { flex: 1, minHeight: 0, display: 'flex' } });
      var mon = z.monat || '', tab, kopfDruck, liste = z.reiter;
      var antragSp = { t: 'Antrag', b: 'minmax(160px, 1.5fr)', k: 'zwei', w: function (r) { var a = r.antrag; return [h('span', { style: { fontWeight: 600 } }, M.vnName(a)), h('small', null, M.bereich[a.bereich].kurz + ' · ' + M.name('vorgang', a.vorgang) + ' · ' + M.tarife(a))]; }, s: function (r) { return M.vnName(r.antrag); } };
      var vnrSp = { t: 'Vertragsnr.', b: '104px', w: function (r) { return r.antrag.vertragsnummer || '–'; }, s: function (r) { return r.antrag.vertragsnummer; } };
      var buchBtn = function (r) { return D.btn('Buchungen', function () { AB.zeigeBuchungen('Buchungen zu ' + M.vnName(r.antrag), r.buendel.concat(r.stornos)); }, { klasse: 'klein-btn leise' }); };
      var oeffne = function (r) { AB.maske.oeffne(r.antrag); };
      function sicht() { var o = {}; o[liste] = tab.zeilen(); return Object.assign({}, erg, o); }
      function exportBtn() { return [D.exportBtn('Abgleich_' + liste + '_' + p.jahr, function () {
          var t = AB.kennzahlen.tabelleAbgleich(sicht(), liste), name = liste === 'haftung' ? 'Stornohaftung' : REITER.find(function (r) { return r[0] === liste; })[1];
          if (liste === 'abweichung') t.farbe = function (w, r, c) { return (c === 12 || c === 15) && Math.abs(w[c]) > 0.004 ? 'krit' : null; };
          if (liste === 'offen') t.farbe = function (w, r, c) { return c === 16 ? (w[16] > e.offenTage * 2 ? 'krit' : 'warn') : null; };
          return Object.assign({ name: name, titel: 'Abgleich – ' + name + (mon ? ' – ' + U.monatName(mon) : ' – kumuliert ' + p.jahr), unter: AB.ansichten.abgleich.unter() }, t);
        }, function () { return AB.kennzahlen.exportAbgleich(sicht(), liste); }),
        D.btn('Drucken', function () { drucke(); }, { icon: 'druck' })]; }
      function drucke() {
        var sp = tab.spaltenDruck;
        D.drucke('Abgleich – ' + REITER.find(function (r) { return r[0] === liste; })[1] + (mon ? ' – ' + U.monatName(mon) : ' – kumuliert ' + p.jahr),
          AB.ansichten.abgleich.unter() + ' · ' + tab.zeilen().length + ' Einträge', sp.map(function (s) { return { t: s.t, r: s.r }; }),
          tab.zeilen().map(function (r) { return sp.map(function (s) { return s.d(r); }); }));
      }
      var txt = function (f) { return function (r) { return f(r); }; };

      if (liste === 'gleich' || liste === 'abweichung') {
        var zl = erg[liste].filter(function (r) { return !mon || r.monat === mon; });
        var sp = [antragSp, vnrSp,
          { t: 'Buchungsmonat', b: '120px', w: function (r) { return U.monatName(r.monat); }, s: function (r) { return r.monat; }, d: function (r) { return U.monatName(r.monat); } },
          { t: 'Beitrag Soll', b: '100px', r: true, w: function (r) { return U.fmtEuro(r.sollB); }, s: function (r) { return r.sollB; } },
          { t: 'Beitrag Ist', b: '100px', r: true, w: function (r) { return U.fmtEuro(r.istB); }, s: function (r) { return r.istB; } },
          { t: 'Differenz', b: '92px', r: true, w: function (r) { return r.abwB ? h('span.marke-s.krit', null, U.fmtEuro(r.diffB)) : h('span.mini', null, r.soll.laufend ? 'laufend' : '0,00 €'); }, s: function (r) { return r.diffB; }, d: function (r) { return U.fmtEuro(r.diffB); } },
          { t: 'Prov. Soll', b: '100px', r: true, w: function (r) { return U.fmtEuro(r.sollPGesamt != null ? r.sollPGesamt : r.sollP); }, s: function (r) { return r.sollP; } },
          { t: 'Prov. Ist', b: '100px', r: true, w: function (r) { return U.fmtEuro(r.istP); }, s: function (r) { return r.istP; } },
          { t: 'Differenz', b: '92px', r: true, w: function (r) { return r.abwP ? h('span.marke-s.krit', null, U.fmtEuro(r.diffP)) : h('span.mini', null, U.fmtEuro(r.diffP)); }, s: function (r) { return r.diffP; }, d: function (r) { return U.fmtEuro(r.diffP); } },
          { t: '', b: liste === 'abweichung' ? '288px' : '96px', w: function (r) { return [buchBtn(r), liste === 'abweichung' ? D.btn(r.antrag.reklamation ? 'Reklamation' : 'Reklamieren', function () { AB.reklamation.oeffne([r.antrag]); }, { klasse: 'klein-btn haupt-btn', titel: 'Provisionsreklamation vorausgefüllt öffnen' }) : null, liste === 'abweichung' ? D.btn('Akzeptieren', function () { r.antrag.abweichungOk = r.fingerabdruck; App.geaendert(); D.toast('Abweichung akzeptiert – der Antrag steht jetzt unter „Gleich".'); }, { klasse: 'klein-btn', titel: 'Abweichung ist in Ordnung' }) : (r.akzeptiert ? h('span.marke-s', { title: 'Abweichung wurde akzeptiert' }, 'akz.') : r.nachbuchung ? h('span.marke-s.gut', { title: 'Durch eine Korrekturbuchung in einem späteren Monat ausgeglichen' }, 'korr.') : null)]; }, d: function () { return ''; } }];
        D.anhaengen(werkzeug, [h('span.muted.klein', null, liste === 'gleich' ? 'Antrag gefunden, Beitrag und Provision innerhalb der Toleranz (' + U.fmtEuro(e.toleranzBeitrag) + ' / ' + U.fmtEuro(e.toleranzProvision) + ').' : 'Antrag gefunden, aber Beitrag oder Provision weicht ab. Faktor in den Einstellungen prüfen, Antrag korrigieren oder die Abweichung akzeptieren.'), h('span.frei'), artChips, exportBtn()]);
        tab = AB.tabelle(box, { zeilen: zl, spalten: sp, klick: oeffne, hoehe: 50, sort: { i: 2, ab: true }, leer: liste === 'gleich' ? 'Noch keine übereinstimmenden Buchungen.' : 'Keine Abweichungen – alles stimmt.',
          fuss: function (l) { var a = 0, b = 0, c = 0, d2 = 0; l.forEach(function (r) { a += r.sollB; b += r.istB; c += r.sollPGesamt != null ? r.sollPGesamt : r.sollP; d2 += r.istP; }); return [l.length + ' Anträge', '', '', U.fmtEuro(a), U.fmtEuro(b), U.fmtEuro(b - a), U.fmtEuro(c), U.fmtEuro(d2), U.fmtEuro(d2 - c), '']; } });
        tab.spaltenDruck = sp.slice(0, 9).map(function (s, i) { return { t: s.t, r: s.r, d: s.d || (i === 0 ? function (r) { return M.vnName(r.antrag) + ' (' + M.tarife(r.antrag) + ')'; } : i === 1 ? function (r) { return r.antrag.vertragsnummer; } : txt(function (r) { var v = s.w(r); return typeof v === 'string' ? v : ''; })) }; });
      } else if (liste === 'offen') {
        var zo = erg.offen.filter(function (r) { return !mon || (r.antrag.eingang || '').slice(0, 7) === mon; });
        var spo = [antragSp, vnrSp,
          { t: 'Eingang', b: '100px', w: function (r) { return U.fmtDatum(r.antrag.eingang); }, s: function (r) { return r.antrag.eingang; } },
          { t: 'Tage offen', b: '100px', r: true, w: function (r) { return h('span.marke-s' + (r.tageOffen > e.offenTage * 2 ? '.krit' : '.warn'), null, r.tageOffen + ' Tage'); }, s: function (r) { return r.tageOffen; }, d: function (r) { return String(r.tageOffen); }, absteigend: true },
          { t: 'Beitrag', b: '104px', r: true, w: function (r) { return U.fmtEuro(r.sollB); }, s: function (r) { return r.sollB; } },
          { t: 'Erwartete Prov.', b: '120px', r: true, w: function (r) { return U.fmtEuro(r.sollP); }, s: function (r) { return r.sollP; } },
          { t: 'Status', b: '130px', w: function (r) { return AB.statusMarke(r.antrag); }, s: function (r) { return r.antrag.status; }, d: function (r) { return M.name('status', r.antrag.status); } },
          { t: '', b: '130px', w: function (r) { return D.btn(r.antrag.reklamation ? 'Reklamation' : 'Reklamieren', function () { AB.reklamation.oeffne([r.antrag]); }, { klasse: 'klein-btn', titel: 'Provisionsreklamation vorausgefüllt öffnen' }); }, d: function () { return ''; } }];
        D.anhaengen(werkzeug, [h('span.muted.klein', null, 'Eingereicht oder policiert, aber seit mindestens ' + e.offenTage + ' Tagen keine Buchung.'), h('span.frei'), exportBtn()]);
        if (erg.vorschlaege.length) {
          var vb = h('div.karte', { style: { maxHeight: '178px', overflow: 'auto', padding: '12px 16px', flex: 'none' } }, h('h3', null, 'Zuordnungsvorschläge (' + erg.vorschlaege.length + ')'),
            h('div.unter', null, 'Antrag ohne Vertragsnummer – passende Buchung gefunden. Ein Klick trägt die Vertragsnummer ein.'));
          erg.vorschlaege.forEach(function (v) {
            v.kandidaten.forEach(function (k, ki) {
              vb.appendChild(h('div.leiste', { style: { padding: '5px 0', borderTop: '1px solid var(--line)' } },
                h('div', { style: { flex: 1, minWidth: 0 } }, ki === 0 ? h('b', null, M.vnName(v.reihe.antrag) + ' · ' + U.fmtEuro(v.reihe.sollB)) : h('span.mini', null, 'Alternative'), h('span.muted.klein', null, '  ↔  Vertrag ' + k.vnr + ' · ' + (k.name || 'ohne Name') + ' · ' + U.fmtEuro(k.mbd) + ' · ' + U.monatName(k.monat))),
                h('span.marke-s' + (k.punkte >= 80 ? '.gut' : '.warn'), { title: k.gruende.join(', ') }, k.punkte + ' % · ' + k.gruende.join(', ')),
                D.btn('Bestätigen', function () { AB.abgleich.bestaetige(p, v.reihe.antrag.id, k); App.geaendert(); D.toast('Vertragsnummer ' + k.vnr + ' eingetragen.'); }, { klasse: 'klein-btn haupt-btn', icon: 'haken' })));
            });
          });
          el.appendChild(vb);
        }
        tab = AB.tabelle(box, { zeilen: zo, spalten: spo, klick: oeffne, hoehe: 50, sort: { i: 3, ab: true }, leer: 'Keine überfälligen Anträge.',
          fuss: function (l) { var a = 0, b = 0; l.forEach(function (r) { a += r.sollB; b += r.sollP; }); return [l.length + ' Anträge', '', '', '', U.fmtEuro(a), U.fmtEuro(b), '', '']; } });
        tab.spaltenDruck = spo.slice(0, 7).map(function (s, i) { return { t: s.t, r: s.r, d: s.d || (i === 0 ? function (r) { return M.vnName(r.antrag) + ' (' + M.tarife(r.antrag) + ')'; } : function (r) { var v = s.w(r); return typeof v === 'string' ? v : ''; }) }; });
      } else if (liste === 'neu') {
        if (!z.wahl) z.wahl = new Set();
        var sichtbar = function () { return erg.neu.filter(function (b) { return (!mon || b.monat === mon) && (z.abgehakte || !b.ignoriert) && (!z.nurNeu || b.neu); }); };
        var hake = function (bs, an) { bs.forEach(function (b) { if (an) p.ignoriert[b.key] = { am: U.heute() }; else delete p.ignoriert[b.key]; }); z.wahl.clear(); App.geaendert(); };
        var zn = sichtbar(), wahlBtn = D.btn('Ausgewählte abhaken', function () { hake(zn.filter(function (b) { return z.wahl.has(b.key); }), true); }, { icon: 'haken', aus: !z.wahl.size });
        var alle = h('input', { type: 'checkbox', title: 'Alle angezeigten auswählen', onchange: function () { z.wahl.clear(); if (alle.checked) tab.zeilen().forEach(function (b) { if (!b.ignoriert) z.wahl.add(b.key); }); wahlBtn.disabled = !z.wahl.size; tab.zeichne(); } });
        var spn = [
          { t: '', kopf: alle, b: '26px', w: function (b) { return b.ignoriert ? h('span', { title: 'abgehakt' }, '✓') : h('input', { type: 'checkbox', checked: z.wahl.has(b.key), onchange: function () { if (this.checked) z.wahl.add(b.key); else z.wahl.delete(b.key); wahlBtn.disabled = !z.wahl.size; } }); }, d: function () { return ''; } },
          { t: 'Monat', b: '104px', w: function (b) { return [U.MONATE_KURZ[+b.monat.slice(5) - 1] + ' ' + b.monat.slice(2, 4), b.neu ? h('span.marke-s.gut', { title: 'Neu im letzten Import' }, 'neu') : null]; }, s: function (b) { return b.monat; }, d: function (b) { return b.monat + (b.neu ? ' (neu)' : ''); }, absteigend: true },
          { t: 'Vertrag · Person', b: 'minmax(150px, 1.4fr)', k: 'zwei', w: function (b) { return [h('span', { style: { fontWeight: 600 } }, b.vnName || b.vpName || 'Vertrag ' + b.vnr), h('small', null, b.vnr + ' · Person ' + b.pnr)]; }, s: function (b) { return b.vnName || b.vnr; }, d: function (b) { return (b.vnName || '') + ' · ' + b.vnr; } },
          { t: 'Tarifgruppe · Tarife', b: 'minmax(140px, 1.2fr)', k: 'zwei', w: function (b) { return [h('span', null, b.tarife.join(', ')), h('small', null, b.tg)]; }, s: function (b) { return b.tg; }, d: function (b) { return b.tarife.join(', '); } },
          { t: 'Beitragsdiff.', b: '104px', r: true, w: function (b) { return AB.geld(b.mbd, true); }, s: function (b) { return b.mbd; }, d: function (b) { return U.fmtEuro(b.mbd); } },
          { t: 'Provision', b: '100px', r: true, w: function (b) { return AB.geld(b.prov, true); }, s: function (b) { return b.prov; }, d: function (b) { return U.fmtEuro(b.prov); } },
          { t: 'Art', b: '104px', w: function (b) { return b.arten.join(', ') + (b.hatStorno ? ' · X' : ''); }, s: function (b) { return b.arten.join(); }, d: function (b) { return b.arten.join(', '); } },
          { t: '', b: '222px', w: function (b) { return b.ignoriert ? D.btn('Wieder aufnehmen', function () { hake([b], false); }, { klasse: 'klein-btn leise' }) : [
            D.btn('Antrag', function () { var a = AB.abgleich.antragAusBuendel(p, [b]); App.geaendert(); D.toast('Antrag angelegt: ' + M.vnName(a) + '.', { aktion: ['Öffnen', function () { AB.maske.oeffne(a); }] }); }, { klasse: 'klein-btn', titel: 'Als Antrag übernehmen' }),
            D.btn('Zuordnen', function () { waehleAntrag([b]); }, { klasse: 'klein-btn', titel: 'Einem vorhandenen Antrag zuordnen' }),
            D.btn('', function () { hake([b], true); }, { klasse: 'klein-btn leise', icon: 'haken', titel: 'Kein Antrag nötig – abhaken' })]; }, d: function () { return ''; } }];
        var schalter = function (text, feld) { return h('label.schalter.klein', null, h('input', { type: 'checkbox', checked: !!z[feld], onchange: function () { z[feld] = this.checked; App.zeige('abgleich'); } }), text); };
        D.anhaengen(werkzeug, [wahlBtn, D.btn('Alle abhaken', function () { var l = tab.zeilen().filter(function (b) { return !b.ignoriert; }); if (l.length) D.frage(l.length + ' Buchungen abhaken?', 'Alle angezeigten Buchungen werden als „kein Antrag nötig" markiert. Das lässt sich jederzeit rückgängig machen.', 'Abhaken').then(function (ja) { if (ja) hake(l, true); }); }, { klasse: 'leise' }),
          schalter('Nur neue', 'nurNeu'), schalter('Abgehakte anzeigen', 'abgehakte'), h('span.frei'), artChips, exportBtn()]);
        tab = AB.tabelle(box, { zeilen: zn, spalten: spn, hoehe: 50, sort: { i: 1, ab: true }, klasse: function (b) { return b.ignoriert ? '.blass' : ''; },
          klick: function (b) { AB.zeigeBuchungen('Buchung ' + b.vnr + ' · ' + U.monatName(b.monat), [b]); }, leer: 'Keine Buchungen ohne Antrag.',
          fuss: function (l) { var a = 0, b2 = 0; l.forEach(function (x) { a += x.mbd; b2 += x.prov; }); return ['', l.length + ' Buch.', '', '', U.fmtEuro(a), U.fmtEuro(b2), '', '']; } });
        tab.spaltenDruck = spn.slice(1, 7).map(function (s) { return { t: s.t, r: s.r, d: s.d }; });
      } else {
        var zs = erg.storno.filter(function (r) { return !mon || (r.stDatum || '').slice(0, 7) === mon; });
        if (z.haftung) zs = erg.haftung.slice();
        var sps = [antragSp, vnrSp,
          { t: z.haftung ? 'Abgerechnet' : 'Rückbuchung', b: '112px', w: function (r) { return U.fmtDatum(z.haftung ? r.bdat : r.stDatum); }, s: function (r) { return z.haftung ? r.bdat : r.stDatum; } },
          { t: 'Art', b: '110px', w: function (r) { return z.haftung ? h('span.marke-s', null, 'in Haftung') : r.vollStorno ? h('span.marke-s.krit', null, 'Storno') : h('span.marke-s.warn', null, 'Teil-Rückb.'); }, s: function (r) { return r.vollStorno ? 1 : 0; }, d: function (r) { return z.haftung ? 'in Haftung' : r.vollStorno ? 'Storno' : 'Teil-Rückbuchung'; } },
          { t: 'Beitrag', b: '104px', r: true, w: function (r) { return z.haftung ? U.fmtEuro(r.istB) : AB.geld(r.stB, true); }, s: function (r) { return z.haftung ? r.istB : r.stB; }, d: function (r) { return U.fmtEuro(z.haftung ? r.istB : r.stB); } },
          { t: 'Provision', b: '104px', r: true, w: function (r) { return z.haftung ? U.fmtEuro(r.istP) : AB.geld(r.stP, true); }, s: function (r) { return z.haftung ? r.istP : r.stP; }, d: function (r) { return U.fmtEuro(z.haftung ? r.istP : r.stP); } },
          { t: 'Stornogrund', b: 'minmax(110px, 1fr)', w: function (r) { return r.stGrund || '–'; }, s: function (r) { return r.stGrund; } },
          { t: 'Stornohaftung bis', b: '132px', w: function (r) { return r.shEnde ? [U.fmtDatum(r.shEnde), r.shEnde >= erg.stand && !z.haftung ? h('span.marke-s.warn', null, 'läuft') : null] : '–'; }, s: function (r) { return r.shEnde; }, d: function (r) { return U.fmtDatum(r.shEnde); } },
          { t: '', b: '100px', w: buchBtn, d: function () { return ''; } }];
        D.anhaengen(werkzeug, [D.seg([['0', 'Rückbuchungen (' + erg.storno.length + ')'], ['1', 'In laufender Stornohaftung (' + erg.haftung.length + ')']], z.haftung ? '1' : '0', function (v) { z.haftung = v === '1'; App.zeige('abgleich'); }),
          h('span.muted.klein', null, z.haftung ? 'Abgerechnete Verträge, deren Stornohaftung noch läuft.' : 'Rückbuchungen (X) zu abgerechneten Anträgen. Ab ' + e.stornoSchwelle + ' % des Beitrags wird der Status „Storno" gesetzt.'), h('span.frei'), exportBtn()]);
        if (z.haftung) liste = 'haftung';
        tab = AB.tabelle(box, { zeilen: zs, spalten: sps, klick: oeffne, hoehe: 50, sort: { i: z.haftung ? 7 : 2, ab: !z.haftung }, leer: z.haftung ? 'Keine Verträge in laufender Stornohaftung.' : 'Keine Rückbuchungen.',
          fuss: function (l) { var a = 0, b = 0; l.forEach(function (r) { a += z.haftung ? r.istB : r.stB; b += z.haftung ? r.istP : r.stP; }); return [l.length + ' Anträge', '', '', '', U.fmtEuro(a), U.fmtEuro(b), '', '', '']; } });
        tab.spaltenDruck = sps.slice(0, 8).map(function (s, i) { return { t: s.t, r: s.r, d: s.d || (i === 0 ? function (r) { return M.vnName(r.antrag) + ' (' + M.tarife(r.antrag) + ')'; } : function (r) { var v = s.w(r); return typeof v === 'string' ? v : ''; }) }; });
      }
      el.appendChild(box);
    } };
})(globalThis.AB = globalThis.AB || {});
