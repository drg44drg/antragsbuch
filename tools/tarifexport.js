/* Schreibt die Tarifschlüssel-Systematik als eine JSON-Datei (für andere Programme, z. B. Karten und Bestandsauswertungen).
   Aufruf: node tools/tarifexport.js [Datei mit weiteren Tarif/Tarifgruppe-Paaren als JSON-Liste] */
const fs = require('fs'), path = require('path');
const AB = require('../tests/lade.js'), T = AB.tarif, M = AB.model;
const quelle = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'tarif.js'), 'utf8');
// Regeln direkt aus dem Quelltext lesen, damit Export und App nicht auseinanderlaufen
const block = (name) => { const m = new RegExp('var ' + name + ' = \\[([\\s\\S]*?)\\n  \\];').exec(quelle); if (!m) throw new Error(name + ' nicht gefunden'); return m[1]; };
const kategorien = []; block('KATEGORIEN').replace(/\[\/(.+?)\/, '([^']+)'\]/g, (_, re, k) => { kategorien.push({ muster: re, kategorie: k }); return ''; });
const schaetzung = []; block('SCHAETZUNG').replace(/\[\/(.+?)\/, \/(.+?)\/, '([^']+)'\]/g, (_, g, t, k) => { schaetzung.push({ tarifgruppe: g, tarif: t, kategorie: k }); return ''; });
if (kategorien.length < 15 || schaetzung.length < 10) throw new Error('Regeln unvollständig gelesen');
const farben = { voll: ['grün', '#1baf7a'], zusatz: ['lila', '#6250d6'], leben: ['blau', '#2a78d6'], bkv: ['grau', '#8b8a9b'], gruppe: ['rosa', '#e87ba4'], unfall: ['gelb', '#eda100'], gkv: ['türkis', '#17a2b0'], pflegezusatz: ['orange', '#eb6834'], pflegepflicht: ['rot', '#d03b3b'] };
const eintrag = (t, g) => { const e = T.einordnen(t, g); const o = { tarif: t, beschreibung: e.beschreibung, kategorie: e.kategorie, beihilfe: e.beihilfe, zusatz: e.zusatz, zielgruppe: e.zielgruppe, welt: e.welt }; if (e.hinweis) o.hinweis = e.hinweis; return o; };
const tarife = Array.from(T.verzeichnis().keys()).map((t) => eintrag(t, ''));
const extra = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : [];
const bekannt = new Set(tarife.map((t) => t.tarif)), gesehen = new Set(), ergaenzung = [];
extra.forEach(([t, g]) => { const k = t + '|' + g; if (!t || bekannt.has(t) || gesehen.has(k)) return; gesehen.add(k); const e = T.einordnen(t, g);
  ergaenzung.push({ tarif: t, tarifgruppe: g, kategorie: e.kategorie, beihilfe: e.beihilfe, zusatz: e.zusatz, zielgruppe: e.zielgruppe, sicher: e.sicher, herkunft: e.sicher ? 'Tariffamilie' : e.kategorie ? 'geschätzt aus Tarifgruppe und Kürzel' : 'nicht einzuordnen' }); });
