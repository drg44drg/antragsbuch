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
  K.rechne = function (p, erg, zeilen, heute) {
    var jahr = leer(), monate = [], i;
    for (i = 0; i < 12; i++) monate.push(leer());
    p.antraege.forEach(function (a) {
      var r = erg ? erg.proAntrag[a.id] : null;
      plus(jahr, a, r);
      if (a.eingang && +a.eingang.slice(0, 4) === +p.jahr) plus(monate[+a.eingang.slice(5, 7) - 1], a, r);
    });
    // Provision laut Abrechnung je Buchungsmonat (gefilterte Provisionsarten)
    var erlaubt = {}; (p.einstellungen.provisionsarten || []).forEach(function (x) { erlaubt[x] = 1; });
    (zeilen || []).forEach(function (z) {
      if (!erlaubt[z.part]) return;
      jahr.provBuchung += z.prov;
      if (+z.bdat.slice(0, 4) === +p.jahr) monate[+z.bdat.slice(5, 7) - 1].provBuchung += z.prov;
    });
    fertig(jahr); monate.forEach(fertig);
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
    return { jahr: jahr, monate: monate, schnitt: schnitt, hinweise: h };
  };

  // ---------- Exporte ----------
  K.exportAntraege = function (p, erg, liste) {
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
    return AB.csv.schreibe(kopf, zeilen);
  };

  K.exportAbgleich = function (erg, liste) {
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
    return AB.csv.schreibe(kopf, zeilen);
  };
})(globalThis.AB = globalThis.AB || {});
