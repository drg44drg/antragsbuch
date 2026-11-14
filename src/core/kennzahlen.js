/* Antragsbuch – Kennzahlen für Übersicht/Dashboard und CSV-Exporte. */
(function (AB) {
  'use strict';
  var U = AB.util, M = AB.model, K = AB.kennzahlen = {};

  function leer() {
    var o = { antraege: 0, brutto: 0, minder: 0, storno: 0, stornoAnz: 0, netto: 0, offen: 0, offenAnz: 0,
      policiertAnz: 0, abgerechnetAnz: 0, abgerechnet: 0, abgewiesenAnz: 0, eingereichtAnz: 0, reklamiertAnz: 0,
      provSoll: 0, provIst: 0, provBuchung: 0, bereiche: {}, vorgaenge: {}, status: {} };
    M.BEREICHE.forEach(function (b) { o.bereiche[b.id] = { stueck: 0, beitrag: 0 }; });
    return o;
  }
  function plus(o, a, r) {
    var b = M.beitrag(a), abgewiesen = a.status === 'abgelehnt' || a.status === 'widerruf' || a.status === 'absage';
    o.antraege++;
    o.status[a.status] = (o.status[a.status] || 0) + 1;
    o.vorgaenge[a.vorgang] = (o.vorgaenge[a.vorgang] || 0) + 1;
    if (abgewiesen) { o.abgewiesenAnz++; return; }
    if (b >= 0) o.brutto += b; else o.minder += b;
    if (a.status === 'storno') { o.storno += Math.abs(b); o.stornoAnz++; }
    if (M.istOffen(a)) { o.offen += b; o.offenAnz++; }
    if (a.status === 'eingereicht') o.eingereichtAnz++;
    if (a.status === 'policiert') o.policiertAnz++;
    if (a.status === 'reklamiert') o.reklamiertAnz++;
    if (a.status === 'abgerechnet') { o.abgerechnetAnz++; o.abgerechnet += b; }
    var be = o.bereiche[a.bereich] || (o.bereiche[a.bereich] = { stueck: 0, beitrag: 0 });
    be.stueck += a.bereich === 'gkv' ? Math.max(1, a.positionen.length) : 1; be.beitrag += b;
    if (r) {
      if (a.status !== 'storno') o.provSoll += r.soll.laufend && r.sollPGesamt != null ? r.sollPGesamt : r.sollP;
      o.provIst += r.istP + (r.stP || 0);
    }
  }
  function fertig(o) {
    o.netto = o.brutto + o.minder - o.storno;
    ['brutto', 'minder', 'storno', 'netto', 'offen', 'abgerechnet', 'provSoll', 'provIst', 'provBuchung'].forEach(function (k) { o[k] = U.runde(o[k]); });
    o.stornoQuote = (o.abgerechnetAnz + o.stornoAnz) ? o.stornoAnz / (o.abgerechnetAnz + o.stornoAnz) : 0;
    return o;
  }

  /** → { jahr, monate[12], schnitt, hinweise[] }. Monat = Eingangsmonat des Antrags. */
  K.passt = function (a, f) {
    if (!f) return true;
    if (f.bereich && a.bereich !== f.bereich && !a.positionen.some(function (ps) { return ps.bereich === f.bereich; })) return false;
    if (f.tarif && !a.positionen.some(function (ps) { return String(ps.tarif).toLowerCase() === f.tarif.toLowerCase(); })) return false;
    return true;
  };
  /** filter: { bereich, tarif } – schränkt alle Kennzahlen ein. */
  K.rechne = function (p, erg, zeilen, heute, filter) {
    var jahr = leer(), monate = [], i;
    heute = heute || U.heute();
    jahr.ampel = { rot: 0, gelb: 0, gruen: 0 }; jahr.warten = [];
    var gruppen = filter && filter.bereich && M.bereich[filter.bereich] ? M.bereich[filter.bereich].gruppen : null;
    for (i = 0; i < 12; i++) monate.push(leer());
    p.antraege.forEach(function (a) {
      if (!K.passt(a, filter)) return;
      var am = M.ampel(a, p.einstellungen, heute, !!(erg && erg.proAntrag[a.id] && erg.proAntrag[a.id].buendel.length));
      if (am.stufe) { jahr.ampel[am.stufe]++; if (am.stufe !== 'gruen' || a.status === 'eingereicht') jahr.warten.push({ antrag: a, ampel: am }); }
      var r = erg ? erg.proAntrag[a.id] : null;
      plus(jahr, a, r);
      if (a.eingang && +a.eingang.slice(0, 4) === +p.jahr) plus(monate[+a.eingang.slice(5, 7) - 1], a, r);
    });
    // Provision laut Abrechnung je Buchungsmonat (gefilterte Provisionsarten)
    var erlaubt = {}; (p.einstellungen.provisionsarten || []).forEach(function (x) { erlaubt[x] = 1; });
    (zeilen || []).forEach(function (z) {
      if (!erlaubt[z.part]) return;
      if (gruppen && gruppen.indexOf(z.tg) < 0) return;
      if (filter && filter.tarif && String(z.tarif).toLowerCase() !== filter.tarif.toLowerCase()) return;
      jahr.provBuchung += z.prov;
      if (+z.bdat.slice(0, 4) === +p.jahr) monate[+z.bdat.slice(5, 7) - 1].provBuchung += z.prov;
    });
    fertig(jahr); monate.forEach(fertig);
    var rang = { rot: 0, gelb: 1, gruen: 2 };
    jahr.warten.sort(function (x, y) { return rang[x.ampel.stufe] - rang[y.ampel.stufe] || y.ampel.wt - x.ampel.wt; });
    var aktiv = monate.filter(function (m) { return m.antraege > 0; }).length || 1;
    var schnitt = { antraege: jahr.antraege / aktiv, brutto: jahr.brutto / aktiv, netto: jahr.netto / aktiv, provSoll: jahr.provSoll / aktiv, monate: aktiv };
    var h = [];
    if (erg) {
      var neuOffen = erg.neu.filter(function (b) { return !b.ignoriert; }).length;
      if (erg.ohneNr.length) h.push({ art: 'warn', text: erg.ohneNr.length + (erg.ohneNr.length === 1 ? ' Antrag' : ' Anträge') + ' ohne Vertragsnummer', ziel: 'antraege', filter: 'ohneNr' });
      if (erg.offen.length) h.push({ art: 'warn', text: erg.offen.length + ' seit ' + p.einstellungen.offenTage + ' Tagen offen', ziel: 'abgleich', filter: 'offen' });
      if (erg.abweichung.length) h.push({ art: 'krit', text: erg.abweichung.length + (erg.abweichung.length === 1 ? ' Abweichung' : ' Abweichungen') + ' zur Abrechnung', ziel: 'abgleich', filter: 'abweichung' });
      if (erg.vorschlaege.length) h.push({ art: 'info', text: erg.vorschlaege.length + (erg.vorschlaege.length === 1 ? ' Zuordnungsvorschlag' : ' Zuordnungsvorschläge') + ' zu bestätigen', ziel: 'abgleich', filter: 'offen' });
      if (neuOffen) h.push({ art: 'info', text: neuOffen + (neuOffen === 1 ? ' Buchung' : ' Buchungen') + ' ohne Antrag', ziel: 'abgleich', filter: 'neu' });
      var st = erg.storno.length;
      if (st) h.push({ art: 'krit', text: st + (st === 1 ? ' Rückbuchung' : ' Rückbuchungen') + ' zu abgerechneten Anträgen', ziel: 'abgleich', filter: 'storno' });
    }
    return { jahr: jahr, monate: monate, schnitt: schnitt, hinweise: h, erinnerung: K.erinnerung(p, heute) };
  };

  /** Erinnerung, die neue Abrechnung einzulesen (sie kommt um den eingestellten Tag des Monats). */
  K.erinnerung = function (p, heute) {
    var tag = Math.min(28, +p.einstellungen.abrechnungTag || 6);
    if (!p.antraege.length && !p.importe.length) return null;
    if (+heute.slice(8, 10) < tag) return null;
    var grenze = heute.slice(0, 8) + (tag < 10 ? '0' : '') + tag;
    var letzter = p.importe.filter(function (i) { return i.typ === 'Abrechnung'; }).pop();
    if (letzter && letzter.datum.slice(0, 10) >= grenze) return null;
    var m = +heute.slice(5, 7) - 2; if (m < 0) m = 11;
    return { text: 'Die Abrechnung mit den Buchungen aus ' + U.MONATE[m] + ' sollte vorliegen – bitte einlesen.', letzter: letzter ? letzter.datum.slice(0, 10) : '' };
  };

  // ---------- Exporte ----------
  var TYP = { 'Eingang': 'datum', 'Status seit': 'datum', 'Beginn': 'datum', 'Stornohaftung bis': 'datum', 'Tage offen': 'ganz', 'Werktage': 'ganz', 'Laufzeit': 'ganz', 'Bank-Teilung %': 'ganz' };
  var BREIT = { 'Name': 20, 'Vorname': 16, 'Versicherungsnehmer': 26, 'Kunde': 26, 'Versicherte Person': 22, 'Bemerkung': 34, 'Tarife': 22, 'Tarif(e)': 22, 'Tarifgruppe': 26, 'Nachbearbeitung': 34, 'Hinweis': 44, 'Bereich': 20, 'Vorgangsart': 22, 'Stornogrund': 24 };
  /** kopf + zeilen → Tabellenbeschreibung für den Excel-Schreiber (Typen aus Spaltenname und Werten). */
  K.alsTabelle = function (kopf, zeilen) {
    return { zeilen: zeilen, spalten: kopf.map(function (t, c) {
      var typ = TYP[t] || (zeilen.some(function (z) { return typeof z[c] === 'number'; }) ? 'euro' : 'text');
      return { t: t, typ: typ, b: BREIT[t] || (typ === 'euro' ? 15 : typ === 'datum' ? 12 : Math.max(11, t.length + 3)) };
    }) };
  };
  K.tabelleAntraege = function (p, erg, liste) { var d = antraegeDaten(p, erg, liste); return K.alsTabelle(d.kopf, d.zeilen); };
  K.exportAntraege = function (p, erg, liste) { var d = antraegeDaten(p, erg, liste); return AB.csv.schreibe(d.kopf, d.zeilen); };
  K.tabelleAbgleich = function (erg, liste) { var d = abgleichDaten(erg, liste); return K.alsTabelle(d.kopf, d.zeilen); };
  K.exportAbgleich = function (erg, liste) { var d = abgleichDaten(erg, liste); return AB.csv.schreibe(d.kopf, d.zeilen); };

  /** Prioritätenliste: ausgewählte Anträge mit Ampel, Werktagen und Nachbearbeitung. */
  K.tabellePrio = function (p, erg, antraege, heute) {
    heute = heute || U.heute();
    var kopf = ['Ampel', 'Eingang', 'Kunde', 'Vertragsnummer', 'Bereich', 'Vorgangsart', 'Tarif(e)', 'Monatsbeitrag', 'Status', 'Werktage', 'Hinweis', 'Nachbearbeitung', 'Bemerkung'];
    var name = { rot: 'Rot', gelb: 'Gelb', gruen: 'Grün', '': '' };
    var zeilen = antraege.map(function (a) {
      var r = erg ? erg.proAntrag[a.id] : null, am = M.ampel(a, p.einstellungen, heute, !!(r && r.buendel.length)), nb = a.nachbearbeitung || {};
      return [name[am.stufe], U.fmtDatum(a.eingang), M.vnName(a), a.vertragsnummer, M.name('bereich', a.bereich), M.name('vorgang', a.vorgang), M.tarife(a), M.beitrag(a),
        M.name('status', a.status), am.wt, am.grund, nb.status ? (nb.status === 'offen' ? 'OFFEN' : 'erledigt') + (nb.text ? ': ' + nb.text : '') + (nb.datum ? ' (' + U.fmtDatum(nb.datum) + ')' : '') : '', a.bemerkung];
    });
    var t = K.alsTabelle(kopf, zeilen);
    t.spalten[7].typ = 'euro';
    t.farbe = function (w, r, c) { return c === 0 ? (w[0] === 'Rot' ? 'krit' : w[0] === 'Gelb' ? 'warn' : w[0] === 'Grün' ? 'gut' : null) : null; };
    t.summe = ['', '', zeilen.length + ' Anträge', '', '', '', '', zeilen.reduce(function (s, z) { return s + z[7]; }, 0), '', '', '', '', ''];
    return t;
  };

  function antraegeDaten(p, erg, liste) {
    var kopf = ['Eingang', 'Name', 'Vorname', 'Bereich', 'Vorgangsart', 'Vertragsnummer', 'Versicherte Person', 'Personennummer', 'Tarif',
      'Beitrag Position', 'Beitrag Antrag', 'Status', 'Status seit', 'Beginn', 'Provision Soll', 'Provision Ist', 'Buchungsmonat',
      'E-Antrag', 'Bank-Teilung %', 'Gruppenvertrag', 'Firma', 'Laufzeit', 'Bemerkung'];
    var zeilen = [];
    (liste || p.antraege).forEach(function (a) {
      var r = erg ? erg.proAntrag[a.id] : null;
      a.positionen.forEach(function (ps, i) {
        zeilen.push([U.fmtDatum(a.eingang), a.vn.name, a.vn.vorname, M.name('bereich', ps.bereich || a.bereich), M.name('vorgang', a.vorgang),
          a.vertragsnummer, ps.person, ps.personennummer, ps.tarif, M.vorzeichen(a, +ps.beitrag || 0),
          i === 0 ? M.beitrag(a) : '', M.name('status', a.status), U.fmtDatum(a.statusDatum), U.fmtDatum(a.beginn),
          i === 0 && r ? r.sollP : '', i === 0 && r && r.buendel.length ? r.istP : '', i === 0 && r ? r.monat : '',
          a.eantrag ? 'ja' : 'nein', a.bank.aktiv ? +a.bank.anteil : '', a.gruppenvertrag, a.firma, a.laufzeit || '', a.bemerkung]);
      });
    });
    return { kopf: kopf, zeilen: zeilen };
  }

  function abgleichDaten(erg, liste) {
    var zeilen = [], kopf;
    if (liste === 'neu') {
      kopf = ['Buchungsmonat', 'Vertragsnummer', 'Personennummer', 'Versicherungsnehmer', 'Versicherte Person', 'Tarifgruppe', 'Tarife',
        'Beitragsdifferenz', 'Provision', 'Provisionsart', 'Rückbuchung', 'Neu im letzten Import', 'Kein Antrag nötig'];
      erg.neu.forEach(function (b) {
        zeilen.push([b.monat, b.vnr, b.pnr, b.vnName, b.vpName, b.tg, b.tarife.join(', '), b.mbd, b.prov, b.arten.join(', '),
          b.hatStorno ? 'X' : '', b.neu ? 'ja' : 'nein', b.ignoriert ? 'ja' : 'nein']);
      });
    } else {
      kopf = ['Liste', 'Eingang', 'Name', 'Vorname', 'Bereich', 'Vorgangsart', 'Vertragsnummer', 'Tarife', 'Status', 'Buchungsmonat',
        'Beitrag Soll', 'Beitrag Ist', 'Differenz Beitrag', 'Provision Soll', 'Provision Ist', 'Differenz Provision',
        'Tage offen', 'Rückbuchung Beitrag', 'Rückbuchung Provision', 'Stornogrund', 'Stornohaftung bis'];
      (liste === 'haftung' ? erg.haftung : erg[liste]).forEach(function (r) {
        var a = r.antrag, hat = r.buendel.length > 0;
        zeilen.push([liste.toUpperCase(), U.fmtDatum(a.eingang), a.vn.name, a.vn.vorname, M.name('bereich', a.bereich), M.name('vorgang', a.vorgang),
          a.vertragsnummer, M.tarife(a), M.name('status', a.status), r.monat, r.sollB, hat ? r.istB : '', hat ? r.diffB : '',
          r.sollPGesamt != null ? r.sollPGesamt : r.sollP, hat ? r.istP : '', hat ? r.diffP : '', r.tageOffen || '',
          r.stB || '', r.stP || '', r.stGrund || '', U.fmtDatum(r.shEnde)]);
      });
    }
    return { kopf: kopf, zeilen: zeilen };
  }
})(globalThis.AB = globalThis.AB || {});
