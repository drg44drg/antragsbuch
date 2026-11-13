/* Antragsbuch – Datei erkennen und einlesen (läuft im Web Worker oder direkt). */
(function (AB) {
  'use strict';
  var I = AB.importer = {};

  /**
   * Erkennt die Art einer Datei am Inhalt und liest sie.
   * → { art: 'projekt'|'teamdatei'|'abrechnung'|'monatsscheiben'|'tabelle', … }
   * opt: { alt: gepackter bisheriger Abrechnungsstand, importNr, jahr, vermittlernummer }
   */
  I.lies = async function (bytes, dateiname, opt) {
    opt = opt || {};
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
    var i = 0;
    while (i < bytes.length && (bytes[i] <= 32 || bytes[i] >= 0xEF)) i++;
    if (bytes[i] === 0x7B) { // '{' → JSON
      var obj;
      try { obj = JSON.parse(AB.csv.dekodiere(bytes).text); } catch (e) { throw new Error('Die Datei ist beschädigt und kann nicht gelesen werden.'); }
      if (obj && obj.format === 'antragsbuch') return { art: 'projekt', projekt: obj };
      if (obj && obj.format === 'antragsbuch-team') return { art: 'teamdatei', team: obj.team };
      throw new Error('Diese JSON-Datei gehört nicht zum Antragsbuch.');
    }
    var t = await AB.xlsx.liesTabelle(bytes, dateiname);
    // Abrechnung? (auch als Blatt einer Excel-Mappe)
    for (var b = 0; b < t.blaetter.length; b++) {
      var map = AB.abrechnung.ordneSpalten(t.blaetter[b].zeilen);
      if (!map.fehler || /Pflichtspalten/.test(map.fehler)) {
        var r = AB.abrechnung.lies(t.blaetter[b].zeilen, { jahr: opt.jahr, vermittlernummer: opt.vermittlernummer });
        if (r.fehler) throw new Error(r.fehler);
        var alt = opt.alt ? AB.abrechnung.entpacke(opt.alt) : [];
        var v = AB.abrechnung.vergleiche(alt, r.zeilen, opt.importNr || 1);
        return { art: 'abrechnung', gepackt: AB.abrechnung.packe(r.zeilen), anzahl: r.zeilen.length, warnungen: r.warnungen,
          provisionssumme: r.provisionssumme, vergleich: v, info: t.info, tarife: AB.abrechnung.tarife(r.zeilen), vermittler: r.vermittler };
      }
    }
    if (AB.team.istMonatsscheiben(t.blaetter)) return { art: 'monatsscheiben', team: AB.team.liesMonatsscheiben(t.blaetter) };
    return { art: 'tabelle', blaetter: t.blaetter, info: t.info };
  };
})(globalThis.AB = globalThis.AB || {});
