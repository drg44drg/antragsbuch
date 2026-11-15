/* Antragsbuch – ADP-Wettbewerb: Bonus-Rechner nach den Wettbewerbsbedingungen (Grundbonus, Zusatzboni, Sonderregelung). */
(function (AB) {
  'use strict';
  var U = AB.util, B = AB.bonus = {};

  // Wettbewerbsbedingungen 2025 (hauptberuflicher Außendienst). Stufe 1 und 2 sind gleich.
  B.STUFEN = [
    { id: '1+2', name: 'Karrierestufe 1 + 2', ziel2: 22, jeMB: 0.4, zb1Schwelle: 25, zb1: 750, kombi: 3000, bkvStueck: 25, bkv: 500, mindest: 6000 },
    { id: '3', name: 'Karrierestufe 3', ziel2: 25, jeMB: 0.5, zb1Schwelle: 27, zb1: 2100, kombi: 4500, bkvStueck: 35, bkv: 1000, mindest: 7200 },
    { id: '4', name: 'Karrierestufe 4', ziel2: 27, jeMB: 0.6, zb1Schwelle: 29, zb1: 4050, kombi: 6000, bkvStueck: 45, bkv: 1500, mindest: 9600 },
    { id: '5', name: 'Karrierestufe 5', ziel2: 29, jeMB: 0.7, zb1Schwelle: 31, zb1: 7000, kombi: 7500, bkvStueck: 60, bkv: 2500, mindest: 12000 },
    { id: '6', name: 'Karrierestufe 6', ziel2: 31, jeMB: 0.9, zb1Schwelle: 33, zb1: 13500, kombi: 9000, bkvStueck: 75, bkv: 3500, mindest: 16000 }
  ];
  B.leer = function () { return { stufe: '1+2', bestandKv: null, bestandVoll: null, neueVoll: null, neueBkv: null, nettoKv: null, nettoGesamt: null, stand: '' }; };

  /**
   * e: { stufe, bestandKv (KV-Gesamt-Bestand €), bestandVoll (KV-Voll + Pflegepflicht €), neueVoll (neue Personen KV-Voll),
   *      neueBkv (neue Personen bKV), nettoKv (KV-Nettoproduktion € MB), nettoGesamt (KV/UV + LV-Ventil € MB) }
   */
  B.rechne = function (e) {
    var s = B.STUFEN.find(function (x) { return x.id === e.stufe; }) || B.STUFEN[0], n = function (v) { return +v || 0; };
    var gesamt = n(e.nettoGesamt) || n(e.nettoKv), kv = n(e.nettoKv) || n(e.nettoGesamt);
    var o = { stufe: s, gesamt: gesamt };
    // Ziel 1: je 100.000 € Bestand (KV-Voll + Pflegepflicht) drei neue Personen in der KV-Voll
    var basisVoll = n(e.bestandVoll) || n(e.bestandKv);
    // Gezählt wird je volle 100.000 € (Beispiel der Bedingungen: 350.000 € Bestand → 9 Personen), mindestens 3.
    o.ziel1 = { soll: basisVoll ? Math.max(3, Math.floor(basisVoll / 100000 + 1e-9) * 3) : 0, ist: n(e.neueVoll) };
    o.ziel1.fehlt = Math.max(0, o.ziel1.soll - o.ziel1.ist); o.ziel1.erreicht = o.ziel1.soll > 0 && o.ziel1.fehlt === 0;
    // Ziel 2: KV-Nettoproduktion je 1.000 € KV-Gesamt-Bestand
    o.ziel2 = { soll: U.runde(s.ziel2 * n(e.bestandKv) / 1000), ist: kv, je1000: n(e.bestandKv) ? U.runde(kv / n(e.bestandKv) * 1000) : 0, schwelle: s.ziel2 };
    o.ziel2.fehlt = Math.max(0, U.runde(o.ziel2.soll - kv)); o.ziel2.erreicht = n(e.bestandKv) > 0 && o.ziel2.fehlt === 0;
    o.grundErreicht = o.ziel1.erreicht || o.ziel2.erreicht;
    o.grundVoll = U.runde(gesamt * s.jeMB);
    // Sonderregelung: 50 % des Grundbonus, wenn die Mindestproduktion überschritten ist (Bedingungen: „> 7.200")
    o.sonder = { mindest: s.mindest, fehlt: Math.max(0, U.runde(s.mindest - gesamt)), greift: !o.grundErreicht && gesamt > s.mindest };
    o.grund = o.grundErreicht ? o.grundVoll : o.sonder.greift ? U.runde(o.grundVoll / 2) : 0;
    // Zusatzboni setzen den Grundbonus voraus
    var zb1Soll = U.runde(s.zb1Schwelle * n(e.bestandKv) / 1000);
    o.zb1 = { soll: zb1Soll, ist: kv, fehlt: Math.max(0, U.runde(zb1Soll - kv)), max: s.zb1, schwelle: s.zb1Schwelle };
    o.zb1.erreicht = n(e.bestandKv) > 0 && o.zb1.fehlt === 0; o.zb1.praemie = o.grundErreicht && o.zb1.erreicht ? s.zb1 : 0;
    o.kombi = { max: s.kombi, erreicht: o.ziel1.erreicht && o.ziel2.erreicht }; o.kombi.praemie = o.kombi.erreicht ? s.kombi : 0;
    o.bkv = { soll: s.bkvStueck, ist: n(e.neueBkv), fehlt: Math.max(0, s.bkvStueck - n(e.neueBkv)), max: s.bkv };
    o.bkv.erreicht = o.bkv.fehlt === 0; o.bkv.praemie = o.grundErreicht && o.bkv.erreicht ? s.bkv : 0;
    o.summe = U.runde(o.grund + o.zb1.praemie + o.kombi.praemie + o.bkv.praemie);
    o.maxZusatz = s.zb1 + s.kombi + s.bkv;
    o.max = U.runde(o.grundVoll + o.maxZusatz);
    // Nächste Schritte in der Reihenfolge des kleinsten Aufwands
    o.schritte = [];
    if (!o.grundErreicht) {
      if (o.ziel1.soll) o.schritte.push('Grundbonus über Ziel 1: noch ' + o.ziel1.fehlt + (o.ziel1.fehlt === 1 ? ' neue Person' : ' neue Personen') + ' in der KV-Voll.');
      if (e.bestandKv) o.schritte.push('Grundbonus über Ziel 2: noch ' + U.fmtEuro0(o.ziel2.fehlt) + ' KV-Nettoproduktion.');
      if (!o.sonder.greift) o.schritte.push('Sonderregelung (halber Grundbonus): noch ' + U.fmtEuro0(o.sonder.fehlt) + ' bis zur Mindestproduktion.');
    } else {
      if (!o.zb1.erreicht && e.bestandKv) o.schritte.push('Zusatzbonus Bestandsausschöpfung (' + U.fmtEuro0(s.zb1) + '): noch ' + U.fmtEuro0(o.zb1.fehlt) + ' KV-Nettoproduktion.');
      if (!o.kombi.erreicht) o.schritte.push('Kombibonus (' + U.fmtEuro0(s.kombi) + '): ' + (o.ziel1.erreicht ? 'noch ' + U.fmtEuro0(o.ziel2.fehlt) + ' KV-Nettoproduktion für Ziel 2.' : 'noch ' + o.ziel1.fehlt + ' neue Personen KV-Voll für Ziel 1.'));
    }
    if (!o.bkv.erreicht) o.schritte.push('Zusatzbonus bKV (' + U.fmtEuro0(s.bkv) + '): noch ' + o.bkv.fehlt + ' neue Personen in der bKV' + (o.grundErreicht ? '.' : ' – zählt erst mit erreichtem Grundbonus.'));
    return o;
  };
})(globalThis.AB = globalThis.AB || {});
