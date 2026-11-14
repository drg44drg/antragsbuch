/* Antragsbuch – Lizenzschlüssel: offline prüfbar per Signatur (ECDSA P-256). Ohne eingeprägten öffentlichen Schlüssel ist die Prüfung aus. */
(function (AB) {
  'use strict';
  var U = AB.util, L = AB.lizenz = {};
  var ALG = { name: 'ECDSA', namedCurve: 'P-256' }, SIG = { name: 'ECDSA', hash: 'SHA-256' }, PRAEFIX = 'AB1-';
  var enc = new TextEncoder(), dec = new TextDecoder();
  function b64u(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function ausB64u(t) { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; var bin = atob(t), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }

  /** Neues Schlüsselpaar (nur im Lizenz-Werkzeug). → { oeffentlich: JWK, geheim: JWK } */
  L.erzeugePaar = async function () {
    var k = await crypto.subtle.generateKey(ALG, true, ['sign', 'verify']);
    return { oeffentlich: await crypto.subtle.exportKey('jwk', k.publicKey), geheim: await crypto.subtle.exportKey('jwk', k.privateKey) };
  };
  /** Lizenz ausstellen (nur im Lizenz-Werkzeug). daten: { nr, name, bis: 'JJJJ-MM-TT' } → Schlüsseltext */
  L.stelleAus = async function (geheimJwk, daten) {
    var key = await crypto.subtle.importKey('jwk', geheimJwk, ALG, false, ['sign']);
    var inhalt = enc.encode(JSON.stringify({ v: 1, nr: String(daten.nr).trim(), name: daten.name || '', bis: daten.bis, aus: daten.aus || U.heute() }));
    var sig = new Uint8Array(await crypto.subtle.sign(SIG, key, inhalt));
    return PRAEFIX + b64u(inhalt) + '.' + b64u(sig);
  };
  /** Schlüsseltext prüfen → Inhalt { nr, name, bis, aus } oder null (gefälscht, beschädigt, fremder Aussteller). */
  L.lies = async function (oeffentlichJwk, text) {
    try {
      var t = String(text || '').replace(/\s+/g, '');
      if (t.indexOf(PRAEFIX) !== 0) return null;
      var teile = t.slice(PRAEFIX.length).split('.');
      if (teile.length !== 2) return null;
      var inhalt = ausB64u(teile[0]), key = await crypto.subtle.importKey('jwk', oeffentlichJwk, ALG, false, ['verify']);
      if (!(await crypto.subtle.verify(SIG, key, ausB64u(teile[1]), inhalt))) return null;
      var d = JSON.parse(dec.decode(inhalt));
      return d && d.v === 1 && d.nr && /^\d{4}-\d{2}-\d{2}$/.test(d.bis) ? d : null;
    } catch (e) { return null; }
  };

  /**
   * Lizenzstand bestimmen.
   * config: { pub: JWK, test: Tage Testzeitraum, kulanz: Tage nach Ablauf, warn: Tage Vorwarnung, inhaber } – ohne pub ist alles frei.
   * → { modus: 'frei'|'gueltig'|'warnung'|'kulanz'|'test'|'abgelaufen'|'ungueltig'|'fehlt', nurLesen, tage, bis, name, text }
   */
  L.pruefe = async function (config, schluessel, vermittlernummer, heute, ersterStart) {
    heute = heute || U.heute();
    if (!config || !config.pub) return { modus: 'frei', nurLesen: false, text: '' };
    var test = config.test == null ? 30 : +config.test, kulanz = config.kulanz == null ? 14 : +config.kulanz, warn = config.warn == null ? 30 : +config.warn;
    var restTest = test - U.tageZwischen((ersterStart || heute).slice(0, 10), heute);
    function ohne(modus, grund) {
      if (restTest > 0) return { modus: 'test', nurLesen: false, tage: restTest, text: 'Testzeitraum: noch ' + restTest + (restTest === 1 ? ' Tag' : ' Tage') + '. ' + grund };
      return { modus: modus, nurLesen: true, text: grund + ' Die App ist im Lesemodus: ansehen, suchen und exportieren geht weiter.' };
    }
    if (!String(schluessel || '').trim()) return ohne('fehlt', 'Es ist kein Lizenzschlüssel eingetragen.');
    var d = await L.lies(config.pub, schluessel);
    if (!d) return ohne('ungueltig', 'Der Lizenzschlüssel ist ungültig.');
    var nr = String(vermittlernummer || '').trim();
    if (d.nr !== '*' && d.nr !== nr) return Object.assign(ohne('ungueltig', 'Der Lizenzschlüssel gehört zur Vermittlernummer ' + d.nr + (nr ? ', im Projekt steht ' + nr + '.' : ' – bitte die Vermittlernummer in den Einstellungen eintragen.')), { bis: d.bis, name: d.name });
    var rest = U.tageZwischen(heute, d.bis), o = { bis: d.bis, name: d.name, nr: d.nr, tage: rest, nurLesen: false };
    if (rest >= 0) { o.modus = rest <= warn ? 'warnung' : 'gueltig'; o.text = rest <= warn ? 'Die Lizenz läuft am ' + U.fmtDatum(d.bis) + ' ab (noch ' + rest + (rest === 1 ? ' Tag' : ' Tage') + ').' : 'Lizenz gültig bis ' + U.fmtDatum(d.bis) + '.'; }
    else if (-rest <= kulanz) { o.modus = 'kulanz'; o.text = 'Die Lizenz ist am ' + U.fmtDatum(d.bis) + ' abgelaufen. Sie können noch ' + (kulanz + rest) + ' Tage normal weiterarbeiten.'; }
    else { o.modus = 'abgelaufen'; o.nurLesen = true; o.text = 'Die Lizenz ist am ' + U.fmtDatum(d.bis) + ' abgelaufen. Die App ist im Lesemodus: ansehen, suchen und exportieren geht weiter.'; }
    return o;
  };

  /** App-Datei mit dem öffentlichen Schlüssel prägen (nur im Lizenz-Werkzeug). → neuer HTML-Text */
  L.praege = function (html, config) {
    var re = /(<script id="lizenz" type="application\/json">)([\s\S]*?)(<\/script>)/;
    if (!re.test(html)) throw new Error('Das ist keine antragsbuch.html (Lizenz-Marke nicht gefunden).');
    return html.replace(re, function (_, a, b, c) { return a + JSON.stringify(config).replace(/</g, '\\u003c') + c; });
  };
})(globalThis.AB = globalThis.AB || {});
