/* Antragsbuch – Passwortschutz der Projektdatei: AES-256-GCM, Schlüssel aus dem Passwort per PBKDF2 (Web Crypto, ohne Fremdbibliothek). */
(function (AB) {
  'use strict';
  var K = AB.krypto = {};
  K.ITERATIONEN = 310000;
  var enc = new TextEncoder(), dec = new TextDecoder();

  function b64(bytes) {
    var s = '', n = bytes.length;
    for (var i = 0; i < n; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function ausB64(text) {
    var bin = atob(text), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  K.verfuegbar = function () { return typeof crypto !== 'undefined' && !!crypto.subtle; };

  /** Schlüssel aus Passwort ableiten. salt/iter weglassen → neuer Schlüssel. → { key, salt (Base64), iter } */
  K.schluessel = async function (passwort, salt, iter) {
    var saltBytes = salt ? ausB64(salt) : crypto.getRandomValues(new Uint8Array(16));
    iter = iter || K.ITERATIONEN;
    var basis = await crypto.subtle.importKey('raw', enc.encode(passwort), 'PBKDF2', false, ['deriveKey']);
    var key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: saltBytes, iterations: iter, hash: 'SHA-256' }, basis, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    return { key: key, salt: b64(saltBytes), iter: iter };
  };

  /** Projekt-Text verschlüsseln. kopf: Klartext-Angaben, die zum Öffnen nötig sind (kein Kundenbezug). → Umschlag-Objekt */
  K.verschluessele = async function (text, s, kopf) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var daten = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, s.key, enc.encode(text)));
    return Object.assign({}, kopf, { verschluesselt: 1, kdf: { name: 'PBKDF2-SHA256', salt: s.salt, iter: s.iter }, iv: b64(iv), daten: b64(daten) });
  };

  /** Umschlag entschlüsseln. → { text, schluessel }  Falsches Passwort → Fehler mit .falschesPasswort */
  K.entschluessele = async function (umschlag, passwort) {
    var s = await K.schluessel(passwort, umschlag.kdf.salt, umschlag.kdf.iter);
    try {
      var klar = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ausB64(umschlag.iv) }, s.key, ausB64(umschlag.daten));
      return { text: dec.decode(klar), schluessel: s };
    } catch (e) {
      var f = new Error('Das Passwort stimmt nicht.'); f.falschesPasswort = true; throw f;
    }
  };
})(globalThis.AB = globalThis.AB || {});
