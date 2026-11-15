/* Antragsbuch – Banken: Auswertung der Abrechnung je beteiligtem Vermittler (Bank / Bestandsinhaber), Ziele je Bank, Reporting. */
(function (AB) {
  'use strict';
  var U = AB.util, M = AB.model, K = AB.bank = {};

  /** Beteiligten aus dem Abrechnungsfeld lesen: „913095 (Name, als Bestandsinhaber)". Nummern 91… sind Banken. */
  K.beteiligter = function (text) {
    var m = /^\s*(\d{5,7})\s*(?:\(\s*([^,)]*?)\s*(?:,\s*als\s+([^)]*?))?\s*\))?/.exec(text || '');
    return m ? { nr: m[1], name: (m[2] || '').trim(), rolle: (m[3] || '').trim(), bank: /^91/.test(m[1]) } : null;
  };
  function sparte(z) { return /^LV$/i.test(String(z.sparte || '').trim()) ? 'lv' : /unfall/i.test(z.tg || '') ? 'uv' : 'kv'; }

  /** Je Beteiligtem: Produktion (Spalte „Produktion"), Sparten, Zusatz, Dynamik, Stück, Monatsverlauf, Hochrechnung. */
  K.rechne = function (zeilen, jahr) {
    var map = {}, letzter = 0;
    (zeilen || []).forEach(function (z) { if (+z.bdat.slice(0, 4) === +jahr && Math.abs(+z.prod || 0) > 0.005) letzter = Math.max(letzter, +z.bdat.slice(5, 7)); });
    (zeilen || []).forEach(function (z) {
      if (+z.bdat.slice(0, 4) !== +jahr) return;
      var b = K.beteiligter(z.beteil); if (!b) return;
      var o = map[b.nr] || (map[b.nr] = { nr: b.nr, name: b.name, rolle: b.rolle, bank: b.bank, zeilen: 0, prod: 0, kv: 0, uv: 0, lv: 0, zusatz: 0, dynamik: 0, prov: 0, provLaufend: 0, monate: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], bereiche: {}, vn: {}, pers: {}, neu: {} });
      if (!o.name && b.name) o.name = b.name;
      var pr = +z.prod || 0, be = M.bereichAusGruppe(z.tg), m = +z.bdat.slice(5, 7) - 1;
      o.zeilen++; o.prod += pr; o[sparte(z)] += pr; o.monate[m] += pr; o.bereiche[be] = (o.bereiche[be] || 0) + pr;
      if (be === 'zusatz') o.zusatz += pr;
      if (z.part === 'Erhöhung') { var te = AB.tarif.einordnen(z.tarif, z.tg); if ((te && te.kategorie === 'Pflegezusatz') || /^PG.*D/i.test(z.tarif || '')) o.dynamik += pr; }
      if (z.part === 'Bestand') o.provLaufend += +z.prov || 0; else o.prov += +z.prov || 0;
      o.vn[U.normVnr(z.vnr)] = 1; o.pers[U.normVnr(z.vnr) + '|' + z.pnr] = 1;
      if (z.part === 'Abschluss' && !z.st && pr > 0) o.neu[U.normVnr(z.vnr) + '|' + z.pnr] = 1;
    });
    return Object.keys(map).map(function (k) {
      var o = map[k];
      ['prod', 'kv', 'uv', 'lv', 'zusatz', 'dynamik', 'prov', 'provLaufend'].forEach(function (f) { o[f] = U.runde(o[f]); });
      o.monate = o.monate.map(U.runde); Object.keys(o.bereiche).forEach(function (b) { o.bereiche[b] = U.runde(o.bereiche[b]); });
      o.vertraege = Object.keys(o.vn).length; o.personen = Object.keys(o.pers).length; o.neuePersonen = Object.keys(o.neu).length; delete o.vn; delete o.pers; delete o.neu;
      o.stand = letzter; o.hr = letzter ? U.runde(o.prod * 12 / letzter) : 0;
      return o;
    }).sort(function (a, b) { return (b.bank ? 1 : 0) - (a.bank ? 1 : 0) || b.prod - a.prod; });
  };

  /** Ziel (Planproduktion im Jahr) und Zeitzielerreichungsgrad: Stand gegen den zeitanteiligen Plan. */
  K.ziel = function (p, bank) {
    var e = (p.banken && p.banken[bank.nr]) || {}, plan = e.ziel != null && e.ziel !== '' ? +e.ziel : null;
    return { plan: plan, name: e.name || bank.name || '', zeitziel: plan && bank.stand ? U.runde(plan * bank.stand / 12) : null,
      grad: plan && bank.stand ? bank.prod / (plan * bank.stand / 12) : null, hrGrad: plan ? bank.hr / plan : null, fehlt: plan ? U.runde(Math.max(0, plan - bank.prod)) : null };
  };
  K.setze = function (p, nr, feld, wert) { if (!p.banken) p.banken = {}; var e = p.banken[nr] || (p.banken[nr] = {}); if (wert == null || wert === '') delete e[feld]; else e[feld] = wert; };

  /** Übersicht aller Banken als Tabelle (Excel). */
  K.tabelle = function (p, liste) {
    var sp = [{ t: 'Nummer', b: 10 }, { t: 'Bank / Beteiligter', b: 30 }, { t: 'Rolle', b: 18 }, { t: 'Produktion', typ: 'euro', b: 14 }, { t: 'davon KV', typ: 'euro', b: 12 }, { t: 'davon Zusatz', typ: 'euro', b: 13 }, { t: 'davon Dynamik', typ: 'euro', b: 14 },
      { t: 'Hochrechnung', typ: 'euro', b: 14 }, { t: 'Planproduktion', typ: 'euro', b: 15 }, { t: 'Zeitzielerreichung %', typ: 'zahl', b: 12 }, { t: 'Verträge', typ: 'zahl', b: 10 }, { t: 'Personen', typ: 'zahl', b: 10 }, { t: 'Neue Personen', typ: 'zahl', b: 10 }, { t: 'Meine Provision', typ: 'euro', b: 15 }];
    return { spalten: sp, zeilen: liste.map(function (b) { var z = K.ziel(p, b); return [b.nr, z.name, b.rolle, b.prod, b.kv, b.zusatz, b.dynamik, b.hr, z.plan != null ? z.plan : '', z.grad != null ? Math.round(z.grad * 100) : '', b.vertraege, b.personen, b.neuePersonen, U.runde(b.prov + b.provLaufend)]; }),
      farbe: function (w, r, c) { return c === 9 && typeof w[9] === 'number' ? (w[9] >= 100 ? 'gut' : w[9] >= 70 ? 'warn' : 'krit') : null; } };
  };

  /** Reporting für eine Bank: Kopf, Produktion, Sparten, Stück, Monatsverlauf – als zwei Tabellenblätter. */
  K.reporting = function (p, bank) {
    var z = K.ziel(p, bank), e0 = function (v) { return v == null ? '' : v; }, monat = bank.stand ? U.MONATE[bank.stand - 1] : '–';
    var unter = 'Vermittler-Nr. ' + bank.nr + ' · Stand ' + monat + ' ' + p.jahr + ' · erstellt am ' + U.fmtDatum(U.heute()) + ' · aus der Provisionsabrechnung des betreuenden Außendienstpartners';
    var blatt1 = [
      ['Produktion in € MB', '', ''], ['Krankenversicherung', bank.kv, bank.stand ? U.runde(bank.kv * 12 / bank.stand) : ''], ['  davon Zusatzversicherung', bank.zusatz, bank.stand ? U.runde(bank.zusatz * 12 / bank.stand) : ''],
      ['  davon aus Dynamik', bank.dynamik, ''], ['Unfallversicherung', bank.uv, bank.stand ? U.runde(bank.uv * 12 / bank.stand) : ''], ['Lebensversicherung', bank.lv, bank.stand ? U.runde(bank.lv * 12 / bank.stand) : ''],
      ['Gesamt', bank.prod, bank.hr], ['', '', ''], ['Planproduktion im Jahr', e0(z.plan), ''], ['Zeitziel bis ' + monat, e0(z.zeitziel), ''], ['Zeitzielerreichungsgrad in %', z.grad != null ? Math.round(z.grad * 100) : '', z.hrGrad != null ? Math.round(z.hrGrad * 100) : ''],
      ['', '', ''], ['Stück', '', ''], ['Verträge mit Buchungen', bank.vertraege, ''], ['Versicherte Personen mit Buchungen', bank.personen, ''], ['Neue Personen (Abschluss)', bank.neuePersonen, '']];
    var b = Object.keys(bank.bereiche).filter(function (k) { return Math.abs(bank.bereiche[k]) > 0.005; }).sort(function (x, y) { return bank.bereiche[y] - bank.bereiche[x]; });
    return [
      { name: 'Bankenreporting', titel: 'Bankenreporting ' + p.jahr + ' · ' + (z.name || bank.nr), unter: unter, spalten: [{ t: '', b: 38 }, { t: 'Januar bis ' + monat, typ: 'euro', b: 18 }, { t: 'Hochrechnung ' + p.jahr, typ: 'euro', b: 18 }], zeilen: blatt1,
        farbe: function (w, r, c) { return c === 0 && /^(Produktion|Stück|Gesamt)/.test(w[0]) ? 'akzent' : null; } },
      { name: 'Verlauf', titel: 'Produktion je Monat und Produkt · ' + (z.name || bank.nr), unter: unter, spalten: [{ t: 'Monat / Produkt', b: 28 }, { t: 'Produktion', typ: 'euro', b: 16 }],
        zeilen: U.MONATE.slice(0, Math.max(bank.stand, 1)).map(function (m, i) { return [m, bank.monate[i]]; }).concat([['', '']], b.map(function (k) { return [M.bereich[k] ? M.bereich[k].name : k, bank.bereiche[k]]; })) }];
  };
})(globalThis.AB = globalThis.AB || {});
