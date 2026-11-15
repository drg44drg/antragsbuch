/* Antragsbuch – Einstellungen: Stammdaten, Toleranzen, Provisionsregeln, Tarifliste, Ordner, Sicherungen. */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h, U = AB.util, M = AB.model, Sp = AB.speicher, App = AB.app;
  function zahl(wert, setze, attrs) {
    var i = h('input', Object.assign({ type: 'text', inputMode: 'decimal', value: String(wert == null ? '' : wert).replace('.', ','), onchange: function () {
      var n = U.parseZahl(i.value); if (isNaN(n)) { i.classList.add('fehler'); return; } i.classList.remove('fehler'); setze(n); App.geaendert({ still: true });
    } }, attrs || {}));
    return i;
  }
  function text(wert, setze, attrs) { var i = h('input', Object.assign({ type: 'text', value: wert || '', onchange: function () { setze(i.value.trim()); App.geaendert({ still: true }); } }, attrs || {})); return i; }

  AB.ansichten.einstellungen = { titel: 'Einstellungen', icon: 'einstellungen', unter: 'Gelten für dieses Projekt und werden in der Projektdatei gespeichert',
    zeige: function (el, aktionen, z) {
      var p = App.p, e = p.einstellungen;
      // Stammdaten + Toleranzen
      el.appendChild(h('div.raster.r-2', null,
        h('div.karte', null, h('h3', null, 'Meine Angaben'), h('div.formraster', { style: { marginTop: '10px' } },
          D.feld('Vermittlernummer (6-stellig)', text(e.vermittlernummer, function (v) { e.vermittlernummer = v.replace(/\s/g, ''); if (v && !/^\d{6}$/.test(e.vermittlernummer)) D.toast('Die Vermittlernummer hat normalerweise sechs Ziffern, z. B. 900402.', { krit: true }); }, { inputMode: 'numeric', placeholder: 'z. B. 900402', autofocus: !e.vermittlernummer }), 's4'),
          D.feld('Name (für Ausdrucke)', text(e.name, function (v) { e.name = v; }), 's5'),
          D.feld('Projektjahr', h('input', { type: 'text', value: p.jahr, disabled: true, title: 'Das Jahr wechseln Sie unten in der Karte „Jahreswechsel"' }), 's3'))),
        h('div.karte', null, h('h3', null, 'Abgleich'), h('div.formraster', { style: { marginTop: '10px' } },
          D.feld('Toleranz Beitrag (€)', zahl(e.toleranzBeitrag, function (v) { e.toleranzBeitrag = Math.abs(v); }), 's3'),
          D.feld('Toleranz Provision (€)', zahl(e.toleranzProvision, function (v) { e.toleranzProvision = Math.abs(v); }), 's3'),
          D.feld('„Offen" nach Tagen', zahl(e.offenTage, function (v) { e.offenTage = Math.max(0, Math.round(v)); }), 's3'),
          D.feld('Status Storno ab % entfallenem Beitrag', zahl(e.stornoSchwelle, function (v) { e.stornoSchwelle = Math.min(100, Math.max(1, v)); }), 's3'),
          h('label.schalter.s12', null, h('input', { type: 'checkbox', checked: !!e.pruefeProvision, onchange: function () { e.pruefeProvision = this.checked; App.geaendert({ still: true }); } }), 'Auch die Provision gegen meine Regeln prüfen (sonst nur den Beitrag)'),
          h('div.feld.s12', null, h('span', null, 'Provisionsarten im Abgleich'), h('div.leiste', null, AB.abrechnung.PROVISIONSARTEN.map(function (a) {
            var an = e.provisionsarten.indexOf(a) >= 0;
            return h('button.chip' + (an ? '.aktiv' : ''), { type: 'button', onclick: function () { if (an) e.provisionsarten = e.provisionsarten.filter(function (x) { return x !== a; }); else e.provisionsarten.push(a); App.geaendert(); } }, a);
          })))))));

      // Bearbeitungsampel
      var slaTb = h('tbody');
      M.BEREICHE.forEach(function (b) {
        var s = e.sla[b.id];
        slaTb.appendChild(h('tr', null, h('td', null, b.name), h('td', { style: { width: '110px' } }, zahl(s.gelb, function (n) { s.gelb = Math.max(0, Math.round(n)); }, { style: { textAlign: 'right' } })),
          h('td', { style: { width: '110px' } }, zahl(s.rot, function (n) { s.rot = Math.max(0, Math.round(n)); }, { style: { textAlign: 'right' } }))));
      });
      // Unternehmeragentur: Agenturist mit Untervermittlern
      (function () {
        var ag = AB.agentur.einstellung(p), uvBox = h('div');
        var zahlF = function (wert, setze, ph) { var i = h('input', { type: 'text', inputMode: 'decimal', value: wert == null ? '' : U.fmtZahl(+wert, 2), placeholder: ph || '', style: { textAlign: 'right', padding: '5px 8px' }, onchange: function () { var v = i.value.trim() === '' ? null : U.parseZahl(i.value); if (v != null && (isNaN(v) || v < 0)) { i.classList.add('fehler'); return; } setze(v); App.geaendert({ still: true }); } }); return i; };
        function zeichneUv() {
          D.leere(uvBox); if (ag.modus !== 'agenturist') return;
          var tb = h('tbody');
          Object.keys(ag.untervermittler).forEach(function (nr) {
            var u = ag.untervermittler[nr];
            tb.appendChild(h('tr', null, h('td', null, h('b', null, nr)), h('td', null, text(u.name, function (v) { u.name = v; }, { placeholder: 'Name', style: { padding: '5px 8px' } })),
              h('td', null, D.auswahl([['mb', 'Monatsbeiträge je Euro Beitrag'], ['prozent', 'Prozent meiner Provision']], u.art || 'mb', function (v) { u.art = v; App.geaendert({ still: true }); }, { style: { padding: '5px 8px' } })),
              h('td', { style: { width: '120px' } }, zahlF(u.wert, function (v) { u.wert = v; }, 'Satz')),
              h('td', { style: { width: '44px' } }, D.btn('', function () { delete ag.untervermittler[nr]; App.geaendert({ still: true }); zeichneUv(); }, { icon: 'x', klasse: 'leise klein-btn', titel: 'Untervermittler entfernen' }))));
          });
          var neuNr = h('input', { type: 'text', inputMode: 'numeric', placeholder: 'Vermittlernummer, z. B. 900385', style: { width: '240px' } });
          D.anhaengen(uvBox, [h('div', { style: { overflowX: 'auto', marginTop: '10px' } }, h('table.einfach', null, h('thead', null, h('tr', null, ['Nummer', 'Name', 'Anspruch gerechnet als', 'Satz', ''].map(function (t) { return h('th', null, t); }))), tb)),
            h('div.leiste', { style: { marginTop: '8px' } }, neuNr, D.btn('Untervermittler hinzufügen', function () { var n = neuNr.value.replace(/\D/g, ''); if (n.length < 5) { neuNr.classList.add('fehler'); return; } if (!ag.untervermittler[n]) ag.untervermittler[n] = { name: '', art: 'mb', wert: null }; App.geaendert({ still: true }); zeichneUv(); }, { klasse: 'klein-btn', icon: 'plus' }))]);
        }
        el.appendChild(h('div.karte', null, h('div.leiste', null, h('h3', null, 'Unternehmeragentur'), h('span.frei'), h('span.marke-s' + (ag.modus ? '.gut' : ''), null, ag.modus === 'agenturist' ? 'Agenturist' : ag.modus === 'untervermittler' ? 'Untervermittler' : 'aus')),
          h('div.unter', null, 'Für Agenturen, in denen der Agenturist die Gesamtabrechnung erhält und seine Untervermittler mit ihm abrechnen.'),
          h('div.formraster', { style: { marginTop: '10px' } }, D.feld('Meine Rolle', D.auswahl(Object.keys(AB.agentur.MODI).map(function (k) { return [k, AB.agentur.MODI[k]]; }), ag.modus || '', function (v) { ag.modus = v; App.geaendert(); }), 's7')),
          ag.modus === 'untervermittler' ? h('p.klein.muted', { style: { marginTop: '8px' } }, 'In der Antragsliste Anträge anhaken und „An Agenturist senden" wählen. Die Prüfdatei enthält Position, Vertragsnummer, Kunde, Tarife, Beitrag und die geforderte Provision nach Ihren Provisionsregeln – keine Bemerkungen.') : null,
          ag.modus === 'agenturist' ? h('p.klein.muted', { style: { marginTop: '8px' } }, 'Legen Sie fest, was jedem Untervermittler laut Vertrag zusteht. Die Prüfdateien lesen Sie über „Einlesen" ein; das Ergebnis steht im Reiter „Agentur".') : null, uvBox));
        zeichneUv();
      })();
      // Jahreswechsel in derselben Datei und Produktionsschluss
      (function () {
        var arch = AB.model.archivJahre(p), naechstes = +p.jahr + 1, schluss = AB.model.produktionsschluss(p, p.jahr);
        var fS = h('input', { type: 'date', value: schluss, onchange: function () { if (App.gesperrt()) return; if (!e.produktionsschluss) e.produktionsschluss = {}; if (fS.value) e.produktionsschluss[p.jahr] = fS.value; else delete e.produktionsschluss[p.jahr]; App.geaendert(); } });
        var wechsle = function (jahr, text) {
          D.frage('Auf das Jahr ' + jahr + ' wechseln?', text, 'Wechseln').then(function (ja) {
            if (!ja || App.gesperrt()) return;
            AB.model.sichere(p, 'Vor Jahreswechsel ' + p.jahr + ' → ' + jahr); AB.model.jahreswechsel(p, jahr);
            App.zeilen = AB.abrechnung.entpacke(p.abrechnung); App.wuerfel = null; App.wuerfelEigen = null; App.geaendert(); D.toast('Das Projekt steht jetzt auf dem Jahr ' + jahr + '.');
          });
        };
        el.appendChild(h('div.karte', null, h('div.leiste', null, h('h3', null, 'Jahreswechsel'), h('span.frei'), h('span.marke-s', null, 'Projektjahr ' + p.jahr)),
          h('div.unter', null, 'Sie arbeiten in derselben Datei weiter. Beim Wechsel wandern Abrechnung, Teamdaten und Bonus-Werte des Jahres ins Archiv, die Vorjahreswerte stehen für die Planung bereit, alle Anträge bleiben erhalten.'),
          h('div.formraster', { style: { marginTop: '10px' } },
            D.feld('Produktionsschluss ' + p.jahr, fS, 's3'),
            h('div.feld.s9', null, h('span', null, 'Was zählt in welchem Jahr?'), h('span.klein.muted', null, 'Was bis zum Produktionsschluss policiert oder abgerechnet ist, zählt im laufenden Jahr – auch mit Beginn 1.1. des Folgejahres. Später Verarbeitetes, später Eingereichtes und Anträge mit Beginn ab dem 2. Januar zählen im Folgejahr. Offene Anträge ziehen beim Wechsel mit.'))),
          h('div.leiste', { style: { marginTop: '10px' } },
            D.btn('Neues Jahr ' + naechstes + ' beginnen', function () { wechsle(naechstes, 'Die Abrechnung ' + p.jahr + ' wird archiviert und als Vorjahr für die Planung festgehalten. Offene Anträge ziehen ins Jahr ' + naechstes + ' mit, abgerechnete bleiben im Jahr ' + p.jahr + '. Sie können jederzeit ins Jahr ' + p.jahr + ' zurückwechseln. Vorher wird ein Sicherungsstand angelegt.'); }, { klasse: arch.indexOf(naechstes) >= 0 ? '' : 'haupt-btn' }),
            arch.map(function (j) { return D.btn('Jahr ' + j + ' öffnen', function () { wechsle(j, 'Das Jahr ' + p.jahr + ' wird archiviert und das Jahr ' + j + ' mit seiner Abrechnung wieder geöffnet.'); }, { klasse: 'leise' }); }),
            h('span.frei'), arch.length ? h('span.muted.klein', null, 'Im Archiv: ' + arch.join(', ')) : null)));
      })();
      // Ohne Vermittlernummer steht der Cursor gleich im Feld (das autofocus-Attribut greift nach dem Starthinweis nicht mehr zuverlässig)
      if (!e.vermittlernummer) setTimeout(function () { var f = el.querySelector('input[placeholder="z. B. 900402"]'); if (f && !document.querySelector('dialog[open]')) f.focus(); }, 0);
      // Akzentfarbe: Auswahl ändert zuerst nur die Vorschau; erst „Übernehmen" schaltet das Programm um
      (function () {
        var AK = AB.akzent, aktiv = AK.lade(), entwurf = JSON.parse(JSON.stringify(aktiv));
        var felder = h('div.akz-felder'), reihe = h('div.akz-reihe'), text = h('span.muted.klein'), vor = h('div.vorschau');
        var navBsp = [['uebersicht', 'Übersicht'], ['antraege', 'Anträge'], ['abgleich', 'Abgleich'], ['aktionen', 'Aktionen'], ['team', 'Team'], ['bonus', 'Bonus']];
        D.anhaengen(vor, [h('div.nav', null, navBsp.map(function (n, i) { return h('button' + (i === 1 ? '.aktiv' : ''), { type: 'button', tabIndex: -1 }, D.icon(AB.ansichten[n[0]].icon), n[1], i === 2 ? h('span.zahl', null, '3') : null); })),
          h('div.v-rechts', null, h('div.raster.r-3', null,
            h('div.karte.kachel.akzent', null, h('div.lbl', null, 'Anträge'), h('div.wert', null, h('span.num', null, '17'))),
            h('div.karte.kachel', null, h('div.lbl', null, 'Brutto'), h('div.wert', null, h('span.num', null, '1.626'), h('small', null, '€'))),
            h('div.karte.kachel', null, h('div.lbl', null, 'Netto'), h('div.wert', null, h('span.num', null, '1.051'), h('small', null, '€')))),
            h('div.leiste', null, h('button.btn.haupt-btn', { type: 'button', tabIndex: -1, style: { pointerEvents: 'none' } }, 'Neuer Antrag'), h('span.chip.aktiv', null, 'Auswahl'), h('span.marke-s', null, 'Markierung'), h('a', { style: { color: 'var(--accent)', fontWeight: 600 } }, 'Verweis')))]);
        var gleich = function () { return JSON.stringify(entwurf) === JSON.stringify(aktiv); };
        var uebernehmen = D.btn('Übernehmen', function () { aktiv = JSON.parse(JSON.stringify(entwurf)); AK.speichere(aktiv); AK.wende(aktiv); zeichne(); D.toast('Akzentfarbe übernommen.'); }, { klasse: 'haupt-btn' });
        function zeichne() {
          D.leere(felder); D.leere(reihe);
          felder.appendChild(h('button.akz-feld' + (entwurf.modus === 'standard' ? '.gewaehlt' : ''), { type: 'button', title: 'Standard (Lila)', 'aria-label': 'Standard (Lila)', style: { background: '#6250d6' }, onclick: function () { entwurf = { modus: 'standard' }; zeichne(); } }));
          AK.EINZEL.forEach(function (f) { felder.appendChild(h('button.akz-feld' + (entwurf.modus === 'einzel' && entwurf.farbe === f[1] ? '.gewaehlt' : ''), { type: 'button', title: f[0], 'aria-label': f[0], style: { background: f[1] }, onclick: function () { entwurf = { modus: 'einzel', farbe: f[1] }; zeichne(); } })); });
          if (entwurf.modus === 'multi') entwurf.farben.forEach(function (f) { reihe.appendChild(h('i', { title: AK.name(f), style: { background: f } })); });
          text.textContent = entwurf.modus === 'multi' ? entwurf.farben.map(AK.name).join(' → ') : entwurf.modus === 'einzel' ? AK.name(entwurf.farbe) : 'Standard (Lila)';
          AK.wende(entwurf, vor); uebernehmen.disabled = gleich();
        }
        el.appendChild(h('div.karte', null, h('div.leiste', null, h('h3', null, 'Akzentfarbe'), h('span.frei'), h('span.marke-s', null, aktiv.modus === 'multi' ? 'Multicolor' : aktiv.modus === 'einzel' ? AK.name(aktiv.farbe) : 'Standard')),
          h('div.unter', null, 'Farbe für Knöpfe, Markierungen und Menü. Die Auswahl ändert zuerst nur die Vorschau; erst „Übernehmen" schaltet das Programm um. Produktfarben und Ampel bleiben gleich. Gilt für diesen Browser.'),
          h('div.leiste', { style: { margin: '10px 0' } }, felder, D.btn('Multicolor würfeln', function () { entwurf = { modus: 'multi', farben: AK.wuerfle() }; zeichne(); }, { icon: 'funke', titel: 'Jeder Klick schlägt eine neue Farbserie vor' }), reihe),
          vor,
          h('div.leiste', { style: { marginTop: '10px' } }, text, h('span.frei'), D.btn('Verwerfen', function () { entwurf = JSON.parse(JSON.stringify(aktiv)); zeichne(); }, { klasse: 'leise' }), uebernehmen)));
        zeichne();
      })();
      // Grundvergütung nach Karrierestufe
      if (!e.grundverguetung) e.grundverguetung = { stufe: '', betrag: null, tabelle: {} };
      var gv = e.grundverguetung, gvStand = AB.model.grundverguetung(p, 0); if (!gv.tabelle) gv.tabelle = {};
      var leerZahl = function (wert, setze, ph) { var i = h('input', { type: 'text', inputMode: 'decimal', value: wert == null || wert === '' ? '' : U.fmtZahl(+wert, 2), placeholder: ph || '', style: { textAlign: 'right' }, onchange: function () {
        var v = i.value.trim() === '' ? null : U.parseZahl(i.value); if (v != null && (isNaN(v) || v < 0)) { i.classList.add('fehler'); return; } setze(v); App.geaendert(); } }); return i; };
      var KS = AB.model.KARRIERE;
      el.appendChild(h('div.karte', null, h('div.leiste', null, h('h3', null, 'Karrierestufe und Grundvergütung'), h('span.frei'), h('span.marke-s' + (gvStand.gesetzt ? '.gut' : ''), null, gvStand.gesetzt ? (gvStand.kurz ? gvStand.kurz + ' · ' : '') + U.fmtEuro(gvStand.jeMonat) + ' je Monat' + (gvStand.manuell ? ' (von Hand)' : '') : 'nicht gewählt')),
        h('div.unter', null, 'Karrieresystem „Gesundprofi im Außendienst". Das Fixum erscheint in der Übersicht zusammen mit der abgerechneten Provision.'),
        h('div.formraster', { style: { marginTop: '10px' } },
          D.feld('Meine Karrierestufe', D.auswahl([['', '– bitte wählen –']].concat(KS.map(function (s) { return [s.id, 'Stufe ' + s.id + ' · ' + s.kurz + ' · ' + s.name]; })), gv.stufe || '', function (v) {
            gv.stufe = v; var ks = KS.find(function (x) { return x.id === v; }); if (ks && p.bonus) p.bonus.stufe = ks.bonus; App.geaendert(); }), 's5'),
          D.feld('Abweichendes Fixum je Monat (€)', leerZahl(gv.betrag, function (v) { gv.betrag = v; }, 'leer = laut Stufe'), 's4'),
          h('div.feld.s3', null, h('span', null, 'Provisionsregeln'), D.btn('Sätze der Stufe übernehmen', function () {
            var ks = KS.find(function (x) { return x.id === gv.stufe; }); if (!ks) { D.toast('Bitte zuerst die Karrierestufe wählen.', { krit: true }); return; }
            D.frage('Provisionsregeln auf Stufe ' + ks.kurz + ' setzen?', 'Die Regeltabelle wird nach den Provisionsrichtlinien neu belegt: Krankenversicherung ' + U.fmtZahl(ks.mb, 1) + ' MB, Pflegepflicht 2 MB, Leben 30 ‰ der Wertungssumme, Unfall 20 % laufend, mhplus-Mitgliedschaft 100 € je Mitglied, Umstellung ohne Provision. Eigene Änderungen an den Regeln gehen verloren; vorher wird ein Sicherungsstand angelegt.', 'Übernehmen').then(function (ja) {
              if (!ja || App.gesperrt()) return; AB.model.sichere(p, 'Vor Übernahme der Provisionssätze Stufe ' + ks.kurz); p.regeln = AB.provision.regelnNachStufe(ks.mb); App.geaendert(); D.toast('Provisionsregeln auf ' + U.fmtZahl(ks.mb, 1) + ' MB gesetzt.'); });
          }, { titel: 'Regeltabelle nach Karrierestufe und Provisionsrichtlinien belegen' }))),
        h('div', { style: { overflowX: 'auto', marginTop: '10px' } }, h('table.einfach', null, h('thead', null, h('tr', null, ['Stufe', 'Bezeichnung', 'Fixum je Monat', 'Wertung', 'Provision freies Geschäft'].map(function (t, i) { return h('th', { style: i >= 2 ? { textAlign: 'right' } : null }, t); }))),
          h('tbody', null, KS.slice().reverse().map(function (s) { return h('tr', gv.stufe === s.id ? { style: { fontWeight: 700, background: 'var(--accent-soft)' } } : null, h('td', null, s.id + ' · ' + s.kurz), h('td', null, s.name),
            h('td', { style: { textAlign: 'right', width: '150px' } }, leerZahl(gv.tabelle[s.id], function (v) { gv.tabelle[s.id] = v; }, U.fmtZahl(s.fixum, 0))), h('td.num', { style: { textAlign: 'right' } }, s.wertung), h('td.num', { style: { textAlign: 'right' } }, U.fmtZahl(s.mb, 1) + ' MB')); })))),
        h('p.mini', { style: { marginTop: '8px' } }, 'Die Beträge stammen aus dem Karrieresystem der SDK und lassen sich je Stufe überschreiben. Bei Geschäft über die Bestands-Bank gilt die Provision des freien Geschäfts abzüglich 1 MB, bei aktiver Bank 3 MB. Die gewählte Stufe wird auch für den Bonus-Rechner übernommen.')));
      el.appendChild(h('div.karte', null, h('h3', null, 'Bearbeitungsampel (Service-Level)'),
        h('div.unter', null, 'Werktage seit Einreichung, bis ein noch nicht policierter Antrag gelb bzw. rot wird. Wochenenden und bundesweite Feiertage zählen nicht. Eine offene Nachbearbeitung ist immer rot.'),
        h('div.raster.r-2', null, h('table.einfach', null, h('thead', null, h('tr', null, ['Bereich', 'Gelb ab Werktag', 'Rot ab Werktag'].map(function (t) { return h('th', null, t); }))), slaTb),
          h('div', null, D.feld('Abrechnung kommt am … des Monats', zahl(e.abrechnungTag, function (n) { e.abrechnungTag = Math.min(28, Math.max(1, Math.round(n))); }, { style: { width: '110px' } })),
            h('p.mini', null, 'Ab diesem Tag erinnert die App daran, die neue Abrechnung einzulesen. Policierte Anträge werden erst gelb, wenn die Abrechnung des Folgemonats ohne Buchung vorliegen müsste.')))));

      // Provisionsregeln
      var regelBox = h('div');
      M.BEREICHE.forEach(function (b, bi) {
        var tb = h('tbody');
        M.VORGAENGE.forEach(function (v) {
          var r = p.regeln[b.id + '|' + v.id], einheit = h('td.mini');
          var setzeEinheit = function () { einheit.textContent = (AB.provision.ARTEN.find(function (a) { return a.id === r.art; }) || {}).einheit || ''; };
          setzeEinheit();
          tb.appendChild(h('tr', null, h('td', { style: { width: '26%' } }, v.name),
            h('td', { style: { width: '36%' } }, D.auswahl(AB.provision.ARTEN.map(function (a) { return [a.id, a.name]; }), r.art, function (w) { r.art = w; setzeEinheit(); App.geaendert({ still: true }); })),
            h('td', { style: { width: '14%' } }, zahl(r.wert, function (n) { r.wert = n; }, { style: { textAlign: 'right' } })), einheit));
        });
        var erste = p.regeln[b.id + '|neu'];
        regelBox.appendChild(h('details', bi === 0 ? { open: true } : null, h('summary', null, b.name, h('span.mini', { style: { marginLeft: '10px', fontWeight: 400 } }, 'Neu: ' + U.fmtZahl(erste.wert, 2) + ' ' + ((AB.provision.ARTEN.find(function (a) { return a.id === erste.art; }) || {}).einheit || ''))),
          h('table.einfach', { style: { maxWidth: '820px', marginBottom: '8px' } }, h('thead', null, h('tr', null, ['Vorgangsart', 'Berechnungsart', 'Faktor / Satz', 'Einheit'].map(function (t) { return h('th', null, t); }))), tb)));
      });
      el.appendChild(h('div.karte', null, h('div.leiste', null, h('h3', null, 'Provisionsregeln'), h('span.frei'),
        D.btn('Beispielwerte wiederherstellen', function () { D.frage('Regeln zurücksetzen?', 'Alle Faktoren werden auf die Beispiel-Startwerte gesetzt (5,5 / 4,5 / 3 / 2,8 / 1,5 Monatsbeiträge).', 'Zurücksetzen').then(function (ja) { if (ja) { p.regeln = AB.provision.standardRegeln(); App.geaendert(); } }); }, { klasse: 'klein-btn leise' })),
        h('div.unter', null, 'Bereich × Vorgangsart → Faktor und Berechnungsart. Die Startwerte sind Beispiele – bitte an Ihre Karrierestufe anpassen. Pflegepflicht erfassen Sie als eigene Position mit Bereich „Pflege". Die Bank-Teilung wird je Antrag abgezogen.'), regelBox));

      // Tarifliste
      var tSuche = h('input', { type: 'search', placeholder: 'Tarif suchen …', value: z.tsuche || '', oninput: function () { z.tsuche = tSuche.value; zeichneTarife(); } }), tListe = h('div.leiste', { style: { maxHeight: '170px', overflow: 'auto', alignItems: 'flex-start' } });
      var tNeu = h('input', { type: 'text', placeholder: 'Neuer Tarif', style: { width: '170px' }, onkeydown: function (ev) { if (ev.key === 'Enter') hinzu(); } });
      function hinzu() { if (tNeu.value.trim() && M.erweitereTarife(p, [{ name: tNeu.value.trim() }], 'manuell')) { tNeu.value = ''; App.geaendert({ still: true }); zeichneTarife(); } tNeu.focus(); }
      function zeichneTarife() {
        var q = U.falte(z.tsuche || ''); D.leere(tListe);
        var treffer = p.tarife.filter(function (t) { return !q || U.falte(t.name + ' ' + t.gruppe).indexOf(q) >= 0; });
        treffer.slice(0, 300).forEach(function (t) {
          tListe.appendChild(h('span.chip', { title: (AB.tarif.text(t.name, t.gruppe) || 'ohne Tarifgruppe') + ' · ' + (t.quelle === 'abrechnung' ? 'aus Abrechnung' : 'manuell'), style: { cursor: 'default' } }, t.name,
            h('button', { type: 'button', style: { all: 'unset', cursor: 'pointer', color: 'var(--text-3)' }, title: 'Entfernen', onclick: function () { p.tarife = p.tarife.filter(function (x) { return x !== t; }); App.geaendert({ still: true }); zeichneTarife(); } }, '×')));
        });
        if (treffer.length > 300) tListe.appendChild(h('span.mini', null, '… und ' + (treffer.length - 300) + ' weitere'));
        if (!treffer.length) tListe.appendChild(h('span.muted.klein', null, 'Keine Tarife. Die Liste füllt sich automatisch aus importierten Abrechnungen und erfassten Anträgen.'));
      }
      zeichneTarife();
      el.appendChild(h('div.karte', null, h('div.leiste', null, h('h3', null, 'Tarifliste (' + p.tarife.length + ')'), h('span.frei'), h('div.suche', { style: { maxWidth: '240px' } }, D.icon('suche'), tSuche), tNeu, D.btn('Hinzufügen', hinzu, { klasse: 'klein-btn', icon: 'plus' })),
        h('div.unter', null, 'Vorschläge für das Feld „Tarif" in der Antragsmaske. Freitext bleibt immer möglich.'), tListe));

      // Ordner + Datei + Sicherungen
      var ordnerText = h('span.muted.klein', null, '…'), ordnerBtns = h('div.leiste');
      Sp.ordnerStatus(p).then(function (st) {
        D.leere(ordnerBtns);
        if (!Sp.ordnerMoeglich) { ordnerText.textContent = 'Dieser Browser unterstützt keine Ordner-Überwachung (Edge oder Chrome verwenden). Dateien können Sie jederzeit ins Fenster ziehen.'; return; }
        ordnerText.textContent = st === 'kein' ? 'Kein Ordner verbunden. Wählen Sie den Ordner, in dem Sie Abrechnungen und Monatsscheiben ablegen – neue Dateien werden beim Öffnen und bei jedem Wechsel ins Fenster automatisch eingelesen.'
          : st === 'verbunden' ? 'Verbunden mit „' + Sp.ordner.name + '". Neue CSV-/Excel-Dateien werden automatisch erkannt und eingelesen.' : 'Ordner „' + Sp.ordner.name + '" ist gemerkt – der Browser verlangt nach jedem Neustart eine kurze Bestätigung.';
        D.anhaengen(ordnerBtns, [
          D.btn(st === 'kein' ? 'Ordner verbinden' : 'Anderen Ordner wählen', function () { Sp.verbindeOrdner(p).then(function (n) { D.toast('Ordner „' + n + '" verbunden.'); return App.pruefeOrdner(true); }).then(function () { App.zeige('einstellungen'); }).catch(function (err) { if (err.name !== 'AbortError') D.toast(err.message, { krit: true }); }); }, { icon: 'ordner', klasse: st === 'kein' ? 'haupt-btn' : '' }),
          st !== 'kein' ? D.btn(st === 'erlaubnis' ? 'Zugriff bestätigen und prüfen' : 'Jetzt prüfen', function () { App.pruefeOrdner(true).then(function () { App.zeige('einstellungen'); }); }, { klasse: st === 'erlaubnis' ? 'haupt-btn' : '' }) : null,
          st !== 'kein' ? D.btn('Trennen', function () { Sp.trenneOrdner(p).then(function () { App.zeige('einstellungen'); }); }, { klasse: 'leise' }) : null]);
      });
      var sb = h('tbody');
      p.sicherungen.slice().reverse().forEach(function (s) {
        sb.appendChild(h('tr', null, h('td', null, new Date(s.am).toLocaleString('de-DE')), h('td', null, s.anlass), h('td.num', null, s.antraege + ' Anträge'),
          h('td', { style: { textAlign: 'right' } }, D.btn('Wiederherstellen', function () { D.frage('Sicherungsstand wiederherstellen?', 'Anträge, Zuordnungen und Einstellungen werden auf den Stand vom ' + new Date(s.am).toLocaleString('de-DE') + ' zurückgesetzt. Der jetzige Stand wird vorher gesichert.', 'Wiederherstellen').then(function (ja) { if (ja) { M.stelleWiederHer(p, s.id); App.geaendert(); D.toast('Sicherungsstand wiederhergestellt.'); } }); }, { klasse: 'klein-btn' }))));
      });
      el.appendChild(h('div.raster.r-2', null,
        h('div.karte', null, h('h3', null, 'Import-Ordner'), h('div', { style: { margin: '6px 0 10px' } }, ordnerText), ordnerBtns),
        h('div.karte', null, h('h3', null, 'Projektdatei'), h('div.muted.klein', { style: { margin: '6px 0 10px' } }, Sp.handle ? 'Automatisches Speichern in „' + Sp.dateiname + '". Zusätzlich liegt ein Spiegel im Browser.' : 'Das Projekt ist nur im Browser gesichert. Verbinden Sie es mit einer Datei oder laden Sie regelmäßig eine Kopie herunter.'),
          h('div.leiste', null, !Sp.handle && Sp.fsa ? D.btn('In Datei speichern …', function () { Sp.neuDatei(p).then(function (ok) { if (ok) { Sp.uebernimm(p, Sp.handle, Sp.dateiname); Sp.plane(p); App.zeige('einstellungen'); } }).catch(function (err) { if (err.name !== 'AbortError') D.toast(err.message, { krit: true }); }); }, { klasse: 'haupt-btn' }) : null,
            D.btn('Kopie herunterladen', function () { Sp.ladeHerunter(p); }, { icon: 'runter' }), D.btn('Projekt schließen', function () { Sp.jetzt().then(App.schliesse); }, { klasse: 'leise', titel: 'Speichert und schließt – bei Passwortschutz ist danach wieder das Passwort nötig' })))));
      var lcfg = App.lizenzConfig();
      if (lcfg.pub) {
        var l = App.lizenz, lFeld = h('textarea', { rows: 3, placeholder: 'AB1-…', value: l.schluessel || '', spellcheck: false, style: { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '12.5px' } });
        var uebernimm = function () {
          var key = lFeld.value.replace(/\s+/g, '');
          try { localStorage.setItem('antragsbuch-lizenz', key); } catch (err) { /* privat */ }
          App.nurLesen = false; p.einstellungen.lizenz = key;
          App.pruefeLizenz().then(function () {
            if (!App.nurLesen) Sp.plane(p);
            D.toast(App.lizenz.text || 'Lizenz geprüft.', { krit: App.lizenz.modus === 'ungueltig' || App.lizenz.nurLesen });
            App.zeige('einstellungen');
          });
        };
        var lk = h('div.karte', null, h('div.leiste', null, h('h3', null, 'Lizenz'), h('span.marke-s' + (l.modus === 'gueltig' ? '.gut' : l.nurLesen || l.modus === 'ungueltig' ? '.krit' : '.warn'), null,
            { gueltig: 'gültig', warnung: 'läuft bald ab', kulanz: 'abgelaufen – Kulanz', test: 'Testzeitraum', abgelaufen: 'abgelaufen', ungueltig: 'ungültig', fehlt: 'fehlt' }[l.modus] || l.modus),
            l.name ? h('span.muted.klein', null, 'ausgestellt für ' + l.name + (l.nr ? ' (' + l.nr + ')' : '')) : null),
          h('div.muted.klein', { style: { margin: '6px 0 10px' } }, l.text + (lcfg.inhaber ? ' Neue Schlüssel erhalten Sie von ' + lcfg.inhaber + '.' : '')),
          D.feld('Lizenzschlüssel', lFeld), h('div.leiste', { style: { marginTop: '8px' } }, D.btn('Schlüssel übernehmen', uebernimm, { klasse: 'haupt-btn' }),
            h('span.mini', null, 'Der Schlüssel gilt für die Vermittlernummer, auf die er ausgestellt wurde. Ihre Daten bleiben auch ohne gültigen Schlüssel erhalten und exportierbar.')));
        el.appendChild(lk);
        if (z.zuLizenz) { z.zuLizenz = false; setTimeout(function () { lk.scrollIntoView({ block: 'center' }); lFeld.focus(); }, 50); }
      }
      var geschuetzt = !!Sp.schluessel;
      function setzePasswort() {
        D.passwort(geschuetzt ? 'Passwort ändern' : 'Passwortschutz einschalten',
          h('div', null, h('p.muted', { style: { margin: '0 0 8px' } }, 'Die Projektdatei und die Sicherung im Browser werden mit diesem Passwort verschlüsselt (AES-256). Beim Öffnen wird es abgefragt.'),
            h('div.meldung.warn', null, h('b', null, 'Wichtig: '), 'Es gibt keine Hintertür. Ohne Passwort sind die Daten nicht wiederherstellbar – auch nicht durch den Ersteller der App. Bitte sicher notieren.')),
          { neu: true, ja: geschuetzt ? 'Passwort ändern' : 'Schutz einschalten' }).then(function (pw) {
          if (pw == null) return;
          return AB.krypto.schluessel(pw).then(function (s) { Sp.schluessel = s; Sp.plane(p); App.zeige('einstellungen'); D.toast('Passwortschutz ist aktiv. Die Projektdatei wird ab jetzt verschlüsselt gespeichert.'); });
        }).catch(function (err) { D.toast(err.message, { krit: true }); });
      }
      el.appendChild(h('div.karte', null, h('div.leiste', null, h('h3', null, 'Passwortschutz'), h('span.marke-s' + (geschuetzt ? '.gut' : '.warn'), null, geschuetzt ? 'aktiv' : 'aus')),
        h('div.muted.klein', { style: { margin: '6px 0 10px' } }, geschuetzt ? 'Projektdatei und Browser-Sicherung sind verschlüsselt. Wer die Datei findet oder weitergeschickt bekommt, kann sie ohne Passwort nicht lesen. Exporte (Excel, PDF) sind nicht geschützt.'
          : 'Die Projektdatei ist lesbar gespeichert. Mit einem Passwort schützen Sie die Kundendaten, falls der Rechner verloren geht oder die Datei in falsche Hände gerät.'),
        !AB.krypto.verfuegbar() ? h('div.meldung.warn', null, 'Dieser Browser unterstützt die Verschlüsselung nicht. Bitte Edge oder Chrome verwenden.')
          : h('div.leiste', null, D.btn(geschuetzt ? 'Passwort ändern' : 'Passwortschutz einschalten', setzePasswort, { klasse: geschuetzt ? '' : 'haupt-btn' }),
            geschuetzt ? D.btn('Schutz aufheben', function () { D.frage('Passwortschutz aufheben?', 'Die Projektdatei wird danach wieder unverschlüsselt gespeichert.', 'Schutz aufheben', { gefahr: true }).then(function (ja) { if (ja) { Sp.schluessel = null; Sp.plane(p); App.zeige('einstellungen'); } }); }, { klasse: 'leise gefahr' }) : null)));
      el.appendChild(h('div.karte', null, h('h3', null, 'Sicherungsstände'), h('div.unter', null, 'Vor jedem Import wird automatisch ein Stand angelegt; die letzten 10 bleiben im Projekt. Gesichert werden Anträge, Zuordnungen und Einstellungen (die Abrechnung lässt sich jederzeit neu einlesen).'),
        p.sicherungen.length ? h('table.einfach', null, sb) : h('div.muted.klein', null, 'Noch keine Sicherungsstände.')));
    } };
})(globalThis.AB = globalThis.AB || {});
