/* Antragsbuch – App-Rahmen: Zustand, Navigation, Import-Weiche, Neuberechnung. */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h, U = AB.util, M = AB.model, Sp = AB.speicher;
  var App = AB.app = { p: null, zeilen: [], erg: null, kz: null, ansicht: 'uebersicht', zustand: {}, wuerfel: null };
  AB.ansichten = AB.ansichten || {};
  var REIHENFOLGE = ['uebersicht', 'antraege', 'abgleich', 'vdienst', 'aktionen', 'analyse', 'produktion', 'banken', 'agentur', 'team', 'bonus', 'einstellungen', 'hilfe'];

  // ---------- Worker ----------
  var worker = null, offen = {}, zaehler = 0;
  function starteWorker() {
    try {
      var quelle = document.getElementById('kern').textContent + '\n' + document.getElementById('worker').textContent;
      worker = new Worker(URL.createObjectURL(new Blob([quelle], { type: 'text/javascript' })));
      worker.onmessage = function (e) { var o = offen[e.data.id]; delete offen[e.data.id]; if (o) e.data.ok ? o[0](e.data.ergebnis) : o[1](new Error(e.data.fehler)); };
      worker.onerror = function (e) { console.warn('Worker-Fehler, weiche auf Hauptfaden aus:', e.message); worker = null; Object.keys(offen).forEach(function (k) { offen[k][1](new Error('Die Datei konnte nicht verarbeitet werden.')); }); offen = {}; };
    } catch (e) { worker = null; }
  }
  App.mitWorker = function () { return !!worker; };
  App.lies = function (bytes, name, opt) {
    if (!worker) return AB.importer.lies(bytes, name, opt);
    return new Promise(function (res, rej) {
      var id = ++zaehler; offen[id] = [res, rej];
      var kopie = bytes.slice().buffer;
      worker.postMessage({ id: id, bytes: kopie, name: name, opt: opt }, [kopie]);
    });
  };

  // ---------- Projekt ----------
  App.oeffne = function (roh, handle, name) {
    var p = M.migriere(roh);
    if (!p.einstellungen.modus) p.einstellungen.modus = 'adp';
    if (!p.ordnerGesehen) p.ordnerGesehen = {};
    App.p = p; App.zeilen = AB.abrechnung.entpacke(p.abrechnung); App.wuerfel = null; App.zustand = {};
    Sp.uebernimm(p, handle, name);
    App.rechne();
    document.body.classList.add('offen');
    App.zeige('uebersicht');
    App.pruefeLizenz();
    App.pruefeOrdner(false);
    if (AB.tour) AB.tour.biete();
  };
  // ---------- Lizenz ----------
  App.lizenzConfig = function () { try { return JSON.parse(document.getElementById('lizenz').textContent || '{}'); } catch (e) { return {}; } };
  function ersterStart(p) {
    var lokal = ''; try { lokal = localStorage.getItem('antragsbuch-erststart') || ''; if (!lokal) { lokal = U.heute(); localStorage.setItem('antragsbuch-erststart', lokal); } } catch (e) { /* privat */ }
    var proj = (p.erstellt || '').slice(0, 10);
    return lokal && proj ? (lokal < proj ? lokal : proj) : (lokal || proj || U.heute());
  }
  App.lizenz = { modus: 'frei', nurLesen: false, text: '' }; App.nurLesen = false;
  App.pruefeLizenz = async function () {
    var p = App.p, cfg = App.lizenzConfig();
    if (!p) return;
    var key = p.einstellungen.lizenz || '';
    if (!key) { try { key = localStorage.getItem('antragsbuch-lizenz') || ''; } catch (e) { /* privat */ } }
    App.lizenz = await AB.lizenz.pruefe(cfg, key, p.einstellungen.vermittlernummer, U.heute(), ersterStart(p));
    App.lizenz.schluessel = key;
    var vorher = App.nurLesen; App.nurLesen = !!App.lizenz.nurLesen;
    if (App.nurLesen) App.letzterStand = Sp.serialisiere(p); else App.letzterStand = null;
    zeigeLizenz();
    if (vorher !== App.nurLesen && App.ansicht) App.zeige(App.ansicht);
  };
  function zeigeLizenz() {
    var el = document.getElementById('lizenzleiste'), l = App.lizenz;
    var zeigen = App.p && (l.modus === 'test' || l.modus === 'warnung' || l.modus === 'kulanz' || l.nurLesen);
    el.hidden = !zeigen; if (!zeigen) return;
    el.className = l.nurLesen ? 'krit' : '';
    D.leere(el); D.anhaengen(el, [h('b', null, l.nurLesen ? 'Lesemodus' : l.modus === 'test' ? 'Testversion' : 'Lizenz'), h('span', { style: { flex: 1 } }, l.text),
      D.btn(l.modus === 'test' || l.nurLesen ? 'Schlüssel eintragen' : 'Verlängern', function () { App.zeige('einstellungen', { zuLizenz: true }); }, { klasse: 'klein-btn' })]);
  }
  /** true, wenn im Lesemodus – zeigt dann einen Hinweis. Vor jeder Änderung aufrufen. */
  App.gesperrt = function () {
    if (!App.nurLesen) return false;
    D.toast('Lesemodus: ' + (App.lizenz.modus === 'abgelaufen' ? 'Die Lizenz ist abgelaufen.' : 'Es fehlt ein gültiger Lizenzschlüssel.') + ' Ansehen und Exportieren geht weiter.', { krit: true, aktion: ['Schlüssel eintragen', function () { App.zeige('einstellungen', { zuLizenz: true }); }] });
    return true;
  };

  App.schliesse = function () { App.nurLesen = false; App.letzterStand = null; document.getElementById('lizenzleiste').hidden = true; App.p = null; App.zeilen = []; App.erg = null; Sp.schliesse(); document.body.classList.remove('offen'); App.zeige('start'); };
  App.rechne = function () {
    var p = App.p; if (!p) return;
    AB.model.vergibNummern(p);
    App.erg = AB.abgleich.rechne(p, App.zeilen);
    if (AB.abgleich.wendeStatusAn(p, App.erg)) App.erg = AB.abgleich.rechne(p, App.zeilen);
    var geschlossen = AB.abgleich.schliesseReklamationen(p, App.erg);
    if (geschlossen) setTimeout(function () { D.toast(geschlossen + (geschlossen === 1 ? ' Reklamation wurde' : ' Reklamationen wurden') + ' durch eine Korrekturbuchung erledigt.'); }, 300);
    App.kz = AB.kennzahlen.rechne(p, App.erg, App.zeilen);
  };
  /** Nach jeder Änderung: neu rechnen, speichern, Ansicht auffrischen. */
  App.geaendert = function (opt) {
    opt = opt || {};
    if (App.nurLesen && App.letzterStand) { // Lesemodus: Änderung verwerfen und den gespeicherten Stand wiederherstellen
      App.p = M.migriere(JSON.parse(App.letzterStand)); App.zeilen = AB.abrechnung.entpacke(App.p.abrechnung); App.wuerfel = null;
      App.rechne(); App.gesperrt(); App.zeige(App.ansicht); return;
    }
    if (!opt.ohneRechnen) App.rechne();
    Sp.plane(App.p);
    if (!opt.still) App.zeige(App.ansicht);
    else zeichneNav();
  };
  App.modus = function () { return App.p ? App.p.einstellungen.modus : 'adp'; };

  // ---------- Navigation ----------
  function zeichneNav() {
    var nav = D.leere(document.getElementById('nav'));
    if (!App.p) return;
    REIHENFOLGE.forEach(function (id) {
      var a = AB.ansichten[id]; if (!a || (a.sichtbar && !a.sichtbar())) return;
      var zahl = id === 'abgleich' && App.erg ? App.erg.abweichung.length + App.erg.vorschlaege.length : 0;
      nav.appendChild(h('button' + (App.ansicht === id ? '.aktiv' : ''), { type: 'button', onclick: function () { App.zeige(id); } },
        D.icon(a.icon), a.nav || (typeof a.titel === 'function' ? a.titel() : a.titel), zahl ? h('span.zahl', null, zahl) : null));
    });
    document.getElementById('projektname').textContent = Sp.dateiname || ('Antragsbuch ' + App.p.jahr);
  }
  App.zeige = function (id, param) {
    if (!App.p && id !== 'start') id = 'start';
    var a = AB.ansichten[id]; if (!a) return;
    var gleich = App.ansicht === id, rollY = document.getElementById('inhalt').scrollTop, rollen = [];
    if (gleich) Array.prototype.forEach.call(document.querySelectorAll('#inhalt [data-rollen]'), function (e) { rollen.push([e.getAttribute('data-rollen'), e.scrollTop]); });
    App.ansicht = id;
    if (param) App.zustand[id] = Object.assign(App.zustand[id] || {}, param);
    var inhalt = D.leere(document.getElementById('inhalt')), aktionen = D.leere(document.getElementById('aktionen'));
    inhalt.className = 'inhalt' + (a.fest ? ' fest' : '');
    document.getElementById('titel').textContent = typeof a.titel === 'function' ? a.titel() : a.titel;
    document.getElementById('untertitel').textContent = typeof a.unter === 'function' ? a.unter() : (a.unter || '');
    zeichneNav(); zeichneKopf();
    document.getElementById('tipp').classList.remove('an');
    a.zeige(inhalt, aktionen, App.zustand[id] = App.zustand[id] || {});
    // Wird dieselbe Ansicht neu gezeichnet (Haken gesetzt, Filter geändert), bleibt die Stelle stehen, an der man war.
    if (gleich) {
      rollen.forEach(function (r) { var e = document.querySelector('#inhalt [data-rollen="' + r[0] + '"]'); if (e) e.scrollTop = r[1]; });
      inhalt.scrollTop = rollY; requestAnimationFrame(function () { inhalt.scrollTop = rollY; });
    }
  };
  function zeichneKopf() {
    var box = D.leere(document.getElementById('schalter'));
    if (App.p) box.appendChild(D.seg([['adp', 'ADP', 'Ansicht für Außendienstpartner'], ['mgmt', 'Management', 'Ansicht für Führungskräfte: Team-Auswertung mit ADP-Vergleich']], App.modus(), function (m) {
      App.p.einstellungen.modus = m; Sp.plane(App.p); App.zeige(m === 'mgmt' ? 'team' : App.ansicht);
    }));
    if (App.p) { box.appendChild(kurzueberblick()); box.appendChild(D.btn('', function () { AB.kundensuche('name'); }, { icon: 'suche', titel: 'Kundensuche (F4 Name, F3 Vertragsnummer)' })); }
    var th = D.thema();
    var folge = ['auto', 'light', 'dark'], namen = { auto: 'Auto', light: 'Hell', dark: 'Dunkel' };
    var thBtn = D.btn(namen[th], function () { th = folge[(folge.indexOf(th) + 1) % 3]; D.thema(th); thBtn.lastChild.textContent = namen[th]; thBtn.dataset.thema = th; },
      { icon: th === 'dark' ? 'mond' : 'sonne', titel: 'Darstellung wechseln: Auto (wie das Betriebssystem) → Hell → Dunkel' });
    thBtn.id = 'themaBtn'; thBtn.dataset.thema = th;
    box.appendChild(thBtn);
    if (App.p) {
      var wahl = h('input', { type: 'file', multiple: true, hidden: true, accept: '.csv,.txt,.xlsx,.xlsm,.json', onchange: function () { App.importiere(Array.from(wahl.files)); wahl.value = ''; } });
      box.appendChild(wahl);
      box.appendChild(D.btn('Einlesen', function () { App.einleseDialog(); }, { icon: 'hoch', titel: 'Datei einlesen: je Art ein eigenes Feld (Abrechnung, bisheriges Antragsbuch, Veränderungsdienst, Team, Projektdatei)' }));
    }
  }

  /** Kleine Kennzahlenleiste im Kopf; Klick klappt mehr Details auf. */
  function kurzueberblick() {
    var kz = App.kz, j = kz.jahr, m = kz.monate[new Date().getMonth()], e = App.p.einstellungen;
    var feld = h('div.karte.kurz-feld'), box = h('div.kurz');
    var knopf = h('button', { type: 'button', title: 'Kurzüberblick – klicken für mehr', 'aria-expanded': 'false', onclick: function (ev) { ev.stopPropagation(); box.classList.toggle('auf'); knopf.setAttribute('aria-expanded', box.classList.contains('auf')); } },
      h('span', null, 'Offen', h('b', null, String(j.offenAnz))),
      j.ampel.rot ? h('span', null, h('i.ampel.rot'), h('b', null, String(j.ampel.rot))) : null,
      j.ampel.gelb ? h('span', null, h('i.ampel.gelb'), h('b', null, String(j.ampel.gelb))) : null,
      h('span', null, U.MONATE_KURZ[new Date().getMonth()], h('b', null, U.fmtEuro0(m.brutto))));
    function dl(paare) { var d = h('dl'); paare.forEach(function (x) { d.appendChild(h('dt', null, x[0])); d.appendChild(h('dd', null, x[1])); }); return d; }
    var imp = App.p.importe.filter(function (x) { return x.typ === 'Abrechnung'; }).pop();
    D.anhaengen(feld, [h('h3', null, 'Stand der Anträge'),
      dl([['Eingereicht (wartet auf Policierung)', j.eingereichtAnz], ['Policiert (wartet auf Abrechnung)', j.policiertAnz], ['Abgerechnet', j.abgerechnetAnz], ['Storno', j.stornoAnz], ['Reklamiert', j.reklamiertAnz]]),
      h('h3', null, 'Bearbeitungsampel'),
      dl([['Rot – überfällig oder Nachbearbeitung', j.ampel.rot], ['Gelb – Frist erreicht', j.ampel.gelb], ['Grün – im Rahmen', j.ampel.gruen]]),
      h('h3', null, 'Produktion'),
      dl([['Beitrag ' + U.MONATE[new Date().getMonth()], U.fmtEuro(m.brutto)], ['Beitrag Jahr (brutto / netto)', U.fmtEuro0(j.brutto) + ' / ' + U.fmtEuro0(j.netto)], ['Provision Jahr (Ist / Soll)', U.fmtEuro0(j.provIst) + ' / ' + U.fmtEuro0(j.provSoll)],
        ['Letzte Abrechnung eingelesen', imp ? new Date(imp.datum).toLocaleDateString('de-DE') : 'noch keine']]),
      kz.erinnerung ? h('div.meldung.warn', { style: { marginTop: '10px' } }, kz.erinnerung.text) : null,
      h('div.leiste', { style: { marginTop: '12px' } }, D.btn('Rote und gelbe anzeigen', function () { App.zeige('antraege', { ampel: 'gelbrot', status: '', monat: '', spezial: '', suche: '' }); }, { klasse: 'klein-btn haupt-btn' }),
        D.btn('Zur Übersicht', function () { App.zeige('uebersicht'); }, { klasse: 'klein-btn' }))]);
    feld.addEventListener('click', function (ev) { ev.stopPropagation(); });
    box.appendChild(knopf); box.appendChild(feld);
    return box;
  }
  document.addEventListener('click', function () { var k = document.querySelector('.kurz.auf'); if (k) k.classList.remove('auf'); });

  // ---------- Meine Ziele je Produkt: eingeben, speichern, mit dem Stand vergleichen ----------
  AB.zieleKarte = function () {
    var p = App.p, G = AB.dia, karte = h('div.karte.rein');
    function zeichne() {
      D.leere(karte);
      var s = M.zieleStand(p, App.zeilen), tb = h('tbody'), euro = U.fmtEuro0, hatVj = !!p.vorjahr;
      var zeile = function (x, gesamt) {
        var f = h('input', { type: 'text', inputMode: 'decimal', value: x.ziel == null || (gesamt && s.gesamtAusSumme) ? '' : U.fmtZahl(x.ziel, 0), placeholder: gesamt && s.gesamtAusSumme ? U.fmtZahl(x.ziel, 0) + ' (Summe)' : 'Ziel', style: { textAlign: 'right', padding: '5px 8px', width: '120px' }, 'aria-label': 'Jahresziel ' + x.name,
          onchange: function () { var v = f.value.trim() === '' ? null : U.parseZahl(f.value); if (v != null && (isNaN(v) || v < 0)) { f.classList.add('fehler'); return; } if (App.gesperrt()) return; M.setzeZiel(p, x.id, v); App.geaendert({ still: true, ohneRechnen: true }); zeichne(); } });
        var q = x.quote != null ? Math.max(0, Math.min(1, x.quote)) : 0, sollQ = Math.min(1, s.anteil);
        tb.appendChild(h('tr', gesamt ? { style: { fontWeight: 650 } } : null,
          h('td', null, gesamt ? null : h('span', { style: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: G.bereichFarbe(x.id), marginRight: '8px' } }), x.name),
          hatVj ? h('td.num.muted', { style: { textAlign: 'right' }, title: x.vorjahr && x.ziel ? 'Ziel = ' + U.fmtZahl(x.ziel / x.vorjahr * 100, 0) + ' % des Vorjahres' : '' }, euro(x.vorjahr || 0)) : null,
          h('td', { style: { textAlign: 'right' } }, f),
          h('td.num', { style: { textAlign: 'right' } }, x.soll != null ? euro(x.soll) : '–'),
          h('td.num', { style: { textAlign: 'right', fontWeight: 700 } }, euro(x.wert)),
          h('td', null, x.diff == null ? h('span.muted', null, '–') : h('span.marke-s' + (x.diff >= 0 ? '.gut' : '.warn'), null, x.diff >= 0 ? euro(x.diff) + ' darüber' : euro(-x.diff) + ' darunter')),
          h('td', { style: { width: '24%', minWidth: '120px' } }, x.ziel > 0 ? h('div', { title: U.fmtZahl(q * 100, 0) + ' % des Jahresziels · Strich: gleichmäßiger Verlauf', style: { position: 'relative', height: '10px', borderRadius: '99px', background: 'var(--surface-2)' } },
            h('div.hb.dia', { style: { position: 'absolute', left: 0, top: 0, bottom: 0, width: (q * 100) + '%', borderRadius: '99px', background: x.diff >= 0 ? 'var(--good)' : gesamt ? 'var(--accent)' : G.bereichFarbe(x.id) } }),
            h('div', { style: { position: 'absolute', left: (sollQ * 100) + '%', top: '-3px', bottom: '-3px', width: '2px', background: 'var(--text)' } })) : null),
          h('td.num.muted', { style: { textAlign: 'right' } }, x.restJeMonat != null && x.fehlt > 0 ? euro(x.restJeMonat) + ' je Monat' : x.ziel > 0 && x.fehlt === 0 ? 'erreicht' : '')));
      };
      s.zeilen.forEach(function (x) { zeile(x, false); }); zeile(s.gesamt, true);
      // Vorjahreswerte für die Planung: aus einer Abrechnung oder Projektdatei des Vorjahres; gespeichert wird nur die Zusammenfassung
      function vorjahrLeiste() {
        var wahl = h('input', { type: 'file', hidden: true, accept: '.csv,.txt,.xlsx,.xlsm,.json', onchange: async function () {
          var fl = wahl.files[0]; wahl.value = ''; if (!fl || App.gesperrt()) return;
          try {
            var r = await App.lies(new Uint8Array(await fl.arrayBuffer()), fl.name, {}), zl = null;
            if (r.art === 'abrechnung') zl = AB.abrechnung.entpacke(r.gepackt);
            else if (r.art === 'projekt' && r.projekt && r.projekt.abrechnung) zl = AB.abrechnung.entpacke(r.projekt.abrechnung);
            if (!zl || !zl.length) throw new Error('Für die Vorjahreswerte wird eine Provisionsabrechnung oder die Projektdatei des Vorjahres benötigt.');
            var jahre = {}; zl.forEach(function (x) { var j = +x.bdat.slice(0, 4); if (+x.prod) jahre[j] = (jahre[j] || 0) + 1; });
            var kand = Object.keys(jahre).map(Number).filter(function (j) { return j < +p.jahr; }).sort(function (x, y) { return y - x; })[0];
            if (!kand) throw new Error('Die Datei enthält keine Produktion aus einem Jahr vor ' + p.jahr + '.');
            p.vorjahr = M.vorjahrAus(zl, kand, fl.name); App.geaendert({ still: true, ohneRechnen: true }); zeichne(); D.toast('Vorjahreswerte ' + kand + ' übernommen: ' + euro(p.vorjahr.gesamt) + ' Nettoproduktion.');
          } catch (e) { D.toast(e.message || String(e), { krit: true }); }
        } });
        var vjV = M.vorjahrVerteilung(p.vorjahr);
        return h('div.leiste', { style: { marginTop: '10px' } }, wahl,
          hatVj ? h('span.klein.muted', null, 'Vorjahr ' + p.vorjahr.jahr + ': ' + euro(p.vorjahr.gesamt) + ' Nettoproduktion' + (p.vorjahr.quelle ? ' · aus „' + p.vorjahr.quelle + '"' : '')) : h('span.klein.muted', null, 'Zum Planen können Sie die Werte des Vorjahres daneben stellen.'),
          h('span.frei'),
          hatVj && vjV ? D.btn('Verteilung wie im Vorjahr', function () { if (App.gesperrt()) return; M.setzeVerteilung(p, vjV, [false, false, false, false, false, false, false, false, false, false, false, false]); App.geaendert({ still: true, ohneRechnen: true }); zeichne(); }, { klasse: 'klein-btn', titel: 'Die Monatsanteile des Vorjahres als Vorschlag übernehmen – danach je Monat änderbar' }) : null,
          D.btn(hatVj ? 'Vorjahr ersetzen' : 'Vorjahr einlesen', function () { wahl.click(); }, { klasse: 'klein-btn', icon: 'hoch', titel: 'Abrechnung oder Projektdatei des Vorjahres wählen. Gespeichert wird nur die Zusammenfassung je Produkt und Monat.' }),
          hatVj ? D.btn('', function () { if (App.gesperrt()) return; p.vorjahr = null; App.geaendert({ still: true, ohneRechnen: true }); zeichne(); }, { klasse: 'klein-btn leise', icon: 'x', titel: 'Vorjahreswerte entfernen' }) : null);
      }
      D.anhaengen(karte, [h('div.leiste', null, h('h3', null, 'Meine Ziele ' + s.jahr), h('span.frei'), h('span.muted.klein', null, s.hatAbrechnung ? 'Stand: Nettoproduktion laut Abrechnung' : 'Stand: eingetragener Beitrag im Antragsbuch')),
        h('div.unter', null, 'Jahresziel je Produkt in Euro Monatsbeitrag eintragen – es wird gespeichert und mit dem Stand verglichen. Soll = Anteil des Ziels bis ' + (s.monate ? U.MONATE[s.monate - 1] : 'Januar') + ' nach der Monatsverteilung (' + U.fmtZahl(s.anteil * 100, 0) + ' %).'),
        h('div', { style: { overflowX: 'auto' } }, h('table.einfach', null, h('thead', null, h('tr', null, ['Produkt'].concat(hatVj ? ['Vorjahr ' + p.vorjahr.jahr] : [], ['Jahresziel', 'Soll bis heute', 'Stand', 'Abstand', 'Fortschritt', 'Noch nötig']).map(function (t) { return h('th', { style: /Vorjahr|Jahresziel|Soll|Stand|Noch/.test(t) ? { textAlign: 'right' } : null }, t); }))), tb)),
        vorjahrLeiste(),
        (function () {
          // Verteilung auf die Monate: Standard 100 ÷ 12, je Monat änderbar
          var vt = s.verteilung, festM = M.verteilungFest(p), vjP = M.vorjahrVerteilung(p.vorjahr), zeileV = h('div.monatsverteilung'), sumEl = h('span.marke-s' + (Math.abs(vt.summe - 100) < 0.05 ? '.gut' : '.warn'), null, 'Summe ' + U.fmtZahl(vt.summe, 1) + ' %');
          vt.prozent.forEach(function (v, i) {
            var f = h('input', { type: 'text', inputMode: 'decimal', value: U.fmtZahl(v, 1), 'aria-label': 'Anteil ' + U.MONATE[i] + ' in Prozent', style: { textAlign: 'right', padding: '4px 6px' },
              onchange: function () { var x = U.parseZahl(f.value); if (isNaN(x) || x < 0) { f.classList.add('fehler'); return; } if (App.gesperrt()) return; var neu = vt.prozent.slice(), fest = M.verteilungFest(p); neu[i] = x; fest[i] = true; M.setzeVerteilung(p, neu, fest); App.geaendert({ still: true, ohneRechnen: true }); zeichne(); } });
            if (festM[i]) f.classList.add('fest');
            zeileV.appendChild(h('label', { title: (s.gesamt.ziel ? U.MONATE[i] + ': ' + euro(s.gesamt.ziel * vt.anteile[i]) + ' vom Gesamtziel' : U.MONATE[i]) + (festM[i] ? ' · selbst gesetzt' : '') + (vjP ? ' · Vorjahr ' + U.fmtZahl(vjP[i], 1) + ' %' : '') }, h('span' + (i < s.monate ? '.vorbei' : ''), null, U.MONATE_KURZ[i]), f, vjP ? h('small', null, 'Vj. ' + U.fmtZahl(vjP[i], 1)) : null));
          });
          return h('div', { style: { marginTop: '12px' } }, h('div.leiste', null, h('b', null, 'Verteilung auf die Monate (%)'), sumEl, h('span.frei'),
            vt.eigen && festM.some(Boolean) && !festM.every(Boolean) && Math.abs(vt.summe - 100) >= 0.05 ? D.btn('Rest gleichmäßig verteilen', function () { if (App.gesperrt()) return; M.verteileRest(p); App.geaendert({ still: true, ohneRechnen: true }); zeichne(); }, { klasse: 'klein-btn haupt-btn', titel: 'Ihre selbst gesetzten Monate bleiben stehen; die übrigen teilen sich, was bis 100 % fehlt' }) : null,
            vt.eigen ? D.btn('Gleichmäßig', function () { if (App.gesperrt()) return; M.setzeVerteilung(p, null); App.geaendert({ still: true, ohneRechnen: true }); zeichne(); }, { klasse: 'klein-btn leise', titel: 'Zurück auf 100 ÷ 12 je Monat' }) : h('span.muted.klein', null, 'gleichmäßig: 8,3 % je Monat')),
            zeileV, Math.abs(vt.summe - 100) >= 0.05 ? h('div.klein.muted', { style: { marginTop: '4px' } }, 'Die Summe ist nicht 100 %. Gerechnet wird mit den Anteilen im Verhältnis zueinander.') : null);
        })(),
        h('p.mini', { style: { marginTop: '8px' } }, 'Pflegepflicht zählt zur Vollversicherung. Ohne eigenes Gesamtziel gilt die Summe der Produktziele. ' + (s.hatAbrechnung ? '' : 'Sobald eine Abrechnung eingelesen ist, wird mit der Nettoproduktion verglichen.'))]);
    }
    zeichne();
    return karte;
  };

  // ---------- Hinweis bei jedem Programmstart: Arbeitshilfe, keine Zusage ----------
  App.HINWEIS = [
    'Das Antragsbuch ist eine Arbeitshilfe. Es soll helfen, Anträge im Blick zu behalten und Provisionen, Stornos und den Bonus nachzuvollziehen.',
    'Alle Beträge, Vorschläge und Vorschauen beruhen auf den allgemeinen Provisions- und Wettbewerbsregeln und auf Ihren eigenen Eingaben. Sie sind keine Zusage, keine Garantie und keine verbindliche Abrechnung.',
    'Maßgeblich sind allein die Abrechnungen, Richtlinien, Verträge und Auswertungen des Versicherers. Weicht etwas ab, klären Sie es bitte dort. Die App zeigt Ihnen, wo Sie hinsehen sollten.',
    'Ihre Daten bleiben auf diesem Gerät. Es wird nichts ins Internet übertragen.'
  ];
  App.zeigeHinweis = function () {
    var d = D.dialog('Bitte beachten', { klasse: 'schmal' });
    D.anhaengen(d.rumpf, App.HINWEIS.map(function (t, i) { return h('p', { style: { margin: i ? '10px 0 0' : 0 } }, t); }));
    var ok = D.btn('Verstanden', d.zu, { klasse: 'haupt-btn' }); ok.id = 'hinweisOk';
    D.anhaengen(d.fuss, [h('span.mini', { style: { flex: 1 } }, 'Dieser Hinweis erscheint bei jedem Start. Sie finden ihn auch unter Hilfe.'), ok]);
    ok.focus();
  };

  // ---------- Einlesen mit getrennten Feldern: Der Inhalt wird geprüft, damit nichts verwechselt wird ----------
  App.IMPORTARTEN = [
    { id: 'abrechnung', titel: 'Provisionsabrechnung', text: 'Die Abrechnung des Versicherers als CSV oder Excel. Jede neue Datei ersetzt die vorige, weil sie das ganze Jahr enthält.', arten: ['abrechnung'], icon: 'abgleich', endung: '.csv,.txt,.xlsx,.xlsm' },
    { id: 'altbuch', titel: 'Mein bisheriges Antragsbuch', text: 'Das Excel-Antragsbuch, das Sie bisher geführt haben. Die Einträge werden als Anträge übernommen.', arten: ['altbuch'], icon: 'antraege', endung: '.xlsx,.xlsm' },
    { id: 'vdienst', titel: 'Veränderungsdienst', text: 'Die Liste der policierten Verträge. Passende Anträge werden auf „Policiert" gesetzt.', arten: ['tabelle'], icon: 'vdienst', endung: '.csv,.txt,.xlsx,.xlsm' },
    { id: 'team', titel: 'Team und Auswertung', text: 'Monatsscheiben, Sammelmappe, Nettoproduktion FD, persönliche Auswertung oder die Teamdatei Ihrer Führungskraft.', arten: ['monatsscheiben', 'teamdatei', 'fdbericht'], icon: 'team', endung: '.xlsx,.xlsm,.json' },
    { id: 'projekt', titel: 'Antragsbuch-Projektdatei', text: 'Eine gespeicherte Projektdatei dieser App (.json) öffnen, zum Beispiel eine Sicherung.', arten: ['projekt'], icon: 'einstellungen', endung: '.json' }
  ];
  App.ARTNAME = { abrechnung: 'eine Provisionsabrechnung', altbuch: 'ein bisheriges Excel-Antragsbuch', tabelle: 'eine einfache Liste (z. B. Veränderungsdienst)', monatsscheiben: 'eine Team-Auswertung (Monatsscheiben)', teamdatei: 'eine Teamdatei', fdbericht: 'die Auswertung „Nettoproduktion FD“', agenturdatei: 'die Prüfdatei eines Untervermittlers', projekt: 'eine Antragsbuch-Projektdatei' };
  App.einleseDialog = function () {
    var d = D.dialog('Datei einlesen', { klasse: 'mittel' });
    D.anhaengen(d.rumpf, [h('p.muted', { style: { margin: 0 } }, 'Ziehen Sie die Datei auf das passende Feld oder klicken Sie darauf. Die App prüft den Inhalt und fragt nach, wenn die Datei nicht zum Feld passt.'),
      h('div.importfelder', null, App.IMPORTARTEN.concat(App.p && AB.agentur.einstellung(App.p).modus === 'agenturist' ? [{ id: 'agentur', titel: 'Prüfdatei eines Untervermittlers', text: 'Die Datei, die Ihr Untervermittler aus seinem Antragsbuch für die Abrechnung mit Ihnen exportiert hat.', arten: ['agenturdatei'], icon: 'team', endung: '.json' }, { id: 'uvabrechnung', titel: 'Abrechnung eines Untervermittlers', text: 'Die Provisionsabrechnung, die der Versicherer für Ihren Untervermittler erstellt. Sie ersetzt nicht Ihre eigene Abrechnung.', arten: ['abrechnung'], icon: 'abgleich', endung: '.csv,.txt,.xlsx,.xlsm' }] : []).map(function (art) {
        var wahl = h('input', { type: 'file', hidden: true, multiple: art.id !== 'projekt' && art.id !== 'altbuch', accept: art.endung, onchange: function () { var fs = Array.from(wahl.files); wahl.value = ''; nimm(fs); } });
        function nimm(dateien) { if (!dateien.length) return; d.zu(); App.importiere(dateien, { erwartet: art }); }
        var feld = h('button.importfeld', { type: 'button', 'data-art': art.id, onclick: function () { wahl.click(); },
          ondragover: function (e) { e.preventDefault(); e.stopPropagation(); feld.classList.add('drueber'); }, ondragleave: function () { feld.classList.remove('drueber'); },
          ondrop: function (e) { e.preventDefault(); e.stopPropagation(); feld.classList.remove('drueber'); document.body.classList.remove('zieht'); nimm(Array.from((e.dataTransfer && e.dataTransfer.files) || [])); } },
          D.icon(art.icon), h('span', null, h('b', null, art.titel), h('small', null, art.text)));
        return h('div', null, feld, wahl);
      }))]);
    D.anhaengen(d.fuss, [h('span.mini', { style: { flex: 1 } }, 'Alles bleibt auf diesem Gerät. Ziehen Sie eine Datei neben die Felder, erkennt die App die Art selbst.'), D.btn('Schließen', d.zu)]);
  };

  // ---------- Import-Weiche: jede Datei wird am Inhalt erkannt ----------
  App.importiere = async function (dateien, opt) {
    opt = opt || {};
    for (var i = 0; i < dateien.length; i++) {
      var f = dateien[i];
      try {
        var bytes = new Uint8Array(await f.arrayBuffer());
        await App.importiereBytes(bytes, f.name, opt);
      } catch (e) { console.error(e); D.toast('„' + f.name + '": ' + (e.message || e), { krit: true }); }
    }
  };
  App.importiereBytes = async function (bytes, name, opt) {
    opt = opt || {};
    var p = App.p;
    if (p && App.nurLesen && !/\.json$/i.test(name)) { App.gesperrt(); return; }
    Sp.onstatus && Sp.onstatus({ art: 'lauf', text: 'Liest „' + name + '" …' });
    var r;
    try {
      var fuerUv = !!(opt.erwartet && opt.erwartet.id === 'uvabrechnung');
      r = await App.lies(bytes, name, p ? { alt: !fuerUv && p.abrechnung && p.abrechnung.zeilen && p.abrechnung.zeilen.length ? p.abrechnung : null, importNr: p.importZaehler + 1, jahr: p.jahr, vermittlernummer: p.einstellungen.vermittlernummer, nurAbrechnung: !!opt.nurAbrechnung } : {});
    } finally { Sp.onstatus && Sp.onstatus(Sp.status); }
    // Getrennte Felder: passt der erkannte Inhalt nicht zum gewählten Feld, wird nachgefragt statt still verwechselt
    if (opt.erwartet && opt.erwartet.arten.indexOf(r.art) < 0) {
      var ok = await D.frage('Die Datei passt nicht zu diesem Feld', '„' + name + '" wurde im Feld „' + opt.erwartet.titel + '" abgelegt, ist nach dem Inhalt aber ' + (App.ARTNAME[r.art] || 'eine andere Datei') + '. Soll sie als das eingelesen werden, was sie ist?', 'Trotzdem einlesen');
      if (!ok) { D.toast('„' + name + '" wurde nicht eingelesen.'); return; }
    }
    if (r.art === 'projekt') {
      if (p && !(await D.frage('Anderes Projekt öffnen?', '„' + name + '" ist eine Antragsbuch-Projektdatei. Das aktuelle Projekt bleibt gespeichert und wird geschlossen.', 'Projekt öffnen'))) return;
      return App.oeffneMitSpiegel(r.projekt, null, name);
    }
    if (!p) throw new Error('Bitte zuerst ein Projekt öffnen oder neu anlegen.');
    if (r.art === 'altbuch') return App.uebernimmAltbuch(r, bytes, name, opt);
    if (r.art === 'abrechnung') {
      // Unternehmeragentur: Abrechnung eines Untervermittlers getrennt von der eigenen ablegen
      var agE = AB.agentur.einstellung(p), fremd = r.vermittler && r.vermittler.length === 1 ? r.vermittler[0] : '';
      if (!fuerUv && agE.modus === 'agenturist' && fremd && p.einstellungen.vermittlernummer && fremd !== p.einstellungen.vermittlernummer)
        fuerUv = await D.frage('Abrechnung eines Untervermittlers?', '„' + name + '" gehört zur Vermittlernummer ' + fremd + ', Ihre eigene ist ' + p.einstellungen.vermittlernummer + '. Soll die Datei als Abrechnung Ihres Untervermittlers abgelegt werden? Ihre eigene Abrechnung bleibt dann unverändert.', 'Als Abrechnung des Untervermittlers', { nein: 'Als meine Abrechnung' });
      if (fuerUv) {
        if (!fremd) throw new Error('Die Datei enthält keine eindeutige Vermittlernummer.');
        if (fremd === p.einstellungen.vermittlernummer) throw new Error('Diese Datei ist Ihre eigene Abrechnung. Bitte im Feld „Provisionsabrechnung" ablegen.');
        if (!p.agenturAbr) p.agenturAbr = {};
        var schon = !!p.agenturAbr[fremd];
        p.agenturAbr[fremd] = { gepackt: r.gepackt, datei: name, datum: new Date().toISOString(), anzahl: r.anzahl, jahre: r.jahre };
        if (!agE.untervermittler[fremd]) agE.untervermittler[fremd] = { name: '', art: 'modell', wert: null };
        App.agenturZeilen = null; App.zustand.agentur = { nr: fremd }; App.ansicht = 'agentur'; App.geaendert({ ohneRechnen: true });
        D.toast('Abrechnung des Untervermittlers ' + fremd + ' abgelegt: ' + U.fmtZahl(r.anzahl, 0) + ' Zeilen' + (schon ? ' (ersetzt die frühere Datei)' : '') + '.');
        return;
      }
      var jahre = r.jahre || [], anderes = jahre.length === 1 && +jahre[0] !== +p.jahr ? +jahre[0] : null;
      if (anderes) {
        var umstellen = !p.antraege.length || opt.still || (await D.frage('Projektjahr umstellen?', 'Die Abrechnung enthält Buchungen aus ' + anderes + ', das Projekt ist für ' + p.jahr + ' angelegt. Soll das Projekt auf ' + anderes + ' umgestellt werden? Ihre Anträge bleiben unverändert.', 'Auf ' + anderes + ' umstellen', { nein: 'Bei ' + p.jahr + ' bleiben' }));
        if (umstellen && !(opt.still && p.antraege.length)) { p.jahr = anderes; r.warnungen = r.warnungen.filter(function (w) { return !/Buchungen aus/.test(w); }); D.toast('Das Projekt ist jetzt auf das Jahr ' + anderes + ' eingestellt.'); }
      }
      M.sichere(p, 'Vor Import „' + name + '"');
      p.importZaehler++;
      p.abrechnung = r.gepackt; App.zeilen = AB.abrechnung.entpacke(r.gepackt); App.wuerfel = null;
      var neueTarife = M.erweitereTarife(p, r.tarife, 'abrechnung');
      p.importe.push({ id: U.uid(), nr: p.importZaehler, typ: 'Abrechnung', datum: new Date().toISOString(), datei: name, zeilen: r.anzahl,
        provisionssumme: r.provisionssumme, neu: r.vergleich.neu, provisionNeu: r.vergleich.provisionNeu, entfallen: r.vergleich.entfallen, behalten: r.vergleich.behalten || 0, info: r.info });
      if (!p.einstellungen.vermittlernummer && r.vermittler.length === 1) p.einstellungen.vermittlernummer = r.vermittler[0];
      App.zustand.abgleich = Object.assign(App.zustand.abgleich || {}, { reiter: null });
      App.ansicht = opt.still ? App.ansicht : 'abgleich';
      App.geaendert();
      D.toast('Abrechnung eingelesen: ' + U.fmtZahl(r.anzahl, 0) + ' Zeilen, davon ' + U.fmtZahl(r.vergleich.neu, 0) + ' neu' +
        (r.vergleich.behalten ? ', ' + r.vergleich.behalten + ' aus früheren Importen behalten (fehlen in der neuen Datei)' : '') + (r.vergleich.entfallen ? ', ' + r.vergleich.entfallen + ' entfallen' : '') + (neueTarife ? ' · ' + neueTarife + ' neue Tarife' : '') + '.');
      r.warnungen.forEach(function (w) { D.toast(w, { krit: true }); });
    } else if (r.art === 'agenturdatei') {
      var ag = AB.agentur.einstellung(p), dt = r.datei;
      if (ag.modus !== 'agenturist' && !(await D.frage('Prüfdatei eines Untervermittlers', '„' + name + '" ist eine Prüfdatei von ' + (dt.name || dt.von || 'einem Untervermittler') + '. Soll dieses Projekt als Agenturist geführt werden (Unternehmeragentur)?', 'Als Agenturist einlesen'))) return;
      if (!dt.von) throw new Error('In der Prüfdatei fehlt die Vermittlernummer des Untervermittlers.');
      ag.modus = 'agenturist';
      if (!p.agenturEingang) p.agenturEingang = {};
      var ersetzt = !!p.agenturEingang[dt.von];
      p.agenturEingang[dt.von] = dt;
      if (!ag.untervermittler[dt.von]) ag.untervermittler[dt.von] = { name: dt.name || '', art: 'mb', wert: null };
      App.zustand.agentur = { nr: dt.von }; App.ansicht = 'agentur'; App.geaendert();
      D.toast('Prüfdatei von ' + dt.von + ' eingelesen: ' + dt.posten.length + ' Posten' + (ersetzt ? ' (ersetzt die frühere Datei)' : '') + '.');
    } else if (r.art === 'fdbericht') {
      var fb = r.bericht;
      if (App.modus() !== 'mgmt') {
        if (!(await D.frage('Auswertung für Führungskräfte', '„' + name + '" enthält Namen und Werte aller Vermittler der Einheit. Sie wird nur in der Management-Ansicht verwendet. Soll dieses Projekt auf Management umgestellt werden?', 'Auf Management umstellen'))) return;
        p.einstellungen.modus = 'mgmt';
      }
      var frueher = (p.fdVerlauf || []).filter(function (x) { return +x.jahr === +fb.jahr && x.stand < fb.stand; }).pop();
      p.fdBericht = fb; p.fdVerlauf = AB.team.merkeFdVerlauf(p.fdVerlauf, fb);
      p.importe.push({ id: U.uid(), typ: 'Nettoproduktion FD', datum: new Date().toISOString(), datei: name, zeilen: fb.zeilen.length });
      App.ansicht = opt.still ? App.ansicht : 'team';
      App.geaendert({ ohneRechnen: true });
      D.toast('Nettoproduktion eingelesen: ' + fb.zeilen.length + ' Vermittler, Stand ' + U.fmtDatum(fb.stand) + ', Jahreswert ' + U.fmtEuro0(fb.gesamt.kum) + (frueher ? ' (' + (fb.gesamt.kum - frueher.kum >= 0 ? '+' : '') + U.fmtEuro0(fb.gesamt.kum - frueher.kum) + ' seit ' + U.fmtDatum(frueher.stand) + ')' : '') + '.' + (+fb.jahr !== +p.jahr ? ' Achtung: Die Auswertung gilt für ' + fb.jahr + ', das Projekt steht auf ' + p.jahr + '.' : ''), +fb.jahr !== +p.jahr ? { krit: true } : undefined);
    } else if (r.art === 'monatsscheiben' || r.art === 'teamdatei') {
      M.sichere(p, 'Vor Import „' + name + '"');
      var team = r.team;
      if (r.art === 'monatsscheiben' && App.modus() !== 'mgmt') {
        var ich = AB.team.findeEigene(team, p.einstellungen.vermittlernummer), eigName = ich ? ich.name : '';
        team = AB.team.pseudonymisiere(team);
        ich = AB.team.findeEigene(team, p.einstellungen.vermittlernummer); if (ich) ich.name = eigName;
      }
      if (p.team && !team.pseudonym) team.zeilen.forEach(function (z) { if (!z.name) { var alt = p.team.zeilen.find(function (x) { return x.nr === z.nr; }); if (alt && alt.name) z.name = alt.name; } });
      p.team = team;
      p.importe.push({ id: U.uid(), typ: team.sammelmappe ? 'Sammelmappe' : 'Monatsscheiben', datum: new Date().toISOString(), datei: name, zeilen: team.zeilen.length });
      App.ansicht = opt.still ? App.ansicht : 'team';
      App.geaendert();
      D.toast('Teamdaten eingelesen: ' + team.zeilen.filter(function (z) { return !z.gesamt; }).length + ' Vermittler' + (team.stand ? ', Stand ' + U.fmtDatum(team.stand) : '') + '.');
    } else if (r.art === 'tabelle') {
      if (opt.still) { D.toast('Im Ordner liegt „' + name + '" – bitte im Reiter Veränderungsdienst einlesen.', { aktion: ['Öffnen', function () { App.zeige('vdienst'); AB.ansichten.vdienst.oeffne(r, name); }] }); return; }
      App.zeige('vdienst'); AB.ansichten.vdienst.oeffne(r, name);
    }
  };

  /** Einträge aus dem alten Excel-Antragsbuch übernehmen (mit Rückfrage). */
  App.uebernimmAltbuch = async function (r, bytes, name, opt) {
    var p = App.p, alt = r.altbuch, schon = p.antraege.filter(function (a) { return a.quelle === 'altbuch'; }).length;
    var mitAbr = h('input', { type: 'checkbox' }), tr = M.trenneDubletten(p.antraege, alt.antraege.map(function (x) { return M.ergaenzeAntrag(JSON.parse(JSON.stringify(x))); })), ohneDoppelte = h('input', { type: 'checkbox', checked: true });
    var text = h('div', null, h('p.muted', { style: { margin: '0 0 8px' } }, 'Im Blatt „' + r.blatt + '" stehen ' + alt.antraege.length + ' Einträge aus ' + alt.jahr + '. Sie werden als Anträge übernommen – mit Monat, Bereich, Vorgangsart, Tarif, Beitrag, Status und Provision.'),
      h('p.muted', { style: { margin: '0 0 8px' } }, 'Fehlen Name und Vertragsnummer, schlägt der Abgleich danach passende Buchungen über Beitrag und Provision vor.'),
      tr.doppelt.length ? h('div.meldung.warn', null, h('b', null, tr.doppelt.length + ' der ' + alt.antraege.length + ' Einträge sind vermutlich schon im Projekt'), ' (gleicher Eingang, Bereich, Tarif und Beitrag). Neu wären ' + tr.neu.length + '.',
        h('ul', { style: { margin: '6px 0', paddingLeft: '20px' } }, tr.doppelt.slice(0, 6).map(function (x) { return h('li', null, U.fmtDatum(x.eingang) + ' · ' + (M.vnName(x) || 'ohne Name') + ' · ' + M.tarife(x) + ' · ' + U.fmtEuro(M.beitrag(x))); }), tr.doppelt.length > 6 ? h('li', null, '… und ' + (tr.doppelt.length - 6) + ' weitere') : null),
        h('label.schalter', null, ohneDoppelte, 'Schon vorhandene überspringen (empfohlen)')) : schon ? h('div.meldung', null, 'Im Projekt sind bereits ' + schon + ' Einträge aus einem alten Antragsbuch. Keiner der neuen Einträge ist doppelt – die Datei wirkt wie eine Fortsetzung.') : null,
      r.abrechnungsblatt ? h('label.schalter', { style: { marginTop: '8px' } }, mitAbr, 'Auch das Blatt „' + r.abrechnungsblatt.name + '" als Abrechnung einlesen (' + U.fmtZahl(r.abrechnungsblatt.zeilen, 0) + ' Zeilen, ' + r.abrechnungsblatt.jahre.join('/') + ')') : null);
    if (!(await D.frage('Altes Antragsbuch übernehmen?', text, 'Übernehmen'))) return;
    var nimm = tr.doppelt.length && ohneDoppelte.checked ? tr.neu : tr.neu.concat(tr.doppelt);
    if (!nimm.length) { D.toast('Alle Einträge sind schon im Projekt – nichts übernommen.'); return; }
    M.sichere(p, 'Vor Übernahme „' + name + '"');
    if (!p.antraege.length && !App.zeilen.length && alt.jahr) p.jahr = alt.jahr;
    nimm.forEach(function (a) { p.antraege.push(a); });
    M.erweitereTarife(p, [], 'manuell');
    p.importe.push({ id: U.uid(), typ: 'Altes Antragsbuch', datum: new Date().toISOString(), datei: name, zeilen: nimm.length });
    App.ansicht = 'antraege';
    App.geaendert();
    D.toast(nimm.length + ' Einträge übernommen' + (nimm.length < alt.antraege.length ? ', ' + (alt.antraege.length - nimm.length) + ' schon vorhandene übersprungen' : '') + '. Lesen Sie jetzt die Abrechnung ' + alt.jahr + ' ein – der Abgleich schlägt die Vertragsnummern vor.');
    if (mitAbr.checked) await App.importiereBytes(bytes, name, Object.assign({}, opt, { nurAbrechnung: true }));
  };

  /** Passwortgeschützte Projektdatei entsperren. → Projekt-Objekt oder null (abgebrochen) */
  App.entsperre = async function (roh) {
    if (!roh || !roh.verschluesselt) { Sp.schluessel = null; return roh; }
    if (!AB.krypto.verfuegbar()) throw new Error('Dieser Browser kann geschützte Projektdateien nicht öffnen. Bitte Edge oder Chrome verwenden.');
    var fehler = '';
    for (;;) {
      var pw = await D.passwort('Projekt ist geschützt', 'Bitte das Passwort für dieses Projekt eingeben. Ohne Passwort lässt sich die Datei nicht lesen.', { fehler: fehler, ja: 'Öffnen' });
      if (pw == null) return null;
      try {
        var e = await AB.krypto.entschluessele(roh, pw);
        Sp.schluessel = e.schluessel;
        return JSON.parse(e.text);
      } catch (err) { if (!err.falschesPasswort) throw err; fehler = 'Das Passwort stimmt nicht. Bitte noch einmal versuchen.'; }
    }
  };

  /** Projekt öffnen und prüfen, ob im Browser ein neuerer Stand liegt. */
  App.oeffneMitSpiegel = async function (roh, handle, name) {
    if (!roh || roh.format !== M.FORMAT) throw new Error('Das ist keine Antragsbuch-Projektdatei.');
    var sp = await Sp.spiegel(roh.projektId), ausSpiegel = false;
    if (sp && sp.geaendert > roh.geaendert && sp.text) {
      var nimm = await D.frage('Neuerer Stand gefunden',
        'Im Browser liegt ein neuerer Stand dieses Projekts (' + new Date(sp.geaendert).toLocaleString('de-DE') + ') als in der Datei (' + new Date(roh.geaendert).toLocaleString('de-DE') + '). Soll der neuere Stand wiederhergestellt werden?',
        'Neueren Stand wiederherstellen', { nein: 'Datei-Stand verwenden' });
      if (nimm) { roh = JSON.parse(sp.text); ausSpiegel = true; }
    }
    var p = await App.entsperre(roh);
    if (!p) return;
    App.oeffne(p, handle, name);
    if (ausSpiegel) Sp.plane(App.p);
  };

  // ---------- Ordner ----------
  var ordnerLaeuft = false;
  App.pruefeOrdner = async function (laut) {
    var p = App.p; if (!p || ordnerLaeuft) return;
    ordnerLaeuft = true;
    try {
      var st = await Sp.ordnerStatus(p);
      if (st === 'erlaubnis' && laut && (await Sp.ordnerErlauben())) st = 'verbunden';
      App.ordnerZustand = st;
      if (st !== 'verbunden') return;
      var neue = await Sp.neueDateien(p.ordnerGesehen);
      for (var i = 0; i < neue.length; i++) {
        p.ordnerGesehen[neue[i].signatur] = 1;
        await App.importiere([neue[i].datei], { still: true });
      }
      if (neue.length) { Sp.plane(p); App.zeige(App.ansicht); }
      else if (laut) D.toast('Keine neuen Dateien im Ordner „' + Sp.ordner.name + '".');
    } catch (e) {
      console.warn(e);
      if (laut) D.toast('Der Ordner konnte nicht gelesen werden: ' + (e.message || e), { krit: true });
    } finally { ordnerLaeuft = false; }
  };

  // ---------- Start ----------
  App.start = function () {
    D.thema(); AB.akzent.wende(AB.akzent.lade()); App.zeigeHinweis();
    starteWorker();
    Sp.onstatus = function (s) {
      document.getElementById('speicherpunkt').className = 'punkt ' + (s.art === 'ok' ? '' : s.art);
      document.getElementById('speichertext').textContent = s.text;
      document.getElementById('kopiebtn').hidden = !App.p;
    };
    Sp.onfehler = function () { D.toast('Die Projektdatei konnte nicht geschrieben werden. Ihre Daten sind im Browser gesichert – bitte eine Kopie herunterladen.', { krit: true, aktion: ['Kopie herunterladen', function () { Sp.ladeHerunter(App.p); }] }); };
    document.getElementById('kopiebtn').addEventListener('click', function () { Sp.ladeHerunter(App.p); });
    // Ziehen & Ablegen überall
    var tiefe = 0;
    window.addEventListener('dragenter', function (e) { if (e.dataTransfer && Array.from(e.dataTransfer.types).indexOf('Files') >= 0) { tiefe++; document.body.classList.add('zieht'); e.preventDefault(); } });
    window.addEventListener('dragover', function (e) { if (document.body.classList.contains('zieht')) e.preventDefault(); });
    window.addEventListener('dragleave', function () { if (--tiefe <= 0) { tiefe = 0; document.body.classList.remove('zieht'); } });
    window.addEventListener('drop', function (e) {
      tiefe = 0; document.body.classList.remove('zieht');
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault(); App.importiere(Array.from(e.dataTransfer.files));
    });
    window.addEventListener('focus', function () { App.pruefeOrdner(false); });
    document.addEventListener('keydown', function (e) {
      if (App.p && (e.key === 'F3' || e.key === 'F4') && !e.altKey && !e.ctrlKey) {
        e.preventDefault();
        if (!document.querySelector('dialog[open]')) AB.kundensuche(e.key === 'F3' ? 'nummer' : 'name');
        return;
      }
      if (e.key === 'Escape') { var k = document.querySelector('.kurz.auf'); if (k) k.classList.remove('auf'); }
      if (!App.p || document.querySelector('dialog[open]')) return;
      var imFeld = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === 'n' && !imFeld && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); AB.maske.oeffne(null); }
      if (e.key === '/' && !imFeld) { var s = document.querySelector('.suche input'); if (s) { e.preventDefault(); s.focus(); } else { App.zeige('antraege'); } }
    });
    App.zeige('start');
  };
})(globalThis.AB = globalThis.AB || {});
