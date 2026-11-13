#!/usr/bin/env node
/* Erzeugt synthetische Testdaten (keine echten Personen): Abrechnungen Jan, Jan–Feb, Jan–Mrz,
   ein Beispielprojekt mit passenden Anträgen, einen Veränderungsdienst und Monatsscheiben. */
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const AB = require('../tests/lade.js');
const M = AB.model;

const KOPF = ['#Vermittlernummer', 'Versicherungsgesellschaft', 'Vertragsnummer', 'Versicherungsnehmer (Name)', 'Versicherungsnehmer (Straße)',
  'Versicherungsnehmer (PLZ)', 'Versicherungsnehmer (Ort)', 'Personennummer', 'Versicherte Person (Name)', 'Sparte', 'Tarifgruppe', 'Tarif',
  'Monatsbeitrag', 'Monatsbeitragsdifferenz', 'Bewertungssumme', 'Bewertungssummendifferenz', 'Laufzeit', 'Faktor Produktion', 'Produktion',
  'Berechnungsfaktor Produktion', 'Faktor Provision', 'Provision', 'Berechnungsfaktor Provision', 'Berechnungsgrundlage Provision', 'Provisionsart',
  'Storno/Verrechnung', 'Buchungsdatum (Berechnungsdatum)', 'Versicherungsbeginn/Änderungsdatum', 'Stornogrund', 'Gruppenvertragsnummer',
  'Beteiligte Vermittler', 'Diverses Kennzeichen', 'Stornohaftungszeitende'];
const VM = '900999';
const NACH = ['Muster', 'Beispiel', 'Probe', 'Test', 'Demo', 'Vorlage', 'Platzhalter', 'Entwurf', 'Übung', 'Größmann'];
const VOR = ['Anna', 'Bernd', 'Clara', 'Dieter', 'Eva', 'Fritz', 'Gerda', 'Jörg', 'Käthe', 'Björn'];
const ORTE = [['01001', 'Musterstadt'], ['90001', 'Beispielhausen'], ['80001', 'Probedorf'], ['70001', 'Übungsheim']];

function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const de = (n) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
const dat = (iso) => iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '';

function zeile(o) {
  const ort = ORTE[(o.vnr.length + o.vnr.charCodeAt(o.vnr.length - 1)) % ORTE.length];
  const tg = o.tg || 'Vollversicherung', mbd = o.mbd, mb = o.mb != null ? o.mb : Math.max(0, mbd);
  const prozent = o.prozent, f = o.f != null ? o.f : 5.5;
  const prov = o.prov != null ? o.prov : prozent ? mb * f / 100 : o.bwsd ? o.bwsd * f / 1000 : mbd * f;
  return [o.vm || VM, 'SDK', o.vnr, o.name || '', 'Testweg 1', ort[0], ort[1], o.pnr || '1', o.person || o.name || '',
    tg === 'Lebensversicherung (Standard)' ? 'LV' : 'KVUV', tg, o.tarif, de(mb), de(mbd), de(o.bws || 0), de(o.bwsd || 0), o.lz || '',
    '0', '0', prozent ? 'Prozent' : 'Ganze', String(f).replace('.', ','), de(prov), prozent ? 'Prozent' : 'Ganze',
    prozent ? 'Nettomonatsbeitrag' : 'Monatsbeitrag', o.art || 'Abschluss', o.x ? 'X' : '', dat(o.bdat), dat(o.vbeg || o.bdat.slice(0, 8) + '01'),
    o.grund || '', o.gvnr || '', o.beteil || '', '', dat(o.sh || '')];
}

