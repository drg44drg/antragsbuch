/* Antragsbuch – Datenmodell: Projekt, Antrag, Status, Prüfungen, Migration. */
(function (AB) {
  'use strict';
  var U = AB.util, M = AB.model = {};

  M.SCHEMA = 1;
  M.FORMAT = 'antragsbuch';

  M.BEREICHE = [
    { id: 'voll', name: 'Vollversicherung', kurz: 'Voll', gruppen: ['Vollversicherung', 'Pflegeversicherung'] },
    { id: 'zusatz', name: 'Zusatzversicherung', kurz: 'Zusatz', gruppen: ['Zusatzversicherung (Art Leben)', 'Zusatzversicherung (Art Schaden)', 'Auslandskrankenversicherung'] },
    { id: 'bkv', name: 'bKV/Firmentarife', kurz: 'bKV', gruppen: ['Firmentarife'] },
    { id: 'gruppe', name: 'Gruppentarife', kurz: 'Gruppe', gruppen: ['Gruppentarife'] },
    { id: 'pflege', name: 'Pflegepflicht', kurz: 'Pflege', gruppen: ['Vollversicherung', 'Pflegeversicherung', 'Zusatzversicherung (Art Leben)'] },
    { id: 'leben', name: 'Leben', kurz: 'Leben', gruppen: ['Lebensversicherung (Standard)', 'SDL (Standard)'] },
    { id: 'unfall', name: 'Unfall', kurz: 'Unfall', gruppen: ['Unfallversicherung'] },
    { id: 'gkv', name: 'GKV (mhplus-Mitgliedschaft)', kurz: 'GKV', gruppen: [] }
  ];
  M.VORGAENGE = [
    { id: 'neu', name: 'Neu' },
    { id: 'mehr', name: 'Mehrbeitrag' },
    { id: 'minder', name: 'Minderbeitrag/Reduzierung' },
    { id: 'umstellung', name: 'Umstellung ohne Provision' },
    { id: 'dynamik', name: 'Dynamik' },
    { id: 'storno', name: 'Storno' }
  ];
  M.STATUS = [
    { id: 'eingereicht', name: 'Eingereicht' },
    { id: 'policiert', name: 'Policiert' },
    { id: 'abgerechnet', name: 'Abgerechnet' },
    { id: 'abgelehnt', name: 'Abgelehnt' },
    { id: 'widerruf', name: 'Widerruf' },
    { id: 'absage', name: 'Absage' },
    { id: 'storno', name: 'Storno' },
    { id: 'reklamiert', name: 'Reklamiert' }
  ];
  function nachId(liste) { var o = {}; liste.forEach(function (x) { o[x.id] = x; }); return o; }
  M.bereich = nachId(M.BEREICHE); M.vorgang = nachId(M.VORGAENGE); M.status = nachId(M.STATUS);
  M.name = function (art, id) { var x = M[art][id]; return x ? x.name : (id || ''); };

  /** Bereich aus der Tarifgruppe der Abrechnung ableiten. */
  M.bereichAusGruppe = function (tg) {
    for (var i = 0; i < M.BEREICHE.length; i++)
      if (M.BEREICHE[i].id !== 'pflege' && M.BEREICHE[i].gruppen.indexOf(tg) >= 0) return M.BEREICHE[i].id;
    return 'zusatz';
  };

  /** Bearbeitungszeit je Bereich in Werktagen: ab `gelb` Tagen gelb, ab `rot` Tagen rot. */
  M.standardSla = function () {
    var s = {};
    M.BEREICHE.forEach(function (b) { s[b.id] = { gelb: 5, rot: 10 }; });
    return s;
  };
  M.REKLA_ERGEBNIS = [{ id: '', name: 'Offen' }, { id: 'erfolgreich', name: 'Erfolgreich' }, { id: 'teilweise', name: 'Teilweise erfolgreich' }, { id: 'nicht', name: 'Nicht erfolgreich' }];
  M.reklaOffen = function (a) { return !!(a.reklamation && !a.reklamation.ergebnis); };
  M.NACHBEARBEITUNG = [{ id: '', name: 'Keine' }, { id: 'offen', name: 'Offen' }, { id: 'erledigt', name: 'Erledigt' }];

  M.standardEinstellungen = function () {
    return {
      vermittlernummer: '', name: '',
      toleranzBeitrag: 0.05, toleranzProvision: 0.5, pruefeProvision: true,
      offenTage: 60, stornoSchwelle: 90, grundverguetung: { stufe: '', betrag: null, tabelle: {} },
      provisionsarten: ['Abschluss', 'Erhöhung', 'Manuell', 'Bestand', 'Kündigungsrücknahme'], artenStand: 2,
      sla: M.standardSla(), abrechnungTag: 6
    };
  };

  M.neuesProjekt = function (jahr) {
    var jetzt = new Date().toISOString();
    return {
      format: M.FORMAT, schema: M.SCHEMA, projektId: U.uid(), jahr: jahr || new Date().getFullYear(),
      erstellt: jetzt, geaendert: jetzt,
      einstellungen: M.standardEinstellungen(),
      regeln: AB.provision.standardRegeln(),
      tarife: [], antraege: [],
      abrechnung: { felder: [], zeilen: [] },
      importe: [], importZaehler: 0,
      zuordnungen: {}, ignoriert: {},
      vdienst: { zuordnungen: {}, importe: [] },
      team: null, aktionen: [], bonus: null, ziele: {}, vorjahr: null, banken: {}, archiv: {}, agenturEingang: {}, agenturAbr: {},
      sicherungen: []
    };
  };

  /** Fremde/alte Projektdateien prüfen und auf das aktuelle Schema heben. */
  M.migriere = function (p) {
    if (!p || typeof p !== 'object' || p.format !== M.FORMAT)
      throw new Error('Das ist keine Antragsbuch-Projektdatei.');
    if (p.verschluesselt) throw new Error('Diese Projektdatei ist mit einem Passwort geschützt.');
    if (p.schema > M.SCHEMA)
      throw new Error('Diese Projektdatei stammt aus einer neueren Version des Antragsbuchs (Schema ' + p.schema + '). Bitte die aktuelle antragsbuch.html verwenden.');
    // Schritte für künftige Versionen: if (p.schema === 1) { …; p.schema = 2; }
    if (!p.schema) p.schema = 1;
    var leer = M.neuesProjekt(p.jahr);
    Object.keys(leer).forEach(function (k) { if (p[k] == null && k !== 'team' && k !== 'bonus' && k !== 'vorjahr') p[k] = leer[k]; });
    var std = M.standardEinstellungen();
    if (Array.isArray(p.einstellungen.provisionsarten) && !(p.einstellungen.artenStand >= 2)) { if (p.einstellungen.provisionsarten.indexOf('Kündigungsrücknahme') < 0) p.einstellungen.provisionsarten.push('Kündigungsrücknahme'); p.einstellungen.artenStand = 2; }
    Object.keys(std).forEach(function (k) { if (p.einstellungen[k] == null) p.einstellungen[k] = std[k]; });
    Object.keys(std.sla).forEach(function (k) { if (!p.einstellungen.sla[k]) p.einstellungen.sla[k] = std.sla[k]; });
    var regeln = AB.provision.standardRegeln();
    Object.keys(regeln).forEach(function (k) { if (!p.regeln[k]) p.regeln[k] = regeln[k]; });
    if (!p.vdienst.zuordnungen) p.vdienst.zuordnungen = {};
    if (!p.vdienst.importe) p.vdienst.importe = [];
    p.antraege.forEach(M.ergaenzeAntrag);
    if (p.team && p.team.zeilen && !p.team.zeilen.some(function (z) { return z.gesamt; }) && AB.team) AB.team.erkenneGesamt(p.team);
    return p;
  };

  M.neuePosition = function () {
    return { id: U.uid(), person: '', personennummer: '', tarif: '', beitrag: null, bereich: '' };
  };

  M.neuerAntrag = function (vorlage) {
    var a = {
      id: U.uid(), eingang: U.heute(), vn: { name: '', vorname: '' },
      bereich: 'voll', vorgang: 'neu', herkunft: '', vertragsnummer: '',
      positionen: [M.neuePosition()],
      beginn: '', gruppenvertrag: '', firma: '', laufzeit: null, leben: null,
      eantrag: false, bank: { aktiv: false, anteil: 50 }, bemerkung: '',
      status: 'eingereicht', statusDatum: U.heute(), statusManuell: false, historie: [],
      provisionManuell: null, abweichungOk: null, nachbearbeitung: { status: '', text: '', datum: '' }, reklamation: null,
      erstellt: new Date().toISOString(), geaendert: new Date().toISOString()
    };
    if (vorlage) {
      var k = JSON.parse(JSON.stringify(vorlage));
      ['eingang', 'vn', 'bereich', 'vorgang', 'herkunft', 'vertragsnummer', 'beginn', 'gruppenvertrag', 'firma', 'laufzeit', 'leben', 'eantrag', 'bank', 'bemerkung']
        .forEach(function (f) { a[f] = k[f]; });
      a.positionen = k.positionen.map(function (p) { p.id = U.uid(); return p; });
    }
    a.historie = [{ status: a.status, datum: a.statusDatum, am: a.erstellt, quelle: 'manuell' }];
    return a;
  };

  M.ergaenzeAntrag = function (a) {
    var n = M.neuerAntrag();
    Object.keys(n).forEach(function (k) { if (a[k] === undefined) a[k] = n[k]; });
    if (!a.vn) a.vn = { name: '', vorname: '' };
    if (!a.bank) a.bank = { aktiv: false, anteil: 50 };
    if (!a.nachbearbeitung) a.nachbearbeitung = { status: '', text: '', datum: '' };
    if (!Array.isArray(a.positionen) || !a.positionen.length) a.positionen = [M.neuePosition()];
    return a;
  };

  /**
   * Feste Positionsnummer je Antrag (wie die Zeilennummer im Excel-Antragsbuch). Einmal vergeben, bleibt sie für immer;
   * gelöschte Nummern werden nicht neu vergeben. Fehlende Nummern werden in der Reihenfolge des Eingangs ergänzt.
   */
  M.vergibNummern = function (p) {
    var max = +p.naechsteNr > 0 ? +p.naechsteNr - 1 : 0, ohne = [];
    (p.antraege || []).forEach(function (a) { if (+a.nr > 0) max = Math.max(max, +a.nr); else ohne.push(a); });
    if (!ohne.length && p.naechsteNr === max + 1) return false;
    ohne.sort(function (a, b) { return (a.eingang || '') < (b.eingang || '') ? -1 : (a.eingang || '') > (b.eingang || '') ? 1 : (a.erstellt || '') < (b.erstellt || '') ? -1 : 1; });
    ohne.forEach(function (a) { a.nr = ++max; });
    p.naechsteNr = max + 1;
    return ohne.length > 0;
  };

  /**
   * Grundvergütung nach Karrierestufe: Betrag je Monat aus der Stufentabelle, von Hand überschreibbar.
   * monat: 0–11 oder null (Jahr: bis zum laufenden Monat, in abgeschlossenen Jahren 12 Monate).
   */
  M.grundverguetung = function (p, monat, heute) {
    var g = (p.einstellungen && p.einstellungen.grundverguetung) || {}, tab = g.tabelle || {};
    var ks = M.KARRIERE.find(function (x) { return x.id === g.stufe; });
    var ausStufe = tab[g.stufe] != null && tab[g.stufe] !== '' ? +tab[g.stufe] || 0 : ks ? ks.fixum : 0, hand = g.betrag != null && g.betrag !== '' && !isNaN(+g.betrag);
    var je = hand ? +g.betrag : ausStufe, h = heute || U.heute(), hj = +h.slice(0, 4), jahr = +p.jahr;
    var monate = monat != null ? 1 : jahr < hj ? 12 : jahr > hj ? 0 : +h.slice(5, 7);
    return { stufe: ks ? ks.id : '', kurz: ks ? ks.kurz : '', jeMonat: U.runde(je), ausStufe: U.runde(ausStufe), manuell: hand, monate: monate, summe: U.runde(je * monate), gesetzt: je > 0 };
  };

  /**
   * Neuversicherung oder Bestand – Pflichtangabe bei Neugeschäft in der Vollversicherung und der bKV.
   * Für den Bonus zählen nur neue Personen: komplett neu abgeschlossene Vollversicherung (mit Pflegepflicht), auch neugeborene Kinder;
   * in der bKV Personen, die bisher nicht versichert waren. Veränderungen im Bestand zählen nicht.
   */
  M.HERKUNFT = { neu: 'Neuversicherung – neue Person', kind: 'Kindernachversicherung – neue Person', bestand: 'aus Bestand – Veränderung' };
  /** Karrieresystem „Gesundprofi im Außendienst": Stufe, Fixum je Monat, Wertung, Monatsbeiträge Provision im freien Geschäft. */
  M.KARRIERE = [
    { id: '1', kurz: 'BV1', name: 'Bezirksvertreter 1', fixum: 1500, wertung: 'bis 6.000', wert: 0, mb: 4, bonus: '1+2' },
    { id: '2', kurz: 'BV2', name: 'Bezirksvertreter 2', fixum: 2000, wertung: '6.000', wert: 6000, mb: 5, bonus: '1+2' },
    { id: '3', kurz: 'HV', name: 'Hauptvertreter', fixum: 2250, wertung: '9.000', wert: 9000, mb: 5.5, bonus: '3' },
    { id: '4', kurz: 'GV', name: 'Generalvertreter', fixum: 2750, wertung: '12.000', wert: 12000, mb: 6, bonus: '4' },
    { id: '5', kurz: 'GL', name: 'Gebietsleiter', fixum: 3300, wertung: '15.000', wert: 15000, mb: 7, bonus: '5' },
    { id: '6', kurz: 'GD', name: 'Gebietsdirektor', fixum: 4400, wertung: '20.000', wert: 20000, mb: 7, bonus: '6' }
  ];
  M.brauchtHerkunft = function (a) { return a.vorgang === 'neu' && (a.bereich === 'voll' || a.bereich === 'bkv'); };
  M.istPflegepflicht = function (tarif) { var e = tarif ? AB.tarif.einordnen(tarif) : null; return !!(e && e.kategorie === 'Pflegepflicht'); };

  /**
   * Beitragsentlastung wird immer als „BE/<Stufe>" geführt (Stufe = Zahl, z. B. BE/700). „BE MAX", „BEu" usw. sind nur Begriffe ohne Stufe.
   * Rückgabe: { be: true, tarif: 'BE/700' | 'BE/', stufe: 700 | null } oder null, wenn es kein BE-Tarif ist.
   */
  M.beTarif = function (tarif) {
    var t = String(tarif || '').trim(), m = /^BE\s*[\/ \-]?\s*(\d+(?:[.,]\d+)?)\s*[a-z]?$/i.exec(t);
    if (m) return { be: true, stufe: U.parseZahl(m[1]), tarif: 'BE/' + m[1].replace('.', ',') };
    if (/^BE(\s*[\/\-]?\s*(MAX)?|[aunz])?$/i.test(t)) return { be: true, stufe: null, tarif: 'BE/' };
    return null;
  };

  /** Provisionshaftung in Monaten nach den Provisionsrichtlinien (Stand 07/2025 bzw. Ventil 08/2025). */
  M.HAFTUNG = { voll: 60, pflege: 60, zusatz: 12, bkv: 12, gruppe: 12, unfall: 60, leben: 60, gkv: 0 };

  /**
   * Stand zur Karrierestufe bei gleichmäßigem („linearem") Verlauf: Wertung der Stufe ÷ 12 je Monat.
   * ist = Nettoproduktion bis einschließlich Monat `monate` (1–12). Liefert die eigene und die nächste Stufe.
   */
  M.stufenStand = function (stufeId, ist, monate) {
    var i = M.KARRIERE.findIndex(function (k) { return k.id === stufeId; }); if (i < 0 || !(monate > 0)) return null;
    var zeile = function (k) { var soll = k.wert * monate / 12; return { id: k.id, kurz: k.kurz, name: k.name, wertung: k.wert, jeMonat: U.runde(k.wert / 12), soll: U.runde(soll), diff: U.runde(ist - soll),
      quote: soll > 0 ? ist / soll : null, hochrechnung: U.runde(ist / monate * 12), restJeMonat: monate < 12 ? U.runde(Math.max(0, k.wert - ist) / (12 - monate)) : null }; };
    return { monate: monate, ist: U.runde(ist), eigene: zeile(M.KARRIERE[i]), naechste: M.KARRIERE[i + 1] ? zeile(M.KARRIERE[i + 1]) : null };
  };

  /**
   * Eigene Jahresziele je Produkt (Monatsbeitrag) gegen den Stand. p.ziele = { '2026': { voll: 3000, zusatz: 800, …, gesamt: 9000 } }.
   * Ist = Nettoproduktion laut Abrechnung je Bereich (Spalte „Produktion"); ohne Abrechnung der eingetragene Beitrag aus dem Antragsbuch.
   * Soll = Ziel × vergangene Monate ÷ 12 (gleichmäßiger Verlauf).
   */
  M.zieleStand = function (p, zeilen, heute) {
    var jahr = +p.jahr, h = heute || U.heute(), hj = +h.slice(0, 4), monate = jahr < hj ? 12 : jahr > hj ? 0 : +h.slice(5, 7);
    var z = (p.ziele && p.ziele[jahr]) || {}, vt = M.zielVerteilung(p), anteil = 0; for (var mi = 0; mi < monate; mi++) anteil += vt.anteile[mi];
    var ist = {}, ein = {}, hatAbr = false, raus = { abgelehnt: 1, widerruf: 1, absage: 1, storno: 1 }, zaehlt = { neu: 1, mehr: 1, minder: 1 };
    (zeilen || []).forEach(function (x) { if (+x.bdat.slice(0, 4) !== jahr || !(+x.prod)) return; hatAbr = true; var b = M.bereichAusGruppe(x.tg); ist[b] = (ist[b] || 0) + +x.prod; });
    (p.antraege || []).forEach(function (a) {
      if (!a.eingang || raus[a.status] || !zaehlt[a.vorgang] || M.produktionsjahr(a, p, null, h) !== jahr) return;
      a.positionen.forEach(function (ps) { var b = ps.bereich || a.bereich; if (b === 'pflege') b = 'voll'; ein[b] = (ein[b] || 0) + M.vorzeichen(a, +ps.beitrag || 0); });
    });
    var zeile = function (id, name, ziel, i, e) {
      var wert = hatAbr ? i : e, soll = ziel != null ? ziel * anteil : null;
      return { id: id, name: name, ziel: ziel, vorjahr: p.vorjahr ? (id === 'gesamt' ? p.vorjahr.gesamt : p.vorjahr.bereiche[id] || 0) : null, ist: hatAbr ? U.runde(i) : null, eingetragen: U.runde(e), wert: U.runde(wert), soll: soll != null ? U.runde(soll) : null,
        diff: soll != null ? U.runde(wert - soll) : null, quote: ziel > 0 ? wert / ziel : null, fehlt: ziel > 0 ? U.runde(Math.max(0, ziel - wert)) : null,
        restJeMonat: ziel > 0 && monate < 12 ? U.runde(Math.max(0, ziel - wert) / (12 - monate)) : null };
    };
    var ber = M.BEREICHE.filter(function (b) { return b.id !== 'pflege' && b.id !== 'gkv'; }), sumI = 0, sumE = 0;
    Object.keys(ist).forEach(function (k) { sumI += ist[k]; }); Object.keys(ein).forEach(function (k) { if (k !== 'gkv') sumE += ein[k]; });
    var zeilenO = ber.map(function (b) { return zeile(b.id, b.name, z[b.id] != null && z[b.id] !== '' ? +z[b.id] : null, ist[b.id] || 0, ein[b.id] || 0); });
    var sumZ = zeilenO.reduce(function (s, x) { return s + (x.ziel || 0); }, 0), gesamtZiel = z.gesamt != null && z.gesamt !== '' ? +z.gesamt : (sumZ > 0 ? sumZ : null);
    return { jahr: jahr, monate: monate, anteil: anteil, verteilung: vt, hatAbrechnung: hatAbr, zeilen: zeilenO, gesamt: zeile('gesamt', 'Gesamt', gesamtZiel, sumI, sumE), gesamtAusSumme: !(z.gesamt != null && z.gesamt !== '') && sumZ > 0 };
  };
  /**
   * Verteilung des Jahresziels auf die Monate in Prozent. Standard: gleichmäßig (100 ÷ 12). Der ADP kann einzelne Monate ändern
   * (z. B. August weniger, Jahresende mehr). anteile = auf Summe 1 gebracht, damit auch eine Summe ungleich 100 sauber rechnet.
   */
  M.zielVerteilung = function (p) {
    var z = (p.ziele && p.ziele[p.jahr]) || {}, roh = Array.isArray(z.verteilung) && z.verteilung.length === 12 ? z.verteilung.map(function (v) { return Math.max(0, +v || 0); }) : null;
    var summe = roh ? roh.reduce(function (s, v) { return s + v; }, 0) : 0;
    if (!roh || summe <= 0) { roh = []; for (var i = 0; i < 12; i++) roh.push(100 / 12); summe = 100; return { prozent: roh, summe: 100, anteile: roh.map(function (v) { return v / 100; }), eigen: false }; }
    return { prozent: roh, summe: U.runde(summe), anteile: roh.map(function (v) { return v / summe; }), eigen: true };
  };
  /** fest = Monate, die der ADP selbst gesetzt hat (bleiben bei „Rest verteilen" stehen). */
  M.setzeVerteilung = function (p, prozent, fest) {
    if (!p.ziele) p.ziele = {}; var j = p.ziele[p.jahr] || (p.ziele[p.jahr] = {});
    if (!prozent) { delete j.verteilung; delete j.verteilungFest; return; }
    j.verteilung = prozent.map(function (v) { return Math.max(0, +v || 0); });
    if (fest) j.verteilungFest = fest.map(function (x) { return !!x; });
  };
  M.verteilungFest = function (p) { var z = (p.ziele && p.ziele[p.jahr]) || {}; return Array.isArray(z.verteilungFest) && z.verteilungFest.length === 12 ? z.verteilungFest.slice() : [false, false, false, false, false, false, false, false, false, false, false, false]; };
  /** Rest gleichmäßig verteilen: Die selbst gesetzten Monate bleiben, die übrigen teilen sich, was bis 100 % fehlt. */
  M.verteileRest = function (p) {
    var vt = M.zielVerteilung(p), fest = M.verteilungFest(p), summeFest = 0, frei = 0;
    fest.forEach(function (f, i) { if (f) summeFest += vt.prozent[i]; else frei++; });
    if (!frei) return false;
    var je = Math.max(0, 100 - summeFest) / frei;
    M.setzeVerteilung(p, vt.prozent.map(function (v, i) { return fest[i] ? v : je; }), fest);
    return true;
  };
  /** Vorjahreswerte für die Planung aus einer Abrechnung: Nettoproduktion je Produkt und Monat. Gespeichert wird nur diese Zusammenfassung. */
  M.vorjahrAus = function (zeilen, jahr, quelle) {
    var o = { jahr: +jahr, quelle: quelle || '', gesamt: 0, bereiche: {}, monate: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], am: U.heute() };
    (zeilen || []).forEach(function (x) { if (+x.bdat.slice(0, 4) !== +jahr || !(+x.prod)) return; var b = M.bereichAusGruppe(x.tg); o.bereiche[b] = (o.bereiche[b] || 0) + +x.prod; o.gesamt += +x.prod; o.monate[+x.bdat.slice(5, 7) - 1] += +x.prod; });
    Object.keys(o.bereiche).forEach(function (k) { o.bereiche[k] = U.runde(o.bereiche[k]); }); o.gesamt = U.runde(o.gesamt); o.monate = o.monate.map(U.runde);
    return o;
  };
  /** Monatsverteilung des Vorjahres in Prozent (negative Monate zählen als 0). */
  M.vorjahrVerteilung = function (vj) {
    if (!vj) return null; var pos = vj.monate.map(function (v) { return Math.max(0, v); }), s = pos.reduce(function (a, b) { return a + b; }, 0);
    return s > 0 ? pos.map(function (v) { return U.runde(v / s * 100 * 10) / 10; }) : null;
  };
  M.setzeZiel = function (p, id, wert) { if (!p.ziele) p.ziele = {}; var j = p.ziele[p.jahr] || (p.ziele[p.jahr] = {}); if (wert == null || wert === '' || isNaN(wert)) delete j[id]; else j[id] = +wert; };

  // ---------- Produktionsjahr und Jahreswechsel ----------
  /** Produktionsschluss eines Jahres (Standard 18.12.). Was danach verarbeitet wird, zählt zum Folgejahr. */
  M.produktionsschluss = function (p, jahr) {
    var e = (p.einstellungen && p.einstellungen.produktionsschluss) || {};
    return e[jahr] || (jahr + '-12-18');
  };
  /** Datum, ab dem ein Antrag verarbeitet ist: früheste Policierung (Veränderungsdienst) oder Buchung (Abrechnung). r = Abgleichsergebnis des Antrags. */
  M.wirksamDatum = function (a, r) {
    var d = '';
    (a.historie || []).forEach(function (h) { if (h.status === 'policiert' && h.datum && (!d || h.datum < d)) d = h.datum; });
    if (!d && a.status === 'policiert') d = a.statusDatum || '';
    var b = '';
    if (r && r.buendel && r.buendel.length) r.buendel.forEach(function (x) { var t = x.bdat || (x.monat + '-01'); if (!b || t < b) b = t; });
    else if (a.status === 'abgerechnet' || a.status === 'storno') b = a.statusDatum || '';
    return d && b ? (d < b ? d : b) : (d || b);
  };
  /**
   * In welches Produktionsjahr fällt ein Antrag?
   *  – verarbeitet (policiert/abgerechnet): Jahr der Verarbeitung; nach dem Produktionsschluss das Folgejahr.
   *  – Beginn ab dem 2. Januar eines späteren Jahres: dieses Jahr (zählt nicht im alten Jahr, auch wenn früh policiert).
   *  – Beginn 1.1. des Folgejahres: zählt im alten Jahr, wenn bis zum Produktionsschluss policiert; sonst im Folgejahr.
   *  – noch offen: frühestens das Jahr der Einreichung (nach dem Produktionsschluss das Folgejahr); nach einem Jahreswechsel wandert er ins neue Projektjahr mit.
   */
  M.produktionsjahr = function (a, p, r, heute) {
    var w = M.wirksamDatum(a, r), j;
    var nachSchluss = function (d) { var y = +d.slice(0, 4); return d > M.produktionsschluss(p, y) ? y + 1 : y; };
    if (w) j = nachSchluss(w);
    else {
      if (!a.eingang) return +p.jahr;
      j = nachSchluss(a.eingang);
      var abgeschlossen = { abgelehnt: 1, widerruf: 1, absage: 1 };
      if (!abgeschlossen[a.status]) j = Math.max(j, +p.jahr);   // offene Anträge wandern ins laufende Projektjahr mit
    }
    if (a.beginn && a.beginn >= (j + 1) + '-01-02') j = +a.beginn.slice(0, 4);
    return j;
  };
  /** Jahr und Monat, in dem ein Antrag in den Auswertungen erscheint (Monat der Einreichung; aus einem Vorjahr herübergezogen: Januar). */
  M.zaehlt = function (a, p, r, heute) {
    var j = M.produktionsjahr(a, p, r, heute), ej = a.eingang ? +a.eingang.slice(0, 4) : j;
    return { jahr: j, monat: ej === j ? +a.eingang.slice(5, 7) - 1 : ej < j ? 0 : 11 };
  };
  /**
   * Jahreswechsel in derselben Datei: Abrechnung, Teamdaten, Bonus und Importliste des laufenden Jahres wandern ins Archiv,
   * die Vorjahreswerte werden für die Planung festgehalten, alle Anträge bleiben. Ein archiviertes Jahr lässt sich wieder öffnen.
   */
  M.jahreswechsel = function (p, neuesJahr) {
    neuesJahr = +neuesJahr; if (!neuesJahr || neuesJahr === +p.jahr) return false;
    if (!p.archiv) p.archiv = {};
    p.archiv[p.jahr] = { abrechnung: p.abrechnung || null, team: p.team || null, bonus: p.bonus || null, importe: p.importe || [], importZaehler: p.importZaehler || 0 };
    var ziel = p.archiv[neuesJahr], vor = neuesJahr - 1 === +p.jahr ? p.archiv[p.jahr] : p.archiv[neuesJahr - 1];
    var stufe = p.bonus && p.bonus.stufe;
    p.jahr = neuesJahr;
    p.abrechnung = ziel ? ziel.abrechnung : null; p.team = ziel ? ziel.team : null; p.importe = ziel ? ziel.importe || [] : []; p.importZaehler = ziel ? ziel.importZaehler || 0 : 0;
    p.bonus = ziel && ziel.bonus ? ziel.bonus : (stufe ? Object.assign(AB.bonus.leer(), { stufe: stufe }) : null);
    delete p.archiv[neuesJahr];
    p.vorjahr = vor && vor.abrechnung ? M.vorjahrAus(AB.abrechnung.entpacke(vor.abrechnung), neuesJahr - 1, 'Jahreswechsel') : null;
    if (p.vorjahr && !p.vorjahr.gesamt) p.vorjahr = null;
    return true;
  };
  M.archivJahre = function (p) { return Object.keys(p.archiv || {}).map(Number).sort(); };

  M.vnName = function (a) {
    return (a.vn.name || '') + (a.vn.vorname ? ', ' + a.vn.vorname : '');
  };

  /** Minder-/Storno-Vorgänge zählen immer negativ, auch wenn positiv erfasst. */
  M.vorzeichen = function (a, betrag) {
    if (betrag == null || isNaN(betrag)) return 0;
    return (a.vorgang === 'minder' || a.vorgang === 'storno') ? -Math.abs(betrag) : betrag;
  };
  M.beitrag = function (a) {
    var s = 0;
    for (var i = 0; i < a.positionen.length; i++) s += M.vorzeichen(a, +a.positionen[i].beitrag || 0);
    return U.runde(s);
  };
  M.tarife = function (a) {
    return a.positionen.map(function (p) { return p.tarif; }).filter(Boolean).join(', ');
  };

  /** Enthält der Antrag mindestens einen Beihilfetarif? */
  M.hatBeihilfe = function (a) { return a.positionen.some(function (ps) { return ps.tarif && AB.tarif.einordnen(ps.tarif).beihilfe; }); };
  /** Wird der Antrag gegen die Abrechnung geprüft? */
  M.pruefbar = function (a) { return a.bereich !== 'gkv' && a.vorgang !== 'umstellung'; };
  /** Zählt der Antrag noch als „unterwegs"? */
  M.istOffen = function (a) { return a.status === 'eingereicht' || a.status === 'policiert' || a.status === 'reklamiert'; };

  /**
   * Bearbeitungsampel eines Antrags. hatBuchung: Abgleich hat eine Buchung gefunden.
   * → { stufe: ''|'gruen'|'gelb'|'rot', wt (Werktage seit Einreichung), grund }
   */
  M.ampel = function (a, e, heute, hatBuchung) {
    var nb = a.nachbearbeitung && a.nachbearbeitung.status === 'offen';
    var wt = U.werktage(a.eingang, heute), o = { stufe: '', wt: wt, grund: '' };
    if (a.status === 'eingereicht') {
      var s = (e.sla && e.sla[a.bereich]) || { gelb: 5, rot: 10 };
      o.stufe = wt >= s.rot ? 'rot' : wt >= s.gelb ? 'gelb' : 'gruen';
      o.grund = wt + (wt === 1 ? ' Werktag' : ' Werktage') + ' seit Einreichung, noch nicht policiert (Ziel ' + s.gelb + ')';
    } else if (a.status === 'policiert') {
      o.wt = U.werktage(a.statusDatum, heute);
      if (!M.pruefbar(a)) { o.stufe = 'gruen'; o.grund = 'Policiert'; }
      else if (hatBuchung) { o.stufe = 'gruen'; o.grund = 'Policiert und gebucht'; }
      else {
        var d = a.statusDatum || a.eingang || heute, j = +d.slice(0, 4), m = +d.slice(5, 7) + 1;
        if (m > 12) { m = 1; j++; }
        var tag = Math.min(28, +e.abrechnungTag || 6), faellig = j + '-' + (m < 10 ? '0' : '') + m + '-' + (tag < 10 ? '0' : '') + tag;
        var ueber = U.tageZwischen(faellig, heute);
        o.stufe = ueber > 31 ? 'rot' : ueber > 0 ? 'gelb' : 'gruen';
        o.grund = ueber > 0 ? 'Policiert, aber seit ' + U.fmtDatum(faellig) + ' nicht abgerechnet' : 'Policiert – Abrechnung erwartet ab ' + U.fmtDatum(faellig);
      }
      if (!U.normVnr(a.vertragsnummer) && a.bereich !== 'gkv' && o.stufe === 'gruen') { o.stufe = 'gelb'; o.grund = 'Policiert, aber Vertragsnummer fehlt'; }
    } else if (a.status === 'reklamiert') { o.stufe = 'gelb'; o.grund = 'Reklamiert'; }
    if (nb) { o.stufe = 'rot'; o.grund = 'Nachbearbeitung offen' + (a.nachbearbeitung.text ? ': ' + a.nachbearbeitung.text : '') + (o.grund ? ' · ' + o.grund : ''); }
    return o;
  };

  /** Pflichtfeldprüfung → Liste { feld, text }. */
  M.pruefeAntrag = function (a) {
    var f = [];
    if (!a.eingang) f.push({ feld: 'eingang', text: 'Eingangsdatum fehlt.' });
    if (!String(a.vn.name || '').trim()) f.push({ feld: 'vn.name', text: 'Name des Versicherungsnehmers fehlt.' });
    if (!String(a.vn.vorname || '').trim() && a.bereich !== 'bkv' && a.bereich !== 'gruppe')
      f.push({ feld: 'vn.vorname', text: 'Vorname des Versicherungsnehmers fehlt.' });
    if (!M.bereich[a.bereich]) f.push({ feld: 'bereich', text: 'Bereich fehlt.' });
    if (!M.vorgang[a.vorgang]) f.push({ feld: 'vorgang', text: 'Vorgangsart fehlt.' });
    if (a.herkunft === 'kind' && a.bereich !== 'voll') f.push({ feld: 'herkunft', text: 'Kindernachversicherung gibt es nur in der Vollversicherung.' });
    else if (M.brauchtHerkunft(a) && !M.HERKUNFT[a.herkunft]) f.push({ feld: 'herkunft', text: 'Bitte angeben: Neuversicherung (neue Person) oder aus dem Bestand.' });
    var pos = a.positionen.filter(function (p) { return p.tarif || p.beitrag != null || p.person; });
    if (!pos.length) f.push({ feld: 'pos.0.tarif', text: 'Mindestens eine Position mit Tarif und Beitrag erfassen.' });
    a.positionen.forEach(function (p, i) {
      if (pos.indexOf(p) < 0 && a.positionen.length > 1) return;
      if (!String(p.tarif || '').trim()) f.push({ feld: 'pos.' + i + '.tarif', text: 'Position ' + (i + 1) + ': Tarif fehlt.' });
      var be = M.beTarif(p.tarif);
      if (be && be.stufe == null && a.quelle !== 'abrechnung' && a.quelle !== 'altbuch') f.push({ feld: 'pos.' + i + '.tarif', text: 'Position ' + (i + 1) + ': Beitragsentlastung bitte mit Stufe angeben, z. B. BE/700.' });
      if (a.bereich !== 'gkv' && (p.beitrag == null || p.beitrag === '' || isNaN(p.beitrag)))
        f.push({ feld: 'pos.' + i + '.beitrag', text: 'Position ' + (i + 1) + ': Beitrag fehlt.' });
    });
    if (a.bereich === 'leben' && a.vorgang !== 'umstellung' && a.quelle !== 'abrechnung' && a.quelle !== 'altbuch' && !(a.leben && AB.leben && AB.leben.produkt(a.leben.produkt)))
      f.push({ feld: 'leben.produkt', text: 'Leben: bitte das Produkt aus der Liste wählen (z. B. „BU" oder „*91" eintippen).' });
    if (a.bereich === 'leben' && a.vorgang !== 'umstellung' && !(a.leben && a.leben.einmal) && !(+a.laufzeit > 0))
      f.push({ feld: 'laufzeit', text: 'Leben: Beitragszahlungsdauer in Jahren fehlt (für die Wertungssumme).' });
    if (a.bank.aktiv && !(+a.bank.anteil > 0 && +a.bank.anteil <= 100))
      f.push({ feld: 'bank.anteil', text: 'Bank-Anteil muss zwischen 1 und 100 % liegen.' });
    return f;
  };

  /**
   * Zweites Einlesen eines Antragsbuchs (Fortsetzung oder dieselbe Datei noch einmal): Welche Einträge sind vermutlich schon da?
   * Verglichen werden Eingang, Bereich, Vorgangsart, Name, Tarife und Beitrag; jeder vorhandene Antrag deckt höchstens einen neuen ab.
   */
  M.signatur = function (a) {
    return [a.eingang || '', a.bereich || '', a.vorgang || '', U.falte(M.vnName(a)), a.positionen.map(function (ps) { return U.falte(ps.tarif || '').replace(/\s+/g, ''); }).sort().join('+'), Math.round(M.beitrag(a) * 100)].join('|');
  };
  M.trenneDubletten = function (vorhandene, neue) {
    var vorrat = {}; (vorhandene || []).forEach(function (a) { var s = M.signatur(a); vorrat[s] = (vorrat[s] || 0) + 1; });
    var o = { neu: [], doppelt: [] };
    (neue || []).forEach(function (a) { var s = M.signatur(a); if (vorrat[s] > 0) { vorrat[s]--; o.doppelt.push(a); } else o.neu.push(a); });
    return o;
  };

  /** Mögliche Dubletten zu einem (neuen/geänderten) Antrag. */
  M.findeDubletten = function (a, alle) {
    var vn = U.normVnr(a.vertragsnummer), name = U.falte(M.vnName(a)).replace(/[^a-z]/g, ''), b = M.beitrag(a);
    if (!name && !vn) return [];
    return alle.filter(function (x) {
      if (x.id === a.id || x.bereich !== a.bereich || x.vorgang !== a.vorgang) return false;
      if (Math.abs(M.beitrag(x) - b) > 0.005) return false;
      var gleicherName = name && U.falte(M.vnName(x)).replace(/[^a-z]/g, '') === name;
      var gleicheNr = vn && U.normVnr(x.vertragsnummer) === vn;
      if (!gleicherName && !gleicheNr) return false;
      return Math.abs(U.tageZwischen(x.eingang, a.eingang)) <= 31;
    });
  };

  /** Statuswechsel mit Datum und Historie. quelle: 'manuell' | 'abgleich' | 'vdienst'. */
  M.setzeStatus = function (a, status, datum, quelle, notiz) {
    if (a.status === status && a.statusDatum === (datum || a.statusDatum)) return false;
    a.status = status; a.statusDatum = datum || U.heute();
    a.historie.push({ status: status, datum: a.statusDatum, am: new Date().toISOString(), quelle: quelle || 'manuell', notiz: notiz || '' });
    if (quelle === 'reklamation') a.statusManuell = false;
    if (quelle === 'manuell' || !quelle) a.statusManuell = !(status === 'eingereicht' || status === 'policiert');
    a.geaendert = new Date().toISOString();
    return true;
  };

  /** Letzter Status, der nicht vom Abgleich gesetzt wurde (zum Zurücknehmen). */
  M.statusVorAbgleich = function (a) {
    for (var i = a.historie.length - 1; i >= 0; i--)
      if (a.historie[i].quelle !== 'abgleich') return a.historie[i];
    return { status: 'eingereicht', datum: a.eingang };
  };

  /** Volltext eines Antrags für die Sofortsuche. */
  M.suchtext = function (a) {
    var t = [a.vn.name, a.vn.vorname, a.vertragsnummer, U.normVnr(a.vertragsnummer), M.name('bereich', a.bereich), M.name('vorgang', a.vorgang),
      M.name('status', a.status), U.fmtDatum(a.eingang), U.fmtDatum(a.beginn), a.gruppenvertrag, a.firma, a.bemerkung,
      U.fmtZahl(M.beitrag(a)), a.nachbearbeitung && a.nachbearbeitung.status === 'offen' ? 'nachbearbeitung ' + a.nachbearbeitung.text : '', a.reklamation ? 'reklamation ' + (a.reklamation.begruendung || '') : ''];
    a.positionen.forEach(function (p) { t.push(p.person, p.personennummer, p.tarif, p.beitrag == null ? '' : U.fmtZahl(+p.beitrag)); });
    return U.falte(t.join(' '));
  };

  /** Tarifliste um neue Einträge erweitern. Gibt die Zahl neuer Tarife zurück. */
  M.erweitereTarife = function (p, neue, quelle) {
    var vorhanden = {}, n = 0;
    p.tarife.forEach(function (t) { vorhanden[t.name.toLowerCase()] = t; });
    neue.forEach(function (t) {
      var name = String(t.name || '').trim();
      if (!name) return;
      var k = name.toLowerCase();
      if (vorhanden[k]) { if (!vorhanden[k].gruppe && t.gruppe) vorhanden[k].gruppe = t.gruppe; return; }
      vorhanden[k] = { name: name, gruppe: t.gruppe || '', quelle: quelle || 'manuell' };
      p.tarife.push(vorhanden[k]); n++;
    });
    if (n) p.tarife.sort(function (a, b) { return a.name.localeCompare(b.name, 'de', { numeric: true }); });
    return n;
  };

  /** Sicherungsstand anlegen (ohne Abrechnungszeilen), höchstens 10 behalten. */
  M.sichere = function (p, anlass) {
    var daten = JSON.stringify({
      antraege: p.antraege, zuordnungen: p.zuordnungen, ignoriert: p.ignoriert,
      einstellungen: p.einstellungen, regeln: p.regeln, tarife: p.tarife
    });
    p.sicherungen.push({ id: U.uid(), am: new Date().toISOString(), anlass: anlass, antraege: p.antraege.length, daten: daten });
    while (p.sicherungen.length > 10) p.sicherungen.shift();
  };
  M.stelleWiederHer = function (p, id) {
    var s = p.sicherungen.find(function (x) { return x.id === id; });
    if (!s) return false;
    var d = JSON.parse(s.daten);
    M.sichere(p, 'Vor Wiederherstellung');
    ['antraege', 'zuordnungen', 'ignoriert', 'einstellungen', 'regeln', 'tarife'].forEach(function (k) { if (d[k]) p[k] = d[k]; });
    p.antraege.forEach(M.ergaenzeAntrag);
    return true;
  };
})(globalThis.AB = globalThis.AB || {});
