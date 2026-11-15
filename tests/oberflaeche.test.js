/* Prüft die gebündelte antragsbuch.html im echten Browser (wird übersprungen, wenn Playwright fehlt). */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path'), os = require('os');
let chromium = null;
try { chromium = require('playwright').chromium; } catch (e) { /* kein Playwright */ }
// Mit ANTRAGSBUCH_HTML=dist/antragsbuch.html lässt sich dieselbe Testreihe gegen die Verteil-Version fahren.
const HTML = path.resolve(__dirname, '..', process.env.ANTRAGSBUCH_HTML || 'antragsbuch.html');
const { erzeuge, KOPF, zeile } = require('../tools/testdaten.js');

test('antragsbuch.html: eine Datei, keine externen Adressen, Netzwerk per CSP gesperrt', () => {
  const html = fs.readFileSync(HTML, 'utf8');
  assert.match(html, /Content-Security-Policy" content="default-src 'none'[^"]*connect-src 'none'/);
  // erlaubt: feste Format-Kennungen von SVG und Excel (Namensräume, keine Verbindungen)
  const ohne = html.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '').replace(/http:\/\/schemas\.openxmlformats\.org\/[\w\/-]+/g, '');
  assert.doesNotMatch(ohne, /https?:\/\//, 'keine URL im Bündel');
  assert.doesNotMatch(ohne, /<script[^>]+src=|<link[^>]+href=|<img[^>]+src=|@import/i, 'keine nachgeladenen Dateien');
  assert.doesNotMatch(ohne, /[^L]url\((?!#)/, 'kein CSS-url() auf fremde Dateien');
  assert.doesNotMatch(ohne, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts/, 'keine Netzwerk-Aufrufe');
});

test('Oberfläche im Browser', { skip: !chromium && 'Playwright nicht installiert', timeout: 180000 }, async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'antragsbuch-'));
  const d = erzeuge();
  for (const [n, b] of Object.entries(d.dateien)) fs.writeFileSync(path.join(tmp, n), b);
  const gross = [KOPF.join(';')];
  for (let i = 0; i < 52000; i++) gross.push(zeile({ vnr: String(100000 + (i % 30000)), name: 'MUSTER, ANNA', tarif: 'T' + (i % 40), mbd: (i % 97) + 0.5, bdat: '2026-0' + (1 + i % 9) + '-15',
    art: i % 20 ? 'Hierarchie' : 'Abschluss', beteil: '9001' + (10 + i % 30) + ' (Geschrieben, als Bestandsinhaber)' }).join(';'));
  fs.writeFileSync(path.join(tmp, 'gross.csv'), Buffer.from(gross.join('\r\n'), 'latin1'));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'de-DE', acceptDownloads: true });
  await ctx.addInitScript(() => { delete window.showSaveFilePicker; delete window.showOpenFilePicker; delete window.showDirectoryPicker; });
  const page = await ctx.newPage();
  const fehler = [], anfragen = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });
  page.on('request', (r) => anfragen.push(r.url()));
  const zahl = async (sel) => page.locator(sel).count();
  const nav = (name) => page.click(`#nav button:has-text("${name}")`);
  const einlesen = (datei) => page.setInputFiles('#schalter input[type=file]', path.join(tmp, datei));
  try {
    await page.goto('file://' + HTML);
    await t.test('Start: Fallback-Hinweis ohne File System Access API', async () => {
      await page.waitForSelector('text=Neues Projekt');
      assert.equal(await zahl('text=kann nicht direkt in Dateien speichern'), 1);
    });
    await t.test('Neues Projekt, Antrag per Tastatur, Pflichtfelder, Dublette, Suche', async () => {
      await page.click('button.wahl:has-text("Neues Projekt")');
      await page.waitForSelector('h1:has-text("Einstellungen")');
      await page.fill('label.feld:has-text("Vermittlernummer") input', '900999');
      await page.keyboard.press('Tab');
      await nav('Anträge');
      await page.keyboard.press('n');
      await page.waitForSelector('dialog[open]');
      await page.keyboard.type('Muster'); await page.keyboard.press('Enter');
      assert.match(await page.textContent('dialog .meldung.krit'), /Vorname.*fehlt[\s\S]*Tarif fehlt[\s\S]*Beitrag fehlt/);
      assert.ok(await zahl('dialog input.fehler') >= 3);
      assert.match(await page.textContent('dialog .meldung.krit'), /Neuversicherung \(neue Person\) oder aus dem Bestand/);
      await page.selectOption('dialog select[data-feld="herkunft"]', 'neu');
      await page.fill('dialog input[data-feld="vn.vorname"]', 'Anna');
      await page.fill('dialog .pos-zeile input[placeholder="Tarif"]', 'A107');
      await page.fill('dialog .pos-zeile input[placeholder="0,00"]', '123,45');
      assert.match(await page.textContent('dialog .leiste .klein.muted'), /erwartete Provision\s*678,98 €/);
      await page.keyboard.press('Control+Enter');               // speichern & nächster
      await page.waitForSelector('dialog[open] h2:has-text("Neuer Antrag")');
      await page.fill('dialog input[data-feld="vn.name"]', 'Muster'); await page.fill('dialog input[data-feld="vn.vorname"]', 'Anna');
      await page.fill('dialog .pos-zeile input[placeholder="Tarif"]', 'A107'); await page.fill('dialog .pos-zeile input[placeholder="0,00"]', '123,45');
      await page.selectOption('dialog select[data-feld="herkunft"]', 'bestand');
      await page.keyboard.press('Enter');
      assert.match(await page.textContent('dialog .meldung.warn'), /Mögliche Dublette/);
      await page.fill('dialog .pos-zeile input[placeholder="0,00"]', '-20');   // negativer Beitrag erlaubt
      await page.keyboard.press('Enter');
      await page.waitForSelector('dialog[open]', { state: 'detached' });
      assert.equal(await zahl('.vt-zeile'), 2);
      await page.fill('.suche input', 'muster 123,45');
      assert.equal(await zahl('.vt-zeile'), 1);
      await page.fill('.suche input', 'gibtsnicht');
      assert.equal(await zahl('.vt-zeile'), 0);
      await page.fill('.suche input', '');
      assert.match(await page.textContent('#speichertext'), /Im Browser gesichert um \d\d:\d\d|Speichert/);
    });
    await t.test('Neustart: Stand wird aus dem Browser-Spiegel wiederhergestellt', async () => {
      await page.waitForFunction(() => /gesichert um/.test(document.getElementById('speichertext').textContent));
      await page.reload();
      await page.click('button.wahl:has-text("Weiterarbeiten")');
      await nav('Anträge');
      assert.equal(await zahl('.vt-zeile'), 2);
    });
    await t.test('Beispielprojekt öffnen (Upload), Abrechnungen einlesen, fünf Listen', async () => {
      await einlesen('beispielprojekt.antragsbuch.json');
      await page.click('dialog button:has-text("Projekt öffnen")');
      await page.waitForSelector('h1:has-text("Übersicht")');
      for (const f of ['abrechnung_2026_01.csv', 'abrechnung_2026_01-02.csv', 'abrechnung_2026_01-03.csv']) {
        await einlesen(f);
        await page.waitForSelector(`#untertitel:has-text("${f}")`);
      }
      const reiter = await page.$$eval('.reiter button', (bs) => bs.map((b) => b.textContent));
      assert.equal(reiter[0], 'Gleich8'); assert.equal(reiter[1], 'Abweichung2'); assert.equal(reiter[3], 'Abgerechnet ohne Antrag5'); assert.equal(reiter[4], 'Storno2');
      assert.match(await page.textContent('.ablage'), /204 Zeilen.*67 neu/);
      // Vorschlag bestätigen
      await page.click('.reiter button:has-text("Offen")');
      await page.click('button:has-text("Bestätigen")');
      assert.equal((await page.$$eval('.reiter button', (bs) => bs.map((b) => b.textContent)))[0], 'Gleich9');
      // Buchung abhaken und als Antrag übernehmen
      await page.click('.reiter button:has-text("Abgerechnet ohne Antrag")');
      assert.equal(await zahl('.vt-zeile'), 4);
      await page.click('.vt-zeile:has-text("PROBE, DIETER") button[title^="Kein Antrag"]');
      assert.equal(await zahl('.vt-zeile'), 3);
      await page.click('.vt-zeile:has-text("DEMO, FRITZ") button:has-text("Antrag")');
      assert.equal((await page.$$eval('.reiter button', (bs) => bs.map((b) => b.textContent)))[0], 'Gleich10');
      await nav('Übersicht');
      await page.waitForFunction(() => document.querySelector('.kachel.akzent .wert').textContent.trim() === '18');
      assert.ok(await zahl('.dia svg') >= 3, 'Diagramme gezeichnet');
    });
    await t.test('Veränderungsdienst setzt „Policiert" und trägt die Vertragsnummer ein', async () => {
      await einlesen('veraenderungsdienst.csv');
      await page.waitForSelector('h3:has-text("Treffer prüfen")');
      await page.click('button:has-text("Treffer übernehmen")');
      await nav('Anträge'); await page.fill('.suche input', 'Vorlage Clara');
      const z = await page.textContent('.vt-zeile');
      assert.match(z, /0777001/); assert.match(z, /Policiert/);
    });
    await t.test('Monatsscheiben, Team-Ansicht, Management-Umschalter, Dunkelmodus, CSV-Export', async () => {
      await einlesen('monatsscheiben.xlsx');
      await page.waitForSelector('h1:has-text("Team")');
      assert.match(await page.textContent('.kachel.akzent'), /Platz \d[\s\S]*von 7/);
      await page.click('#schalter button:has-text("Management")');
      await page.waitForSelector('.adpliste');
      assert.ok(await zahl('.adp') >= 6);
      const vorher = await page.textContent('.kachel.akzent .neben');
      await page.click('.adp:has-text("900101") input');
      assert.notEqual(await page.textContent('.kachel.akzent .neben'), vorher);
      // ohne passende Nummer: Eingabefeld direkt im Teamvergleich
      await page.evaluate(() => { AB.app.p.einstellungen.modus = 'adp'; AB.app.p.einstellungen.vermittlernummer = ''; AB.app.zeige('team'); });
      assert.match(await page.textContent('.meldung.warn'), /sechsstellige Vermittlernummer/);
      await page.fill('.meldung.warn input', '900103'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => /Platz \d/.test(document.querySelector('.kachel.akzent').textContent));
      assert.match(await page.textContent('#inhalt'), /So entsteht die Rangfolge/);
      await page.evaluate(() => { AB.app.p.einstellungen.modus = 'mgmt'; AB.app.p.einstellungen.vermittlernummer = '900999'; AB.app.zeige('team'); });
      await page.click('#themaBtn'); assert.equal(await page.getAttribute('html', 'data-theme'), 'light');
      await page.click('#themaBtn'); assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(11, 10, 18)');
      const AB = require('./lade.js');
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.karte:has-text("Vergleichstabelle") button:has-text("Excel")')]);
      assert.match(dl.suggestedFilename(), /^ADP-Vergleich_2026\.xlsx$/);
      const mappe = await AB.xlsx.lies(new Uint8Array(fs.readFileSync(await dl.path())));
      assert.equal(mappe[0].name, 'ADP-Vergleich');
      assert.ok(mappe[0].zeilen.some((z) => z[0] === 'ADP' && z[2] === 'Neugeschäft'), 'Kopfzeile vorhanden');
      const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('.karte:has-text("Vergleichstabelle") button:has-text("Excel")', { modifiers: ['Shift'] })]);
      const csv = fs.readFileSync(await dl2.path());
      assert.deepEqual([...csv.subarray(0, 3)], [0xEF, 0xBB, 0xBF], 'CSV weiterhin möglich: UTF-8 mit BOM');
      assert.match(csv.toString('utf8'), /ADP;Nummer;Neugeschäft/);
      await page.click('#schalter button:has-text("ADP")');
    });
    await t.test('Ampel, Nachbearbeitung, Auswahl → Prioritätenliste als Excel, Kundensuche, Dashboard-Filter', async () => {
      const AB = require('./lade.js');
      await nav('Anträge'); await page.fill('.suche input', '');
      assert.ok(await zahl('.vt-zeile .ampel.rot') >= 3, 'überfällige Anträge sind rot');
      // Nachbearbeitung im Antrag eintragen
      await page.fill('.suche input', 'Platzhalter Anna'); await page.click('.vt-zeile .zwei');
      await page.selectOption('dialog label.feld:has-text("Nachbearbeitung") select', 'offen');
      await page.fill('dialog input[placeholder^="Was fehlt"]', 'Gesundheitsfragen nachgefordert');
      await page.keyboard.press('Enter');
      await page.waitForSelector('dialog[open]', { state: 'detached' });
      assert.match(await page.textContent('.vt-zeile'), /Nachbearbeitung: Gesundheitsfragen nachgefordert/);
      await page.fill('.suche input', '');
      await page.click('.chip:has-text("Nachbearbeitung")');
      assert.equal(await zahl('.vt-zeile'), 1);
      await page.click('.chip:has-text("Nachbearbeitung")');
      // Auswahl per Checkbox → Prioritätenliste
      await page.selectOption('select[title="Bearbeitungsampel"]', 'gelbrot');
      const n = await zahl('.vt-zeile');
      await page.click('.vt-kopf input[type=checkbox]');
      assert.match(await page.textContent('.auswahlleiste'), new RegExp('^' + n + ' Anträge'));
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.auswahlleiste button:has-text("Excel")')]);
      assert.match(dl.suggestedFilename(), /^Prioritaetenliste_\d{4}-\d\d-\d\d\.xlsx$/);
      const blatt = (await AB.xlsx.lies(new Uint8Array(fs.readFileSync(await dl.path()))))[0];
      const k = blatt.zeilen.findIndex((z) => z[0] === 'Ampel');
      assert.deepEqual(blatt.zeilen[k].slice(0, 8), ['Ampel', 'Eingang', 'Kunde', 'Vertragsnummer', 'Bereich', 'Vorgangsart', 'Tarif(e)', 'Monatsbeitrag']);
      assert.equal(blatt.zeilen.length, k + 1 + n + 1, 'eine Zeile je Antrag plus Summe');
      assert.ok(blatt.zeilen.some((z) => /OFFEN: Gesundheitsfragen/.test(z[11] || '')));
      await page.click('.auswahlleiste button:has-text("Auswahl aufheben")');
      await page.selectOption('select[title="Bearbeitungsampel"]', '');
      // Kundensuche: findet auch Kunden ohne Antrag (nur aus der Abrechnung)
      await page.keyboard.press('F4'); await page.keyboard.type('Probe Dieter');
      await page.waitForSelector('dialog .detail h3:has-text("Buchungen")');
      assert.match(await page.textContent('dialog .detail'), /120120[\s\S]*Kein Antrag erfasst[\s\S]*BE MAX/);
      await page.keyboard.press('Escape');
      await page.waitForSelector('dialog[open]', { state: 'detached' });
      await page.keyboard.press('F3'); await page.keyboard.type('012345');
      await page.waitForSelector('dialog .detail h3:has-text("Anträge (1)")');
      await page.click('dialog button:has-text("Schließen")');
      // Kurzüberblick und Dashboard-Filter nach Bereich
      await nav('Übersicht');
      await page.click('.kurz > button');
      assert.match(await page.textContent('.kurz-feld'), /wartet auf Policierung[\s\S]*Bearbeitungsampel[\s\S]*Produktion/);
      await page.keyboard.press('Escape');
      const alle = await page.evaluate(() => AB.app.kz.jahr.antraege);
      await page.selectOption('select[title="Nach Bereich filtern"]', 'zusatz');
      await page.waitForFunction((x) => { const w = +document.querySelector('.kachel.akzent .wert').textContent.trim(); return w > 0 && w < x; }, alle);
      assert.match(await page.textContent('.kachel.akzent .lbl'), /Zusatz/);
      await page.click('button:has-text("Filter aufheben")');
    });
    await t.test('Provisionsreklamation: vorausgefülltes Formular aus einer Abweichung, Vermerk im Antrag', async () => {
      await nav('Abgleich'); await page.click('.reiter button:has-text("Abweichung")');
      await page.click('.vt-zeile:has-text("Test, Dieter") button:has-text("Reklamieren")');
      await page.waitForSelector('dialog .rekla');
      const formular = await page.textContent('dialog .rekla');
      assert.match(formular, /Provisionsreklamation[\s\S]*Angaben zum Vertriebspartner[\s\S]*Angaben zur Reklamation[\s\S]*Bearbeitungsvermerk/);
      assert.match(formular, /Mitgliedsnummer:\s*250250/); assert.match(formular, /AB1F/);
      assert.match(formular, /erhalten in EUR:\s*100,00/); assert.match(formular, /Anspruch Provision\/Produktion in EUR:\s*120,00/);
      assert.match(formular, /Provision abweichend: erwartet 120,00 €, abgerechnet 100,00 €/);
      assert.match(formular, /Aus Abrechnung vom \(mm\/yy\):\s*03\/26/);
      await page.fill('dialog label.feld:has-text("Begründung") input', 'Faktor 3,0 laut Vereinbarung');
      assert.match(await page.textContent('dialog .rekla'), /Faktor 3,0 laut Vereinbarung/);
      await page.click('dialog button:has-text("Nur vermerken")');
      await page.waitForSelector('dialog[open]', { state: 'detached' });
      assert.equal(await page.evaluate(() => AB.app.p.antraege.find((a) => a.id === 'a-3').reklamation.begruendung), 'Faktor 3,0 laut Vereinbarung');
      assert.equal(await page.evaluate(() => AB.app.p.antraege.find((a) => a.id === 'a-3').status), 'abgerechnet');
      await nav('Übersicht');
      assert.equal(await zahl('.hinweis:has-text("1 Reklamation offen")'), 1);
      // Druckansicht: Formular steht im Druckbereich (window.print wird im Test abgefangen)
      await page.evaluate(() => { window.print = () => { window.__gedruckt = document.getElementById('druck').textContent; }; });
      await nav('Anträge'); await page.click('.chip:has-text("Reklamiert")');
      assert.equal(await zahl('.vt-zeile'), 1);
      await page.click('.vt-zeile input[type=checkbox]'); await page.click('.auswahlleiste button:has-text("Reklamation")');
      await page.click('dialog button:has-text("Drucken / PDF")');
      assert.match(await page.evaluate(() => window.__gedruckt), /Provisionsreklamation[\s\S]*250250[\s\S]*Faktor 3,0 laut Vereinbarung/);
      await page.click('.chip:has-text("Reklamiert")');
    });
    await t.test('Neue Reiter: Meine Produktion, Bonus, Aktionen mit Kundenliste', async () => {
      await nav('Meine Produktion');
      await page.waitForSelector('.kachel.akzent:has-text("Meine Nettoproduktion")'); await page.waitForSelector('.kachel:has-text("Mein Netto-Beitrag")');
      assert.ok(await zahl('.dia svg') >= 3); assert.match(await page.textContent('#inhalt'), /Meine Produktion nach Kategorie[\s\S]*Summe/);
      await nav('Bonus');
      await page.fill('label.feld:has-text("KV-Bestand") input', '373185'); await page.keyboard.press('Tab');
      await page.fill('label.feld:has-text("KV-Nettoproduktion") input', '4485'); await page.keyboard.press('Tab');
      await page.fill('label.feld:has-text("Nettoproduktion gesamt") input', '4607'); await page.keyboard.press('Tab');
      assert.match(await page.textContent('#inhalt'), /Was fehlt noch\?[\s\S]*3\.725 €[\s\S]*1\.393 €/);
      await nav('Aktionen'); await page.click('button:has-text("Erste Aktion anlegen")');
      await page.fill('dialog input[placeholder^="z. B. Anschreiben"]', 'Mailing Test'); await page.keyboard.press('Enter');
      await page.waitForSelector('h1:has-text("Mailing Test")');
      const liste = path.join(tmp, 'kunden.csv');
      fs.writeFileSync(liste, '\ufeffMitgliedsnummer;Name VN;Ort VN\r\n012345;MUSTER, ANNA;Musterstadt\r\n200200;PROBE, CLARA;Probedorf\r\n300300;BEISPIEL, BERND;Beispielhausen\r\n');
      await page.setInputFiles('#inhalt input[type=file]', liste);
      await page.waitForSelector('dialog:has-text("3 Kunden erkannt")'); await page.click('dialog button:has-text("Übernehmen")');
      assert.equal(await zahl('.vt-zeile'), 3);
      await page.selectOption('.vt-zeile:has-text("MUSTER, ANNA") select >> nth=0', 'T');
      await page.selectOption('.vt-zeile:has-text("PROBE, CLARA") select >> nth=0', 'O');
      await nav('Aktionen');
      assert.match(await page.textContent('.kachel:has-text("Kontaktiert") .wert'), /1/); assert.match(await page.textContent('.kachel:has-text("Nicht erreicht") .wert'), /1/);
      assert.match(await page.textContent('.kachel:has-text("Nicht bearbeitet") .wert'), /1/);
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#inhalt button:has-text("Excel")')]);
      assert.match(dl.suggestedFilename(), /^Aktion_Mailing_Test\.xlsx$/);
    });
    await t.test('Hilfe: Ablauf-Schaubild, FAQ-Suche und geführte Tour', async () => {
      await nav('Hilfe');
      assert.equal(await zahl('.prozess-schritt'), 5); assert.equal(await zahl('.prozess-pfeil'), 4);
      await page.click('.prozess-schritt:has-text("Abrechnung einlesen")');
      assert.match(await page.textContent('.prozess-detail'), /kumuliert seit Januar[\s\S]*Wann[\s\S]*Datei/);
      assert.equal(await zahl('.prozess-schritt.aktiv'), 1); assert.equal(await zahl('.prozess-schritt.fertig'), 2);
      await page.fill('.karte:has-text("Häufige Fragen") input', 'kumuliert');
      assert.ok(await zahl('.faq details') >= 1 && await zahl('.faq details') < 5);
      assert.match(await page.textContent('.faq'), /lese ich etwas doppelt ein/);
      await page.fill('.karte:has-text("Häufige Fragen") input', '');
      assert.ok(await zahl('.faq details') >= 12);
      // Tour: läuft durch alle Schritte, wechselt die Ansichten und endet sauber
      await page.click('button:has-text("Tour starten")');
      const schritte = await page.evaluate(() => AB.tour.SCHRITTE.length);
      const ansichten = new Set();
      for (let i = 0; i < schritte; i++) {
        assert.match(await page.textContent('.tour-karte'), new RegExp('Schritt ' + (i + 1) + ' von ' + schritte));
        ansichten.add(await page.evaluate(() => AB.app.ansicht));
        await page.waitForTimeout(420);
        const sel = await page.evaluate((n) => AB.tour.SCHRITTE[n].sel || '', i);
        if (sel) { const b = await page.evaluate(() => { const r = document.querySelector('.tour-licht').getBoundingClientRect(); return r.width * r.height; }); assert.ok(b > 400, 'Schritt ' + (i + 1) + ' hebt „' + sel + '" hervor'); }
        const k = await page.evaluate(() => { const r = document.querySelector('.tour-karte').getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; });
        assert.ok(k, 'Tour-Karte liegt in Schritt ' + (i + 1) + ' vollständig im Fenster');
        await page.keyboard.press('ArrowRight');
      }
      await page.waitForSelector('#tour', { state: 'detached' });
      assert.ok(ansichten.size >= 5, 'Tour führt durch mehrere Bereiche');
      await page.click('button:has-text("Tour starten")'); await page.keyboard.press('Escape');
      await page.waitForSelector('#tour', { state: 'detached' });
    });
    await t.test('52.000 Zeilen: Import im Worker, virtuelle Liste bleibt klein', async () => {
      const t0 = Date.now();
      await einlesen('gross.csv');
      await page.waitForSelector('#untertitel:has-text("gross.csv")', { timeout: 60000 });
      const dauer = Date.now() - t0;
      assert.match(await page.textContent('.ablage'), /52\.000 Zeilen/);
      assert.equal(await page.evaluate(() => AB.app.mitWorker()), true, 'Import läuft im Web Worker');
      for (const art of ['Hierarchie']) await page.click(`.chip:has-text("${art}")`);
      await page.click('.reiter button:has-text("Abgerechnet ohne Antrag")');
      const anzahl = +(await page.textContent('.reiter button.aktiv .zahl'));
      assert.ok(anzahl > 20000, 'viele Bündel: ' + anzahl);
      assert.ok(await zahl('.vt-zeile') < 60, 'nur sichtbare Zeilen im DOM');
      await page.evaluate(() => { document.querySelector('.vt-rumpf').scrollTop = 500000; });
      await page.waitForTimeout(200);
      assert.ok(await zahl('.vt-zeile') > 5 && await zahl('.vt-zeile') < 60);
      assert.ok(dauer < 30000, 'Import dauerte ' + dauer + ' ms');
      t.diagnostic('Import 52.000 Zeilen im Browser: ' + dauer + ' ms');
    });
    await t.test('keine Fehler, keine Netzwerkzugriffe', async () => {
      assert.deepEqual(fehler, []);
      assert.deepEqual(anfragen.filter((u) => !/^(file|blob|data):/.test(u)), []);
    });
  } finally { await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('Speichern in die Projektdatei (File System Access API, nachgestellt) und Wiederherstellung', { skip: !chromium && 'Playwright nicht installiert', timeout: 60000 }, async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'de-DE' })).newPage();
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  await page.addInitScript(() => {
    // Nachgestellte Datei: merkt sich, was geschrieben wurde
    const griff = (holeText) => ({ name: 'Antragsbuch_Test.antragsbuch.json', queryPermission: async () => 'granted', requestPermission: async () => 'granted',
      getFile: async () => ({ text: async () => holeText() }),
      createWritable: async () => ({ write: async (t) => { window.__datei = t; window.__schreibvorgaenge = (window.__schreibvorgaenge || 0) + 1; }, close: async () => {} }) });
    window.showSaveFilePicker = async () => griff(() => window.__datei);
    window.showOpenFilePicker = async () => [griff(() => window.__alt)];
    // Nachgestellter Ordner mit Dateien aus window.__ordner = [{ name, b64, geaendert }]
    window.showDirectoryPicker = async () => ({ name: 'Abrechnungen', queryPermission: async () => 'granted', requestPermission: async () => 'granted',
      values: async function* () {
        for (const d of window.__ordner || []) {
          const bin = atob(d.b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
          yield { kind: 'file', name: d.name, getFile: async () => new File([u], d.name, { lastModified: d.geaendert }) };
        }
        yield { kind: 'directory', name: 'Archiv' };
      } });
  });
  try {
    await page.goto('file://' + HTML);
    assert.equal(await page.locator('text=kann nicht direkt in Dateien speichern').count(), 0);
    await page.click('button.wahl:has-text("Neues Projekt")');
    await page.waitForFunction(() => /^Gespeichert um \d\d:\d\d$/.test(document.getElementById('speichertext').textContent));
    const erst = JSON.parse(await page.evaluate(() => window.__datei));
    assert.equal(erst.format, 'antragsbuch'); assert.equal(erst.schema, 1); assert.equal(erst.antraege.length, 0);
    // Nach dem Anlegen steht der Cursor im Feld Vermittlernummer (Pflicht für den Teamvergleich)
    assert.equal(await page.evaluate(() => document.activeElement.placeholder), 'z. B. 900402');
    // Änderung → Autosave schreibt in die Datei
    await page.click('#nav button:has-text("Anträge")');
    await page.keyboard.press('n');
    await page.fill('dialog input[data-feld="vn.name"]', 'Muster'); await page.fill('dialog input[data-feld="vn.vorname"]', 'Anna');
    await page.fill('dialog .pos-zeile input[placeholder="Tarif"]', 'A107'); await page.fill('dialog .pos-zeile input[placeholder="0,00"]', '50');
    await page.selectOption('dialog select[data-feld="herkunft"]', 'neu');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => JSON.parse(window.__datei).antraege.length === 1);
    await page.waitForFunction(() => /^Gespeichert um/.test(document.getElementById('speichertext').textContent));
    const zwei = JSON.parse(await page.evaluate(() => window.__datei));
    assert.equal(zwei.antraege[0].vn.name, 'Muster'); assert.deepEqual(zwei.abrechnung, { felder: [], zeilen: [] });
    assert.ok(zwei.tarife.some((t) => t.name === 'A107'), 'Tarifliste erweitert sich aus Anträgen');
    // Datei ist älter als der Browser-Spiegel → Wiederherstellung wird angeboten
    await page.evaluate((alt) => { window.__alt = alt; }, JSON.stringify(Object.assign({}, erst, { geaendert: '2020-01-01T00:00:00.000Z' })));
    await page.click('#nav button:has-text("Einstellungen")'); await page.click('button:has-text("Projekt schließen")');
    await page.click('button.wahl:has-text("Projekt öffnen")');
    await page.waitForSelector('dialog h2:has-text("Neuerer Stand gefunden")');
    await page.click('dialog button:has-text("Neueren Stand wiederherstellen")');
    await page.click('#nav button:has-text("Anträge")');
    assert.equal(await page.locator('.vt-zeile').count(), 1);
    // Ordner verbinden: neue Dateien werden automatisch erkannt und in zeitlicher Reihenfolge eingelesen
    const d = erzeuge(), b64 = (n) => d.dateien[n].toString('base64');
    await page.evaluate((o) => { window.__ordner = o; }, [
      { name: 'abrechnung_2026_01-02.csv', b64: b64('abrechnung_2026_01-02.csv'), geaendert: 2000 },
      { name: 'abrechnung_2026_01.csv', b64: b64('abrechnung_2026_01.csv'), geaendert: 1000 },
      { name: 'notiz.docx', b64: 'QUJD', geaendert: 3000 }]);
    await page.click('#nav button:has-text("Einstellungen")');
    await page.click('button:has-text("Ordner verbinden")');
    await page.waitForFunction(() => AB.app.p.importe.length === 2);
    assert.deepEqual(await page.evaluate(() => AB.app.p.importe.map((i) => [i.datei, i.zeilen, i.neu])), [['abrechnung_2026_01.csv', 69, 69], ['abrechnung_2026_01-02.csv', 137, 69]]);
    // erneutes Prüfen liest nichts doppelt; eine neue Datei wird beim nächsten Prüfen geholt
    await page.evaluate((x) => { window.__ordner.push(x); }, { name: 'abrechnung_2026_01-03.csv', b64: b64('abrechnung_2026_01-03.csv'), geaendert: 4000 });
    await page.click('button:has-text("Jetzt prüfen")');
    await page.waitForFunction(() => AB.app.p.importe.length === 3);
    await page.click('button:has-text("Jetzt prüfen")');
    await page.waitForSelector('.toast:has-text("Keine neuen Dateien")');
    assert.equal(await page.evaluate(() => AB.app.p.importe.length), 3);
    assert.equal(await page.evaluate(() => AB.app.p.sicherungen.length >= 3), true, 'Sicherungsstand vor jedem Import');
    // Passwortschutz: Datei wird verschlüsselt geschrieben; Öffnen verlangt das Passwort
    await page.click('#nav button:has-text("Einstellungen")');
    await page.click('button:has-text("Passwortschutz einschalten")');
    await page.fill('dialog input[type=password] >> nth=0', 'kurz'); await page.fill('dialog input[type=password] >> nth=1', 'kurz');
    await page.click('dialog button:has-text("Schutz einschalten")');
    assert.match(await page.textContent('dialog .meldung.krit'), /mindestens 8 Zeichen/);
    await page.fill('dialog input[type=password] >> nth=0', 'Geheim-2026!'); await page.fill('dialog input[type=password] >> nth=1', 'Geheim-2026!');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => { try { return JSON.parse(window.__datei).verschluesselt === 1; } catch (e) { return false; } });
    const umschlag = await page.evaluate(() => window.__datei);
    assert.ok(!umschlag.includes('Muster') && !umschlag.includes('antraege') && !umschlag.includes('MUSTER'), 'keine Kundendaten im Klartext');
    assert.match(await page.textContent('#speichertext'), /verschlüsselt/);
    const spiegel = await page.evaluate(async () => (await AB.speicher.spiegel(AB.app.p.projektId)).text);
    assert.ok(!spiegel.includes('Muster'), 'auch die Browser-Sicherung ist verschlüsselt');
    const vorher = await page.evaluate(() => AB.app.p.antraege.length);
    await page.evaluate(() => { window.__alt = window.__datei; });
    await page.click('button:has-text("Projekt schließen")');
    await page.click('button.wahl:has-text("Projekt öffnen")');
    await page.waitForSelector('dialog h2:has-text("Projekt ist geschützt")');
    await page.fill('dialog input[type=password]', 'falsches-passwort'); await page.keyboard.press('Enter');
    await page.waitForSelector('dialog .meldung.krit:has-text("stimmt nicht")');
    await page.fill('dialog input[type=password]', 'Geheim-2026!'); await page.keyboard.press('Enter');
    await page.waitForSelector('h1:has-text("Übersicht")');
    assert.equal(await page.evaluate(() => AB.app.p.antraege.length), vorher);
    // weitere Änderungen bleiben verschlüsselt
    await page.evaluate(() => { AB.app.p.einstellungen.name = 'Geheimname'; AB.app.geaendert(); });
    await page.waitForFunction(() => /^Gespeichert um .*verschlüsselt/.test(document.getElementById('speichertext').textContent));
    assert.ok(!(await page.evaluate(() => window.__datei)).includes('Geheimname'));
    assert.deepEqual(fehler, []);
  } finally { await browser.close(); }
});

