const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'theme.js'), 'utf8');
const listeners = new Map(), starts = [], history = { location: { pathname: '/album/abc' } };
const header = {}, root = { setAttribute() {}, removeAttribute() {} };
const context = vm.createContext({
  document: { documentElement: root, querySelector: () => header, addEventListener: (type, callback) => listeners.set(type, callback) },
  window: { Spicetify: { Platform: { History: history } } },
  beginArtworkFlight(target, uri, returning) { starts.push({ target, uri, returning }); context.setFlight({ uri, returning }); },
  cancelArtworkFlight() { context.setFlight(null); }, cancelCollectionEntrance() {}, syncSearchLayout() {}, stop() {}, releasePalette() {},
  clearTimeout() {}, scheduleScan() {},
  api: { Platform: { History: history } }
});
const uriCode = source.slice(source.indexOf('  const uriFromHref'), source.indexOf('  function colorFor'));
const helperStart = source.indexOf('  function prepareReturnArtwork');
const helperCode = helperStart < 0 ? '' : source.slice(helperStart, source.indexOf('  function settleArtworkFlight', helperStart));
const pointerStart = source.indexOf("  document.addEventListener('pointerdown'");
const pointerCode = source.slice(pointerStart, source.indexOf('  const middleClick', pointerStart));
vm.runInContext(`let artworkFlight=null,pendingHomeNavigation=false,lyricsRequest=0,lyricsTimer=null;\n${uriCode}\n${helperCode}\n${pointerCode}\nthis.setFlight=value=>artworkFlight=value;`, context);
listeners.get('pointerdown')({ button: 3 });
assert.equal(starts.length, 1, 'The mouse Back button must capture the outgoing cover before native navigation.');
assert.equal(starts[0].uri, 'spotify:album:abc'); assert.equal(starts[0].returning, true);
context.setFlight(null); listeners.get('pointerdown')({ button: 0 });
assert.equal(starts.length, 1, 'Ordinary presses must only cancel a running flight.');
let onHistory;
history.listen = callback => { onHistory = callback; };
const historyStart = source.indexOf('      let previousPath =');
assert.ok(historyStart >= 0, 'Native history navigation needs a shared return fallback.');
const historyCode = source.slice(historyStart, source.indexOf("      api.Player.addEventListener('songchange'", historyStart));
vm.runInContext(historyCode, context);
history.location.pathname = '/home'; onHistory();
assert.equal(starts.length, 2, 'A native history POP without a DOM click must also restore the cover.');
onHistory(); assert.equal(starts.length, 2, 'An already prepared return must not restart.');
history.location.pathname = '/playlist/def'; onHistory();
assert.equal(starts.length, 2, 'A return outside Home must cancel rather than fly to an unrelated card.');
console.log('PASS: hardware Back capture, ordinary pointer presses, native history fallback, no double return and unrelated-route cancellation.');
