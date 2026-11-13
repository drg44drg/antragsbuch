/* Antragsbuch – Web Worker: liest und vergleicht Dateien, ohne die Oberfläche zu blockieren. */
self.onmessage = function (e) {
  var m = e.data;
  AB.importer.lies(new Uint8Array(m.bytes), m.name, m.opt).then(function (erg) {
    self.postMessage({ id: m.id, ok: true, ergebnis: erg });
  }).catch(function (err) {
    self.postMessage({ id: m.id, ok: false, fehler: String(err && err.message || err) });
  });
};