function buchungen() {
  const z = [], B = (o) => z.push(o);
  // A1 GLEICH – führende Null, zwei Personen, mehrere Tarife
  B({ vnr: '012345', name: 'MUSTER, ANNA', pnr: '1', tarif: 'A107', mbd: 250.5, bdat: '2026-01-15', vbeg: '2026-01-01', sh: '2031-01-01' });
  B({ vnr: '012345', name: 'MUSTER, ANNA', pnr: '1', tarif: 'S101', mbd: 90, bdat: '2026-01-15', vbeg: '2026-01-01', sh: '2031-01-01' });
  B({ vnr: '012345', name: 'MUSTER, ANNA', pnr: '2', person: 'MUSTER, FRITZ', tarif: 'A107', mbd: 80, bdat: '2026-01-15', vbeg: '2026-01-01', sh: '2031-01-01' });
  // A2 ABWEICHUNG Beitrag
  B({ vnr: '200200', name: 'PROBE, CLARA', tg: 'Zusatzversicherung (Art Leben)', tarif: 'ZP7', mbd: 32.1, f: 4.5, bdat: '2026-02-12' });
  // A3 ABWEICHUNG Provision (Faktor 2,5 statt 3)
  B({ vnr: '250250', name: 'TEST, DIETER', tg: 'Firmentarife', tarif: 'AB1F', mbd: 40, f: 2.5, bdat: '2026-03-10', gvnr: '0998001' });
  // A5 Vorschlag über Name (Antrag ohne Vertragsnummer)
  B({ vnr: '300300', name: 'BEISPIEL, BERND', tarif: 'BE560', mb: 610, mbd: 55.2, bdat: '2026-02-12', vbeg: '2026-02-01' });
  // A6 STORNO voll
  B({ vnr: '400400', name: 'DEMO, EVA', tg: 'Zusatzversicherung (Art Leben)', tarif: 'ZP9', mbd: 48, f: 4.5, bdat: '2026-01-15', sh: '2028-01-01' });
  B({ vnr: '400400', name: 'DEMO, EVA', tg: 'Zusatzversicherung (Art Leben)', tarif: 'ZP9', mb: 0, mbd: -48, f: 4.5, bdat: '2026-03-10', x: 1, grund: 'Kündigung' });
  // A7 Teil-Rückbuchung
  B({ vnr: '500500', name: 'VORLAGE, FRITZ', tarif: 'A109', mbd: 300, bdat: '2026-01-15', sh: '2031-01-01' });
  B({ vnr: '500500', name: 'VORLAGE, FRITZ', tarif: 'A109', mb: 287.5, mbd: -12.5, bdat: '2026-03-10', x: 1, grund: 'Sonstiges' });
  // A8 Minderbeitrag-Antrag
  B({ vnr: '600600', name: 'PLATZHALTER, GERDA', tarif: 'S101', mb: 70, mbd: -20, bdat: '2026-02-12', x: 1 });
  // A11 Unfall laufend (20 % je Monat)
  ['2026-01-15', '2026-02-12', '2026-03-10'].forEach((d) =>
    B({ vnr: '700700', name: 'ENTWURF, JÖRG', tg: 'Unfallversicherung', tarif: 'UV1', mb: 30, mbd: 0, f: 20, prozent: 1, art: 'Bestand', bdat: d }));
  // A12 Leben
  B({ vnr: '0000800800', name: 'ÜBUNG, KÄTHE', tg: 'Lebensversicherung (Standard)', tarif: 'RV1', mbd: 100, bws: 24000, bwsd: 24000, lz: 20, f: 25, bdat: '2026-02-12' });
  // A13 zwei Anträge auf demselben Vertrag
  B({ vnr: '900900', name: 'GRÖSSMANN, BJÖRN', tarif: 'A107', mbd: 100, bdat: '2026-01-15' });
  B({ vnr: '900900', name: 'GRÖSSMANN, BJÖRN', tarif: 'A107', mb: 125, mbd: 25, bdat: '2026-03-10', art: 'Erhöhung' });
  // A14 identische Doppelzeilen
  B({ vnr: '110110', name: 'MUSTER, CLARA', tg: 'Zusatzversicherung (Art Schaden)', tarif: 'KT', mbd: 10, f: 4.5, bdat: '2026-02-12' });
  B({ vnr: '110110', name: 'MUSTER, CLARA', tg: 'Zusatzversicherung (Art Schaden)', tarif: 'KT', mbd: 10, f: 4.5, bdat: '2026-02-12' });
  // NEU OHNE ANTRAG: Dynamik, Beitragsanpassung, vergessener Antrag
  B({ vnr: '120120', name: 'PROBE, DIETER', tarif: 'BE MAX', mb: 410, mbd: 12.3, bdat: '2026-01-15', art: 'Erhöhung' });
  B({ vnr: '130130', name: 'TEST, EVA', tg: 'Zusatzversicherung (Art Leben)', tarif: 'PG2', mb: 60, mbd: 4.1, f: 4.5, bdat: '2026-02-12', art: 'Erhöhung' });
  B({ vnr: '140140', name: 'DEMO, FRITZ', tg: 'Zusatzversicherung (Art Leben)', tarif: 'ZP7', mbd: 28.9, f: 4.5, bdat: '2026-03-10' });
  B({ vnr: '150150', name: 'VORLAGE, GERDA', tarif: 'VP', mbd: 0, prov: 15, bdat: '2026-03-10', art: 'Manuell' });
  // nur im Januar-Stand, später korrigiert (entfällt)
  B({ vnr: '160160', name: 'ENTWURF, ANNA', tarif: 'A107', mbd: 5, bdat: '2026-01-15', nurBis: '2026-01' });
  // Hierarchie-Buchungen des Teams (für Management-Ansicht; im ADP-Filter ausgeblendet)
  const r = rng(42), adps = ['900101', '900102', '900103', '900104', '900105'];
  const tgs = [['Vollversicherung', 'A107'], ['Zusatzversicherung (Art Leben)', 'ZP7'], ['Firmentarife', 'AB1F'], ['Gruppentarife', 'GT1'], ['Zusatzversicherung (Art Schaden)', 'KT']];
  ['2026-01-15', '2026-02-12', '2026-03-10'].forEach((d, mi) => {
    for (let i = 0; i < 60; i++) {
      const a = adps[Math.floor(r() * r() * adps.length)], t = tgs[Math.floor(r() * tgs.length)];
      const art = r(), betrag = Math.round((5 + r() * 180) * 100) / 100, vnr = String(170000 + mi * 1000 + i);
      const o = { vnr, name: NACH[i % 10].toUpperCase() + ', ' + VOR[(i * 3 + mi) % 10].toUpperCase(), tg: t[0], tarif: t[1], f: 0.5, art: 'Hierarchie', bdat: d,
        beteil: a + ' (Geschrieben, als Bestandsinhaber)' + (r() < 0.4 ? ', 912' + String(100 + i) + ' (Mitwirkung, als Bestandsinhaber)' : '') };
      if (art < 0.5) { o.mbd = betrag; }
      else if (art < 0.75) { o.mb = betrag + 200; o.mbd = betrag / 4; }
      else if (art < 0.88) { o.mb = 150; o.mbd = -betrag / 5; o.x = 1; }
      else { o.mb = 0; o.mbd = -betrag; o.x = 1; o.grund = ['Kündigung', 'Widerspruch', 'Beendigung wegen Beitragsrückstand'][i % 3]; }
      B(o);
    }
  });
  B({ vnr: '180180', name: 'TEST, ANNA', tarif: 'A35a', mb: 0, mbd: -9.5, f: 0.8, bdat: '2026-02-12', art: 'Legacy', x: 1 });
  return z;
}

