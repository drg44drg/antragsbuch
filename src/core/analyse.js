/* Antragsbuch – Analyse für Verkäufer: Größe der Anträge, Produktklassen, Familien, „Was wäre, wenn". Tipps und Gesundheitstage nach Kalender. */
(function (AB) {
  'use strict';
  var U = AB.util, M = AB.model, Y = AB.analyse = {};
  Y.KLASSEN = [[0, 25, 'bis 25 €'], [25, 50, '25 bis 50 €'], [50, 100, '50 bis 100 €'], [100, 250, '100 bis 250 €'], [250, 500, '250 bis 500 €'], [500, Infinity, 'über 500 €']];

  /** Kennzahlen über die Anträge eines Jahres (ohne Abgelehnte, Storno, Minderungen und Umstellungen). regeln für die Provision je Euro Beitrag. */
  Y.rechne = function (p, jahr) {
    var raus = { abgelehnt: 1, widerruf: 1, absage: 1, storno: 1 }, liste = [];
    (p.antraege || []).forEach(function (a) {
      if (!a.eingang || +a.eingang.slice(0, 4) !== +jahr || raus[a.status] || (a.vorgang !== 'neu' && a.vorgang !== 'mehr')) return;
      var b = M.beitrag(a); if (!(b > 0)) return;
      var pers = {}, be = false, vn = M.vnName(a);
      a.positionen.forEach(function (ps, i) { pers[(ps.personennummer || ps.person || (i === 0 ? vn : vn)).toString().trim().toLowerCase() || 'vn'] = 1; if (M.beTarif(ps.tarif)) be = true; });
      var soll = AB.provision.soll(a, p.regeln);
      liste.push({ id: a.id, nr: a.nr, name: vn, bereich: a.bereich, beitrag: b, personen: Object.keys(pers).length, be: be, prov: soll.laufend ? 0 : soll.betrag, eingang: a.eingang, tarife: M.tarife(a) });
    });
    var o = { n: liste.length, liste: liste, bereiche: [], klassen: Y.KLASSEN.map(function (k) { return { name: k[2], n: 0, beitrag: 0 }; }) };
    if (!liste.length) return o;
    var w = liste.map(function (x) { return x.beitrag; }).sort(function (a, b) { return a - b; }), sum = w.reduce(function (s, x) { return s + x; }, 0), prov = liste.reduce(function (s, x) { return s + x.prov; }, 0);
    o.summe = U.runde(sum); o.schnitt = U.runde(sum / w.length); o.median = U.runde(U.median(w)); o.kleinster = w[0]; o.groesster = w[w.length - 1];
    o.oberesViertel = U.runde(U.quantil(w, 0.75)); o.provJeEuro = sum > 0 ? prov / sum : 0;
    o.top = liste.slice().sort(function (a, b) { return b.beitrag - a.beitrag; }).slice(0, 10);
    o.klein = liste.slice().sort(function (a, b) { return a.beitrag - b.beitrag; })[0];
    liste.forEach(function (x) { var k = Y.KLASSEN.findIndex(function (kl) { return x.beitrag > kl[0] && x.beitrag <= kl[1]; }); if (k < 0) k = 0; o.klassen[k].n++; o.klassen[k].beitrag += x.beitrag; });
    var jeB = {};
    liste.forEach(function (x) { var b = jeB[x.bereich] || (jeB[x.bereich] = { id: x.bereich, name: M.bereich[x.bereich] ? M.bereich[x.bereich].name : x.bereich, n: 0, summe: 0, max: 0, min: Infinity, werte: [] }); b.n++; b.summe += x.beitrag; b.max = Math.max(b.max, x.beitrag); b.min = Math.min(b.min, x.beitrag); b.werte.push(x.beitrag); });
    o.bereiche = Object.keys(jeB).map(function (k) { var b = jeB[k]; b.schnitt = U.runde(b.summe / b.n); b.median = U.runde(U.median(b.werte)); b.summe = U.runde(b.summe); delete b.werte; return b; }).sort(function (a, b) { return b.summe - a.summe; });
    // Familien: Anträge mit mehreren versicherten Personen
    var fam = liste.filter(function (x) { return x.personen >= 2; });
    o.familien = { n: fam.length, anteil: fam.length / liste.length, schnitt: fam.length ? U.runde(fam.reduce(function (s, x) { return s + x.beitrag; }, 0) / fam.length) : 0,
      einzelSchnitt: liste.length > fam.length ? U.runde(liste.filter(function (x) { return x.personen < 2; }).reduce(function (s, x) { return s + x.beitrag; }, 0) / (liste.length - fam.length)) : 0, gross: liste.filter(function (x) { return x.personen >= 3; }).length };
    // Beitragsentlastung bei Vollversicherung
    var voll = liste.filter(function (x) { return x.bereich === 'voll'; });
    o.be = { voll: voll.length, mit: voll.filter(function (x) { return x.be; }).length };
    // Was wäre, wenn …
    var unterMedian = liste.filter(function (x) { return x.beitrag < o.median; });
    o.wenn = [
      { text: 'jeder Antrag 10 € mehr Monatsbeitrag hätte', beitrag: 10 * liste.length },
      { text: 'die kleinere Hälfte Ihrer Anträge so groß wäre wie Ihr mittlerer Antrag (' + U.fmtEuro0(o.median) + ')', beitrag: unterMedian.reduce(function (s, x) { return s + (o.median - x.beitrag); }, 0) },
      { text: 'jeder Antrag so groß wäre wie Ihr oberes Viertel (' + U.fmtEuro0(o.oberesViertel) + ')', beitrag: liste.reduce(function (s, x) { return s + Math.max(0, o.oberesViertel - x.beitrag); }, 0) }
    ].map(function (x) { x.beitrag = U.runde(x.beitrag); x.provision = U.runde(x.beitrag * o.provJeEuro); return x; });
    if (o.be.voll > o.be.mit) o.wenn.push({ text: 'Sie bei den ' + (o.be.voll - o.be.mit) + ' Vollversicherungen ohne Beitragsentlastung je 50 € Beitragsentlastung ergänzt hätten', beitrag: 50 * (o.be.voll - o.be.mit), provision: U.runde(50 * (o.be.voll - o.be.mit) * o.provJeEuro) });
    return o;
  };

  /**
   * Krankentagegeld-Bedarf (Richtwert): Im Krankheitsfall entfallen nach sechs Wochen Gehalt und Arbeitgeberzuschuss.
   * Bedarf je Tag = (verfügbares Netto + voller Kranken- und Pflegebeitrag + ggf. eigene Rentenbeiträge) ÷ 30.
   */
  Y.tagegeld = function (netto, kvBeitrag, rente, vorhanden) {
    var bedarfMonat = (+netto || 0) + (+kvBeitrag || 0) + (+rente || 0), tag = Math.ceil(bedarfMonat / 30 / 5) * 5, hat = +vorhanden || 0;
    return { bedarfMonat: U.runde(bedarfMonat), bedarfTag: tag, vorhandenMonat: U.runde(hat * 30), lueckeTag: Math.max(0, tag - hat), lueckeMonat: U.runde(Math.max(0, bedarfMonat - hat * 30)), deckung: bedarfMonat > 0 ? Math.min(1, hat * 30 / bedarfMonat) : null };
  };

  // ---------- Tipps und Gesundheitstage (nach Systemdatum, ohne Internet) ----------
  // Feste Gedenk- und Aktionstage; Angaben bitte vor Verwendung in Kundenaktionen selbst prüfen.
  Y.TAGE = [['02-04', 'Weltkrebstag', 'Vorsorge und stationäre Zusatzversicherung ansprechen'], ['03-03', 'Welttag des Hörens', 'Hörgeräte-Leistung im ambulanten Zusatztarif'],
    ['03-15', 'Tag der Rückengesundheit', 'Heilpraktiker und Krankentagegeld'], ['04-07', 'Weltgesundheitstag', 'Guter Anlass für einen Gesundheits-Check bei Bestandskunden'],
    ['05-12', 'Internationaler Tag der Pflegenden', 'Pflegezusatz: Wer kümmert sich, wer zahlt?'], ['05-31', 'Weltnichtrauchertag', 'Vorsorge und Prävention'],
    ['06-14', 'Weltblutspendetag', 'Gesundheit als Gesprächseinstieg'], ['09-17', 'Welttag der Patientensicherheit', 'Chefarzt und Zweibettzimmer – stationäre Zusatzversicherung'],
    ['09-20', 'Weltkindertag', 'Kindernachversicherung und Kinder-Zusatztarife'], ['09-21', 'Welt-Alzheimertag', 'Pflegezusatz und Vorsorgevollmacht'],
    ['09-25', 'Tag der Zahngesundheit', 'Zahnzusatz: Kunden ohne Zahntarif anschreiben'], ['09-29', 'Weltherztag', 'Vorsorgetarife und Gesundheits-Check'],
    ['10-10', 'Welttag der seelischen Gesundheit', 'Berufsunfähigkeit und Krankentagegeld'], ['10-20', 'Welt-Osteoporose-Tag', 'Heilmittel und Vorsorge'],
    ['10-29', 'Welt-Schlaganfalltag', 'Pflegezusatz und Unfallschutz'], ['11-14', 'Weltdiabetestag', 'Vorsorge und ambulante Zusatzversicherung'], ['12-01', 'Welt-Aids-Tag', 'Gesundheit als Gesprächseinstieg']];
  Y.MONAT = [
    ['Jahresgespräche planen', 'Im Januar ist Zeit für Bestandskunden: Wer hat eine Vollversicherung und noch keine Beitragsentlastung?'],
    ['Beitragsanpassung als Türöffner', 'Wer nach der Beitragsanpassung anruft, bevor der Kunde es tut, gewinnt Vertrauen – und oft ein Gespräch über Optimierung.'],
    ['Beihilfe und Beamtenanwärter', 'Einstellungstermine im Frühjahr: Anwärter und Referendare jetzt ansprechen.'],
    ['An den September denken', 'Berufsstarter beginnen im August und September. Jetzt Eltern Ihrer Kunden ansprechen: Wer beginnt eine Ausbildung oder ein Studium?'],
    ['Zahn und Brille vor dem Urlaub', 'Zusatzkunden ohne Zahntarif finden Sie mit dem Filter in der Antragsliste – eine kleine Aktion mit zehn Anrufen genügt.'],
    ['Auslandsreise', 'Vor den Sommerferien: Auslandsreisekrankenversicherung als einfacher Einstieg in ein Gespräch.'],
    ['Halbzeit', 'Die Hälfte des Jahres ist vorbei. Schauen Sie in „Bonus": Was fehlt bis zum Grundbonus, und welche drei Kunden bringen Sie dorthin?'],
    ['Berufsstarter', 'Ausbildungs- und Studienbeginn: Krankenversicherung, Berufsunfähigkeit und Unfall für junge Leute.'],
    ['Tag der Zahngesundheit', 'Am 25. September ist Tag der Zahngesundheit. Eine Aktion in „Aktionen" anlegen und Kunden ohne Zahnzusatz anschreiben.'],
    ['Endspurt vorbereiten', 'Noch drei Monate: Welche Anträge sind seit Wochen offen? Die Ampel in der Antragsliste zeigt es.'],
    ['Jahreswechsel', 'Wechsel in die Vollversicherung zum Januar: Kündigungsfristen der gesetzlichen Kasse im Blick behalten.'],
    ['Danke sagen', 'Ein Anruf zum Jahresende bei Ihren zehn größten Kunden ist die beste Empfehlungswerbung.']];
  Y.WOCHE = ['Fragen Sie nach jedem Abschluss: „Wer in Ihrer Familie sollte das auch wissen?"', 'Ein Antrag mit zwei Personen ist selten doppelte Arbeit, aber oft doppelter Beitrag.',
    'Rufen Sie 30 Tage nach dem Abschluss an: „Ist alles angekommen, sind Sie zufrieden?" Das ist der beste Moment für eine Empfehlung.', 'Wer nur über den Preis spricht, verkauft den kleinsten Tarif. Sprechen Sie über die Leistung, die fehlt.',
    'Legen Sie für jede Beratung ohne Abschluss eine Wiedervorlage an – die meisten Abschlüsse entstehen beim zweiten Kontakt.', 'Vollversicherte einmal im Jahr, Zusatzversicherte alle zwei Jahre: Ein fester Rhythmus für Jahresgespräche schlägt jede Einzelaktion.',
    'Zu jeder Vollversicherung gehört die Frage nach der Beitragsentlastung im Alter.', 'Kleine Anträge kosten fast dieselbe Zeit wie große. Wo lohnt sich die Stunde mehr?',
    'Zehn Anrufe am Vormittag bringen mehr als ein perfekter Plan am Nachmittag.', 'Ein Kunde mit Zahnzusatz hat schon Ja gesagt. Stationär und Pflege sind der nächste Schritt.',
    'Tragen Sie jeden Antrag am Tag der Einreichung ein. Dann stimmt die Bonus-Vorschau von selbst.', 'Feiern Sie den Abschluss – und notieren Sie sofort, wann Sie sich wieder melden.'];
  /** Was heute angezeigt wird: Gesundheitstag (heute oder in den nächsten tage Tagen), Monatsthema, Tipp der Woche. */
  Y.heute = function (iso, tage) {
    tage = tage == null ? 10 : tage;
    var d = new Date(iso + 'T12:00:00'), tag = null;
    Y.TAGE.forEach(function (t) {
      var z = new Date(iso.slice(0, 4) + '-' + t[0] + 'T12:00:00'), diff = Math.round((z - d) / 86400000);
      if (diff >= 0 && diff <= tage && (!tag || diff < tag.inTagen)) tag = { name: t[1], idee: t[2], inTagen: diff, datum: iso.slice(0, 4) + '-' + t[0] };
    });
    var jan1 = new Date(iso.slice(0, 4) + '-01-01T12:00:00'), woche = Math.floor((d - jan1) / (7 * 86400000));
    return { tag: tag, monat: { titel: Y.MONAT[d.getMonth()][0], text: Y.MONAT[d.getMonth()][1] }, woche: Y.WOCHE[woche % Y.WOCHE.length] };
  };
})(globalThis.AB = globalThis.AB || {});
