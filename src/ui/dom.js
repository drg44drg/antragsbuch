/* Antragsbuch – kleine DOM-Helfer, Symbole, Meldungen, Dialoge, Darstellung (Hell/Dunkel). */
(function (AB) {
  'use strict';
  var D = AB.dom = {};
  var SVG = 'http://www.w3.org/2000/svg';

  /** h('div.klasse#id', {attr}, kind, kind…) – Text wird immer als Text eingefügt (kein innerHTML). */
  D.h = function (sel, attrs) {
    var teile = sel.split(/(?=[.#])/), el = document.createElement(teile[0] || 'div');
    for (var i = 1; i < teile.length; i++) { if (teile[i][0] === '.') el.classList.add(teile[i].slice(1)); else el.id = teile[i].slice(1); }
    var start = 1;
    if (attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs)) {
      start = 2;
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k in el && k !== 'list' && k !== 'form') { try { el[k] = v; } catch (e) { el.setAttribute(k, v); } }
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var a = start; a < arguments.length; a++) D.anhaengen(el, arguments[a]);
    return el;
  };
  D.anhaengen = function (el, kind) {
    if (kind == null || kind === false) return;
    if (Array.isArray(kind)) kind.forEach(function (k) { D.anhaengen(el, k); });
    else el.appendChild(kind instanceof Node ? kind : document.createTextNode(String(kind)));
  };
  D.s = function (name, attrs) {
    var el = document.createElementNS(SVG, name);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] != null) el.setAttribute(k, attrs[k]); });
    for (var a = 2; a < arguments.length; a++) { var k = arguments[a]; if (k != null) el.appendChild(k instanceof Node ? k : document.createTextNode(String(k))); }
    return el;
  };
  D.leere = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  var PFADE = {
    start: 'M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z',
    antraege: 'M7 3h8l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h7M9 17h5',
    abgleich: 'M4 7h13l-3-3M20 17H7l3 3M4 7v0M20 17v0',
    vdienst: 'M12 3v4M12 17v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M3 12h4M17 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8',
    team: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16.5 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2.5 19c.6-3 2.8-4.5 5.5-4.5s4.900 1.5 5.500 4.500M15 14.600c2.700-.3 5.100 1 6 4.400',
    einstellungen: 'M12 15.500a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7zM19.400 13a7.600 7.600 0 0 0 0-2l2-1.600-2-3.400-2.400 1a7.600 7.600 0 0 0-1.700-1L15 3.500h-4l-.3 2.500a7.600 7.600 0 0 0-1.700 1l-2.400-1-2 3.400 2 1.600a7.600 7.600 0 0 0 0 2l-2 1.600 2 3.400 2.400-1a7.600 7.600 0 0 0 1.700 1l.3 2.500h4l.3-2.500a7.600 7.600 0 0 0 1.700-1l2.400 1 2-3.400z',
    hilfe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.700.400-1 1-1 1.700M12 17v.01',
    plus: 'M12 5v14M5 12h14', suche: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
    hoch: 'M12 16V4M7 9l5-5 5 5M5 20h14', runter: 'M12 4v12M7 11l5 5 5-5M5 20h14', druck: 'M7 8V4h10v4M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z',
    x: 'M6 6l12 12M18 6L6 18', ordner: 'M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
    datei: 'M7 3h8l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5', haken: 'M5 12.500l4.500 4.500L19 7.500',
    kopie: 'M9 9h10v11H9zM5 15V4h10', muell: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13', funke: 'M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800z',
    sonne: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.500 1.500M17.500 17.500L19 19M5 19l1.500-1.500M17.500 6.500L19 5',
    mond: 'M20 14.500A8 8 0 0 1 9.500 4a8 8 0 1 0 10.500 10.500z'
  };
  D.icon = function (name) {
    return D.s('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
      D.s('path', { d: PFADE[name] || '' }));
  };
  D.btn = function (text, klick, opt) {
    opt = opt || {};
    return D.h('button.btn' + (opt.klasse ? '.' + opt.klasse.split(' ').join('.') : ''), { type: 'button', onclick: klick, title: opt.titel || null, disabled: opt.aus || null },
      opt.icon ? D.icon(opt.icon) : null, text, opt.taste ? D.h('kbd', null, opt.taste) : null);
  };
  D.feld = function (label, eingabe, klasse, pflicht) {
    return D.h('label.feld' + (klasse ? '.' + klasse : ''), null, D.h('span', null, label, pflicht ? D.h('i', null, ' *') : null), eingabe);
  };
  D.auswahl = function (optionen, wert, onchange, attrs) {
    var sel = D.h('select', Object.assign({ onchange: function () { onchange && onchange(sel.value); } }, attrs || {}));
    optionen.forEach(function (o) { sel.appendChild(D.h('option', { value: o[0] }, o[1])); });
    sel.value = wert == null ? '' : wert;
    return sel;
  };
  D.seg = function (optionen, wert, onchange) {
    var box = D.h('div.seg', { role: 'tablist' });
    optionen.forEach(function (o) {
      box.appendChild(D.h('button' + (o[0] === wert ? '.aktiv' : ''), { type: 'button', title: o[2] || null, onclick: function () {
        Array.from(box.children).forEach(function (b) { b.classList.remove('aktiv'); });
        this.classList.add('aktiv'); onchange(o[0]);
      } }, o[1]));
    });
    return box;
  };

  D.toast = function (text, opt) {
    opt = opt || {};
    var t = D.h('div.toast' + (opt.krit ? '.krit' : ''), { role: 'status' }, D.h('span', null, text));
    if (opt.aktion) t.appendChild(D.h('button', { onclick: function () { opt.aktion[1](); t.remove(); } }, opt.aktion[0]));
    document.getElementById('toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, opt.dauer || (opt.krit ? 9000 : 5000));
  };

  /** Modaler Dialog. → { el, rumpf, fuss, zu() } */
  D.dialog = function (titel, opt) {
    opt = opt || {};
    var rumpf = D.h('div.dlg-rumpf'), fuss = D.h('div.dlg-fuss');
    var dlg = D.h('dialog' + (opt.klasse ? '.' + opt.klasse : ''), null,
      D.h('div.dlg-kopf', null, D.h('h2', null, titel), D.btn('', function () { schliesse(); }, { klasse: 'leise', icon: 'x', titel: 'Schließen (Esc)' })), rumpf, fuss);
    function schliesse(erzwingen) {
      if (!erzwingen && opt.vorSchliessen && opt.vorSchliessen() === false) return;
      dlg.close(); dlg.remove(); opt.nachSchliessen && opt.nachSchliessen();
    }
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); schliesse(); });
    document.body.appendChild(dlg); dlg.showModal();
    return { el: dlg, rumpf: rumpf, fuss: fuss, zu: function () { schliesse(true); } };
  };
  /** Rückfrage → Promise<boolean> */
  D.frage = function (titel, text, ja, opt) {
    opt = opt || {};
    return new Promise(function (res) {
      var d = D.dialog(titel, { klasse: 'schmal', nachSchliessen: function () { res(false); } });
      D.anhaengen(d.rumpf, typeof text === 'string' ? D.h('p.muted', { style: { margin: 0 } }, text) : text);
      D.anhaengen(d.fuss, [D.h('span', { style: { flex: 1 } }),
        D.btn(opt.nein || 'Abbrechen', function () { d.zu(); res(false); }),
        D.btn(ja || 'OK', function () { res(true); d.zu(); }, { klasse: 'haupt-btn' + (opt.gefahr ? ' gefahr' : '') })]);
      d.fuss.lastChild.focus();
    });
  };

  D.lade = function (dateiname, inhalt, typ) {
    var blob = inhalt instanceof Blob ? inhalt : new Blob([inhalt], { type: typ || 'text/csv;charset=utf-8' });
    var a = D.h('a', { href: URL.createObjectURL(blob), download: dateiname });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  };

  /** Formatierte Excel-Datei herunterladen. blaetter: ein Blatt oder eine Liste (siehe AB.xlsxout.schreibe). */
  D.excel = function (dateiname, blaetter) {
    D.lade(dateiname, new Blob([AB.xlsxout.schreibe(Array.isArray(blaetter) ? blaetter : [blaetter])], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  };
  /** Export-Knöpfe: Excel (formatiert) und – mit Umschalt-Taste – CSV. */
  D.exportBtn = function (name, tabelle, csv, opt) {
    return D.btn('Excel', function (e) {
      if (e.shiftKey && csv) { D.lade(name + '.csv', csv()); return; }
      var t = tabelle(); D.excel(name + '.xlsx', t);
    }, Object.assign({ icon: 'runter', titel: 'Als formatierte Excel-Datei speichern' + (csv ? ' (mit Umschalt-Taste: CSV)' : '') }, opt || {}));
  };

  /** Druckansicht: vollständige Tabelle (unabhängig von der virtuellen Liste). */
  D.drucke = function (titel, unter, kopf, zeilen, fuss) {
    var box = D.leere(document.getElementById('druck'));
    var th = D.h('tr'), tb = D.h('tbody');
    kopf.forEach(function (k) { th.appendChild(D.h('th' + (k.r ? '.r' : ''), null, k.t)); });
    zeilen.forEach(function (z) { var tr = D.h('tr'); z.forEach(function (c, i) { tr.appendChild(D.h('td' + (kopf[i].r ? '.r' : ''), null, c == null ? '' : c)); }); tb.appendChild(tr); });
    var tabelle = D.h('table', null, D.h('thead', null, th), tb);
    if (fuss) { var tf = D.h('tr'); fuss.forEach(function (c, i) { tf.appendChild(D.h('td' + (kopf[i].r ? '.r' : ''), null, c == null ? '' : c)); }); tabelle.appendChild(D.h('tfoot', null, tf)); }
    D.anhaengen(box, [D.h('h1', null, titel), D.h('p', null, unter), tabelle]);
    window.print();
  };

  /** Beliebige Knoten drucken (z. B. Formulare); jede .seite beginnt auf einem neuen Blatt. */
  D.druckeKnoten = function (knoten) {
    var box = D.leere(document.getElementById('druck'));
    D.anhaengen(box, knoten);
    window.print();
  };

  // ---------- Darstellung ----------
  D.thema = function (wert) {
    if (wert) { try { localStorage.setItem('antragsbuch-thema', wert); } catch (e) { /* privat */ } }
    else { try { wert = localStorage.getItem('antragsbuch-thema'); } catch (e) { /* privat */ } wert = wert || 'auto'; }
    if (wert === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', wert);
    return wert;
  };

  /** Zahl hochzählen lassen (für Kennzahl-Kacheln). */
  D.zaehle = function (el, ziel, format) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !isFinite(ziel)) { el.textContent = format(ziel); return; }
    var t0 = performance.now(), dauer = 650;
    function schritt(t) {
      var x = Math.min(1, (t - t0) / dauer), e = 1 - Math.pow(1 - x, 3);
      el.textContent = format(ziel * e);
      if (x < 1 && el.isConnected) requestAnimationFrame(schritt); else el.textContent = format(ziel);
    }
    el.textContent = format(0); requestAnimationFrame(schritt);
  };

  // ---------- Tooltip ----------
  D.tipp = function (el, inhalt) {
    el.addEventListener('pointermove', function (e) {
      var t = document.getElementById('tipp'), c = typeof inhalt === 'function' ? inhalt(e) : inhalt;
      if (!c) { t.classList.remove('an'); return; }
      D.leere(t); D.anhaengen(t, c); t.classList.add('an');
      var b = t.getBoundingClientRect(), x = e.clientX + 14, y = e.clientY + 14;
      if (x + b.width > innerWidth - 8) x = e.clientX - b.width - 12;
      if (y + b.height > innerHeight - 8) y = e.clientY - b.height - 12;
      t.style.left = Math.max(6, x) + 'px'; t.style.top = Math.max(6, y) + 'px';
    });
    el.addEventListener('pointerleave', function () { document.getElementById('tipp').classList.remove('an'); });
  };
  D.tippZeile = function (farbe, name, wert) {
    return D.h('div', null, farbe ? D.h('i', { style: { background: farbe } }) : null, name + (wert != null ? ': ' : ''), wert != null ? D.h('b', null, wert) : null);
  };
})(globalThis.AB = globalThis.AB || {});
