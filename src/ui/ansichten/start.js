/* Antragsbuch – Startseite: Projekt anlegen, öffnen, weiterarbeiten. */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h, Sp = AB.speicher, App = AB.app;
  function b64(s) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function wahl(icon, titel, text, klick) { return h('button.wahl', { type: 'button', onclick: klick }, D.icon(icon), h('div', null, h('b', null, titel), h('span', null, text))); }
  function fehler(e) { if (e && e.name === 'AbortError') return; console.error(e); D.toast(e.message || String(e), { krit: true }); }

  App.neuesProjekt = async function (jahr) {
    var p = AB.model.neuesProjekt(jahr);
    try {
      if (Sp.fsa) { if (!(await Sp.neuDatei(p))) return; }
      App.oeffne(p, Sp.handle, Sp.dateiname); Sp.plane(App.p);
      D.toast(Sp.fsa ? 'Projekt angelegt. Jede Änderung wird automatisch in der Datei gespeichert.' : 'Projekt angelegt. Dieser Browser kann nicht direkt in Dateien schreiben – bitte regelmäßig „Kopie herunterladen".');
      App.zeige('einstellungen');
    } catch (e) { fehler(e); }
  };
  App.oeffneProjekt = async function () {
    try {
      if (Sp.fsa) { var r = await Sp.oeffneDatei(); await App.oeffneMitSpiegel(r.projekt, r.handle, r.name); }
      else {
        var i = h('input', { type: 'file', accept: '.json', onchange: function () { if (i.files[0]) App.importiere([i.files[0]]); } });
        i.click();
      }
    } catch (e) { fehler(e); }
  };
  App.ladeBeispiel = async function () {
    try {
      var b = JSON.parse(document.getElementById('beispiel').textContent);
      b.projekt.geaendert = new Date().toISOString();
      App.oeffne(b.projekt, null, 'Beispielprojekt (synthetische Daten)');
      for (var i = 0; i < b.abrechnungen.length; i++) await App.importiereBytes(b64(b.abrechnungen[i].b64), b.abrechnungen[i].name, { still: true });
      await App.importiereBytes(b64(b.monatsscheiben.b64), b.monatsscheiben.name, { still: true });
      App.zeige('uebersicht');
    } catch (e) { fehler(e); }
  };

  AB.ansichten.start = { titel: 'Willkommen', unter: 'Offline-Antragsbuch – alle Daten bleiben auf diesem Gerät', zeige: function (el) {
    var jahr = new Date().getFullYear(), liste = h('div.raster.r-2');
    var jSel = D.auswahl([jahr - 1, jahr, jahr + 1].map(function (j) { return [j, String(j)]; }), jahr, null, { style: { width: '96px' }, onclick: function (e) { e.stopPropagation(); } });
    el.appendChild(h('div.start.rein', null,
      h('div.karte.held', null, h('h1', null, 'Antragsbuch'), h('p.muted', { style: { margin: '8px 0 0', maxWidth: '560px' } },
        'Anträge erfassen, Provisionsabrechnung einlesen, automatisch abgleichen. Die App arbeitet ohne Internet; Ihre Daten liegen in einer Projektdatei, die Sie selbst bestimmen.')),
      liste,
      Sp.fsa ? null : h('div.meldung.warn', null, 'Dieser Browser kann nicht direkt in Dateien speichern. Die App sichert automatisch im Browser; laden Sie zusätzlich regelmäßig eine Kopie herunter. Empfohlen: Microsoft Edge oder Google Chrome.')));
    Sp.hole('zuletzt').then(function (z) {
      if (z && z.projektId) liste.appendChild(wahl('funke', 'Weiterarbeiten', (z.name || 'Antragsbuch ' + z.jahr) + ' · zuletzt ' + new Date(z.wann).toLocaleDateString('de-DE'), async function () {
        try {
          if (z.handle) { var r = await Sp.leseHandle(z.handle); await App.oeffneMitSpiegel(r.projekt, r.handle, r.name); }
          else { var sp = await Sp.spiegel(z.projektId); if (!sp) throw new Error('Der gesicherte Stand wurde im Browser nicht mehr gefunden. Bitte die Projektdatei öffnen.'); App.oeffne(JSON.parse(sp.text), null, z.name); }
        } catch (e) { fehler(e); }
      }));
      liste.appendChild(wahl('ordner', 'Projekt öffnen', 'Vorhandene Projektdatei (.antragsbuch.json) auswählen', App.oeffneProjekt));
      liste.appendChild(h('button.wahl', { type: 'button', onclick: function () { App.neuesProjekt(+jSel.value); } }, D.icon('plus'),
        h('div', { style: { flex: 1 } }, h('b', null, 'Neues Projekt'), h('span', null, 'Speicherort wählen – danach wird automatisch gespeichert')), jSel));
      liste.appendChild(wahl('hilfe', 'Mit Beispieldaten ausprobieren', 'Erfundene Anträge und Abrechnungen, nichts wird überschrieben', App.ladeBeispiel));
    });
  } };
})(globalThis.AB = globalThis.AB || {});