function csv(bis) {
  const zl = buchungen().filter((o) => o.bdat.slice(0, 7) <= bis && (!o.nurBis || bis <= o.nurBis)).map(zeile);
  const text = [KOPF].concat(zl).map((z) => z.join(';')).join('\r\n') + '\r\n';
  return Buffer.from(text, 'latin1'); // Windows-1252-kompatibel (nur Latin-1-Zeichen verwendet)
}

function antrag(o) {
  const a = M.neuerAntrag();
  Object.assign(a, { eingang: o.eingang, vn: { name: o.name, vorname: o.vorname }, bereich: o.bereich || 'voll', vorgang: o.vorgang || 'neu',
    vertragsnummer: o.vnr || '', beginn: o.beginn || '', laufzeit: o.lz || null, bemerkung: o.bem || '', statusDatum: o.eingang, firma: o.firma || '', gruppenvertrag: o.gvnr || '' });
  a.positionen = o.pos.map((p) => Object.assign(M.neuePosition(), { tarif: p[0], beitrag: p[1], personennummer: p[2] || '', person: p[3] || '' }));
  a.historie = [{ status: 'eingereicht', datum: o.eingang, am: o.eingang + 'T09:00:00.000Z', quelle: 'manuell' }];
  a.id = 'a-' + o.nr; a.erstellt = a.geaendert = o.eingang + 'T09:00:00.000Z';
  if (o.bank) a.bank = { aktiv: true, anteil: o.bank };
  return a;
}

