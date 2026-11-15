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
  G.URTEIL = { ok: 'stimmt überein', abweichung: 'Abweichung', fehlt: 'nicht in der Abrechnung', ohneNr: 'Vertragsnummer fehlt' };

  /** Prüftabelle für den Export. */
  G.tabelle = function (erg) {
    var sp = [{ t: 'Pos.', typ: 'zahl', b: 7 }, { t: 'Vertragsnummer', b: 15 }, { t: 'Kunde', b: 26 }, { t: 'Tarif(e)', b: 20 }, { t: 'In der Abrechnung', b: 16 }, { t: 'Gebucht am', typ: 'datum', b: 12 },
      { t: 'Beitrag gemeldet', typ: 'euro', b: 15 }, { t: 'Beitrag laut Abrechnung', typ: 'euro', b: 18 }, { t: 'Gefordert', typ: 'euro', b: 14 }, { t: 'Anspruch', typ: 'euro', b: 14 }, { t: 'Differenz', typ: 'euro', b: 13 }, { t: 'Ergebnis', b: 24 }];
    return { spalten: sp, zeilen: erg.zeilen.map(function (r) { return [r.pos || '', r.vnr, r.kunde, r.tarife, r.inAbrechnung ? 'ja' : 'nein', r.gebuchtAm ? U.fmtDatum(r.gebuchtAm) : '', r.beitragGemeldet, r.inAbrechnung ? r.beitragAbr : '', r.gefordert, r.anspruch == null ? '' : r.anspruch, r.differenz == null ? '' : r.differenz, G.URTEIL[r.urteil] + (r.storno ? ' · mit Storno' : '')]; }),
      farbe: function (w, r, c) { return c !== 11 ? null : /^stimmt/.test(w[11]) ? 'gut' : /^Abweichung/.test(w[11]) ? 'krit' : 'warn'; } };
  };
})(globalThis.AB = globalThis.AB || {});
