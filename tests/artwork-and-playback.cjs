const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'theme.js'), 'utf8');
new vm.Script(source);
const frames = new Map(), timers = new Map(), covers = [], animations = [];
let id = 0, loaded = true, full = true, reduced = false, homeReady = false;
const history = { location: { pathname: '/home' } }, viewport = { scrollTop: 0 };
const root = { getAttribute: () => full ? 'full' : 'reduced' };
const art = { style: { visibility: '' }, complete: true, naturalWidth: 256, animate() {}, currentSrc: 'https://example.test/art',
  addEventListener(type, callback) { this[type] = callback; }, removeEventListener(type, callback) { if (this[type] === callback) delete this[type]; },
  getBoundingClientRect: () => ({ left: 100, top: 300, width: 256, height: 256 }) };
const image = { ...art, style: { visibility: '' }, get complete() { return loaded; },
  addEventListener(type, callback) { this[type] = callback; }, removeEventListener(type, callback) { if (this[type] === callback) delete this[type]; },
  getBoundingClientRect: () => ({ left: 48, top: 140, width: 128, height: 128 }) };
const holder = { querySelector: () => image, getBoundingClientRect: image.getBoundingClientRect };
const homeHolder = { querySelector: () => art, getBoundingClientRect: art.getBoundingClientRect };
const card = { style: { visibility: '' }, querySelector: selector => selector === 'a[href]' ? { getAttribute: () => '/album/abc' } : selector.includes('imageHolder') ? homeHolder : art };
const homePage = { hasAttribute: () => homeReady, setAttribute() {} }, albumPage = { querySelector: () => holder, setAttribute() {} };
const document = { documentElement: root, body: { append: cover => covers.push(cover) }, querySelectorAll: () => [card],
  querySelector: selector => selector === '.Root__main-view' ? { getBoundingClientRect: () => ({ left: 0 }) }
    : selector === '.main-view-container__scroll-node' ? viewport : selector.includes('home-page') ? homePage : albumPage,
  createElement: () => ({ style: {}, setAttribute() {}, remove() { this.removed = true; }, animate(keyframes, options) {
    let resolve, reject; const animation = { keyframes, options, finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
      finish: () => resolve(), cancel: () => reject(new Error('cancelled')) };
    animations.push(animation); return animation;
  } }) };
const context = vm.createContext({ document, window: { Spicetify: { Platform: { History: history } }, matchMedia: () => ({ matches: reduced }) },
  DOMMatrixReadOnly: class { constructor() { Object.assign(this, { a: 1, d: 1, m41: 0, m42: -4 }); } },
  getComputedStyle: node => node === holder ? { borderTopLeftRadius: '12px' } : { borderTopLeftRadius: '14px', transform: 'matrix(1, 0, 0, 1, 0, -4)', clipPath: 'inset(0 round 14px)' },
  requestAnimationFrame: callback => { frames.set(++id, callback); return id; }, cancelAnimationFrame: id => frames.delete(id),
  setTimeout: callback => { timers.set(++id, callback); return id; }, clearTimeout: id => timers.delete(id) });