function projekt() {
  const p = M.neuesProjekt(2026);
  p.projektId = 'beispielprojekt'; p.einstellungen.vermittlernummer = VM; p.einstellungen.name = 'Beispiel-ADP';
  const A = (o) => p.antraege.push(antrag(o));
  A({ nr: 1, eingang: '2026-01-05', name: 'Muster', vorname: 'Anna', vnr: '12345', beginn: '2026-01-01', pos: [['A107', 250.5, '1'], ['S101', 90, '1'], ['A107', 80, '2', 'Muster, Fritz']] });
  A({ nr: 2, eingang: '2026-01-20', name: 'Probe', vorname: 'Clara', bereich: 'zusatz', vnr: '200200', pos: [['ZP7', 35]] });
  A({ nr: 3, eingang: '2026-02-20', name: 'Test', vorname: 'Dieter', bereich: 'bkv', vnr: '250250', firma: 'Beispiel GmbH', gvnr: '0998001', pos: [['AB1F', 40]] });
  A({ nr: 4, eingang: '2026-01-10', name: 'Platzhalter', vorname: 'Anna', bereich: 'zusatz', pos: [['ZP9', 22.4]] });
  A({ nr: 5, eingang: '2026-01-28', name: 'Beispiel', vorname: 'Bernd', vorgang: 'mehr', beginn: '2026-02-01', pos: [['BE560', 55.2]] });
  A({ nr: 6, eingang: '2026-01-07', name: 'Demo', vorname: 'Eva', bereich: 'zusatz', vnr: '400400', pos: [['ZP9', 48]] });
  A({ nr: 7, eingang: '2026-01-08', name: 'Vorlage', vorname: 'Fritz', vnr: '500500', pos: [['A109', 300]] });
  A({ nr: 8, eingang: '2026-02-02', name: 'Platzhalter', vorname: 'Gerda', vorgang: 'minder', vnr: '600600', pos: [['S101', 20]] });
  A({ nr: 9, eingang: '2026-02-05', name: 'Entwurf', vorname: 'Anna', vorgang: 'umstellung', vnr: '610610', pos: [['A103 auf A107', 0]], bem: 'Umstellung ohne Provision' });
  A({ nr: 10, eingang: '2026-02-10', name: 'Übung', vorname: 'Björn', bereich: 'gkv', pos: [['mhplus', 0], ['mhplus', 0, '', 'Übung, Käthe']] });
  A({ nr: 11, eingang: '2026-01-03', name: 'Entwurf', vorname: 'Jörg', bereich: 'unfall', vnr: '700700', pos: [['UV1', 30]] });
  A({ nr: 12, eingang: '2026-01-25', name: 'Übung', vorname: 'Käthe', bereich: 'leben', vnr: '800800', lz: 20, pos: [['RV1', 100]] });
  A({ nr: 13, eingang: '2026-01-06', name: 'Größmann', vorname: 'Björn', vnr: '900900', pos: [['A107', 100]] });
  A({ nr: 14, eingang: '2026-02-25', name: 'Größmann', vorname: 'Björn', vorgang: 'mehr', vnr: '900900', pos: [['A107', 25]] });
  A({ nr: 15, eingang: '2026-02-03', name: 'Muster', vorname: 'Clara', bereich: 'zusatz', vnr: '110110', pos: [['KT', 20]] });
  A({ nr: 16, eingang: '2026-03-20', name: 'Demo', vorname: 'Dieter', bereich: 'zusatz', pos: [['ZP7', 19.9]], bem: 'noch frisch – nicht offen' });
  A({ nr: 17, eingang: '2026-03-02', name: 'Vorlage', vorname: 'Clara', vnr: '', pos: [['A107', 410]] });
  M.erweitereTarife(p, ['A107', 'A109', 'S101', 'ZP7', 'ZP9', 'BE560'].map((n) => ({ name: n })), 'manuell');
  return p;
}

function veraenderungsdienst() {
  const z = [['Vertreternummer', 'Mitgliedsnummer', 'Name VN', 'PLZ VN', 'Ort VN', 'Monatsbeitrag_Alt', 'Monatsbeitrag_Diff', 'Monatsbeitrag_Neu'],
    [VM, '0777001', 'VORLAGE, CLARA', '01001', 'Musterstadt', '0,00', '410,00', '410,00'],
    [VM, '250250', 'TEST, DIETER', '90001', 'Beispielhausen', '0,00', '40,00', '40,00'],
    [VM, '999001', 'UNBEKANNT, PERSON', '80001', 'Probedorf', '100,00', '7,79', '107,79']];
  return Buffer.from('﻿' + z.map((r) => r.join(';')).join('\r\n') + '\r\n', 'utf8');
}