ergaenzung.sort((a, b) => a.tarif < b.tarif ? -1 : 1);
const aus = {
  format: 'tarifschluessel-systematik', version: 1, erstellt: new Date().toISOString().slice(0, 10),
  quelle: 'Antragsbuch: Tarifverzeichnis aus dem Tarifschlüssel des Versicherers (Stand 11.06.2021), Regeln aus src/core/tarif.js und src/core/model.js',
  hinweis: 'Nur Produktbezeichnungen und Regeln. Keine Kunden- oder Vermittlerdaten.',
  anleitung: [
    '1. Tarif und Tarifgruppe trimmen. Tarif exakt in "tarife" suchen (Groß-/Kleinschreibung beachten).',
    '2. Nicht gefunden: Kern = Tarif bis zum ersten Leerzeichen, "/" oder "(". Der Reihe nach suchen: Kern, Kern+a, Kern+n, Kern+u, Kern+z; danach Stamm (Kern ohne Ziffern am Ende, nur wenn er sich vom Kern unterscheidet und nicht leer ist): Stamm, Stamm+a, Stamm+n, Stamm+u. Erster Treffer gilt als Tariffamilie (sicher = true, welt bleibt leer).',
    '3. Gefunden: kategorie = erste Regel aus "regeln.kategorieAusBeschreibung", deren Muster in der Beschreibung vorkommt. beihilfe, zusatz, zielgruppe nach "regeln.merkmaleAusBeschreibung".',
    '4. Auch als Familie nicht gefunden: kategorie = erste Regel aus "regeln.schaetzung", bei der beide Muster passen (Tarifgruppe und Tarif). sicher = false. Passt nichts, bleibt die Kategorie leer und die Sparte heißt "Sonstige".',
    '5. Tarifwelt: letzter Buchstabe a, n, u oder z nach "regeln.tarifwelt", nur bei exaktem Treffer oder wenn die Tarifgruppe mit "Voll" beginnt, nie bei Tariffamilie.',
    '6. Bereich (für Farben und Summen) = "tarifgruppen[Tarifgruppe]". Unbekannte Tarifgruppe = "zusatz". Kategorie "Pflegepflicht" wird rot dargestellt und zählt zum Bereich voll; Kategorie "Pflegezusatz" wird orange dargestellt.',
    '7. Sparte für Auswertungen = ("Beihilfe · " wenn beihilfe) + kategorie, ohne Kategorie "Sonstige".'
  ],
  bereiche: M.BEREICHE.filter((b) => b.id !== 'pflege').map((b) => ({ id: b.id, name: b.name, kurz: b.kurz, farbe: farben[b.id][0], hex: farben[b.id][1] })),
  sonderfarben: { Pflegepflicht: { farbe: farben.pflegepflicht[0], hex: farben.pflegepflicht[1], bereich: 'voll' }, Pflegezusatz: { farbe: farben.pflegezusatz[0], hex: farben.pflegezusatz[1] } },
  tarifgruppen: Object.fromEntries(M.BEREICHE.filter((b) => b.id !== 'pflege').flatMap((b) => b.gruppen.map((g) => [g, b.id]))),
  tarifgruppeUnbekannt: 'zusatz',
  regeln: {
    kategorieAusBeschreibung: kategorien,
    merkmaleAusBeschreibung: {
      beihilfe: 'Beihilfe|Beamtenanwärter',
      zusatz: { muster: 'Ergänzungs|Zusatz|Zahnersatz|GKV|mhplus|Tagegeld|tagegeld', nichtWenn: 'Beihilfe|Beamtenanwärter' },
      zielgruppe: [{ muster: 'Firmen', wert: 'Firmen (bKV)' }, { muster: 'gen\\. Organisationen|Gruppen', wert: 'Gruppenversicherung' }, { muster: 'Kooperationspartner', wert: 'Kooperationspartner' }, { muster: 'mhplus', wert: 'mhplus' }, { muster: 'GKV', wert: 'GKV-Mitglieder' }]
    },
    schaetzung: schaetzung,
    tarifwelt: { muster: '^[A-Z0-9][A-Za-z0-9]*?([anuz])$', werte: T.WELTEN },
    dynamik: { muster: '^PG\\d[AS]?D', hinweis: 'mit Dynamik über das 70. Lebensjahr' },
    beitragsentlastung: { mitStufe: '^BE\\s*[\\/ \\-]?\\s*(\\d+(?:[.,]\\d+)?)\\s*[a-z]?$', ohneStufe: '^BE(\\s*[\\/\\-]?\\s*(MAX)?|[aunz])?$', grossKleinEgal: true, schreibweise: 'BE/<Stufe>' }
  },
  musterHinweis: 'Alle Muster sind reguläre Ausdrücke, die in JavaScript und Python gleich arbeiten. Gesucht wird irgendwo im Text (search), Anker stehen im Muster.',
  tarife: tarife,
  ergaenzungAusAbrechnungen: ergaenzung
};
const ziel = path.join(__dirname, '..', 'export', 'tarifschluessel-systematik.json');
fs.writeFileSync(ziel, JSON.stringify(aus, null, 1));
console.log(ziel, (fs.statSync(ziel).size / 1024).toFixed(0) + ' kB', '| Tarife', tarife.length, '| Ergänzung', ergaenzung.length, '| Regeln', kategorien.length, schaetzung.length);
