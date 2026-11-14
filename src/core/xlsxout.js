/* Antragsbuch – Excel-Schreiber (.xlsx) mit Formatierung, ohne Fremdbibliothek. */
(function (AB) {
  'use strict';
  var X = AB.xlsxout = {};
  var crcT = (function () { var t = [], n, c, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = -1; for (var i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }

  /** ZIP ohne Kompression (für Excel völlig ausreichend, synchron). dateien: { name: text } → Uint8Array */
  X.zip = function (dateien) {
    var enc = new TextEncoder(), teile = [], zentral = [], off = 0, n = 0;
    Object.keys(dateien).forEach(function (name) {
      var daten = enc.encode(dateien[name]), nb = enc.encode(name), crc = crc32(daten);
      var lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, daten.length, true); lh.setUint32(22, daten.length, true); lh.setUint16(26, nb.length, true);
      var ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, daten.length, true); ch.setUint32(24, daten.length, true); ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true);
      teile.push(new Uint8Array(lh.buffer), nb, daten); zentral.push(new Uint8Array(ch.buffer), nb);
      off += 30 + nb.length + daten.length; n++;
    });
    var zl = zentral.reduce(function (s, a) { return s + a.length; }, 0);
    var e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, n, true); e.setUint16(10, n, true); e.setUint32(12, zl, true); e.setUint32(16, off, true);
    var alle = teile.concat(zentral, [new Uint8Array(e.buffer)]), out = new Uint8Array(off + zl + 22), p = 0;
    alle.forEach(function (a) { out.set(a, p); p += a.length; });
    return out;
  };

  function esc(s) { return String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function sp(i) { var s = ''; i++; while (i > 0) { s = String.fromCharCode(65 + (i - 1) % 26) + s; i = Math.floor((i - 1) / 26); } return s; }
  function serie(iso) { return Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000) + 25569; }

  var FUELLUNG = { kopf: 'FF6250D6', zebra: 'FFF6F6FB', gut: 'FFDDF3DD', warn: 'FFFFF0C4', krit: 'FFF9D6D6', akzent: 'FFECE9FC', summe: 'FFE3E4EE' };
  var FUELL_IDS = ['', 'kopf', 'zebra', 'gut', 'warn', 'krit', 'akzent', 'summe'];
  var FMT = { text: 0, ganz: 3, euro: 164, datum: 14, prozent: 165 };

  /**
   * Arbeitsmappe schreiben.
   * blaetter: [{ name, titel, unter, spalten:[{ t, b (Breite in Zeichen), typ:'text'|'euro'|'ganz'|'datum'|'prozent' }],
   *              zeilen:[[wert…]], farbe(zeile, r, c) → 'gut'|'warn'|'krit'|'akzent'|null, summe:[…] }]
   * Datumswerte als "TT.MM.JJJJ" oder "JJJJ-MM-TT". → Uint8Array
   */
  X.schreibe = function (blaetter) {
    var stile = [], stilIdx = {};
    function stil(fett, weiss, fuell, fmt, rechts, gross) {
      var k = [fett, weiss, fuell, fmt, rechts, gross].join('|');
      if (stilIdx[k] == null) { stilIdx[k] = stile.length; stile.push({ font: gross ? 3 : weiss ? 2 : fett ? 1 : 0, fill: FUELL_IDS.indexOf(fuell || '') + (fuell ? 1 : 0), fmt: fmt, rechts: rechts, rand: gross ? 0 : 1 }); }
      return stilIdx[k];
    }
    stil(0, 0, '', 0, 0, 0);
    var d = {}, namen = [];
    blaetter.forEach(function (b, bi) {
      var z = [], r = 0, kopfZeile;
      function zelle(c, v, s) {
        var ref = sp(c) + (r + 1);
        if (v == null || v === '') return '<c r="' + ref + '" s="' + s + '"/>';
        if (typeof v === 'number') return '<c r="' + ref + '" s="' + s + '"><v>' + (isFinite(v) ? v : 0) + '</v></c>';
        return '<c r="' + ref + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
      }
      if (b.titel) { z.push('<row r="' + (r + 1) + '" ht="24" customHeight="1">' + zelle(0, b.titel, stil(1, 0, '', 0, 0, 1)) + '</row>'); r++; }
      if (b.unter) { z.push('<row r="' + (r + 1) + '">' + zelle(0, b.unter, stil(0, 0, '', 0, 0, 0)) + '</row>'); r++; }
      if (b.titel || b.unter) r++;
      kopfZeile = r;
      z.push('<row r="' + (r + 1) + '" ht="20" customHeight="1">' + b.spalten.map(function (s, c) { return zelle(c, s.t, stil(1, 1, 'kopf', 0, s.typ && s.typ !== 'text' && s.typ !== 'datum' ? 1 : 0, 0)); }).join('') + '</row>'); r++;
      function datenZeile(werte, ri, istSumme) {
        return '<row r="' + (r + 1) + '">' + b.spalten.map(function (s, c) {
          var v = werte[c], typ = s.typ || 'text', fmt = FMT[typ] || 0, rechts = typ !== 'text' && typ !== 'datum' ? 1 : 0;
          var fuell = istSumme ? 'summe' : (b.farbe && b.farbe(werte, ri, c)) || (ri % 2 ? 'zebra' : '');
          if (typ === 'datum' && typeof v === 'string' && v) {
            var m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v), iso = m ? m[3] + '-' + m[2] + '-' + m[1] : (/^\d{4}-\d{2}-\d{2}/.test(v) ? v : '');
            if (iso) v = serie(iso); else fmt = 0;
          } else if (typeof v !== 'number') { fmt = 0; rechts = typ !== 'text' && typ !== 'datum' && v !== '' && v != null ? 1 : 0; }
          return zelle(c, v, stil(istSumme ? 1 : 0, 0, fuell, fmt, rechts, 0));
        }).join('') + '</row>';
      }
      b.zeilen.forEach(function (w, ri) { z.push(datenZeile(w, ri, false)); r++; });
      var letzte = r;
      if (b.summe) { z.push(datenZeile(b.summe, 0, true)); r++; }
      var cols = '<cols>' + b.spalten.map(function (s, c) { return '<col min="' + (c + 1) + '" max="' + (c + 1) + '" width="' + (s.b || Math.max(10, String(s.t).length + 3)) + '" customWidth="1"/>'; }).join('') + '</cols>';
      var name = String(b.name || 'Tabelle' + (bi + 1)).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31);
      namen.push(name);
      d['xl/worksheets/sheet' + (bi + 1) + '.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<sheetViews><sheetView workbookViewId="0"' + (bi === 0 ? ' tabSelected="1"' : '') + '><pane ySplit="' + (kopfZeile + 1) + '" topLeftCell="A' + (kopfZeile + 2) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
        '<sheetFormatPr defaultRowHeight="16"/>' + cols + '<sheetData>' + z.join('') + '</sheetData>' +
        (b.zeilen.length ? '<autoFilter ref="A' + (kopfZeile + 1) + ':' + sp(b.spalten.length - 1) + letzte + '"/>' : '') +
        '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToHeight="0"/></worksheet>';
    });
    var fills = '<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' + FUELL_IDS.slice(1).map(function (k) {
      return '<fill><patternFill patternType="solid"><fgColor rgb="' + FUELLUNG[k] + '"/><bgColor indexed="64"/></patternFill></fill>'; }).join('');
    d['xl/styles.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;;[Red]\\-#,##0.00\\ &quot;€&quot;"/><numFmt numFmtId="165" formatCode="0.0\\ &quot;%&quot;"/></numFmts>' +
      '<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="15"/><name val="Calibri"/></font></fonts>' +
      '<fills count="' + (FUELL_IDS.length + 1) + '">' + fills + '</fills>' +
      '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD2D3E0"/></bottom><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + stile.length + '">' + stile.map(function (s) {
        return '<xf numFmtId="' + s.fmt + '" fontId="' + s.font + '" fillId="' + s.fill + '" borderId="' + s.rand + '" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"' + (s.rechts ? ' horizontal="right"' : '') + '/></xf>'; }).join('') + '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Standard" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    d['[Content_Types].xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      namen.map(function (_, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>';
    d['_rels/.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    d['xl/workbook.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      namen.map(function (n, i) { return '<sheet name="' + esc(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets></workbook>';
    d['xl/_rels/workbook.xml.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      namen.map(function (_, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
      '<Relationship Id="rId' + (namen.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
    return X.zip(d);
  };
})(globalThis.AB = globalThis.AB || {});
