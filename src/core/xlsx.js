/* Antragsbuch – minimaler XLSX-Leser ohne Fremdbibliothek (ZIP + DecompressionStream). */
(function (AB) {
  'use strict';
  var X = AB.xlsx = {};

  X.istXlsx = function (bytes) { return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4B; };

  async function inflate(bytes) {
    var ds = new DecompressionStream('deflate-raw');
    var w = ds.writable.getWriter();
    w.write(bytes).catch(function () {}); w.close().catch(function () {});
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }

  async function entpacke(bytes, filter) {
    var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var eocd = -1;
    for (var i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--)
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Die Datei ist keine gültige Excel-Datei (.xlsx).');
    var anzahl = dv.getUint16(eocd + 10, true), pos = dv.getUint32(eocd + 16, true);
    var dec = new TextDecoder('utf-8'), dateien = {};
    for (var k = 0; k < anzahl; k++) {
      if (dv.getUint32(pos, true) !== 0x02014b50) break;
      var methode = dv.getUint16(pos + 10, true), cs = dv.getUint32(pos + 20, true);
      var nl = dv.getUint16(pos + 28, true), el = dv.getUint16(pos + 30, true), cl = dv.getUint16(pos + 32, true);
      var lho = dv.getUint32(pos + 42, true);
      var name = dec.decode(bytes.subarray(pos + 46, pos + 46 + nl));
      pos += 46 + nl + el + cl;
      if (!filter(name)) continue;
      var lnl = dv.getUint16(lho + 26, true), lel = dv.getUint16(lho + 28, true);
      var daten = bytes.subarray(lho + 30 + lnl + lel, lho + 30 + lnl + lel + cs);
      dateien[name] = dec.decode(methode === 0 ? daten : await inflate(daten));
    }
    return dateien;
  }

  function entity(s) {
    if (s.indexOf('&') < 0) return s;
    return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, function (m, e) {
      e = e.toLowerCase();
      if (e === 'amp') return '&'; if (e === 'lt') return '<'; if (e === 'gt') return '>';
      if (e === 'quot') return '"'; if (e === 'apos') return "'";
      return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    });
  }
  function textAus(xml) {
    var out = '', re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, m;
    xml = xml.replace(/<rPh[\s\S]*?<\/rPh>/g, '');
    while ((m = re.exec(xml))) out += m[1];
    return entity(out);
  }
  function attr(tag, name) {
    var m = new RegExp('\\s' + name + '="([^"]*)"').exec(tag);
    return m ? entity(m[1]) : null;
  }
  function spalte(ref) {
    var n = 0;
    for (var i = 0; i < ref.length; i++) {
      var c = ref.charCodeAt(i);
      if (c < 65 || c > 90) break;
      n = n * 26 + (c - 64);
    }
    return n - 1;
  }

  /** XLSX-Bytes → [{ name, zeilen: [[...]] }]. Datumszellen werden zu "JJJJ-MM-TT". */
  X.lies = async function (bytes) {
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
    var d = await entpacke(bytes, function (n) {
      return /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/[^\/]+\.xml)$/.test(n);
    });
    var wb = d['xl/workbook.xml'];
    if (!wb) throw new Error('Die Excel-Datei enthält keine Arbeitsmappe.');
    var rels = {}, m, re = /<Relationship\s[^>]*>/g;
    while ((m = re.exec(d['xl/_rels/workbook.xml.rels'] || ''))) rels[attr(m[0], 'Id')] = attr(m[0], 'Target');

    var ss = [];
    if (d['xl/sharedStrings.xml']) {
      re = /<si>([\s\S]*?)<\/si>|<si\/>/g;
      while ((m = re.exec(d['xl/sharedStrings.xml']))) ss.push(m[1] ? textAus(m[1]) : '');
    }
    // Welche Formate sind Datumsformate?
    var datumXf = [];
    if (d['xl/styles.xml']) {
      var eigene = {};
      re = /<numFmt\s[^>]*>/g;
      while ((m = re.exec(d['xl/styles.xml']))) {
        var code = (attr(m[0], 'formatCode') || '').replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
        eigene[attr(m[0], 'numFmtId')] = /[dy]|m{1,5}/i.test(code) && !/[0#]/.test(code);
      }
      var xfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(d['xl/styles.xml']);
      if (xfs) {
        re = /<xf\s[^>]*>/g;
        while ((m = re.exec(xfs[1]))) {
          var id = +attr(m[0], 'numFmtId');
          datumXf.push((id >= 14 && id <= 22) || (id >= 45 && id <= 47) || eigene[id] === true);
        }
      }
    }
    var blaetter = [];
    re = /<sheet\s[^>]*>/g;
    while ((m = re.exec(wb))) {
      var ziel = rels[attr(m[0], 'r:id')];
      if (!ziel) continue;
      ziel = ziel.replace(/^\/?(xl\/)?/, 'xl/');
      var xml = d[ziel];
      if (!xml) continue;
      blaetter.push({ name: attr(m[0], 'name'), zeilen: leseBlatt(xml, ss, datumXf) });
    }
    return blaetter;
  };

  function leseBlatt(xml, ss, datumXf) {
    var zeilen = [], reRow = /<row\s?([^>]*)>([\s\S]*?)<\/row>/g, mr;
    var reC = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    while ((mr = reRow.exec(xml))) {
      var rn = /(?:^|\s)r="(\d+)"/.exec(mr[1]);
      var idx = rn ? +rn[1] - 1 : zeilen.length;
      while (zeilen.length < idx) zeilen.push([]);
      var row = [], mc; reC.lastIndex = 0;
      while ((mc = reC.exec(mr[2]))) {
        var a = ' ' + mc[1], inhalt = mc[2] || '';
        var ref = attr(a, 'r'), t = attr(a, 't'), s = attr(a, 's');
        var col = ref ? spalte(ref) : row.length;
        var vm = /<v>([\s\S]*?)<\/v>/.exec(inhalt), v = vm ? vm[1] : null, wert;
        if (t === 's') wert = v == null ? '' : ss[+v];
        else if (t === 'inlineStr') wert = textAus(inhalt);
        else if (t === 'str' || t === 'e') wert = v == null ? '' : entity(v);
        else if (t === 'b') wert = v === '1';
        else if (v == null || v === '') wert = null;
        else {
          wert = parseFloat(v);
          if (s != null && datumXf[+s]) wert = AB.util.excelDatum(wert);
        }
        while (row.length < col) row.push(null);
        row[col] = wert;
      }
      zeilen[idx] = row;
    }
    return zeilen;
  }

  /** Tabellen-Datei (CSV oder XLSX) einheitlich lesen → { blaetter:[{name,zeilen}], info }. */
  X.liesTabelle = async function (bytes, dateiname) {
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
    if (X.istXlsx(bytes)) {
      if (/\.xls$/i.test(dateiname || '')) throw new Error('Altes Excel-Format (.xls) wird nicht unterstützt. Bitte als .xlsx oder CSV speichern.');
      return { blaetter: await X.lies(bytes), info: { art: 'Excel' } };
    }
    if (bytes.length > 8 && bytes[0] === 0xD0 && bytes[1] === 0xCF)
      throw new Error('Altes Excel-Format (.xls) wird nicht unterstützt. Bitte als .xlsx oder CSV speichern.');
    var c = AB.csv.lies(bytes);
    return {
      blaetter: [{ name: dateiname || 'CSV', zeilen: c.zeilen }],
      info: { art: 'CSV', kodierung: c.kodierung, trennzeichen: c.trennzeichen === '\t' ? 'Tab' : c.trennzeichen }
    };
  };
})(globalThis.AB = globalThis.AB || {});
