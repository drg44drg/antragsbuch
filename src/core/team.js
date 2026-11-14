/* Antragsbuch – Team: Monatsscheiben (Nettoproduktion) und Management-Auswertung der Abrechnung. */
(function (AB) {
  'use strict';
  var U = AB.util, T = AB.team = {};
  var KURZ = { jan: 0, feb: 1, mar: 2, mae: 2, mrz: 2, apr: 3, mai: 4, jun: 5, jul: 6, aug: 7, sep: 8, okt: 9, nov: 10, dez: 11 };

  function monatsSpalte(v) {
    var s = String(v == null ? '' : v).trim(), m;
    if ((m = /^(\d{1,2})\/(\d{4})$/.exec(s))) return { m: +m[1] - 1, j: +m[2] };
    if ((m = /^([A-Za-zäÄ]{3})[a-zä]*\.{0,2}\s+(\d{4})$/.exec(s))) {
      var k = KURZ[U.falte(m[1]).slice(0, 3)];
      if (k != null) return { m: k, j: +m[2] };
    }
    return null;
  }
  function wert(v) {
    if (typeof v === 'number') return v;
    var s = String(v == null ? '' : v).trim();
    if (!s || s === '-' || s === '–') return null;
    var n = U.parseZahl(s);
    return isNaN(n) ? null : n;
  }
  function kopfzeile(zeilen) {
    for (var r = 0; r < Math.min(30, zeilen.length); r++) {
      var sp = {}, n = 0, jahr = 0, hr = -1, vj = -1;
      (zeilen[r] || []).forEach(function (c, i) {
        var ms = monatsSpalte(c);
        if (ms && sp[ms.m] == null) { sp[ms.m] = i; n++; jahr = ms.j; }
        else if (/^HR\s+\d{4}$/i.test(String(c || '').trim())) hr = i;
        else if (/^\d{4}$/.test(String(c == null ? '' : c).trim()) && +c > 2000) vj = i;
      });
      if (n >= 6) return { zeile: r, sp: sp, jahr: jahr, hr: hr, vj: vj };
    }
    return null;
  }

  T.istMonatsscheiben = function (blaetter) {
    return blaetter.some(function (b) {
      var k = kopfzeile(b.zeilen);
      return k && b.zeilen.slice(k.zeile + 1).some(function (z) { return z.some(function (c) { return /^\d{6}\s+\S/.test(String(c || '')); }); });
    });
  };

  /** Monatsscheiben-Datei → Team-Objekt (mit Namen; Pseudonymisierung separat). */
  T.liesMonatsscheiben = function (blaetter) {
    var team = null, produkte = [], stand = '';
    blaetter.forEach(function (b) {
      var k = kopfzeile(b.zeilen);
      if (!k) return;
      b.zeilen.slice(0, k.zeile).forEach(function (z) { z.forEach(function (c) { var m = /Stand:\s*(\S+)/.exec(String(c || '')); if (m) stand = U.parseDatum(m[1]) || stand; }); });
      var zl = [];
      b.zeilen.slice(k.zeile + 1).forEach(function (z) {
        var li = z.findIndex(function (c) { return typeof c === 'string' && c.trim(); });
        if (li < 0) return;
        var label = z[li].trim(), werte = [];
        for (var m = 0; m < 12; m++) werte.push(k.sp[m] == null ? null : wert(z[k.sp[m]]));
        if (werte.every(function (w) { return w == null; }) && wert(z[k.hr]) == null) return;
        zl.push({ label: label, werte: werte, hr: k.hr >= 0 ? wert(z[k.hr]) : null, vj: k.vj >= 0 ? wert(z[k.vj]) : null });
      });
      var vm = zl.filter(function (z) { return /^\d{6}\s/.test(z.label); });
      if (vm.length >= 2 && !team) {
        team = { jahr: k.jahr, zeilen: vm.map(function (z, i) {
          var m = /^(\d{6})\s+(.*)$/.exec(z.label);
          return { nr: m[1], name: m[2].trim(), werte: z.werte, hr: z.hr, vj: z.vj, gesamt: false };
        }) };
        T.erkenneGesamt(team);
      } else if (zl.length && !vm.length) {
        produkte = zl.map(function (z) { return { name: z.label, werte: z.werte, hr: z.hr, vj: z.vj }; });
      }
    });
    if (!team) throw new Error('In der Datei wurde keine Tabelle mit Vermittlernummern und Monatsspalten gefunden.');
    team.stand = stand; team.produkte = produkte; team.pseudonym = false;
    team.importiert = new Date().toISOString();
    return team;
  };

  // ---------- Sammelmappe: je ADP ein Blatt „NNNms" mit Produktscheiben, dazu Soll-Ist-Ziele ----------
  T.SPARTEN = [
    ['Kranken', 'Kranken gesamt'], ['Vollversicherung', 'Vollversicherung'], ['Vollversicherung mit Beihilfe', 'Voll mit Beihilfe'], ['Vollversicherung nicht Beihilfe', 'Voll ohne Beihilfe'],
    ['Beitragsentlastung', 'Beitragsentlastung'], ['Pflegepflichtversicherung', 'Pflegepflicht'], ['Pflegezusatzversicherung', 'Pflegezusatz'],
    ['Sonstige Zusatzversicherung', 'Zusatzversicherung'], ['Zahnzusatzversicherung', 'Zahnzusatz'], ['Betriebliche Krankenversicherung', 'bKV'],
    ['Mitglieder Krankenversicherung', 'Mitglieder-KV'], ['Unfall', 'Unfall'], ['Leben', 'Leben']
  ];
  T.istSammelmappe = function (blaetter) {
    return blaetter.filter(function (b) { return /^\d{3}ms$/i.test(String(b.name).trim()) && kopfzeile(b.zeilen); }).length >= 2;
  };
  T.liesSammelmappe = function (blaetter) {
    var team = { jahr: 0, stand: '', zeilen: [], produkte: [], pseudonym: false, sammelmappe: true, importiert: new Date().toISOString() };
    function scheiben(b) {
      var k = kopfzeile(b.zeilen), out = {};
      if (!k) return null;
      b.zeilen.slice(0, k.zeile).forEach(function (z) { z.forEach(function (c) { var m = /Stand:\s*(\S+)/.exec(String(c || '')); if (m) team.stand = U.parseDatum(m[1]) || team.stand; }); });
      team.jahr = team.jahr || k.jahr;
      b.zeilen.slice(k.zeile + 1).forEach(function (z) {
        var li = z.findIndex(function (c) { return typeof c === 'string' && c.trim(); });
        if (li < 0) return;
        var label = z[li].trim(), werte = [];
        for (var m = 0; m < 12; m++) werte.push(k.sp[m] == null ? null : wert(z[k.sp[m]]));
        if (!out[label]) out[label] = { werte: werte, hr: k.hr >= 0 ? wert(z[k.hr]) : null, vj: k.vj >= 0 ? wert(z[k.vj]) : null };
      });
      return out;
    }
    function gesamtAus(s) {
      var w = [], hr = 0, vj = 0, hat = false;
      for (var m = 0; m < 12; m++) { var x = null; ['Kranken', 'Unfall', 'Leben'].forEach(function (n) { if (s[n] && s[n].werte[m] != null) x = (x || 0) + s[n].werte[m]; }); w.push(x); }
      ['Kranken', 'Unfall', 'Leben'].forEach(function (n) { if (s[n]) { hat = true; hr += s[n].hr || 0; vj += s[n].vj || 0; } });
      return hat ? { werte: w, hr: hr, vj: vj } : null;
    }
    blaetter.forEach(function (b) {
      var name = String(b.name).trim(), m = /^(\d{3})ms$/i.exec(name);
      if (!m && !/^FDBms$/i.test(name)) return;
      var s = scheiben(b); if (!s) return;
      var g = gesamtAus(s); if (!g) return;
      var sparten = {};
      T.SPARTEN.forEach(function (sp) { if (s[sp[0]]) sparten[sp[0]] = s[sp[0]].werte; });
      team.zeilen.push({ nr: m ? '900' + m[1] : 'FDB', name: m ? '' : 'Gesamt', werte: g.werte, hr: g.hr, vj: g.vj, gesamt: !m, sparten: sparten });
    });
    // Ziele (Blatt „… Soll-Ist JJJJ"): Spalten „ADP Nr.", „Name", „Ziel JJJJ"
    blaetter.forEach(function (b) {
      for (var r = 0; r < Math.min(12, b.zeilen.length); r++) {
        var k = (b.zeilen[r] || []).map(function (c) { return U.falte(c == null ? '' : c); });
        var cNr = k.findIndex(function (c) { return /^adp nr/.test(c); }), cZiel = k.findIndex(function (c) { return /^ziel\s*20\d\d/.test(c); }), cName = k.indexOf('name');
        if (cNr < 0 || cZiel < 0) continue;
        var jahr = +/20\d\d/.exec(k[cZiel])[0];
        team.ziele = { jahr: jahr, werte: {} };
        b.zeilen.slice(r + 1).forEach(function (z) {
          var nr = String(z[cNr] == null ? '' : z[cNr]).replace(/\.0$/, '').trim();
          if (!/^\d{6}$/.test(nr)) return;
          if (typeof z[cZiel] === 'number' && z[cZiel] > 0) team.ziele.werte[nr] = z[cZiel];
          var zl = team.zeilen.find(function (x) { return x.nr === nr; });
          if (zl && cName >= 0 && z[cName] && !zl.name) zl.name = String(z[cName]).trim();
        });
        return;
      }
    });
    if (team.zeilen.filter(function (z) { return !z.gesamt; }).length < 2) throw new Error('In der Sammelmappe wurden keine ADP-Blätter (z. B. „401ms") gefunden.');
    return team;
  };

  /**
   * Sparten-Vergleich: eigener Wert gegen das Team, in fünf Stufen.
   * Stufe 5 = oberste 20 % (↑), 4 = 60–80 % (↗), 3 = Mittelfeld (→), 2 = 20–40 % (↘), 1 = unterste 20 % (↓).
   */
  T.spartenVergleich = function (team, nr, bis) {
    var ich = T.findeEigene(team, nr);
    if (!ich || ich.gesamt || !ich.sparten) return [];
    var andere = team.zeilen.filter(function (z) { return !z.gesamt && z.sparten; });
    if (bis == null) bis = 11;
    var sum = function (w) { var s = 0; for (var m = 0; m <= bis; m++) s += (w && w[m]) || 0; return s; };
    return T.SPARTEN.filter(function (sp) { return andere.some(function (z) { return z.sparten[sp[0]] && Math.abs(sum(z.sparten[sp[0]])) > 0.005; }); }).map(function (sp) {
      var werte = andere.map(function (z) { return sum(z.sparten[sp[0]]); }), mein = sum(ich.sparten[sp[0]]);
      var darunter = werte.filter(function (w) { return w < mein - 0.005; }).length, gleich = werte.filter(function (w) { return Math.abs(w - mein) <= 0.005; }).length;
      var quote = werte.length > 1 ? (darunter + (gleich - 1) / 2) / (werte.length - 1) : 0.5;
      var stufe = quote >= 0.8 ? 5 : quote >= 0.6 ? 4 : quote >= 0.4 ? 3 : quote >= 0.2 ? 2 : 1;
      return { id: sp[0], name: sp[1], wert: mein, median: U.median(werte), max: Math.max.apply(null, werte), rang: werte.filter(function (w) { return w > mein + 0.005; }).length + 1, n: werte.length, quote: quote, stufe: stufe };
    });
  };
  T.STUFEN = { 5: 'Spitze', 4: 'über dem Schnitt', 3: 'Mittelfeld', 2: 'unter dem Schnitt', 1: 'deutlich darunter' };

  /**
   * Summenzeile des Teams markieren. Zwei Wege:
   * 1) Titel: kein „NAME,VORNAME", sondern eine Einheit (FD, Direktion, Gesamt, Summe, Gebiet, Region, Team).
   * 2) Zahlen: die größte Zeile liegt in jedem Monat nahe an der Summe aller anderen (75–135 %).
   *    Exakt muss es nicht passen – in der Praxis fehlen einzelne Vermittler in der Liste.
   * → true, wenn eine Summenzeile gefunden wurde.
   */
  T.erkenneGesamt = function (team) {
    var zl = team.zeilen;
    zl.forEach(function (z) { z.gesamt = false; });
    if (zl.length < 3) return false;
    var summe = function (z) { return z.werte.reduce(function (s, w) { return s + (w || 0); }, 0); };
    var titel = zl.filter(function (z) { return z.name && z.name.indexOf(',') < 0 && /(^|[^a-zäöü])(FD|GD|BD|RD|VD|Direktion|Gesamt|Summe|Gebiet|Region|Team|Bezirk)([^a-zäöü]|$)/i.test(z.name); });
    var gross = zl.slice().sort(function (a, b) { return summe(b) - summe(a); })[0];
    var rest = zl.filter(function (z) { return z !== gross; });
    var monate = 0, passend = 0;
    for (var m = 0; m < 12; m++) {
      var w = gross.werte[m]; if (w == null) continue;
      var s = 0; rest.forEach(function (z) { s += z.werte[m] || 0; });
      if (Math.abs(s) < 1 && Math.abs(w) < 1) continue;
      monate++; if (w >= s * 0.75 - 1 && w <= s * 1.35 + 1) passend++;
    }
    var zahlen = monate > 0 && passend === monate;
    var treffer = titel.length === 1 && (titel[0] === gross || !zahlen) ? titel[0] : zahlen ? gross : null;
    if (treffer) treffer.gesamt = true;
    return !!treffer;
  };

  T.pseudo = function (nr) { return 'p' + U.hash('antragsbuch-team:' + String(nr).trim()); };

  /** Für die Weitergabe an ADP: Namen entfernen, Nummern durch Pseudonyme ersetzen. */
  T.pseudonymisiere = function (team) {
    var k = JSON.parse(JSON.stringify(team));
    k.zeilen.forEach(function (z) { if (!/^p/.test(z.nr) && z.nr !== 'FDB') z.nr = T.pseudo(z.nr); z.name = ''; });
    k.pseudonym = true; k.produkte = [];
    if (k.ziele) { var zw = {}; Object.keys(k.ziele.werte).forEach(function (nr) { zw[/^p/.test(nr) ? nr : T.pseudo(nr)] = k.ziele.werte[nr]; }); k.ziele.werte = zw; }
    return k;
  };
  T.findeEigene = function (team, nr) {
    if (!team || !nr) return null;
    nr = String(nr).trim();
    var ps = T.pseudo(nr);
    return team.zeilen.find(function (z) { return z.nr === nr || z.nr === ps; }) || null;
  };

  /** Eigene Position im Team je Monat und kumuliert. */
  T.position = function (team, nr) {
    var ich = T.findeEigene(team, nr);
    var andere = team.zeilen.filter(function (z) { return !z.gesamt; });
    function stat(werte, eigener) {
      var w = werte.filter(function (x) { return x != null; });
      if (!w.length) return null;
      var o = { n: w.length, median: U.median(w), q1: U.quantil(w, 0.25), q3: U.quantil(w, 0.75), min: Math.min.apply(null, w), max: Math.max.apply(null, w), wert: eigener };
      if (eigener != null) o.rang = w.filter(function (x) { return x > eigener; }).length + 1;
      return o;
    }
    var monate = [], kum = {};
    andere.forEach(function (z) { kum[z.nr] = 0; });
    var letzter = -1;
    for (var m = 0; m < 12; m++) {
      var s = stat(andere.map(function (z) { return z.werte[m]; }), ich && !ich.gesamt ? ich.werte[m] : null);
      monate.push(s);
      if (s) { letzter = m; andere.forEach(function (z) { kum[z.nr] += z.werte[m] || 0; }); }
    }
    var ytd = stat(andere.map(function (z) { return kum[z.nr]; }), ich && !ich.gesamt ? kum[ich.nr] : null);
    var ziel = null;
    if (team.ziele && ich) { var zv = team.ziele.werte[ich.nr] || team.ziele.werte[T.pseudo(nr)] || team.ziele.werte[String(nr)]; if (zv) ziel = { jahr: team.ziele.jahr, wert: zv, vorjahr: ich.hr }; }
    return { ich: ich, monate: monate, ytd: ytd, letzterMonat: letzter, ziel: ziel, gesamt: team.zeilen.find(function (z) { return z.gesamt; }) || null };
  };

  // ---------- Management: Auswertung der Abrechnung je ADP ----------
  T.KATEGORIEN = [
    { id: 'neu', name: 'Neugeschäft' }, { id: 'mehr', name: 'Erhöhung' },
    { id: 'minder', name: 'Reduzierung' }, { id: 'storno', name: 'Storno' }
  ];
  T.kategorie = function (z) {
    if (z.mbd > 0.005) return Math.abs(z.mb - z.mbd) <= 0.005 ? 'neu' : 'mehr';
    if (z.mbd < -0.005) return (z.mb <= 0.005 || z.stgrund) ? 'storno' : 'minder';
    return 'sonst';
  };
  /** Schreibender Vermittler aus „Beteiligte Vermittler", sonst die Vermittlernummer der Zeile. */
  T.schreiber = function (z) {
    var m = /(\d{5,7})\s*\(\s*Geschrieben/i.exec(z.beteil || '');
    if (m) return m[1];
    m = /^\s*(\d{5,7})/.exec(z.beteil || '');
    return m ? m[1] : (z.vm || '?');
  };

  /**
   * Verdichtet die Abrechnung zu Zellen ADP × Monat × Tarifgruppe × Kategorie × Provisionsart.
   * → { zellen:[{adp, m, tg, kat, art, n, plus, minus, prov}], adps:[nr], gruppen:[tg], arten:[...] }
   */
  T.wuerfel = function (zeilen, jahr, eigen) {
    var map = new Map(), adps = {}, gruppen = {}, arten = {}, tarifCache = {};
    for (var i = 0; i < zeilen.length; i++) {
      var z = zeilen[i];
      if (jahr && +z.bdat.slice(0, 4) !== +jahr) continue;
      var adp = eigen ? 'ich' : T.schreiber(z), kat = T.kategorie(z), m = +z.bdat.slice(5, 7) - 1;
      var te = tarifCache[z.tarif] || (tarifCache[z.tarif] = AB.tarif.einordnen(z.tarif, z.tg)), sp = te.kategorie || 'Sonstige';
      var key = adp + '|' + m + '|' + z.tg + '|' + kat + '|' + z.part + '|' + sp + '|' + (te.beihilfe ? 1 : 0), c = map.get(key);
      if (!c) { c = { adp: adp, m: m, tg: z.tg, kat: kat, art: z.part, sp: sp, bh: !!te.beihilfe, n: 0, plus: 0, minus: 0, prov: 0, vn: new Set() }; map.set(key, c); }
      c.n++; if (z.mbd > 0) c.plus += z.mbd; else c.minus += z.mbd; c.prov += z.prov; c.vn.add(z.vnr);
      adps[adp] = (adps[adp] || 0) + 1; gruppen[z.tg] = 1; arten[z.part] = 1;
    }
    var zellen = Array.from(map.values());
    zellen.forEach(function (c) { c.vertraege = c.vn.size; delete c.vn; });
    return { zellen: zellen, adps: Object.keys(adps).sort(function (a, b) { return adps[b] - adps[a]; }), anzahl: adps,
      gruppen: Object.keys(gruppen).sort(), arten: Object.keys(arten).sort() };
  };

  /** Würfel filtern und je ADP sowie je Monat summieren. f: { adps:Set|null, arten:Set|null, gruppen:Set|null, monate:[von,bis] } */
  T.auswertung = function (w, f) {
    f = f || {};
    function neu() { return { n: 0, plus: 0, minus: 0, netto: 0, prov: 0, kat: { neu: 0, mehr: 0, minder: 0, storno: 0, sonst: 0 }, katN: { neu: 0, mehr: 0, minder: 0, storno: 0, sonst: 0 }, gruppen: {}, sparten: {}, spartenDetail: {}, provMonate: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], beihilfe: 0, monate: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }; }
    var proAdp = {}, gesamt = neu(), von = f.monate ? f.monate[0] : 0, bis = f.monate ? f.monate[1] : 11;
    w.zellen.forEach(function (c) {
      if (f.arten && !f.arten.has(c.art)) return;
      if (f.gruppen && !f.gruppen.has(c.tg)) return;
      if (f.beihilfe && (f.beihilfe === 'ja') !== c.bh) return;
      if (c.m < von || c.m > bis) return;
      var o = proAdp[c.adp] || (proAdp[c.adp] = neu());
      [o].concat(!f.adps || f.adps.has(c.adp) ? [gesamt] : []).forEach(function (x) {
        x.n += c.n; x.plus += c.plus; x.minus += c.minus; x.netto += c.plus + c.minus; x.prov += c.prov;
        x.kat[c.kat] += c.plus + c.minus; x.katN[c.kat] += c.n;
        x.gruppen[c.tg] = (x.gruppen[c.tg] || 0) + c.plus + c.minus;
        var spn = (c.bh ? 'Beihilfe · ' : '') + c.sp; x.sparten[spn] = (x.sparten[spn] || 0) + c.plus + c.minus;
        if (c.bh) x.beihilfe += c.plus + c.minus;
        var sd = x.spartenDetail[spn] || (x.spartenDetail[spn] = { neu: 0, mehr: 0, minder: 0, storno: 0, sonst: 0, netto: 0, n: 0, prov: 0 });
        sd[c.kat] += c.plus + c.minus; sd.netto += c.plus + c.minus; sd.n += c.n; sd.prov += c.prov; x.provMonate[c.m] += c.prov;
        x.monate[c.m] += c.plus + c.minus;
      });
    });
    return { proAdp: proAdp, gesamt: gesamt };
  };
})(globalThis.AB = globalThis.AB || {});
