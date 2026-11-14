/* Antragsbuch – Übernahme aus dem bisherigen Excel-Antragsbuch (ein Blatt je Jahr, Monatsblöcke in Spalte A). */
(function (AB) {
  'use strict';
  var U = AB.util, L = AB.altbuch = {};
  var MONATE = ['januar', 'februar', 'maerz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];

  /** Blatt mit dem alten Antragsbuch finden → { blatt, kopf, sp:{…}, jahr } oder null */
  L.finde = function (blaetter) {
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
  L.lies = function (fund, jahr) {
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
})(globalThis.AB = globalThis.AB || {});
