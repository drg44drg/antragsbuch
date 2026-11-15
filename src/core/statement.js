/* Antragsbuch – Provisionsabrechnung: Spaltenzuordnung, Normalisierung, Kumulativ-Vergleich. */
(function (AB) {
  'use strict';
  var U = AB.util, S = AB.abrechnung = {};

  // key, Spaltenname des Versicherers, Pflicht?, Typ
  S.SPALTEN = [
    ['vm', '#Vermittlernummer', 0, 't'],
    ['vnr', 'Vertragsnummer', 1, 't'],
    ['vnName', 'Versicherungsnehmer (Name)', 0, 't'],
    ['plz', 'Versicherungsnehmer (PLZ)', 0, 't'],
    ['ort', 'Versicherungsnehmer (Ort)', 0, 't'],
    ['pnr', 'Personennummer', 0, 't'],
    ['vpName', 'Versicherte Person (Name)', 0, 't'],
    ['sparte', 'Sparte', 0, 't'],
    ['tg', 'Tarifgruppe', 1, 't'],
    ['tarif', 'Tarif', 1, 't'],
    ['mb', 'Monatsbeitrag', 0, 'z'],
    ['mbd', 'Monatsbeitragsdifferenz', 1, 'z'],
    ['bws', 'Bewertungssumme', 0, 'z'],
    ['bwsd', 'Bewertungssummendifferenz', 0, 'z'],
    ['lz', 'Laufzeit', 0, 'z'],
    ['prod', 'Produktion', 0, 'z'],
    ['fProv', 'Faktor Provision', 0, 'z'],
    ['prov', 'Provision', 1, 'z'],
    ['bfProv', 'Berechnungsfaktor Provision', 0, 't'],
    ['part', 'Provisionsart', 1, 't'],
    ['st', 'Storno/Verrechnung', 0, 'x'],
    ['bdat', 'Buchungsdatum (Berechnungsdatum)', 1, 'd'],
    ['vbeg', 'Versicherungsbeginn/Änderungsdatum', 0, 'd'],
    ['stgrund', 'Stornogrund', 0, 't'],
    ['gvnr', 'Gruppenvertragsnummer', 0, 't'],
    ['beteil', 'Beteiligte Vermittler', 0, 't'],
    ['shEnde', 'Stornohaftungszeitende', 0, 'd']
  ];
  S.FELDER = S.SPALTEN.map(function (s) { return s[0]; }).concat(['imp', 'fehlt']);

  S.PROVISIONSARTEN = ['Abschluss', 'Erhöhung', 'Bestand', 'Manuell', 'Kündigungsrücknahme', 'Legacy', 'Hierarchie'];
  var PART = { abschluss: 'Abschluss', erhhung: 'Erhöhung', erhoehung: 'Erhöhung', erhohung: 'Erhöhung',
    bestand: 'Bestand', manuell: 'Manuell', kndigungsrcknahme: 'Kündigungsrücknahme', kuendigungsruecknahme: 'Kündigungsrücknahme', legacy: 'Legacy', hierarchie: 'Hierarchie' };

  /** Kopfzeile finden (innerhalb der ersten 15 Zeilen) und Spalten über den Namen zuordnen. */
  S.ordneSpalten = function (zeilen) {
    var best = null;
    for (var r = 0; r < Math.min(15, zeilen.length); r++) {
      var keys = (zeilen[r] || []).map(U.asciiKey), index = {}, treffer = 0;
      S.SPALTEN.forEach(function (sp) {
        var k = U.asciiKey(sp[1]), i = keys.indexOf(k);
        if (i < 0 && sp[0] === 'bdat') i = keys.findIndex(function (x) { return x.indexOf('buchungsdatum') === 0; });
        if (i < 0 && sp[0] === 'vbeg') i = keys.findIndex(function (x) { return x.indexOf('versicherungsbeginn') === 0; });
        if (i < 0 && sp[0] === 'vm') i = keys.findIndex(function (x) { return x === 'vermittlernummer'; });
        if (i >= 0) { index[sp[0]] = i; treffer++; }
      });
      if (!best || treffer > best.treffer) best = { zeile: r, index: index, treffer: treffer };
    }
    if (!best || best.treffer < 3)
      return { fehler: 'Das ist keine Provisionsabrechnung: Die Kopfzeile mit den Spaltennamen (z. B. „Vertragsnummer", „Provision") wurde nicht gefunden.' };
    var fehlend = S.SPALTEN.filter(function (sp) { return sp[2] && best.index[sp[0]] == null; }).map(function (sp) { return sp[1]; });
    if (fehlend.length)
      return { fehler: 'In der Datei fehlen Pflichtspalten: ' + fehlend.join(', ') + '. Bitte die Abrechnung unverändert aus dem Portal exportieren.' };
    return best;
  };

  S.schluessel = function (z) {
    return U.normVnr(z.vnr) + '|' + z.pnr + '|' + z.tarif + '|' + z.bdat + '|' + z.part + '|' + z.mbd.toFixed(2) + '|' + z.prov.toFixed(2);
  };

  /** Rohzeilen (aus CSV oder XLSX) → normalisierte Abrechnungszeilen. */
  S.lies = function (roh, opt) {
    opt = opt || {};
    var map = S.ordneSpalten(roh);
    if (map.fehler) return { fehler: map.fehler };
    var ix = map.index, zeilen = [], warn = [], fehlerZeilen = 0;
    // Dezimalzeichen aus Stichprobe
    var proben = [];
    for (var r = map.zeile + 1; r < roh.length && proben.length < 400; r++) {
      var v = roh[r][ix.prov]; if (typeof v === 'string') proben.push(v);
      v = roh[r][ix.mbd]; if (typeof v === 'string') proben.push(v);
    }
    var dez = U.erkenneDezimal(proben);
    var jahre = {}, vms = {}, summe = 0;
    for (r = map.zeile + 1; r < roh.length; r++) {
      var q = roh[r];
      if (!q || !q.length) continue;
      var z = {}, leer = true;
      for (var s = 0; s < S.SPALTEN.length; s++) {
        var sp = S.SPALTEN[s], i = ix[sp[0]], w = i == null ? null : q[i];
        if (w != null && w !== '') leer = false;
        if (sp[3] === 'z') { w = U.parseZahl(w, dez); if (isNaN(w)) { w = 0; z._f = 1; } w = Math.round(w * 10000) / 10000; }
        else if (sp[3] === 'd') w = U.parseDatum(w);
        else if (sp[3] === 'x') w = /^(x|j|ja|1|true)$/i.test(String(w == null ? '' : w).trim()) ? 1 : 0;
        else w = U.textNr(w);
        z[sp[0]] = w;
      }
      if (leer || (!z.vnr && !z.tarif && !z.prov)) continue;
      if (z._f || !z.bdat) { fehlerZeilen++; delete z._f; if (!z.bdat) continue; }
      z.part = PART[U.asciiKey(z.part)] || z.part || 'Unbekannt';
      z.imp = 0;
      jahre[z.bdat.slice(0, 4)] = (jahre[z.bdat.slice(0, 4)] || 0) + 1;
      if (z.vm) vms[z.vm] = 1;
      summe += z.prov;
      zeilen.push(z);
    }
    if (!zeilen.length) return { fehler: 'Die Datei enthält keine Buchungszeilen.' };
    if (fehlerZeilen) warn.push(fehlerZeilen + ' Zeile(n) hatten ein unlesbares Datum oder eine unlesbare Zahl und wurden übersprungen bzw. mit 0 übernommen.');
    var jl = Object.keys(jahre).sort();
    if (opt.jahr && jl.some(function (j) { return +j !== +opt.jahr; }))
      warn.push('Die Datei enthält Buchungen aus ' + jl.join(', ') + ' – das Projekt ist für ' + opt.jahr + ' angelegt.');
    if (opt.vermittlernummer && Object.keys(vms).length && !vms[String(opt.vermittlernummer).trim()])
      warn.push('Die Vermittlernummer in der Datei (' + Object.keys(vms).slice(0, 3).join(', ') + ') passt nicht zu Ihrer Vermittlernummer ' + opt.vermittlernummer + '.');
    return { zeilen: zeilen, warnungen: warn, dezimal: dez, provisionssumme: U.runde(summe), jahre: jl, vermittler: Object.keys(vms) };
  };

  /**
   * Kumulativ-Vergleich: markiert in `neu`, welche Buchungen schon im vorherigen Stand waren.
   * z.imp = Nummer des Imports, in dem die Buchung erstmals auftauchte. Identische Doppelzeilen
   * werden über ihre Anzahl behandelt.
   */
  S.vergleiche = function (alt, neu, importNr) {
    var vorrat = new Map(), i, k, a;
    for (i = 0; i < alt.length; i++) {
      k = S.schluessel(alt[i]); a = vorrat.get(k);
      if (a) a.push(alt[i]); else vorrat.set(k, [alt[i]]);
    }
    var anzNeu = 0, provNeu = 0;
    for (i = 0; i < neu.length; i++) {
      k = S.schluessel(neu[i]); a = vorrat.get(k);
      if (a && a.length) neu[i].imp = a.shift().imp || 0;
      else { neu[i].imp = importNr; anzNeu++; provNeu += neu[i].prov; }
    }
    // Zeilen, die nur im bisherigen Stand stehen: Sie fehlen in der neuen Datei (z. B. weil ein Monat herausgelöscht wurde).
    // Sie werden behalten, wenn sie zum selben Jahr und Vermittler gehören wie die neue Datei – ein Import ergänzt, er löscht nicht.
    var jahre = {}, vms = {}, behalten = [], entfallen = 0;
    for (i = 0; i < neu.length; i++) { jahre[neu[i].bdat.slice(0, 4)] = 1; vms[neu[i].vm] = 1; }
    vorrat.forEach(function (arr) { arr.forEach(function (z) { if (jahre[z.bdat.slice(0, 4)] && vms[z.vm]) { z.fehlt = z.fehlt || importNr; behalten.push(z); } else entfallen++; }); });
    return { neu: anzNeu, provisionNeu: U.runde(provNeu), entfallen: entfallen, behalten: behalten };
  };

  /** Platzsparend speichern: Feldliste + Zeilen als Arrays. */
  S.packe = function (zeilen) {
    var F = S.FELDER, out = new Array(zeilen.length);
    for (var i = 0; i < zeilen.length; i++) {
      var z = zeilen[i], a = new Array(F.length);
      for (var f = 0; f < F.length; f++) a[f] = z[F[f]];
      out[i] = a;
    }
    return { felder: F.slice(), zeilen: out };
  };
  S.entpacke = function (p) {
    if (!p || !p.zeilen) return [];
    var F = p.felder, out = new Array(p.zeilen.length);
    for (var i = 0; i < p.zeilen.length; i++) {
      var a = p.zeilen[i], z = {};
      for (var f = 0; f < F.length; f++) { if (F[f] === 'fehlt' && !a[f]) continue; z[F[f]] = a[f]; }
      out[i] = z;
    }
    return out;
  };

  /** Tarife aus der Abrechnung für die Tarifliste: [{name, gruppe}] */
  S.tarife = function (zeilen) {
    var m = new Map();
    for (var i = 0; i < zeilen.length; i++) {
      var t = zeilen[i].tarif;
      if (t && !m.has(t)) m.set(t, zeilen[i].tg || '');
    }
    return Array.from(m, function (e) { return { name: e[0], gruppe: e[1] }; });
  };
})(globalThis.AB = globalThis.AB || {});
