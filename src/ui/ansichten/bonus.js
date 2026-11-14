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

  AB.ansichten.bonus = { titel: 'Bonus', icon: 'funke', unter: 'ADP-Wettbewerb: Wo stehe ich, was fehlt noch?',
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
      var pos = p.team ? AB.team.position(p.team, p.einstellungen.vermittlernummer) : null, ausTeam = pos && pos.ytd && pos.ytd.wert != null ? pos.ytd.wert : null;
      el.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) minmax(0, 1fr)', gap: '16px', alignItems: 'start' } },
        h('div.karte.rein', null, h('h3', null, 'Meine Werte'), h('div.unter', null, 'Aus dem monatlichen Bonus-Reporting übernehmen' + (e.stand ? ' · zuletzt geändert ' + U.fmtDatum(e.stand) : '')),
          h('div.formraster', null,
            D.feld('Karrierestufe', D.auswahl(B.STUFEN.map(function (s) { return [s.id, s.name]; }), e.stufe, function (v) { e.stufe = v; App.geaendert({ ohneRechnen: true }); }), 's12'),
            zahl('nettoGesamt', 'Nettoproduktion gesamt (€ MB)', 'KV/UV/Ventil'), zahl('nettoKv', 'KV-Nettoproduktion (€ MB)'),
            zahl('bestandKv', 'KV-Bestand (€)'), zahl('bestandVoll', 'Bestand KV-Voll + PPV (€)', 'sonst KV-Bestand'),
            zahl('neueVoll', 'Neue Personen KV-Voll'), zahl('neueBkv', 'Neue Personen bKV')),
          ausTeam != null ? h('div.leiste', { style: { marginTop: '10px' } }, h('span.mini', { style: { flex: 1 } }, 'Laut Teamdaten liegt Ihre Nettoproduktion bei ' + U.fmtEuro0(ausTeam) + '.'),
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
    } };
})(globalThis.AB = globalThis.AB || {});