test('Lizenz: Werkzeug erzeugt Schlüssel und prägt die App; App prüft Testzeitraum, Schlüssel und Lesemodus', { skip: !chromium && 'Playwright nicht installiert', timeout: 90000 }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'antragsbuch-liz-'));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 }, locale: 'de-DE', acceptDownloads: true });
  const fehler = [];
  try {
    // --- Werkzeug ---
    const wz = await ctx.newPage(); wz.on('pageerror', (e) => fehler.push('Werkzeug: ' + e.message));
    const anfragen = []; wz.on('request', (q) => anfragen.push(q.url()));
    await wz.goto('file://' + path.join(__dirname, '..', 'lizenz-werkzeug.html'));
    assert.equal(await wz.isDisabled('#ausstellen'), true);
    await wz.fill('#pw', 'Werkzeug-Passwort-1');
    const [d1] = await Promise.all([wz.waitForEvent('download'), wz.click('#neu')]);
    const keyDatei = path.join(tmp, 'schluessel.json'); await d1.saveAs(keyDatei);
    const kd = JSON.parse(fs.readFileSync(keyDatei, 'utf8'));
    assert.equal(kd.format, 'antragsbuch-lizenzschluessel'); assert.equal(kd.verschluesselt, 1); assert.ok(!('d' in kd) && !JSON.stringify(kd).includes('"d"'), 'geheimer Schlüssel liegt nur verschlüsselt in der Datei');
    await wz.fill('#test', '20'); await wz.fill('#inhaber', 'Herausgeber Test');
    const [d2] = await Promise.all([wz.waitForEvent('download'), wz.setInputFiles('#appDatei', HTML)]);
    const app = path.join(tmp, 'antragsbuch.html'); await d2.saveAs(app);
    assert.match(fs.readFileSync(app, 'utf8'), /<script id="lizenz" type="application\/json">\{"pub":\{/);
    const stelle = async (nr, bis) => { await wz.fill('#nr', nr); await wz.fill('#name', 'Test, ADP'); await wz.fill('#bis', bis); await wz.click('#ausstellen'); return wz.inputValue('#ausgabe'); };
    const jahr = new Date().getFullYear();
    const gut = await stelle('900999', (jahr + 1) + '-12-31'), abgelaufen = await stelle('900999', (jahr - 1) + '-12-31'), fremd = await stelle('900123', (jahr + 1) + '-12-31');
    assert.match(gut, /^AB1-/); assert.equal(await wz.locator('#liste tbody tr').count(), 3);
    // Schlüsseldatei wieder laden: falsches Passwort wird abgewiesen
    await wz.reload(); await wz.fill('#pw', 'falsch-falsch');
    await wz.setInputFiles('#ladenDatei', keyDatei); await wz.waitForSelector('#keyStatus.krit:has-text("stimmt nicht")');
    await wz.fill('#pw', 'Werkzeug-Passwort-1'); await wz.setInputFiles('#ladenDatei', keyDatei); await wz.waitForSelector('#keyStatus.gut');
    assert.deepEqual(anfragen.filter((u) => !/^(file|blob|data):/.test(u)), []);
    // --- geprägte App ---
    const page = await ctx.newPage(); page.on('pageerror', (e) => fehler.push('App: ' + e.message));
    await page.addInitScript(() => { delete window.showSaveFilePicker; delete window.showOpenFilePicker; delete window.showDirectoryPicker; });
    await page.goto('file://' + app);
    await page.click('text=Mit Beispieldaten ausprobieren');
    await page.waitForSelector('#lizenzleiste:has-text("Testzeitraum: noch 20 Tage")');
    assert.equal(await page.evaluate(() => AB.app.nurLesen), false);
    const trage = async (key) => { await page.click('#nav button:has-text("Einstellungen")'); await page.fill('.karte:has(h3:has-text("Lizenz")) textarea', key); await page.click('button:has-text("Schlüssel übernehmen")'); await page.waitForTimeout(400); };
    await trage(gut);
    assert.equal(await page.evaluate(() => AB.app.lizenz.modus), 'gueltig'); assert.equal(await page.isHidden('#lizenzleiste'), true);
    assert.match(await page.textContent('.karte:has(h3:has-text("Lizenz"))'), /gültig[\s\S]*Test, ADP[\s\S]*Herausgeber Test/);
    await trage(fremd);
    assert.equal(await page.evaluate(() => AB.app.lizenz.modus), 'test', 'fremde Nummer: im Testzeitraum weiter nutzbar, aber als ungültig gemeldet');
    assert.match(await page.textContent('#lizenzleiste'), /gehört zur Vermittlernummer 900123/);
    // Testzeitraum vorbei + abgelaufener Schlüssel → Lesemodus
    await page.evaluate(() => { localStorage.setItem('antragsbuch-erststart', '2020-01-01'); });
    await trage(abgelaufen);
    assert.equal(await page.evaluate(() => AB.app.nurLesen), true);
    await page.waitForSelector('#lizenzleiste.krit:has-text("Lesemodus")');
    const anzahl = await page.evaluate(() => AB.app.p.antraege.length);
    await page.click('#nav button:has-text("Anträge")'); await page.keyboard.press('n');
    await page.fill('dialog input[data-feld="vn.name"]', 'Gesperrt'); await page.fill('dialog input[data-feld="vn.vorname"]', 'Test');
    await page.fill('dialog .pos-zeile input[placeholder="Tarif"]', 'A107'); await page.fill('dialog .pos-zeile input[placeholder="0,00"]', '10');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.toast.krit:has-text("Lesemodus")');
    assert.equal(await page.evaluate(() => AB.app.p.antraege.length), anzahl, 'im Lesemodus wird nichts gespeichert');
    await page.keyboard.press('Escape'); page.once('dialog', (dl) => dl.accept());
    await page.evaluate(() => { document.querySelectorAll('dialog[open]').forEach((d) => { d.close(); d.remove(); }); });
    // Änderung an der Oberfläche vorbei wird zurückgenommen; Export geht weiter
    await page.evaluate(() => { AB.app.p.antraege.pop(); AB.app.geaendert(); });
    assert.equal(await page.evaluate(() => AB.app.p.antraege.length), anzahl);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Excel")')]);
    assert.match(dl.suggestedFilename(), /\.xlsx$/);
    // gültiger Schlüssel hebt den Lesemodus wieder auf
    await trage(gut);
    assert.equal(await page.evaluate(() => AB.app.nurLesen), false);
    // ungeprägte Datei: keine Lizenzprüfung
    const frei = await ctx.newPage(); await frei.goto('file://' + HTML); await frei.click('text=Mit Beispieldaten ausprobieren'); await frei.waitForSelector('h1:has-text("Übersicht")');
    assert.equal(await frei.evaluate(() => AB.app.lizenz.modus), 'frei'); assert.equal(await frei.isHidden('#lizenzleiste'), true);
    await frei.click('#nav button:has-text("Einstellungen")');
    assert.equal(await frei.locator('h3:has-text("Lizenz")').count(), 0);
    assert.deepEqual(fehler, []);
  } finally { await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
});
