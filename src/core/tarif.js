/* Antragsbuch – Tarif-Einordnung: Tarifwelt (a/n/u) und Kategorie aus Tarifgruppe + Kürzel.
   Grundlage: Angaben des Auftraggebers und Abschnitt „Beihilfeberechtigte" des Tarifbuchs.
   `sicher: false` heißt: aus dem Kürzel abgeleitet, noch nicht bestätigt. */
(function (AB) {
  'use strict';
  var T = AB.tarif = {};
  T.WELTEN = { a: 'Alte Tarifwelt (Bisex, vor 2009)', n: 'Neue Tarifwelt (Bisex, 2009–2013)', u: 'Unisex' };

  // [Tarifgruppe-Muster, Kürzel-Muster, Kategorie, sicher]
  var REGELN = [
    [/^Voll/, /^BE/, 'Beitragsentlastung', true],
    [/^Voll/, /^(B|BW\d?)[anu]?$/, 'Beihilfe-Ergänzung', true],
    [/^Voll/, /^B(A|S|Z)/, 'Beihilfe', false],
    [/^Voll/, /^(R|W)/, 'Beihilfe stationär', true],
    [/^Voll/, /^TA/, 'Krankentagegeld', false],
    [/^Voll/, /^(VP|PPB|PVN|PPN)/, 'Pflegepflicht', false],
    [/^Voll/, /^(AM|A)\d/, 'Ambulant', false],
    [/^Voll/, /^A[EZ]/, 'Ambulant (Ergänzung)', false],
    [/^Voll/, /^S/, 'Stationär', false],
    [/^Voll/, /^Z/, 'Zahn', false],
    [/Art Leben|Art Schaden/, /^(PG|PEV|PZ)/, 'Pflegeergänzung', true],
    [/Art Leben|Art Schaden/, /^NH/, 'Naturheilverfahren', true],
    [/Art Leben|Art Schaden/, /^10/, 'Krankenhaustagegeld', true],
    [/Art Leben|Art Schaden/, /^(ZG|ZH|ZP)/, 'Zahnzusatz', false],
    [/Art Leben|Art Schaden/, /^(SG|SP)/, 'Stationäre Zusatz', false],
    [/Art Leben|Art Schaden/, /^(AG|AP)/, 'Ambulante Zusatz', false],
    [/Art Leben|Art Schaden/, /^TG/, 'Tagegeld', false],
    [/^Firmen/, /O$/, 'bKV obligatorisch', true],
    [/^Firmen/, /(F|Fz)$/, 'bKV fakultativ', true],
    [/^Gruppen/, /(FR|OR)$/, 'Gruppe (R-Tarif)', false],
    [/^Gruppen/, /(G|Gz)$/, 'Gruppe (G-Tarif)', false],
    [/^Unfall/, /./, 'Unfall', true],
    [/^Leben/, /^SBU/, 'Berufsunfähigkeit', false],
    [/^Leben/, /./, 'Leben', true]
  ];

  /** → { kategorie, sicher, welt, weltName, hinweis } */
  T.einordnen = function (tarif, gruppe) {
    var t = String(tarif == null ? '' : tarif).trim(), g = String(gruppe || ''), o = { kategorie: '', sicher: false, welt: '', weltName: '', hinweis: '' };
    var m = /^[A-Z][A-Za-z0-9]*?([anu])$/.exec(t);
    if (m && /^Voll/.test(g)) { o.welt = m[1]; o.weltName = T.WELTEN[m[1]]; }
    for (var i = 0; i < REGELN.length; i++) if (REGELN[i][0].test(g) && REGELN[i][1].test(t)) { o.kategorie = REGELN[i][2]; o.sicher = REGELN[i][3]; break; }
    if (/^PG\d[AS]?D/.test(t)) o.hinweis = 'mit Dynamik über das 70. Lebensjahr';
    else if (/^PG\d/.test(t)) o.hinweis = 'Pflegegrad ' + t.charAt(2);
    if (/^Voll/.test(g) && /^(A|S|Z)\d/.test(t)) o.hinweis = 'Kürzel gibt es auch als Beihilfetarif – Zuordnung offen';
    return o;
  };
  T.text = function (tarif, gruppe) {
    var e = T.einordnen(tarif, gruppe), teile = [];
    if (gruppe) teile.push(gruppe);
    if (e.kategorie) teile.push(e.kategorie + (e.sicher ? '' : ' (Vorschlag)'));
    if (e.weltName) teile.push(e.weltName);
    if (e.hinweis) teile.push(e.hinweis);
    return teile.join(' · ');
  };
})(globalThis.AB = globalThis.AB || {});
