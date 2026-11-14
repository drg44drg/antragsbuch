#!/usr/bin/env node
/* Bündelt alle Quellen zu EINER Datei: antragsbuch.html (HTML + CSS + JS inline, keine Abhängigkeiten). */
const fs = require('fs'), path = require('path');
const r = (...p) => fs.readFileSync(path.join(__dirname, ...p), 'utf8');
const KERN = ['util', 'csv', 'xlsx', 'statement', 'provision', 'model', 'abgleich', 'kennzahlen', 'team', 'vdienst', 'xlsxout', 'tarif', 'import'];
const UI = ['dom', 'diagramme', 'tabelle', 'speicher', 'app', 'maske', 'kunde', 'reklamation', 'tour',
  'ansichten/start', 'ansichten/uebersicht', 'ansichten/antraege', 'ansichten/abgleich', 'ansichten/vdienst', 'ansichten/team', 'ansichten/einstellungen', 'ansichten/hilfe'];

const kern = KERN.map((k) => r('src', 'core', k + '.js')).join('\n');
const ui = UI.filter((u) => fs.existsSync(path.join(__dirname, 'src', 'ui', u + '.js'))).map((u) => r('src', 'ui', u + '.js')).join('\n');
const worker = r('src', 'worker.js'), css = r('src', 'ui', 'styles.css');

// Beispieldaten (synthetisch) zum Ausprobieren ohne eigene Dateien
const { erzeuge } = require('./tools/testdaten.js');
const t = erzeuge();
const beispiel = JSON.stringify({
  projekt: JSON.parse(t.dateien['beispielprojekt.antragsbuch.json'].toString('utf8')),
  abrechnungen: ['abrechnung_2026_01.csv', 'abrechnung_2026_01-02.csv', 'abrechnung_2026_01-03.csv'].map((n) => ({ name: n, b64: t.dateien[n].toString('base64') })),
  monatsscheiben: { name: 'monatsscheiben.xlsx', b64: t.dateien['monatsscheiben.xlsx'].toString('base64') }
}).replace(/</g, '\\u003c');

for (const [name, text] of [['Kern', kern], ['UI', ui], ['Worker', worker]])
  if (/<\/script/i.test(text)) throw new Error(name + ': Quelltext enthält "</script" – das würde die HTML-Datei zerstören.');

let html = r('src', 'index.html');
const setze = (marke, inhalt) => { if (!html.includes(marke)) throw new Error('Marke fehlt: ' + marke); html = html.split(marke).join(inhalt); };
setze('/*__CSS__*/', css); setze('/*__KERN__*/', kern); setze('/*__WORKER__*/', worker); setze('/*__BEISPIEL__*/', beispiel); setze('/*__UI__*/', ui);
fs.writeFileSync(path.join(__dirname, 'antragsbuch.html'), html);
console.log('antragsbuch.html geschrieben:', Math.round(html.length / 1024), 'kB');
