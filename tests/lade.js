// Lädt die Kernmodule in fester Reihenfolge (wie im Bündel) und gibt den Namensraum zurück.
const path = require('path');
const KERN = ['util', 'csv', 'xlsx', 'abrechnung:statement', 'provision', 'model', 'abgleich', 'kennzahlen', 'team', 'vdienst', 'xlsxout', 'tarifdaten', 'tarif', 'leben', 'krypto', 'altbuch', 'bonus', 'lizenz', 'aktionen', 'import'];
globalThis.AB = globalThis.AB || {};
for (const k of KERN) require(path.join(__dirname, '..', 'src', 'core', (k.split(':')[1] || k) + '.js'));
module.exports = globalThis.AB;
