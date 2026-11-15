/* Antragsbuch – Analyse: Wie groß sind meine Anträge, wo ist mehr zu holen? */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h, U = AB.util, G = AB.dia, App = AB.app, M = AB.model;
  function kachel(lbl, wert, neben, akzent) { return h('div.karte.kachel.rein' + (akzent ? '.akzent' : ''), null, h('div.lbl', null, lbl), h('div.wert', null, h('span.num', null, wert)), h('div.neben', { title: neben }, neben)); }

  AB.ansichten.analyse = { titel: 'Analyse', icon: 'ziel', unter: function () { return 'Meine Anträge ' + App.p.jahr + ': Wie groß sind sie, und wo ist mehr zu holen?'; },
    zeige: function (el) {
      var p = App.p, o = AB.analyse.rechne(p, p.jahr);
      if (!o.n) { el.appendChild(h('div.karte.rein', { style: { textAlign: 'center', padding: '46px 20px' } }, h('h2', null, 'Noch keine Anträge zum Auswerten'), h('p.muted', { style: { maxWidth: '560px', margin: '8px auto 0' } }, 'Sobald Sie Neugeschäft oder Mehrbeiträge für ' + p.jahr + ' eingetragen haben, sehen Sie hier Ihren größten und kleinsten Antrag, den Schnitt je Produkt und was ein etwas größerer Antrag bringen würde.'))); return; }
      el.appendChild(h('div.raster.r-4', null,
        kachel('Mein mittlerer Antrag', U.fmtEuro0(o.median), o.n + ' Anträge · Schnitt ' + U.fmtEuro0(o.schnitt), true),
        kachel('Größter Antrag', U.fmtEuro0(o.groesster), o.top[0].name + ' · ' + (M.bereich[o.top[0].bereich] || {}).kurz),
        kachel('Kleinster Antrag', U.fmtEuro0(o.kleinster), o.klein.name + ' · ' + (M.bereich[o.klein.bereich] || {}).kurz),
        kachel('Anträge mit Familie', o.familien.n + ' von ' + o.n, o.familien.n ? 'im Schnitt ' + U.fmtEuro0(o.familien.schnitt) + ' statt ' + U.fmtEuro0(o.familien.einzelSchnitt) + ' bei Einzelpersonen' : 'mehrere versicherte Personen in einem Antrag')));
      // Was wäre, wenn …
      var wenn = h('tbody');
      o.wenn.forEach(function (x) { wenn.appendChild(h('tr', null, h('td', null, 'Wenn ' + x.text), h('td.num', { style: { textAlign: 'right', fontWeight: 700 } }, '+ ' + U.fmtEuro0(x.beitrag)), h('td.num', { style: { textAlign: 'right' } }, x.provision ? '+ ' + U.fmtEuro0(x.provision) : '–'))); });
      var dK = h('div'), dB = h('div');
      el.appendChild(h('div.raster.r-2', null,
        h('div.karte.rein', null, h('h3', null, 'Da ist mehr zu holen'), h('div.unter', null, 'gerechnet mit Ihren eigenen Anträgen und Ihrer durchschnittlichen Provision je Euro Beitrag'),
          h('div', { style: { overflowX: 'auto' } }, h('table.einfach', null, h('thead', null, h('tr', null, h('th', null, ''), h('th', { style: { textAlign: 'right' } }, 'Monatsbeitrag'), h('th', { style: { textAlign: 'right' } }, 'Provision'))), wenn)),
          o.be.voll ? h('p.klein.muted', { style: { marginTop: '8px' } }, o.be.mit + ' von ' + o.be.voll + ' Vollversicherungen haben eine Beitragsentlastung.') : null),
        h('div.karte.rein', null, h('h3', null, 'So groß sind meine Anträge'), h('div.unter', null, 'Anzahl der Anträge je Größenklasse (Monatsbeitrag)'), dK)));
      // je Produktklasse
      var tb = h('tbody');
      o.bereiche.forEach(function (b) { tb.appendChild(h('tr', null, h('td', null, h('span', { style: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: G.bereichFarbe(b.id), marginRight: '8px' } }), h('b', null, b.name)),
        h('td.num', { style: { textAlign: 'right' } }, b.n), h('td.num', { style: { textAlign: 'right' } }, U.fmtEuro0(b.summe)), h('td.num', { style: { textAlign: 'right', fontWeight: 700 } }, U.fmtEuro0(b.median)),
        h('td.num', { style: { textAlign: 'right' } }, U.fmtEuro0(b.schnitt)), h('td.num', { style: { textAlign: 'right' } }, U.fmtEuro0(b.min)), h('td.num', { style: { textAlign: 'right' } }, U.fmtEuro0(b.max)))); });
      var top = h('tbody');
      o.top.forEach(function (x, i) { top.appendChild(h('tr', { style: { cursor: 'pointer' }, title: 'Antrag öffnen', onclick: function () { var a = p.antraege.find(function (y) { return y.id === x.id; }); if (a) AB.maske.oeffne(a); } },
        h('td.num.muted', null, i + 1), h('td', null, h('b', null, x.name), h('div.mini', null, 'Pos. ' + (x.nr || '–') + ' · ' + (M.bereich[x.bereich] || {}).kurz + ' · ' + x.tarife)), h('td.num', { style: { textAlign: 'right' } }, x.personen > 1 ? x.personen + ' Personen' : '1 Person'), h('td.num', { style: { textAlign: 'right', fontWeight: 700 } }, U.fmtEuro(x.beitrag)))); });
      el.appendChild(h('div.raster.r-2', null,
        h('div.karte.rein', null, h('h3', null, 'Nach Produktklasse'), h('div.unter', null, 'mittlerer, kleinster und größter Antrag je Bereich'),
          h('div', { style: { overflowX: 'auto' } }, h('table.einfach', null, h('thead', null, h('tr', null, ['Bereich', 'Anträge', 'Summe', 'Mitte', 'Schnitt', 'Kleinster', 'Größter'].map(function (t, i) { return h('th', { style: i ? { textAlign: 'right' } : null }, t); }))), tb)), dB),
        h('div.karte.rein', null, h('h3', null, 'Meine zehn größten Anträge'), h('div.unter', null, 'Was haben diese Kunden gemeinsam? Klick öffnet den Antrag.'),
          h('div', { style: { overflowX: 'auto' } }, h('table.einfach', null, top)))));
      el.appendChild(h('p.mini', null, 'Gezählt werden Neugeschäft und Mehrbeiträge des Jahres ohne abgelehnte, widerrufene und stornierte Anträge. „Mitte" ist der Median: die Hälfte Ihrer Anträge liegt darunter, die Hälfte darüber. Die Provision ist mit Ihren Provisionsregeln gerechnet und unverbindlich.'));
      requestAnimationFrame(function () {
        G.balken(dK, { titel: 'Anträge je Größenklasse', kategorien: o.klassen.map(function (k) { return k.name.replace(' €', ''); }), kategorienLang: o.klassen.map(function (k) { return k.name; }), format: function (v) { return U.fmtZahl(v, 0); }, hoehe: 220,
          reihen: [{ name: 'Anträge', farbe: G.FARBEN[0], werte: o.klassen.map(function (k) { return k.n; }) }] });
        G.quer(dB, { format: U.fmtEuro0, zeilen: o.bereiche.map(function (b) { return { name: b.name, wert: b.median, farbe: G.bereichFarbe(b.id), zusatz: b.n + ' Anträge' }; }) });
      });
    } };
})(globalThis.AB = globalThis.AB || {});
