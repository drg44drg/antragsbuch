/* Antragsbuch – Banken: Was kommt aus welcher Bank? Ziele je Bank, Kreisdiagramm, Reporting für die Bank. */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h, U = AB.util, G = AB.dia, App = AB.app, M = AB.model, K = AB.bank;
  function kachel(lbl, wert, neben, akzent) { return h('div.karte.kachel.rein' + (akzent ? '.akzent' : ''), null, h('div.lbl', null, lbl), h('div.wert', null, h('span.num', null, wert)), h('div.neben', { title: neben }, neben)); }

  AB.ansichten.banken = { titel: 'Banken', icon: 'team', unter: function () { return 'Produktion mit Beteiligung einer Bank laut Abrechnung ' + App.p.jahr; },
    sichtbar: function () { return (App.zeilen || []).some(function (z) { return z.beteil; }); },
    zeige: function (el, aktionen, z) {
      var p = App.p, alle = K.rechne(App.zeilen, p.jahr), liste = alle.filter(function (b) { return z.alleBeteiligten || b.bank; });
      if (!alle.length) { el.appendChild(h('div.karte.rein', { style: { textAlign: 'center', padding: '46px 20px' } }, h('h2', null, 'Keine Bankbeteiligung gefunden'), h('p.muted', { style: { maxWidth: '560px', margin: '8px auto 0' } }, 'In der Abrechnung ' + p.jahr + ' steht in der Spalte „Beteiligte Vermittler" keine Bank. Sobald dort Buchungen mit einer Bank erscheinen, sehen Sie hier Produktion, Stückzahlen und Ihr Ziel je Bank.'))); return; }
      var gesamt = liste.reduce(function (s, b) { return s + b.prod; }, 0), np = AB.team.nettoproduktion(App.zeilen, p.jahr);
      aktionen.appendChild(D.exportBtn('Banken_' + p.jahr, function () { return Object.assign({ name: 'Banken', titel: 'Banken ' + p.jahr, unter: 'Produktion mit Bankbeteiligung laut Abrechnung · Stand ' + U.fmtDatum(U.heute()) }, K.tabelle(p, liste)); }));
      var b = liste.find(function (x) { return x.nr === z.nr; }) || liste[0];
      el.appendChild(h('div.raster.r-4', null,
        kachel('Produktion über Banken', U.fmtEuro0(gesamt), np.gesamt ? U.fmtZahl(gesamt / np.gesamt * 100, 0) + ' % meiner Nettoproduktion' : '', true),
        kachel('Banken mit Geschäft', String(liste.filter(function (x) { return x.bank && x.prod > 0.005; }).length), liste.length + ' Beteiligte in der Abrechnung'),
        kachel('Stärkste Bank', liste[0] ? U.fmtEuro0(liste[0].prod) : '–', liste[0] ? (K.ziel(p, liste[0]).name || liste[0].nr) : ''),
        kachel('Aus Dynamik', U.fmtEuro0(liste.reduce(function (s, x) { return s + x.dynamik; }, 0)), 'Erhöhungen der Pflegezusatztarife')));
      // links die Liste, rechts die gewählte Bank
      var links = h('div.karte.rein', { style: { padding: '12px 10px', alignSelf: 'start', display: 'flex', flexDirection: 'column', gap: '4px' } },
        h('div.leiste', { style: { padding: '0 8px 6px' } }, h('h3', null, 'Banken'), h('span.frei'), h('label.schalter.klein', null, h('input', { type: 'checkbox', checked: !!z.alleBeteiligten, onchange: function () { z.alleBeteiligten = this.checked; App.zeige('banken'); } }), 'auch andere Beteiligte')));
      var max = Math.max.apply(null, liste.map(function (x) { return Math.abs(x.prod); }).concat([1]));
      liste.forEach(function (x) {
        var zi = K.ziel(p, x);
        links.appendChild(h('button.bankzeile' + (b && x.nr === b.nr ? '.aktiv' : ''), { type: 'button', onclick: function () { z.nr = x.nr; App.zeige('banken'); } },
          h('span.n', null, h('b', null, zi.name || x.nr), h('small', null, x.nr + (x.bank ? '' : ' · ' + (x.rolle || 'Beteiligter')) + (zi.grad != null ? ' · ' + U.fmtZahl(zi.grad * 100, 0) + ' % vom Zeitziel' : ''))),
          h('span.w', null, h('span.num', null, U.fmtEuro0(x.prod)), h('i', { style: { width: Math.max(2, Math.abs(x.prod) / max * 100) + '%' } }))));
      });
      var rechts = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 } });
      el.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) minmax(0, 1fr)', gap: '16px', alignItems: 'start' } }, links, rechts));
      if (!b) return;
      var zi = K.ziel(p, b), dRing = h('div'), dMon = h('div'), monat = b.stand ? U.MONATE[b.stand - 1] : '–';
      var fName = h('input', { type: 'text', value: zi.name, placeholder: 'Name der Bank', 'aria-label': 'Name der Bank', onchange: function () { if (App.gesperrt()) return; K.setze(p, b.nr, 'name', fName.value.trim()); App.geaendert({ still: true, ohneRechnen: true }); App.zeige('banken'); } });
      var fZiel = h('input', { type: 'text', inputMode: 'decimal', value: zi.plan == null ? '' : U.fmtZahl(zi.plan, 0), placeholder: 'z. B. 6.000', 'aria-label': 'Planproduktion der Bank', style: { textAlign: 'right' },
        onchange: function () { var v = fZiel.value.trim() === '' ? null : U.parseZahl(fZiel.value); if (v != null && (isNaN(v) || v < 0)) { fZiel.classList.add('fehler'); return; } if (App.gesperrt()) return; K.setze(p, b.nr, 'ziel', v); App.geaendert({ still: true, ohneRechnen: true }); App.zeige('banken'); } });
      var reportName = 'Bankenreporting_' + p.jahr + '_' + b.nr;
      var druck = function () {
        var rep = K.reporting(p, b)[0];
        D.drucke(rep.titel, rep.unter, [{ t: '' }, { t: 'Januar bis ' + monat, r: true }, { t: 'Hochrechnung ' + p.jahr, r: true }], rep.zeilen.map(function (r) { return r.map(function (v, i) { return typeof v === 'number' ? (/%/.test(r[0]) ? U.fmtZahl(v, 0) + ' %' : /^(Verträge|Versicherte|Neue)/.test(r[0]) ? U.fmtZahl(v, 0) : U.fmtEuro0(v)) : v; }); }));
      };
      rechts.appendChild(h('div.karte.rein', null, h('div.leiste', null, h('h3', null, zi.name || 'Bank ' + b.nr), h('span.muted.klein', null, 'Vermittler-Nr. ' + b.nr + (b.rolle ? ' · ' + b.rolle : '')), h('span.frei'),
          D.btn('Reporting', function () { D.excel(reportName + '.xlsx', K.reporting(p, b)); }, { icon: 'runter', titel: 'Reporting für diese Bank als Excel-Datei' }), D.btn('', druck, { icon: 'druck', titel: 'Reporting drucken oder als PDF speichern' })),
        h('div.formraster', { style: { marginTop: '10px' } }, D.feld('Name der Bank', fName, 's5'), D.feld('Planproduktion ' + p.jahr + ' (€ MB)', fZiel, 's3'),
          h('div.feld.s4', null, h('span', null, 'Zeitzielerreichung bis ' + monat), zi.grad != null ? h('div', null, h('div', { style: { position: 'relative', height: '12px', borderRadius: '99px', background: 'var(--surface-2)', margin: '10px 0 4px' } },
            h('div.hb.dia', { style: { position: 'absolute', left: 0, top: 0, bottom: 0, width: Math.min(100, zi.grad * 100) + '%', borderRadius: '99px', background: zi.grad >= 1 ? 'var(--good)' : 'var(--accent)' } })),
            h('span.klein', null, h('b', null, U.fmtZahl(zi.grad * 100, 0) + ' %'), ' · Soll ' + U.fmtEuro0(zi.zeitziel) + ' · es fehlen im Jahr noch ' + U.fmtEuro0(zi.fehlt))) : h('span.muted.klein', { style: { paddingTop: '10px' } }, 'Planproduktion eintragen, dann wird verglichen.')))));
      rechts.appendChild(h('div.raster.r-4', null,
        kachel('Produktion', U.fmtEuro0(b.prod), 'Januar bis ' + monat, true), kachel('Hochrechnung ' + p.jahr, U.fmtEuro0(b.hr), zi.hrGrad != null ? U.fmtZahl(zi.hrGrad * 100, 0) + ' % der Planproduktion' : 'bei gleichem Verlauf'),
        kachel('Personen', String(b.personen), b.vertraege + ' Verträge · ' + b.neuePersonen + ' neu'), kachel('Meine Provision', U.fmtEuro0(b.prov + b.provLaufend), b.provLaufend ? 'davon laufend ' + U.fmtEuro0(b.provLaufend) : 'aus dem Geschäft mit dieser Bank')));
      rechts.appendChild(h('div.raster.r-2', null,
        h('div.karte.rein', null, h('h3', null, 'Woraus besteht die Produktion?'), h('div.unter', null, 'nach Produkt · Zusatz ' + U.fmtEuro0(b.zusatz) + ' · aus Dynamik ' + U.fmtEuro0(b.dynamik)), dRing),
        h('div.karte.rein', null, h('h3', null, 'Produktion je Monat'), h('div.unter', null, 'Nettoproduktion laut Abrechnung'), dMon)));
      rechts.appendChild(h('p.mini', null, 'Grundlage ist allein Ihre Provisionsabrechnung: Gezählt wird, was dort mit dieser Bank als Beteiligter gebucht ist. Bestand, Vorjahre, Bonifikation und der Ertrag der Bank stehen nicht in der Abrechnung und fehlen deshalb. Die Hochrechnung setzt den bisherigen Verlauf aufs Jahr fort.'));
      requestAnimationFrame(function () {
        var teile = Object.keys(b.bereiche).filter(function (k) { return b.bereiche[k] > 0.005; }).sort(function (x, y) { return b.bereiche[y] - b.bereiche[x]; }).map(function (k) { return { name: M.bereich[k] ? M.bereich[k].kurz : k, wert: b.bereiche[k], farbe: G.bereichFarbe(k) }; });
        if (teile.length) G.ring(dRing, { titel: 'Produktion nach Produkt', format: U.fmtEuro, mitte: { wert: U.fmtEuro0(b.prod), label: 'Produktion' }, teile: teile }); else dRing.appendChild(h('p.muted', null, 'Keine positive Produktion in diesem Jahr.'));
        G.balken(dMon, { titel: 'Produktion je Monat', kategorien: U.MONATE_KURZ, kategorienLang: U.MONATE, format: U.fmtEuro0, hoehe: 220, reihen: [{ name: 'Produktion', farbe: G.FARBEN[0], werte: b.monate }] });
      });
    } };
})(globalThis.AB = globalThis.AB || {});
