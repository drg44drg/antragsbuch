/* Antragsbuch – Leben (Ventil Stuttgarter): Produktliste und Provisionsberechnung nach den Provisionsrichtlinien 08/2025. */
(function (AB) {
  'use strict';
  var U = AB.util, L = AB.leben = {};

  // linie: classic 20 ‰ · fonds (index-safe, performance+, comfort+) 30 ‰ · bio (Biometrie) 30 ‰ · bestattung 30 ‰
  L.LINIEN = {
    classic: { name: 'Altersvorsorge classic', satz: 20, haftung: 60, maxJahre: 35, laufzeitfaktor: true },
    fonds: { name: 'Altersvorsorge index-safe / performance+ / comfort+', satz: 30, haftung: 96, maxJahre: 35 },
    bio: { name: 'Risikoabsicherung (Biometrie)', satz: 30, haftung: 60, maxJahre: 35 },
    bestattung: { name: 'Bestattungsvorsorge', satz: 30, haftung: 60, maxJahre: 35 }
  };
  L.PRODUKTE = [
    { id: 'T69', tarif: '69', name: 'BasisRente index-safe', gruppe: 'Rente', linie: 'fonds' },
    { id: 'T79', tarif: '79', name: 'BasisRente performance+', gruppe: 'Rente', linie: 'fonds', maxJahre: 40 },
    { id: 'T75I', tarif: '75', name: 'RiesterRente index-safe', gruppe: 'Rente', linie: 'fonds' },
    { id: 'T75P', tarif: '75', name: 'RiesterRente performance+', gruppe: 'Rente', linie: 'fonds', maxJahre: 40 },
    { id: 'T75C', tarif: '75', name: 'RiesterRente comfort+', gruppe: 'Rente', linie: 'fonds', maxJahre: 40 },
    { id: 'T37', tarif: '37', name: 'DirektRente classic', gruppe: 'Rente', linie: 'classic' },
    { id: 'T38', tarif: '38', name: 'DirektRente classic', gruppe: 'Rente', linie: 'classic' },
    { id: 'T68BO', tarif: '68BO', name: 'DirektRente index-safe (beitragsorientiert)', gruppe: 'Rente', linie: 'fonds' },
    { id: 'T68ML', tarif: '68ML', name: 'DirektRente index-safe (Mindestleistung)', gruppe: 'Rente', linie: 'fonds' },
    { id: 'T78BO', tarif: '78BO', name: 'DirektRente performance+', gruppe: 'Rente', linie: 'fonds', maxJahre: 40 },
    { id: 'T63', tarif: '63', name: 'FlexRente index-safe', gruppe: 'Rente', linie: 'fonds' },
    { id: 'T63K', tarif: '63 Kdo', name: 'Kindervorsorge index-safe', gruppe: 'Rente', linie: 'fonds' },
    { id: 'T73', tarif: '73', name: 'FlexRente performance+', gruppe: 'Rente', linie: 'fonds', maxJahre: 40 },
    { id: 'T73K', tarif: '73 Kdo', name: 'Kindervorsorge performance+', gruppe: 'Rente', linie: 'fonds', maxJahre: 40 },
    { id: 'T95', tarif: '95', name: 'Grundschutz+ (Grundfähigkeit)', gruppe: 'BU', linie: 'bio', maxJahre: 40 },
    { id: 'T91', tarif: '91', name: 'BU-Plus', gruppe: 'BU', linie: 'bio', maxJahre: 40 },
    { id: 'T91A', tarif: '91A', name: 'BU premium (mit Leistung bei Arbeitsunfähigkeit)', gruppe: 'BU', linie: 'bio', maxJahre: 40 },
    { id: 'T20', tarif: '20', name: 'Konstante Risiko-LV', gruppe: 'Risiko', linie: 'bio' },
    { id: 'T21', tarif: '21', name: 'Fallende Risiko-LV', gruppe: 'Risiko', linie: 'bio' },
    { id: 'T15', tarif: '15', name: 'Bestattungsvorsorge (Direkte Leben)', gruppe: 'Bestattung', linie: 'bestattung' }
  ];
  // Tarifgruppen mit verminderten Abschlusskosten: Anteil am Provisionssatz
  L.TARIFGRUPPEN = [['einzel', 'Einzeltarif / Kollektiv-Sammelrabatt (100 %)', 100], ['KG9', 'KG9 (90 %)', 90], ['KG7E', 'KG7E (75 %)', 75], ['KG6', 'KG6 (60 %)', 60], ['KG5', 'KG5 (50 %)', 50], ['KG2E', 'KG2E (25 %)', 25]];

  L.produkt = function (id) { return L.PRODUKTE.find(function (p) { return p.id === id; }) || null; };
  L.titel = function (p) { return 'T' + p.tarif + ' · ' + p.name; };

  /** Suche: Teilwort an beliebiger Stelle, mehrere Wörter, „*" als Platzhalter (z. B. „*9" findet BU 91, 95, 69 …). */
  L.suche = function (q) {
    q = U.falte(String(q || '').trim());
    if (!q) return L.PRODUKTE.slice();
    var teile = q.split(/\s+/).map(function (t) { return new RegExp(t.split('*').map(function (s) { return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'); }).join('.*')); });
    return L.PRODUKTE.filter(function (p) { var text = U.falte('t' + p.tarif + ' ' + p.tarif + ' ' + p.name + ' ' + p.gruppe); return teile.every(function (r) { return r.test(text); }); });
  };

  /** Laufzeitfaktor der Produktlinie classic bei laufendem Beitrag (Anlage Vergütungsniveau, Einzeltarif): über 29 Jahre 100 %, je Jahr darunter 5 Punkte weniger, bis 10 Jahre 0 %. */
  L.laufzeitfaktor = function (jahre) { jahre = +jahre || 0; return jahre > 29 ? 100 : Math.max(0, 5 * (Math.ceil(jahre) - 10)); };

  /**
   * Provision eines Leben-Antrags. o: { produkt, tarifgruppe, einmal } · monatsbeitrag (bzw. Einmalbeitrag) · jahre (Beitragszahlungsdauer).
   * → { ok, wertungssumme, satz (‰ wirksam), betrag, haftung, text, richtwert }
   */
  L.rechne = function (o, beitrag, jahre) {
    var p = L.produkt(o && o.produkt); if (!p) return { ok: false };
    var li = L.LINIEN[p.linie], max = p.maxJahre || li.maxJahre, tg = (L.TARIFGRUPPEN.find(function (t) { return t[0] === (o.tarifgruppe || 'einzel'); }) || L.TARIFGRUPPEN[0])[2];
    var j = Math.min(+jahre || 0, max), ws = o.einmal ? +beitrag || 0 : (+beitrag || 0) * 12 * j, anteil = tg, richtwert = false;
    if (li.laufzeitfaktor && !o.einmal) { var lf = L.laufzeitfaktor(+jahre || 0); richtwert = tg < 100; anteil = Math.min(tg, lf); }
    else if (li.laufzeitfaktor && o.einmal) richtwert = true;
    var satz = li.satz * anteil / 100, betrag = U.runde(ws * satz / 1000);
    return { ok: true, produkt: p, wertungssumme: U.runde(ws), satz: satz, betrag: betrag, haftung: li.haftung, richtwert: richtwert,
      text: U.fmtZahl(satz, 2) + ' ‰ × ' + U.fmtEuro(ws) + ' Wertungssumme' + (o.einmal ? ' (Einmalbeitrag)' : ' (' + U.fmtZahl(j, 0) + ' Jahre' + ((+jahre || 0) > max ? ', begrenzt' : '') + ')') + (anteil < 100 ? ' · ' + U.fmtZahl(anteil, 0) + ' % des Satzes' : '') + (richtwert ? ' · Richtwert' : '') };
  };
})(globalThis.AB = globalThis.AB || {});
