/* Antragsbuch – animierte SVG-Diagramme ohne Fremdbibliothek: Balken, Linien, Ring, Querbalken. */
(function (AB) {
  'use strict';
  var D = AB.dom, U = AB.util, G = AB.dia = {};
  G.FARBEN = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)'];
  G.GRAU = 'var(--s0)';

  function schritte(min, max, n) {
    if (max <= min) max = min + 1;
    var roh = (max - min) / (n || 4), p = Math.pow(10, Math.floor(Math.log10(roh))), f = roh / p;
    var s = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
    var a = Math.floor(min / s) * s, b = Math.ceil(max / s) * s, out = [];
    for (var v = a; v <= b + s / 2; v += s) out.push(Math.abs(v) < s / 1e6 ? 0 : v);
    return out;
  }
  function kurz(v) {
    var a = Math.abs(v);
    if (a >= 1e6) return U.fmtZahl(v / 1e6, 1) + ' Mio';
    if (a >= 10000) return U.fmtZahl(v / 1000, 0) + ' T';
    if (a >= 1000) return U.fmtZahl(v / 1000, 1) + ' T';
    return U.fmtZahl(v, a < 10 && a % 1 ? 1 : 0);
  }
  G.kurz = kurz;
  function rahmen(el, hoehe, ticks, o) {
    var W = Math.max(320, el.clientWidth || 600), H = hoehe, l = 46, r = 10, t = 10, b = 24;
    var svg = D.s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': o.titel || 'Diagramm' });
    var y = function (v) { return t + (H - t - b) * (1 - (v - ticks[0]) / (ticks[ticks.length - 1] - ticks[0])); };
    ticks.forEach(function (v) {
      svg.appendChild(D.s('line', { x1: l, x2: W - r, y1: y(v), y2: y(v), 'class': 'gitter' + (v === 0 ? ' null' : '') }));
      svg.appendChild(D.s('text', { x: l - 8, y: y(v) + 4, 'text-anchor': 'end' }, kurz(v)));
    });
    return { svg: svg, W: W, H: H, l: l, r: r, t: t, b: b, y: y };
  }
  function legende(reihen) {
    var box = D.h('div.legende');
    reihen.forEach(function (r) { box.appendChild(D.h('span', null, D.h('i', { style: { background: r.farbe } }), r.name)); });
    return box;
  }
  function ecke(x, y, w, h, oben, rad) { // Rechteck mit runder Datenseite
    rad = Math.min(rad, w / 2, h);
    if (h <= 0) return '';
    return oben
      ? 'M' + x + ' ' + (y + h) + 'V' + (y + rad) + 'q0 ' + -rad + ' ' + rad + ' ' + -rad + 'h' + (w - 2 * rad) + 'q' + rad + ' 0 ' + rad + ' ' + rad + 'V' + (y + h) + 'z'
      : 'M' + x + ' ' + y + 'V' + (y + h - rad) + 'q0 ' + rad + ' ' + rad + ' ' + rad + 'h' + (w - 2 * rad) + 'q' + rad + ' 0 ' + rad + ' ' + -rad + 'V' + y + 'z';
  }

  /**
   * Gestapelte (oder gruppierte) Balken. Negative Werte werden nach unten gestapelt.
   * o: { kategorien:[], reihen:[{name,farbe,werte:[]}], format(v), hoehe, gruppiert, titel, klick(i) }
   */
  G.balken = function (el, o) {
    D.leere(el); el.classList.add('dia');
    var n = o.kategorien.length, max = 0, min = 0, i;
    for (i = 0; i < n; i++) {
      var pos = 0, neg = 0;
      o.reihen.forEach(function (r) { var v = r.werte[i] || 0; if (o.gruppiert) { max = Math.max(max, v); min = Math.min(min, v); } else if (v >= 0) pos += v; else neg += v; });
      if (!o.gruppiert) { max = Math.max(max, pos); min = Math.min(min, neg); }
    }
    var R = rahmen(el, o.hoehe || 230, schritte(min, max || 1, 4), o), bw = (R.W - R.l - R.r) / n, fmt = o.format || kurz;
    for (i = 0; i < n; i++) (function (i) {
      var g = D.s('g', { 'class': 'spalte' }), x0 = R.l + i * bw, breite = Math.min(34, bw * 0.62), pos = 0, neg = 0;
      var sichtbar = o.reihen.filter(function (r) { return r.werte[i]; });
      o.reihen.forEach(function (r, ri) {
        var v = r.werte[i] || 0; if (!v) return;
        var x, w, y1, y2;
        if (o.gruppiert) { w = Math.max(3, breite * 1.5 / o.reihen.length - 2); x = x0 + bw / 2 - (o.reihen.length * (w + 2)) / 2 + ri * (w + 2); y1 = R.y(Math.max(0, v)); y2 = R.y(Math.min(0, v)); }
        else { w = breite; x = x0 + (bw - w) / 2; if (v >= 0) { y2 = R.y(pos); pos += v; y1 = R.y(pos); } else { y1 = R.y(neg); neg += v; y2 = R.y(neg); } }
        var letzter = o.gruppiert || r === (v >= 0 ? sichtbar.filter(function (s) { return s.werte[i] > 0; }).pop() : sichtbar.filter(function (s) { return s.werte[i] < 0; }).pop());
        var hh = Math.max(1, y2 - y1 - (o.gruppiert ? 0 : 2)), yy = v >= 0 ? y1 : y1 + (o.gruppiert ? 0 : 2);
        var p = D.s('path', { d: letzter ? ecke(x, yy, w, hh, v >= 0, 4) : 'M' + x + ' ' + yy + 'h' + w + 'v' + hh + 'h' + -w + 'z', fill: r.farbe, 'class': 'balken' + (v < 0 ? ' neg' : '') });
        p.style.animationDelay = (i * 28) + 'ms';
        g.appendChild(p);
      });
      g.appendChild(D.s('rect', { x: x0, y: R.t, width: bw, height: R.H - R.t - R.b, fill: 'transparent' }));
      g.appendChild(D.s('text', { x: x0 + bw / 2, y: R.H - 6, 'text-anchor': 'middle' }, o.kategorien[i]));
      D.tipp(g, function () {
        var z = [D.h('div', { style: { fontWeight: 600, marginBottom: '2px' } }, o.kategorienLang ? o.kategorienLang[i] : o.kategorien[i])], s = 0;
        o.reihen.forEach(function (r) { var v = r.werte[i] || 0; s += v; if (v || o.reihen.length < 4) z.push(D.tippZeile(r.farbe, r.name, fmt(v))); });
        if (o.reihen.length > 1 && !o.gruppiert) z.push(D.tippZeile(null, 'Summe', fmt(s)));
        return z;
      });
      if (o.klick) { g.style.cursor = 'pointer'; g.addEventListener('click', function () { o.klick(i); }); }
      R.svg.appendChild(g);
    })(i);
    el.appendChild(R.svg);
    if (o.reihen.length > 1) el.appendChild(legende(o.reihen));
  };

  /**
   * Linien. o: { kategorien, reihen:[{name,farbe,werte:[zahl|null],strich,flaeche,stark}], band:{unten:[],oben:[],name}, format, hoehe }
   */
  G.linie = function (el, o) {
    D.leere(el); el.classList.add('dia');
    var alle = [], n = o.kategorien.length;
    o.reihen.forEach(function (r) { r.werte.forEach(function (v) { if (v != null) alle.push(v); }); });
    if (o.band) o.band.unten.concat(o.band.oben).forEach(function (v) { if (v != null) alle.push(v); });
    var R = rahmen(el, o.hoehe || 230, schritte(Math.min(0, Math.min.apply(null, alle.concat([0]))), Math.max.apply(null, alle.concat([1])), 4), o);
    var fmt = o.format || kurz, bw = (R.W - R.l - R.r) / n, x = function (i) { return R.l + bw * (i + 0.5); };
    o.kategorien.forEach(function (k, i) { R.svg.appendChild(D.s('text', { x: x(i), y: R.H - 6, 'text-anchor': 'middle' }, k)); });
    if (o.band) {
      var oben = [], unten = [];
      for (var i = 0; i < n; i++) if (o.band.oben[i] != null) { oben.push(x(i) + ' ' + R.y(o.band.oben[i])); unten.unshift(x(i) + ' ' + R.y(o.band.unten[i])); }
      if (oben.length > 1) R.svg.appendChild(D.s('path', { d: 'M' + oben.concat(unten).join('L') + 'z', fill: 'var(--s0)', opacity: .28, 'class': 'flaeche' }));
    }
    o.reihen.forEach(function (r, ri) {
      var pkt = [];
      r.werte.forEach(function (v, i) { if (v != null) pkt.push([x(i), R.y(v)]); });
      if (!pkt.length) return;
      var d = 'M' + pkt.map(function (p) { return p[0] + ' ' + p[1]; }).join('L');
      if (r.flaeche && pkt.length > 1) {
        var id = 'vl' + Math.random().toString(36).slice(2, 8);
        R.svg.appendChild(D.s('defs', null, D.s('linearGradient', { id: id, x1: 0, y1: 0, x2: 0, y2: 1 }, D.s('stop', { offset: 0, 'stop-color': r.farbe, 'stop-opacity': .28 }), D.s('stop', { offset: 1, 'stop-color': r.farbe, 'stop-opacity': 0 }))));
        R.svg.appendChild(D.s('path', { d: d + 'L' + pkt[pkt.length - 1][0] + ' ' + R.y(0) + 'L' + pkt[0][0] + ' ' + R.y(0) + 'z', fill: 'url(#' + id + ')', 'class': 'flaeche' }));
      }
      var p = D.s('path', { d: d, stroke: r.farbe, pathLength: 1, 'class': 'linie' + (r.strich ? ' strich' : '') });
      if (r.stark) p.style.strokeWidth = 3;
      p.style.animationDelay = (ri * 90) + 'ms';
      R.svg.appendChild(p);
      var e = pkt[pkt.length - 1];
      if (!r.strich) R.svg.appendChild(D.s('circle', { cx: e[0], cy: e[1], r: 4.5, fill: r.farbe, 'class': 'knoten' }));
    });
    var kreuz = D.s('line', { y1: R.t, y2: R.H - R.b, 'class': 'fadenkreuz', visibility: 'hidden' });
    R.svg.appendChild(kreuz);
    var flaeche = D.s('rect', { x: R.l, y: R.t, width: R.W - R.l - R.r, height: R.H - R.t - R.b, fill: 'transparent' });
    R.svg.appendChild(flaeche);
    D.tipp(flaeche, function (ev) {
      var b = R.svg.getBoundingClientRect(), px = (ev.clientX - b.left) / b.width * R.W;
      var i = Math.max(0, Math.min(n - 1, Math.floor((px - R.l) / bw)));
      kreuz.setAttribute('x1', x(i)); kreuz.setAttribute('x2', x(i)); kreuz.setAttribute('visibility', 'visible');
      var z = [D.h('div', { style: { fontWeight: 600, marginBottom: '2px' } }, o.kategorienLang ? o.kategorienLang[i] : o.kategorien[i])];
      o.reihen.forEach(function (r) { if (r.werte[i] != null) z.push(D.tippZeile(r.farbe, r.name, fmt(r.werte[i]))); });
      if (o.band && o.band.oben[i] != null) z.push(D.tippZeile('var(--s0)', o.band.name, fmt(o.band.unten[i]) + ' – ' + fmt(o.band.oben[i])));
      return z.length > 1 ? z : null;
    });
    flaeche.addEventListener('pointerleave', function () { kreuz.setAttribute('visibility', 'hidden'); });
    el.appendChild(R.svg);
    var leg = o.reihen.slice();
    if (o.band) leg.push({ name: o.band.name, farbe: 'var(--s0)' });
    if (leg.length > 1) el.appendChild(legende(leg));
  };

  /** Ringdiagramm mit Legende. o: { teile:[{name,wert,farbe}], mitte:{wert,label}, format } – höchstens 5 Teile + „Sonstige". */
  G.ring = function (el, o) {
    D.leere(el);
    var fmt = o.format || kurz;
    var teile = o.teile.filter(function (t) { return t.wert > 0; }).sort(function (a, b) { return b.wert - a.wert; });
    if (teile.length > 6) {
      var rest = teile.slice(5).reduce(function (s, t) { return s + t.wert; }, 0);
      teile = teile.slice(0, 5).concat([{ name: 'Sonstige', wert: rest, farbe: G.GRAU }]);
    }
    var summe = teile.reduce(function (s, t) { return s + t.wert; }, 0);
    var box = D.h('div.ringbox'), dia = D.h('div.dia'), svg = D.s('svg', { viewBox: '0 0 120 120', role: 'img', 'aria-label': o.titel || 'Ringdiagramm' });
    var rad = 46, um = 2 * Math.PI * rad, start = 0;
    svg.appendChild(D.s('circle', { cx: 60, cy: 60, r: rad, fill: 'none', stroke: 'var(--surface-2)', 'stroke-width': 13 }));
    teile.forEach(function (t, i) {
      var anteil = summe ? t.wert / summe : 0, luecke = teile.length > 1 ? 2 : 0, len = Math.max(0.5, anteil * um - luecke);
      var c = D.s('circle', { cx: 60, cy: 60, r: rad, stroke: t.farbe, 'stroke-width': 13, 'class': 'ring', transform: 'rotate(' + (-90 + start * 360) + ' 60 60)' });
      c.style.strokeDasharray = len + ' ' + (um - len);
      c.style.strokeDashoffset = len; c.style.animationDelay = (i * 80) + 'ms';
      c.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 800, delay: i * 80, fill: 'forwards', easing: 'cubic-bezier(.3,.7,.2,1)' });
      c.style.animation = 'none';
      D.tipp(c, [D.tippZeile(t.farbe, t.name, fmt(t.wert)), D.h('div', null, U.fmtZahl(anteil * 100, 1) + ' %')]);
      svg.appendChild(c); start += anteil;
    });
    dia.appendChild(svg);
    if (o.mitte) dia.appendChild(D.h('div.ringmitte', null, D.h('div', null, D.h('b.num', null, o.mitte.wert), D.h('span', null, o.mitte.label))));
    var leg = D.h('div.legende.spalte');
    teile.forEach(function (t) { leg.appendChild(D.h('span', null, D.h('i', { style: { background: t.farbe } }), t.name, D.h('b', null, fmt(t.wert)))); });
    if (!teile.length) leg.appendChild(D.h('span.muted', null, 'Noch keine Daten'));
    box.appendChild(dia); box.appendChild(leg); el.appendChild(box);
  };

  /** Querbalken (Rangliste). o: { zeilen:[{name, wert, farbe, zusatz}], format, max } */
  G.quer = function (el, o) {
    D.leere(el);
    var fmt = o.format || kurz, max = o.max || Math.max.apply(null, o.zeilen.map(function (z) { return Math.abs(z.wert); }).concat([1]));
    var hatNeg = o.zeilen.some(function (z) { return z.wert < 0; });
    var box = D.h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(70px, max-content) 1fr max-content', gap: '7px 12px', alignItems: 'center', fontSize: '13.5px' } });
    o.zeilen.forEach(function (z, i) {
      var spur = D.h('div.dia', { style: { height: '10px', background: 'var(--surface-2)', borderRadius: '99px', position: 'relative', overflow: 'hidden' } });
      var anteil = Math.abs(z.wert) / max * (hatNeg ? 50 : 100);
      var b = D.h('div.hb', { style: { position: 'absolute', top: 0, bottom: 0, borderRadius: '99px', background: z.farbe || 'var(--s1)', width: anteil + '%',
        left: hatNeg ? (z.wert < 0 ? (50 - anteil) + '%' : '50%') : 0, animationDelay: (i * 40) + 'ms' } });
      spur.appendChild(b);
      D.tipp(spur, [D.tippZeile(z.farbe || 'var(--s1)', z.name, fmt(z.wert)), z.zusatz ? D.h('div', null, z.zusatz) : null]);
      D.anhaengen(box, [D.h('div', { style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '190px' }, title: z.name }, z.name), spur, D.h('div.num.rechts', { style: { fontWeight: 600 } }, fmt(z.wert))]);
    });
    if (!o.zeilen.length) box.appendChild(D.h('div.muted', null, 'Noch keine Daten'));
    el.appendChild(box);
  };

  /** Kleine Verlaufslinie für Kacheln. */
  G.funke = function (werte, farbe) {
    var svg = D.s('svg', { viewBox: '0 0 92 34', 'class': 'funke', 'aria-hidden': 'true' });
    var w = werte.filter(function (v) { return v != null; });
    if (w.length < 2) return svg;
    var min = Math.min.apply(null, w), max = Math.max.apply(null, w), sp = max - min || 1;
    var d = 'M' + w.map(function (v, i) { return (2 + i * 88 / (w.length - 1)).toFixed(1) + ' ' + (30 - (v - min) / sp * 26).toFixed(1); }).join('L');
    var wrap = D.h('div.dia.funke'); 
    svg.appendChild(D.s('path', { d: d, stroke: farbe || 'currentColor', pathLength: 1, 'class': 'linie' }));
    svg.setAttribute('class', ''); wrap.appendChild(svg);
    return wrap;
  };
})(globalThis.AB = globalThis.AB || {});
