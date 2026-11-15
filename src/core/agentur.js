/* Antragsbuch – Unternehmeragentur: Der Untervermittler schickt ausgewählte Anträge als Prüfdatei, der Agenturist prüft sie gegen seine Abrechnung. */
(function (AB) {
  'use strict';
  var U = AB.util, M = AB.model, G = AB.agentur = {};
  G.FORMAT = 'antragsbuch-agentur';
  G.MODI = { '': 'aus', agenturist: 'Ich bin Agenturist (erhalte die Gesamtabrechnung)', untervermittler: 'Ich bin Untervermittler (rechne mit dem Agenturisten ab)' };
  G.einstellung = function (p) { var e = p.einstellungen.agentur || (p.einstellungen.agentur = { modus: '', untervermittler: {} }); if (!e.untervermittler) e.untervermittler = {}; return e; };

  /**
   * Prüfdatei des Untervermittlers: nur was der Agenturist zum Abgleich braucht – Positionsnummer, Vertragsnummer, Kunde, Tarife, Beitrag,
   * Daten und die geforderte Provision (nach den eigenen Provisionsregeln oder dem überschriebenen Betrag). Keine Bemerkungen, keine Notizen.
   */
  G.erzeuge = function (p, antraege) {
    return { format: G.FORMAT, version: 1, erstellt: new Date().toISOString(), jahr: +p.jahr, von: String(p.einstellungen.vermittlernummer || ''), name: p.einstellungen.name || '',
      posten: antraege.map(function (a) {
        var soll = AB.provision.soll(a, p.regeln);
        return { pos: a.nr || '', vnr: a.vertragsnummer || '', kunde: M.vnName(a), bereich: a.bereich, vorgang: a.vorgang, tarife: a.positionen.map(function (x) { return x.tarif; }).filter(Boolean),
          beitrag: M.beitrag(a), eingang: a.eingang || '', beginn: a.beginn || '', status: a.status, provision: U.runde(soll.betrag), laufend: !!soll.laufend };
      }) };
  };
  G.istDatei = function (o) { return !!(o && o.format === G.FORMAT && Array.isArray(o.posten)); };

  /**
   * Prüfung beim Agenturisten: jeder Posten gegen die eigene Abrechnung.
   * anspruch: { art: 'mb' | 'prozent', wert } – was dem Untervermittler zusteht: Monatsbeiträge je Euro Beitrag oder Prozent der Provision des Agenturisten.
   * Ergebnis je Posten: inAbrechnung, Beitrag und Provision laut Abrechnung, Anspruch, gefordert, Differenz, Urteil.
   */
  G.pruefe = function (datei, zeilen, anspruch, tol) {
    tol = tol == null ? 0.5 : tol;
    var nachVn = {}, jahr = +datei.jahr;
    (zeilen || []).forEach(function (z) { if (jahr && +z.bdat.slice(0, 4) !== jahr) return; var k = U.normVnr(z.vnr); if (!k) return; (nachVn[k] || (nachVn[k] = [])).push(z); });
    var norm = function (t) { return U.falte(t || '').replace(/[^a-z0-9äöü]/g, ''); };
    var o = { von: datei.von, name: datei.name, jahr: jahr, erstellt: datei.erstellt, zeilen: [], summe: { gefordert: 0, anspruch: 0, differenz: 0, ok: 0, abweichung: 0, fehlt: 0, ohneNr: 0 } };
    datei.posten.forEach(function (x) {
      var kand = nachVn[U.normVnr(x.vnr)] || [], tarife = {}; (x.tarife || []).forEach(function (t) { tarife[norm(t)] = 1; });
      // erst die Tarife des Postens, sonst alle Buchungen des Vertrags
      var treffer = kand.filter(function (z) { return tarife[norm(z.tarif)] || (M.beTarif(z.tarif) && (x.tarife || []).some(function (t) { return M.beTarif(t); })); });
      if (!treffer.length && kand.length && !(x.tarife || []).length) treffer = kand;
      var beitrag = 0, prov = 0, storno = false, monat = '';
      treffer.forEach(function (z) { beitrag += z.mbd; prov += z.prov; if (z.st) storno = true; if (!monat || z.bdat < monat) monat = z.bdat; });
      var r = { pos: x.pos, vnr: x.vnr, kunde: x.kunde, tarife: (x.tarife || []).join(', '), beitragGemeldet: x.beitrag, gefordert: +x.provision || 0, inAbrechnung: treffer.length > 0, andereTarife: !treffer.length && kand.length > 0,
        beitragAbr: U.runde(beitrag), provAbr: U.runde(prov), gebuchtAm: monat, storno: storno, anspruch: null, differenz: null };
      if (r.inAbrechnung) {
        r.anspruch = U.runde(anspruch && anspruch.art === 'prozent' ? prov * (+anspruch.wert || 0) / 100 : beitrag * (anspruch ? +anspruch.wert || 0 : 0));
        r.differenz = U.runde(r.gefordert - r.anspruch);
      }
      r.urteil = !U.normVnr(x.vnr) ? 'ohneNr' : !r.inAbrechnung ? 'fehlt' : Math.abs(r.differenz) <= tol ? 'ok' : 'abweichung';
      o.zeilen.push(r);
      o.summe.gefordert += r.gefordert; o.summe.anspruch += r.anspruch || 0; o.summe[r.urteil]++;
    });
    o.summe.gefordert = U.runde(o.summe.gefordert); o.summe.anspruch = U.runde(o.summe.anspruch); o.summe.differenz = U.runde(o.summe.gefordert - o.summe.anspruch);
    return o;
  };
  /**
   * Agenturmodell (Übersicht „ADP/Agenturpartner", 100 % freies Geschäft): was die Unternehmeragentur dem Untervermittler
   * je Karrierestufe weitergibt. mb = freie Monatsbeiträge, gp = Grundpauschale an den Untervermittler,
   * gpSdk = Grundpauschale, die der Versicherer der Agentur für diesen Untervermittler zahlt. Die Bonuswerte sind ein Vorschlag.
   * Mindestens 1.500 € Grundpauschale und 4 MB müssen weitergegeben werden.
   */
  G.MODELL = [
    { id: 'BV1', stufe: 1, produktion: 5000, mb: 4, gp: 1500, gpSdk: 1500, grundbonus: 0, zb1: 0, zb2: 0, zb3: 0 },
    { id: 'BV2', stufe: 2, produktion: 6000, mb: 5, gp: 2000, gpSdk: 2250, grundbonus: 0.4, zb1: 2000, zb2: 1000, zb3: 1000 },
    { id: 'HV', stufe: 3, produktion: 9000, mb: 5.5, gp: 2250, gpSdk: 2750, grundbonus: 0.4, zb1: 2000, zb2: 1000, zb3: 1000 },
    { id: 'GV', stufe: 4, produktion: 12000, mb: 6, gp: 2750, gpSdk: 3000, grundbonus: 0.4, zb1: 2000, zb2: 1000, zb3: 1000 },
    { id: 'GL', stufe: 5, produktion: 15000, mb: 6, gp: 3000, gpSdk: 3250, grundbonus: 0.5, zb1: 3000, zb2: 2000, zb3: 1500 },
    { id: 'GD', stufe: 6, produktion: 20000, mb: 6, gp: 3000, gpSdk: 3250, grundbonus: 0.5, zb1: 4000, zb2: 2000, zb3: 1500 }
  ];
  G.MIN = { mb: 4, gp: 1500 };
  G.AGENTUR_MB = 7;
  /**
   * Ergänzende Grundvergütung des Versicherers für einen Untervermittler (Nachtrag zum Vertretervertrag):
   * in der Anlaufzeit (bis Ende des übernächsten Jahres nach Tätigkeitsbeginn) fest 1.500 € im Monat, danach nach der
   * Netto-KV-Eigenproduktion des Untervermittlers. Unter 6.000 € entfällt sie. Dazu höchstens 12 Monate Einarbeitungspauschale von 500 €.
   */
  G.GP_STAFFEL = [[15000, 3250], [12000, 3000], [9000, 2750], [6000, 2250]];
  G.GP_ANLAUF = 1500; G.EINARBEITUNG = 500;
  G.gpNachProduktion = function (produktion) { for (var i = 0; i < G.GP_STAFFEL.length; i++) if (produktion >= G.GP_STAFFEL[i][0]) return G.GP_STAFFEL[i][1]; return 0; };
  /** Nächste Schwelle der Staffel: { ab, gp, fehlt } oder null, wenn die höchste erreicht ist. */
  G.gpNaechste = function (produktion) { var n = null; G.GP_STAFFEL.forEach(function (x) { if (produktion < x[0]) n = { ab: x[0], gp: x[1], fehlt: U.runde(x[0] - produktion) }; }); return n; };
  G.stufe = function (id) { return G.MODELL.filter(function (x) { return x.id === id; })[0] || null; };

  /**
   * Abrechnung zwischen Unternehmeragentur und Untervermittler aus der Abrechnung, die der Versicherer für den
   * Untervermittler erstellt. Dort steht die Provision zum Satz der Agentur. Weitergegeben wird der Anteil
   * „weitergegebene MB ÷ MB der Agentur"; der Rest ist der Overhead der Agentur. Laufende Provisionen
   * (Provisionsart Bestand, Rechnung in Prozent) werden in voller Höhe weitergegeben.
   * uv: { mb, gp, gpSdk }, agMb: Satz der Agentur (Standard 7).
   * → { produktion, brutto, laufend, anspruch, overhead, anteil, monate:[{…}], gp:{ sdk, weiter, differenz, monate }, n, letzter }
   */
  G.abrechnungUv = function (zeilen, jahr, uv, agMb) {
    uv = uv || {}; agMb = +agMb > 0 ? +agMb : G.AGENTUR_MB;
    var hat = uv.mb != null && uv.mb !== '', anteil = hat ? Math.max(0, Math.min(1, (+uv.mb || 0) / agMb)) : null;
    var leer = function () { return { produktion: 0, brutto: 0, laufend: 0, anspruch: 0, overhead: 0, n: 0 }; };
    var o = leer(); o.monate = []; for (var m = 0; m < 12; m++) o.monate.push(leer());
    o.anteil = anteil; o.letzter = -1;
    (zeilen || []).forEach(function (z) {
      if (jahr && +z.bdat.slice(0, 4) !== +jahr) return;
      var mo = +z.bdat.slice(5, 7) - 1, lauf = z.part === 'Bestand' || z.bfProv === 'Prozent', prov = +z.prov || 0;
      var an = lauf ? prov : anteil == null ? 0 : prov * anteil;
      [o, o.monate[mo]].forEach(function (x) {
        x.n++; x.produktion += +z.prod || 0;
        if (lauf) x.laufend += prov; else x.brutto += prov;
        x.anspruch += an; x.overhead += prov - an;
      });
      if (mo > o.letzter) o.letzter = mo;
    });
    var runde = function (x) { ['produktion', 'brutto', 'laufend', 'anspruch', 'overhead'].forEach(function (k) { x[k] = U.runde(x[k]); }); };
    runde(o); o.monate.forEach(runde);
    if (anteil == null) { o.anspruch = null; o.overhead = null; o.monate.forEach(function (x) { x.anspruch = null; x.overhead = null; }); }
    var mon = o.letzter + 1, sdk = +uv.gpSdk || 0, weiter = +uv.gp || 0;
    o.gp = { monate: mon, sdk: U.runde(sdk * mon), weiter: U.runde(weiter * mon), differenz: U.runde((sdk - weiter) * mon), jeMonat: U.runde(sdk - weiter) };
    return o;
  };
  /** Tabelle der Abrechnung je Monat für Excel und Druck. */
  G.tabelleUv = function (a) {
    var sp = [{ t: 'Monat', b: 14 }, { t: 'Gewertete Produktion', typ: 'euro', b: 18 }, { t: 'Abschlussprovision lt. Abrechnung', typ: 'euro', b: 24 }, { t: 'Laufende Provision', typ: 'euro', b: 16 },
      { t: 'Anspruch Untervermittler', typ: 'euro', b: 20 }, { t: 'Overhead Agentur', typ: 'euro', b: 16 }, { t: 'Buchungen', typ: 'ganz', b: 10 }];
    var z = function (n, x) { return [n, x.produktion, x.brutto, x.laufend, x.anspruch == null ? '' : x.anspruch, x.overhead == null ? '' : x.overhead, x.n]; };
    return { spalten: sp, zeilen: a.monate.map(function (x, i) { return z(U.MONATE[i], x); }).filter(function (r, i) { return i <= a.letzter; }), summe: z('Summe', a) };
  };

  G.URTEIL = { ok: 'stimmt überein', abweichung: 'Abweichung', fehlt: 'nicht in der Abrechnung', ohneNr: 'Vertragsnummer fehlt' };

  /** Prüftabelle für den Export. */
  G.tabelle = function (erg) {
    var sp = [{ t: 'Pos.', typ: 'zahl', b: 7 }, { t: 'Vertragsnummer', b: 15 }, { t: 'Kunde', b: 26 }, { t: 'Tarif(e)', b: 20 }, { t: 'In der Abrechnung', b: 16 }, { t: 'Gebucht am', typ: 'datum', b: 12 },
      { t: 'Beitrag gemeldet', typ: 'euro', b: 15 }, { t: 'Beitrag laut Abrechnung', typ: 'euro', b: 18 }, { t: 'Gefordert', typ: 'euro', b: 14 }, { t: 'Anspruch', typ: 'euro', b: 14 }, { t: 'Differenz', typ: 'euro', b: 13 }, { t: 'Ergebnis', b: 24 }];
    return { spalten: sp, zeilen: erg.zeilen.map(function (r) { return [r.pos || '', r.vnr, r.kunde, r.tarife, r.inAbrechnung ? 'ja' : 'nein', r.gebuchtAm ? U.fmtDatum(r.gebuchtAm) : '', r.beitragGemeldet, r.inAbrechnung ? r.beitragAbr : '', r.gefordert, r.anspruch == null ? '' : r.anspruch, r.differenz == null ? '' : r.differenz, G.URTEIL[r.urteil] + (r.storno ? ' · mit Storno' : '')]; }),
      farbe: function (w, r, c) { return c !== 11 ? null : /^stimmt/.test(w[11]) ? 'gut' : /^Abweichung/.test(w[11]) ? 'krit' : 'warn'; } };
  };
})(globalThis.AB = globalThis.AB || {});
