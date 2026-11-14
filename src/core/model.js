/* Antragsbuch – Datenmodell: Projekt, Antrag, Status, Prüfungen, Migration. */
(function (AB) {
  'use strict';
  var U = AB.util, M = AB.model = {};

  M.SCHEMA = 1;
  M.FORMAT = 'antragsbuch';

  M.BEREICHE = [
    { id: 'voll', name: 'Vollversicherung', kurz: 'Voll', gruppen: ['Vollversicherung'] },
    { id: 'zusatz', name: 'Zusatzversicherung', kurz: 'Zusatz', gruppen: ['Zusatzversicherung (Art Leben)', 'Zusatzversicherung (Art Schaden)'] },
    { id: 'bkv', name: 'bKV/Firmentarife', kurz: 'bKV', gruppen: ['Firmentarife'] },
    { id: 'gruppe', name: 'Gruppentarife', kurz: 'Gruppe', gruppen: ['Gruppentarife'] },
    { id: 'pflege', name: 'Pflegepflicht', kurz: 'Pflege', gruppen: ['Vollversicherung', 'Zusatzversicherung (Art Leben)'] },
    { id: 'leben', name: 'Leben', kurz: 'Leben', gruppen: ['Lebensversicherung (Standard)'] },
    { id: 'unfall', name: 'Unfall', kurz: 'Unfall', gruppen: ['Unfallversicherung'] },
    { id: 'gkv', name: 'GKV (mhplus-Mitgliedschaft)', kurz: 'GKV', gruppen: [] }
  ];
  M.VORGAENGE = [
    { id: 'neu', name: 'Neu' },
    { id: 'mehr', name: 'Mehrbeitrag' },
    { id: 'minder', name: 'Minderbeitrag/Reduzierung' },
    { id: 'umstellung', name: 'Umstellung ohne Provision' },
    { id: 'dynamik', name: 'Dynamik' },
    { id: 'storno', name: 'Storno' }
  ];
  M.STATUS = [
    { id: 'eingereicht', name: 'Eingereicht' },
    { id: 'policiert', name: 'Policiert' },
    { id: 'abgerechnet', name: 'Abgerechnet' },
    { id: 'abgelehnt', name: 'Abgelehnt' },
    { id: 'widerruf', name: 'Widerruf' },
    { id: 'absage', name: 'Absage' },
    { id: 'storno', name: 'Storno' },
    { id: 'reklamiert', name: 'Reklamiert' }
  ];
  function nachId(liste) { var o = {}; liste.forEach(function (x) { o[x.id] = x; }); return o; }
  M.bereich = nachId(M.BEREICHE); M.vorgang = nachId(M.VORGAENGE); M.status = nachId(M.STATUS);
  M.name = function (art, id) { var x = M[art][id]; return x ? x.name : (id || ''); };

  /** Bereich aus der Tarifgruppe der Abrechnung ableiten. */
  M.bereichAusGruppe = function (tg) {
    for (var i = 0; i < M.BEREICHE.length; i++)
      if (M.BEREICHE[i].id !== 'pflege' && M.BEREICHE[i].gruppen.indexOf(tg) >= 0) return M.BEREICHE[i].id;
    return 'zusatz';
  };

  /** Bearbeitungszeit je Bereich in Werktagen: ab `gelb` Tagen gelb, ab `rot` Tagen rot. */
  M.standardSla = function () {
    var s = {};
    M.BEREICHE.forEach(function (b) { s[b.id] = { gelb: 5, rot: 10 }; });
    return s;
  };
  M.REKLA_ERGEBNIS = [{ id: '', name: 'Offen' }, { id: 'erfolgreich', name: 'Erfolgreich' }, { id: 'teilweise', name: 'Teilweise erfolgreich' }, { id: 'nicht', name: 'Nicht erfolgreich' }];
  M.reklaOffen = function (a) { return !!(a.reklamation && !a.reklamation.ergebnis); };
  M.NACHBEARBEITUNG = [{ id: '', name: 'Keine' }, { id: 'offen', name: 'Offen' }, { id: 'erledigt', name: 'Erledigt' }];

  M.standardEinstellungen = function () {
    return {
      vermittlernummer: '', name: '',
      toleranzBeitrag: 0.05, toleranzProvision: 0.5, pruefeProvision: true,
      offenTage: 60, stornoSchwelle: 90,
      provisionsarten: ['Abschluss', 'Erhöhung', 'Manuell', 'Bestand'],
      sla: M.standardSla(), abrechnungTag: 6
    };
  };

  M.neuesProjekt = function (jahr) {
    var jetzt = new Date().toISOString();
    return {
      format: M.FORMAT, schema: M.SCHEMA, projektId: U.uid(), jahr: jahr || new Date().getFullYear(),
      erstellt: jetzt, geaendert: jetzt,
      einstellungen: M.standardEinstellungen(),
      regeln: AB.provision.standardRegeln(),
      tarife: [], antraege: [],
      abrechnung: { felder: [], zeilen: [] },
      importe: [], importZaehler: 0,
      zuordnungen: {}, ignoriert: {},
      vdienst: { zuordnungen: {}, importe: [] },
      team: null,
      sicherungen: []
    };
  };

  /** Fremde/alte Projektdateien prüfen und auf das aktuelle Schema heben. */
  M.migriere = function (p) {
    if (!p || typeof p !== 'object' || p.format !== M.FORMAT)
      throw new Error('Das ist keine Antragsbuch-Projektdatei.');
    if (p.schema > M.SCHEMA)
      throw new Error('Diese Projektdatei stammt aus einer neueren Version des Antragsbuchs (Schema ' + p.schema + '). Bitte die aktuelle antragsbuch.html verwenden.');
    // Schritte für künftige Versionen: if (p.schema === 1) { …; p.schema = 2; }
    if (!p.schema) p.schema = 1;
    var leer = M.neuesProjekt(p.jahr);
    Object.keys(leer).forEach(function (k) { if (p[k] == null && k !== 'team') p[k] = leer[k]; });
    var std = M.standardEinstellungen();
    Object.keys(std).forEach(function (k) { if (p.einstellungen[k] == null) p.einstellungen[k] = std[k]; });
    Object.keys(std.sla).forEach(function (k) { if (!p.einstellungen.sla[k]) p.einstellungen.sla[k] = std.sla[k]; });
    var regeln = AB.provision.standardRegeln();
    Object.keys(regeln).forEach(function (k) { if (!p.regeln[k]) p.regeln[k] = regeln[k]; });
    if (!p.vdienst.zuordnungen) p.vdienst.zuordnungen = {};
    if (!p.vdienst.importe) p.vdienst.importe = [];
    p.antraege.forEach(M.ergaenzeAntrag);
    if (p.team && p.team.zeilen && !p.team.zeilen.some(function (z) { return z.gesamt; }) && AB.team) AB.team.erkenneGesamt(p.team);
    return p;
  };

  M.neuePosition = function () {
    return { id: U.uid(), person: '', personennummer: '', tarif: '', beitrag: null, bereich: '' };
  };

  M.neuerAntrag = function (vorlage) {
    var a = {
      id: U.uid(), eingang: U.heute(), vn: { name: '', vorname: '' },
      bereich: 'voll', vorgang: 'neu', vertragsnummer: '',
      positionen: [M.neuePosition()],
      beginn: '', gruppenvertrag: '', firma: '', laufzeit: null,
      eantrag: false, bank: { aktiv: false, anteil: 50 }, bemerkung: '',
      status: 'eingereicht', statusDatum: U.heute(), statusManuell: false, historie: [],
      provisionManuell: null, abweichungOk: null, nachbearbeitung: { status: '', text: '', datum: '' }, reklamation: null,
      erstellt: new Date().toISOString(), geaendert: new Date().toISOString()
    };
    if (vorlage) {
      var k = JSON.parse(JSON.stringify(vorlage));
      ['eingang', 'vn', 'bereich', 'vorgang', 'vertragsnummer', 'beginn', 'gruppenvertrag', 'firma', 'laufzeit', 'eantrag', 'bank', 'bemerkung']
        .forEach(function (f) { a[f] = k[f]; });
      a.positionen = k.positionen.map(function (p) { p.id = U.uid(); return p; });
    }
    a.historie = [{ status: a.status, datum: a.statusDatum, am: a.erstellt, quelle: 'manuell' }];
    return a;
  };

  M.ergaenzeAntrag = function (a) {
    var n = M.neuerAntrag();
    Object.keys(n).forEach(function (k) { if (a[k] === undefined) a[k] = n[k]; });
    if (!a.vn) a.vn = { name: '', vorname: '' };
    if (!a.bank) a.bank = { aktiv: false, anteil: 50 };
    if (!a.nachbearbeitung) a.nachbearbeitung = { status: '', text: '', datum: '' };
    if (!Array.isArray(a.positionen) || !a.positionen.length) a.positionen = [M.neuePosition()];
    return a;
  };

  M.vnName = function (a) {
    return (a.vn.name || '') + (a.vn.vorname ? ', ' + a.vn.vorname : '');
  };

  /** Minder-/Storno-Vorgänge zählen immer negativ, auch wenn positiv erfasst. */
  M.vorzeichen = function (a, betrag) {
    if (betrag == null || isNaN(betrag)) return 0;
    return (a.vorgang === 'minder' || a.vorgang === 'storno') ? -Math.abs(betrag) : betrag;
  };
  M.beitrag = function (a) {
    var s = 0;
    for (var i = 0; i < a.positionen.length; i++) s += M.vorzeichen(a, +a.positionen[i].beitrag || 0);
    return U.runde(s);
  };
  M.tarife = function (a) {
    return a.positionen.map(function (p) { return p.tarif; }).filter(Boolean).join(', ');
  };

  /** Wird der Antrag gegen die Abrechnung geprüft? */
  M.pruefbar = function (a) { return a.bereich !== 'gkv' && a.vorgang !== 'umstellung'; };
  /** Zählt der Antrag noch als „unterwegs"? */
  M.istOffen = function (a) { return a.status === 'eingereicht' || a.status === 'policiert' || a.status === 'reklamiert'; };

  /**
   * Bearbeitungsampel eines Antrags. hatBuchung: Abgleich hat eine Buchung gefunden.
   * → { stufe: ''|'gruen'|'gelb'|'rot', wt (Werktage seit Einreichung), grund }
   */
  M.ampel = function (a, e, heute, hatBuchung) {
    var nb = a.nachbearbeitung && a.nachbearbeitung.status === 'offen';
    var wt = U.werktage(a.eingang, heute), o = { stufe: '', wt: wt, grund: '' };
    if (a.status === 'eingereicht') {
      var s = (e.sla && e.sla[a.bereich]) || { gelb: 5, rot: 10 };
      o.stufe = wt >= s.rot ? 'rot' : wt >= s.gelb ? 'gelb' : 'gruen';
      o.grund = wt + (wt === 1 ? ' Werktag' : ' Werktage') + ' seit Einreichung, noch nicht policiert (Ziel ' + s.gelb + ')';
    } else if (a.status === 'policiert') {
      o.wt = U.werktage(a.statusDatum, heute);
      if (!M.pruefbar(a)) { o.stufe = 'gruen'; o.grund = 'Policiert'; }
      else if (hatBuchung) { o.stufe = 'gruen'; o.grund = 'Policiert und gebucht'; }
      else {
        var d = a.statusDatum || a.eingang || heute, j = +d.slice(0, 4), m = +d.slice(5, 7) + 1;
        if (m > 12) { m = 1; j++; }
        var tag = Math.min(28, +e.abrechnungTag || 6), faellig = j + '-' + (m < 10 ? '0' : '') + m + '-' + (tag < 10 ? '0' : '') + tag;
        var ueber = U.tageZwischen(faellig, heute);
        o.stufe = ueber > 31 ? 'rot' : ueber > 0 ? 'gelb' : 'gruen';
        o.grund = ueber > 0 ? 'Policiert, aber seit ' + U.fmtDatum(faellig) + ' nicht abgerechnet' : 'Policiert – Abrechnung erwartet ab ' + U.fmtDatum(faellig);
      }
      if (!U.normVnr(a.vertragsnummer) && a.bereich !== 'gkv' && o.stufe === 'gruen') { o.stufe = 'gelb'; o.grund = 'Policiert, aber Vertragsnummer fehlt'; }
    } else if (a.status === 'reklamiert') { o.stufe = 'gelb'; o.grund = 'Reklamiert'; }
    if (nb) { o.stufe = 'rot'; o.grund = 'Nachbearbeitung offen' + (a.nachbearbeitung.text ? ': ' + a.nachbearbeitung.text : '') + (o.grund ? ' · ' + o.grund : ''); }
    return o;
  };

  /** Pflichtfeldprüfung → Liste { feld, text }. */
  M.pruefeAntrag = function (a) {
    var f = [];
    if (!a.eingang) f.push({ feld: 'eingang', text: 'Eingangsdatum fehlt.' });
    if (!String(a.vn.name || '').trim()) f.push({ feld: 'vn.name', text: 'Name des Versicherungsnehmers fehlt.' });
    if (!String(a.vn.vorname || '').trim() && a.bereich !== 'bkv' && a.bereich !== 'gruppe')
      f.push({ feld: 'vn.vorname', text: 'Vorname des Versicherungsnehmers fehlt.' });
    if (!M.bereich[a.bereich]) f.push({ feld: 'bereich', text: 'Bereich fehlt.' });
    if (!M.vorgang[a.vorgang]) f.push({ feld: 'vorgang', text: 'Vorgangsart fehlt.' });
    var pos = a.positionen.filter(function (p) { return p.tarif || p.beitrag != null || p.person; });
    if (!pos.length) f.push({ feld: 'pos.0.tarif', text: 'Mindestens eine Position mit Tarif und Beitrag erfassen.' });
    a.positionen.forEach(function (p, i) {
      if (pos.indexOf(p) < 0 && a.positionen.length > 1) return;
      if (!String(p.tarif || '').trim()) f.push({ feld: 'pos.' + i + '.tarif', text: 'Position ' + (i + 1) + ': Tarif fehlt.' });
      if (a.bereich !== 'gkv' && (p.beitrag == null || p.beitrag === '' || isNaN(p.beitrag)))
        f.push({ feld: 'pos.' + i + '.beitrag', text: 'Position ' + (i + 1) + ': Beitrag fehlt.' });
    });
    if (a.bereich === 'leben' && a.vorgang !== 'umstellung' && !(+a.laufzeit > 0))
      f.push({ feld: 'laufzeit', text: 'Leben: Laufzeit in Jahren fehlt (für die Bewertungssumme).' });
    if (a.bank.aktiv && !(+a.bank.anteil > 0 && +a.bank.anteil <= 100))
      f.push({ feld: 'bank.anteil', text: 'Bank-Anteil muss zwischen 1 und 100 % liegen.' });
    return f;
  };

  /** Mögliche Dubletten zu einem (neuen/geänderten) Antrag. */
  M.findeDubletten = function (a, alle) {
    var vn = U.normVnr(a.vertragsnummer), name = U.falte(M.vnName(a)).replace(/[^a-z]/g, ''), b = M.beitrag(a);
    if (!name && !vn) return [];
    return alle.filter(function (x) {
      if (x.id === a.id || x.bereich !== a.bereich || x.vorgang !== a.vorgang) return false;
      if (Math.abs(M.beitrag(x) - b) > 0.005) return false;
      var gleicherName = name && U.falte(M.vnName(x)).replace(/[^a-z]/g, '') === name;
      var gleicheNr = vn && U.normVnr(x.vertragsnummer) === vn;
      if (!gleicherName && !gleicheNr) return false;
      return Math.abs(U.tageZwischen(x.eingang, a.eingang)) <= 31;
    });
  };

  /** Statuswechsel mit Datum und Historie. quelle: 'manuell' | 'abgleich' | 'vdienst'. */
  M.setzeStatus = function (a, status, datum, quelle, notiz) {
    if (a.status === status && a.statusDatum === (datum || a.statusDatum)) return false;
    a.status = status; a.statusDatum = datum || U.heute();
    a.historie.push({ status: status, datum: a.statusDatum, am: new Date().toISOString(), quelle: quelle || 'manuell', notiz: notiz || '' });
    if (quelle === 'reklamation') a.statusManuell = false;
    if (quelle === 'manuell' || !quelle) a.statusManuell = !(status === 'eingereicht' || status === 'policiert');
    a.geaendert = new Date().toISOString();
    return true;
  };

  /** Letzter Status, der nicht vom Abgleich gesetzt wurde (zum Zurücknehmen). */
  M.statusVorAbgleich = function (a) {
    for (var i = a.historie.length - 1; i >= 0; i--)
      if (a.historie[i].quelle !== 'abgleich') return a.historie[i];
    return { status: 'eingereicht', datum: a.eingang };
  };

  /** Volltext eines Antrags für die Sofortsuche. */
  M.suchtext = function (a) {
    var t = [a.vn.name, a.vn.vorname, a.vertragsnummer, U.normVnr(a.vertragsnummer), M.name('bereich', a.bereich), M.name('vorgang', a.vorgang),
      M.name('status', a.status), U.fmtDatum(a.eingang), U.fmtDatum(a.beginn), a.gruppenvertrag, a.firma, a.bemerkung,
      U.fmtZahl(M.beitrag(a)), a.nachbearbeitung && a.nachbearbeitung.status === 'offen' ? 'nachbearbeitung ' + a.nachbearbeitung.text : '', a.reklamation ? 'reklamation ' + (a.reklamation.begruendung || '') : ''];
    a.positionen.forEach(function (p) { t.push(p.person, p.personennummer, p.tarif, p.beitrag == null ? '' : U.fmtZahl(+p.beitrag)); });
    return U.falte(t.join(' '));
  };

  /** Tarifliste um neue Einträge erweitern. Gibt die Zahl neuer Tarife zurück. */
  M.erweitereTarife = function (p, neue, quelle) {
    var vorhanden = {}, n = 0;
    p.tarife.forEach(function (t) { vorhanden[t.name.toLowerCase()] = t; });
    neue.forEach(function (t) {
      var name = String(t.name || '').trim();
      if (!name) return;
      var k = name.toLowerCase();
      if (vorhanden[k]) { if (!vorhanden[k].gruppe && t.gruppe) vorhanden[k].gruppe = t.gruppe; return; }
      vorhanden[k] = { name: name, gruppe: t.gruppe || '', quelle: quelle || 'manuell' };
      p.tarife.push(vorhanden[k]); n++;
    });
    if (n) p.tarife.sort(function (a, b) { return a.name.localeCompare(b.name, 'de', { numeric: true }); });
    return n;
  };

  /** Sicherungsstand anlegen (ohne Abrechnungszeilen), höchstens 10 behalten. */
  M.sichere = function (p, anlass) {
    var daten = JSON.stringify({
      antraege: p.antraege, zuordnungen: p.zuordnungen, ignoriert: p.ignoriert,
      einstellungen: p.einstellungen, regeln: p.regeln, tarife: p.tarife
    });
    p.sicherungen.push({ id: U.uid(), am: new Date().toISOString(), anlass: anlass, antraege: p.antraege.length, daten: daten });
    while (p.sicherungen.length > 10) p.sicherungen.shift();
  };
  M.stelleWiederHer = function (p, id) {
    var s = p.sicherungen.find(function (x) { return x.id === id; });
    if (!s) return false;
    var d = JSON.parse(s.daten);
    M.sichere(p, 'Vor Wiederherstellung');
    ['antraege', 'zuordnungen', 'ignoriert', 'einstellungen', 'regeln', 'tarife'].forEach(function (k) { if (d[k]) p[k] = d[k]; });
    p.antraege.forEach(M.ergaenzeAntrag);
    return true;
  };
})(globalThis.AB = globalThis.AB || {});
