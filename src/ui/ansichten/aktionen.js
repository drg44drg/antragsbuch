/* Antragsbuch – Aktionen: Kundenliste einlesen, Kontakte nachhalten, Auswertung und Export. */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h, U = AB.util, K = AB.aktionen, G = AB.dia, App = AB.app;
  var ZFARBE = { unbearbeitet: 'var(--s0)', nichtErreicht: 'var(--s4)', kontaktiert: 'var(--s6)', termin: 'var(--s1)', abschluss: 'var(--s3)', keinInteresse: 'var(--s2)' };

  function kachel(lbl, wert, neben, akzent) {
    return h('div.karte.kachel.rein' + (akzent ? '.akzent' : ''), null, h('div.lbl', null, lbl), h('div.wert', null, h('span.num', null, wert)), h('div.neben', { title: neben }, neben));
  }
  function neueAktion() {
    var p = App.p, d = D.dialog('Neue Aktion', { klasse: 'schmal' });
    var n = h('input', { type: 'text', placeholder: 'z. B. Anschreiben Altersvorsorgedepot' }), a = h('input', { type: 'text', placeholder: 'z. B. Mailing, Beitragsanpassung, Geburtstag' }), f = h('input', { type: 'date' });
    function ok() { if (!n.value.trim()) { n.classList.add('fehler'); n.focus(); return; } if (App.gesperrt()) return;
      var ak = K.neu(n.value.trim()); ak.anlass = a.value.trim(); ak.frist = f.value; p.aktionen.push(ak); d.zu(); App.zustand.aktionen = { id: ak.id }; App.geaendert(); }
    D.anhaengen(d.rumpf, [D.feld('Name der Aktion', n, null, true), D.feld('Anlass', a), D.feld('Soll erledigt sein bis', f)]);
    D.anhaengen(d.fuss, [h('span', { style: { flex: 1 } }), D.btn('Abbrechen', d.zu), D.btn('Anlegen', ok, { klasse: 'haupt-btn', taste: 'Enter' })]);
    d.el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
    n.focus();
  }
  /** Kundenliste einlesen: Spalten für Vertragsnummer und Name wählen. */
  function listeEinlesen(aktion, tab, name) {
    var zl = tab.blaetter[0].zeilen, kIdx = AB.vdienst.kopfzeile(zl), kopf = (zl[kIdx] || []).map(function (c) { return c == null ? '' : String(c); });
    var rate = AB.vdienst.rate(kopf), map = { vnr: rate.vnr, name: rate.name, vorname: rate.vorname };
    var opt = [['', '– nicht vorhanden –']].concat(kopf.map(function (k, i) { return [String(i), k || 'Spalte ' + (i + 1)]; }));
    var d = D.dialog('Kundenliste einlesen', { klasse: 'mittel' }), info = h('div.muted.klein');
    function sel(f, label) { return D.feld(label, D.auswahl(opt, map[f] == null ? '' : String(map[f]), function (v) { map[f] = v === '' ? null : +v; zeige(); }), 's4'); }
    function zeige() { var e = K.kundenAusTabelle(zl, kIdx, map); info.textContent = e.kunden.length + ' Kunden erkannt' + (e.spalten.length ? ' · zusätzlich übernommen: ' + e.spalten.join(', ') : '') + (e.kunden[0] ? ' · erster Eintrag: ' + (e.kunden[0].name || e.kunden[0].vnr) : ''); }
    D.anhaengen(d.rumpf, [h('p.muted', { style: { margin: 0 } }, '„' + name + '": Welche Spalten enthalten Vertragsnummer und Name? Bis zu sechs weitere Spalten werden als Zusatzinfo übernommen.'),
      h('div.formraster', null, sel('vnr', 'Vertrags-/Mitgliedsnummer'), sel('name', 'Name'), sel('vorname', 'Vorname (falls eigene Spalte)')), info,
      aktion.kunden.length ? h('div.meldung.warn', null, 'Die Aktion enthält bereits ' + aktion.kunden.length + ' Kunden. Die neuen werden angehängt; schon vorhandene Vertragsnummern werden übersprungen.') : null]);
    D.anhaengen(d.fuss, [h('span', { style: { flex: 1 } }), D.btn('Abbrechen', d.zu), D.btn('Übernehmen', function () {
      if (App.gesperrt()) return;
      var e = K.kundenAusTabelle(zl, kIdx, map), da = {}, neu = 0;
      aktion.kunden.forEach(function (k) { if (k.vnr) da[U.normVnr(k.vnr)] = 1; });
      if (!aktion.kunden.length) aktion.spalten = e.spalten;
      e.kunden.forEach(function (k) { if (k.vnr && da[U.normVnr(k.vnr)]) return; aktion.kunden.push(k); neu++; });
      d.zu(); App.geaendert(); D.toast(neu + ' Kunden übernommen.');
    }, { klasse: 'haupt-btn' })]);
    zeige();
  }

  function uebersicht(el, aktionen, p) {
    aktionen.appendChild(D.btn('Neue Aktion', neueAktion, { klasse: 'haupt-btn', icon: 'plus' }));
    if (!p.aktionen.length) {
      el.appendChild(h('div.karte.rein', { style: { textAlign: 'center', padding: '46px 20px' } }, h('h2', null, 'Noch keine Aktion'),
        h('p.muted', { style: { maxWidth: '620px', margin: '8px auto 14px' } }, 'Eine Aktion ist zum Beispiel ein Anschreiben an 30 Kunden. Legen Sie die Aktion an, lesen Sie die Kundenliste ein (Excel oder CSV) und halten Sie je Kunde fest, wie Sie ihn erreicht haben und was daraus wurde. Die Auswertung entsteht von selbst.'),
        D.btn('Erste Aktion anlegen', neueAktion, { klasse: 'haupt-btn', icon: 'plus' })));
      return;
    }
    var ges = { kunden: 0, bearbeitet: 0, abschluss: 0, mb: 0 }, raster = h('div.raster.r-3');
    p.aktionen.slice().reverse().forEach(function (a) {
      var k = K.kennzahlen(a); ges.kunden += k.kunden; ges.bearbeitet += k.bearbeitet; ges.abschluss += k.zustand.abschluss; ges.mb += k.mb;
      var spur = h('div', { style: { display: 'flex', height: '10px', borderRadius: '99px', overflow: 'hidden', background: 'var(--surface-2)', margin: '10px 0 6px', gap: '2px' } });
      Object.keys(K.ZUSTAENDE).forEach(function (zu) { if (k.zustand[zu]) spur.appendChild(h('div', { title: K.ZUSTAENDE[zu] + ': ' + k.zustand[zu], style: { flex: k.zustand[zu], background: ZFARBE[zu] } })); });
      raster.appendChild(h('button.wahl', { type: 'button', style: { flexDirection: 'column', alignItems: 'stretch', gap: 0 }, onclick: function () { App.zeige('aktionen', { id: a.id }); } },
        h('div.leiste', null, h('b', { style: { flex: 1 } }, a.name), k.ueberfaellig ? h('span.marke-s.krit', null, k.ueberfaellig + ' überfällig') : a.frist ? h('span.marke-s', null, 'bis ' + U.fmtDatum(a.frist)) : null),
        h('span', null, (a.anlass || 'ohne Anlass') + ' · seit ' + U.fmtDatum(a.start)), spur,
        h('span', null, k.kunden + ' Kunden · ' + U.fmtZahl(k.quoteBearbeitet * 100, 0) + ' % bearbeitet · ' + k.zustand.abschluss + (k.zustand.abschluss === 1 ? ' Abschluss · ' : ' Abschlüsse · ') + U.fmtEuro(k.mb))));
    });
    el.appendChild(h('div.raster.r-4', null, kachel('Aktionen', String(p.aktionen.length), 'in diesem Projekt', true), kachel('Kunden angesprochen', ges.bearbeitet + ' / ' + ges.kunden, ges.kunden ? U.fmtZahl(ges.bearbeitet / ges.kunden * 100, 0) + ' % bearbeitet' : ''),
      kachel('Abschlüsse', String(ges.abschluss), ges.bearbeitet ? U.fmtZahl(ges.abschluss / ges.bearbeitet * 100, 1) + ' % der Bearbeiteten' : ''), kachel('Monatsbeitrag aus Aktionen', U.fmtEuro(ges.mb), 'aus Abschlüssen')));
    el.appendChild(raster);
  }

  function detail(el, aktionen, p, a, z) {
    var k = K.kennzahlen(a), wahl = h('input', { type: 'file', hidden: true, accept: '.csv,.txt,.xlsx,.xlsm', onchange: async function () {
      try { var f = wahl.files[0], r = await App.lies(new Uint8Array(await f.arrayBuffer()), f.name, { nurAbrechnung: true }); if (r.art !== 'tabelle') throw new Error('Das ist keine einfache Kundenliste (erkannt als ' + r.art + ').'); listeEinlesen(a, r, f.name); }
      catch (e) { D.toast(e.message || String(e), { krit: true }); } wahl.value = ''; } });
    el.appendChild(wahl);
    var fFrist = h('input', { type: 'date', value: a.frist || '', style: { width: '150px' }, onchange: function () { a.frist = fFrist.value; App.geaendert(); } });
    el.appendChild(h('div.leiste', null, D.btn('← Alle Aktionen', function () { App.zustand.aktionen = {}; App.zeige('aktionen'); }, { klasse: 'leise' }), h('span.muted.klein', null, (a.anlass ? a.anlass + ' · ' : '') + 'gestartet am ' + U.fmtDatum(a.start)), h('span.klein.muted', null, 'erledigt bis'), fFrist,
      k.ueberfaellig ? h('span.marke-s.krit', null, k.ueberfaellig + ' Kunden überfällig') : k.tageBisFrist != null && k.tageBisFrist >= 0 ? h('span.marke-s', null, 'noch ' + k.tageBisFrist + ' Tage') : null, h('span.frei'),
      a.kunden.length ? D.btn('Weitere Kunden einlesen', function () { wahl.click(); }, { icon: 'hoch' }) : null,
      D.exportBtn('Aktion_' + a.name.replace(/[^\wäöüÄÖÜß-]+/g, '_'), function () { return Object.assign({ name: a.name.slice(0, 28), titel: 'Aktion: ' + a.name, unter: (a.anlass ? a.anlass + ' · ' : '') + k.kunden + ' Kunden · ' + k.bearbeitet + ' bearbeitet · ' + k.zustand.abschluss + ' Abschlüsse · Stand ' + U.fmtDatum(U.heute()) }, K.tabelle(a)); }),
      D.btn('', function () { var t = K.tabelle(a); D.drucke('Aktion: ' + a.name, k.kunden + ' Kunden · Stand ' + U.fmtDatum(U.heute()), t.spalten.map(function (s) { return { t: s.t, r: s.typ === 'euro' }; }), t.zeilen.map(function (r) { return r.map(function (v, i) { return t.spalten[i].typ === 'euro' && typeof v === 'number' ? U.fmtEuro(v) : v; }); })); }, { icon: 'druck', titel: 'Drucken oder als PDF speichern' }),
      D.btn('', function () { D.frage('Aktion löschen?', '„' + a.name + '" mit ' + a.kunden.length + ' Kunden wird entfernt. Ein Sicherungsstand wird vorher angelegt.', 'Löschen', { gefahr: true }).then(function (ja) { if (!ja || App.gesperrt()) return; AB.model.sichere(p, 'Vor Löschen der Aktion „' + a.name + '"'); p.aktionen = p.aktionen.filter(function (x) { return x !== a; }); App.zustand.aktionen = {}; App.geaendert(); }); }, { icon: 'muell', klasse: 'leise gefahr', titel: 'Aktion löschen' })));
    if (!a.kunden.length) { el.appendChild(h('div.ablage.gross.rein', null, D.icon('hoch'), h('h2', null, 'Kundenliste einlesen'), h('p.muted', { style: { maxWidth: '560px', margin: 0 } }, 'Excel- oder CSV-Datei mit Vertragsnummer und Name. Weitere Spalten (z. B. Ort, Tarif, Beitrag) werden als Zusatzinfo übernommen.'), D.btn('Datei auswählen', function () { wahl.click(); }, { klasse: 'haupt-btn' }))); return; }
    var dRing = h('div'), dBal = h('div');
    el.appendChild(h('div.raster.r-6', null, kachel('Kunden', String(k.kunden), U.fmtZahl(k.quoteBearbeitet * 100, 0) + ' % bearbeitet', true), kachel('Nicht bearbeitet', String(k.zustand.unbearbeitet), k.ueberfaellig ? k.ueberfaellig + ' überfällig' : 'noch offen'),
      kachel('Kontaktiert', String(k.erreicht), U.fmtZahl(k.quoteErreicht * 100, 0) + ' % der Bearbeiteten erreicht'), kachel('Nicht erreicht', String(k.zustand.nichtErreicht), 'noch einmal versuchen'),
      kachel('Kein Interesse', String(k.zustand.keinInteresse), 'Absage'), kachel('Abschlüsse', String(k.zustand.abschluss), U.fmtEuro(k.mb) + ' · ' + U.fmtZahl(k.quoteAbschluss * 100, 1) + ' % der Erreichten')));
    el.appendChild(h('div.raster.r-2', null, h('div.karte.rein', null, h('h3', null, 'Stand der Kunden'), h('div.unter', null, 'jeder Kunde zählt einmal'), dRing),
      h('div.karte.rein', null, h('h3', null, 'Kontakte nach Art'), h('div.unter', null, 'alle eingetragenen Kontakte über die drei Stufen'), dBal)));
    requestAnimationFrame(function () {
      G.ring(dRing, { titel: 'Stand der Kunden', format: function (v) { return U.fmtZahl(v, 0); }, mitte: { wert: U.fmtZahl(k.quoteBearbeitet * 100, 0) + ' %', label: 'bearbeitet' },
        teile: Object.keys(K.ZUSTAENDE).map(function (zu) { return { name: K.ZUSTAENDE[zu], wert: k.zustand[zu], farbe: ZFARBE[zu] }; }) });
      G.quer(dBal, { format: function (v) { return U.fmtZahl(v, 0); }, zeilen: K.CODES.map(function (c) { return { name: c.name, wert: k.codes[c.id] || 0 }; }) });
    });
    // Kundentabelle
    var suche = h('input', { type: 'search', placeholder: 'Kunde suchen …', value: z.suche || '', oninput: function () { z.suche = suche.value; filtere(); } });
    var fZ = D.auswahl([['', 'Alle Kunden']].concat(Object.keys(K.ZUSTAENDE).map(function (x) { return [x, K.ZUSTAENDE[x]]; })), z.filter || '', function (v) { z.filter = v; filtere(); }, { style: { width: '220px' } });
    el.appendChild(h('div.leiste', null, h('div.suche', null, D.icon('suche'), suche), fZ, h('span.frei'), h('span.mini', null, 'Kontakt wählen – das Datum wird festgehalten. T Telefon · M E-Mail/Brief · P persönlich · O nicht erreicht · X kein Interesse')));
    var box = h('div', { style: { height: Math.min(560, 120 + a.kunden.length * 48) + 'px', display: 'flex', flex: 'none' } });
    el.appendChild(box);
    var spar = function () { App.geaendert({ still: true, ohneRechnen: true }); };
    function kontakt(kd, i) {
      var s = kd.stufen[i], sel = D.auswahl([['', '–']].concat(K.CODES.map(function (c) { return [c.id, c.id + ' · ' + c.name]; })), s ? s.code : '', function (v) { if (App.gesperrt()) return; K.setzeKontakt(kd, i, v); spar(); tab.zeichne(); }, { style: { padding: '4px 6px', width: '84px' }, title: s ? 'eingetragen am ' + U.fmtDatum(s.datum) : 'Kontakt ' + (i + 1) });
      return [sel, s ? h('span.mini', null, U.fmtDatum(s.datum).slice(0, 6)) : null];
    }
    var tab = AB.tabelle(box, { hoehe: 48, leer: 'Keine Kunden gefunden.', klasse: function (kd) { return K.zustand(kd) === 'keinInteresse' ? '.blass' : ''; },
      spalten: [
        { t: 'Kunde', b: 'minmax(150px, 1.4fr)', k: 'zwei', w: function (kd) { return [h('span', { style: { fontWeight: 600 } }, kd.name || '–'), h('small', null, [kd.vnr].concat(kd.extra.filter(Boolean).slice(0, 3)).filter(Boolean).join(' · '))]; }, s: function (kd) { return kd.name; } },
        { t: 'Stand', b: '138px', w: function (kd) { var zu = K.zustand(kd); return h('span.status', null, h('span', { style: { width: '9px', height: '9px', borderRadius: '50%', background: ZFARBE[zu], display: 'inline-block', marginLeft: '-16px', marginRight: '7px' } }), K.ZUSTAENDE[zu]); }, s: function (kd) { return Object.keys(K.ZUSTAENDE).indexOf(K.zustand(kd)); } },
        { t: 'Kontakt 1', b: '142px', w: function (kd) { return kontakt(kd, 0); } }, { t: 'Kontakt 2', b: '142px', w: function (kd) { return kontakt(kd, 1); } }, { t: 'Kontakt 3', b: '142px', w: function (kd) { return kontakt(kd, 2); } },
        { t: 'Ergebnis', b: '108px', w: function (kd) { return D.auswahl(K.ERGEBNISSE.map(function (e) { return [e.id, e.name]; }), kd.ergebnis, function (v) { if (App.gesperrt()) return; kd.ergebnis = v; spar(); tab.zeichne(); }, { style: { padding: '4px 6px' } }); }, s: function (kd) { return kd.ergebnis; } },
        { t: 'MB €', b: '76px', r: true, w: function (kd) { var i = h('input', { type: 'text', inputMode: 'decimal', value: kd.mb == null ? '' : String(kd.mb).replace('.', ','), disabled: kd.ergebnis !== 'abschluss', style: { padding: '4px 6px', textAlign: 'right' }, title: 'Monatsbeitrag des Abschlusses', onchange: function () { var v = i.value.trim() === '' ? null : U.parseZahl(i.value); if (v != null && isNaN(v)) { i.classList.add('fehler'); return; } if (App.gesperrt()) return; kd.mb = v; spar(); } }); return i; }, s: function (kd) { return +kd.mb || 0; } },
        { t: 'Notiz', b: 'minmax(110px, 1fr)', w: function (kd) { var i = h('input', { type: 'text', value: kd.notiz || '', placeholder: 'ohne Gesundheitsangaben', style: { padding: '4px 6px' }, onchange: function () { if (App.gesperrt()) return; kd.notiz = i.value; spar(); } }); return i; } },
        { t: '', b: '74px', w: function (kd) { return D.btn('Antrag', function () { var t = kd.name.split(','); AB.maske.oeffne(null, { start: { vertragsnummer: kd.vnr, vn: { name: (t[0] || '').trim(), vorname: (t[1] || '').trim() }, vorgang: kd.vnr ? 'mehr' : 'neu', bemerkung: 'Aktion: ' + a.name } }); }, { klasse: 'klein-btn leise', titel: 'Antrag zu diesem Kunden erfassen' }); } }
      ] });
    function filtere() {
      var q = U.falte(z.suche || '').split(/\s+/).filter(Boolean);
      tab.setze(a.kunden.filter(function (kd) { if (z.filter && K.zustand(kd) !== z.filter) return false; if (!q.length) return true; var t = U.falte(kd.name + ' ' + kd.vnr + ' ' + kd.extra.join(' ') + ' ' + kd.notiz); return q.every(function (x) { return t.indexOf(x) >= 0; }); }));
    }
    filtere();
  }

  AB.ansichten.aktionen = { icon: 'ziel', nav: 'Aktionen', titel: function () { var z = App.zustand.aktionen || {}, a = App.p && App.p.aktionen && App.p.aktionen.find(function (x) { return x.id === z.id; }); return a ? a.name : 'Aktionen'; },
    unter: function () { return 'Kundenlisten nachhalten: wer wurde wie erreicht, was wurde daraus'; },
    zeige: function (el, aktionen, z) {
      var p = App.p; if (!p.aktionen) p.aktionen = [];
      var a = p.aktionen.find(function (x) { return x.id === z.id; });
      if (a) detail(el, aktionen, p, a, z); else uebersicht(el, aktionen, p);
    } };
})(globalThis.AB = globalThis.AB || {});