const uriCode = source.slice(source.indexOf('  const uriFromHref'), source.indexOf('  function colorFor'));
const motionCode = source.slice(source.indexOf('  function cancelArtworkFlight'), source.indexOf('  function loadPreview'));
vm.runInContext(`const selector='home-card'; let artworkFlight=null,artworkFrame=0,savedHomeScroll=37;\n${uriCode}\n${motionCode}\nthis.motion={beginArtworkFlight,settleArtworkFlight,cancelArtworkFlight};`, context);
const motion = context.motion, draw = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); };
async function run() {
  motion.beginArtworkFlight(card, 'spotify:album:abc');
  assert.equal(art.style.visibility, 'hidden'); assert.equal(card.style.visibility, '', 'The clickable card must stay visible.');
  motion.settleArtworkFlight(); draw(); assert.equal(animations.length, 1, 'Native navigation must not be awaited or replayed.');
  history.location.pathname = '/album/abc'; motion.settleArtworkFlight(); draw();
  const travel = animations.at(-1);
  assert.equal(travel.options.duration, 480); assert.equal(travel.keyframes[0].transform, 'matrix(1, 0, 0, 1, 0, -4)');
  assert.equal(travel.keyframes.at(-1).transform, 'translate3d(-52px, -160px, 0) scale(0.5, 0.5)');
  assert.equal(travel.keyframes.at(-1).clipPath, 'inset(0 round 24px / 24px)', 'Scaled corners must finish at the native 12px radius.');
  for (const frame of travel.keyframes.slice(1)) {
    const values = frame.transform.match(/translate3d\(([^)]+)\) scale\(([^)]+)\)/);
    const [sx, sy] = values[2].split(',').map(Number);
    assert.ok(sx > 0 && sy > 0); assert.ok(frame.opacity >= 0.975 - 1e-9 && frame.opacity <= 1);
  }
  travel.finish(); await Promise.resolve(); assert.equal(image.style.visibility, '');
  animations.at(-1).finish(); await Promise.resolve();
  assert.ok(covers.at(-1).removed); assert.equal(art.style.visibility, ''); assert.equal(timers.size, 0);
  loaded = false; motion.beginArtworkFlight(card, 'spotify:album:abc'); motion.settleArtworkFlight(); draw();
  animations.at(-1).finish(); await Promise.resolve(); assert.equal(image.style.visibility, 'hidden');
  loaded = true; image.load(); animations.at(-1).finish(); await Promise.resolve();
  assert.ok(covers.at(-1).removed); assert.equal(image.load, undefined, 'Handoff listeners must be removed.');
  motion.beginArtworkFlight(card, 'spotify:album:abc'); const cancelled = covers.at(-1);
  motion.beginArtworkFlight(card, 'spotify:playlist:def'); await Promise.resolve(); assert.ok(cancelled.removed);
  const newest = covers.at(-1); assert.ok(!newest.removed, 'Old promise callbacks must not cancel a new flight.');
  [...timers.values()].forEach(callback => callback()); assert.ok(newest.removed); assert.equal(timers.size, 0);
  motion.beginArtworkFlight(holder, 'spotify:album:abc', true); history.location.pathname = '/home';
  motion.settleArtworkFlight(); draw(); assert.equal(art.style.visibility, '', 'Back must await the restored grid.');
  homeReady = true; motion.settleArtworkFlight(); draw(); assert.equal(viewport.scrollTop, 37);
  assert.equal(art.style.visibility, 'hidden'); motion.cancelArtworkFlight(); assert.equal(art.style.visibility, '');
  full = false; reduced = true; const count = covers.length; motion.beginArtworkFlight(card, 'spotify:album:abc'); assert.equal(covers.length, count);
  full = true; motion.beginArtworkFlight(card, 'spotify:album:abc'); assert.equal(covers.length, count + 1); motion.cancelArtworkFlight();

  const attrs = new Map(), trackMotions = new WeakMap(); let playing = false, linked = null;
  const classSet = () => { const values = new Set(); return { contains: value => values.has(value), toggle: (value, on) => on ? values.add(value) : values.delete(value) }; };
  const track = id => ({ classList: classSet(), target: { runs: [], animate(keyframes, options) {
    const animation = { keyframes, options, playState: 'running', cancel() { this.cancelled = true; } }; this.runs.push(animation); return animation;
  } }, trackLink: true, albumHref: '/album/record', artistHref: '/artist/artist',
    querySelector(selector) {
      if (selector.includes('/track/')) return this.trackLink ? { getAttribute: () => '/track/' + id } : null;
      if (selector.includes('/album/')) return { getAttribute: () => this.albumHref };
      if (selector.includes('rowMainContentTitle')) return { textContent: 'Track ' + id };
      return selector.includes('rowSectionStart') ? this.target : null;
    }, querySelectorAll() { return [{ getAttribute: () => this.artistHref }]; } });
  const a = track('aaa'), b = track('bbb'); const player = { data: { item: { uri: 'spotify:track:aaa', metadata: {} } }, isPlaying: () => playing };
  const playbackRoot = { getAttribute: key => key === 'data-calma-motion' ? (full ? 'full' : 'reduced') : attrs.get(key), setAttribute: (key, value) => attrs.set(key, value) };
  const playbackContext = vm.createContext({ document: { documentElement: playbackRoot, querySelector: () => null, querySelectorAll: () => [a, b] }, window: { Spicetify: { Player: player }, matchMedia: () => ({ matches: reduced }) }, trackMotions,
    getComputedStyle: node => node === playbackRoot ? { getPropertyValue: () => 'ease-out' } : { opacity: '0.9', transform: 'matrix(1,0,0,1,1,0)' } });
  const playbackCode = source.slice(source.indexOf('  function syncPlaybackDetails'), source.indexOf('  function markReady'));
  vm.runInContext(`let playbackFeedbackKey=null;\n${uriCode}\n${playbackCode}\nthis.sync=syncPlaybackDetails;`, playbackContext);
  playbackContext.sync(); assert.equal(attrs.get('data-calma-playback'), 'paused'); assert.ok(a.classList.contains('calma-current-track'));
  playing = true; playbackContext.sync(true); assert.equal(a.target.runs.length, 1);
  playbackContext.sync(true); assert.equal(a.target.runs.length, 1, 'Duplicate player events must not replay feedback.');
  player.data.item.uri = 'spotify:track:bbb'; playbackContext.sync(true);
  assert.ok(!a.classList.contains('calma-current-track')); assert.ok(b.classList.contains('calma-current-track')); assert.equal(b.target.runs.length, 1);
  playing = false; playbackContext.sync(true); assert.equal(b.target.runs.length, 1);
  playing = true; full = false; playbackContext.sync(true); assert.equal(b.target.runs.length, 2);
  assert.equal(b.target.runs.at(-1).keyframes[0].transform, 'none', 'Reduced motion must retain only the fade.');
  assert.ok(b.target.runs[0].cancelled, 'Rapid playback changes must replace the previous feedback.');
  b.trackLink = false; player.data.item.metadata = { title: 'Track bbb', artist_uri: 'spotify:artist:artist', album_uri: 'spotify:album:record' };
  playbackContext.sync(); assert.ok(b.classList.contains('calma-current-track'), 'Rows without track links must match title, artist URI and album URI.');
  b.albumHref = '/album/other'; playbackContext.sync(); assert.ok(!b.classList.contains('calma-current-track'), 'A different recording of the same title must not be marked.');
  b.albumHref = '/album/record'; b.artistHref = '/artist/other'; playbackContext.sync(); assert.ok(!b.classList.contains('calma-current-track'), 'Title alone must not identify a track.');
  console.log('PASS: rounded cover flight, loading handoff, reverse framing, rapid cancellation, watchdog, current-row feedback, event deduplication and reduced motion.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
