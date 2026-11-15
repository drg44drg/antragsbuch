/* Antragsbuch – ADP-Wettbewerb: Bonus-Rechner nach den Wettbewerbsbedingungen (Grundbonus, Zusatzboni, Sonderregelung). */
(function (AB) {
  'use strict';
  var U = AB.util, B = AB.bonus = {};

  // Wettbewerbsbedingungen 2025 (hauptberuflicher Außendienst). Stufe 1 und 2 sind gleich.
  B.STUFEN = [
    { id: '1+2', name: 'Karrierestufe 1 + 2', ziel2: 22, jeMB: 0.4, zb1Schwelle: 25, zb1: 750, kombi: 3000, bkvStueck: 25, bkv: 500, mindest: 6000 },
    { id: '3', name: 'Karrierestufe 3', ziel2: 25, jeMB: 0.5, zb1Schwelle: 27, zb1: 2100, kombi: 4500, bkvStueck: 35, bkv: 1000, mindest: 7200 },
    { id: '4', name: 'Karrierestufe 4', ziel2: 27, jeMB: 0.6, zb1Schwelle: 29, zb1: 4050, kombi: 6000, bkvStueck: 45, bkv: 1500, mindest: 9600 },
    { id: '5', name: 'Karrierestufe 5', ziel2: 29, jeMB: 0.7, zb1Schwelle: 31, zb1: 7000, kombi: 7500, bkvStueck: 60, bkv: 2500, mindest: 12000 },
    { id: '6', name: 'Karrierestufe 6', ziel2: 31, jeMB: 0.9, zb1Schwelle: 33, zb1: 13500, kombi: 9000, bkvStueck: 75, bkv: 3500, mindest: 16000 }
  ];
  B.leer = function () { return { stufe: '1+2', bestandKv: null, bestandVoll: null, neueVoll: null, neueBkv: null, nettoKv: null, nettoGesamt: null, stand: '', reportingStand: '' }; };

  /**
   * e: { stufe, bestandKv (KV-Gesamt-Bestand €), bestandVoll (KV-Voll + Pflegepflicht €), neueVoll (neue Personen KV-Voll),
   *      neueBkv (neue Personen bKV), nettoKv (KV-Nettoproduktion € MB), nettoGesamt (KV/UV + LV-Ventil € MB) }
   */
  B.rechne = function (e) {
    var s = B.STUFEN.find(function (x) { return x.id === e.stufe; }) || B.STUFEN[0], n = function (v) { return +v || 0; };
    var gesamt = n(e.nettoGesamt) || n(e.nettoKv), kv = n(e.nettoKv) || n(e.nettoGesamt);
    var o = { stufe: s, gesamt: gesamt };
    // Ziel 1: je 100.000 € Bestand (KV-Voll + Pflegepflicht) drei neue Personen in der KV-Voll
    var basisVoll = n(e.bestandVoll) || n(e.bestandKv);
    // Gezählt wird je volle 100.000 € (Beispiel der Bedingungen: 350.000 € Bestand → 9 Personen), mindestens 3.
    o.ziel1 = { soll: basisVoll ? Math.max(3, Math.floor(basisVoll / 100000 + 1e-9) * 3) : 0, ist: n(e.neueVoll) };
    o.ziel1.fehlt = Math.max(0, o.ziel1.soll - o.ziel1.ist); o.ziel1.erreicht = o.ziel1.soll > 0 && o.ziel1.fehlt === 0;
    // Ziel 2: KV-Nettoproduktion je 1.000 € KV-Gesamt-Bestand
    o.ziel2 = { soll: U.runde(s.ziel2 * n(e.bestandKv) / 1000), ist: kv, je1000: n(e.bestandKv) ? U.runde(kv / n(e.bestandKv) * 1000) : 0, schwelle: s.ziel2 };
    o.ziel2.fehlt = Math.max(0, U.runde(o.ziel2.soll - kv)); o.ziel2.erreicht = n(e.bestandKv) > 0 && o.ziel2.fehlt === 0;
    o.grundErreicht = o.ziel1.erreicht || o.ziel2.erreicht;
    o.grundVoll = U.runde(gesamt * s.jeMB);
    // Sonderregelung: 50 % des Grundbonus, wenn die Mindestproduktion überschritten ist (Bedingungen: „> 7.200")
    o.sonder = { mindest: s.mindest, fehlt: Math.max(0, U.runde(s.mindest - gesamt)), greift: !o.grundErreicht && gesamt > s.mindest };
    o.grund = o.grundErreicht ? o.grundVoll : o.sonder.greift ? U.runde(o.grundVoll / 2) : 0;
    // Zusatzboni setzen den Grundbonus voraus
    var zb1Soll = U.runde(s.zb1Schwelle * n(e.bestandKv) / 1000);
    o.zb1 = { soll: zb1Soll, ist: kv, fehlt: Math.max(0, U.runde(zb1Soll - kv)), max: s.zb1, schwelle: s.zb1Schwelle };
    o.zb1.erreicht = n(e.bestandKv) > 0 && o.zb1.fehlt === 0; o.zb1.praemie = o.grundErreicht && o.zb1.erreicht ? s.zb1 : 0;
    o.kombi = { max: s.kombi, erreicht: o.ziel1.erreicht && o.ziel2.erreicht }; o.kombi.praemie = o.kombi.erreicht ? s.kombi : 0;
    o.bkv = { soll: s.bkvStueck, ist: n(e.neueBkv), fehlt: Math.max(0, s.bkvStueck - n(e.neueBkv)), max: s.bkv };
    o.bkv.erreicht = o.bkv.fehlt === 0; o.bkv.praemie = o.grundErreicht && o.bkv.erreicht ? s.bkv : 0;
    o.summe = U.runde(o.grund + o.zb1.praemie + o.kombi.praemie + o.bkv.praemie);
    o.maxZusatz = s.zb1 + s.kombi + s.bkv;
    o.max = U.runde(o.grundVoll + o.maxZusatz);
    // Nächste Schritte in der Reihenfolge des kleinsten Aufwands
    o.schritte = [];
    if (!o.grundErreicht) {
      if (o.ziel1.soll) o.schritte.push('Grundbonus über Ziel 1: noch ' + o.ziel1.fehlt + (o.ziel1.fehlt === 1 ? ' neue Person' : ' neue Personen') + ' in der KV-Voll.');
      if (e.bestandKv) o.schritte.push('Grundbonus über Ziel 2: noch ' + U.fmtEuro0(o.ziel2.fehlt) + ' KV-Nettoproduktion.');
      if (!o.sonder.greift) o.schritte.push('Sonderregelung (halber Grundbonus): noch ' + U.fmtEuro0(o.sonder.fehlt) + ' bis zur Mindestproduktion.');
    } else {
      if (!o.zb1.erreicht && e.bestandKv) o.schritte.push('Zusatzbonus Bestandsausschöpfung (' + U.fmtEuro0(s.zb1) + '): noch ' + U.fmtEuro0(o.zb1.fehlt) + ' KV-Nettoproduktion.');
      if (!o.kombi.erreicht) o.schritte.push('Kombibonus (' + U.fmtEuro0(s.kombi) + '): ' + (o.ziel1.erreicht ? 'noch ' + U.fmtEuro0(o.ziel2.fehlt) + ' KV-Nettoproduktion für Ziel 2.' : 'noch ' + o.ziel1.fehlt + ' neue Personen KV-Voll für Ziel 1.'));
    }
    if (!o.bkv.erreicht) o.schritte.push('Zusatzbonus bKV (' + U.fmtEuro0(s.bkv) + '): noch ' + o.bkv.fehlt + ' neue Personen in der bKV' + (o.grundErreicht ? '.' : ' – zählt erst mit erreichtem Grundbonus.'));
    return o;
  };
  /**
   * Vorschau auf die Bonus-Abrechnung aus drei Quellen:
   *  bestätigt  – Werte des letzten Bonus-Reportings (p.bonus, Stand p.bonus.reportingStand)
   *  gebucht    – in der Abrechnung nach diesem Stand gebucht, vom Reporting noch nicht bestätigt
   *  beantragt  – im Antragsbuch erfasst, noch nicht abgerechnet (zählt ab dem Tag der Einreichung)
   * Personen (KV-Voll, bKV) kommen aus dem Antragsbuch, weil nur dort bekannt ist, ob es eine neue Person ist.
   * Die Nettoproduktion kommt aus der Spalte „Produktion" der Abrechnung; für offene Anträge wird der Monatsbeitrag angesetzt.
   */
  B.simulation = function (p, zeilen, erg) {
    var M = AB.model, e = p.bonus || B.leer(), jahr = +p.jahr, stand = e.reportingStand || '', n = function (v) { return +v || 0; };
    var np = zeilen && zeilen.length && AB.team ? AB.team.nettoproduktion(zeilen, jahr) : { hat: false, gesamt: 0, kv: 0, monate: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
    var ende = { abgelehnt: 1, widerruf: 1, absage: 1, storno: 1 }, zaehlt = { neu: 1, mehr: 1, minder: 1 };
    var leerM = function () { return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; };
    var o = { stand: stand, jahr: jahr, liste: [], hatAbrechnung: np.hat,
      monate: { gebuchtProd: np.monate.slice(), beantragtMb: leerM(), policiertMb: leerM(), vollPoliciert: leerM(), bkvPoliciert: leerM(), vollGebucht: leerM(), vollBeantragt: leerM(), bkvGebucht: leerM(), bkvBeantragt: leerM() } };
    var sum = { voll: { gebucht: 0, beantragt: 0, policiert: 0 }, bkv: { gebucht: 0, beantragt: 0, policiert: 0 }, mbKv: 0, mbGesamt: 0, polKv: 0, polGesamt: 0 };
    (p.antraege || []).forEach(function (a) {
      if (!a.eingang || +a.eingang.slice(0, 4) !== jahr || ende[a.status] || !zaehlt[a.vorgang]) return;
      var r = erg && erg.proAntrag ? erg.proAntrag[a.id] : null, bdat = '';
      if (r && r.buendel && r.buendel.length) r.buendel.forEach(function (b) { var d = b.bdat || (b.monat + '-01'); if (!bdat || d < bdat) bdat = d; });
      else if (a.status === 'abgerechnet') bdat = a.statusDatum || a.eingang;
      // Policiert (Veränderungsdienst): Ab der technischen Verarbeitung zählt der Antrag für den Bonus – oft Monate vor der Abrechnung.
      var pdat = '';
      (a.historie || []).forEach(function (hh) { if (hh.status === 'policiert' && hh.datum && (!pdat || hh.datum < pdat)) pdat = hh.datum; });
      if (!pdat && a.status === 'policiert') pdat = a.statusDatum || '';
      var wirksam = pdat && bdat ? (pdat < bdat ? pdat : bdat) : (pdat || bdat);
      var zustand = !wirksam ? 'beantragt' : stand && wirksam <= stand ? 'bestaetigt' : bdat ? 'gebucht' : 'policiert';
      var voll = {}, vollPp = {}, bkv = {}, mbKv = 0, mbGes = 0, vn = M.vnName(a), hatPp = false;
      a.positionen.forEach(function (ps, i) {
        var be = ps.bereich || a.bereich, wer = (ps.person || vn || 'Person ' + (i + 1)).trim().toLowerCase(), b = M.vorzeichen(a, +ps.beitrag || 0);
        if (a.vorgang === 'neu' && (be === 'voll' || be === 'pflege')) { if (be === 'voll') voll[wer] = 1; if (M.istPflegepflicht(ps.tarif)) { vollPp[wer] = 1; hatPp = true; } }
        if (a.vorgang === 'neu' && be === 'bkv') bkv[wer] = 1;
        if (be === 'leben') return;
        mbGes += b; if (be !== 'unfall') mbKv += b;
      });
      // Neue Personen: „aus Bestand" zählt nie. Mit Pflegepflicht-Tarif zählen genau die Personen mit Pflegepflicht (komplett neu abgeschlossen).
      // Ohne Pflegepflicht-Tarif zählt die Angabe des ADP; fehlt sie (ältere Einträge), wird nichts gezählt und der Eintrag markiert.
      var herk = M.brauchtHerkunft(a) ? (a.herkunft || '') : '', ohneAngabe = M.brauchtHerkunft(a) && !herk;
      if (herk === 'bestand') { voll = {}; bkv = {}; }
      else if (a.bereich === 'voll' || Object.keys(voll).length) { if (hatPp) voll = vollPp; else if (herk !== 'neu') voll = {}; }
      if (ohneAngabe && a.bereich === 'bkv') bkv = {};
      var x = { id: a.id, herkunft: herk, ohneAngabe: ohneAngabe && !hatPp, nr: a.nr || '', vnr: a.vertragsnummer || '', tarife: M.tarife(a), personen: a.positionen.map(function (ps) { return ps.person; }).filter(function (v, i, l) { return v && l.indexOf(v) === i; }).join('; '), name: vn, eingang: a.eingang, beginn: a.beginn || '', bereich: a.bereich, vorgang: a.vorgang, zustand: zustand, gebuchtAm: bdat, policiertAm: pdat, abgerechnet: !!bdat,
        voll: Object.keys(voll).length, bkv: Object.keys(bkv).length, mbKv: U.runde(mbKv), mb: U.runde(mbGes) };
      if (!x.voll && !x.bkv && Math.abs(x.mb) < 0.005) return;
      o.liste.push(x);
      var mE = +a.eingang.slice(5, 7) - 1, mB = wirksam && +wirksam.slice(0, 4) === jahr ? +wirksam.slice(5, 7) - 1 : mE;
      // Noch nicht abgerechnet: Der Monatsbeitrag steht noch nicht in der Abrechnung und wird deshalb geschätzt dazugezählt.
      if (zustand === 'policiert' || (zustand === 'bestaetigt' && !bdat)) { o.monate.policiertMb[mB] += x.mb; if (zustand === 'policiert') { sum.polKv += x.mbKv; sum.polGesamt += x.mb; } }
      if (zustand === 'policiert') { sum.voll.policiert += x.voll; sum.bkv.policiert += x.bkv; o.monate.vollPoliciert[mB] += x.voll; o.monate.bkvPoliciert[mB] += x.bkv; }
      if (zustand === 'policiert') { /* oben gezählt */ } else if (zustand === 'beantragt') { sum.voll.beantragt += x.voll; sum.bkv.beantragt += x.bkv; sum.mbKv += x.mbKv; sum.mbGesamt += x.mb;
        o.monate.vollBeantragt[mE] += x.voll; o.monate.bkvBeantragt[mE] += x.bkv; o.monate.beantragtMb[mE] += x.mb; }
      else { o.monate.vollGebucht[mB] += x.voll; o.monate.bkvGebucht[mB] += x.bkv; if (zustand === 'gebucht') { sum.voll.gebucht += x.voll; sum.bkv.gebucht += x.bkv; } }
    });
    o.liste.sort(function (a, b) { return a.eingang < b.eingang ? -1 : a.eingang > b.eingang ? 1 : 0; });
    o.monate.beantragtMb = o.monate.beantragtMb.map(U.runde);
    function zeile(best, geb, pol, bean) { return { bestaetigt: best, gebucht: geb, policiert: pol, beantragt: bean, voraussichtlich: U.runde(best + geb + pol + bean) }; }
    o.monate.policiertMb = o.monate.policiertMb.map(U.runde);
    // Produktion: Die Abrechnung ist genauer und aktueller als das Reporting; „gebucht" ist der Zuwachs gegenüber dem bestätigten Wert.
    var bestGes = n(e.nettoGesamt), bestKv = n(e.nettoKv) || bestGes;
    o.voll = zeile(n(e.neueVoll), sum.voll.gebucht, sum.voll.policiert, sum.voll.beantragt);
    o.bkv = zeile(n(e.neueBkv), sum.bkv.gebucht, sum.bkv.policiert, sum.bkv.beantragt);
    o.nettoKv = zeile(bestKv, np.hat ? Math.max(0, U.runde(np.kv - bestKv)) : 0, U.runde(sum.polKv), U.runde(sum.mbKv));
    o.nettoGesamt = zeile(bestGes, np.hat ? Math.max(0, U.runde(np.gesamt - bestGes)) : 0, U.runde(sum.polGesamt), U.runde(sum.mbGesamt));
    // Prüfung: Finden sich die vom Reporting bestätigten Personen im Antragsbuch wieder?
    var imBuch = { voll: 0, bkv: 0 }, pos = { voll: { bestaetigt: [], gebucht: [], policiert: [], beantragt: [] }, bkv: { bestaetigt: [], gebucht: [], policiert: [], beantragt: [] } };
    o.liste.forEach(function (x) { ['voll', 'bkv'].forEach(function (f) { if (!x[f]) return; pos[f][x.zustand].push(x.nr); if (x.zustand === 'bestaetigt') imBuch[f] += x[f]; }); });
    o.voll.imBuch = imBuch.voll; o.voll.abweichung = stand ? o.voll.bestaetigt - imBuch.voll : 0; o.voll.positionen = pos.voll;
    o.bkv.imBuch = imBuch.bkv; o.bkv.abweichung = stand ? o.bkv.bestaetigt - imBuch.bkv : 0; o.bkv.positionen = pos.bkv;
    o.ohneAngabe = o.liste.filter(function (x) { return x.ohneAngabe; }).map(function (x) { return x.nr; });
    o.abrechnung = B.neueVollAusAbrechnung(zeilen || [], jahr);
    o.heute = B.rechne(e);
    // „policiert" = alles, was technisch verarbeitet ist (bestätigt + abgerechnet + policiert): das sollte der Versicherer für den Bonus schon zählen.
    var bisPol = function (z) { return U.runde(z.bestaetigt + z.gebucht + z.policiert); };
    o.gebucht = B.rechne(Object.assign({}, e, { neueVoll: bisPol(o.voll), neueBkv: bisPol(o.bkv), nettoKv: bisPol(o.nettoKv), nettoGesamt: bisPol(o.nettoGesamt) }));
    o.prognose = B.rechne(Object.assign({}, e, { neueVoll: o.voll.voraussichtlich, neueBkv: o.bkv.voraussichtlich, nettoKv: o.nettoKv.voraussichtlich, nettoGesamt: o.nettoGesamt.voraussichtlich }));
    return o;
  };

  /**
   * Gegenprobe aus der Abrechnung: Personen mit neu abgeschlossener Pflegepflichtversicherung (Provisionsart Abschluss, nicht zurückgebucht).
   * An der Jahresabrechnung 2025 eines ADP geprüft: ergibt dieselbe Zahl wie das Bonus-Reporting.
   */
  B.neueVollAusAbrechnung = function (zeilen, jahr) {
    var per = {}, cache = {};
    zeilen.forEach(function (z) {
      if (jahr && +z.bdat.slice(0, 4) !== +jahr || z.part !== 'Abschluss') return;
      var pp = cache[z.tarif]; if (pp == null) pp = cache[z.tarif] = AB.model.istPflegepflicht(z.tarif);
      if (!pp) return;
      var k = U.normVnr(z.vnr) + '|' + z.pnr, o = per[k] || (per[k] = { plus: 0, minus: 0, monat: z.bdat.slice(0, 7) });
      if (z.st) o.minus++; else o.plus++;
      if (z.bdat.slice(0, 7) < o.monat) o.monat = z.bdat.slice(0, 7);
    });
    var monate = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], n = 0;
    Object.keys(per).forEach(function (k) { if (per[k].plus > per[k].minus) { n++; monate[+per[k].monat.slice(5, 7) - 1]++; } });
    return { anzahl: n, monate: monate };
  };

  B.ZUSTAND = { bestaetigt: 'bestätigt (im Bonus-Reporting)', gebucht: 'abgerechnet – noch nicht bestätigt', policiert: 'policiert – noch nicht bestätigt', beantragt: 'beantragt – nicht bestätigt' };
  /** „Überprüfung Bonus": zwei Tabellenblätter (Zusammenfassung, Positionen) zum Abgleich mit dem Bonus-Reporting. */
  B.tabellePruefung = function (p, s) {
    var pr = s.prognose, nrn = function (l) { return l.length ? l.map(function (n) { return n || '?'; }).join(', ') : ''; };
    var unter = 'Vermittler ' + ((p.einstellungen && p.einstellungen.vermittlernummer) || '–') + ' · ' + pr.stufe.name + ' · erstellt am ' + U.fmtDatum(U.heute()) + (s.stand ? ' · Bonus-Reporting vom ' + U.fmtDatum(s.stand) : ' · ohne Stand des Bonus-Reportings');
    function zz(name, z, ziel, mitPos) {
      return [name, ziel || '', z.bestaetigt, mitPos ? z.imBuch : '', mitPos && s.stand ? z.abweichung : '', z.gebucht, z.policiert, z.beantragt, z.voraussichtlich, ziel ? Math.max(0, U.runde(ziel - z.voraussichtlich)) : '',
        mitPos ? nrn(z.positionen.bestaetigt) : '', mitPos ? nrn(z.positionen.gebucht) : '', mitPos ? nrn(z.positionen.policiert) : '', mitPos ? nrn(z.positionen.beantragt) : ''];
    }
    var sp1 = [{ t: 'Größe', b: 26 }, { t: 'Ziel', typ: 'zahl', b: 10 }, { t: 'Bestätigt laut Reporting', typ: 'zahl', b: 16 }, { t: 'davon im Antragsbuch', typ: 'zahl', b: 16 }, { t: 'Abweichung', typ: 'zahl', b: 12 },
      { t: 'Abgerechnet seitdem', typ: 'zahl', b: 16 }, { t: 'Policiert', typ: 'zahl', b: 12 }, { t: 'Beantragt', typ: 'zahl', b: 12 }, { t: 'Voraussichtlich', typ: 'zahl', b: 14 }, { t: 'Fehlt noch', typ: 'zahl', b: 12 },
      { t: 'Positionen bestätigt', b: 24 }, { t: 'Positionen abgerechnet', b: 22 }, { t: 'Positionen policiert', b: 22 }, { t: 'Positionen beantragt', b: 22 }];
    var z1 = [zz('Neue Personen KV-Voll', s.voll, pr.ziel1.soll, true), zz('Neue Personen bKV', s.bkv, pr.bkv.soll, true), zz('KV-Nettoproduktion (€ MB)', s.nettoKv, Math.round(pr.ziel2.soll)), zz('Nettoproduktion gesamt (€ MB)', s.nettoGesamt, 0)];
    var sp2 = [{ t: 'Pos.', typ: 'zahl', b: 7 }, { t: 'Kunde', b: 26 }, { t: 'Vertragsnummer', b: 15 }, { t: 'Eingereicht', typ: 'datum', b: 12 }, { t: 'Beginn', typ: 'datum', b: 12 }, { t: 'Bereich', b: 18 }, { t: 'Vorgangsart', b: 14 },
      { t: 'Tarif(e)', b: 22 }, { t: 'Versicherte Person(en)', b: 28 }, { t: 'Personen KV-Voll', typ: 'zahl', b: 10 }, { t: 'Personen bKV', typ: 'zahl', b: 10 }, { t: 'Monatsbeitrag', typ: 'euro', b: 14 },
      { t: 'Stand', b: 32 }, { t: 'Policiert am', typ: 'datum', b: 12 }, { t: 'Abgerechnet am', typ: 'datum', b: 13 }, { t: 'Neu / Bestand', b: 26 }, { t: 'Anmerkung für die SDK', b: 34 }];
    var z2 = s.liste.map(function (x) {
      return [x.nr || '', x.name, x.vnr, U.fmtDatum(x.eingang), x.beginn ? U.fmtDatum(x.beginn) : '', AB.model.name('bereich', x.bereich), AB.model.name('vorgang', x.vorgang), x.tarife, x.personen,
        x.voll || '', x.bkv || '', x.mb, B.ZUSTAND[x.zustand] + (x.zustand === 'bestaetigt' && !x.abgerechnet ? ' · noch nicht abgerechnet' : ''), x.policiertAm ? U.fmtDatum(x.policiertAm) : '', x.gebuchtAm ? U.fmtDatum(x.gebuchtAm) : '', x.herkunft ? AB.model.HERKUNFT[x.herkunft] : x.ohneAngabe ? 'Angabe fehlt – nicht gezählt' : '', ''];
    });
    return [
      { name: 'Überprüfung Bonus', titel: 'Überprüfung Bonus ' + s.jahr, unter: unter, spalten: sp1, zeilen: z1,
        farbe: function (w, r, c) { return c === 4 && typeof w[4] === 'number' && w[4] !== 0 ? 'krit' : c === 8 ? 'akzent' : null; } },
      { name: 'Positionen', titel: 'Positionen aus dem Antragsbuch ' + s.jahr, unter: unter, spalten: sp2, zeilen: z2,
        farbe: function (w, r, c) { return c !== 12 ? null : /^bestätigt/.test(w[12]) ? 'gut' : /^beantragt/.test(w[12]) ? 'warn' : 'akzent'; } }
    ];
  };
})(globalThis.AB = globalThis.AB || {});
