/* Antragsbuch – virtuelle Tabelle: zeichnet nur sichtbare Zeilen, auch bei 50.000+ Einträgen flüssig. */
(function (AB) {
  'use strict';
  var D = AB.dom;

  /**
   * AB.tabelle(el, { spalten:[{t, b, w(row)→Text|Node, s(row)→Sortierwert, r:rechts, fix}], zeilen, hoehe, klick(row), leer, fuss(zeilen)→[…], klasse(row), sort:{i,ab} })
   * → { setze(zeilen), zeilen(), zeichne() }
   */
  AB.tabelle = function (el, o) {
    var H = o.hoehe || 46, raster = o.spalten.map(function (s) { return s.b || '1fr'; }).join(' ');
    var sort = o.sort || null, daten = [], sicht = [];
    var kopf = D.h('div.vt-kopf', { style: { gridTemplateColumns: raster } });
    var innen = D.h('div', { style: { position: 'relative' } }), rumpf = D.h('div.vt-rumpf', { tabIndex: 0 }, innen);
    var fuss = o.fuss ? D.h('div.vt-fuss', { style: { gridTemplateColumns: raster } }) : null;
    var box = D.h('div.vt', { role: 'table' }, kopf, rumpf, fuss);
    o.spalten.forEach(function (s, i) {
      var c = D.h('div' + (s.r ? '.rechts' : '') + (s.s ? '' : '.fix'), { title: s.titel || null }, s.kopf || s.t);
      if (s.s) c.addEventListener('click', function () {
        sort = sort && sort.i === i ? { i: i, ab: !sort.ab } : { i: i, ab: !!s.absteigend };
        ordne(); zeichne(true);
      });
      kopf.appendChild(c);
    });
    function ordne() {
      sicht = daten.slice();
      Array.from(kopf.children).forEach(function (c, i) { if (sort && sort.i === i) c.setAttribute('aria-sort', sort.ab ? 'descending' : 'ascending'); else c.removeAttribute('aria-sort'); });
      if (!sort) return;
      var f = o.spalten[sort.i].s, m = sort.ab ? -1 : 1;
      var paare = sicht.map(function (z) { return [f(z), z]; });
      paare.sort(function (a, b) {
        var x = a[0], y = b[0];
        if (x == null || x === '') return y == null || y === '' ? 0 : 1;
        if (y == null || y === '') return -1;
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * m;
        return String(x).localeCompare(String(y), 'de', { numeric: true, sensitivity: 'base' }) * m;
      });
      sicht = paare.map(function (p) { return p[1]; });
    }
    var von = -1, bis = -1;
    function zeichne(neu) {
      if (!sicht.length) {
        D.leere(innen); innen.style.height = 'auto'; von = bis = -1;
        innen.appendChild(D.h('div.vt-leer', null, o.leer || 'Keine Einträge.'));
      } else {
        var a = Math.max(0, Math.floor(rumpf.scrollTop / H) - 6), b = Math.min(sicht.length, Math.ceil((rumpf.scrollTop + (rumpf.clientHeight || 600)) / H) + 6);
        if (!neu && a === von && b === bis) return;
        von = a; bis = b;
        D.leere(innen); innen.style.height = sicht.length * H + 'px';
        for (var i = a; i < b; i++) innen.appendChild(zeile(sicht[i], i));
      }
      if (fuss && neu) {
        D.leere(fuss);
        (o.fuss(sicht) || []).forEach(function (c, i) { fuss.appendChild(D.h('div.num' + (o.spalten[i] && o.spalten[i].r ? '.rechts' : ''), null, c == null ? '' : c)); });
      }
    }
    function zeile(z, i) {
      var r = D.h('div.vt-zeile' + (o.klasse ? o.klasse(z) || '' : ''), { role: 'row', style: { gridTemplateColumns: raster, top: i * H + 'px', height: H + 'px' } });
      o.spalten.forEach(function (s) {
        var v = s.w(z), c = D.h('div' + (s.r ? '.rechts.num' : '') + (s.k ? '.' + s.k : ''));
        D.anhaengen(c, v);
        if (typeof v === 'string' && v.length > 14) c.title = v;
        r.appendChild(c);
      });
      if (o.klick) r.addEventListener('click', function (e) { if (!e.target.closest('button, input, a, label')) o.klick(z); });
      else r.style.cursor = 'default';
      return r;
    }
    var warte = false;
    rumpf.addEventListener('scroll', function () { if (warte) return; warte = true; requestAnimationFrame(function () { warte = false; zeichne(false); }); });
    if (window.ResizeObserver) new ResizeObserver(function () { zeichne(false); }).observe(rumpf);
    D.leere(el); el.appendChild(box);
    var api = {
      setze: function (zeilen) { daten = zeilen || []; ordne(); rumpf.scrollTop = 0; zeichne(true); return api; },
      zeilen: function () { return sicht; }, zeichne: function () { zeichne(true); }, el: box
    };
    return api.setze(o.zeilen || []);
  };
})(globalThis.AB = globalThis.AB || {});