// ---------- kleiner XLSX-Schreiber (nur für Testdaten) ----------
const crcT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function zip(dateien) {
  const teile = [], zentral = []; let off = 0;
  for (const [name, inhalt] of Object.entries(dateien)) {
    const roh = Buffer.from(inhalt, 'utf8'), komp = zlib.deflateRawSync(roh), nb = Buffer.from(name);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc32(roh), 14); lh.writeUInt32LE(komp.length, 18); lh.writeUInt32LE(roh.length, 22); lh.writeUInt16LE(nb.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc32(roh), 16); ch.writeUInt32LE(komp.length, 20); ch.writeUInt32LE(roh.length, 24); ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(off, 42);
    teile.push(lh, nb, komp); zentral.push(ch, nb); off += 30 + nb.length + komp.length;
  }
  const zb = Buffer.concat(zentral), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(zentral.length / 2, 8); e.writeUInt16LE(zentral.length / 2, 10); e.writeUInt32LE(zb.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat(teile.concat([zb, e]));
}
function xlsx(blaetter) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const sp = (i) => { let s = ''; i++; while (i > 0) { s = String.fromCharCode(65 + (i - 1) % 26) + s; i = Math.floor((i - 1) / 26); } return s; };
  const d = { '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="x"><Default Extension="xml" ContentType="application/xml"/></Types>',
    'xl/workbook.xml': '<workbook><sheets>' + blaetter.map((b, i) => `<sheet name="${esc(b.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships>' + blaetter.map((b, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + '</Relationships>' };
  blaetter.forEach((b, i) => {
    d[`xl/worksheets/sheet${i + 1}.xml`] = '<worksheet><sheetData>' + b.zeilen.map((z, r) => `<row r="${r + 1}">` + z.map((c, k) => c == null || c === '' ? '' :
      typeof c === 'number' ? `<c r="${sp(k)}${r + 1}"><v>${c}</v></c>` : `<c r="${sp(k)}${r + 1}" t="inlineStr"><is><t>${esc(c)}</t></is></c>`).join('') + '</row>').join('') + '</sheetData></worksheet>';
  });
  return zip(d);
}
function monatsscheiben() {
  const r = rng(7), kopf = [null, null, 'Mrz../2026', '01 - Mrz.. 2026', '', 'Jan 2026', 'Feb 2026', 'Mär 2026', 'Apr 2026', 'Mai 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Okt 2026', 'Nov 2026', 'Dez 2026', '', 'HR 2026', '2025'];
  const leute = [[VM, 'BEISPIEL-ADP'], ['900101', 'TESTER,EINS'], ['900102', 'TESTER,ZWEI'], ['900103', 'TESTER,DREI'], ['900104', 'TESTER,VIER'], ['900105', 'TESTER,FÜNF'], ['900106', 'TESTER,SECHS']];
  const zl = leute.map(([nr, name], i) => {
    const w = [0, 1, 2].map(() => Math.round((200 + r() * 2500 - (i === 3 ? 400 : 0)) * 100) / 100);
    return [null, nr + ' ' + name, w[2], w[0] + w[1] + w[2], '', w[0], w[1], w[2], '-', '-', '-', '-', '-', '-', '-', '-', '-', '', (w[0] + w[1] + w[2]) * 4, 9000 + i * 1500];
  });
  const sum = [null, '900500 FD Testgebiet'];
  for (let k = 2; k < 20; k++) sum[k] = typeof zl[0][k] === 'number' ? zl.reduce((s, z) => s + z[k], 0) : zl[0][k];
  const vor = [[], [null, 'Monatsscheiben Nettoproduktion in EUR'], [null, 'Stand: 31.03.2026'], [], [], [null, '', 'Produktion (€, Prov.auslösend)'], kopf];
  const prod = [[null, 'Kranken'].concat(sum.slice(2)), [null, 'Vollversicherung'].concat(sum.slice(2).map((x) => typeof x === 'number' ? x * 0.6 : x))];
  return xlsx([{ name: 'Produkthierarchie', zeilen: vor.concat(prod) }, { name: 'Vertriebswege', zeilen: vor.concat([sum], zl) }]);
}

function erzeuge() {
  return { dateien: {
    'abrechnung_2026_01.csv': csv('2026-01'), 'abrechnung_2026_01-02.csv': csv('2026-02'), 'abrechnung_2026_01-03.csv': csv('2026-03'),
    'beispielprojekt.antragsbuch.json': Buffer.from(JSON.stringify(projekt(), null, 1), 'utf8'),
    'veraenderungsdienst.csv': veraenderungsdienst(), 'monatsscheiben.xlsx': monatsscheiben() }, projekt, csv, KOPF, zeile, xlsx, VM };
}
module.exports = { erzeuge, KOPF, zeile, xlsx, VM, de, dat };
if (require.main === module) {
  const ziel = path.join(__dirname, '..', 'testdaten'); fs.mkdirSync(ziel, { recursive: true });
  const e = erzeuge();
  for (const [n, b] of Object.entries(e.dateien)) { fs.writeFileSync(path.join(ziel, n), b); console.log('geschrieben:', n, b.length, 'Bytes'); }
}
