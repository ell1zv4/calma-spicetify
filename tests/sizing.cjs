const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'theme.js'), 'utf8');
new vm.Script(source);
const frames = new Map(), timers = new Map(), timerDelays = new Map();
let nextId = 0;
const scheduling = {
  requestAnimationFrame: callback => { frames.set(++nextId, callback); return nextId; },
  cancelAnimationFrame: id => frames.delete(id),
  setTimeout: (callback, delay) => { timers.set(++nextId, callback); timerDelays.set(nextId, delay); return nextId; },
  clearTimeout: id => { timers.delete(id); timerDelays.delete(id); }
};
function draw() { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); }
let observe, onResize;
const values = new Map(), playlist = { offsetHeight: 800 }, observed = new Set(), writes = [];
const pane = { style: { setProperty: (key, value) => { values.set(key, value); writes.push([key, value]); } } };
const doc = {
  documentElement: { getAttribute() {}, setAttribute() {} }, addEventListener() {},
  querySelector: selector => selector === '[data-testid="playlist-page"]' ? playlist
    : selector === '.Root__main-view' ? pane : null
};
vm.runInNewContext(source.slice(0, source.indexOf('\n})();') + 6), {
  ...scheduling,
  MutationObserver: class { constructor(callback) { observe = callback; } observe() {} },
  ResizeObserver: class { constructor(callback) { onResize = callback; } observe(node) { observed.add(node); } unobserve(node) { observed.delete(node); } },
  window: { addEventListener() {} },
  document: doc
});
assert.ok(observed.has(playlist));
playlist.offsetHeight = 320;
onResize(); onResize();
assert.equal(frames.size, 1, 'Repeated mutations must share one layout update.');
draw();
assert.equal(values.get('--calma-playlist-height'), '320px', 'Panel size must update before the next paint.');
onResize(); draw();
assert.equal(writes.length, 2, 'Unchanged height must not invalidate styles.');
observe([{ target: { closest: () => true }, addedNodes: [{ nodeType: 1 }], removedNodes: [] }]);
assert.equal(frames.size, 0, 'Virtualized track-row mutations must not rescan the page.');
playlist.offsetHeight = 0; onResize(); draw();
assert.equal(values.get('--calma-playlist-height'), '320px', 'An empty loading state must preserve the viewport.');
doc.hidden = true; onResize();
assert.equal(frames.size, 0, 'Background windows must not schedule layout reads.');
timers.clear();
timerDelays.clear();

console.log('PASS: coalesced sizing, unchanged-height caching, row-mutation filtering, loading viewport and background suspension.');
