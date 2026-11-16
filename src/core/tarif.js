/* Antragsbuch – Tarif-Einordnung: Beschreibung aus dem Tarifverzeichnis, daraus Kategorie, Beihilfe und Tarifwelt.
   Unbekannte Tarife werden aus Tarifgruppe und Kürzel geschätzt (`sicher: false`). */
(function (AB) {
  'use strict';
  var T = AB.tarif = {};
  T.WELTEN = { a: 'Alte Tarifwelt (Bisex, vor 2009)', n: 'Neue Tarifwelt (Bisex, 2009–2013)', u: 'Unisex', z: 'Modifizierte Kostensätze' };

  var verzeichnis = null;
  T.verzeichnis = function () {
    if (verzeichnis) return verzeichnis;
    verzeichnis = new Map();
    String(AB.tarifdaten || '').split('\n').forEach(function (z) { var i = z.indexOf('|'); if (i > 0) verzeichnis.set(z.slice(0, i), z.slice(i + 1)); });
    return verzeichnis;
  };

  // Reihenfolge zählt: erste passende Regel gewinnt
  var KATEGORIEN = [
    [/Pflegepflicht/, 'Pflegepflicht'], [/Pflege/, 'Pflegezusatz'], [/Beitragsentlastung/, 'Beitragsentlastung'],
    [/Krankentagegeld/, 'Krankentagegeld'], [/Krankenhaustagegeld/, 'Krankenhaustagegeld'],
    [/otlagentarif/, 'Sozialtarif · Notlagentarif'], [/asistarif/, 'Sozialtarif · Basistarif'], [/Standardtarif/, 'Sozialtarif · Standardtarif'], [/Unfall/, 'Unfall'], [/Ausland/, 'Ausland'],
    [/Sterbegeld|Renten|Beitragsfreistellung/, 'Leben und Vorsorge'], [/Zahn/, 'Zahn'], [/Naturheil|Heilpraktiker/, 'Naturheilverfahren'],
    [/Vorsorgetarif/, 'Vorsorge'], [/mbulant/, 'Ambulant'], [/tationär/, 'Stationär'], [/Gesetzlicher Zuschlag/, 'Gesetzlicher Zuschlag'],
    [/Ergänzungstarif/, 'Ergänzung'], [/Optionstarif/, 'Option']
  ];
  var SCHAETZUNG = [
    [/^Voll/, /^BE/, 'Beitragsentlastung'], [/^Voll/, /^B/, 'Ergänzung'], [/^Voll/, /^TA/, 'Krankentagegeld'], [/^Voll/, /^A/, 'Ambulant'],
    [/^Voll/, /^[SRW]/, 'Stationär'], [/^Voll/, /^Z/, 'Zahn'], [/Art Leben|Art Schaden/, /^P/, 'Pflegezusatz'], [/Art Leben|Art Schaden/, /^Z/, 'Zahn'],
    [/Art Leben|Art Schaden/, /^S/, 'Stationär'], [/Art Leben|Art Schaden/, /^A/, 'Ambulant'], [/^Unfall/, /./, 'Unfall'], [/^Leben|^SDL/, /^SBU/, 'Berufsunfähigkeit'], [/^Leben|^SDL/, /./, 'Leben']
  ];

  /** → { beschreibung, kategorie, beihilfe, zusatz, zielgruppe, welt, weltName, hinweis, sicher } */
  T.einordnen = function (tarif, gruppe) {
    var t = String(tarif == null ? '' : tarif).trim(), g = String(gruppe || '');
    var o = { beschreibung: '', kategorie: '', beihilfe: false, zusatz: false, zielgruppe: '', welt: '', weltName: '', hinweis: '', sicher: false };
    var v = T.verzeichnis(), b = v.get(t), familie = false;
    if (!b && t) { // ohne Endung erfasst (A107 statt A107a) oder mit Betrag (TA6/160, BE375): Tariffamilie suchen
      var kern = t.split(/[\s\/(]/)[0], kand = [kern, kern + 'a', kern + 'n', kern + 'u', kern + 'z'], stamm = kern.replace(/\d+$/, '');
      if (stamm && stamm !== kern) kand = kand.concat([stamm, stamm + 'a', stamm + 'n', stamm + 'u']);
      for (var q = 0; q < kand.length && !b; q++) b = v.get(kand[q]);
      familie = !!b;
    }
    if (b) {
      o.beschreibung = b; o.sicher = true;
      for (var i = 0; i < KATEGORIEN.length; i++) if (KATEGORIEN[i][0].test(b)) { o.kategorie = KATEGORIEN[i][1]; break; }
      o.beihilfe = /Beihilfe|Beamtenanwärter/.test(b);
      o.zusatz = /Ergänzungs|Zusatz|Zahnersatz|GKV|mhplus|Tagegeld|tagegeld/.test(b) && !/Beihilfe|Beamtenanwärter/.test(b);
      o.zielgruppe = /Firmen/.test(b) ? 'Firmen (bKV)' : /gen\. Organisationen|Gruppen/.test(b) ? 'Gruppenversicherung' : /Kooperationspartner/.test(b) ? 'Kooperationspartner' : /mhplus/.test(b) ? 'mhplus' : /GKV/.test(b) ? 'GKV-Mitglieder' : '';
    } else {
      for (var k = 0; k < SCHAETZUNG.length; k++) if (SCHAETZUNG[k][0].test(g) && SCHAETZUNG[k][1].test(t)) { o.kategorie = SCHAETZUNG[k][2]; break; }
    }
    var m = /^[A-Z0-9][A-Za-z0-9]*?([anuz])$/.exec(t);
    if (m && !familie && (b || /^Voll/.test(g))) { o.welt = m[1]; o.weltName = T.WELTEN[m[1]]; }
    if (familie) o.hinweis = 'Tariffamilie – Kürzel ohne Endung oder mit Betrag erfasst';
    if (/^PG\d[AS]?D/.test(t)) o.hinweis = 'mit Dynamik über das 70. Lebensjahr';
    return o;
  };
  /** Kurztext für Tooltips und Vorschlagslisten. */
  T.text = function (tarif, gruppe) {
    var e = T.einordnen(tarif, gruppe), teile = [];
    if (e.beschreibung) teile.push(e.beschreibung); else { if (gruppe) teile.push(gruppe); if (e.kategorie) teile.push(e.kategorie + ' (geschätzt)'); }
    if (e.weltName) teile.push(e.weltName);
    if (e.hinweis) teile.push(e.hinweis);
    return teile.join(' · ');
  };
  /** Feinere Sparte für Auswertungen, z. B. „Voll · Beihilfe" oder „Zusatz · Zahn". */
  T.sparte = function (tarif, gruppe) {
    var e = T.einordnen(tarif, gruppe);
    if (!e.kategorie) return 'Sonstige';
    return (e.beihilfe ? 'Beihilfe · ' : '') + e.kategorie;
  };
})(globalThis.AB = globalThis.AB || {});
