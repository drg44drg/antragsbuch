/* Antragsbuch – Provisionsreklamation: Formular (Aufbau wie Vordruck 0.038) vorausfüllen, drucken, nachhalten. */
(function (AB) {
  'use strict';
  var D = AB.dom, h = D.h, U = AB.util, M = AB.model;
  var Rk = AB.reklamation = {};
  function zahlText(v) { return v == null || v === '' || isNaN(v) ? '' : U.fmtZahl(+v, 2); }

  /** Vorbelegung aus Antrag und Abgleich. */
  Rk.vorbelegung = function (a, r, p) {
    if (a.reklamation) return JSON.parse(JSON.stringify(a.reklamation));
    var e = p.einstellungen, hat = !!(r && r.buendel.length), soll = r ? (r.sollPGesamt != null ? r.sollPGesamt : r.sollP) : 0;
    var letzter = p.importe.filter(function (i) { return i.typ === 'Abrechnung'; }).pop();
    var monat = hat ? r.buendel[r.buendel.length - 1].monat : (letzter ? letzter.datum.slice(0, 7) : U.heute().slice(0, 7));
    var grund;
    if (hat && r.abwB) grund = 'Beitrag abweichend: beantragt ' + U.fmtEuro(r.sollB) + ', abgerechnet ' + U.fmtEuro(r.istB) + '.';
    else if (hat && r.abwP) grund = 'Provision abweichend: erwartet ' + U.fmtEuro(soll) + ', abgerechnet ' + U.fmtEuro(r.istP) + '.';
    else if (hat) grund = '';
    else grund = 'Antrag vom ' + U.fmtDatum(a.eingang) + (a.status === 'policiert' ? ', policiert am ' + U.fmtDatum(a.statusDatum) : '') + ' – bisher keine Provision abgerechnet.';
    var personen = a.positionen.map(function (ps) { return ps.person; }).filter(Boolean).filter(function (x, i, l) { return l.indexOf(x) === i; });
    return {
      datum: U.heute(), sparte: a.bereich === 'leben' ? 'lv' : 'kv', abrechnung: monat.slice(5, 7) + '/' + monat.slice(2, 4),
      partner: { adp: true, bank: !!a.bank.aktiv, makler: false, koop: false }, nummer: e.vermittlernummer || '', name: e.name || '',
      geschaeft: a.vorgang === 'storno' ? 'storno' : a.vorgang === 'neu' ? 'neu' : 'bestand',
      mitglied: a.vertragsnummer || '', person: personen.join('; ') || M.vnName(a), tarife: M.tarife(a),
      provision: true, produktion: false, erhalten: hat ? r.istP : 0, anspruch: soll, begruendung: grund,
      bank: !!a.bank.aktiv, bankNr: '', mitwirkung: '', bankMitarbeiter: '', ergebnis: '', erledigtAm: ''
    };
  };

  /** Das Formular als druckbare Seite. */
  Rk.seite = function (d) {
    function k(an, text) { return h('span.kasten', null, h('i', null, an ? '✕' : ''), text); }
    function w(text, lang) { return h('span.wert' + (lang ? '.lang' : ''), null, text == null ? '' : String(text)); }
    return h('div.rekla.seite', null,
      h('h2', null, 'Provisionsreklamation'),
      h('div.zeile', null, k(d.sparte === 'kv', 'Krankenversicherung'), k(d.sparte === 'lv', 'Lebensversicherung'), h('span', null, 'Aus Abrechnung vom (mm/yy): ', w(d.abrechnung))),
      h('div.balken', null, 'Angaben zum Vertriebspartner'),
      h('div.zeile', null, k(d.partner.adp, 'Außendienstpartner'), k(d.partner.bank, 'Bank'), k(d.partner.makler, 'Makler/Mehrfachagent'), k(d.partner.koop, 'Kooperationspartner')),
      h('div.zeile', null, h('span', null, 'Vertriebspartnernummer: ', w(d.nummer)), h('span', { style: { flex: 1, display: 'flex', gap: '6px' } }, 'Name, Vorname: ', w(d.name, true))),
      h('div.balken', null, 'Angaben zur Reklamation'),
      h('div.zeile', null, k(d.geschaeft === 'neu', 'Neugeschäft'), k(d.geschaeft === 'bestand', 'Bestandsgeschäft'), k(d.geschaeft === 'storno', 'Storno')),
      h('div.zeile', null, 'Mitgliedsnummer: ', w(d.mitglied)),
      h('div.zeile', null, 'betrifft versicherte Person (Name, Vorname): ', w(d.person, true)),
      h('div.zeile', null, 'Tarifbezeichnung (Bsp. A100, SG2, TA6/50, ...): ', w(d.tarife, true)),
      h('div.zeile', { style: { marginTop: '16px' } }, k(d.provision, 'Provision'), k(d.produktion, 'Produktion')),
      h('div.zeile', null, 'Höhe Provision/Produktion erhalten in EUR: ', w(zahlText(d.erhalten), true)),
      h('div.zeile', null, 'Anspruch Provision/Produktion in EUR: ', w(zahlText(d.anspruch), true)),
      h('div.zeile', null, 'Begründung des Anspruchs: ', w(d.begruendung, true)),
      h('div.zeile', { style: { marginTop: '16px' } }, k(d.bank, 'Bankbeteiligung')),
      h('div.zeile', { style: { paddingLeft: '34px' } }, h('span', null, 'Bank Nr. ', w(d.bankNr)), h('span', null, 'Mitwirkungsgrad ', w(d.mitwirkung)), h('span', null, 'Bankmitarbeiter: ', w(d.bankMitarbeiter))),
      h('hr'),
      h('div', { style: { textDecoration: 'underline', fontSize: '10pt', marginBottom: '12px' } }, 'Bearbeitungsvermerk zurück an Vertriebspartner:'),
      h('div.zeile', null, k(false, 'Provisions-/Produktionskorrektur folgt mit der nächsten Abrechnung.')),
      h('div.zeile', null, k(false, 'Provision/Produktion wurde bereits mit Abrechnung vom _____________ berücksichtigt.')),
      h('div.zeile', null, k(false, 'Kein Provisions-/Produktionsanspruch, da ____________________________________________')),
      h('div.zeile', null, k(false, '________________________________________________________________________________')),
      h('div.fuss', null, 'Aufbau nach Vordruck 0.038/10.15 · erstellt mit dem Antragsbuch am ' + U.fmtDatum(d.datum)));
  };

  /** Dialog: je Antrag ein vorausgefülltes Formular, bearbeiten, drucken, vermerken. */
  Rk.oeffne = function (antraege) {
    var App = AB.app, p = App.p;
    if (!antraege.length) return;
    var i = 0, daten = antraege.map(function (a) { return Rk.vorbelegung(a, App.erg.proAntrag[a.id], p); });
    var dlg = D.dialog('Provisionsreklamation', {}), form = h('div.formraster'), vorschau = h('div'), kopf = h('div.leiste');
    D.anhaengen(dlg.rumpf, [kopf, h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.05fr)', gap: '18px', alignItems: 'start' } }, form, vorschau)]);
    function ein(feld, attrs) {
      var d = daten[i], inp = h('input', Object.assign({ type: 'text', value: d[feld] == null ? '' : (typeof d[feld] === 'number' ? zahlText(d[feld]) : d[feld]), autocomplete: 'off',
        oninput: function () { d[feld] = (attrs && attrs.zahl) ? (isNaN(U.parseZahl(inp.value)) ? d[feld] : U.parseZahl(inp.value)) : inp.value; zeichneVorschau(); } }, attrs || {}));
      return inp;
    }
    function haken(text, hol, setz) { return h('label.schalter.klein', null, h('input', { type: 'checkbox', checked: !!hol(), onchange: function () { setz(this.checked); zeichneVorschau(); } }), text); }
    function zeichneVorschau() { D.leere(vorschau).appendChild(Rk.seite(daten[i])); }
    function zeichne() {
      var d = daten[i], a = antraege[i];
      D.leere(kopf);
      D.anhaengen(kopf, [h('b', null, M.vnName(a)), h('span.muted.klein', null, M.bereich[a.bereich].kurz + ' · ' + M.tarife(a) + ' · Antrag vom ' + U.fmtDatum(a.eingang)), h('span.frei'),
        antraege.length > 1 ? [D.btn('‹', function () { i = (i + antraege.length - 1) % antraege.length; zeichne(); }, { klasse: 'klein-btn' }), h('span.klein', null, (i + 1) + ' von ' + antraege.length), D.btn('›', function () { i = (i + 1) % antraege.length; zeichne(); }, { klasse: 'klein-btn' })] : null]);
      D.leere(form);
      D.anhaengen(form, [
        D.feld('Sparte', D.auswahl([['kv', 'Krankenversicherung'], ['lv', 'Lebensversicherung']], d.sparte, function (v) { d.sparte = v; zeichneVorschau(); }), 's6'),
        D.feld('Aus Abrechnung (mm/jj)', ein('abrechnung'), 's6'),
        D.feld('Geschäft', D.auswahl([['neu', 'Neugeschäft'], ['bestand', 'Bestandsgeschäft'], ['storno', 'Storno']], d.geschaeft, function (v) { d.geschaeft = v; zeichneVorschau(); }), 's6'),
        D.feld('Mitgliedsnummer', ein('mitglied'), 's6'),
        D.feld('Versicherte Person', ein('person'), 's12'), D.feld('Tarife', ein('tarife'), 's12'),
        h('div.feld.s12', null, h('span', null, 'Reklamiert wird'), h('div.leiste', null, haken('Provision', function () { return d.provision; }, function (v) { d.provision = v; }), haken('Produktion', function () { return d.produktion; }, function (v) { d.produktion = v; }))),
        D.feld('Erhalten (€)', ein('erhalten', { zahl: true, inputMode: 'decimal', style: { textAlign: 'right' } }), 's6'), D.feld('Anspruch (€)', ein('anspruch', { zahl: true, inputMode: 'decimal', style: { textAlign: 'right' } }), 's6'),
        D.feld('Begründung des Anspruchs', ein('begruendung', { placeholder: 'kurz und sachlich, ohne Gesundheitsangaben' }), 's12'),
        h('div.feld.s12', null, h('span', null, 'Bankbeteiligung'), h('div.leiste', null, haken('ja', function () { return d.bank; }, function (v) { d.bank = d.partner.bank = v; }),
          h('span.klein.muted', null, 'Bank Nr.'), ein('bankNr', { style: { width: '80px' } }), h('span.klein.muted', null, 'Mitwirkungsgrad'), ein('mitwirkung', { style: { width: '54px' } }))),
        D.feld('Vertriebspartnernummer', ein('nummer'), 's4'), D.feld('Name, Vorname', ein('name'), 's8'),
        a.reklamation ? D.feld('Ergebnis der Reklamation', D.auswahl(M.REKLA_ERGEBNIS.map(function (x) { return [x.id, x.name]; }), d.ergebnis || '', function (v) { d.ergebnis = v; d.erledigtAm = v ? U.heute() : ''; }), 's6') : null,
        a.reklamation && a.reklamation.automatisch ? h('div.mini.s6', { style: { alignSelf: 'end' } }, 'Automatisch erledigt durch Korrekturbuchung vom ' + U.fmtDatum(a.reklamation.erledigtAm) + '.') : null]);
      zeichneVorschau();
    }
    function vermerke() {
      antraege.forEach(function (a, n) {
        var neu = !a.reklamation;
        a.reklamation = daten[n]; a.geaendert = new Date().toISOString();
        if (neu && (a.status === 'eingereicht' || a.status === 'policiert')) M.setzeStatus(a, 'reklamiert', U.heute(), 'reklamation', 'Provisionsreklamation');
      });
    }
    D.anhaengen(dlg.fuss, [h('span.mini', null, 'Das Formular wird beim Drucken im Antrag vermerkt. Im Druckdialog „Als PDF speichern" wählen.'), h('span', { style: { flex: 1 } }),
      antraege.some(function (a) { return a.reklamation; }) ? D.btn('Reklamation zurückziehen', function () {
        antraege.forEach(function (a) { if (a.reklamation) { a.reklamation = null; if (a.status === 'reklamiert') M.setzeStatus(a, M.statusVorAbgleich({ historie: a.historie.filter(function (e) { return e.quelle !== 'reklamation'; }), eingang: a.eingang }).status, U.heute(), 'manuell'); a.geaendert = new Date().toISOString(); } });
        dlg.zu(); App.geaendert();
      }, { klasse: 'leise gefahr' }) : null,
      D.btn('Nur vermerken', function () { vermerke(); dlg.zu(); App.geaendert(); D.toast('Reklamation vermerkt.'); }),
      D.btn(antraege.length > 1 ? 'Alle ' + antraege.length + ' drucken / PDF' : 'Drucken / PDF', function () {
        vermerke(); var seiten = daten.map(Rk.seite); dlg.zu(); App.geaendert(); D.druckeKnoten(seiten);
      }, { klasse: 'haupt-btn', icon: 'druck' })]);
    zeichne();
  };
})(globalThis.AB = globalThis.AB || {});
