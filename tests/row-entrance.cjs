const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'theme.js'), 'utf8');
const frames = new Map(), runs = [], motions = new WeakMap(); let id = 0, full = true, ready = true;
const row = top => ({ getBoundingClientRect: () => ({ top, bottom: top + 40, height: 40 }),
  target: { animate(keyframes, options) { const animation = { keyframes, options, playState: 'running', cancel() { this.cancelled = true; this.playState = 'idle'; } }; runs.push(animation); return animation; } },
  querySelector() { return this.target; } });
const rows = [row(-100), row(100), row(200), row(400)], root = { getAttribute: () => full ? 'full' : 'reduced' };
const page = { querySelectorAll: () => ready ? rows : [] };
const document = { documentElement: root, querySelector: selector => selector === '.Root__main-view' ? { getBoundingClientRect: () => ({ top: 0, bottom: 300 }) } : page };
const context = vm.createContext({ document, trackMotions: motions,
  window: { Spicetify: { Platform: { History: { location: { pathname: '/album/abc' } } } }, matchMedia: () => ({ matches: true }) },
  getComputedStyle: () => ({ getPropertyValue: () => 'ease-out' }),
  requestAnimationFrame: callback => { frames.set(++id, callback); return id; }, cancelAnimationFrame: id => frames.delete(id) });
const uriCode = source.slice(source.indexOf('  const uriFromHref'), source.indexOf('  function colorFor'));
const entryCode = source.slice(source.indexOf('  function cancelCollectionEntrance'), source.indexOf('  function loadPreview'));
vm.runInContext(`let collectionEntrance=null,entranceFrame=0;\n${uriCode}\n${entryCode}\nthis.entry={scheduleCollectionEntrance,cancelCollectionEntrance};`, context);
const draw = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); }, entry = context.entry;
entry.scheduleCollectionEntrance(); entry.scheduleCollectionEntrance(); assert.equal(frames.size, 1); draw();
assert.equal(runs.length, 2, 'Only initially visible rows may animate.');
assert.equal(runs[0].options.delay, 0); assert.equal(runs[1].options.delay, 100);
assert.equal(runs[0].keyframes[0].transform, 'translate3d(0, 4px, 0)');
assert.equal(runs[0].options.fill, 'backwards', 'Animation must restore native hover styles after entry.');
entry.scheduleCollectionEntrance(); draw(); assert.equal(runs.length, 2, 'Scrolling or row recycling must not restart entry.');
entry.cancelCollectionEntrance(); assert.ok(runs.every(animation => animation.cancelled));
ready = false; entry.scheduleCollectionEntrance(); draw(); assert.equal(runs.length, 2);
ready = true; full = false; entry.scheduleCollectionEntrance(); draw();
assert.equal(runs.length, 4, 'Rows that arrive asynchronously must still get their initial entry.');
assert.equal(runs.at(-1).keyframes[0].transform, 'none'); assert.equal(runs.at(-1).options.delay, 0);
entry.cancelCollectionEntrance(); full = true;
motions.set(rows[1].target, { playState: 'running' }); entry.scheduleCollectionEntrance(); draw();
assert.equal(runs.length, 5, 'Playback feedback must take priority over decorative entry.');
entry.cancelCollectionEntrance(); document.hidden = true; entry.scheduleCollectionEntrance(); assert.equal(frames.size, 0);
document.hidden = false; context.window.Spicetify.Platform.History.location.pathname = '/';
entry.scheduleCollectionEntrance(); assert.equal(frames.size, 0, 'Home and playback clock updates must not schedule collection layout work.');
console.log('PASS: one initial stagger, visible rows only, deferred data, native hover restoration, navigation cleanup, playback priority and reduced motion.');
