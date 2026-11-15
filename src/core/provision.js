/* Antragsbuch – erwartete Provision nach pflegbarer Regeltabelle. */
(function (AB) {
  'use strict';
  var U = AB.util, P = AB.provision = {};

  P.ARTEN = [
    { id: 'faktor', name: 'Faktor × Monatsbeitrag', einheit: 'Monatsbeiträge' },
    { id: 'leben', name: 'Satz × Bewertungssumme', einheit: '‰ der Bewertungssumme' },
    { id: 'unfall', name: 'Prozent vom Monatsbeitrag, laufend', einheit: '% je Monat' },
    { id: 'stueck', name: 'Fixbetrag je Stück', einheit: '€ je Stück' },
    { id: 'keine', name: 'Keine Provision', einheit: '' }
  ];

  /** Beispiel-Startwerte – jeder ADP pflegt seine eigenen Sätze in den Einstellungen. */
  P.standardRegeln = function () {
    var faktor = { voll: 5.5, zusatz: 4.5, bkv: 3, gruppe: 2.8, pflege: 1.5 };
    var r = {};
    ['voll', 'zusatz', 'bkv', 'gruppe', 'pflege', 'leben', 'unfall', 'gkv'].forEach(function (b) {
      ['neu', 'mehr', 'minder', 'umstellung', 'dynamik', 'storno'].forEach(function (v) {
        var regel;
        if (v === 'umstellung') regel = { art: 'keine', wert: 0 };
        else if (b === 'leben') regel = { art: 'leben', wert: 25 };
        else if (b === 'unfall') regel = { art: 'unfall', wert: 20 };
        else if (b === 'gkv') regel = { art: 'stueck', wert: 50 };
        else regel = { art: 'faktor', wert: faktor[b] };
        r[b + '|' + v] = regel;
      });
    });
    return r;
  };

  /**
   * Regeltabelle nach Karrierestufe und Provisionsrichtlinien (ADP 07/2025, Ventil Stuttgarter 08/2025), bankfreies Geschäft:
   * Krankenversicherung mb Monatsbeiträge (Stufe 1: 4 MB), Pflegepflicht mit Vollversicherung 2 MB, Leben 30 ‰ der Wertungssumme
   * (index-safe, performance+, Biometrie; classic 20 ‰), Unfall laufend 20 %, mhplus-Mitgliedschaft 100 € je Mitglied, Umstellung ohne Provision.
   */
  P.regelnNachStufe = function (mb) {
    var r = {};
    ['voll', 'zusatz', 'bkv', 'gruppe', 'pflege', 'leben', 'unfall', 'gkv'].forEach(function (b) {
      ['neu', 'mehr', 'minder', 'umstellung', 'dynamik', 'storno'].forEach(function (v) {
        r[b + '|' + v] = v === 'umstellung' ? { art: 'keine', wert: 0 } : b === 'leben' ? { art: 'leben', wert: 30 } : b === 'unfall' ? { art: 'unfall', wert: 20 }
          : b === 'gkv' ? { art: 'stueck', wert: 100 } : b === 'pflege' ? { art: 'faktor', wert: 2 } : { art: 'faktor', wert: +mb };
      });
    });
    return r;
  };

  P.regel = function (regeln, bereich, vorgang) {
    return (regeln && regeln[bereich + '|' + vorgang]) || { art: 'keine', wert: 0 };
  };

  /**
   * Erwartete Provision eines Antrags.
   * → { betrag, berechnet, ueberschrieben, laufend, teile:[{text, betrag}], bankAbzug }
   * laufend=true (Unfall): betrag gilt je Monat.
   */
  P.soll = function (a, regeln) {
    var M = AB.model, summe = 0, teile = [], laufend = false, stueck = 0;
    a.positionen.forEach(function (p) {
      var bereich = p.bereich || a.bereich, r = P.regel(regeln, bereich, a.vorgang);
      var b = M.vorzeichen(a, +p.beitrag || 0), x = 0, text = '';
      if (AB.tarif && AB.tarif.einordnen(p.tarif).kategorie === 'Gesetzlicher Zuschlag') { teile.push({ text: p.tarif + ': gesetzlicher Zuschlag – keine Provision', betrag: 0 }); return; }
      if (r.art === 'faktor') { x = r.wert * b; text = U.fmtZahl(r.wert, 2) + ' × ' + U.fmtEuro(b); }
      else if (r.art === 'leben') {
        var bws = b * 12 * (+a.laufzeit || 0);
        x = r.wert / 1000 * bws; text = U.fmtZahl(r.wert, 1) + ' ‰ × ' + U.fmtEuro(bws) + ' Bewertungssumme';
      } else if (r.art === 'unfall') { x = r.wert / 100 * b; laufend = true; text = U.fmtZahl(r.wert, 0) + ' % × ' + U.fmtEuro(b) + ' je Monat'; }
      else if (r.art === 'stueck') {
        if (!p.tarif && !p.person && stueck) return;
        stueck++; x = (a.vorgang === 'storno' || a.vorgang === 'minder') ? -r.wert : r.wert; text = '1 Stück × ' + U.fmtEuro(r.wert);
      } else text = 'keine Provision';
      summe += x;
      teile.push({ text: (p.tarif ? p.tarif + ': ' : '') + text, betrag: U.runde(x) });
    });
    var bankAbzug = 0;
    if (a.bank && a.bank.aktiv && +a.bank.anteil > 0) {
      bankAbzug = summe * Math.min(100, +a.bank.anteil) / 100;
      summe -= bankAbzug;
    }
    var berechnet = U.runde(summe);
    var manuell = a.provisionManuell != null && a.provisionManuell !== '' && !isNaN(a.provisionManuell);
    return {
      betrag: manuell ? +a.provisionManuell : berechnet, berechnet: berechnet, ueberschrieben: manuell,
      laufend: laufend, teile: teile, bankAbzug: U.runde(bankAbzug), stueck: stueck
    };
  };
})(globalThis.AB = globalThis.AB || {});
