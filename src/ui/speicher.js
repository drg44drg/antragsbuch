/* Antragsbuch – Speichern: Projektdatei (File System Access API), Spiegel in IndexedDB, Ordner-Überwachung. */
(function (AB) {
  'use strict';
  var Sp = AB.speicher = { handle: null, dateiname: '', ordner: null, ungesichert: false, letzteSicherung: null };
  Sp.fsa = typeof window.showSaveFilePicker === 'function' && typeof window.showOpenFilePicker === 'function';
  Sp.ordnerMoeglich = typeof window.showDirectoryPicker === 'function';
  var TYPEN = [{ description: 'Antragsbuch-Projekt', accept: { 'application/json': ['.json'] } }];

  // ---------- IndexedDB (kleiner Schlüssel-Wert-Speicher) ----------
  var dbP = null;
  function db() {
    if (!dbP) dbP = new Promise(function (res, rej) {
      var r = indexedDB.open('antragsbuch', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
    return dbP;
  }
  function tx(modus, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction('kv', modus), q = fn(t.objectStore('kv'));
        t.oncomplete = function () { res(q && q.result); }; t.onerror = t.onabort = function () { rej(t.error); };
      });
    }).catch(function (e) { console.warn('IndexedDB nicht verfügbar:', e); return undefined; });
  }
  Sp.hole = function (k) { return tx('readonly', function (s) { return s.get(k); }); };
  Sp.lege = function (k, v) { return tx('readwrite', function (s) { return s.put(v, k); }); };
  Sp.loesche = function (k) { return tx('readwrite', function (s) { return s.delete(k); }); };

  // ---------- Serialisieren (Abrechnungszeilen werden nur nach einem Import neu erzeugt) ----------
  var cache = { ref: null, text: '' };
  Sp.serialisiere = function (p) {
    if (cache.ref !== p.abrechnung) cache = { ref: p.abrechnung, text: JSON.stringify(p.abrechnung) };
    var rest = JSON.stringify(Object.assign({}, p, { abrechnung: undefined }));
    return rest.slice(0, -1) + ',"abrechnung":' + cache.text + '}';
  };

  /** Text für Datei und Browser-Spiegel: mit Passwortschutz verschlüsselt, sonst Klartext-JSON. */
  Sp.schluessel = null;
  Sp.verpacke = async function (p) {
    var text = Sp.serialisiere(p);
    if (!Sp.schluessel) return text;
    var u = await AB.krypto.verschluessele(text, Sp.schluessel, { format: p.format, schema: p.schema, projektId: p.projektId, jahr: p.jahr, geaendert: p.geaendert });
    return JSON.stringify(u);
  };

  // ---------- Status ----------
  Sp.status = { art: 'ok', text: 'Kein Projekt geöffnet' };
  function melde(art, text) { Sp.status = { art: art, text: text }; Sp.onstatus && Sp.onstatus(Sp.status); }
  function uhr() { var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }

  // ---------- Datei ----------
  Sp.neuDatei = async function (p) {
    if (!Sp.fsa) return false;
    var h = await window.showSaveFilePicker({ suggestedName: 'Antragsbuch_' + p.jahr + '.antragsbuch.json', types: TYPEN });
    Sp.handle = h; Sp.dateiname = h.name;
    return true;
  };
  Sp.oeffneDatei = async function () {
    var hs = await window.showOpenFilePicker({ types: TYPEN, multiple: false });
    return Sp.leseHandle(hs[0]);
  };
  Sp.leseHandle = async function (h) {
    if (h.queryPermission && (await h.queryPermission({ mode: 'readwrite' })) !== 'granted') {
      if ((await h.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('Ohne Schreibrecht kann das Projekt nicht automatisch gespeichert werden.');
    }
    var f = await h.getFile(), text = await f.text();
    return { projekt: JSON.parse(text), handle: h, name: h.name };
  };
  Sp.uebernimm = function (p, handle, name) {
    Sp.handle = handle || null; Sp.dateiname = name || (handle ? handle.name : '');
    Sp.ungesichert = false;
    Sp.lege('zuletzt', { projektId: p.projektId, handle: Sp.handle, name: Sp.dateiname, jahr: p.jahr, wann: new Date().toISOString() });
    melde(Sp.handle ? 'ok' : 'warn', Sp.handle ? 'Geöffnet: ' + Sp.dateiname : 'Nur im Browser gesichert');
  };
  Sp.spiegel = function (projektId) { return Sp.hole('spiegel:' + projektId); };

  var timer = null, laeuft = false, nochmal = false, aktuell = null;
  /** Nach jeder Änderung aufrufen: speichert entprellt in Datei und IndexedDB. */
  Sp.plane = function (p) {
    aktuell = p; p.geaendert = new Date().toISOString();
    if (!Sp.handle) Sp.ungesichert = true;
    melde('lauf', 'Speichert …');
    clearTimeout(timer); timer = setTimeout(Sp.jetzt, 600);
  };
  Sp.jetzt = async function () {
    clearTimeout(timer);
    if (!aktuell) return;
    if (laeuft) { nochmal = true; return; }
    laeuft = true;
    var p = aktuell, text, fehler = null;
    try {
      text = await Sp.verpacke(p);
      await Sp.lege('spiegel:' + p.projektId, { geaendert: p.geaendert, jahr: p.jahr, name: Sp.dateiname, text: text });
      if (Sp.handle) {
        var w = await Sp.handle.createWritable();
        await w.write(text); await w.close();
      }
    } catch (e) { fehler = e; console.error(e); }
    laeuft = false;
    if (fehler) melde('krit', 'Speichern fehlgeschlagen – bitte „Kopie herunterladen"');
    else if (Sp.handle) melde('ok', 'Gespeichert um ' + uhr() + (Sp.schluessel ? ' · verschlüsselt' : ''));
    else melde('warn', 'Im Browser gesichert um ' + uhr() + ' – Datei noch herunterladen');
    if (fehler && Sp.onfehler) Sp.onfehler(fehler);
    if (nochmal) { nochmal = false; Sp.jetzt(); }
  };
  /** Projektdatei als Download (Fallback ohne File System Access API oder Sicherheitskopie). */
  Sp.ladeHerunter = async function (p) {
    var name = (Sp.dateiname || 'Antragsbuch_' + p.jahr + '.antragsbuch.json');
    AB.dom.lade(name, await Sp.verpacke(p), 'application/json');
    Sp.ungesichert = false; Sp.letzteSicherung = new Date();
    if (!Sp.handle) melde('ok', 'Datei heruntergeladen um ' + uhr());
  };
  Sp.schliesse = function () { Sp.schluessel = null; aktuell = null; Sp.handle = null; Sp.dateiname = ''; Sp.ungesichert = false; clearTimeout(timer); melde('ok', 'Kein Projekt geöffnet'); };

  // ---------- Ordner-Überwachung ----------
  Sp.verbindeOrdner = async function (p) {
    var h = await window.showDirectoryPicker({ mode: 'read' });
    Sp.ordner = h; await Sp.lege('ordner:' + p.projektId, h);
    return h.name;
  };
  Sp.trenneOrdner = function (p) { Sp.ordner = null; return Sp.loesche('ordner:' + p.projektId); };
  /** → 'verbunden' | 'erlaubnis' (Klick nötig) | 'kein' */
  Sp.ordnerStatus = async function (p) {
    if (!Sp.ordnerMoeglich) return 'kein';
    if (!Sp.ordner) Sp.ordner = (await Sp.hole('ordner:' + p.projektId)) || null;
    if (!Sp.ordner) return 'kein';
    try { return (await Sp.ordner.queryPermission({ mode: 'read' })) === 'granted' ? 'verbunden' : 'erlaubnis'; } catch (e) { return 'kein'; }
  };
  Sp.ordnerErlauben = async function () { return Sp.ordner && (await Sp.ordner.requestPermission({ mode: 'read' })) === 'granted'; };
  /** Neue/geänderte CSV- und Excel-Dateien im Ordner (älteste zuerst). gesehen: { signatur: 1 } */
  Sp.neueDateien = async function (gesehen) {
    var out = [];
    if (!Sp.ordner) return out;
    for await (var e of Sp.ordner.values()) {
      if (e.kind !== 'file' || !/\.(csv|txt|xlsx|xlsm)$/i.test(e.name) || /^~\$/.test(e.name)) continue;
      var f = await e.getFile(), sig = f.name + '|' + f.size + '|' + f.lastModified;
      if (!gesehen[sig]) out.push({ datei: f, signatur: sig });
    }
    out.sort(function (a, b) { return a.datei.lastModified - b.datei.lastModified; });
    return out;
  };

  window.addEventListener('beforeunload', function (e) {
    if (aktuell && (laeuft || Sp.status.art === 'lauf' || (!Sp.handle && Sp.ungesichert))) { e.preventDefault(); e.returnValue = ''; }
  });
})(globalThis.AB = globalThis.AB || {});
