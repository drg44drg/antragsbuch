/* Antragsbuch – Unternehmeragentur: Der Agenturist prüft die Prüfdateien seiner Untervermittler gegen die eigene Abrechnung. */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h, U = AB.util, App = AB.app, G = AB.agentur;
  function kachel(lbl, wert, neben, akzent) { return h('div.karte.kachel.rein' + (akzent ? '.akzent' : ''), null, h('div.lbl', null, lbl), h('div.wert', null, h('span.num', null, wert)), h('div.neben', { title: neben }, neben)); }

  AB.ansichten.agentur = { titel: 'Agentur', icon: 'team', unter: function () { return 'Abrechnung zwischen Unternehmeragentur und Untervermittlern ' + App.p.jahr; },
    sichtbar: function () { return App.p && G.einstellung(App.p).modus === 'agenturist'; },
    zeige: function (el, aktionen, z) {
      var p = App.p, e = G.einstellung(p), ein = p.agenturEingang || (p.agenturEingang = {}), abr = p.agenturAbr || (p.agenturAbr = {});
      var nrn = Object.keys(e.untervermittler).concat(Object.keys(ein), Object.keys(abr)).filter(function (n, i, a) { return n && a.indexOf(n) === i; }).sort();
      aktionen.appendChild(D.btn('Datei einlesen', function () { App.einleseDialog(); }, { klasse: 'haupt-btn', icon: 'hoch' }));
      if (!nrn.length) { el.appendChild(h('div.karte.rein', { style: { textAlign: 'center', padding: '46px 20px' } }, h('h2', null, 'Noch kein Untervermittler angelegt'),
        h('p.muted', { style: { maxWidth: '640px', margin: '8px auto 14px' } }, 'Lesen Sie die Provisionsabrechnung ein, die der Versicherer für Ihren Untervermittler erstellt. Die App rechnet daraus, was dem Untervermittler zusteht und was als Overhead bei der Agentur bleibt. Zusätzlich können Sie die Prüfdatei einlesen, die der Untervermittler aus seinem Antragsbuch exportiert.'),
        D.btn('Datei einlesen', function () { App.einleseDialog(); }, { klasse: 'haupt-btn', icon: 'hoch' }))); return; }
      var nr = nrn.indexOf(z.nr) >= 0 ? z.nr : nrn[0], datei = ein[nr] || null, ab = abr[nr] || null;
      var uv = e.untervermittler[nr] || (e.untervermittler[nr] = { name: (datei && datei.name) || '', art: ab ? 'modell' : 'mb', wert: null });
      if (e.agMb == null) e.agMb = G.AGENTUR_MB;
      var neu = function () { App.zeige('agentur'); }, sichere = function () { App.geaendert({ still: true, ohneRechnen: true }); };
      if (!App.agenturZeilen) App.agenturZeilen = {};
      var uvZeilen = ab ? (App.agenturZeilen[nr] && App.agenturZeilen[nr].ref === ab.gepackt ? App.agenturZeilen[nr].z : (App.agenturZeilen[nr] = { ref: ab.gepackt, z: AB.abrechnung.entpacke(ab.gepackt) }).z) : null;
      var zahlFeld = function (obj, key, label, stellen, platz) {
        var f = h('input', { type: 'text', inputMode: 'decimal', value: obj[key] == null ? '' : U.fmtZahl(obj[key], stellen), placeholder: platz || '', style: { textAlign: 'right' }, 'aria-label': label,
          onchange: function () { var v = f.value.trim() === '' ? null : U.parseZahl(f.value); if (v != null && (isNaN(v) || v < 0)) { f.classList.add('fehler'); return; } if (App.gesperrt()) return; obj[key] = v; if (obj === uv && key !== 'wert') uv.stufe = ''; sichere(); neu(); } });
        return f; };
      var fName = h('input', { type: 'text', value: uv.name || '', placeholder: 'Name', 'aria-label': 'Name des Untervermittlers', onchange: function () { if (App.gesperrt()) return; uv.name = fName.value.trim(); sichere(); } });
      var fStufe = D.auswahl([['', 'frei eingestellt']].concat(G.MODELL.map(function (m) { return [m.id, m.id + ' · Stufe ' + m.stufe + ' · ab ' + U.fmtZahl(m.produktion, 0) + ' MB Produktion']; })), uv.stufe || '', function (v) {
        if (App.gesperrt()) return; var m = G.stufe(v); uv.stufe = v; if (m) { uv.mb = m.mb; uv.gp = m.gp; uv.gpSdk = m.gpSdk; } sichere(); neu(); });
      var unterMin = (uv.mb != null && uv.mb < G.MIN.mb) || (uv.gp != null && uv.gp < G.MIN.gp);
      el.appendChild(h('div.karte.rein', null, h('div.leiste', null, h('h3', null, 'Untervermittler'), nrn.map(function (n) { return h('button.chip' + (n === nr ? '.aktiv' : ''), { type: 'button', onclick: function () { z.nr = n; neu(); } }, n + ((e.untervermittler[n] || {}).name ? ' · ' + e.untervermittler[n].name : '')); }), h('span.frei'),
          h('span.muted.klein', null, (ab ? 'Abrechnung: ' + U.fmtZahl(ab.anzahl, 0) + ' Zeilen' : 'keine Abrechnung') + ' · ' + (datei ? 'Prüfdatei: ' + datei.posten.length + ' Posten' : 'keine Prüfdatei')),
          D.btn('', function () { D.frage('Untervermittler entfernen?', 'Abrechnung, Prüfdatei und Einstellungen zu ' + nr + ' werden aus dem Projekt entfernt.', 'Entfernen', { gefahr: true }).then(function (ja) { if (!ja || App.gesperrt()) return; delete ein[nr]; delete abr[nr]; delete e.untervermittler[nr]; App.geaendert({ ohneRechnen: true }); neu(); }); }, { icon: 'muell', klasse: 'leise gefahr', titel: 'Untervermittler mit seinen Dateien entfernen' })),
        h('div.formraster', { style: { marginTop: '10px' } }, D.feld('Name', fName, 's3'), D.feld('Karrierestufe im Agenturmodell', fStufe, 's3'),
          D.feld('Weitergegebene MB', zahlFeld(uv, 'mb', 'Weitergegebene Monatsbeiträge', 2, 'z. B. 5,5'), 's2'), D.feld('MB der Agentur', zahlFeld(e, 'agMb', 'Monatsbeiträge der Agentur', 2, '7'), 's2'),
          D.feld('Grundpauschale an ihn', zahlFeld(uv, 'gp', 'Grundpauschale an den Untervermittler', 0, 'je Monat'), 's2')),
        h('div.formraster', { style: { marginTop: '6px' } }, D.feld('Grundpauschale vom Versicherer für ihn', zahlFeld(uv, 'gpSdk', 'Grundpauschale des Versicherers für den Untervermittler', 0, 'je Monat'), 's3')),
        unterMin ? h('div.meldung.warn', { style: { marginTop: '8px' } }, 'Laut Agenturmodell müssen mindestens ' + U.fmtZahl(G.MIN.gp, 0) + ' € Grundpauschale und ' + G.MIN.mb + ' MB weitergegeben werden.') : null));

      // ---------- Abrechnung zwischen Agentur und Untervermittler ----------
      if (uvZeilen) {
        var a = G.abrechnungUv(uvZeilen, p.jahr, uv, e.agMb), offen = a.anspruch == null;
        el.appendChild(h('div.raster.r-4', null,
          kachel('Gewertete Produktion', U.fmtEuro0(a.produktion), 'laut Abrechnung des Untervermittlers', true),
          kachel('Provision lt. Abrechnung', U.fmtEuro0(a.brutto + a.laufend), 'Abschluss ' + U.fmtEuro0(a.brutto) + ' · laufend ' + U.fmtEuro0(a.laufend)),
          kachel('Anspruch Untervermittler', offen ? '–' : U.fmtEuro0(a.anspruch), offen ? 'weitergegebene MB fehlen' : U.fmtZahl(uv.mb, 2) + ' von ' + U.fmtZahl(e.agMb, 2) + ' MB · laufende voll'),
          kachel('Overhead Agentur', offen ? '–' : U.fmtEuro0(a.overhead), offen ? '' : 'Provision minus Anspruch')));
        var tu = G.tabelleUv(a), tbU = h('tbody');
        tu.zeilen.concat([tu.summe]).forEach(function (r, ri) { var tr = h('tr', ri === tu.zeilen.length ? { style: { fontWeight: 650 } } : null); r.forEach(function (c, i) { tr.appendChild(h('td' + (i ? '.num' : ''), { style: i ? { textAlign: 'right' } : null }, i === 0 ? c : c === '' ? '–' : i === 6 ? U.fmtZahl(c, 0) : U.fmtEuro(c))); }); tbU.appendChild(tr); });
        var unterU = 'Untervermittler ' + nr + (uv.name ? ' · ' + uv.name : '') + ' · ' + (offen ? 'Satz nicht eingestellt' : U.fmtZahl(uv.mb, 2) + ' von ' + U.fmtZahl(e.agMb, 2) + ' MB') + ' · Stand ' + U.fmtDatum(U.heute());
        el.appendChild(h('div.karte.rein', null, h('div.leiste', null, h('h3', null, 'Abrechnung je Monat'), h('span.muted.klein', null, 'aus „' + ab.datei + '"'), h('span.frei'),
            D.exportBtn('Agenturabrechnung_' + nr + '_' + p.jahr, function () { return Object.assign({ name: 'Abrechnung', titel: 'Abrechnung Agentur und Untervermittler ' + p.jahr, unter: unterU }, tu); }, null, { klasse: 'klein-btn' })),
          h('div', { style: { overflowX: 'auto', marginTop: '8px' } }, h('table.einfach', null, h('thead', null, h('tr', null, tu.spalten.map(function (c, i) { return h('th', { style: i ? { textAlign: 'right' } : null }, c.t); }))), tbU)),
          (uv.gpSdk != null || uv.gp != null) && a.gp.monate ? h('p', { style: { margin: '10px 0 0' } }, 'Grundpauschale für ' + a.gp.monate + ' Monate: vom Versicherer ' + U.fmtEuro0(a.gp.sdk) + ', an den Untervermittler ' + U.fmtEuro0(a.gp.weiter) + ', bei der Agentur bleiben ', h('b', null, U.fmtEuro0(a.gp.differenz)), ' (' + U.fmtEuro0(a.gp.jeMonat) + ' je Monat).') : null,
          (function () { var kv = AB.team.nettoproduktion(uvZeilen, p.jahr).kv, st = G.gpNachProduktion(kv), nx = G.gpNaechste(kv);
            return h('p', { style: { margin: '8px 0 0' } }, 'Staffel des Versicherers nach der Anlaufzeit: Bei ' + U.fmtEuro0(kv) + ' Netto-KV-Eigenproduktion gäbe es ', h('b', null, st ? U.fmtEuro0(st) + ' im Monat' : 'keine Grundvergütung'), nx ? '. Bis zur nächsten Stufe (' + U.fmtEuro0(nx.gp) + ' ab ' + U.fmtEuro0(nx.ab) + ') fehlen ' + U.fmtEuro0(nx.fehlt) + '.' : '. Das ist die höchste Stufe.', kv < 6000 ? ' Bleibt er im zweiten vollen Kalenderjahr unter 6.000 €, entfällt die Grundvergütung.' : ''); })(),
          h('p.mini', null, 'So wird gerechnet: Die Abrechnung des Versicherers für den Untervermittler nennt die Provision zum Satz der Agentur. Dem Untervermittler steht davon der Anteil „weitergegebene MB ÷ MB der Agentur“ zu. Laufende Provisionen (Bestand, Rechnung in Prozent) werden voll weitergegeben. Stornos und Verrechnungen mindern den Anspruch im selben Verhältnis. Maßgeblich ist der Vertrag zwischen Agentur und Untervermittler.')));
      } else el.appendChild(h('div.meldung', null, 'Für diesen Untervermittler liegt noch keine Abrechnung des Versicherers vor. Lesen Sie sie über „Datei einlesen“ im Feld „Abrechnung eines Untervermittlers“ ein. Dann sehen Sie Produktion, Anspruch und Overhead.'));

      // ---------- Prüfdatei des Untervermittlers ----------
      if (!datei) { el.appendChild(h('div.meldung', null, 'Eine Prüfdatei liegt nicht vor. Der Untervermittler kann sie in seinem Antragsbuch über „An Agenturist senden“ erzeugen. Sie wird dann Posten für Posten gegen ' + (uvZeilen ? 'seine Abrechnung' : 'Ihre Abrechnung') + ' gestellt.')); return; }
      if (!uv.art) uv.art = 'mb';
      var modellSatz = uv.mb != null && e.agMb > 0 ? Math.min(1, uv.mb / e.agMb) * 100 : null;
      var anspruch = uv.art === 'modell' ? (modellSatz == null ? null : { art: 'prozent', wert: modellSatz }) : uv.wert != null ? { art: uv.art, wert: uv.wert } : null;
      var erg = G.pruefe(datei, uvZeilen || App.zeilen, anspruch), s = erg.summe;
      var fArt = D.auswahl([['modell', 'Agenturmodell: weitergegebene MB ÷ MB der Agentur'], ['mb', 'Monatsbeiträge je Euro Beitrag'], ['prozent', 'Prozent der Provision']], uv.art, function (v) { if (App.gesperrt()) return; uv.art = v; sichere(); neu(); });
      el.appendChild(h('div.karte.rein', null, h('div.leiste', null, h('h3', null, 'Prüfdatei des Untervermittlers'), h('span.muted.klein', null, 'vom ' + U.fmtDatum((datei.erstellt || '').slice(0, 10)) + ' · geprüft gegen ' + (uvZeilen ? 'seine Abrechnung' : 'meine Abrechnung')), h('span.frei'),
          D.btn('', function () { D.frage('Prüfdatei entfernen?', 'Die Prüfdatei von ' + nr + ' wird aus dem Projekt entfernt.', 'Entfernen', { gefahr: true }).then(function (ja) { if (!ja || App.gesperrt()) return; delete ein[nr]; App.geaendert({ ohneRechnen: true }); neu(); }); }, { icon: 'muell', klasse: 'leise gefahr', titel: 'Prüfdatei entfernen' })),
        h('div.formraster', { style: { marginTop: '10px' } }, D.feld('Anspruch gerechnet als', fArt, 's5'), uv.art === 'modell' ? null : D.feld(uv.art === 'prozent' ? 'Prozent' : 'Monatsbeiträge (MB)', zahlFeld(uv, 'wert', 'Anspruch des Untervermittlers', 2, uv.art === 'prozent' ? 'z. B. 80' : 'z. B. 4'), 's2')),
        anspruch == null ? h('div.meldung.warn', { style: { marginTop: '8px' } }, 'Tragen Sie ein, was diesem Untervermittler laut Vertrag zusteht. Solange der Anspruch fehlt, zeigt die Tabelle nur, ob der Posten in der Abrechnung steht.') : null));
      uv = Object.assign({}, uv, { wert: anspruch ? anspruch.wert : null, art: anspruch ? anspruch.art : uv.art });
      el.appendChild(h('div.raster.r-4', null,
        kachel('Gefordert', U.fmtEuro0(s.gefordert), datei.posten.length + ' Posten in der Prüfdatei'), kachel('Anspruch laut Abrechnung', U.fmtEuro0(s.anspruch), uv.wert == null ? 'Anspruch noch nicht eingestellt' : 'für die Posten in der Abrechnung'),
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
      el.appendChild(h('p.mini', null, 'So wird geprüft: Jeder Posten wird über die Vertragsnummer und die Tarife in der Abrechnung ' + p.jahr + ' gesucht. Liegt die Abrechnung des Untervermittlers vor, wird gegen diese geprüft, sonst gegen Ihre eigene. Der Anspruch ergibt sich aus dem Beitrag bzw. der Provision laut Abrechnung und dem eingestellten Satz. Als Übereinstimmung gilt eine Differenz bis 0,50 €, damit Rundungen je Buchung keine Abweichung auslösen. Die Prüfung ersetzt nicht den Vertrag zwischen Agenturist und Untervermittler.'));
    } };
})(globalThis.AB = globalThis.AB || {});
