#!/usr/bin/env node
/* Bündelt alle Quellen zu EINER Datei: antragsbuch.html (HTML + CSS + JS inline, keine Abhängigkeiten). */
const fs = require('fs'), path = require('path');
const r = (...p) => fs.readFileSync(path.join(__dirname, ...p), 'utf8');
const KERN = ['util', 'csv', 'xlsx', 'statement', 'provision', 'model', 'abgleich', 'kennzahlen', 'team', 'vdienst', 'xlsxout', 'tarifdaten', 'tarif', 'leben', 'krypto', 'altbuch', 'bonus', 'lizenz', 'aktionen', 'analyse', 'bank', 'import'];
const UI = ['dom', 'akzent', 'diagramme', 'tabelle', 'speicher', 'app', 'maske', 'kunde', 'reklamation', 'tour',
  'ansichten/start', 'ansichten/uebersicht', 'ansichten/antraege', 'ansichten/abgleich', 'ansichten/vdienst', 'ansichten/team', 'ansichten/bonus', 'ansichten/aktionen', 'ansichten/analyse', 'ansichten/banken', 'ansichten/einstellungen', 'ansichten/hilfe'];

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

function buendle(k, u, w) {
  for (const [name, text] of [['Kern', k], ['UI', u], ['Worker', w]])
    if (/<\/script/i.test(text)) throw new Error(name + ': Quelltext enthält "</script" – das würde die HTML-Datei zerstören.');
  let html = r('src', 'index.html');
  const setze = (marke, inhalt) => { if (!html.includes(marke)) throw new Error('Marke fehlt: ' + marke); html = html.split(marke).join(inhalt); };
  setze('/*__CSS__*/', css); setze('/*__KERN__*/', k); setze('/*__WORKER__*/', w); setze('/*__BEISPIEL__*/', beispiel); setze('/*__UI__*/', u);
  return html;
}
const html = buendle(kern, ui, worker);
fs.writeFileSync(path.join(__dirname, 'antragsbuch.html'), html);
console.log('antragsbuch.html geschrieben:', Math.round(html.length / 1024), 'kB');

// Verteil-Version: Quelltext verkleinert und Namen gekürzt (erschwert das Lesen, verhindert es nicht).
// Aufruf: node build.js --schutz   (braucht die Entwicklungsabhängigkeit „terser")
if (process.argv.includes('--schutz')) {
  (async () => {
    const { minify } = require('terser');
    const klein = async (code) => (await minify(code, { compress: { passes: 2 }, mangle: true, format: { comments: false } })).code.replace(/<\/script/gi, '<\\/script');
    const min = buendle(await klein(kern), await klein(ui), await klein(worker)).replace(/<style>([\s\S]*?)<\/style>/, (m, c) => '<style>' + c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, '').replace(/\s*([{};,>])\s*/g, '$1') + '</style>');
    fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'dist', 'antragsbuch.html'), min);
    console.log('dist/antragsbuch.html geschrieben (Verteil-Version):', Math.round(min.length / 1024), 'kB');
  })().catch((e) => { console.error(e); process.exit(1); });
}

// Lizenz-Werkzeug (nur für den Herausgeber): eigene, kleine Datei
const wz = r('src', 'werkzeug', 'lizenz.html').split('/*__KERN__*/').join(['util', 'csv', 'krypto', 'lizenz'].map((k) => r('src', 'core', k + '.js')).join('\n'));
fs.writeFileSync(path.join(__dirname, 'lizenz-werkzeug.html'), wz);
console.log('lizenz-werkzeug.html geschrieben:', Math.round(wz.length / 1024), 'kB');

