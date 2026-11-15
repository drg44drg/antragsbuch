/* Antragsbuch – Abgleich Anträge ↔ Provisionsabrechnung (Kern der App). */
(function (AB) {
  'use strict';
  var U = AB.util, M = AB.model, A = AB.abgleich = {};

  /**
   * Buchungen bündeln: Vertrag × Person × Tarifgruppe × Buchungsmonat.
   * arten: erlaubte Provisionsarten (Filter). letzterImport: Nummer des jüngsten Imports.
   */
  A.buendle = function (zeilen, arten, letzterImport) {
    var erlaubt = {}, map = new Map(), nachVn = new Map();
    (arten || []).forEach(function (a) { erlaubt[a] = 1; });
    for (var i = 0; i < zeilen.length; i++) {
      var z = zeilen[i];
      if (arten && !erlaubt[z.part]) continue;
      var vn = U.normVnr(z.vnr), monat = z.bdat.slice(0, 7);
      var key = vn + '|' + z.pnr + '|' + z.tg + '|' + monat;
      var b = map.get(key);
      if (!b) {
        b = { key: key, vn: vn, vnr: z.vnr, pnr: z.pnr, tg: z.tg, monat: monat, zeilen: [], mbd: 0, prov: 0,
          stMbd: 0, stProv: 0, hatStorno: false, nurStorno: true, neu: false, vnName: z.vnName, vpName: z.vpName,
          vbeg: z.vbeg, bdat: z.bdat, shEnde: '', stgrund: '', gvnr: z.gvnr, tarife: [], arten: [] };
        map.set(key, b);
        var l = nachVn.get(vn); if (l) l.push(b); else nachVn.set(vn, [b]);
      }
      b.zeilen.push(z); b.mbd += z.mbd; b.prov += z.prov;
      if (z.st) { b.hatStorno = true; b.stMbd += z.mbd; b.stProv += z.prov; if (z.stgrund && !b.stgrund) b.stgrund = z.stgrund; }
      else b.nurStorno = false;
      if (z.imp === letzterImport) b.neu = true;
      if (z.bdat > b.bdat) b.bdat = z.bdat;
      if (z.shEnde > b.shEnde) b.shEnde = z.shEnde;
      if (!b.vnName && z.vnName) b.vnName = z.vnName;
      if (z.tarif && b.tarife.indexOf(z.tarif) < 0) b.tarife.push(z.tarif);
      if (b.arten.indexOf(z.part) < 0) b.arten.push(z.part);
    }
    var liste = Array.from(map.values());
    liste.forEach(function (b) { b.mbd = U.runde(b.mbd); b.prov = U.runde(b.prov); b.stMbd = U.runde(b.stMbd); b.stProv = U.runde(b.stProv); });
    return { liste: liste, nachVn: nachVn, nachKey: map };
  };

  function summe(bs, f) { var s = 0; for (var i = 0; i < bs.length; i++) s += bs[i][f]; return U.runde(s); }
  function monatMinus1(ym) {
    var j = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1;
    if (m < 1) { m = 12; j--; }
    return j + '-' + (m < 10 ? '0' : '') + m;
  }

  /** Teilmenge der Bündel eines Monats suchen, deren Beitragsdifferenz zum Soll passt. */
  function passendeTeilmenge(bs, soll, tol) {
    if (Math.abs(summe(bs, 'mbd') - soll) <= tol) return bs;
    for (var i = 0; i < bs.length; i++) if (Math.abs(bs[i].mbd - soll) <= tol) return [bs[i]];
    var n = bs.length;
    if (n < 3 || n > 12) return null;
    for (var mask = 1; mask < (1 << n) - 1; mask++) {
      var s = 0, c = 0;
      for (var k = 0; k < n; k++) if (mask & (1 << k)) { s += bs[k].mbd; c++; }
      if (c > 1 && Math.abs(s - soll) <= tol) return bs.filter(function (_, k2) { return mask & (1 << k2); });
    }
    return null;
  }

  function waehle(kand, soll, tol) {
    var monate = {}, i;
    kand.forEach(function (b) { (monate[b.monat] = monate[b.monat] || []).push(b); });
    var ms = Object.keys(monate).sort();
    for (i = 0; i < ms.length; i++) {
      var t = passendeTeilmenge(monate[ms[i]], soll, tol);
      if (t) return t;
    }
    for (i = 0; i < ms.length; i++) {
      var teil = monate[ms[i]].filter(function (b) { return soll > 0 ? b.mbd > 0 : soll < 0 ? b.mbd < 0 : true; });
      if (teil.length) return teil;
    }
    return [];
  }

  function gruppenPassen(a, tg) {
    var ids = {}; ids[a.bereich] = 1;
    a.positionen.forEach(function (p) { if (p.bereich) ids[p.bereich] = 1; });
    return Object.keys(ids).some(function (id) { return M.bereich[id] && M.bereich[id].gruppen.indexOf(tg) >= 0; });
  }

  /**
   * Abgleich rechnen. Verändert nichts am Projekt.
   * p: Projekt; zeilen: entpackte Abrechnungszeilen; heute: ISO-Datum.
   */
  A.rechne = function (p, zeilen, heute) {
    var e = p.einstellungen, tolB = +e.toleranzBeitrag || 0, tolP = +e.toleranzProvision || 0;
    heute = heute || U.heute();
    var B = A.buendle(zeilen, e.provisionsarten, p.importZaehler);
    var frei = new Set(B.liste.map(function (b) { return b.key; }));
    var R = {}, reihen = [];
    p.antraege.forEach(function (a) {
      var soll = AB.provision.soll(a, p.regeln);
      R[a.id] = { antrag: a, sollB: M.beitrag(a), soll: soll, sollP: soll.betrag, buendel: [], stornos: [], istB: 0, istP: 0,
        monat: '', bdat: '', liste: '', diffB: 0, diffP: 0, tageOffen: 0, manuell: false };
      reihen.push(R[a.id]);
    });

    // 1) Bestätigte Zuordnungen bleiben über Importe erhalten
    Object.keys(p.zuordnungen || {}).forEach(function (key) {
      var b = B.nachKey.get(key), r = R[p.zuordnungen[key]];
      if (b && r && frei.has(key)) { r.buendel.push(b); r.manuell = true; frei.delete(key); }
    });

    // 2) Automatisch über die Vertragsnummer
    var sortiert = reihen.filter(function (r) { return M.pruefbar(r.antrag) && U.normVnr(r.antrag.vertragsnummer); })
      .sort(function (x, y) { return x.antrag.eingang < y.antrag.eingang ? -1 : x.antrag.eingang > y.antrag.eingang ? 1 : 0; });
    var abgewiesen = { abgelehnt: 1, widerruf: 1, absage: 1 };
    sortiert.forEach(function (r) {
      var a = r.antrag;
      if (r.buendel.length || abgewiesen[a.status]) return;
      var ab = a.eingang ? monatMinus1(a.eingang.slice(0, 7)) : '';
      var kand = (B.nachVn.get(U.normVnr(a.vertragsnummer)) || []).filter(function (b) { return frei.has(b.key) && b.monat >= ab; });
      if (!kand.length) return;
      var pnrs = {}, hatPnr = false;
      a.positionen.forEach(function (ps) { var n = U.normVnr(ps.personennummer); if (n) { pnrs[n] = 1; hatPnr = true; } });
      if (hatPnr) { var f1 = kand.filter(function (b) { return pnrs[U.normVnr(b.pnr)]; }); if (f1.length) kand = f1; }
      var f2 = kand.filter(function (b) { return gruppenPassen(a, b.tg); });
      if (f2.length) kand = f2;
      var wahl = r.soll.laufend ? kand : waehle(kand, r.sollB, tolB);
      wahl.forEach(function (b) { r.buendel.push(b); frei.delete(b.key); });
    });

    // 2b) Korrekturen aus späteren Monaten (z. B. nach Provisionsreklamation) nachziehen
    sortiert.forEach(function (r) {
      if (!r.buendel.length || r.soll.laufend) return;
      for (var runde = 0; runde < 3; runde++) {
        var dB = summe(r.buendel, 'mbd') - r.sollB, dP = summe(r.buendel, 'prov') - r.sollP;
        var abwB = Math.abs(dB) > tolB + 1e-9, abwP = !!e.pruefeProvision && Math.abs(dP) > tolP + 1e-9;
        if (!abwB && !abwP) return;
        var m0 = r.buendel[0].monat, treffer = null;
        (B.nachVn.get(U.normVnr(r.antrag.vertragsnummer)) || []).forEach(function (b) {
          if (treffer || !frei.has(b.key) || b.monat <= m0) return;
          var okB = Math.abs(dB + b.mbd) <= tolB + 1e-9, okP = !e.pruefeProvision || Math.abs(dP + b.prov) <= tolP + 1e-9;
          if (okB && okP) treffer = b;
        });
        if (!treffer) return;
        r.buendel.push(treffer); frei.delete(treffer.key); r.nachbuchung = true;
      }
    });

    // 3) Rückbuchungen (X) einem abgerechneten Antrag zuordnen
    B.liste.forEach(function (b) {
      if (!frei.has(b.key) || !b.hatStorno || b.mbd >= 0) return;
      var best = null, bestW = -1;
      reihen.forEach(function (r) {
        var a = r.antrag;
        if (!r.buendel.length || U.normVnr(a.vertragsnummer) !== b.vn || a.vorgang === 'minder' || a.vorgang === 'storno') return;
        var m0 = r.buendel[0].monat;
        if (m0 > b.monat) return;
        var w = 0;
        r.buendel.forEach(function (x) { if (x.pnr === b.pnr) w = Math.max(w, x.tg === b.tg ? 3 : 2); else if (x.tg === b.tg) w = Math.max(w, 1); });
        if (w > bestW || (w === bestW && best && m0 > best.buendel[0].monat)) { best = r; bestW = w; }
      });
      if (best) { best.stornos.push(b); frei.delete(b.key); }
    });

    // 4) Einordnen
    var erg = { proAntrag: R, gleich: [], abweichung: [], offen: [], neu: [], storno: [], haftung: [], vorschlaege: [], ohneNr: [],
      buendel: B, status: [], stand: heute };
    reihen.forEach(function (r) {
      var a = r.antrag;
      if (r.buendel.length) {
        r.buendel.sort(function (x, y) { return x.monat < y.monat ? -1 : x.monat > y.monat ? 1 : 0; });
        r.istB = summe(r.buendel, 'mbd'); r.istP = summe(r.buendel, 'prov');
        r.monat = r.buendel[0].monat; r.bdat = r.buendel[0].bdat;
        var sollP = r.sollP, monate = {};
        if (r.soll.laufend) { r.buendel.forEach(function (b) { monate[b.monat] = 1; }); sollP = U.runde(r.sollP * Object.keys(monate).length); r.sollPGesamt = sollP; }
        r.diffB = r.soll.laufend ? 0 : U.runde(r.istB - r.sollB);
        r.diffP = U.runde(r.istP - sollP);
        r.abwB = Math.abs(r.diffB) > tolB + 1e-9;
        r.abwP = !!e.pruefeProvision && Math.abs(r.diffP) > tolP + 1e-9;
        r.fingerabdruck = r.istB.toFixed(2) + '|' + r.istP.toFixed(2);
        r.akzeptiert = a.abweichungOk === r.fingerabdruck;
        r.liste = (r.abwB || r.abwP) && !r.akzeptiert ? 'abweichung' : 'gleich';
        r.shEnde = r.buendel.reduce(function (m, b) { return b.shEnde > m ? b.shEnde : m; }, '');
        if (r.stornos.length) {
          r.stB = summe(r.stornos, 'mbd'); r.stP = summe(r.stornos, 'prov');
          r.stDatum = r.stornos[0].bdat; r.stGrund = r.stornos.map(function (b) { return b.stgrund; }).filter(Boolean)[0] || '';
          r.vollStorno = r.istB > 0 && Math.abs(r.stB) >= r.istB * (+e.stornoSchwelle || 90) / 100 - tolB;
          // „X" heißt Storno ODER Verrechnung: ohne Provisionswirkung ist es eine Verrechnung (z. B. Tarifwechsel).
          // Sonst wird nach der Provisionsrichtlinie anteilig zurückgebucht: je nicht belegtem Monat 1/12 (nicht substitutiv) bzw. 1/60 (substitutiv).
          var basis = 0, zur = 0, subst = false;
          r.stornos.forEach(function (b) { b.zeilen.forEach(function (z) { if (!z.st || Math.abs(z.prov) < 0.005) return; basis += Math.abs((+z.fProv || 0) * z.mbd); zur += Math.abs(z.prov); if (z.tg === 'Vollversicherung' || z.tg === 'Pflegeversicherung') subst = true; }); });
          r.verrechnung = Math.abs(r.stP) < 0.005;
          r.stAnteil = basis > 0.005 ? A.haftungsAnteil(zur / basis, subst) : null;
          erg.storno.push(r);
        } else if (r.shEnde && r.shEnde >= heute) erg.haftung.push(r);
        if (r.vollStorno) r.liste = 'storno'; else erg[r.liste].push(r);
      } else if (M.pruefbar(a) && (a.status === 'eingereicht' || a.status === 'policiert' || (a.quelle === 'altbuch' && a.status === 'abgerechnet' && B.liste.length))) {
        r.tageOffen = U.tageZwischen(a.eingang, heute);
        if (r.tageOffen >= (+e.offenTage || 0)) { r.liste = 'offen'; erg.offen.push(r); }
      }
      // gewünschter Status
      var ziel = null, datum = null;
      if (r.buendel.length) {
        if (r.vollStorno && !a.statusManuell && (a.status === 'eingereicht' || a.status === 'policiert' || a.status === 'abgerechnet')) { ziel = 'storno'; datum = r.stDatum; }
        else if (a.status === 'eingereicht' || a.status === 'policiert' || (a.status === 'reklamiert' && letzteQuelle(a) === 'reklamation')) { ziel = 'abgerechnet'; datum = r.bdat; }
        else if (a.status === 'storno' && !r.vollStorno && !a.statusManuell && letzteQuelle(a) === 'abgleich') { ziel = 'abgerechnet'; datum = r.bdat; }
      } else if (!a.statusManuell && letzteQuelle(a) === 'abgleich' && (a.status === 'abgerechnet' || a.status === 'storno')) {
        var vor = M.statusVorAbgleich(a); ziel = vor.status; datum = vor.datum;
      }
      if (ziel && ziel !== a.status) erg.status.push({ id: a.id, status: ziel, datum: datum });
      // Vertragsnummer fällig?
      if (!U.normVnr(a.vertragsnummer) && a.bereich !== 'gkv' && !abgewiesen[a.status] &&
          (a.vorgang !== 'neu' || a.status !== 'eingereicht')) erg.ohneNr.push(r);
    });

    // 5) Buchungen ohne Antrag
    B.liste.forEach(function (b) {
      if (!frei.has(b.key)) return;
      b.ignoriert = !!(p.ignoriert && p.ignoriert[b.key]); b.vorschlag = A.vorschlagFuer(b);
      erg.neu.push(b);
    });
    erg.neu.sort(function (x, y) { return x.monat < y.monat ? 1 : x.monat > y.monat ? -1 : (x.vn < y.vn ? -1 : 1); });

    // 6) Vorschläge für Anträge ohne Vertragsnummer
    erg.vorschlaege = A.vorschlaege(reihen, erg.neu, tolB);
    return erg;
  };

  function letzteQuelle(a) { return a.historie.length ? a.historie[a.historie.length - 1].quelle : ''; }

  /**
   * Stufe 2: Trefferwertung über Name, Beitrag, Provision, Beginn, Tarif.
   * Kandidaten sind einzelne Bündel sowie Zusammenfassungen je Vertrag×Person, Vertrag×Tarifgruppe und Vertrag – jeweils im Buchungsmonat.
   * So finden auch Einträge ohne Name und ohne Vertragsnummer (altes Antragsbuch) ihre Buchung.
   */
  A.vorschlaege = function (reihen, freieBuendel, tol) {
    var offen = reihen.filter(function (r) {
      var a = r.antrag;
      return !r.buendel.length && M.pruefbar(a) && !U.normVnr(a.vertragsnummer) && (M.istOffen(a) || (a.status === 'abgerechnet' && a.quelle === 'altbuch'));
    });
    if (!offen.length || !freieBuendel.length) return [];
    var gruppen = new Map();
    function lege(k, b) {
      var g = gruppen.get(k);
      if (!g) { g = { vn: b.vn, vnr: b.vnr, monat: b.monat, buendel: [], namen: [] }; gruppen.set(k, g); }
      g.buendel.push(b);
      [b.vnName, b.vpName].forEach(function (n) { if (n && g.namen.indexOf(n) < 0) g.namen.push(n); });
    }
    freieBuendel.forEach(function (b) {
      if (b.ignoriert) return;
      lege('v|' + b.vn + '|' + b.monat, b); lege('p|' + b.vn + '|' + b.pnr + '|' + b.monat, b); lege('t|' + b.vn + '|' + b.tg + '|' + b.monat, b); lege('b|' + b.key, b);
    });
    var gesehen = {}, gl = [];
    gruppen.forEach(function (g) {
      var sig = g.buendel.map(function (b) { return b.key; }).sort().join('#');
      if (gesehen[sig]) return; gesehen[sig] = 1; gl.push(g);
    });
    gl.forEach(function (g) {
      g.mbd = summe(g.buendel, 'mbd'); g.prov = summe(g.buendel, 'prov');
      g.teile = {}; g.namen.forEach(function (n) { U.namensTeile(n).forEach(function (t) { g.teile[t.slice(0, 3)] = 1; }); });
      g.tarife = {}; g.buendel.forEach(function (b) { b.tarife.forEach(function (t) { g.tarife[t.toLowerCase()] = 1; }); });
    });
    var out = [];
    offen.forEach(function (r) {
      var a = r.antrag, name = /^Ohne Name/.test(a.vn.name) ? '' : M.vnName(a), personen = a.positionen.map(function (p) { return p.person; }).filter(Boolean);
      var teile = U.namensTeile(name + ' ' + personen.join(' ')).map(function (t) { return t.slice(0, 3); });
      var ohneMonat = a.eingang ? monatMinus1(a.eingang.slice(0, 7)) : '', kand = [];
      gl.forEach(function (g) {
        var punkte = 0, gruende = [];
        var dB = Math.abs(g.mbd - r.sollB), beitragGenau = dB <= tol + 1e-9 && Math.abs(r.sollB) > 0.005;
        var provGenau = Math.abs(r.sollP) > 1 && Math.abs(g.prov - r.sollP) <= 0.5;
        var nameMoeglich = teile.some(function (t) { return g.teile[t]; });
        if (!nameMoeglich && !beitragGenau && !provGenau) return;
        if (beitragGenau) { punkte += 30; gruende.push('Beitrag stimmt'); }
        else if (Math.abs(r.sollB) > 0.005 && dB <= Math.max(1, Math.abs(r.sollB) * 0.03)) { punkte += 18; gruende.push('Beitrag fast gleich'); }
        if (provGenau) { punkte += 30; gruende.push('Provision stimmt'); }
        var sim = 0;
        if (nameMoeglich) g.namen.forEach(function (n) {
          sim = Math.max(sim, U.namensAehnlichkeit(name, n));
          personen.forEach(function (ps) { sim = Math.max(sim, U.namensAehnlichkeit(ps, n) * 0.95); });
        });
        if (sim >= 0.85) { punkte += 50; gruende.push('Name stimmt'); }
        else if (sim >= 0.7) { punkte += 35; gruende.push('Name ähnlich'); }
        else if (sim >= 0.55) { punkte += 20; gruende.push('Name teilweise'); }
        var beg = g.buendel[0].vbeg;
        if (a.beginn && beg) {
          if (a.beginn === beg) { punkte += 10; gruende.push('Beginn stimmt'); }
          else if (a.beginn.slice(0, 7) === beg.slice(0, 7)) { punkte += 6; gruende.push('Beginn im selben Monat'); }
        }
        // Tarifvergleich ohne Sonderzeichen; Beitragsentlastung („BE/700" im Antrag, „BEu" in der Abrechnung) gilt als derselbe Tarif
        var tKeys = Object.keys(g.tarife), tn = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9äöü]/g, ''); };
        if (a.positionen.some(function (ps) { if (!ps.tarif) return false; var be = M.beTarif(ps.tarif);
          return tKeys.some(function (k) { return tn(k) === tn(ps.tarif) || (be && M.beTarif(k)); }); })) { punkte += 10; gruende.push('Tarif stimmt'); }
        if (g.buendel.some(function (b) { return gruppenPassen(a, b.tg); })) punkte += 5; else punkte -= 10;
        if (a.eingang && g.monat === a.eingang.slice(0, 7)) { punkte += 5; if (a.quelle === 'altbuch') gruende.push('gleicher Monat'); }
        else if (g.monat < ohneMonat) punkte -= 20;
        if (punkte >= 45) kand.push({ vnr: g.vnr, vn: g.vn, monat: g.monat, keys: g.buendel.map(function (b) { return b.key; }),
          punkte: Math.min(100, punkte), gruende: gruende, mbd: g.mbd, prov: g.prov, name: g.namen[0] || '', sicher: beitragGenau && provGenau,
          tarife: g.buendel.reduce(function (t, b) { return t.concat(b.tarife); }, []) });
      });
      if (kand.length) {
        kand.sort(function (x, y) { return y.punkte - x.punkte || y.keys.length - x.keys.length; });
        // „sicher" nur, wenn es genau einen Vertrag mit Beitrag UND Provision gibt
        var sichere = kand.filter(function (k) { return k.sicher; }), vns = {};
        sichere.forEach(function (k) { vns[k.vn] = 1; });
        kand.forEach(function (k) { k.sicher = k.sicher && Object.keys(vns).length === 1; });
        out.push({ reihe: r, kandidaten: kand.slice(0, 3), sicher: kand[0].sicher });
      }
    });
    return out;
  };

  /** Alle sicheren Vorschläge (Beitrag und Provision stimmen, eindeutig) auf einmal bestätigen. → Anzahl */
  A.bestaetigeSichere = function (p, erg) {
    var vergeben = {}, n = 0;
    erg.vorschlaege.forEach(function (v) {
      var k = v.kandidaten[0];
      if (!v.sicher || k.keys.some(function (x) { return vergeben[x]; })) return;
      k.keys.forEach(function (x) { vergeben[x] = 1; });
      if (A.bestaetige(p, v.reihe.antrag.id, k)) n++;
    });
    return n;
  };

  /** Vom Abgleich ermittelte Statuswechsel im Projekt eintragen. → Anzahl */
  A.wendeStatusAn = function (p, erg) {
    var n = 0, nachId = {};
    p.antraege.forEach(function (a) { nachId[a.id] = a; });
    erg.status.forEach(function (s) {
      var a = nachId[s.id];
      if (a && M.setzeStatus(a, s.status, s.datum, 'abgleich')) n++;
    });
    erg.status = [];
    return n;
  };

  /**
   * Offene Reklamationen schließen, sobald der Abgleich stimmt (Buchung da, keine Abweichung mehr).
   * → Anzahl geschlossener Reklamationen
   */
  A.schliesseReklamationen = function (p, erg) {
    var n = 0;
    p.antraege.forEach(function (a) {
      var r = erg.proAntrag[a.id];
      if (!M.reklaOffen(a) || !r || !r.buendel.length || r.liste !== 'gleich' || r.akzeptiert) return;
      a.reklamation.ergebnis = 'erfolgreich'; a.reklamation.erledigtAm = r.buendel[r.buendel.length - 1].bdat;
      a.reklamation.automatisch = true; a.geaendert = new Date().toISOString(); n++;
    });
    return n;
  };

  /** Vorschlag bestätigen: Vertragsnummer eintragen und Zuordnung dauerhaft merken. */
  A.bestaetige = function (p, antragId, kandidat) {
    var a = p.antraege.find(function (x) { return x.id === antragId; });
    if (!a) return false;
    if (!U.normVnr(a.vertragsnummer)) a.vertragsnummer = kandidat.vnr;
    kandidat.keys.forEach(function (k) { p.zuordnungen[k] = antragId; delete p.ignoriert[k]; });
    a.geaendert = new Date().toISOString();
    return true;
  };

  /** Aus einer Buchung ohne Antrag einen Antrag erzeugen (bereits zugeordnet). */
  /**
   * Vorschlag, was eine abgerechnete Position ohne Antrag vermutlich ist. sicher = darf gesammelt übernommen werden.
   * An einer echten Jahresabrechnung abgelesen: Dynamik erscheint als Provisionsart „Erhöhung" auf Pflegetarifen mit Dynamik (PG…D), meist zum 01.10.
   */
  /** Anteil der zurückgebuchten Provision als Bruch nach der Haftungszeit: n/12, bei substitutiver KV auch n/60. */
  A.haftungsAnteil = function (q, substitutiv) {
    q = Math.max(0, Math.min(1.05, q));
    var o = { q: q, text: U.fmtZahl(q * 100, 0) + ' %' }, n12 = Math.round(q * 12), n60 = Math.round(q * 60);
    if (q > 0.995) o.text = 'vollständig';
    else if (Math.abs(q * 12 - n12) < 0.07 && n12 > 0) o.text = n12 + '/12';
    else if (substitutiv && Math.abs(q * 60 - n60) < 0.2 && n60 > 0) o.text = n60 + '/60';
    return o;
  };

  A.VORSCHLAG = { dynamik: 'Dynamik', anpassung: 'Dynamik oder Beitragsanpassung', mehr: 'Erhöhung (Mehrbeitrag)', vollneu: 'Vollversicherung neu (mit Pflegepflicht)', bkv: 'bKV-Anmeldung',
    teilung: 'Provisions- oder Produktionsteilung?', neu: 'Neugeschäft – Antrag fehlt im Buch?', wechsel: 'Mehrbeitrag oder Tarifwechsel', storno: 'Storno / Rückbuchung', minder: 'Reduzierung',
    fehlt: 'Fehlt in der neuesten Abrechnung – bitte prüfen', bestand: 'Laufende Bestandsprovision', ruecknahme: 'Kündigungsrücknahme', legacy: 'Korrektur aus dem Altsystem', manuell: 'Manuelle Buchung' };
  A.vorschlagFuer = function (b) {
    var zl = b.zeilen || [], arten = {}, alleNeu = true, pp = false, dynTarif = zl.length > 0, klein = zl.length > 0, prod = 0, prov = 0, hatProd = false;
    zl.forEach(function (z) {
      arten[z.part] = 1;
      if (Math.abs(z.mb - z.mbd) > 0.005) alleNeu = false;
      if (M.istPflegepflicht(z.tarif)) pp = true;
      // Pflegezusatz hat Dynamik bis zum 70. Lebensjahr – auch Tarife ohne „D" im Namen
      var te = AB.tarif.einordnen(z.tarif, z.tg); if (!(te && te.kategorie === 'Pflegezusatz') && !/^PG.*D/i.test(String(z.tarif || '').trim())) dynTarif = false;
      if (z.prod != null) { hatProd = true; prod += Math.abs(+z.prod || 0); } prov += Math.abs(+z.prov || 0);
      if (Math.abs(z.mbd) >= 5) klein = false;
    });
    var nur = function (x) { return Object.keys(arten).length === 1 && arten[x]; }, v = function (id, vorgang, sicher, extra) { return Object.assign({ id: id, text: A.VORSCHLAG[id], vorgang: vorgang, sicher: !!sicher }, extra || {}); };
    if (zl.length && zl.every(function (z) { return z.fehlt; })) return v('fehlt', '', false, { abhaken: true });
    if (nur('Bestand') || (b.tg === 'Unfallversicherung' && !arten.Abschluss && !arten.Erhöhung)) return v('bestand', '', true, { abhaken: true });
    if (nur('Kündigungsrücknahme')) return v('ruecknahme', '', false, { abhaken: true });
    if (nur('Legacy')) return v('legacy', '', false, { abhaken: true });
    if (nur('Manuell')) return v('manuell', b.mbd < 0 ? 'minder' : 'mehr', false);
    if (b.mbd < -0.005) return b.hatStorno ? v('storno', 'storno', false) : v('minder', 'minder', false);
    // Provision ohne Produktion (oder umgekehrt): kann eine Teilung mit einem anderen Außendienstpartner sein
    if (hatProd && (arten.Abschluss || arten.Erhöhung) && ((prod < 0.005 && prov > 0.005) || (prod > 0.005 && prov < 0.005))) return v('teilung', b.mbd < 0 ? 'minder' : 'mehr', false);
    if (nur('Erhöhung')) return dynTarif ? v('dynamik', 'dynamik', true) : klein ? v('anpassung', 'dynamik', false) : v('mehr', 'mehr', false);
    if (arten.Abschluss && pp) return v('vollneu', 'neu', false, { bereich: 'voll', herkunft: 'neu' });
    if (arten.Abschluss && b.tg === 'Firmentarife') return v('bkv', 'neu', false, { bereich: 'bkv' });
    return alleNeu ? v('neu', 'neu', false) : v('wechsel', 'mehr', false);
  };

  A.antragAusBuendel = function (p, buendel, vorschlag) {
    var b0 = buendel[0], a = M.neuerAntrag();
    var name = String(b0.vnName || b0.vpName || '').trim(), teil = name.split(',');
    if (teil.length > 1) { a.vn.name = teil[0].trim(); a.vn.vorname = teil.slice(1).join(',').trim(); }
    else { var w = name.split(/\s+/); a.vn.name = w.length > 1 ? w[w.length - 1] : name; a.vn.vorname = w.slice(0, -1).join(' '); }
    if (!a.vn.name) a.vn.name = 'Vertrag ' + b0.vnr;
    a.eingang = b0.bdat; a.beginn = b0.vbeg || ''; a.vertragsnummer = b0.vnr; a.gruppenvertrag = b0.gvnr || '';
    a.bereich = M.bereichAusGruppe(b0.tg);
    var mbd = 0, alleNeu = true, erh = false, st = false, pos = [];
    buendel.forEach(function (b) {
      b.zeilen.forEach(function (z) {
        mbd += z.mbd; if (Math.abs(z.mb - z.mbd) > 0.005) alleNeu = false;
        if (z.part === 'Erhöhung') erh = true; if (z.st) st = true;
        var ps = M.neuePosition(); ps.person = z.vpName || ''; ps.personennummer = z.pnr || ''; ps.tarif = z.tarif; ps.beitrag = z.mbd;
        if (z.lz && !a.laufzeit) a.laufzeit = z.lz;
        pos.push(ps);
      });
    });
    var vs = vorschlag || A.vorschlagFuer(b0);
    a.vorgang = vs.vorgang || (mbd < 0 ? (st ? 'storno' : 'minder') : erh ? 'dynamik' : alleNeu ? 'neu' : 'mehr');
    if (vs.bereich) a.bereich = vs.bereich;
    a.herkunft = M.brauchtHerkunft(a) ? (vs.herkunft || '') : '';
    if (mbd < 0) pos.forEach(function (ps) { ps.beitrag = Math.abs(ps.beitrag); });
    a.positionen = pos;
    a.bemerkung = (a.vorgang === 'dynamik' ? 'Aus Dynamik' : 'Aus Abrechnung übernommen') + ' (' + U.monatName(b0.monat) + ')';
    a.quelle = 'abrechnung';
    a.historie = [{ status: 'eingereicht', datum: a.eingang, am: a.erstellt, quelle: 'manuell', notiz: 'aus Abrechnung übernommen' }];
    a.statusDatum = a.eingang;
    p.antraege.push(a);
    buendel.forEach(function (b) { p.zuordnungen[b.key] = a.id; delete p.ignoriert[b.key]; });
    return a;
  };
})(globalThis.AB = globalThis.AB || {});
