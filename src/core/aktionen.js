/* Antragsbuch – Aktionen: Kundenlisten nachhalten (drei Kontaktstufen, Ergebnis, Beitrag) und auswerten. */
(function (AB) {
  'use strict';
  var U = AB.util, K = AB.aktionen = {};
  K.CODES = [{ id: 'T', name: 'Telefonisch' }, { id: 'M', name: 'E-Mail / Brief' }, { id: 'P', name: 'Persönlich' }, { id: 'O', name: 'Nicht erreicht' }, { id: 'X', name: 'Kein Interesse' }];
  K.ERGEBNISSE = [{ id: '', name: 'offen' }, { id: 'termin', name: 'Termin' }, { id: 'angebot', name: 'Angebot' }, { id: 'abschluss', name: 'Abschluss' }, { id: 'absage', name: 'Absage' }];

  K.neu = function (name) {
    return { id: U.uid(), name: name || 'Neue Aktion', anlass: '', start: U.heute(), frist: '', bemerkung: '', spalten: [], kunden: [], erstellt: new Date().toISOString() };
  };
  K.neuerKunde = function () { return { id: U.uid(), vnr: '', name: '', extra: [], stufen: [null, null, null], ergebnis: '', mb: null, notiz: '', antragId: '' }; };

  /** Kundenliste aus einer Tabelle. zuordnung: { vnr, name, vorname } (Spaltenindizes); übrige Spalten bleiben als Zusatzinfo erhalten. */
  K.kundenAusTabelle = function (zeilen, kopfIdx, zuordnung) {
    var kopf = (zeilen[kopfIdx] || []).map(function (c) { return c == null ? '' : String(c).trim(); }), belegt = {};
    ['vnr', 'name', 'vorname'].forEach(function (f) { if (zuordnung[f] != null) belegt[zuordnung[f]] = 1; });
    var zusatz = kopf.map(function (k, i) { return i; }).filter(function (i) { return !belegt[i] && kopf[i]; }).slice(0, 6);
    var kunden = [];
    for (var r = kopfIdx + 1; r < zeilen.length; r++) {
      var z = zeilen[r]; if (!z || !z.some(function (c) { return c != null && c !== ''; })) continue;
      var g = function (f) { return zuordnung[f] == null || z[zuordnung[f]] == null ? '' : String(z[zuordnung[f]]).trim(); };
      var k = K.neuerKunde(), vor = g('vorname');
      k.vnr = U.textNr(g('vnr')); k.name = vor ? g('name') + ', ' + vor : g('name');
      k.extra = zusatz.map(function (i) { var v = z[i]; return v == null ? '' : typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : String(v).trim(); });
      if (!k.vnr && !k.name) continue;
      kunden.push(k);
    }
    return { kunden: kunden, spalten: zusatz.map(function (i) { return kopf[i]; }) };
  };

  /** Kontakt eintragen: Das Datum wird beim ersten Setzen festgehalten und bleibt stehen. */
  K.setzeKontakt = function (kunde, stufe, code, heute) {
    if (!code) { kunde.stufen[stufe] = null; return; }
    var alt = kunde.stufen[stufe];
    kunde.stufen[stufe] = { code: code, datum: alt && alt.datum ? alt.datum : (heute || U.heute()) };
  };
  K.zustand = function (k) {
    var codes = k.stufen.filter(Boolean).map(function (s) { return s.code; });
    if (k.ergebnis === 'abschluss') return 'abschluss';
    if (k.ergebnis === 'absage' || codes.indexOf('X') >= 0) return 'keinInteresse';
    if (k.ergebnis === 'termin' || k.ergebnis === 'angebot') return 'termin';
    if (codes.some(function (c) { return c === 'T' || c === 'M' || c === 'P'; })) return 'kontaktiert';
    if (codes.length) return 'nichtErreicht';
    return 'unbearbeitet';
  };
  K.ZUSTAENDE = { unbearbeitet: 'Nicht bearbeitet', nichtErreicht: 'Nicht erreicht', kontaktiert: 'Kontaktiert', termin: 'Termin / Angebot', abschluss: 'Abschluss', keinInteresse: 'Kein Interesse / Absage' };

  /** Kennzahlen einer Aktion. */
  K.kennzahlen = function (aktion, heute) {
    heute = heute || U.heute();
    var o = { kunden: aktion.kunden.length, zustand: { unbearbeitet: 0, nichtErreicht: 0, kontaktiert: 0, termin: 0, abschluss: 0, keinInteresse: 0 }, codes: { T: 0, M: 0, P: 0, O: 0, X: 0 }, stufen: [0, 0, 0], mb: 0, ueberfaellig: 0 };
    aktion.kunden.forEach(function (k) {
      var z = K.zustand(k); o.zustand[z]++;
      k.stufen.forEach(function (s, i) { if (s) { o.stufen[i]++; o.codes[s.code] = (o.codes[s.code] || 0) + 1; } });
      if (k.ergebnis === 'abschluss') o.mb += +k.mb || 0;
      if (z === 'unbearbeitet' && aktion.frist && heute > aktion.frist) o.ueberfaellig++;
    });
    o.bearbeitet = o.kunden - o.zustand.unbearbeitet;
    o.erreicht = o.zustand.kontaktiert + o.zustand.termin + o.zustand.abschluss + o.zustand.keinInteresse;
    o.quoteBearbeitet = o.kunden ? o.bearbeitet / o.kunden : 0;
    o.quoteErreicht = o.bearbeitet ? o.erreicht / o.bearbeitet : 0;
    o.quoteAbschluss = o.erreicht ? o.zustand.abschluss / o.erreicht : 0;
    o.mb = U.runde(o.mb);
    o.tageBisFrist = aktion.frist ? U.tageZwischen(heute, aktion.frist) : null;
    return o;
  };

  /** Tabelle für den Excel-Export (mit Farben je Zustand). */
  K.tabelle = function (aktion) {
    var name = function (c) { var x = K.CODES.find(function (y) { return y.id === c; }); return x ? x.name : ''; };
    var spalten = [{ t: 'Vertragsnummer', b: 15 }, { t: 'Kunde', b: 28 }].concat(aktion.spalten.map(function (s) { return { t: s, b: 16 }; }),
      [1, 2, 3].reduce(function (l, n) { return l.concat([{ t: 'Kontakt ' + n, b: 16 }, { t: 'Datum ' + n, typ: 'datum', b: 12 }]); }, []),
      [{ t: 'Stand', b: 22 }, { t: 'Ergebnis', b: 12 }, { t: 'Monatsbeitrag', typ: 'euro', b: 15 }, { t: 'Notiz', b: 36 }]);
    var standSp = 2 + aktion.spalten.length + 6;
    var zeilen = aktion.kunden.map(function (k) {
      var st = k.stufen.reduce(function (l, s) { return l.concat(s ? [name(s.code), U.fmtDatum(s.datum)] : ['', '']); }, []);
      return [k.vnr, k.name].concat(aktion.spalten.map(function (_, i) { return k.extra[i] || ''; }), st,
        [K.ZUSTAENDE[K.zustand(k)], (K.ERGEBNISSE.find(function (e) { return e.id === k.ergebnis; }) || {}).name || '', k.ergebnis === 'abschluss' && k.mb != null ? +k.mb : '', k.notiz || '']);
    });
    return { spalten: spalten, zeilen: zeilen, farbe: function (w, r, c) {
      if (c !== standSp) return null;
      return w[c] === 'Abschluss' ? 'gut' : w[c] === 'Nicht bearbeitet' ? 'krit' : w[c] === 'Nicht erreicht' ? 'warn' : w[c] === 'Termin / Angebot' ? 'akzent' : null;
    } };
  };
})(globalThis.AB = globalThis.AB || {});
