const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'theme.js'), 'utf8');
new vm.Script(source);
const listeners = new Map();
const card = (href, order) => ({ style: { order }, classList: { contains: () => true }, contains: () => false,
  querySelector: () => ({ getAttribute: () => href }) });
const homeCard = card('/album/abc', '2'), pin = card('/playlist/pin', '0'), second = card('/album/xyz', '1');
const document = { querySelectorAll: () => [homeCard, pin, second], querySelector: () => ({ scrollTop: 37 }), addEventListener: (type, callback) => { if (!listeners.has(type)) listeners.set(type, callback); } };
const context = vm.createContext({ document, window: { Spicetify: { Player: { isPlaying: () => true } } },
  animateHomePress() { context.presses++; }, stop() {}, releasePalette() {}, hoverPalette() {}, markReady() {}, start() {},
  beginArtworkFlight() { context.flights++; }, cancelArtworkFlight() {}, flights: 0,
  performance: { now: () => 0 }, setTimeout() {}, presses: 0, requests: 0,
  loadPreview: () => { context.requests++; return Promise.resolve(null); } });
const uriCode = source.slice(source.indexOf('  const uriFromHref'), source.indexOf('  function colorFor'));
const clickCode = source.slice(source.indexOf("  document.addEventListener('click'"), source.indexOf('  const middleClick'));
const hoverCode = source.slice(source.indexOf("  document.addEventListener('pointerover'"), source.indexOf("  document.addEventListener('pointerout'"));
vm.runInContext(`const selector='home-card', collectionLinks='collection-links'; const preferences={previews:true}; let savedHomeOrder=[],savedHomeScroll=0,card=null,audio=null,generation=0,dwell=null,pendingHomeNavigation=false;
${uriCode}\n${clickCode}\n${hoverCode}
this.homeOrder=()=>savedHomeOrder;`, context);
const click = { button: 0, detail: 1, target: { closest: selector => selector === 'home-card' ? homeCard : selector === 'collection-links' ? homeCard.querySelector() : null },
  preventDefault() { throw Error('Native navigation must not be cancelled.'); }, stopImmediatePropagation() { throw Error('The trusted click must reach Spotify.'); } };
listeners.get('click')(click);
assert.equal(context.presses, 1, 'A native click must retain immediate press feedback.');
assert.equal(context.flights, 1, 'The cover must start without intercepting the native click.');
assert.deepEqual([...context.homeOrder()], ['spotify:playlist:pin', 'spotify:album:xyz', 'spotify:album:abc']);
click.ctrlKey = true; listeners.get('click')(click);
assert.equal(context.presses, 1, 'Modified clicks must keep their native behavior.');
const hover = { target: { closest: () => homeCard }, relatedTarget: null };
listeners.get('pointerover')(hover);
assert.equal(context.requests, 0, 'Real music must not request a preview.');
context.window.Spicetify.Player.isPlaying = () => false; listeners.get('pointerover')(hover);
assert.equal(context.requests, 1, 'Preview lookup must start on hover before the dwell delay.');
vm.runInContext('preferences.previews=false;', context); listeners.get('pointerover')(hover);
assert.equal(context.requests, 1, 'Audio previews must stay opt-in even when Spotify is paused.');
assert.ok(!source.slice(source.indexOf('  function scan()'), source.indexOf('  const scheduleScan')).includes('loadPreview('));
assert.ok(!source.split('/* CALMA_TEMP_PERF_BEGIN */')[0].includes('startViewTransition('));
assert.ok(!source.includes('beginSceneTransition'), 'Artwork travel must not capture full-window scenes.');
console.log('PASS: trusted clicks, native modifier behavior, saved home order, demand previews and playback exclusion.');
