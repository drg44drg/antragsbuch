/* Antragsbuch – Veränderungsdienst: generischer Import mit Spaltenzuordnung (Format gekapselt). */
(function (AB) {
  'use strict';
  var U = AB.util, M = AB.model, V = AB.vdienst = {};

  V.FELDER = [
    { id: 'vnr', name: 'Vertragsnummer', pflicht: false, muster: ['vertragsnummer', 'mitgliedsnummer', 'versicherungsnummer', 'vertragsnr', 'vsnr', 'versnr', 'policennummer', 'vertrag'] },
    { id: 'name', name: 'Name (Versicherungsnehmer)', pflicht: false, muster: ['namevn', 'versicherungsnehmername', 'versicherungsnehmer', 'kundenname', 'nachname', 'name'] },
    { id: 'vorname', name: 'Vorname (falls eigene Spalte)', pflicht: false, muster: ['vornamevn', 'vorname'] },
    { id: 'datum', name: 'Datum', pflicht: false, muster: ['policierungsdatum', 'aenderungsdatum', 'nderungsdatum', 'versicherungsbeginn', 'beginn', 'gueltigab', 'gltigab', 'datum'] },
    { id: 'vorgang', name: 'Vorgang', pflicht: false, muster: ['vorgang', 'vorgangsart', 'geschaeftsvorfall', 'geschftsvorfall', 'aenderungsart', 'art'] },
    { id: 'beitrag', name: 'Beitrag bzw. Beitragsdifferenz', pflicht: false, muster: ['monatsbeitragdiff', 'monatsbeitragsdifferenz', 'beitragsdifferenz', 'differenz', 'mehrbeitrag', 'beitrag'] },
    { id: 'beitragAlt', name: 'Beitrag alt', pflicht: false, muster: ['monatsbeitragalt', 'beitragalt', 'altbeitrag'] },
    { id: 'beitragNeu', name: 'Beitrag neu', pflicht: false, muster: ['monatsbeitragneu', 'beitragneu', 'neubeitrag'] }
  ];

  V.signatur = function (kopf) { return U.hash(kopf.map(U.asciiKey).join('|')); };

  /** Kopfzeile suchen: erste Zeile mit mindestens zwei Textzellen. */
  V.kopfzeile = function (zeilen) {
    for (var r = 0; r < Math.min(20, zeilen.length); r++) {
      var t = (zeilen[r] || []).filter(function (c) { return typeof c === 'string' && c.trim() && isNaN(U.parseZahl(c)); });
      if (t.length >= 2) return r;
    }
    return 0;
  };

  /** Spaltenzuordnung vorschlagen → { feldId: spaltenIndex } */
  V.rate = function (kopf) {
    var keys = kopf.map(U.asciiKey), z = {}, belegt = {};
    [0, 1].forEach(function (runde) {
      V.FELDER.forEach(function (f) {
        if (z[f.id] != null) return;
        for (var m = 0; m < f.muster.length; m++) {
          var i = keys.findIndex(function (k, ix) { return !belegt[ix] && k && (runde === 0 ? k === f.muster[m] : k.indexOf(f.muster[m]) >= 0); });
          if (i >= 0) { z[f.id] = i; belegt[i] = 1; return; }
        }
      });
    });
    // Sonderfall: mehrere „Monatsbeitrag…"-Spalten (alt, Differenz, neu)
    var mb = keys.map(function (k, i) { return /^monatsbeitrag/.test(k) ? i : -1; }).filter(function (i) { return i >= 0; });
    if (mb.length === 3 && z.beitragAlt == null && z.beitragNeu != null) {
      var rest = mb.filter(function (i) { return i !== z.beitragNeu; });
      z.beitragAlt = rest[0]; z.beitrag = rest[1];
    }
    return z;
  };

  /** Rohzeilen + Zuordnung → einheitliche Datensätze. */
  V.lies = function (zeilen, kopfIdx, zuordnung) {
    var out = [], proben = [];
    ['beitrag', 'beitragAlt', 'beitragNeu'].forEach(function (f) {
      if (zuordnung[f] != null) zeilen.slice(kopfIdx + 1, kopfIdx + 200).forEach(function (z) { if (typeof z[zuordnung[f]] === 'string') proben.push(z[zuordnung[f]]); });
    });
    var dez = U.erkenneDezimal(proben);
    function g(z, f) { return zuordnung[f] == null ? null : z[zuordnung[f]]; }
    for (var r = kopfIdx + 1; r < zeilen.length; r++) {
      var z = zeilen[r];
      if (!z || !z.some(function (c) { return c != null && c !== ''; })) continue;
      var name = String(g(z, 'name') || '').trim(), vor = String(g(z, 'vorname') || '').trim();
      var b = g(z, 'beitrag'), alt = g(z, 'beitragAlt'), neu = g(z, 'beitragNeu'), beitrag = null;
      if (b != null && b !== '') beitrag = U.parseZahl(b, dez);
      else if (neu != null && neu !== '' && alt != null && alt !== '') beitrag = U.parseZahl(neu, dez) - U.parseZahl(alt, dez);
      else if (neu != null && neu !== '') beitrag = U.parseZahl(neu, dez);
      out.push({ zeile: r + 1, vnr: U.textNr(g(z, 'vnr')), name: vor ? name + ', ' + vor : name, datum: U.parseDatum(g(z, 'datum')),
        vorgang: String(g(z, 'vorgang') || '').trim(), beitrag: beitrag == null || isNaN(beitrag) ? null : U.runde(beitrag) });
    }
    return out;
  };

  /**
   * Datensätze den Anträgen zuordnen.
   * → { treffer:[{satz, antrag, art:'vnr'|'name', punkte, sicher, aktion}], ohne:[satz] }
   */
  V.ordneZu = function (saetze, antraege, tol) {
    tol = tol == null ? 0.05 : tol;
    var nachVn = {}, ohneNr = [], vergeben = {};
    antraege.forEach(function (a) {
      if (a.bereich === 'gkv') return;
      var vn = U.normVnr(a.vertragsnummer);
      if (vn) (nachVn[vn] = nachVn[vn] || []).push(a);
      else if (a.status === 'eingereicht' || a.status === 'policiert') ohneNr.push(a);
    });
    var treffer = [], ohne = [];
    saetze.forEach(function (s) {
      var vn = U.normVnr(s.vnr), gefunden = false;
      (nachVn[vn] || []).forEach(function (a) {
        if (a.status !== 'eingereicht' || vergeben[a.id]) return;
        if (s.beitrag != null && (nachVn[vn].length > 1) && Math.abs(M.beitrag(a) - s.beitrag) > Math.max(tol, 1)) return;
        vergeben[a.id] = 1; gefunden = true;
        treffer.push({ satz: s, antrag: a, art: 'vnr', punkte: 100, sicher: true, aktion: 'Status → Policiert' });
      });
      if (gefunden || (vn && nachVn[vn])) { if (!gefunden) ohne.push(s); return; }
      if (!s.name) { ohne.push(s); return; }
      var best = null, bestP = 0, zweit = 0;
      ohneNr.forEach(function (a) {
        if (vergeben[a.id]) return;
        var sim = U.namensAehnlichkeit(M.vnName(a), s.name);
        a.positionen.forEach(function (p) { if (p.person) sim = Math.max(sim, 0.95 * U.namensAehnlichkeit(p.person, s.name)); });
        if (sim < 0.7) return;
        var p = Math.round(sim * 70);
        if (s.beitrag != null && Math.abs(M.beitrag(a) - s.beitrag) <= tol) p += 30;
        else if (s.beitrag == null) p += 10;
        if (p > bestP) { zweit = bestP; bestP = p; best = a; } else if (p > zweit) zweit = p;
      });
      if (best && bestP >= 60) {
        vergeben[best.id] = 1;
        treffer.push({ satz: s, antrag: best, art: 'name', punkte: Math.min(100, bestP), sicher: bestP >= 90 && zweit < 60,
          aktion: (s.vnr ? 'Vertragsnummer eintragen, ' : '') + (best.status === 'eingereicht' ? 'Status → Policiert' : 'Vertragsnummer ergänzen') });
      } else ohne.push(s);
    });
    return { treffer: treffer, ohne: ohne };
  };

  /** Ausgewählte Treffer übernehmen. → Anzahl geänderter Anträge */
  V.uebernimm = function (treffer) {
    var n = 0;
    treffer.forEach(function (t) {
      var a = t.antrag, geaendert = false;
      if (t.satz.vnr && !U.normVnr(a.vertragsnummer)) { a.vertragsnummer = t.satz.vnr; geaendert = true; }
      if (a.status === 'eingereicht') geaendert = M.setzeStatus(a, 'policiert', t.satz.datum || U.heute(), 'vdienst', t.satz.vorgang) || geaendert;
      if (geaendert) { a.geaendert = new Date().toISOString(); n++; }
    });
    return n;
  };
})(globalThis.AB = globalThis.AB || {});
