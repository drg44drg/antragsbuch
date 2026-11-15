/* Antragsbuch – Akzentfarbe: Standard (Lila), eine Farbe oder Multicolor. Gilt je Browser, nicht je Projektdatei. Produktfarben und Ampel bleiben unberührt. */
(function (AB) {
  'use strict';
  var A = AB.akzent = {}, SCHLUESSEL = 'antragsbuch-akzent';
  // Kuratierter Farbpool (Farben, die auf hellem Grund funktionieren)
  A.POOL = [["Hot Magenta", "#ff2d87"], ["Vivid Coral", "#ff6b5b"], ["Tangerine", "#ff8a3d"], ["Sky Teal", "#2dd4bf"], ["Marigold", "#f5c518"], ["Amber Glow", "#f59e0b"], ["Terracotta", "#c2410c"], ["Deep Coral", "#e11d48"], ["Forest Green", "#166534"], ["Moss", "#65a30d"], ["Sage", "#84cc16"], ["Royal Indigo", "#4f46e5"], ["Violet Spark", "#a855f7"], ["Cobalt", "#1d4ed8"], ["Steel Blue", "#3b82f6"], ["Hot Pink", "#ec4899"], ["Rose Pink", "#fb7185"], ["Burnt Orange", "#ea580c"], ["Rust", "#9a3412"], ["Olive", "#a3a300"], ["Slate Aqua", "#0ea5e9"], ["Hot Red", "#ef4444"], ["Ochre", "#b45309"], ["Plum", "#9d174d"], ["Periwinkle", "#818cf8"]];
  A.EINZEL = ['Royal Indigo', 'Cobalt', 'Slate Aqua', 'Sky Teal', 'Forest Green', 'Moss', 'Amber Glow', 'Burnt Orange', 'Hot Red', 'Hot Pink', 'Violet Spark', 'Plum'].map(function (n) { return A.POOL.find(function (p) { return p[0] === n; }); }).filter(Boolean);

  function rgb(hex) { return [1, 3, 5].map(function (i) { return parseInt(hex.slice(i, i + 2), 16); }); }
  function hex(c) { return '#' + c.map(function (v) { return ('0' + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2); }).join(''); }
  function mische(a, b, anteilB) { var x = rgb(a), y = rgb(b); return hex(x.map(function (v, i) { return v * (1 - anteilB) + y[i] * anteilB; })); }
  function leuchte(h) { var c = rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  A.kontrast = function (a, b) { var x = leuchte(a), y = leuchte(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  /** Aus einer Farbe die Fassungen für Hell und Dunkel ableiten: lesbar auf Weiß (mind. 3:1) und auf dem dunklen Grund (mind. 4,5:1). */
  A.fassungen = function (farbe) {
    var hell = farbe, dunkel = farbe, n = 0;
    while (A.kontrast(hell, '#ffffff') < 3 && n++ < 12) hell = mische(hell, '#000000', 0.08);
    n = 0; while (A.kontrast(dunkel, '#15141f') < 4.5 && n++ < 12) dunkel = mische(dunkel, '#ffffff', 0.1);
    return { hell: hell, dunkel: dunkel, tinte: A.kontrast(hell, '#ffffff') >= A.kontrast(hell, '#120f22') ? '#ffffff' : '#120f22' };
  };

  /** Sechs gut verteilte Farben: nach Farbton sortiert und versetzt gezogen, damit Nachbarn sich deutlich unterscheiden. */
  A.wuerfle = function (zufall) {
    zufall = zufall || Math.random;
    var ton = function (h) { var c = rgb(h), mx = Math.max.apply(null, c), mn = Math.min.apply(null, c), d = mx - mn; if (!d) return 0; var t = mx === c[0] ? ((c[1] - c[2]) / d) % 6 : mx === c[1] ? (c[2] - c[0]) / d + 2 : (c[0] - c[1]) / d + 4; return (t * 60 + 360) % 360; };
    var sort = A.POOL.slice().sort(function (a, b) { return ton(a[1]) - ton(b[1]); }), n = sort.length, start = Math.floor(zufall() * n), wahl = [];
    for (var i = 0; i < 6; i++) wahl.push(sort[(start + Math.round(i * n / 6) + Math.floor(zufall() * 2)) % n]);
    // Reihenfolge mischen, aber nie zwei ähnliche Töne nebeneinander: abwechselnd aus beiden Hälften
    return [0, 3, 1, 4, 2, 5].map(function (k) { return wahl[k][1]; }).filter(function (f, k, l) { return l.indexOf(f) === k; });
  };

  A.STANDARD = { modus: 'standard' };
  A.lade = function () { try { var s = JSON.parse(localStorage.getItem(SCHLUESSEL) || 'null'); if (s && (s.modus === 'einzel' || s.modus === 'multi')) return s; } catch (e) { /* privat */ } return { modus: 'standard' }; };
  A.speichere = function (s) { try { if (s.modus === 'standard') localStorage.removeItem(SCHLUESSEL); else localStorage.setItem(SCHLUESSEL, JSON.stringify(s)); } catch (e) { /* privat */ } };

  /** Zustand auf ein Element anwenden – auf die ganze Seite oder nur auf die Vorschau. */
  A.wende = function (s, el) {
    el = el || document.documentElement;
    ['--akz-l', '--akz-d', '--akz-il'].concat([1, 2, 3, 4, 5, 6].reduce(function (l, i) { return l.concat(['--m' + i + 'l', '--m' + i + 'd', '--m' + i + 'i']); }, [])).forEach(function (v) { el.style.removeProperty(v); });
    if (!s || s.modus === 'standard') { el.removeAttribute('data-akzent'); if (el !== document.documentElement) el.setAttribute('data-akzent', 'standard'); return; }
    var farben = s.modus === 'multi' ? (s.farben || []).slice(0, 6) : [s.farbe];
    if (!farben.length || !farben[0]) { el.removeAttribute('data-akzent'); return; }
    var f0 = A.fassungen(farben[0]);
    el.style.setProperty('--akz-l', f0.hell); el.style.setProperty('--akz-d', f0.dunkel); el.style.setProperty('--akz-il', f0.tinte);
    if (s.modus === 'multi') for (var i = 0; i < 6; i++) { var f = A.fassungen(farben[i % farben.length]); el.style.setProperty('--m' + (i + 1) + 'l', f.hell); el.style.setProperty('--m' + (i + 1) + 'd', f.dunkel); el.style.setProperty('--m' + (i + 1) + 'i', f.tinte); }
    el.setAttribute('data-akzent', s.modus);
  };
  A.name = function (h) { var p = A.POOL.find(function (x) { return x[1] === h; }); return p ? p[0] : h; };
})(globalThis.AB = globalThis.AB || {});
