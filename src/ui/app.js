/* Antragsbuch – App-Rahmen: Zustand, Navigation, Import-Weiche, Neuberechnung. */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h, U = AB.util, M = AB.model, Sp = AB.speicher;
  var App = AB.app = { p: null, zeilen: [], erg: null, kz: null, ansicht: 'uebersicht', zustand: {}, wuerfel: null };
  AB.ansichten = AB.ansichten || {};
  var REIHENFOLGE = ['uebersicht', 'antraege', 'abgleich', 'vdienst', 'team', 'einstellungen', 'hilfe'];

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
    App.pruefeOrdner(false);
  };
  App.schliesse = function () { App.p = null; App.zeilen = []; App.erg = null; Sp.schliesse(); document.body.classList.remove('offen'); App.zeige('start'); };
  App.rechne = function () {
    var p = App.p; if (!p) return;
    App.erg = AB.abgleich.rechne(p, App.zeilen);
    if (AB.abgleich.wendeStatusAn(p, App.erg)) App.erg = AB.abgleich.rechne(p, App.zeilen);
    App.kz = AB.kennzahlen.rechne(p, App.erg, App.zeilen);
  };
  /** Nach jeder Änderung: neu rechnen, speichern, Ansicht auffrischen. */
  App.geaendert = function (opt) {
    opt = opt || {};
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
      var a = AB.ansichten[id]; if (!a) return;
      var zahl = id === 'abgleich' && App.erg ? App.erg.abweichung.length + App.erg.vorschlaege.length : 0;
      nav.appendChild(h('button' + (App.ansicht === id ? '.aktiv' : ''), { type: 'button', onclick: function () { App.zeige(id); } },
        D.icon(a.icon), typeof a.titel === 'function' ? a.titel() : a.titel, zahl ? h('span.zahl', null, zahl) : null));
    });
    document.getElementById('projektname').textContent = Sp.dateiname || ('Antragsbuch ' + App.p.jahr);
  }
  App.zeige = function (id, param) {
    if (!App.p && id !== 'start') id = 'start';
    var a = AB.ansichten[id]; if (!a) return;
    App.ansicht = id;
    if (param) App.zustand[id] = Object.assign(App.zustand[id] || {}, param);
    var inhalt = D.leere(document.getElementById('inhalt')), aktionen = D.leere(document.getElementById('aktionen'));
    inhalt.className = 'inhalt' + (a.fest ? ' fest' : '');
    document.getElementById('titel').textContent = typeof a.titel === 'function' ? a.titel() : a.titel;
    document.getElementById('untertitel').textContent = typeof a.unter === 'function' ? a.unter() : (a.unter || '');
    zeichneNav(); zeichneKopf();
    document.getElementById('tipp').classList.remove('an');
    a.zeige(inhalt, aktionen, App.zustand[id] = App.zustand[id] || {});
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
      box.appendChild(D.btn('Einlesen', function () { wahl.click(); }, { icon: 'hoch', titel: 'Abrechnung, Veränderungsdienst oder Monatsscheiben einlesen – oder einfach ins Fenster ziehen' }));
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
    Sp.onstatus && Sp.onstatus({ art: 'lauf', text: 'Liest „' + name + '" …' });
    var r;
    try {
      r = await App.lies(bytes, name, p ? { alt: p.abrechnung && p.abrechnung.zeilen && p.abrechnung.zeilen.length ? p.abrechnung : null, importNr: p.importZaehler + 1, jahr: p.jahr, vermittlernummer: p.einstellungen.vermittlernummer } : {});
    } finally { Sp.onstatus && Sp.onstatus(Sp.status); }
    if (r.art === 'projekt') {
      if (p && !(await D.frage('Anderes Projekt öffnen?', '„' + name + '" ist eine Antragsbuch-Projektdatei. Das aktuelle Projekt bleibt gespeichert und wird geschlossen.', 'Projekt öffnen'))) return;
      return App.oeffneMitSpiegel(r.projekt, null, name);
    }
    if (!p) throw new Error('Bitte zuerst ein Projekt öffnen oder neu anlegen.');
    if (r.art === 'abrechnung') {
      M.sichere(p, 'Vor Import „' + name + '"');
      p.importZaehler++;
      p.abrechnung = r.gepackt; App.zeilen = AB.abrechnung.entpacke(r.gepackt); App.wuerfel = null;
      var neueTarife = M.erweitereTarife(p, r.tarife, 'abrechnung');
      p.importe.push({ id: U.uid(), nr: p.importZaehler, typ: 'Abrechnung', datum: new Date().toISOString(), datei: name, zeilen: r.anzahl,
        provisionssumme: r.provisionssumme, neu: r.vergleich.neu, provisionNeu: r.vergleich.provisionNeu, entfallen: r.vergleich.entfallen, info: r.info });
      if (!p.einstellungen.vermittlernummer && r.vermittler.length === 1) p.einstellungen.vermittlernummer = r.vermittler[0];
      App.zustand.abgleich = Object.assign(App.zustand.abgleich || {}, { reiter: null });
      App.ansicht = opt.still ? App.ansicht : 'abgleich';
      App.geaendert();
      D.toast('Abrechnung eingelesen: ' + U.fmtZahl(r.anzahl, 0) + ' Zeilen, davon ' + U.fmtZahl(r.vergleich.neu, 0) + ' neu' +
        (r.vergleich.entfallen ? ', ' + r.vergleich.entfallen + ' entfallen' : '') + (neueTarife ? ' · ' + neueTarife + ' neue Tarife' : '') + '.');
      r.warnungen.forEach(function (w) { D.toast(w, { krit: true }); });
    } else if (r.art === 'monatsscheiben' || r.art === 'teamdatei') {
      M.sichere(p, 'Vor Import „' + name + '"');
      var team = r.team;
      if (r.art === 'monatsscheiben' && App.modus() !== 'mgmt') {
        var ich = AB.team.findeEigene(team, p.einstellungen.vermittlernummer), eigName = ich ? ich.name : '';
        team = AB.team.pseudonymisiere(team);
        ich = AB.team.findeEigene(team, p.einstellungen.vermittlernummer); if (ich) ich.name = eigName;
      }
      p.team = team;
      p.importe.push({ id: U.uid(), typ: 'Monatsscheiben', datum: new Date().toISOString(), datei: name, zeilen: team.zeilen.length });
      App.ansicht = opt.still ? App.ansicht : 'team';
      App.geaendert();
      D.toast('Teamdaten eingelesen: ' + team.zeilen.filter(function (z) { return !z.gesamt; }).length + ' Vermittler' + (team.stand ? ', Stand ' + U.fmtDatum(team.stand) : '') + '.');
    } else if (r.art === 'tabelle') {
      if (opt.still) { D.toast('Im Ordner liegt „' + name + '" – bitte im Reiter Veränderungsdienst einlesen.', { aktion: ['Öffnen', function () { App.zeige('vdienst'); AB.ansichten.vdienst.oeffne(r, name); }] }); return; }
      App.zeige('vdienst'); AB.ansichten.vdienst.oeffne(r, name);
    }
  };

  /** Projekt öffnen und prüfen, ob im Browser ein neuerer Stand liegt. */
  App.oeffneMitSpiegel = async function (roh, handle, name) {
    M.migriere(roh);
    var sp = await Sp.spiegel(roh.projektId);
    if (sp && sp.geaendert > roh.geaendert && sp.text) {
      var nimm = await D.frage('Neuerer Stand gefunden',
        'Im Browser liegt ein neuerer Stand dieses Projekts (' + new Date(sp.geaendert).toLocaleString('de-DE') + ') als in der Datei (' + new Date(roh.geaendert).toLocaleString('de-DE') + '). Soll der neuere Stand wiederhergestellt werden?',
        'Neueren Stand wiederherstellen', { nein: 'Datei-Stand verwenden' });
      if (nimm) { roh = JSON.parse(sp.text); App.oeffne(roh, handle, name); Sp.plane(App.p); return; }
    }
    App.oeffne(roh, handle, name);
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
    D.thema();
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
