const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'theme.js'), 'utf8');
let saved = null, cancelled = 0;
const attrs = new Map(), media = { matches: false };
const defaults = { motion: 'system', previews: false, showViewControls: false, pinnedPlaylist: null };
const context = vm.createContext({ URL,
  window: { localStorage: { getItem: () => saved }, navigator: { platform: 'Win32' } },
  document: { documentElement: { setAttribute: (key, value) => attrs.set(key, value) } },
  cancelArtworkFlight: () => cancelled++ });
const code = source.slice(source.indexOf('  function validatePinnedPlaylist'), source.indexOf('  function savePreferences'));
context.media = media;
vm.runInContext(`const preferenceKey='calma:preferences:v1',defaultPreferences=${JSON.stringify(defaults)},reducedMotionQuery=media;let preferences={},collectionEntrance=null;
${code}
this.prefs={readPreferences,validatePinnedPlaylist,applyPreferences,set:value=>preferences=value};`, context);
const api = context.prefs, plain = value => JSON.parse(JSON.stringify(value));
assert.deepEqual(plain(api.readPreferences()), defaults);
saved = '{broken'; assert.deepEqual(plain(api.readPreferences()), defaults);
saved = 'null'; assert.deepEqual(plain(api.readPreferences()), defaults);
saved = JSON.stringify({ motion: 'fast', previews: 'true', showViewControls: 1, token: 'ignored' });
assert.deepEqual(plain(api.readPreferences()), defaults, 'Only validated preferences may be loaded.');
const pin = { uri: 'spotify:playlist:' + 'a'.repeat(22), name: '  A playlist 🎵  ', image: 'https://i.scdn.co/image/example' };
saved = JSON.stringify({ motion: 'full', previews: true, showViewControls: true, pinnedPlaylist: pin });
const loaded = api.readPreferences(); assert.equal(loaded.pinnedPlaylist.name, 'A playlist 🎵'); assert.equal(loaded.pinnedPlaylist.href, '/playlist/' + 'a'.repeat(22));
for (const image of ['http://i.scdn.co/image/x', 'https://i.scdn.co.evil.example/x', 'javascript:alert(1)', 'https://user:pass@i.scdn.co/image/x']) {
  assert.equal(api.validatePinnedPlaylist({ ...pin, image }), null, 'Pinned artwork must use a public Spotify HTTPS image.');
}
assert.equal(api.validatePinnedPlaylist({ ...pin, uri: 'spotify:playlist:37i9dQZ' + 'a'.repeat(15) }), null);
api.set({ ...defaults, motion: 'system' }); api.applyPreferences(); assert.equal(attrs.get('data-calma-motion'), 'full');
media.matches = true; api.applyPreferences(); assert.equal(attrs.get('data-calma-motion'), 'reduced'); assert.equal(cancelled, 1);
api.set({ ...defaults, motion: 'full', showViewControls: true }); api.applyPreferences(); assert.equal(attrs.get('data-calma-motion'), 'full');
assert.equal(attrs.get('data-calma-view-controls'), 'true'); assert.equal(attrs.get('data-calma-platform'), 'win');
media.matches = false; api.set({ ...defaults, motion: 'reduced' }); api.applyPreferences(); assert.equal(attrs.get('data-calma-motion'), 'reduced');
context.window.localStorage.getItem = () => { throw Error('Storage unavailable'); };
assert.deepEqual(plain(api.readPreferences()), defaults, 'Unavailable storage must not prevent Spotify from loading.');
const lyricsCode = source.slice(source.indexOf('  function lyricsAvailable'), source.indexOf('  const middleClick'));
context.window.Spicetify = { Config: { custom_apps: [] } }; context.document.querySelector = () => null;
vm.runInContext(`${lyricsCode}\nthis.hasLyrics=lyricsAvailable;`, context);
assert.equal(context.hasLyrics(), false); context.window.Spicetify.Config.custom_apps = ['ivLyrics']; assert.equal(context.hasLyrics(), true);
context.window.Spicetify.Config.custom_apps = 'marketplace|ivLyrics'; assert.equal(context.hasLyrics(), true);
let onKey, modalOpen = true, hidden = 0, focused = 0;
context.document.addEventListener = (_, callback) => { onKey = callback; };
context.document.querySelector = selector => selector === '.calma-settings' ? (modalOpen ? {} : null) : { focus() { focused++; } };
context.window.Spicetify.PopupModal = { hide() { hidden++; modalOpen = false; } }; context.stop = () => {}; context.clearTimeout = () => {};
const keyStart = source.indexOf("  document.addEventListener('keydown', event => {");
const keyCode = source.slice(keyStart, source.indexOf("  document.addEventListener('visibilitychange'", keyStart));
vm.runInContext(`let lyricsRequest=0,lyricsTimer=null;\n${keyCode}`, context);
onKey({ key: 'Escape' }); assert.equal(hidden, 1); assert.equal(focused, 1, 'Closing settings must return focus to its library trigger.');
onKey({ key: 'Escape' }); assert.equal(hidden, 1, 'Escape must not close an unrelated native modal.');
const cards = Array.from({ length: 9 }, (_, index) => ({ classList: { contains: () => false }, querySelector: () => ({ getAttribute: () => '/album/example' + index }) }));
const homeContext = vm.createContext({ document: { querySelectorAll: () => cards, querySelector: () => ({ querySelectorAll: () => [] }) },
  addHomeRecommendation: () => { throw Error('A complete native gallery must not add cards.'); } });
const uriCode = source.slice(source.indexOf('  const uriFromHref'), source.indexOf('  function colorFor'));
const homeCode = source.slice(source.indexOf('  function fillHomeGaps'), source.indexOf('  function scan()'));
vm.runInContext(`const selector='home-card',homeLimit=9,pinnedPlaylist=null;\n${uriCode}\n${homeCode}\nfillHomeGaps();`, homeContext);
console.log('PASS: clean defaults, private local preferences, corrupt/unavailable storage, safe pins, motion overrides and optional lyrics integration.');
