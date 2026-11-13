/* Antragsbuch – CSV lesen (Kodierung, Trennzeichen, Anführungszeichen) und schreiben. */
(function (AB) {
  'use strict';
  var C = AB.csv = {};

  /** Bytes → Text. UTF-8 (mit/ohne BOM), UTF-16 mit BOM, sonst Windows-1252. */
  C.dekodiere = function (bytes) {
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF)
      return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), kodierung: 'UTF-8 (BOM)' };
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE)
      return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), kodierung: 'UTF-16' };
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF)
      return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), kodierung: 'UTF-16' };
    try {
      return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), kodierung: 'UTF-8' };
    } catch (e) {
      return { text: new TextDecoder('windows-1252').decode(bytes), kodierung: 'Windows-1252' };
    }
  };

  /** Trennzeichen aus den ersten Zeilen bestimmen (; , Tab |). */
  C.erkenneTrennzeichen = function (text) {
    var kand = [';', '\t', ',', '|'], zeilen = [], pos = 0;
    while (zeilen.length < 12 && pos < text.length) {
      var e = text.indexOf('\n', pos); if (e < 0) e = text.length;
      var z = text.slice(pos, e); pos = e + 1;
      if (z.trim()) zeilen.push(z);
    }
    var best = ';', bestWert = -1;
    kand.forEach(function (k) {
      var anz = zeilen.map(function (z) {
        var n = 0, q = false;
        for (var i = 0; i < z.length; i++) {
          var c = z[i];
          if (c === '"') q = !q; else if (c === k && !q) n++;
        }
        return n;
      });
      if (!anz.length || anz[0] === 0) return;
      var gleich = anz.filter(function (n) { return n === anz[0]; }).length;
      var wert = anz[0] * (gleich / anz.length) * (gleich === anz.length ? 2 : 1);
      if (wert > bestWert) { bestWert = wert; best = k; }
    });
    return best;
  };

  /** CSV-Text → Array von Zeilen (Array von Strings). Leere Zeilen werden übersprungen. */
  C.parse = function (text, trenn) {
    if (!trenn) trenn = C.erkenneTrennzeichen(text);
    var rows = [], row = [], i = 0, n = text.length, t = trenn.charCodeAt(0);
    var feld = '', start = 0;
    while (i <= n) {
      var c = i < n ? text.charCodeAt(i) : 10;
      if (c === 34 && i === start) { // Feld in Anführungszeichen
        feld = ''; i++;
        var s = i;
        for (;;) {
          var q = text.indexOf('"', i);
          if (q < 0) { feld += text.slice(s); i = n; break; }
          if (text.charCodeAt(q + 1) === 34) { feld += text.slice(s, q + 1); i = q + 2; s = i; continue; }
          feld += text.slice(s, q); i = q + 1; break;
        }
        // Rest bis Trenner/Zeilenende anhängen (tolerant)
        var r = i;
        while (i < n) { var cc = text.charCodeAt(i); if (cc === t || cc === 10 || cc === 13) break; i++; }
        if (i > r) feld += text.slice(r, i);
        row.push(feld);
        c = i < n ? text.charCodeAt(i) : 10;
      } else {
        while (i < n) { c = text.charCodeAt(i); if (c === t || c === 10 || c === 13) break; i++; }
        if (i >= n) c = 10;
        row.push(text.slice(start, i));
      }
      if (c === t) { i++; start = i; continue; }
      // Zeilenende
      if (c === 13 && text.charCodeAt(i + 1) === 10) i++;
      i++; start = i;
      if (row.length > 1 || (row.length === 1 && row[0].trim() !== '')) rows.push(row);
      row = [];
    }
    return rows;
  };

  /** Bytes → { zeilen, kodierung, trennzeichen }. */
  C.lies = function (bytes) {
    var d = C.dekodiere(bytes);
    var trenn = C.erkenneTrennzeichen(d.text);
    return { zeilen: C.parse(d.text, trenn), kodierung: d.kodierung, trennzeichen: trenn };
  };

  function zelle(v) {
    if (v == null) return '';
    if (typeof v === 'number') return isFinite(v) ? String(Math.round(v * 100) / 100).replace('.', ',') : '';
    if (typeof v === 'boolean') return v ? 'ja' : 'nein';
    var s = String(v);
    // Schutz vor Formel-Injektion in Excel
    if (/^[=+@\t\r]/.test(s) || (/^-/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s))) s = "'" + s;
    return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /** Für Excel: Semikolon, UTF-8 mit BOM, deutsches Zahlenformat, CRLF. */
  C.schreibe = function (kopf, zeilen) {
    var out = [kopf.map(zelle).join(';')];
    for (var i = 0; i < zeilen.length; i++) out.push(zeilen[i].map(zelle).join(';'));
    return '﻿' + out.join('\r\n') + '\r\n';
  };
})(globalThis.AB = globalThis.AB || {});
