/* Antragsbuch – Antragsliste: Sofortsuche, Filter, Bearbeitungsampel, Auswahl für die Prioritätenliste, Export. */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h, U = AB.util, M = AB.model, App = AB.app;
  var suchCache = new WeakMap();
  function text(a) { var c = suchCache.get(a); if (!c || c.g !== a.geaendert) { c = { g: a.geaendert, t: M.suchtext(a) }; suchCache.set(a, c); } return c.t; }
  AB.statusMarke = function (a) { return h('span.status.' + a.status, null, M.name('status', a.status)); };
  AB.geld = function (v, farbig) { return h('span.num' + (farbig && v < -0.004 ? '.minus' : farbig && v > 0.004 ? '.plus' : ''), null, U.fmtEuro(v)); };
  AB.ampelVon = function (a) { var r = App.erg && App.erg.proAntrag[a.id]; return M.ampel(a, App.p.einstellungen, U.heute(), !!(r && r.buendel.length)); };
  AB.ampelPunkt = function (am) { return am.stufe ? h('span.ampel.' + am.stufe, { title: am.grund, role: 'img', 'aria-label': am.stufe === 'gruen' ? 'grün' : am.stufe }) : null; };

  /** Prioritätenliste als Excel oder Druck/PDF. */
  AB.prioListe = function (antraege, art) {
    var p = App.p, e = p.einstellungen, t = AB.kennzahlen.tabellePrio(p, App.erg, antraege);
    var unter = (e.name || 'ADP') + (e.vermittlernummer ? ' · Vermittler ' + e.vermittlernummer : '') + ' · ' + antraege.length + ' Anträge · Stand ' + U.fmtDatum(U.heute());
    if (art === 'excel') D.excel('Prioritaetenliste_' + U.heute() + '.xlsx', Object.assign({ name: 'Prioritätenliste', titel: 'Prioritätenliste – Anträge in Bearbeitung', unter: unter }, t));
    else D.drucke('Prioritätenliste – Anträge in Bearbeitung', unter, t.spalten.map(function (s) { return { t: s.t, r: s.typ === 'euro' || s.typ === 'ganz' }; }),
      t.zeilen.map(function (z) { return z.map(function (v, i) { return t.spalten[i].typ === 'euro' && typeof v === 'number' ? U.fmtEuro(v) : v; }); }),
      t.summe.map(function (v, i) { return t.spalten[i].typ === 'euro' && typeof v === 'number' ? U.fmtEuro(v) : v; }));
  };

  AB.ansichten.antraege = { titel: 'Anträge', icon: 'antraege', fest: true,
    unter: function () { return App.p.antraege.length + ' Anträge im Projekt'; },
    zeige: function (el, aktionen, z) {
      var p = App.p, erg = App.erg, ohneNr = {}, ampel = {};
      erg.ohneNr.forEach(function (r) { ohneNr[r.antrag.id] = 1; });
      p.antraege.forEach(function (a) { ampel[a.id] = AB.ampelVon(a); });
      if (!z.wahl) z.wahl = new Set();
      var nbOffen = p.antraege.filter(function (a) { return a.nachbearbeitung.status === 'offen'; }).length;
      aktionen.appendChild(D.btn('Neuer Antrag', function () { AB.maske.oeffne(null); }, { klasse: 'haupt-btn', icon: 'plus', taste: 'N' }));
      var suche = h('input', { type: 'search', placeholder: 'Suchen: Name, Vertragsnummer, Tarif, Betrag …', value: z.suche || '', oninput: function () { z.suche = suche.value; filtere(); } });
      var monate = [['', 'Alle Monate']].concat(U.MONATE.map(function (m, i) { return [String(i), m]; }));
      var stat = [['', 'Alle Status'], ['offen', 'Offen (unterwegs)']].concat(M.STATUS.map(function (s) { return [s.id, s.name]; }));
      var fM = D.auswahl(monate, z.monat || '', function (v) { z.monat = v; filtere(); }, { style: { width: '132px' } });
      var fB = D.auswahl([['', 'Alle Bereiche']].concat(M.BEREICHE.map(function (b) { return [b.id, b.name]; })), z.bereich || '', function (v) { z.bereich = v; filtere(); }, { style: { width: '150px' } });
      var fS = D.auswahl(stat, z.status || '', function (v) { z.status = v; filtere(); }, { style: { width: '150px' } });
      var fA = D.auswahl([['', 'Ampel: alle'], ['rot', 'Rot'], ['gelbrot', 'Gelb und Rot'], ['gruen', 'Grün']], z.ampel || '', function (v) { z.ampel = v; filtere(); }, { style: { width: '132px' }, title: 'Bearbeitungsampel' });
      function chip(id, textC, zahl) {
        var c = h('button.chip' + (z.spezial === id ? '.aktiv' : ''), { type: 'button', onclick: function () { z.spezial = z.spezial === id ? '' : id; App.zeige('antraege'); } }, textC, h('b', null, String(zahl)));
        return zahl || z.spezial === id ? c : null;
      }
      el.appendChild(h('div.leiste', null, h('div.suche', null, D.icon('suche'), suche), fM, fB, fS, fA, chip('ohneNr', 'Ohne Vertragsnr.', erg.ohneNr.length), chip('nb', 'Nachbearbeitung', nbOffen), chip('rekla', 'Reklamiert', p.antraege.filter(M.reklaOffen).length), h('span.frei'),
        D.exportBtn('Antraege_' + p.jahr, function () { return Object.assign({ name: 'Anträge', titel: 'Anträge ' + p.jahr, unter: AB.ansichten.uebersicht.unter() + ' · Stand ' + U.fmtDatum(U.heute()) }, AB.kennzahlen.tabelleAntraege(p, erg, tab.zeilen())); },
          function () { return AB.kennzahlen.exportAntraege(p, erg, tab.zeilen()); }),
        D.btn('', drucke, { icon: 'druck', titel: 'Drucken oder als PDF speichern' })));
      // Auswahlleiste (erscheint, sobald etwas angehakt ist)
      var leiste = h('div.leiste.auswahlleiste', { hidden: true }), anzahl = h('b');
      var gewaehlt = function () { return p.antraege.filter(function (a) { return z.wahl.has(a.id); }); };
      D.anhaengen(leiste, [anzahl, h('span.klein', null, 'ausgewählt · Prioritätenliste exportieren:'),
        D.btn('Excel', function () { AB.prioListe(gewaehlt(), 'excel'); }, { klasse: 'klein-btn haupt-btn', icon: 'runter' }),
        D.btn('Drucken / PDF', function () { AB.prioListe(gewaehlt(), 'druck'); }, { klasse: 'klein-btn', icon: 'druck' }),
        D.btn('Reklamation …', function () { AB.reklamation.oeffne(gewaehlt()); }, { klasse: 'klein-btn', titel: 'Provisionsreklamation für die ausgewählten Anträge vorbereiten' }),
        D.btn('Nachbearbeitung offen setzen', function () { gewaehlt().forEach(function (a) { a.nachbearbeitung = { status: 'offen', text: a.nachbearbeitung.text || '', datum: a.nachbearbeitung.datum || U.heute() }; a.geaendert = new Date().toISOString(); }); z.wahl.clear(); App.geaendert(); }, { klasse: 'klein-btn' }),
        h('span.frei'), D.btn('Auswahl aufheben', function () { z.wahl.clear(); tab.zeichne(); zeigeLeiste(); }, { klasse: 'klein-btn leise' })]);
      el.appendChild(leiste);
      function zeigeLeiste() { leiste.hidden = !z.wahl.size; anzahl.textContent = z.wahl.size + (z.wahl.size === 1 ? ' Antrag' : ' Anträge'); alle.checked = z.wahl.size > 0 && tab && tab.zeilen().every(function (a) { return z.wahl.has(a.id); }); }
      var alle = h('input', { type: 'checkbox', title: 'Alle angezeigten auswählen', onchange: function () { tab.zeilen().forEach(function (a) { if (alle.checked) z.wahl.add(a.id); else z.wahl.delete(a.id); }); tab.zeichne(); zeigeLeiste(); } });
      var box = h('div', { style: { flex: 1, minHeight: 0, display: 'flex' } });
      el.appendChild(box);
      var R = function (a) { return erg.proAntrag[a.id] || {}; }, rangA = { rot: 0, gelb: 1, gruen: 2, '': 3 };
      var tab = AB.tabelle(box, { hoehe: 50, sort: z.sort || { i: 2, ab: true }, leer: 'Keine Anträge gefunden. Mit „Neuer Antrag" (Taste N) legen Sie einen an.',
        klick: function (a) { AB.maske.oeffne(a); },
        spalten: [
          { t: '', kopf: alle, b: '22px', w: function (a) { return h('input', { type: 'checkbox', checked: z.wahl.has(a.id), title: 'Für die Prioritätenliste auswählen', onchange: function () { if (this.checked) z.wahl.add(a.id); else z.wahl.delete(a.id); zeigeLeiste(); } }); } },
          { t: 'Pos.', b: '52px', titel: 'Feste Positionsnummer des Antrags – bleibt für immer gleich, auch in Exporten', r: true, w: function (a) { return h('span.num.muted', null, a.nr || ''); }, s: function (a) { return +a.nr || 0; } },
          { t: 'Ampel', b: '74px', titel: 'Bearbeitungsampel: Werktage seit Einreichung', w: function (a) { var am = ampel[a.id]; return am.stufe ? [AB.ampelPunkt(am), h('span.mini', { title: am.grund }, am.wt + ' WT')] : ''; }, s: function (a) { var am = ampel[a.id]; return rangA[am.stufe] * 10000 - am.wt; } },
          { t: 'Eingang', b: '88px', w: function (a) { return U.fmtDatum(a.eingang); }, s: function (a) { return a.eingang; }, absteigend: true },
          { t: 'Versicherungsnehmer', b: 'minmax(140px, 1.5fr)', k: 'zwei', w: function (a) { var nb = a.nachbearbeitung; return [h('span', { style: { fontWeight: 600 } }, M.vnName(a)), h('small', null, nb.status === 'offen' ? 'Nachbearbeitung: ' + (nb.text || 'offen') : a.bemerkung || (a.firma || ''))]; }, s: function (a) { return M.vnName(a); } },
          { t: 'Bereich · Vorgang', b: 'minmax(104px, 1fr)', k: 'zwei', w: function (a) { return [h('span', null, M.bereich[a.bereich] ? M.bereich[a.bereich].kurz : a.bereich), h('small', null, M.name('vorgang', a.vorgang))]; }, s: function (a) { return a.bereich + a.vorgang; } },
          { t: 'Tarif(e)', b: 'minmax(80px, 1fr)', w: function (a) { return M.tarife(a); }, s: function (a) { return M.tarife(a); } },
          { t: 'Beitrag', b: '98px', r: true, w: function (a) { return AB.geld(M.beitrag(a), true); }, s: function (a) { return M.beitrag(a); } },
          { t: 'Vertragsnr.', b: '100px', w: function (a) { return a.vertragsnummer || (ohneNr[a.id] ? h('span.marke-s.warn', { title: 'Vertragsnummer nachtragen' }, 'fehlt') : h('span.mini', null, '–')); }, s: function (a) { return a.vertragsnummer; } },
          { t: 'Status', b: '122px', w: function (a) { return [AB.statusMarke(a), a.nachbearbeitung.status === 'offen' ? h('span.marke-s.krit', { title: 'Nachbearbeitung offen' }, 'NB') : null, a.reklamation ? h('span.marke-s' + (a.reklamation.ergebnis === 'erfolgreich' ? '.gut' : a.reklamation.ergebnis ? '' : '.warn'), { title: 'Reklamation vom ' + U.fmtDatum(a.reklamation.datum) + ': ' + M.REKLA_ERGEBNIS.find(function (x) { return x.id === (a.reklamation.ergebnis || ''); }).name }, 'Rekl.') : null]; }, s: function (a) { return a.status; } },
          { t: 'Prov. Soll', b: '98px', r: true, w: function (a) { var r = R(a); return r.soll ? [r.soll.ueberschrieben ? h('span.marke-s.warn', { title: 'manuell überschrieben' }, 'm') : null, U.fmtEuro(r.sollP)] : ''; }, s: function (a) { return R(a).sollP; } },
          { t: 'Prov. Ist', b: '98px', r: true, w: function (a) { var r = R(a); return r.buendel && r.buendel.length ? U.fmtEuro(r.istP) : h('span.mini', null, '–'); }, s: function (a) { var r = R(a); return r.buendel && r.buendel.length ? r.istP : null; } }
        ],
        fuss: function (zl) {
          var b = 0, s = 0, i = 0;
          zl.forEach(function (a) { var r = R(a); b += M.beitrag(a); s += r.sollP || 0; i += (r.buendel && r.buendel.length ? r.istP : 0); });
          return ['', '', zl.length + ' Antr.', '', '', '', U.fmtEuro(b), '', '', U.fmtEuro(s), U.fmtEuro(i)];
        } });
      function filtere() {
        var q = U.falte(z.suche || '').split(/\s+/).filter(Boolean);
        tab.setze(p.antraege.filter(function (a) {
          if (z.monat !== '' && z.monat != null && (!a.eingang || +a.eingang.slice(5, 7) - 1 !== +z.monat || +a.eingang.slice(0, 4) !== +p.jahr)) return false;
          if (z.bereich && a.bereich !== z.bereich) return false;
          if ((z.tarif || z.beihilfe) && !AB.kennzahlen.passt(a, { tarif: z.tarif, beihilfe: z.beihilfe })) return false;
          if (z.status === 'offen' ? !M.istOffen(a) : z.status && a.status !== z.status) return false;
          if (z.ampel && (z.ampel === 'gelbrot' ? !(ampel[a.id].stufe === 'gelb' || ampel[a.id].stufe === 'rot') : ampel[a.id].stufe !== z.ampel)) return false;
          if (z.spezial === 'ohneNr' && !ohneNr[a.id]) return false;
          if (z.spezial === 'nb' && a.nachbearbeitung.status !== 'offen') return false;
          if (z.spezial === 'rekla' && !M.reklaOffen(a)) return false;
          if (q.length) { var t = text(a); for (var i = 0; i < q.length; i++) if (t.indexOf(q[i]) < 0) return false; }
          return true;
        }));
        zeigeLeiste();
      }
      function drucke() {
        var zl = tab.zeilen(), b = 0, s = 0;
        var titel = 'Anträge ' + (z.monat ? U.MONATE[+z.monat] + ' ' : '') + p.jahr;
        D.drucke(titel, AB.ansichten.uebersicht.unter() + ' · ' + zl.length + ' Anträge · Stand ' + U.fmtDatum(U.heute()),
          [{ t: 'Eingang' }, { t: 'Versicherungsnehmer' }, { t: 'Bereich' }, { t: 'Vorgang' }, { t: 'Tarif(e)' }, { t: 'Beitrag', r: 1 }, { t: 'Vertragsnr.' }, { t: 'Status' }, { t: 'Prov. Soll', r: 1 }, { t: 'Prov. Ist', r: 1 }],
          zl.map(function (a) { var r = R(a); b += M.beitrag(a); s += r.sollP || 0;
            return [U.fmtDatum(a.eingang), M.vnName(a), M.bereich[a.bereich].kurz, M.name('vorgang', a.vorgang), M.tarife(a), U.fmtEuro(M.beitrag(a)), a.vertragsnummer, M.name('status', a.status), U.fmtEuro(r.sollP), r.buendel && r.buendel.length ? U.fmtEuro(r.istP) : '']; }),
          ['Summe', '', '', '', '', U.fmtEuro(b), '', '', U.fmtEuro(s), '']);
      }
      filtere();
      if (z.suche) suche.focus();
    } };
})(globalThis.AB = globalThis.AB || {});
