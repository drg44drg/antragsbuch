/* Antragsbuch – Antragsmaske (Neu/Bearbeiten) mit Tastaturbedienung. */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h, U = AB.util, M = AB.model;
  var Mk = AB.maske = {};
  function zahlText(v) { return v == null || v === '' || isNaN(v) ? '' : String(Math.round(v * 100) / 100).replace('.', ','); }
  function liesZahl(s) { s = String(s).trim(); if (!s) return null; var n = U.parseZahl(s); return isNaN(n) ? NaN : n; }

  /** antrag = null → neuer Antrag; opt.vorlage → Duplikat; opt.start → Vorbelegung */
  Mk.oeffne = function (antrag, opt) {
    opt = opt || {};
    var App = AB.app, p = App.p, neu = !antrag;
    var a = neu ? M.neuerAntrag(opt.vorlage) : JSON.parse(JSON.stringify(antrag));
    if (neu && opt.start) Object.assign(a, opt.start);
    var ursprung = JSON.stringify(a), dublettenOk = false, felder = {};

    var dl = h('datalist', { id: 'tarifliste' });
    p.tarife.forEach(function (t) { dl.appendChild(h('option', { value: t.name }, t.gruppe || '')); });

    function ein(feld, typ, wert, attrs) {
      var i = h('input', Object.assign({ type: typ || 'text', value: wert == null ? '' : wert, autocomplete: 'off', spellcheck: false }, attrs || {}));
      i.dataset.feld = feld; felder[feld] = i; i.addEventListener('input', aktualisiere);
      return i;
    }
    var fEingang = ein('eingang', 'date', a.eingang), fName = ein('vn.name', 'text', a.vn.name), fVorname = ein('vn.vorname', 'text', a.vn.vorname);
    var fBereich = D.auswahl(M.BEREICHE.map(function (b) { return [b.id, b.name]; }), a.bereich, aktualisiere); fBereich.dataset.feld = 'bereich';
    var fVorgang = D.auswahl(M.VORGAENGE.map(function (v) { return [v.id, v.name]; }), a.vorgang, aktualisiere); fVorgang.dataset.feld = 'vorgang';
    var fVnr = ein('vertragsnummer', 'text', a.vertragsnummer, { inputMode: 'numeric', placeholder: 'sobald bekannt' });
    var fBeginn = ein('beginn', 'date', a.beginn), fLaufzeit = ein('laufzeit', 'text', a.laufzeit || '', { inputMode: 'numeric' });
    var fGv = ein('gruppenvertrag', 'text', a.gruppenvertrag), fFirma = ein('firma', 'text', a.firma);
    var fEantrag = h('input', { type: 'checkbox', checked: !!a.eantrag }), fBank = h('input', { type: 'checkbox', checked: !!a.bank.aktiv, onchange: aktualisiere });
    var fAnteil = ein('bank.anteil', 'text', zahlText(a.bank.anteil), { inputMode: 'decimal', style: { width: '74px' } });
    var fBem = h('textarea', { rows: 2, value: a.bemerkung || '' });
    var fProv = ein('provisionManuell', 'text', zahlText(a.provisionManuell), { inputMode: 'decimal', placeholder: 'automatisch' });
    var nb0 = a.nachbearbeitung || { status: '', text: '', datum: '' };
    var fNb = D.auswahl(M.NACHBEARBEITUNG.map(function (n) { return [n.id, n.name]; }), nb0.status, function () { if (fNb.value && !fNbDatum.value) fNbDatum.value = U.heute(); nbSicht(); });
    var fNbText = h('input', { type: 'text', value: nb0.text || '', placeholder: 'Was fehlt? Was ging an den Kunden?', autocomplete: 'off' }), fNbDatum = h('input', { type: 'date', value: nb0.datum || '' });
    function nbSicht() { fNbText.parentNode.hidden = fNbDatum.parentNode.hidden = !fNb.value; }
    var fStatus = D.auswahl(M.STATUS.map(function (s) { return [s.id, s.name]; }), a.status), fStatusDatum = h('input', { type: 'date', value: a.statusDatum || U.heute() });
    fStatus.addEventListener('change', function () { fStatusDatum.value = U.heute(); });

    var posBox = h('div'), sollText = h('div.klein.muted'), vnrHinweis = h('div.mini'), meldungen = h('div');
    function posZeile(ps) {
      var z = h('div.pos-zeile');
      var bSel = D.auswahl([['', 'wie Antrag']].concat(M.BEREICHE.filter(function (b) { return b.id !== 'gkv'; }).map(function (b) { return [b.id, b.kurz]; })), ps.bereich || '', aktualisiere);
      var t = h('input', { type: 'text', value: ps.tarif || '', autocomplete: 'off', spellcheck: false, placeholder: 'Tarif' }); t.setAttribute('list', 'tarifliste');
      var b = h('input', { type: 'text', value: zahlText(ps.beitrag), inputMode: 'decimal', placeholder: '0,00', style: { textAlign: 'right' } });
      var pe = h('input', { type: 'text', value: ps.person || '', autocomplete: 'off', placeholder: 'wie Versicherungsnehmer' }), nr = h('input', { type: 'text', value: ps.personennummer || '', inputMode: 'numeric', autocomplete: 'off' });
      [t, b, pe, nr].forEach(function (i) { i.addEventListener('input', aktualisiere); });
      z._lies = function () { return { id: ps.id, person: pe.value.trim(), personennummer: nr.value.trim(), tarif: t.value.trim(), beitrag: liesZahl(b.value), bereich: bSel.value }; };
      z._felder = { tarif: t, beitrag: b };
      D.anhaengen(z, [pe, nr, t, b, bSel, D.btn('', function () { if (posBox.children.length > 1) { z.remove(); aktualisiere(); } }, { klasse: 'leise klein-btn', icon: 'x', titel: 'Position entfernen' })]);
      return z;
    }
    a.positionen.forEach(function (ps) { posBox.appendChild(posZeile(ps)); });
    function neuePos() { var z = posZeile(M.neuePosition()); posBox.appendChild(z); z.children[2].focus(); aktualisiere(); }

    function sammle() {
      var x = JSON.parse(JSON.stringify(a));
      x.eingang = fEingang.value; x.vn = { name: fName.value.trim(), vorname: fVorname.value.trim() };
      x.bereich = fBereich.value; x.vorgang = fVorgang.value; x.vertragsnummer = fVnr.value.trim(); x.beginn = fBeginn.value;
      x.laufzeit = liesZahl(fLaufzeit.value); x.gruppenvertrag = fGv.value.trim(); x.firma = fFirma.value.trim();
      x.eantrag = fEantrag.checked; x.bank = { aktiv: fBank.checked, anteil: liesZahl(fAnteil.value) || 0 };
      x.bemerkung = fBem.value.trim(); x.provisionManuell = liesZahl(fProv.value);
      x.nachbearbeitung = { status: fNb.value, text: fNb.value ? fNbText.value.trim() : '', datum: fNb.value ? fNbDatum.value : '' };
      x.positionen = Array.from(posBox.children).map(function (z) { return z._lies(); });
      return x;
    }
    var blockLeben = D.feld('Laufzeit (Jahre)', fLaufzeit, 's2', true), blockGv = D.feld('Gruppenvertragsnr.', fGv, 's3'), blockFirma = D.feld('Firma', fFirma, 's4');
    function aktualisiere() {
      var x = sammle(), soll = AB.provision.soll(x, p.regeln);
      blockLeben.hidden = x.bereich !== 'leben';
      blockGv.hidden = blockFirma.hidden = !(x.bereich === 'bkv' || x.bereich === 'gruppe');
      fAnteil.parentNode.hidden = !fBank.checked;
      D.leere(sollText);
      D.anhaengen(sollText, ['Beitrag gesamt ', h('b.num', null, U.fmtEuro(M.beitrag(x))), ' · erwartete Provision ',
        h('b.num', null, U.fmtEuro(soll.betrag) + (soll.laufend ? ' je Monat' : '')), soll.ueberschrieben ? h('span.marke-s.warn', { style: { marginLeft: '6px' } }, 'überschrieben') : null,
        soll.bankAbzug ? ' (Bank-Anteil ' + U.fmtEuro(soll.bankAbzug) + ' abgezogen)' : '']);
      sollText.title = soll.teile.map(function (t) { return t.text + ' = ' + U.fmtEuro(t.betrag); }).join('\n');
      var fehlt = !U.normVnr(x.vertragsnummer) && x.bereich !== 'gkv';
      vnrHinweis.textContent = !fehlt ? '' : x.vorgang === 'neu' ? 'Neugeschäft: Nummer nach Policierung nachtragen.' : 'Bestandsgeschäft: bitte gleich eintragen.';
      vnrHinweis.style.color = fehlt && x.vorgang !== 'neu' ? 'var(--warn-ink)' : '';
      dublettenOk = false;
    }

    function speichere(naechster) {
      var x = sammle(), fehler = M.pruefeAntrag(x);
      if (isNaN(x.provisionManuell)) fehler.push({ feld: 'provisionManuell', text: 'Provision (manuell) ist keine Zahl.' });
      Object.keys(felder).forEach(function (k) { felder[k].classList.remove('fehler'); });
      Array.from(posBox.children).forEach(function (z) { z._felder.tarif.classList.remove('fehler'); z._felder.beitrag.classList.remove('fehler'); });
      D.leere(meldungen);
      if (fehler.length) {
        var erstes = null;
        fehler.forEach(function (f) {
          var m = /^pos\.(\d+)\.(\w+)$/.exec(f.feld), el = m ? (posBox.children[+m[1]] || posBox.children[0])._felder[m[2]] : felder[f.feld];
          if (el) { el.classList.add('fehler'); erstes = erstes || el; }
        });
        meldungen.appendChild(h('div.meldung.krit', { role: 'alert' }, h('b', null, 'Bitte ergänzen:'), h('ul', null, fehler.map(function (f) { return h('li', null, f.text); }))));
        if (erstes) erstes.focus();
        return;
      }
      var dub = M.findeDubletten(x, p.antraege);
      if (dub.length && !dublettenOk) {
        dublettenOk = true;
        meldungen.appendChild(h('div.meldung.warn', { role: 'alert' }, h('b', null, 'Mögliche Dublette: '),
          dub.map(function (d) { return M.vnName(d) + ' (' + U.fmtDatum(d.eingang) + ', ' + U.fmtEuro(M.beitrag(d)) + ')'; }).join('; ') +
          '. Zum Speichern noch einmal Enter drücken.'));
        return;
      }
      x.geaendert = new Date().toISOString();
      if (fStatus.value !== a.status || (!neu && fStatusDatum.value !== a.statusDatum)) M.setzeStatus(x, fStatus.value, fStatusDatum.value || U.heute(), 'manuell');
      if (neu) { x.statusDatum = neu && x.historie.length === 1 ? (x.historie[0].datum = x.eingang) : x.statusDatum; p.antraege.push(x); }
      else p.antraege[p.antraege.findIndex(function (y) { return y.id === x.id; })] = x;
      M.erweitereTarife(p, x.positionen.map(function (ps) { return { name: ps.tarif, gruppe: '' }; }), 'manuell');
      gespeichert = true; dlg.zu();
      App.geaendert();
      D.toast(neu ? 'Antrag gespeichert: ' + M.vnName(x) : 'Änderungen gespeichert.');
      if (naechster) Mk.oeffne(null, { start: { eingang: x.eingang, bereich: x.bereich, vorgang: x.vorgang } });
    }

    var gespeichert = false;
    var dlg = D.dialog(neu ? (opt.vorlage ? 'Antrag duplizieren' : 'Neuer Antrag') : 'Antrag bearbeiten', {
      vorSchliessen: function () { return gespeichert || JSON.stringify(sammle()) === JSON.stringify(Object.assign(JSON.parse(ursprung), {})) || bestaetigeVerwerfen(); }
    });
    function bestaetigeVerwerfen() { return JSON.stringify(sammle().vn) === JSON.stringify(JSON.parse(ursprung).vn) && !fName.value ? true : window.confirm('Eingaben verwerfen?'); }

    D.anhaengen(dlg.rumpf, [dl, meldungen,
      h('div.formraster', null,
        D.feld('Eingangsdatum', fEingang, 's2', true), D.feld('Name', fName, 's3', true), D.feld('Vorname', fVorname, 's3', true),
        D.feld('Bereich', fBereich, 's2', true), D.feld('Vorgangsart', fVorgang, 's2', true),
        h('div.feld.s3', null, h('span', null, 'Vertragsnummer'), fVnr, vnrHinweis), D.feld('Beginn / Änderung zum', fBeginn, 's2'), blockLeben, blockGv, blockFirma,
        h('div.feld.s5', null, h('span', null, 'Optionen'), h('div.leiste', { style: { minHeight: '38px' } },
          h('label.schalter', null, fEantrag, 'E-Antrag'), h('label.schalter', null, fBank, 'Teilung mit Bank'),
          h('label.schalter', null, fAnteil, '% Bank-Anteil')))),
      h('div', null,
        h('div.pos-kopf', null, h('span', null, 'Versicherte Person'), h('span', null, 'Pers.-Nr.'), h('span', null, 'Tarif *'), h('span', { style: { textAlign: 'right' } }, 'Monatsbeitrag € *'), h('span', null, 'Bereich'), h('span')),
        posBox,
        h('div.leiste', { style: { marginTop: '8px' } }, D.btn('Position hinzufügen', neuePos, { klasse: 'klein-btn', icon: 'plus', taste: 'Alt+P' }), sollText)),
      h('div.formraster', null, D.feld('Bemerkung', fBem, 's8'), D.feld('Provision manuell überschreiben (€)', fProv, 's4'),
        D.feld('Nachbearbeitung', fNb, 's2'), D.feld('Was ist offen / was ging an den Kunden', fNbText, 's7'), D.feld('seit', fNbDatum, 's3'),
        h('div.mini.s12', null, 'Bitte keine Diagnosen oder Gesundheitsangaben in Bemerkung und Nachbearbeitung eintragen.')),
      neu ? null : h('div.formraster', null, D.feld('Status', fStatus, 's3'), D.feld('Status seit', fStatusDatum, 's3'),
        h('div.feld.s6', null, h('span', null, 'Verlauf'), h('div.historie', null, a.historie.slice(-4).map(function (e) {
          return h('div', null, U.fmtDatum(e.datum) + ' – ' + M.name('status', e.status) + (e.quelle === 'abgleich' ? ' (automatisch durch Abgleich)' : e.quelle === 'vdienst' ? ' (Veränderungsdienst)' : ''));
        }))))]);
    D.anhaengen(dlg.fuss, [
      neu ? null : D.btn('Duplizieren', function () { gespeichert = true; dlg.zu(); Mk.oeffne(null, { vorlage: antrag }); }, { icon: 'kopie' }),
      neu ? null : D.btn('Löschen', function () {
        D.frage('Antrag löschen?', M.vnName(a) + ' vom ' + U.fmtDatum(a.eingang) + ' wird entfernt. Ein Sicherungsstand wird vorher angelegt.', 'Löschen', { gefahr: true }).then(function (ja) {
          if (!ja) return;
          M.sichere(p, 'Vor Löschen eines Antrags');
          p.antraege = p.antraege.filter(function (y) { return y.id !== a.id; });
          Object.keys(p.zuordnungen).forEach(function (k) { if (p.zuordnungen[k] === a.id) delete p.zuordnungen[k]; });
          gespeichert = true; dlg.zu(); App.geaendert();
        });
      }, { klasse: 'gefahr', icon: 'muell' }),
      h('span', { style: { flex: 1 } }),
      D.btn('Abbrechen', function () { dlg.el.dispatchEvent(new Event('cancel', { cancelable: true })); }, { klasse: 'leise', taste: 'Esc' }),
      D.btn('Speichern & nächster', function () { speichere(true); }, { taste: 'Strg+Enter' }),
      D.btn('Speichern', function () { speichere(false); }, { klasse: 'haupt-btn', taste: 'Enter' })]);
    dlg.el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.isComposing) {
        var t = e.target.tagName;
        if (t === 'TEXTAREA' && !e.ctrlKey) return;
        if (t === 'BUTTON' && !e.ctrlKey) return;
        e.preventDefault(); speichere(e.ctrlKey || e.metaKey);
      } else if (e.altKey && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); neuePos(); }
    });
    aktualisiere(); nbSicht();
    (neu ? fName : fVnr.value ? fName : fVnr).focus();
    if (neu && fName.value) fName.select();
  };
})(globalThis.AB = globalThis.AB || {});
