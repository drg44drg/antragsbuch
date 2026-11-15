/* Antragsbuch – Unternehmeragentur: Der Agenturist prüft die Prüfdateien seiner Untervermittler gegen die eigene Abrechnung. */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h, U = AB.util, App = AB.app, G = AB.agentur;
  function kachel(lbl, wert, neben, akzent) { return h('div.karte.kachel.rein' + (akzent ? '.akzent' : ''), null, h('div.lbl', null, lbl), h('div.wert', null, h('span.num', null, wert)), h('div.neben', { title: neben }, neben)); }

  AB.ansichten.agentur = { titel: 'Agentur', icon: 'team', unter: function () { return 'Prüfdateien der Untervermittler gegen meine Abrechnung ' + App.p.jahr; },
    sichtbar: function () { return App.p && G.einstellung(App.p).modus === 'agenturist'; },
    zeige: function (el, aktionen, z) {
      var p = App.p, e = G.einstellung(p), ein = p.agenturEingang || (p.agenturEingang = {}), nrn = Object.keys(ein);
      aktionen.appendChild(D.btn('Prüfdatei einlesen', function () { App.einleseDialog(); }, { klasse: 'haupt-btn', icon: 'hoch' }));
      if (!nrn.length) { el.appendChild(h('div.karte.rein', { style: { textAlign: 'center', padding: '46px 20px' } }, h('h2', null, 'Noch keine Prüfdatei eingelesen'),
        h('p.muted', { style: { maxWidth: '620px', margin: '8px auto 14px' } }, 'Ihr Untervermittler wählt in seinem Antragsbuch die Anträge aus, für die er Provision abrechnet, und exportiert sie als Prüfdatei. Lesen Sie diese Datei hier ein: Die App stellt jeden Posten neben Ihre Abrechnung und zeigt, ob er dort steht und ob der geforderte Betrag zum Anspruch passt.'),
        D.btn('Prüfdatei einlesen', function () { App.einleseDialog(); }, { klasse: 'haupt-btn', icon: 'hoch' }))); return; }
      var nr = ein[z.nr] ? z.nr : nrn[0], datei = ein[nr], uv = e.untervermittler[nr] || (e.untervermittler[nr] = { name: datei.name || '', art: 'mb', wert: null });
      var erg = G.pruefe(datei, App.zeilen, uv.wert != null ? { art: uv.art || 'mb', wert: uv.wert } : null), s = erg.summe;
      // Auswahl des Untervermittlers und sein Anspruch
      var fArt = D.auswahl([['mb', 'Monatsbeiträge je Euro Beitrag'], ['prozent', 'Prozent meiner Provision']], uv.art || 'mb', function (v) { if (App.gesperrt()) return; uv.art = v; App.geaendert({ still: true, ohneRechnen: true }); App.zeige('agentur'); });
      var fWert = h('input', { type: 'text', inputMode: 'decimal', value: uv.wert == null ? '' : U.fmtZahl(uv.wert, 2), placeholder: uv.art === 'prozent' ? 'z. B. 80' : 'z. B. 4', style: { textAlign: 'right' }, 'aria-label': 'Anspruch des Untervermittlers',
        onchange: function () { var v = fWert.value.trim() === '' ? null : U.parseZahl(fWert.value); if (v != null && (isNaN(v) || v < 0)) { fWert.classList.add('fehler'); return; } if (App.gesperrt()) return; uv.wert = v; App.geaendert({ still: true, ohneRechnen: true }); App.zeige('agentur'); } });
      var fName = h('input', { type: 'text', value: uv.name || '', placeholder: 'Name', 'aria-label': 'Name des Untervermittlers', onchange: function () { if (App.gesperrt()) return; uv.name = fName.value.trim(); App.geaendert({ still: true, ohneRechnen: true }); } });
      el.appendChild(h('div.karte.rein', null, h('div.leiste', null, h('h3', null, 'Untervermittler'), nrn.map(function (n) { return h('button.chip' + (n === nr ? '.aktiv' : ''), { type: 'button', onclick: function () { z.nr = n; App.zeige('agentur'); } }, n + ((e.untervermittler[n] || {}).name ? ' · ' + e.untervermittler[n].name : '')); }), h('span.frei'),
          h('span.muted.klein', null, 'Datei vom ' + U.fmtDatum((datei.erstellt || '').slice(0, 10)) + ' · ' + datei.posten.length + ' Posten'),
          D.btn('', function () { D.frage('Prüfdatei entfernen?', 'Die Prüfdatei von ' + nr + ' wird aus dem Projekt entfernt. Die Einstellung zum Anspruch bleibt.', 'Entfernen', { gefahr: true }).then(function (ja) { if (!ja || App.gesperrt()) return; delete ein[nr]; App.geaendert({ ohneRechnen: true }); App.zeige('agentur'); }); }, { icon: 'muell', klasse: 'leise gefahr', titel: 'Prüfdatei entfernen' })),
        h('div.formraster', { style: { marginTop: '10px' } }, D.feld('Name', fName, 's4'), D.feld('Anspruch gerechnet als', fArt, 's4'), D.feld(uv.art === 'prozent' ? 'Prozent' : 'Monatsbeiträge (MB)', fWert, 's2')),
        uv.wert == null ? h('div.meldung.warn', { style: { marginTop: '8px' } }, 'Tragen Sie ein, was diesem Untervermittler laut Vertrag zusteht. Solange der Anspruch fehlt, zeigt die Tabelle nur, ob der Posten in Ihrer Abrechnung steht.') : null));
      el.appendChild(h('div.raster.r-4', null,
        kachel('Gefordert', U.fmtEuro0(s.gefordert), datei.posten.length + ' Posten in der Prüfdatei', true), kachel('Anspruch laut Abrechnung', U.fmtEuro0(s.anspruch), uv.wert == null ? 'Anspruch noch nicht eingestellt' : 'für die Posten in meiner Abrechnung'),
        kachel('Differenz', U.fmtEuro0(s.differenz), s.differenz > 0.5 ? 'mehr gefordert als Anspruch' : s.differenz < -0.5 ? 'weniger gefordert als Anspruch' : 'passt'),
        kachel('Ergebnis', s.ok + ' von ' + datei.posten.length, s.abweichung + ' Abweichung · ' + s.fehlt + ' nicht in der Abrechnung' + (s.ohneNr ? ' · ' + s.ohneNr + ' ohne Nummer' : ''))));
      var filter = D.auswahl([['', 'Alle Posten'], ['ok', 'Stimmt überein'], ['abweichung', 'Abweichung'], ['fehlt', 'Nicht in der Abrechnung'], ['ohneNr', 'Vertragsnummer fehlt']], z.filter || '', function (v) { z.filter = v; setze(); }, { style: { width: '240px' } });
      var name = 'Agenturpruefung_' + nr + '_' + p.jahr, unter = 'Untervermittler ' + nr + (uv.name ? ' · ' + uv.name : '') + ' · Anspruch ' + (uv.wert == null ? 'nicht eingestellt' : U.fmtZahl(uv.wert, 2) + (uv.art === 'prozent' ? ' % der Provision' : ' MB')) + ' · geprüft am ' + U.fmtDatum(U.heute());
      el.appendChild(h('div.leiste', null, filter, h('span.frei'), D.exportBtn(name, function () { return Object.assign({ name: 'Prüfung', titel: 'Prüfung der Abrechnung ' + p.jahr, unter: unter }, G.tabelle(erg)); }),
        D.btn('', function () { var t = G.tabelle(erg); D.drucke('Prüfung der Abrechnung ' + p.jahr, unter, t.spalten.map(function (c) { return { t: c.t, r: c.typ === 'euro' }; }), t.zeilen.map(function (r) { return r.map(function (v, i) { return t.spalten[i].typ === 'euro' && typeof v === 'number' ? U.fmtEuro(v) : v; }); })); }, { icon: 'druck', titel: 'Drucken oder als PDF speichern' })));
      var box = h('div', { style: { height: Math.min(560, 110 + erg.zeilen.length * 50) + 'px', display: 'flex', flex: 'none' } }); el.appendChild(box);
      var marke = { ok: '.gut', abweichung: '.krit', fehlt: '.warn', ohneNr: '.warn' };
      var tab = AB.tabelle(box, { hoehe: 50, leer: 'Keine Posten.', spalten: [
        { t: 'Pos.', b: '50px', r: true, w: function (r) { return h('span.num.muted', null, r.pos || ''); }, s: function (r) { return +r.pos || 0; } },
        { t: 'Kunde · Vertrag', b: 'minmax(160px, 1.4fr)', k: 'zwei', w: function (r) { return [h('span', { style: { fontWeight: 600 } }, r.kunde || '–'), h('small', null, (r.vnr || 'ohne Vertragsnummer') + ' · ' + r.tarife)]; }, s: function (r) { return r.kunde; } },
        { t: 'In der Abrechnung', b: '128px', k: 'zwei', w: function (r) { return [h('span.marke-s' + (r.inAbrechnung ? '.gut' : '.warn'), null, r.inAbrechnung ? 'ja' : 'nein'), h('small', null, r.inAbrechnung ? 'gebucht ' + U.fmtDatum(r.gebuchtAm) + (r.storno ? ' · mit Storno' : '') : r.andereTarife ? 'Vertrag da, andere Tarife' : '')]; }, s: function (r) { return r.inAbrechnung ? 1 : 0; } },
        { t: 'Beitrag', b: '120px', r: true, k: 'zwei', w: function (r) { return [U.fmtEuro(r.beitragGemeldet), h('small', null, r.inAbrechnung ? 'Abr. ' + U.fmtEuro(r.beitragAbr) : '')]; }, s: function (r) { return r.beitragGemeldet; } },
        { t: 'Gefordert', b: '104px', r: true, w: function (r) { return U.fmtEuro(r.gefordert); }, s: function (r) { return r.gefordert; } },
        { t: 'Anspruch', b: '104px', r: true, w: function (r) { return r.anspruch == null ? '–' : U.fmtEuro(r.anspruch); }, s: function (r) { return r.anspruch || 0; } },
        { t: 'Differenz', b: '104px', r: true, w: function (r) { return r.differenz == null ? '–' : h('span.num', { style: Math.abs(r.differenz) > 0.5 ? { color: 'var(--crit-ink)', fontWeight: 650 } : null, title: r.differenz > 0.5 ? 'mehr gefordert als Anspruch' : r.differenz < -0.5 ? 'weniger gefordert als Anspruch' : 'passt' }, (r.differenz > 0 ? '+' : '') + U.fmtEuro(r.differenz)); }, s: function (r) { return r.differenz || 0; } },
        { t: 'Ergebnis', b: '190px', w: function (r) { return h('span.marke-s' + marke[r.urteil], null, G.URTEIL[r.urteil]); }, s: function (r) { return r.urteil; } }] });
      function setze() { tab.setze(erg.zeilen.filter(function (r) { return !z.filter || r.urteil === z.filter; })); }
      setze();
      el.appendChild(h('p.mini', null, 'So wird geprüft: Jeder Posten wird über die Vertragsnummer und die Tarife in Ihrer Abrechnung ' + p.jahr + ' gesucht. Der Anspruch ergibt sich aus dem Beitrag bzw. der Provision laut Ihrer Abrechnung und dem eingestellten Satz; als Übereinstimmung gilt eine Differenz bis 0,50 €. Die Prüfung ersetzt nicht den Vertrag zwischen Agenturist und Untervermittler.'));
    } };
})(globalThis.AB = globalThis.AB || {});
