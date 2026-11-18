/* Antragsbuch – Übernahme aus dem bisherigen Excel-Antragsbuch (ein Blatt je Jahr, Monatsblöcke in Spalte A). */
(function (AB) {
  'use strict';
  var U = AB.util, L = AB.altbuch = {};
  var MONATE = ['januar', 'februar', 'maerz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];

  /** Blatt mit dem alten Antragsbuch finden → { blatt, kopf, sp:{…}, jahr } oder null */
  L.finde = function (blaetter) { return L.findeKlassisch(blaetter) || L.findeFrei(blaetter); };
  L.findeKlassisch = function (blaetter) {
    for (var b = 0; b < blaetter.length; b++) {
      var zl = blaetter[b].zeilen;
      for (var r = 0; r < Math.min(8, zl.length); r++) {
        var k = (zl[r] || []).map(function (c) { return U.falte(c == null ? '' : c).trim(); });
        if (k.indexOf('antragsteller') < 0 || k.indexOf('sparte') < 0 || k.indexOf('tarif') < 0) continue;
        var alle = function (name) { var out = []; k.forEach(function (c, i) { if (c === name || c.indexOf(name) === 0) out.push(i); }); return out; };
        var ab = alle('abgerechnet'), po = alle('policiert'), ei = alle('eingereicht');
        var sp = { datum: k.indexOf('datum'), name: k.indexOf('antragsteller'), sparte: k.indexOf('sparte'), tarif: k.indexOf('tarif'), gkv: k.indexOf('gkv'),
          prov: k.findIndex(function (c) { return c.indexOf('provision') === 0; }),
          betraege: [[ab[0], 'abgerechnet', 'voll'], [po[0], 'policiert', 'voll'], [ei[0], 'eingereicht', 'voll'], [ab[1], 'abgerechnet', 'sonst'], [po[1], 'policiert', 'sonst'], [ei[1], 'eingereicht', 'sonst']].filter(function (x) { return x[0] != null && x[0] >= 0; }) };
        var jm = /(20\d\d)/.exec(blaetter[b].name || '');
        return { blatt: blaetter[b], kopf: r, sp: sp, jahr: jm ? +jm[1] : null };
      }
    }
    return null;
  };

  function deute(sparte, block, betrag) {
    var s = U.falte(sparte), bereich, vorgang;
    if (/^bkv|firm/.test(s)) bereich = 'bkv'; else if (/mhplus|gkv/.test(s)) bereich = 'gkv'; else if (/^(kv )?voll|^voll|kina/.test(s)) bereich = 'voll';
    else if (/zusatz|^pg|pflege/.test(s)) bereich = 'zusatz'; else if (/leben|^lv/.test(s)) bereich = 'leben'; else if (/unfall|^uv/.test(s)) bereich = 'unfall';
    else if (/grupp/.test(s)) bereich = 'gruppe'; else bereich = block === 'voll' ? 'voll' : 'zusatz';
    if (/storno/.test(s)) vorgang = 'storno'; else if (/minder|reduz/.test(s)) vorgang = 'minder'; else if (/mehr/.test(s)) vorgang = 'mehr';
    else if (/neu/.test(s)) vorgang = 'neu'; else vorgang = betrag < 0 ? 'minder' : 'neu';
    return { bereich: bereich, vorgang: vorgang };
  }

  /** Einträge lesen → { antraege:[…], jahr, uebersprungen } (noch nicht im Projekt). */
  L.lies = function (fund, jahr, dateiname) {
    if (!fund.jahr && dateiname) { var jd = /(20\d\d)/.exec(dateiname); if (jd) fund.jahr = +jd[1]; }
    if (fund.frei) return L.liesFrei(fund, jahr);
    var M = AB.model, zl = fund.blatt.zeilen, sp = fund.sp, monat = null, sonder = '', out = [], uebersprungen = 0;
    jahr = fund.jahr || jahr || new Date().getFullYear();
    for (var r = fund.kopf + 1; r < zl.length; r++) {
      var z = zl[r] || [], a = z[0];
      if (typeof a === 'string' && a.trim()) {
        if (a.charAt(0) === '=') break;
        var mi = MONATE.indexOf(U.falte(a).trim());
        if (mi >= 0) { monat = mi + 1; sonder = ''; } else sonder = a.trim();
      }
      var treffer = sp.betraege.filter(function (x) { return typeof z[x[0]] === 'number'; });
      var gkv = sp.gkv >= 0 && typeof z[sp.gkv] === 'number' ? z[sp.gkv] : null;
      var sparte = sp.sparte >= 0 && z[sp.sparte] != null ? String(z[sp.sparte]).trim() : '', tarif = sp.tarif >= 0 && z[sp.tarif] != null ? String(z[sp.tarif]).trim() : '';
      if (treffer.length > 2) { if (monat === 12 || !sparte) break; uebersprungen++; continue; }   // Summenzeile
      if (!treffer.length && gkv == null) continue;
      if (monat == null) { uebersprungen++; continue; }
      var t = treffer[0], betrag = t ? z[t[0]] : 0, d = deute(gkv != null && !t ? 'mhplus' : sparte, t ? t[2] : 'sonst', betrag);
      var datum = U.parseDatum(sp.datum >= 0 ? z[sp.datum] : '') || (jahr + '-' + (monat < 10 ? '0' : '') + monat + '-01');
      var name = sp.name >= 0 && z[sp.name] != null ? String(z[sp.name]).trim() : '', teile = name.split(',');
      var an = M.neuerAntrag();
      an.quelle = 'altbuch'; an.eingang = datum;
      an.vn = { name: (teile[0] || '').trim() || 'Ohne Name (Zeile ' + (r + 1) + ')', vorname: teile.slice(1).join(',').trim() };
      an.bereich = d.bereich; an.vorgang = d.vorgang;
      var prov = sp.prov >= 0 && typeof z[sp.prov] === 'number' ? U.runde(z[sp.prov]) : null;
      var pos = M.neuePosition(); pos.tarif = tarif || sparte || 'unbekannt';
      pos.beitrag = (d.vorgang === 'minder' || d.vorgang === 'storno') ? Math.abs(U.runde(betrag)) : U.runde(betrag);
      an.positionen = [pos];
      if (d.bereich === 'gkv') { an.positionen = []; for (var g = 0; g < Math.max(1, Math.round(gkv || 1)); g++) { var gp = M.neuePosition(); gp.tarif = 'mhplus'; gp.beitrag = 0; an.positionen.push(gp); } }
      an.provisionManuell = prov;
      var status = /reklam/i.test(sonder) ? 'reklamiert' : t ? t[1] : 'eingereicht';
      an.status = status; an.statusDatum = datum; an.statusManuell = false;
      an.historie = [{ status: status, datum: datum, am: an.erstellt, quelle: 'altbuch', notiz: 'aus altem Antragsbuch' }];
      an.bemerkung = [sparte, 'altes Antragsbuch Zeile ' + (r + 1)].filter(Boolean).join(' · ');
      out.push(an);
    }
    return { antraege: out, jahr: jahr, uebersprungen: uebersprungen };
  };

  // ---------- Frei geführte Liste: eine Zeile je Antrag, Spalten nach Kopfzeile ----------
  // Typisch: „Datum Vertrag | MNR | Name | Tarife | MB | GV | Bank | Provision | Datum Provision“, Datum ohne Jahr.
  // Spalten einer selbst geführten Liste. „namen" sind die Überschriften, die automatisch erkannt werden (Groß-/Kleinschreibung egal).
  L.SPALTEN_FREI = [
    { id: 'datum', titel: 'Eingang', pflicht: true, namen: 'Datum, Datum Vertrag, Eingang, Eingangsdatum, Antragsdatum, eingereicht am, Monat', test: function (c) { return (/datum|eingang|eingereicht|^monat$/.test(c)) && !/prov|abger|bezahlt|ausgez|beginn|geburt/.test(c); } },
    { id: 'name', titel: 'Kunde', pflicht: true, namen: 'Name, Kunde, Antragsteller, VN, Versicherungsnehmer, Versicherte Person', test: function (c) { return /^(name|kunde|antragsteller|vn\b|versicherungsnehmer|versicherte person|nachname)/.test(c); } },
    { id: 'tarif', titel: 'Tarif / Was', pflicht: true, namen: 'Tarif, Tarife, Produkt, Sparte, Art, Vorgang', test: function (c) { return /^(tarif|produkt|sparte|art\b|vorgang)/.test(c); } },
    { id: 'beitrag', titel: 'Beitrag', pflicht: true, namen: 'MB, Beitrag, Monatsbeitrag, Mehrbeitrag, Beitrag mtl., Prämie', test: function (c) { return /^(mb|beitrag|monatsbeitrag|mehrbeitrag|monatl|mtl|praemie)\b/.test(c) || /^beitrag/.test(c); } },
    { id: 'prov', titel: 'Erwartete Provision', namen: 'Provision, Prov., erwartete Provision, Courtage, Vergütung', test: function (c) { return (/^(provision|prov\b|prov\.|erwartete provision|courtage|verguetung)/.test(c)) && !/datum|monat|am$/.test(c); } },
    { id: 'vnr', titel: 'Vertragsnummer', namen: 'MNR, VNR, Vertragsnummer, Vers.-Nr., Mitgliedsnummer, Vertrag', test: function (c) { return /^(mnr|vnr|vers\.?\s*-?\s*nr|vertragsn|mitglied|vertrag$|vertrags-nr|antragsn)/.test(c) && !/datum/.test(c); } },
    { id: 'gv', titel: 'Gruppenvertrag', namen: 'GV, Gruppenvertrag, GV-Nr.', test: function (c) { return /^(gv|gruppenvertrag|gvnr)\b/.test(c); } },
    { id: 'bank', titel: 'Bank beteiligt', namen: 'Bank (Inhalt ja/x)', test: function (c) { return /^bank/.test(c); } },
    { id: 'provDatum', titel: 'Abgerechnet im Monat', namen: 'Datum Provision, Provision am, abgerechnet, ausgezahlt, bezahlt', test: function (c) { return /datum.*prov|prov.*(datum|monat|am$)|abgerechnet|ausgezahlt|bezahlt/.test(c); } },
    { id: 'status', titel: 'Status', namen: 'Status, Stand, policiert', test: function (c) { return /^(status|stand$|policiert)/.test(c); } },
    { id: 'bemerkung', titel: 'Bemerkung', namen: 'Bemerkung, Notiz, Info, Kommentar', test: function (c) { return /^(bemerkung|notiz|info|kommentar|anmerkung)/.test(c); } }
  ];
  /** Spalten aus einer Kopfzeile zuordnen → { datum: i, name: i, … } (-1 = nicht da). Jede Spalte wird höchstens einmal vergeben. */
  L.ordneFrei = function (kopfzeile) {
    var k = (kopfzeile || []).map(function (c) { return U.falte(c == null ? '' : c).trim(); }), sp = {}, belegt = {};
    // speziellere Spalten zuerst, damit „Datum Provision" nicht als Eingang und „Provision" nicht doppelt zählt
    ['provDatum', 'vnr', 'gv', 'bank', 'status', 'bemerkung', 'prov', 'datum', 'name', 'tarif', 'beitrag'].forEach(function (id) {
      var def = L.SPALTEN_FREI.filter(function (x) { return x.id === id; })[0];
      sp[id] = k.findIndex(function (c, i) { return c && !belegt[i] && def.test(c); });
      if (sp[id] >= 0) belegt[sp[id]] = 1;
    });
    return sp;
  };
  /** Wahrscheinliche Kopfzeile: die erste der ersten 15 Zeilen mit mindestens drei Textzellen. */
  L.rateKopf = function (zeilen) {
    for (var r = 0; r < Math.min(15, zeilen.length); r++) if ((zeilen[r] || []).filter(function (c) { return typeof c === 'string' && /[a-zäöü]/i.test(c); }).length >= 3) return r;
    return -1;
  };
  L.findeFrei = function (blaetter, opt) {
    for (var b = 0; b < blaetter.length; b++) {
      var zl = blaetter[b].zeilen;
      for (var r = 0; r < Math.min(12, zl.length); r++) {
        var k = (zl[r] || []).map(function (c) { return U.falte(c == null ? '' : c).trim(); }), sp = L.ordneFrei(zl[r]);
        // Provisionsabrechnung oder Bestandsliste des Versicherers ist keine selbst geführte Liste
        if (k.some(function (c) { return /provisionsart|buchungsdatum|^tarifgruppe|vermittlernummer|monatsbeitragsdifferenz/.test(c); })) continue;
        // Automatisch: Datum, Name, Tarif, Beitrag und Provision (oder Abrechnungsmonat/Status), sonst ist es eher eine andere Liste
        // (z. B. Veränderungsdienst). Im Feld „Mein bisheriges Antragsbuch" genügen Name und Tarif oder Beitrag.
        var voll = sp.datum >= 0 && sp.name >= 0 && sp.tarif >= 0 && sp.beitrag >= 0 && (sp.prov >= 0 || sp.provDatum >= 0 || sp.status >= 0);
        var locker = opt && opt.locker && sp.name >= 0 && (sp.tarif >= 0 || sp.beitrag >= 0);
        if (!voll && !locker) continue;
        var jm = /(20\d\d)/.exec(blaetter[b].name || '');
        return { frei: true, blatt: blaetter[b], kopf: r, sp: sp, jahr: jm ? +jm[1] : null };
      }
    }
    return null;
  };
  var MON_FREI = ['jan', 'feb', 'mae', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dez'];
  function monatAus(v) { var f = U.falte(v).trim().replace(/^mar/, 'mae'); if (f.length < 3) return -1; return MON_FREI.indexOf(f.slice(0, 3)); }
  function text(v) { return v == null ? '' : String(v).trim(); }
  /** Betrag aus Zahl oder Text: „45,07 + 12,88" wird addiert, „101,24 €" gelesen. → { wert, rest } (rest = nicht gelesener Text) */
  L.betragAus = function (v) {
    if (typeof v === 'number') return { wert: U.runde(v), rest: '' };
    var t = text(v); if (!t || t === '-') return { wert: null, rest: '' };
    var rein = t.replace(/€|eur/gi, '').trim();
    if (/^-?\s*\d[\d.,]*(\s*[+\-]\s*\d[\d.,]*)*$/.test(rein)) {
      var summe = 0, teile = rein.replace(/\s+/g, '').match(/[+\-]?\d[\d.,]*/g) || [];
      teile.forEach(function (x) { summe += U.parseZahl(x); });
      return { wert: U.runde(summe), rest: teile.length > 1 ? t : '' };
    }
    var eur = /(-?\d[\d.]*,\d{1,2})\s*(€|eur)/i.exec(t);
    if (eur) return { wert: U.runde(U.parseZahl(eur[1])), rest: t };
    var vorn = /^(-?\d[\d.]*(?:,\d+)?)\b/.exec(t);
    if (vorn) return { wert: U.runde(U.parseZahl(vorn[1])), rest: t };
    return { wert: null, rest: t };
  };
  /** Freitext der Tarif-Spalte deuten → { bereich, vorgang, tarif, herkunft, sicher, grund } */
  L.deuteFrei = function (roh, gv, prov) {
    var s = U.falte(roh).trim(), o = { bereich: '', vorgang: 'neu', tarif: '', herkunft: '', sicher: true, grund: '' };
    if (/storno/.test(s)) o.vorgang = 'storno'; else if (/minder|reduz/.test(s)) o.vorgang = 'minder';
    else if (/dynamik/.test(s)) o.vorgang = 'dynamik';
    else if (/erh|mehrb/.test(s)) o.vorgang = 'mehr';
    else if (/umst|option/.test(s)) o.vorgang = prov ? 'mehr' : 'umstellung';
    var code = /\b(zp\d|ap\d|sp\d|spu|zb\d|ab\d|pg\d\w*|pz\d\w*|tg\d|ta\d*|be|kt\d*)\b/i.exec(roh || '');
    if (/kina|kinder\s*nach/.test(s)) { o.bereich = /^gv|gv-/.test(s) || gv ? 'gruppe' : 'voll'; o.herkunft = 'kind'; }
    else if (/^gv\b|gv-|gruppe/.test(s)) o.bereich = 'gruppe';
    else if (/bkv|firm/.test(s)) o.bereich = 'bkv';
    else if (/mhplus|gkv/.test(s)) o.bereich = 'gkv';
    else if (/leben|^lv\b/.test(s)) o.bereich = 'leben';
    else if (/unfall|^uv\b/.test(s)) o.bereich = 'unfall';
    else if (/zusatz|\b(zp|ap|sp|zb|ab|pg|pz)\d|\bspu\b/.test(s)) o.bereich = 'zusatz';
    else if (/(^|\W)(be|ta|kt)(\W|\d|$)|beitragsentl|tagegeld|voll|awv|umst\.?\s*\d{2,3}|^\d{2,3}$|option/.test(s)) o.bereich = 'voll';
    else if (gv) o.bereich = 'gruppe';
    if (!o.bereich) { o.bereich = 'zusatz'; o.sicher = false; o.grund = s ? 'Bereich aus „' + text(roh) + '" nicht erkennbar' : 'Tarif fehlt'; }
    if (/^ff\b/.test(s)) { o.sicher = false; o.grund = 'Fortführung: Bereich bitte prüfen'; }
    o.tarif = code ? (code[1].toUpperCase() === 'BE' ? 'BE/' : code[1].toUpperCase()) : text(roh);
    return o;
  };
  L.liesFrei = function (fund, jahr) {
    var M = AB.model, zl = fund.blatt.zeilen, sp = fund.sp, out = [], uebersprungen = 0, geschaetzt = 0, letztesDatum = '';
    jahr = fund.jahr || jahr || new Date().getFullYear();
    var zelle = function (z, f) { return sp[f] >= 0 ? z[sp[f]] : null; };
    for (var r = fund.kopf + 1; r < zl.length; r++) {
      var z = zl[r] || [], name = text(zelle(z, 'name')), tarifRoh = text(zelle(z, 'tarif')), bt = L.betragAus(zelle(z, 'beitrag'));
      if (!name && !tarifRoh && bt.wert == null) continue;
      if (/^(summe|gesamt|total)/i.test(name) || /^(summe|gesamt)/i.test(text(z[0]))) { uebersprungen++; continue; }
      var hinweise = [], dv = zelle(z, 'datum'), datum = '';
      var m = typeof dv === 'string' ? /^\s*(\d{1,2})\.(\d{1,2})\.?\s*(\d{2,4})?\s*$/.exec(dv) : null;
      if (m) { var y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : jahr; datum = y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); }
      else datum = U.parseDatum(dv);
      if (!datum && typeof dv === 'string' && monatAus(dv) >= 0) { datum = jahr + '-' + ('0' + (monatAus(dv) + 1)).slice(-2) + '-01'; hinweise.push('nur Monat angegeben'); }
      if (!datum) { if (!letztesDatum) { if (sp.datum >= 0) { uebersprungen++; continue; } datum = jahr + '-01-01'; hinweise.push('kein Eingangsdatum'); } else { datum = letztesDatum; hinweise.push('Datum aus der Zeile darüber'); } }
      letztesDatum = datum;
      var pr = L.betragAus(zelle(z, 'prov')), gvRoh = zelle(z, 'gv'), gv = '', gvFremd = false;
      // Gruppenvertragsnummern sind ganze Zahlen mit mindestens fünf Stellen. Steht dort ein Betrag, ist die Spalte anders benutzt.
      if (/^\d{5,}$/.test(text(gvRoh).replace(/\.0$/, ''))) gv = text(gvRoh).replace(/\.0$/, '');
      else if (text(gvRoh)) { var gb = L.betragAus(gvRoh); if (bt.wert == null && gb.wert != null) { bt = gb; hinweise.push('Beitrag aus Spalte GV'); } else { gvFremd = true; hinweise.push('Spalte GV: ' + text(gvRoh)); } }
      var d = L.deuteFrei(tarifRoh, gv, pr.wert);
      var an = M.neuerAntrag(), teile = name.split(',');
      an.quelle = 'altbuch'; an.eingang = datum;
      an.vn = { name: (teile[0] || '').trim() || 'Ohne Name (Zeile ' + (r + 1) + ')', vorname: teile.slice(1).join(',').trim() };
      an.bereich = d.bereich; an.vorgang = d.vorgang; an.herkunft = d.herkunft;
      an.vertragsnummer = text(zelle(z, 'vnr')).replace(/\.0$/, '');
      if (gv && /\d/.test(gv)) an.gruppenvertrag = gv;
      if (/^(ja|j|x|1)$/i.test(text(zelle(z, 'bank')))) an.bank = { aktiv: true, anteil: 50 };
      var pos = M.neuePosition(); pos.tarif = d.tarif || 'unbekannt';
      pos.beitrag = bt.wert == null ? null : (d.vorgang === 'minder' || d.vorgang === 'storno' ? Math.abs(bt.wert) : bt.wert);
      an.positionen = [pos];
      an.provisionManuell = pr.wert;
      if (bt.rest) hinweise.push('Beitrag: ' + bt.rest);
      if (pr.rest) hinweise.push('Provision: ' + pr.rest);
      if (bt.wert == null) hinweise.push('Beitrag fehlt');
      // Status: Monat in „Datum Provision" = abgerechnet; sonst eingereicht
      var pd = zelle(z, 'provDatum'), status = 'eingereicht', statusDatum = datum, mo = typeof pd === 'string' ? monatAus(pd) : -1, pdDatum = U.parseDatum(pd);
      if (mo >= 0) { var ein = +datum.slice(5, 7) - 1, yj = +datum.slice(0, 4) + (mo < ein - 1 ? 1 : 0); status = 'abgerechnet'; statusDatum = yj + '-' + ('0' + (mo + 1)).slice(-2) + '-01'; if (statusDatum < datum) statusDatum = datum; }
      else if (pdDatum) { status = 'abgerechnet'; statusDatum = pdDatum; }
      var stt = U.falte(text(zelle(z, 'status')));
      if (status === 'eingereicht' && stt) {
        if (/abgerechnet|ausgezahlt|bezahlt/.test(stt)) status = 'abgerechnet'; else if (/polic|^ja$|^x$/.test(stt)) status = 'policiert';
        else if (/abgelehnt/.test(stt)) status = 'abgelehnt'; else if (/widerruf/.test(stt)) status = 'widerruf'; else if (/storno/.test(stt)) status = 'storno'; else if (/absage|zurueck/.test(stt)) status = 'absage';
        else hinweise.push('Status: ' + text(zelle(z, 'status')));
      }
      if (status === 'eingereicht' && text(pd)) {
        var pt = U.falte(pd);
        if (/abgelehnt/.test(pt)) status = 'abgelehnt'; else if (/widerruf/.test(pt)) status = 'widerruf'; else if (/storno/.test(pt)) status = 'storno';
        hinweise.push(text(pd));
      }
      an.status = status; an.statusDatum = statusDatum; an.statusManuell = false;
      an.historie = [{ status: status, datum: statusDatum, am: an.erstellt, quelle: 'altbuch', notiz: 'aus eigener Liste' }];
      var unklar = !d.sicher || bt.wert == null || gvFremd || /keine\s*polic|fehl|!/i.test(text(pd) + ' ' + pr.rest);
      if (unklar) { geschaetzt++; an.nachbearbeitung = { status: 'offen', text: [d.grund].concat(hinweise).filter(Boolean).join(' · ') || 'Bitte prüfen', datum: U.heute() }; }
      an.bemerkung = [tarifRoh ? 'Liste: ' + tarifRoh : '', text(zelle(z, 'bemerkung'))].concat(hinweise, ['eigene Liste Zeile ' + (r + 1)]).filter(Boolean).join(' · ');
      out.push(an);
    }
    return { antraege: out, jahr: jahr, uebersprungen: uebersprungen, geschaetzt: geschaetzt, frei: true };
  };
})(globalThis.AB = globalThis.AB || {});
