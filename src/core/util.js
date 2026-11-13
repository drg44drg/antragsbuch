/* Antragsbuch – Hilfsfunktionen (Zahlen, Datum, Namen). Läuft in Browser, Worker und Node. */
(function (AB) {
  'use strict';
  var U = AB.util = {};

  U.uid = function () {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  };

  U.runde = function (x) { return Math.round((x + Number.EPSILON) * 100) / 100; };

  /** Vertragsnummer für den Vergleich: Leerzeichen und führende Nullen entfernen. */
  U.normVnr = function (v) {
    if (v == null) return '';
    var s = String(v).replace(/[\s ]+/g, '').toUpperCase();
    if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, '');
    s = s.replace(/^0+(?=.)/, '');
    return s === '0' ? '' : s;
  };

  /** Vertragsnummer als Text übernehmen (nichts abschneiden außer Rand-Leerzeichen). */
  U.textNr = function (v) {
    if (v == null) return '';
    var s = String(v).trim();
    if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, '');
    return s;
  };

  /** Erkennt aus Stichproben, ob das Dezimalzeichen Komma oder Punkt ist. */
  U.erkenneDezimal = function (proben) {
    var komma = 0, punkt = 0;
    for (var i = 0; i < proben.length; i++) {
      var s = String(proben[i] == null ? '' : proben[i]).trim();
      if (!s) continue;
      if (/,\d{1,2}$/.test(s) || /\.\d{3},/.test(s)) komma++;
      else if (/\.\d{1,2}$/.test(s) || /,\d{3}\./.test(s)) punkt++;
    }
    return punkt > komma ? '.' : ',';
  };

  /**
   * Zahl robust lesen: "1.239,27", "1239,27", "1,239.27", "-5,81", "5,34 €", "(5,34)", "5,34-".
   * dez: ',' | '.' | undefined (automatisch). Ergebnis: Zahl oder NaN; leer → 0.
   */
  U.parseZahl = function (v, dez) {
    if (typeof v === 'number') return v;
    if (v == null) return 0;
    var s = String(v).replace(/[\s €%]|EUR/g, '');
    if (!s || s === '-') return 0;
    var neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/-$/.test(s)) { neg = !neg; s = s.slice(0, -1); }
    if (/^[-−]/.test(s)) { neg = !neg; s = s.slice(1); }
    if (/^\+/.test(s)) s = s.slice(1);
    var hatK = s.indexOf(',') >= 0, hatP = s.indexOf('.') >= 0;
    if (hatK && hatP) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (hatK) {
      if (dez === '.' && /^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
      else s = s.replace(',', '.');
    } else if (hatP) {
      if (dez !== '.' && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    }
    if (!/^\d*\.?\d+(e[-+]?\d+)?$/i.test(s) && !/^\d+\.$/.test(s)) return NaN;
    var n = parseFloat(s);
    return neg ? -n : n;
  };

  function iso(j, m, t) {
    if (j < 100) j += j < 70 ? 2000 : 1900;
    if (m < 1 || m > 12 || t < 1 || t > 31) return '';
    var d = new Date(Date.UTC(j, m - 1, t));
    if (d.getUTCMonth() !== m - 1) return '';
    return j + '-' + (m < 10 ? '0' : '') + m + '-' + (t < 10 ? '0' : '') + t;
  }

  /** Excel-Seriennummer → ISO-Datum. */
  U.excelDatum = function (n) {
    var d = new Date(Math.round((n - 25569) * 86400000));
    return isNaN(d) ? '' : d.toISOString().slice(0, 10);
  };

  /** Datum robust lesen → "JJJJ-MM-TT" oder ''. */
  U.parseDatum = function (v) {
    if (v == null || v === '') return '';
    if (v instanceof Date) return isNaN(v) ? '' : iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
    if (typeof v === 'number') return v > 20000 && v < 90000 ? U.excelDatum(v) : '';
    var s = String(v).trim(), m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return iso(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{2,4})/.exec(s))) return iso(+m[3], +m[2], +m[1]);
    if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s))) return iso(+m[3], +m[2], +m[1]);
    if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) return iso(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{2})(\d{2})(\d{4})$/.exec(s))) return iso(+m[3], +m[2], +m[1]);
    if (/^\d{5}(\.\d+)?$/.test(s)) return U.excelDatum(parseFloat(s));
    return '';
  };

  U.heute = function () {
    var d = new Date();
    return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  };

  U.tageZwischen = function (a, b) {
    if (!a || !b) return 0;
    return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
  };

  U.fmtDatum = function (isoStr) {
    if (!isoStr) return '';
    var p = String(isoStr).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : String(isoStr);
  };

  U.fmtZahl = function (n, stellen) {
    if (n == null || isNaN(n)) return '';
    if (stellen == null) stellen = 2;
    var neg = n < 0 || (Object.is(n, -0) && false);
    var s = Math.abs(n).toFixed(stellen);
    if (parseFloat(s) === 0) neg = false;
    var p = s.split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + p[0] + (p[1] ? ',' + p[1] : '');
  };
  U.fmtEuro = function (n) { return n == null || isNaN(n) ? '' : U.fmtZahl(n, 2) + ' €'; };
  U.fmtEuro0 = function (n) { return n == null || isNaN(n) ? '' : U.fmtZahl(n, 0) + ' €'; };

  U.MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  U.MONATE_KURZ = ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  U.monatName = function (ym) {
    if (!ym) return '';
    var p = ym.split('-');
    return U.MONATE[+p[1] - 1] + ' ' + p[0];
  };

  /** Nur a–z/0–9: macht Spaltennamen unabhängig von Umlauten und kaputter Kodierung. */
  U.asciiKey = function (s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  /** Text für Suche/Vergleich: klein, Umlaute aufgelöst, ohne Sonderzeichen. */
  U.falte = function (s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  };

  var TITEL = { dr: 1, prof: 1, med: 1, ing: 1, dipl: 1, herr: 1, frau: 1, von: 0, de: 0 };
  U.namensTeile = function (s) {
    return U.falte(s).split(/[^a-z0-9]+/).filter(function (t) { return t && !TITEL[t]; });
  };

  U.levenshtein = function (a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    var v = new Array(n + 1), i, j;
    for (j = 0; j <= n; j++) v[j] = j;
    for (i = 1; i <= m; i++) {
      var vor = v[0]; v[0] = i;
      for (j = 1; j <= n; j++) {
        var t = v[j];
        v[j] = Math.min(v[j] + 1, v[j - 1] + 1, vor + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1));
        vor = t;
      }
    }
    return v[n];
  };

  function tokSim(a, b) {
    if (a === b) return 1;
    if (a.length === 1 || b.length === 1) return a[0] === b[0] ? 0.6 : 0; // Initiale
    var d = U.levenshtein(a, b), l = Math.max(a.length, b.length);
    var s = 1 - d / l;
    return s < 0.6 ? 0 : s;
  }

  /**
   * Namensähnlichkeit 0..1, unabhängig von Reihenfolge und Schreibweise
   * ("MUSTER, ANNA" = "Anna Muster" = "Muster Anna-Lena" teilweise).
   */
  U.namensAehnlichkeit = function (a, b) {
    var ta = U.namensTeile(a), tb = U.namensTeile(b);
    if (!ta.length || !tb.length) return 0;
    if (ta.length > tb.length) { var x = ta; ta = tb; tb = x; }
    var frei = tb.slice(), summe = 0;
    for (var i = 0; i < ta.length; i++) {
      var best = 0, bi = -1;
      for (var j = 0; j < frei.length; j++) {
        var s = tokSim(ta[i], frei[j]);
        if (s > best) { best = s; bi = j; }
      }
      if (bi >= 0) frei.splice(bi, 1);
      summe += best;
    }
    // fehlende Zusatzteile (zweiter Vorname) nur leicht abwerten
    return summe / (ta.length + 0.25 * (tb.length - ta.length));
  };

  U.median = function (arr) {
    var a = arr.slice().sort(function (x, y) { return x - y; });
    if (!a.length) return 0;
    var m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  };
  U.quantil = function (arr, q) {
    var a = arr.slice().sort(function (x, y) { return x - y; });
    if (!a.length) return 0;
    var p = (a.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p);
    return a[lo] + (a[hi] - a[lo]) * (p - lo);
  };

  /** Kleine, schnelle Prüfsumme (für Pseudonyme und Signaturen, keine Kryptografie). */
  U.hash = function (str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  };
})(globalThis.AB = globalThis.AB || {});
