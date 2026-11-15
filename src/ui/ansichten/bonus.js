/* Antragsbuch – Bonus: Stand im ADP-Wettbewerb, was fehlt bis zum nächsten Ziel. */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h, U = AB.util, B = AB.bonus, App = AB.app;

  function balken(ist, soll, text) {
    var q = soll > 0 ? Math.max(0, Math.min(1, ist / soll)) : 0;
    return h('div', { title: text, style: { height: '10px', borderRadius: '99px', background: 'var(--surface-2)', overflow: 'hidden', margin: '6px 0 4px' } },
      h('div.hb.dia', { style: { height: '100%', width: (q * 100) + '%', borderRadius: '99px', background: q >= 1 ? 'var(--good)' : 'var(--s1)' } }));
  }
  function karte(titel, erreicht, praemie, inhalt, max) {
    return h('div.karte.rein', null, h('div.leiste', null, h('h3', null, titel), h('span.frei'),
      h('span.marke-s' + (erreicht ? '.gut' : ''), null, erreicht ? 'erreicht' : 'offen')), inhalt,
      h('div.leiste', { style: { marginTop: '8px' } }, h('span.muted.klein', null, max != null ? 'möglich: ' + U.fmtEuro0(max) : ''), h('span.frei'), h('b.num', { style: { fontSize: '18px' } }, U.fmtEuro0(praemie))));
  }

  // ---------- Vorschau: bestätigt (Reporting) · gebucht (Abrechnung) · beantragt (Antragsbuch) ----------
  var ZUSTAND = { bestaetigt: ['bestätigt', 'gut', 'im Bonus-Reporting enthalten'], gebucht: ['gebucht – noch nicht bestätigt', '', 'in der Abrechnung gebucht, im Bonus-Reporting noch nicht ausgewiesen'], beantragt: ['beantragt – nicht bestätigt', 'warn', 'im Antragsbuch erfasst, noch nicht abgerechnet'] };
  function vorschau(el, p) {
    var e = p.bonus, s = B.simulation(p, App.zeilen || [], App.erg), G = AB.dia, ganz = function (v) { return U.fmtZahl(v, 0); };
    var fStand = h('input', { type: 'date', value: e.reportingStand || '', style: { width: '160px' }, onchange: function () { e.reportingStand = fStand.value; App.geaendert({ ohneRechnen: true }); } });
    function zelle(v, fmt, plus) { return h('td.num', { style: { textAlign: 'right' } }, v ? (plus && v > 0 ? '+' : '') + fmt(v) : '–'); }
    function zeile(name, z, fmt, soll, hinweis) {
      var ok = soll > 0 && z.voraussichtlich >= soll;
      return h('tr', null, h('td', null, h('b', null, name), hinweis ? h('div.mini', null, hinweis) : null), zelle(z.bestaetigt, fmt), zelle(z.gebucht, fmt, true), zelle(z.beantragt, fmt, true),
        h('td.num', { style: { textAlign: 'right', fontWeight: 700 } }, fmt(z.voraussichtlich)),
        h('td.num', { style: { textAlign: 'right' } }, soll > 0 ? fmt(soll) : '–'), h('td', null, soll > 0 ? h('span.marke-s' + (ok ? '.gut' : ''), null, ok ? 'erreicht' : 'es fehlen ' + fmt(Math.max(0, soll - z.voraussichtlich))) : null));
    }
    function pruefzeile(name, z, soll) {
      var nrn = function (l) { return l.length ? ' (Pos. ' + l.join(', ') + ')' : ''; }, ps = z.positionen;
      if (!z.bestaetigt && !z.gebucht && !z.beantragt) return null;
      var abw = s.stand && z.abweichung !== 0;
      return h('div.meldung' + (abw ? '.warn' : ''), { style: { marginTop: '10px' } }, h('b', null, 'Neue Personen ' + name + ': '),
        (soll ? 'gebraucht ' + soll + ' · ' : '') + 'bestätigt ' + z.bestaetigt + (s.stand ? ', davon im Antragsbuch ' + z.imBuch + nrn(ps.bestaetigt) : '') + ' · gebucht ' + z.gebucht + nrn(ps.gebucht) + ' · beantragt ' + z.beantragt + nrn(ps.beantragt) + '. ',
        abw ? h('b', null, z.abweichung > 0 ? 'Das Reporting weist ' + z.abweichung + ' mehr aus, als im Antragsbuch vor dem Stand gebucht ist – fehlt ein Eintrag im Antragsbuch?' : 'Im Antragsbuch sind ' + (-z.abweichung) + ' mehr gebucht, als das Reporting bestätigt – bitte bei der SDK nachfragen (Export „Überprüfung Bonus").') : null);
    }
    var pr = s.prognose, kopf = ['', 'Bestätigt', 'Gebucht seitdem', 'Beantragt', 'Voraussichtlich', 'Ziel', ''];
    var tab = h('table.einfach', null, h('thead', null, h('tr', null, kopf.map(function (t, i) { return h('th', { style: i >= 1 && i <= 5 ? { textAlign: 'right' } : null }, t); }))), h('tbody', null,
      zeile('Neue Personen KV-Voll', s.voll, ganz, pr.ziel1.soll, 'Ziel 1 · zählt, wenn die Person bisher keine KV-Voll hatte'),
      zeile('KV-Nettoproduktion', s.nettoKv, U.fmtEuro0, pr.ziel2.soll, 'Ziel 2 · ' + pr.stufe.ziel2 + ' € je 1.000 € Bestand'),
      zeile('Nettoproduktion gesamt', s.nettoGesamt, U.fmtEuro0, pr.grundErreicht ? 0 : pr.sonder.mindest, pr.grundErreicht ? 'Grundlage des Grundbonus' : 'Mindestproduktion der Sonderregelung'),
      zeile('Neue Personen bKV', s.bkv, ganz, pr.bkv.soll, 'Zusatzbonus · zählt, wenn die Person bisher nicht bei der SDK versichert war')));
    function stufe(titel, r, unter, akzent) {
      return h('div.karte.kachel.rein' + (akzent ? '.akzent' : ''), null, h('div.lbl', null, titel), h('div.wert', null, h('span.num', null, U.fmtZahl(r.summe, 0)), h('small', null, '€')),
        h('div.neben', { title: unter }, (r.grundErreicht ? 'Grundbonus erreicht' : r.sonder.greift ? 'halber Grundbonus' : 'Grundbonus offen') + ' · ' + unter));
    }
    var dP = h('div'), dM = h('div');
    var liste = h('tbody');
    s.liste.slice().reverse().forEach(function (x) {
      var zu = ZUSTAND[x.zustand], spaeter = x.beginn && x.beginn > x.eingang;
      liste.appendChild(h('tr', { style: { cursor: 'pointer' }, title: 'Antrag öffnen', onclick: function () { var a = p.antraege.find(function (y) { return y.id === x.id; }); if (a) AB.maske.oeffne(a); } },
        h('td.num.muted', null, x.nr || ''), h('td', null, h('b', null, x.name || '–'), h('div.mini', null, AB.model.name('bereich', x.bereich) + ' · ' + AB.model.name('vorgang', x.vorgang))),
        h('td', null, U.fmtDatum(x.eingang)), h('td', null, x.beginn ? U.fmtDatum(x.beginn) : '–', spaeter && x.zustand === 'beantragt' ? h('div.mini', null, 'zählt ab Einreichung') : null),
        h('td.num', { style: { textAlign: 'right' } }, x.voll || '–'), h('td.num', { style: { textAlign: 'right' } }, x.bkv || '–'), h('td.num', { style: { textAlign: 'right' } }, U.fmtEuro(x.mb)),
        h('td', null, h('span.marke-s' + (zu[1] ? '.' + zu[1] : ''), { title: zu[2] }, zu[0]), x.gebuchtAm ? h('div.mini', null, 'gebucht ' + U.fmtDatum(x.gebuchtAm)) : null)));
    });
    var druck = function () {
      var z = [['Neue Personen KV-Voll', s.voll, ganz, pr.ziel1.soll], ['KV-Nettoproduktion', s.nettoKv, U.fmtEuro0, pr.ziel2.soll], ['Nettoproduktion gesamt', s.nettoGesamt, U.fmtEuro0, 0], ['Neue Personen bKV', s.bkv, ganz, pr.bkv.soll]]
        .map(function (r) { return [r[0], r[2](r[1].bestaetigt), r[2](r[1].gebucht), r[2](r[1].beantragt), r[2](r[1].voraussichtlich), r[3] ? r[2](r[3]) : '–']; });
      z.push(['Prämie', U.fmtEuro0(s.heute.summe), U.fmtEuro0(s.gebucht.summe), '', U.fmtEuro0(pr.summe), U.fmtEuro0(pr.max)]);
      D.drucke('Bonus-Vorschau ' + p.jahr, 'Vermittler ' + (p.einstellungen.vermittlernummer || '–') + ' · ' + pr.stufe.name + ' · Stand ' + U.fmtDatum(U.heute()) + (s.stand ? ' · bestätigt laut Bonus-Reporting vom ' + U.fmtDatum(s.stand) : '') + ' · unverbindliche Vorschau, maßgeblich ist das Bonus-Reporting des Versicherers',
        ['', 'Bestätigt', 'Gebucht seitdem', 'Beantragt (nicht bestätigt)', 'Voraussichtlich', 'Ziel'].map(function (t, i) { return { t: t, r: i > 0 }; }), z);
    };
    el.appendChild(h('div.karte.rein', { style: { marginTop: '16px' } },
      h('div.leiste', null, h('h3', null, 'Vorschau auf die Bonus-Abrechnung'), h('span.frei'), h('span.klein.muted', null, 'Stand des letzten Bonus-Reportings'), fStand, D.btn('Überprüfung Bonus exportieren', function () { D.excel('Ueberpruefung_Bonus_' + p.jahr + '.xlsx', B.tabellePruefung(p, s)); }, { icon: 'runter', titel: 'Excel mit Zusammenfassung und allen Positionen – zum Abgleich mit dem Bonus-Reporting und für Rückfragen an die SDK' }), D.btn('', druck, { icon: 'druck', titel: 'Vorschau drucken oder als PDF speichern' })),
      h('div.unter', null, 'Bestätigt = Werte aus Ihrem Bonus-Reporting (links unter „Meine Werte")' + (s.stand ? ' vom ' + U.fmtDatum(s.stand) : '') + ' · Gebucht = seitdem in der Abrechnung · Beantragt = im Antragsbuch, noch nicht abgerechnet'),
      !s.stand ? h('div.meldung', { style: { margin: '10px 0' } }, 'Tragen Sie das Datum Ihres letzten Bonus-Reportings ein. Solange es fehlt, gilt alles Abgerechnete als „gebucht – noch nicht bestätigt".') : null,
      h('div', { style: { overflowX: 'auto' } }, tab),
      pruefzeile('KV-Voll', s.voll, pr.ziel1.soll), pruefzeile('bKV', s.bkv, pr.bkv.soll),
      h('div.raster.r-3', { style: { marginTop: '14px' } }, stufe('Prämie bestätigt', s.heute, 'laut Bonus-Reporting'), stufe('Prämie mit Gebuchtem', s.gebucht, 'Reporting + Abrechnung'), stufe('Prämie voraussichtlich', pr, 'wenn alles Beantragte policiert wird', true)),
      h('div.raster.r-2', { style: { marginTop: '14px' } }, h('div', null, h('h3', null, 'Neue Personen KV-Voll je Monat'), h('div.unter', null, 'gebucht nach Buchungsmonat · beantragt nach Monat der Einreichung'), dP),
        h('div', null, h('h3', null, 'Produktion je Monat'), h('div.unter', null, 'gebuchte Nettoproduktion · beantragter Monatsbeitrag (Schätzung)'), dM)),
      h('h3', { style: { marginTop: '16px' } }, 'Diese Anträge fließen ein'),
      s.liste.length ? h('div', { style: { overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' } }, h('table.einfach', null, h('thead', null, h('tr', null, ['Pos.', 'Antrag', 'Eingereicht', 'Beginn', 'Personen KV-Voll', 'Personen bKV', 'Monatsbeitrag', 'Stand'].map(function (t, i) { return h('th', { style: i >= 4 && i <= 6 ? { textAlign: 'right' } : null }, t); }))), liste))
        : h('p.muted', null, 'Für ' + p.jahr + ' sind noch keine Anträge im Antragsbuch erfasst. Sobald Sie einen Antrag eintragen, erscheint er hier als „beantragt – nicht bestätigt".'),
      h('p.mini', { style: { marginTop: '10px' } }, 'So wird gerechnet: Personen stammen aus dem Antragsbuch (Vorgang „Neu", Bereich Vollversicherung bzw. bKV), weil nur dort bekannt ist, ob es eine neue Person ist. Ein Antrag zählt ab dem Tag der Einreichung als beantragt, unabhängig vom Versicherungsbeginn. Wird er in der Abrechnung gefunden, gilt er als gebucht; liegt die Buchung vor dem Stand des Bonus-Reportings, gilt er als bestätigt und wird nicht doppelt gezählt. Die Nettoproduktion stammt aus der Spalte „Produktion" der Abrechnung; für Beantragtes wird der Monatsbeitrag angesetzt, die bewertete Produktion kann niedriger ausfallen. Abgelehnte, widerrufene und stornierte Anträge zählen nicht. Unverbindliche Vorschau – maßgeblich ist das Bonus-Reporting des Versicherers.')));
    requestAnimationFrame(function () {
      G.balken(dP, { titel: 'Neue Personen KV-Voll je Monat', kategorien: U.MONATE_KURZ, kategorienLang: U.MONATE, format: ganz, hoehe: 200,
        reihen: [{ name: 'gebucht', farbe: G.FARBEN[0], werte: s.monate.vollGebucht }, { name: 'beantragt', farbe: G.FARBEN[3], werte: s.monate.vollBeantragt }] });
      G.balken(dM, { titel: 'Produktion je Monat', kategorien: U.MONATE_KURZ, kategorienLang: U.MONATE, format: U.fmtEuro0, hoehe: 200,
        reihen: [{ name: 'gebuchte Nettoproduktion', farbe: G.FARBEN[0], werte: s.monate.gebuchtProd }, { name: 'beantragt (Monatsbeitrag)', farbe: G.FARBEN[3], werte: s.monate.beantragtMb }] });
    });
  }

  AB.ansichten.bonus = { titel: 'Bonus', icon: 'pokal', unter: 'ADP-Wettbewerb: Wo stehe ich, was fehlt noch?',
    zeige: function (el, aktionen, z) {
      var p = App.p; if (!p.bonus) p.bonus = B.leer();
      var e = p.bonus, r = B.rechne(e);
      function zahl(feld, label, hinweis) {
        var i = h('input', { type: 'text', inputMode: 'decimal', value: e[feld] == null ? '' : U.fmtZahl(+e[feld], 0), placeholder: hinweis || '', style: { textAlign: 'right' }, onchange: function () {
          var v = i.value.trim() === '' ? null : U.parseZahl(i.value); if (v != null && isNaN(v)) { i.classList.add('fehler'); return; }
          e[feld] = v; e.stand = U.heute(); App.geaendert({ ohneRechnen: true });
        } });
        return D.feld(label, i, 's6');
      }
      var ausAbr = App.zeilen && App.zeilen.length ? AB.team.nettoproduktion(App.zeilen, p.jahr) : null;
      var pos = p.team ? AB.team.position(p.team, p.einstellungen.vermittlernummer) : null, ausTeam = pos && pos.ytd && pos.ytd.wert != null ? pos.ytd.wert : null;
      el.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) minmax(0, 1fr)', gap: '16px', alignItems: 'start' } },
        h('div.karte.rein', null, h('h3', null, 'Meine Werte'), h('div.unter', null, 'Aus dem monatlichen Bonus-Reporting übernehmen' + (e.stand ? ' · zuletzt geändert ' + U.fmtDatum(e.stand) : '')),
          h('div.formraster', null,
            D.feld('Karrierestufe', D.auswahl(B.STUFEN.map(function (s) { return [s.id, s.name]; }), e.stufe, function (v) { e.stufe = v; App.geaendert({ ohneRechnen: true }); }), 's12'),
            zahl('nettoGesamt', 'Nettoproduktion gesamt (€ MB)', 'KV/UV/Ventil'), zahl('nettoKv', 'KV-Nettoproduktion (€ MB)'),
            zahl('bestandKv', 'KV-Bestand (€)'), zahl('bestandVoll', 'Bestand KV-Voll + PPV (€)', 'sonst KV-Bestand'),
            zahl('neueVoll', 'Neue Personen KV-Voll'), zahl('neueBkv', 'Neue Personen bKV')),
          ausAbr && ausAbr.hat ? h('div.leiste', { style: { marginTop: '10px' } }, h('span.mini', { style: { flex: 1 } }, 'Laut Abrechnung ' + p.jahr + ': Nettoproduktion ' + U.fmtEuro0(ausAbr.gesamt) + ', davon KV ' + U.fmtEuro0(ausAbr.kv) + '.'),
            D.btn('Übernehmen', function () { e.nettoGesamt = ausAbr.gesamt; e.nettoKv = ausAbr.kv; e.stand = U.heute(); App.geaendert({ ohneRechnen: true }); }, { klasse: 'klein-btn' })) : null,
          ausTeam != null && !(ausAbr && ausAbr.hat) ? h('div.leiste', { style: { marginTop: '10px' } }, h('span.mini', { style: { flex: 1 } }, 'Laut Teamdaten liegt Ihre Nettoproduktion bei ' + U.fmtEuro0(ausTeam) + '.'),
            D.btn('Übernehmen', function () { e.nettoGesamt = Math.round(ausTeam); if (e.nettoKv == null) e.nettoKv = Math.round(ausTeam); e.stand = U.heute(); App.geaendert({ ohneRechnen: true }); }, { klasse: 'klein-btn' })) : null,
          h('p.mini', { style: { marginTop: '10px' } }, 'Grundlage: Wettbewerbsbedingungen für den ADP-Wettbewerb 2025. Maßgeblich sind die Auswertungen des Versicherers; dieser Rechner zeigt nur, wo Sie stehen. Voraussetzungen der Auszahlung (u. a. 20 Stunden Weiterbildung, höchstens 5 % Dokumentationsverzicht, bestehendes Vertragsverhältnis zum Jahresende) prüft er nicht.')),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 } },
          h('div.raster.r-3', null,
            h('div.karte.kachel.akzent.rein', null, h('div.lbl', null, 'Prämie nach heutigem Stand'), h('div.wert', null, h('span.num', null, U.fmtZahl(r.summe, 0)), h('small', null, '€')), h('div.neben', null, 'von möglichen ' + U.fmtEuro0(r.max))),
            h('div.karte.kachel.rein', null, h('div.lbl', null, 'Grundbonus'), h('div.wert', null, h('span.num', null, U.fmtZahl(r.grund, 0)), h('small', null, '€')), h('div.neben', null, r.grundErreicht ? U.fmtZahl(r.stufe.jeMB, 1) + ' € je € MB' : r.sonder.greift ? 'halber Grundbonus (Sonderregelung)' : 'noch nicht erreicht')),
            h('div.karte.kachel.rein', null, h('div.lbl', null, 'Zusatzboni'), h('div.wert', null, h('span.num', null, U.fmtZahl(r.zb1.praemie + r.kombi.praemie + r.bkv.praemie, 0)), h('small', null, '€')), h('div.neben', null, 'von möglichen ' + U.fmtEuro0(r.maxZusatz)))),
          r.schritte.length ? h('div.karte.rein', null, h('h3', null, 'Was fehlt noch?'), h('ul', { style: { margin: '6px 0 0', paddingLeft: '20px', color: 'var(--text-2)' } }, r.schritte.map(function (s) { return h('li', { style: { margin: '4px 0' } }, s); }))) : null,
          h('div.raster.r-2', null,
            karte('Grundbonus · Ziel 1: neue Personen KV-Voll', r.ziel1.erreicht, r.grundErreicht ? r.grund : 0, h('div', null, balken(r.ziel1.ist, r.ziel1.soll), h('div.klein.muted', null, r.ziel1.ist + ' von ' + r.ziel1.soll + ' · je 100.000 € Bestand (KV-Voll + PPV) drei neue Personen'))),
            karte('Grundbonus · Ziel 2: Bestandsausschöpfung', r.ziel2.erreicht, r.grundErreicht ? r.grund : 0, h('div', null, balken(r.ziel2.ist, r.ziel2.soll), h('div.klein.muted', null, U.fmtEuro0(r.ziel2.ist) + ' von ' + U.fmtEuro0(r.ziel2.soll) + ' · ' + U.fmtZahl(r.ziel2.je1000, 1) + ' € je 1.000 € Bestand, nötig ' + r.ziel2.schwelle + ' €'))),
            karte('Zusatzbonus: Bestandsausschöpfung', r.zb1.erreicht && r.grundErreicht, r.zb1.praemie, h('div', null, balken(r.zb1.ist, r.zb1.soll), h('div.klein.muted', null, U.fmtEuro0(r.zb1.ist) + ' von ' + U.fmtEuro0(r.zb1.soll) + ' · nötig ' + r.zb1.schwelle + ' € je 1.000 € Bestand')), r.zb1.max),
            karte('Zusatzbonus: neue Personen bKV', r.bkv.erreicht && r.grundErreicht, r.bkv.praemie, h('div', null, balken(r.bkv.ist, r.bkv.soll), h('div.klein.muted', null, r.bkv.ist + ' von ' + r.bkv.soll + ' neuen Personen' + (r.bkv.erreicht && !r.grundErreicht ? ' · zählt erst mit Grundbonus' : ''))), r.bkv.max),
            karte('Kombibonus: Ziel 1 und Ziel 2', r.kombi.erreicht, r.kombi.praemie, h('div.klein.muted', { style: { marginTop: '6px' } }, 'Ziel 1 ' + (r.ziel1.erreicht ? 'erreicht' : 'offen') + ' · Ziel 2 ' + (r.ziel2.erreicht ? 'erreicht' : 'offen')), r.kombi.max),
            karte('Sonderregelung: halber Grundbonus', r.sonder.greift, r.sonder.greift ? r.grund : 0, h('div', null, balken(r.gesamt, r.sonder.mindest), h('div.klein.muted', null, r.grundErreicht ? 'nicht nötig – Grundbonus ist erreicht' : U.fmtEuro0(r.gesamt) + ' von ' + U.fmtEuro0(r.sonder.mindest) + ' Mindestproduktion')))))));
      vorschau(el, p);
    } };
})(globalThis.AB = globalThis.AB || {});
