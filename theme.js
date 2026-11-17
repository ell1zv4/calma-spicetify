(() => {
  if (document.documentElement.getAttribute('data-calma-layout-ready') === 'true') return;
  document.documentElement.setAttribute('data-calma-layout-ready', 'true');
  const libraryLabel = window.navigator?.language?.startsWith('es') ? 'Biblioteca' : 'Library';
  const settingsHint = window.navigator?.language?.startsWith('es') ? 'botón derecho: ajustes de Calma' : 'right-click: Calma settings';
  // shortcut: matches English/Spanish info-card headings; extend if Spotify renames them.
  const labels = new Set([
    "credits", "next in queue", "on tour", "merch", "about the artist",
    "créditos", "a continuación", "siguiente en la cola", "de gira", "productos", "sobre el artista"
  ]);
  const headings = 'h2, [role="heading"][aria-level="2"]';
  let libraryButton, mainView;
  const collectionSizes = new Map();
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => schedule()) : null;
  const syncCollectionSize = () => {
    const pane = document.querySelector('.Root__main-view');
    for (const kind of ['album', 'playlist']) {
      const node = document.querySelector(`[data-testid="${kind}-page"]`);
      let measured = collectionSizes.get(kind);
      if (node !== measured?.node) {
        if (measured?.node) resizeObserver?.unobserve(measured.node);
        measured = { node, height: 0 };
        collectionSizes.set(kind, measured);
        if (node) resizeObserver?.observe(node);
      }
      const height = node?.offsetHeight;
      if (height > 0 && (height !== measured.height || pane !== mainView)) {
        pane?.style.setProperty(`--calma-${kind}-height`, `${height}px`);
        measured.height = height;
      }
    }
    mainView = pane;
  };
  const clean = () => {
    syncCollectionSize();
    const bar = document.querySelector('[data-testid="now-playing-bar"]');
    if (bar) {
      if (!libraryButton) {
        libraryButton = document.querySelector('#calma-library-toggle') || document.createElement('button');
        libraryButton.id = 'calma-library-toggle';
        libraryButton.type = 'button';
        libraryButton.title = libraryLabel + ' · ' + settingsHint;
        libraryButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
        libraryButton.classList.add('calma-library-toggle');
        libraryButton.setAttribute('aria-label', libraryLabel);
        libraryButton.setAttribute('aria-description', settingsHint);
        libraryButton.setAttribute('aria-pressed', String(document.body.classList.contains('calma-library-open')));
        libraryButton.onclick = () => libraryButton.setAttribute('aria-pressed', String(document.body.classList.toggle('calma-library-open')));
        libraryButton.oncontextmenu = event => { event.preventDefault(); event.stopPropagation(); window.dispatchEvent(new Event('calma:settings')); };
      }
      if (libraryButton.parentElement !== bar) bar.append(libraryButton);
    }
    const sidebar = document.querySelector('.Root__right-sidebar');
    for (const heading of sidebar?.querySelectorAll(headings) || []) {
      const label = heading.textContent.trim().toLowerCase().replace(/\s+/g, " ");
      if (!labels.has(label) || heading.closest('[data-testid="home-page"]')) continue;
      const headingBox = heading.getBoundingClientRect();
      if (!headingBox.width || headingBox.left < window.innerWidth * 0.55) continue;
      for (let card = heading.parentElement; card; card = card.parentElement) {
        const box = card.getBoundingClientRect();
        if (box.left < window.innerWidth * 0.55) break;
        const maxHeight = label === "next in queue" || label.includes("cola") || label === "a continuación"
          ? Math.min(600, window.innerHeight * 0.8) : window.innerHeight * 0.8;
        if (box.width < 120 || box.height < 64 || box.height > maxHeight) continue;
        if (card.querySelectorAll(headings).length !== 1) continue;
        if (parseFloat(getComputedStyle(card).borderRadius) < 6) continue;
        if (!card.classList.contains("calma-secondary-info")) card.classList.add("calma-secondary-info");
        break;
      }
    }
  };
  let scheduled = false;
  const schedule = () => {
    if (scheduled || document.hidden) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; if (!document.hidden) clean(); });
  };
  clean();
  new MutationObserver(records => {
    if (records.some(record => (!resizeObserver || !record.target.closest?.('.main-trackList-trackList, .ivlyrics-panel-lyrics-container'))
        && [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1))) schedule();
  }).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("resize", schedule);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
})();

(() => {
  if (document.documentElement.getAttribute('data-calma-active') === 'true') return;
  document.documentElement.setAttribute('data-calma-active', 'true');
  const selector = '[data-testid="home-page"] .view-homeShortcutsGrid-shortcut';
  const homeLimit = 9;
  const preferenceKey = 'calma:preferences:v1';
  const defaultPreferences = { motion: 'system', previews: false, showViewControls: false, pinnedPlaylist: null };
  let preferences = readPreferences();
  let pinnedPlaylist = preferences.pinnedPlaylist;
  const paletteMixes = {
    main: [[14, 14, 14], 0.22], sidebar: [[15, 15, 15], 0.24],
    player: [[18, 18, 18], 0.26], card: [[24, 24, 24], 0.24],
    'main-elevated': [[24, 24, 24], 0.24], highlight: [[30, 30, 30], 0.27],
    'highlight-elevated': [[34, 34, 34], 0.27], 'tab-active': [[30, 30, 30], 0.27],
    notification: [[30, 30, 30], 0.27], button: [[245, 245, 245], 0.35],
    'button-active': [[252, 252, 252], 0.30], 'button-disabled': [[40, 40, 40], 0.20],
    subtext: [[201, 201, 201], 0.14], misc: [[245, 245, 245], 0.35]
  };
  const syncSearchLayout = () => document.documentElement.classList.toggle(
    'calma-search-page', window.Spicetify?.Platform?.History?.location?.pathname?.startsWith('/search') === true);
  const collectionLinks = 'a[href*="/album/"], a[href*="/playlist/"], a[href^="spotify:album:"], a[href^="spotify:playlist:"]';
  const previews = new Map(), colors = new Map(), fades = new WeakMap(), ambience = new WeakMap(), trackMotions = new WeakMap(), pressMotions = new WeakMap();
  let paintedColor = null, trackFrame = 0, pendingHomeNavigation = false, lyricsRequest = 0, lyricsTimer = null;
  let savedHomeOrder = [];
  let artworkFlight = null, artworkFrame = 0, savedHomeScroll = 0, playbackFeedbackKey = null;
  let collectionEntrance = null, entranceFrame = 0;
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  applyPreferences();
  reducedMotionQuery.addEventListener?.('change', () => { if (preferences.motion === 'system') applyPreferences(); });
  function validatePinnedPlaylist(pin) {
    if (!pin || !/^spotify:playlist:[A-Za-z0-9]{22}$/.test(pin.uri || '') || pin.uri.startsWith('spotify:playlist:37i9dQZ')
        || typeof pin.name !== 'string' || !pin.name.trim() || typeof pin.image !== 'string') return null;
    try {
      const url = new URL(pin.image);
      if (url.protocol !== 'https:' || url.username || url.password || !(url.hostname.endsWith('.scdn.co') || url.hostname.endsWith('.spotifycdn.com'))) return null;
      return { uri: pin.uri, href: '/playlist/' + pin.uri.split(':').pop(), name: Array.from(pin.name.trim()).slice(0, 120).join(''), image: url.href };
    } catch (_) { return null; }
  }
  function readPreferences() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(preferenceKey) || '{}');
      return {
        motion: ['system', 'full', 'reduced'].includes(saved?.motion) ? saved.motion : defaultPreferences.motion,
        previews: typeof saved?.previews === 'boolean' ? saved.previews : defaultPreferences.previews,
        showViewControls: typeof saved?.showViewControls === 'boolean' ? saved.showViewControls : defaultPreferences.showViewControls,
        pinnedPlaylist: validatePinnedPlaylist(saved?.pinnedPlaylist)
      };
    } catch (_) { return { ...defaultPreferences }; }
  }
  function applyPreferences() {
    const root = document.documentElement;
    const reduced = preferences.motion === 'reduced' || (preferences.motion === 'system' && reducedMotionQuery.matches);
    root.setAttribute('data-calma-motion', reduced ? 'reduced' : 'full');
    root.setAttribute('data-calma-view-controls', String(preferences.showViewControls));
    const platform = window.navigator?.userAgentData?.platform || window.navigator?.platform || '';
    root.setAttribute('data-calma-platform', /win/i.test(platform) ? 'win' : /mac/i.test(platform) ? 'mac' : 'other');
    root.setAttribute('data-calma-version', '1.0.0');
    if (reduced) {
      cancelArtworkFlight();
      for (const animation of collectionEntrance?.animations || []) animation.cancel();
    }
  }
  function savePreferences(patch) {
    const oldPin = pinnedPlaylist?.uri;
    Object.assign(preferences, patch);
    pinnedPlaylist = preferences.pinnedPlaylist;
    try { window.localStorage.setItem(preferenceKey, JSON.stringify(preferences)); }
    catch (_) { window.Spicetify?.showNotification?.('Calma: preferences could not be saved. Free some local storage and try again.', true); }
    if (!preferences.previews) stop(true);
    applyPreferences();
    if (oldPin !== pinnedPlaylist?.uri) {
      document.querySelectorAll('[data-testid="home-page"] .calma-recommended').forEach(node => node.remove());
      savedHomeOrder = [];
      scheduleScan();
    }
  }
  function showPreferences() {
    if (typeof window.Spicetify?.PopupModal?.display !== 'function') return;
    const es = window.navigator?.language?.startsWith('es');
    const text = es ? {
      motion: 'Movimiento', system: 'Según el dispositivo', full: 'Completo', reduced: 'Reducido',
      motionHint: 'Elige cuánto movimiento quieres ver.', previews: 'Vistas previas de audio', previewHint: 'Solo se reproducen mientras la música está en pausa.',
      controls: 'Controles de vista y orden', controlsHint: 'Muestra el selector de vista de playlists y álbumes.',
      pin: 'Fijar esta playlist en Inicio', unpin: 'Quitar playlist fijada', noPin: 'Abre una playlist para fijarla en Inicio.',
      reset: 'Restablecer ajustes', source: 'Código y ayuda'
    } : {
      motion: 'Motion', system: 'Follow device', full: 'Full', reduced: 'Reduced',
      motionHint: 'Choose how much movement you want.', previews: 'Audio previews', previewHint: 'Only play while your music is paused.',
      controls: 'Sort and view controls', controlsHint: 'Show the native playlist and album view selector.',
      pin: 'Pin this playlist to Home', unpin: 'Unpin playlist', noPin: 'Open a playlist to pin it to Home.',
      reset: 'Reset preferences', source: 'Source and help'
    };
    const form = document.createElement('div'); form.className = 'calma-settings';
    const field = (key, label, hint, input) => {
      const row = document.createElement('label'), copy = document.createElement('span'), name = document.createElement('span'), description = document.createElement('small');
      input.id = 'calma-setting-' + key; description.id = input.id + '-hint'; row.htmlFor = input.id;
      row.className = 'calma-setting'; name.textContent = label; description.textContent = hint;
      input.setAttribute('aria-describedby', description.id); copy.append(name, description); row.append(copy, input); form.append(row);
    };
    const motion = document.createElement('select');
    for (const [value, label] of [['system', text.system], ['full', text.full], ['reduced', text.reduced]]) {
      const option = document.createElement('option'); option.value = value; option.textContent = label; motion.append(option);
    }
    motion.value = preferences.motion; motion.onchange = () => savePreferences({ motion: motion.value });
    field('motion', text.motion, text.motionHint, motion);
    const previews = document.createElement('input'); previews.type = 'checkbox'; previews.checked = preferences.previews;
    previews.onchange = () => savePreferences({ previews: previews.checked }); field('previews', text.previews, text.previewHint, previews);
    const controls = document.createElement('input'); controls.type = 'checkbox'; controls.checked = preferences.showViewControls;
    controls.onchange = () => savePreferences({ showViewControls: controls.checked }); field('controls', text.controls, text.controlsHint, controls);
    const currentURI = uriFromHref(window.Spicetify?.Platform?.History?.location?.pathname);
    const page = document.querySelector('[data-testid="playlist-page"]');
    const currentPin = currentURI?.startsWith('spotify:playlist:') && page ? validatePinnedPlaylist({
      uri: currentURI, name: page.querySelector('.main-entityHeader-title h1')?.textContent || '',
      image: page.querySelector('.main-entityHeader-imageContainer img')?.currentSrc || page.querySelector('.main-entityHeader-imageContainer img')?.src || ''
    }) : null;
    const pinRow = document.createElement('div'), pinInfo = document.createElement('small'), pinButton = document.createElement('button');
    pinRow.className = 'calma-setting'; pinButton.type = 'button';
    const refreshPin = () => {
      pinInfo.textContent = pinnedPlaylist?.name || currentPin?.name || text.noPin;
      pinButton.textContent = pinnedPlaylist ? text.unpin : text.pin; pinButton.disabled = !pinnedPlaylist && !currentPin;
    };
    pinButton.onclick = () => { savePreferences({ pinnedPlaylist: pinnedPlaylist ? null : currentPin }); refreshPin(); };
    refreshPin(); pinRow.append(pinInfo, pinButton); form.append(pinRow);
    const footer = document.createElement('div'), reset = document.createElement('button'), link = document.createElement('a');
    footer.className = 'calma-settings-footer'; reset.type = 'button'; reset.textContent = text.reset;
    reset.onclick = () => { savePreferences({ ...defaultPreferences }); motion.value = preferences.motion; previews.checked = preferences.previews; controls.checked = preferences.showViewControls; refreshPin(); };
    link.textContent = text.source; link.href = 'https://github.com/ell1zv4/calma-spicetify'; link.target = '_blank'; link.rel = 'noopener noreferrer';
    footer.append(reset, link); form.append(footer);
    window.Spicetify.PopupModal.display({ title: 'Calma · 1.0.0', content: form });
  }
  // shortcut: fallback hashes match this Spotify build; use its live definitions after updates.
  const hashes = {
    trackPreview: 'fc26ffc7a1a4f93bd4c2d705649f7dba1de34005b3dc2915549847a9959405d8',
    getAlbumNameAndTracks: '8628ad33de3267d7bef516c76a746979a5f98891a2c9eaff3dfec828abdcd983'
  };
  const query = (name, variables) => window.Spicetify.GraphQL.Request(
    window.Spicetify.GraphQL.Definitions[name] || { name, operation: 'query', sha256Hash: hashes[name], value: null }, variables);
  const uriFromHref = href => {
    const match = (href || '').match(/(?:spotify:|\/)(album|playlist)(?::|\/)([A-Za-z0-9]+)/);
    // shortcut: Spotify mixes/charts currently use 37i9dQZ IDs; use owner metadata if that changes.
    if (!match || (match[1] === 'playlist' && match[2].startsWith('37i9dQZ'))) return null;
    return `spotify:${match[1]}:${match[2]}`;
  };
  const uriOf = target => uriFromHref(target.querySelector('a[href]')?.getAttribute('href'));
  function colorFor(uri, imageUrl) {
    if (!imageUrl) return Promise.resolve(null);
    const url = imageUrl.startsWith('spotify:image:') ? 'https://i.scdn.co/image/' + imageUrl.split(':').pop() : imageUrl;
    if (colors.has(url)) return colors.get(url);
    const pending = new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 32;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(image, 0, 0, 32, 32);
          const pixels = context.getImageData(0, 0, 32, 32).data, bins = new Map();
          for (let index = 0; index < pixels.length; index += 4) {
            if (pixels[index + 3] < 128) continue;
            const rgb = [pixels[index], pixels[index + 1], pixels[index + 2]];
            const max = Math.max(...rgb), min = Math.min(...rgb);
            const saturation = (max - min) / Math.max(1, max);
            const weight = (0.6 + saturation * 0.4) * (max < 18 || min > 248 ? 0.6 : 1);
            const key = rgb.map(channel => channel >> 5).join(',');
            const bin = bins.get(key) || { weight: 0, sum: [0, 0, 0] };
            bin.weight += weight;
            rgb.forEach((channel, part) => { bin.sum[part] += channel * weight; });
            bins.set(key, bin);
          }
          const ranked = [...bins.values()].sort((a, b) => b.weight - a.weight);
          const best = ranked[0];
          if (!best) { resolve(null); return; }
          const average = bin => bin.sum.map(channel => Math.round(channel / bin.weight));
          const primary = average(best);
          const secondary = ranked.filter(bin => bin.weight >= best.weight * 0.12).map(average)
            .find(rgb => rgb.reduce((sum, channel, index) => sum + (channel - primary[index]) ** 2, 0) > 80 ** 2) || primary;
          const hex = rgb => '#' + rgb.map(channel => channel.toString(16).padStart(2, '0')).join('');
          resolve({ primary: hex(primary), secondary: hex(secondary) });
        } catch (error) { reject(error); }
      };
      image.onerror = reject;
      image.src = url;
    }).catch(() => null);
    colors.set(url, pending);
    if (colors.size > 64) colors.delete(colors.keys().next().value);
    return pending;
  }
  function paintAmbience(rgb, echo, tones, hovering, frames, target = document.documentElement) {
    // Read every visible blend before retiming either running animation.
    target.style.setProperty('--calma-tint-duration', hovering ? '220ms' : '260ms');
    for (const { surface, previous, opacity } of frames) {
      const blend = (from, to) => from.map((value, index) => Math.round(value + (to[index] - value) * opacity));
      const base = tones[surface.classList.contains('Root__top-container') ? 'sidebar' : 'main'];
      const from = previous ? blend(previous.from, previous.to) : rgb;
      const echoFrom = previous ? blend(previous.echoFrom, previous.echoTo) : echo;
      const baseFrom = previous ? blend(previous.baseFrom, previous.baseTo) : base;
      const run = previous?.run === 'calma-wash-a' ? 'calma-wash-b' : 'calma-wash-a';
      surface.style.setProperty('--calma-wash-from', `rgb(${from.join(',')})`);
      surface.style.setProperty('--calma-wash-to', `rgb(${rgb.join(',')})`);
      surface.style.setProperty('--calma-echo-from', `rgb(${echoFrom.join(',')})`);
      surface.style.setProperty('--calma-echo-to', `rgb(${echo.join(',')})`);
      surface.style.setProperty('--calma-wash-base-from', `rgb(${baseFrom.join(',')})`);
      surface.style.setProperty('--calma-wash-base-to', `rgb(${base.join(',')})`);
      surface.style.setProperty('--calma-wash-run', run);
      ambience.set(surface, { from, to: rgb, echoFrom, echoTo: echo, baseFrom, baseTo: base, run });
    }
  }
  function paintPalette({ primary, secondary }, hovering = false, surface = null) {
    const root = surface || document.documentElement;
    root.setAttribute('data-calma-palette-mode', surface ? 'album' : hovering ? 'hover' : 'playing');
    const surfaces = surface ? [surface] : [...document.querySelectorAll('.Root__top-container, .Root__main-view')]
      .filter(node => !node.classList.contains('calma-album-view'));
    const key = primary + secondary;
    if (!surface && paintedColor === key && surfaces.every(node => ambience.has(node))) return;
    const frames = surfaces.map(surface => {
      const previous = ambience.get(surface);
      const opacity = previous ? Math.max(0, Math.min(1, parseFloat(getComputedStyle(surface, '::after')?.opacity) || 0)) : 1;
      return { surface, previous, opacity };
    });
    const rgb = [1, 3, 5].map(index => parseInt(primary.slice(index, index + 2), 16));
    const echo = [1, 3, 5].map(index => parseInt(secondary.slice(index, index + 2), 16));
    root.style.setProperty('--calma-album-tone', primary);
    const tones = {};
    for (const [name, [base, weight]] of Object.entries(paletteMixes)) {
      const mixed = base.map((channel, index) => Math.round(channel * (1 - weight) + rgb[index] * weight));
      tones[name] = mixed;
      root.style.setProperty('--spice-' + name, `rgb(${mixed.join(',')})`);
      root.style.setProperty('--spice-rgb-' + name, mixed.join(','));
    }
    paintAmbience(rgb, echo, tones, hovering, frames, root);
    if (!surface) paintedColor = key;
  }
  let albumSurface = null, albumPaletteKey = null;
  function resetAlbumPalette() {
    if (!albumSurface) return;
    if (albumSurface.classList.contains('calma-album-view')) {
      albumSurface.classList.remove('calma-album-view');
      albumSurface.removeAttribute('data-calma-palette-mode');
      for (const name of Object.keys(paletteMixes)) {
        albumSurface.style.removeProperty('--spice-' + name);
        albumSurface.style.removeProperty('--spice-rgb-' + name);
      }
      albumSurface.style.removeProperty('--calma-album-tone');
      albumSurface.style.removeProperty('--calma-tint-duration');
      paintedColor = null;
    }
    albumSurface = albumPaletteKey = null;
    document.documentElement.style.removeProperty('--calma-context-tone');
    if (playingColor && !hoverTarget) paintPalette(playingColor);
  }
  function syncAlbumPalette() {
    const uri = uriFromHref(window.Spicetify?.Platform?.History?.location?.pathname);
    const album = document.querySelector('[data-testid="album-page"], [data-testid="playlist-page"]');
    if (!uri || !album) { resetAlbumPalette(); return; }
    const surface = document.querySelector('.Root__main-view');
    const image = album.querySelector('.main-entityHeader-container img');
    const url = image?.currentSrc || image?.src;
    if (!surface || !url) return;
    const key = uri + '|' + url;
    if (albumPaletteKey === key && albumSurface === surface) return;
    if (albumSurface && albumSurface !== surface) resetAlbumPalette();
    albumSurface = surface;
    albumPaletteKey = key;
    colorFor(uri, url).then(palette => {
      if (albumPaletteKey !== key || albumSurface !== surface) return;
      if (!palette) { resetAlbumPalette(); return; }
      surface.classList.add('calma-album-view');
      document.documentElement.style.setProperty('--calma-context-tone', palette.primary);
      paintPalette(palette, false, surface);
    });
  }
  let paletteKey = null;
  let playingColor = null, hoverTarget = null, hoverUri = null, restoreTimer = null;
  function syncPalette() {
    const item = window.Spicetify?.Player?.data?.item;
    const uri = item?.album?.uri || item?.metadata?.album_uri || item?.uri;
    const image = item?.metadata?.image_xlarge_url || item?.metadata?.image_large_url || item?.metadata?.image_url
      || item?.album?.images?.[0]?.url || document.querySelector('.main-nowPlayingBar-container img')?.src;
    if (!uri || !image) return;
    const key = uri + '|' + image;
    if (key === paletteKey) return;
    paletteKey = key;
    colorFor(uri, image).then(color => {
      if (paletteKey !== key) return;
      if (!color) { paletteKey = null; return; }
      playingColor = color;
      if (!hoverTarget) paintPalette(color);
      document.documentElement.setAttribute('data-calma-album-uri', uri);
    });
  }
  function hoverPalette(target, uri) {
    clearTimeout(restoreTimer);
    if (hoverTarget === target && hoverUri === uri) return;
    hoverTarget = target;
    hoverUri = uri;
    const root = document.documentElement;
    root.setAttribute('data-calma-hover-album', uri);
    const image = target.querySelector('img')?.currentSrc || target.querySelector('img')?.src;
    colorFor(uri, image).then(color => {
      if (color && hoverTarget === target && hoverUri === uri && uriOf(target) === uri) paintPalette(color, true);
    });
  }
  function releasePalette(delay = 90) {
    hoverTarget = hoverUri = null;
    document.documentElement.removeAttribute('data-calma-hover-album');
    clearTimeout(restoreTimer);
    restoreTimer = setTimeout(() => {
      if (hoverTarget) return;
      paintPalette(playingColor || { primary: '#b8d8c4', secondary: '#b8d8c4' });
    }, delay);
  }
  function animateTrackChange() {
    cancelAnimationFrame(trackFrame);
    trackFrame = requestAnimationFrame(() => {
      trackFrame = 0;
      if (document.hidden) return;
      syncPlaybackDetails(true);
      const root = document.documentElement;
      const reduced = root.getAttribute('data-calma-motion') === 'reduced';
      const easing = getComputedStyle(root).getPropertyValue('--calma-motion-ease').trim() || 'ease-out';
      for (const target of document.querySelectorAll('[data-testid="now-playing-bar"] .main-nowPlayingBar-nowPlayingBar > :first-child')) {
        if (typeof target.animate !== 'function') continue;
        const previous = trackMotions.get(target);
        const visible = previous?.playState === 'running' ? getComputedStyle(target) : null;
        previous?.cancel();
        const from = { opacity: visible?.opacity || 0.78, transform: reduced ? 'none' : visible?.transform || 'translateY(3px)' };
        trackMotions.set(target, target.animate([from, { opacity: 1, transform: 'none' }], { duration: reduced ? 150 : 200, easing }));
      }
    });
  }
  function syncPlaybackDetails(feedback = false) {
    const api = window.Spicetify, item = api?.Player?.data?.item;
    const playing = api?.Player?.isPlaying?.() === true;
    const state = playing ? 'playing' : 'paused', root = document.documentElement;
    if (root.getAttribute('data-calma-playback') !== state) root.setAttribute('data-calma-playback', state);
    const key = (item?.uri || '') + '|' + state;
    const changed = playbackFeedbackKey !== null && playbackFeedbackKey !== key;
    const metadata = item?.metadata || {}, title = metadata.title || item?.name;
    const artistURI = metadata.artist_uri || item?.artists?.[0]?.uri, albumURI = metadata.album_uri || item?.album?.uri;
    const pageAlbum = document.querySelector('[data-testid="album-page"]') && uriFromHref(api?.Platform?.History?.location?.pathname);
    for (const row of document.querySelectorAll('.main-trackList-trackListRow')) {
      const href = row.querySelector('a[href*="/track/"], a[href^="spotify:track:"]')?.getAttribute('href');
      const id = href?.match(/(?:spotify:|\/)track(?::|\/)([A-Za-z0-9]+)/)?.[1];
      const albumLink = row.querySelector('a[href*="/album/"], a[href^="spotify:album:"]')?.getAttribute('href');
      const rowAlbum = uriFromHref(albumLink) || pageAlbum;
      // shortcut: rows without track links match title/artist/album; prefer native track IDs if Spotify exposes them.
      const sameRecording = title && artistURI && row.querySelector('.main-trackList-rowMainContentTitle')?.textContent.trim() === title
        && [...row.querySelectorAll('a[href*="/artist/"], a[href^="spotify:artist:"]')].some(link => link.getAttribute('href')?.replace(/^\/artist\//, 'spotify:artist:') === artistURI)
        && (!albumURI || !rowAlbum || rowAlbum === albumURI);
      const active = id ? [item?.uri, metadata.linked_from_uri].some(uri => uri === 'spotify:track:' + id)
        : title && artistURI ? !!sameRecording
        : row.classList.contains('main-trackList-trackListRowIsActive') || !!row.querySelector('.main-trackList-active, [data-testid="playing-icon"]');
      row.classList.toggle('calma-current-track', active);
      const target = active && row.querySelector('.main-trackList-rowSectionStart');
      if (!feedback || !changed || !playing || typeof target?.animate !== 'function') continue;
      const reduced = root.getAttribute('data-calma-motion') === 'reduced';
      const previous = trackMotions.get(target);
      const visible = previous?.playState === 'running' ? getComputedStyle(target) : null;
      previous?.cancel();
      trackMotions.set(target, target.animate([
        { opacity: visible?.opacity || 0.72, transform: reduced ? 'none' : visible?.transform || 'translate3d(2px, 0, 0) scale(0.99)' },
        { opacity: 1, transform: 'none' }
      ], { duration: reduced ? 150 : 220, easing: getComputedStyle(root).getPropertyValue('--calma-motion-ease').trim() || 'ease-out' }));
    }
    if (feedback || playbackFeedbackKey === null) playbackFeedbackKey = key;
  }
  function markReady(uri, sample) {
    for (const target of document.querySelectorAll(selector)) {
      const ready = String(sample.readyState >= 2);
      if (uriOf(target) === uri && target.getAttribute('data-calma-preview-ready') !== ready) target.setAttribute('data-calma-preview-ready', ready);
    }
  }
  function animateHomePress(target) {
    const art = target.querySelector('.view-homeShortcutsGrid-draggable');
    if (typeof art?.animate !== 'function') return;
    const root = document.documentElement;
    const reduced = root.getAttribute('data-calma-motion') === 'reduced';
    const visible = getComputedStyle(art);
    pressMotions.get(art)?.cancel();
    const easing = getComputedStyle(root).getPropertyValue('--calma-motion-ease').trim() || 'ease-out';
    pressMotions.set(art, art.animate([
      { opacity: visible.opacity || 1, transform: reduced ? 'none' : visible.transform || 'none' },
      { opacity: 0.88, transform: reduced ? 'none' : 'scale(0.97)' },
      { opacity: 1, transform: 'none' }
    ], { duration: 160, easing }));
  }
  function cancelArtworkFlight() {
    cancelAnimationFrame(artworkFrame);
    artworkFrame = 0;
    const flight = artworkFlight;
    artworkFlight = null;
    if (!flight) return;
    clearTimeout(flight.timer);
    flight.intro?.cancel(); flight.animation?.cancel(); flight.handoff?.cancel();
    flight.image?.removeEventListener('load', flight.reveal);
    flight.image?.removeEventListener('error', flight.fail);
    flight.source.style.visibility = flight.sourceVisibility;
    if (flight.target) flight.target.style.visibility = flight.visibility;
    flight.cover.remove();
  }
  function beginArtworkFlight(target, uri, returning = false) {
    cancelArtworkFlight();
    const image = target.querySelector('img'), root = document.documentElement;
    if (document.hidden || !image?.complete || !image.naturalWidth || typeof image.animate !== 'function'
        || (root.getAttribute('data-calma-motion') === 'reduced')) return;
    const from = image.getBoundingClientRect();
    if (!from.width || !from.height) return;
    const radius = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 14;
    const cover = document.createElement('img');
    cover.className = 'calma-artwork-flight'; cover.src = image.currentSrc || image.src; cover.alt = '';
    cover.setAttribute('aria-hidden', 'true');
    Object.assign(cover.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, clipPath: `inset(0 round ${radius}px)` });
    const flight = artworkFlight = { uri, returning, from, radius, cover, source: image, sourceVisibility: image.style.visibility };
    flight.timer = setTimeout(() => { if (artworkFlight === flight) cancelArtworkFlight(); }, 1100);
    document.body.append(cover); image.style.visibility = 'hidden';
    const paneLeft = document.querySelector('.Root__main-view')?.getBoundingClientRect().left || 0;
    flight.driftX = (paneLeft + 24 - from.left) * 0.45;
    flight.intro = cover.animate([{ transform: 'none' }, { transform: `translate3d(${flight.driftX}px, -24px, 0) scale(0.94)` }], { duration: 900, easing: 'linear', fill: 'forwards' });
    flight.intro.finished.catch(() => {});
  }
  function prepareReturnArtwork(uri = uriFromHref(window.Spicetify?.Platform?.History?.location?.pathname)) {
    if (artworkFlight?.returning) return;
    const source = uri && document.querySelector('.Root__main-view .main-entityHeader-imageContainer');
    if (source) beginArtworkFlight(source, uri, true);
  }
  function settleArtworkFlight() {
    if (!artworkFlight || artworkFrame || artworkFlight.animation) return;
    artworkFrame = requestAnimationFrame(() => {
      artworkFrame = 0;
      const flight = artworkFlight;
      if (!flight) return;
      const path = window.Spicetify?.Platform?.History?.location?.pathname;
      if (flight.returning ? !/^\/(?:home\/?)?$/.test(path || '/') : uriFromHref(path) !== flight.uri) return;
      const page = document.querySelector(flight.returning ? '[data-testid="home-page"]' : flight.uri.startsWith('spotify:album:') ? '[data-testid="album-page"]' : '[data-testid="playlist-page"]');
      if (flight.returning && !page?.hasAttribute('data-calma-album-count')) return;
      page?.setAttribute('data-calma-artwork-flight', 'true');
      if (flight.returning) {
        const viewport = document.querySelector('.main-view-container__scroll-node');
        if (viewport) viewport.scrollTop = savedHomeScroll;
      }
      const holder = flight.returning ? [...document.querySelectorAll(selector)].find(node => uriOf(node) === flight.uri)?.querySelector('.view-homeShortcutsGrid-imageHolder')
        : page?.querySelector('.main-entityHeader-imageContainer');
      const image = holder?.querySelector('img');
      if (!image) { if (flight.returning) cancelArtworkFlight(); return; }
      if (image.complete && !image.naturalWidth) { cancelArtworkFlight(); return; }
      const to = holder.getBoundingClientRect();
      if (!to.width || !to.height) return;
      const sx = to.width / flight.from.width, sy = to.height / flight.from.height;
      const radius = flight.returning ? 14 : parseFloat(getComputedStyle(holder).borderTopLeftRadius) || 12;
      flight.target = image; flight.visibility = image.style.visibility; image.style.visibility = 'hidden'; flight.image = image;
      flight.fail = () => { if (artworkFlight === flight) cancelArtworkFlight(); };
      flight.reveal = () => {
        if (artworkFlight !== flight || !flight.arrived || !image.complete || flight.handoff) return;
        image.style.visibility = flight.visibility;
        flight.handoff = flight.cover.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, easing: 'linear', fill: 'forwards' });
        flight.handoff.finished.then(flight.fail, flight.fail);
      };
      image.addEventListener('load', flight.reveal); image.addEventListener('error', flight.fail);
      const visible = getComputedStyle(flight.cover), matrix = new DOMMatrixReadOnly(visible.transform === 'none' ? undefined : visible.transform);
      const moving = (flight.intro.currentTime || 0) < 900, omega = 2 * Math.PI / 0.28;
      const spring = (start, goal, velocity, time) => goal + (start - goal + (velocity + omega * (start - goal)) * time) * Math.exp(-omega * time);
      const keyframes = Array.from({ length: 97 }, (_, index) => {
        const progress = index / 96, time = progress * 0.48, last = index === 96;
        const x = last ? to.left - flight.from.left : spring(matrix.m41, to.left - flight.from.left, moving ? flight.driftX / 0.9 : 0, time);
        const y = last ? to.top - flight.from.top : spring(matrix.m42, to.top - flight.from.top, moving ? -24 / 0.9 : 0, time);
        const ax = last ? sx : spring(matrix.a, sx, moving ? -0.06 / 0.9 : 0, time), ay = last ? sy : spring(matrix.d, sy, moving ? -0.06 / 0.9 : 0, time);
        const rx = last ? radius : spring(flight.radius * matrix.a, radius, moving ? -flight.radius * 0.06 / 0.9 : 0, time);
        const ry = last ? radius : spring(flight.radius * matrix.d, radius, moving ? -flight.radius * 0.06 / 0.9 : 0, time);
        return { transform: `translate3d(${x}px, ${y}px, 0) scale(${ax}, ${ay})`, clipPath: `inset(0 round ${rx / ax}px / ${ry / ay}px)`, opacity: 1 - 0.025 * Math.sin(Math.PI * progress) ** 2 };
      });
      keyframes[0] = { transform: visible.transform, clipPath: visible.clipPath, opacity: 1 };
      flight.intro.cancel();
      flight.animation = flight.cover.animate(keyframes, { duration: 480, easing: 'linear', fill: 'forwards' });
      clearTimeout(flight.timer); flight.timer = setTimeout(flight.fail, 1900);
      flight.animation.finished.then(() => { if (artworkFlight === flight) { flight.arrived = true; flight.reveal(); } }, flight.fail);
    });
  }
  function cancelCollectionEntrance() {
    cancelAnimationFrame(entranceFrame);
    entranceFrame = 0;
    for (const animation of collectionEntrance?.animations || []) animation.cancel();
    collectionEntrance = null;
  }
  function scheduleCollectionEntrance() {
    if (collectionEntrance || entranceFrame || document.hidden) return;
    if (!/^\/(?:album|playlist|track)\//.test(window.Spicetify?.Platform?.History?.location?.pathname || '')) return;
    entranceFrame = requestAnimationFrame(() => {
      entranceFrame = 0;
      const path = window.Spicetify?.Platform?.History?.location?.pathname;
      if (!uriFromHref(path) && !/^\/track\/[A-Za-z0-9]+\/?$/.test(path || '')) return;
      const page = document.querySelector('[data-testid="playlist-page"], [data-testid="album-page"], [data-testid="track-page"]');
      const pane = document.querySelector('.Root__main-view');
      if (!page || !pane || document.hidden) return;
      const bounds = pane.getBoundingClientRect();
      const rows = [...page.querySelectorAll('.main-trackList-trackListRow')].filter(row => {
        const box = row.getBoundingClientRect();
        return box.height > 0 && box.bottom > bounds.top && box.top < bounds.bottom;
      });
      if (!rows.length) return;
      const root = document.documentElement;
      const reduced = root.getAttribute('data-calma-motion') === 'reduced';
      const easing = getComputedStyle(root).getPropertyValue('--calma-motion-ease').trim() || 'ease-out';
      const entrance = collectionEntrance = { animations: [] };
      rows.forEach((row, index) => {
        const target = row.querySelector('.main-trackList-rowSectionStart');
        if (typeof target?.animate !== 'function' || trackMotions.get(target)?.playState === 'running') return;
        const animation = target.animate([
          { opacity: 0.56, transform: reduced ? 'none' : 'translate3d(0, 4px, 0)' },
          { opacity: 1, transform: 'none' }
        ], { duration: reduced ? 150 : 240, delay: reduced ? 0 : index / Math.max(1, rows.length - 1) * 100, easing, fill: 'backwards' });
        entrance.animations.push(animation);
        trackMotions.set(target, animation);
      });
    });
  }
  function loadPreview(uri) {
    if (previews.has(uri)) return previews.get(uri);
    const pending = (async () => {
      const items = uri.startsWith('spotify:playlist:')
        ? (await window.Spicetify.Platform.PlaylistAPI.getContents(uri, { offset: 0, limit: 5 })).items || []
        : (await query('getAlbumNameAndTracks', { uri, offset: 0, limit: 5 })).data?.albumUnion?.tracksV2?.items || [];
      const uris = items
        .map(item => item.track?.uri || item.uri).filter(value => value?.startsWith('spotify:track:')).slice(0, 5);
      if (!uris.length) return null;
      const response = await query('trackPreview', { uris });
      const url = (response.data?.lookup || []).flatMap(item => item.data?.previews?.audioPreviewsV2?.items || [])
        .map(item => item.url).find(value => /^https:\/\//.test(value || ''));
      if (!url) return null;
      const sample = new Audio(url);
      sample.preload = 'auto';
      sample.oncanplay = () => markReady(uri, sample);
      sample.load();
      return sample;
    })().catch(() => { previews.delete(uri); return null; });
    previews.set(uri, pending);
    if (previews.size > 18) {
      const oldest = previews.keys().next().value;
      previews.get(oldest).then(sample => {
        if (sample && sample !== audio && sample !== outgoing) { sample.pause(); sample.removeAttribute('src'); sample.load(); }
      });
      previews.delete(oldest);
    }
    return pending;
  }
  let card = null, audio = null, outgoing = null, dwell = null, ending = null;
  let generation = 0, subscribed = false, scanScheduled = false;
  function cancelFade(sample) {
    const frame = fades.get(sample);
    if (frame !== undefined) cancelAnimationFrame(frame);
    fades.delete(sample);
  }
  function fade(sample, to, duration, done) {
    cancelFade(sample);
    const from = sample.volume, began = performance.now();
    const step = now => {
      const progress = Math.min(1, Math.max(0, (now - began) / duration));
      sample.volume = Math.max(0, Math.min(1, from + (to - from) * progress));
      if (progress < 1) fades.set(sample, requestAnimationFrame(step));
      else { fades.delete(sample); done?.(); }
    };
    fades.set(sample, requestAnimationFrame(step));
  }
  function reset(sample) {
    cancelFade(sample);
    sample.onerror = sample.onended = null;
    sample.pause();
    sample.currentTime = 0;
  }
  function stop(immediate = false) {
    generation++;
    clearTimeout(dwell); clearTimeout(ending);
    const previous = audio;
    audio = null;
    card?.classList.remove('calma-previewing');
    card?.setAttribute('data-calma-preview-state', 'idle');
    card = null;
    if (immediate) {
      if (previous) reset(previous);
      if (outgoing && outgoing !== previous) reset(outgoing);
      outgoing = null;
      return;
    }
    if (previous) {
      outgoing = previous;
      const finish = () => {
        reset(previous);
        if (outgoing === previous) outgoing = null;
      };
      if (previous.paused || previous.ended || previous.volume === 0) finish();
      else fade(previous, 0, 110, finish);
    }
  }
  async function start(target, uri, token, entered) {
    const player = window.Spicetify?.Player;
    if (!preferences.previews || player?.isPlaying?.() !== false) { stop(true); return; }
    target.setAttribute('data-calma-preview-state', 'loading');
    const sample = await loadPreview(uri);
    if (token !== generation || card !== target || uriOf(target) !== uri) return;
    if (!preferences.previews || player.isPlaying() !== false) { stop(true); return; }
    if (!sample) { target.setAttribute('data-calma-preview-state', 'unavailable'); return; }
    cancelFade(sample);
    if (outgoing === sample) outgoing = null;
    audio = sample;
    sample.currentTime = 0;
    sample.volume = 0;
    sample.onended = () => { if (audio === sample) stop(); };
    sample.onerror = () => { if (audio === sample) { previews.delete(uri); stop(); target.setAttribute('data-calma-preview-state', 'unavailable'); } };
    try {
      await sample.play();
      if (token !== generation || audio !== sample) { if (audio !== sample) sample.pause(); return; }
      if (player.isPlaying() !== false) { stop(true); return; }
      target.setAttribute('data-calma-preview-state', 'playing');
      target.setAttribute('data-calma-preview-latency-ms', String(Math.round(performance.now() - entered)));
      target.classList.add('calma-previewing');
      fade(sample, Math.max(0, Math.min(0.5, player.getVolume())), 90);
      ending = setTimeout(() => stop(), 6000);
    } catch (error) {
      if (audio === sample) { stop(); target.setAttribute('data-calma-preview-state', error.name === 'NotAllowedError' ? 'blocked' : 'unavailable'); }
    }
  }
  function addHomeRecommendation(grid, template, { uri, href, name, image }) {
    const target = template.cloneNode(true);
    target.classList.add('calma-recommended');
    target.classList.remove('calma-home-album', 'calma-previewing');
    target.removeAttribute('style');
    for (const attribute of [...target.attributes]) if (attribute.name.startsWith('data-calma-')) target.removeAttribute(attribute.name);
    for (const node of [target, ...target.querySelectorAll('[id], [aria-describedby], [aria-labelledby]')]) { node.removeAttribute('id'); node.removeAttribute('aria-describedby'); node.removeAttribute('aria-labelledby'); }
    for (const anchor of target.querySelectorAll('a[href]')) { anchor.setAttribute('href', href); anchor.setAttribute('title', name); anchor.setAttribute('aria-label', name); }
    const cover = target.querySelector('img');
    if (!cover) return false;
    cover.src = image; cover.removeAttribute('srcset'); cover.alt = ''; cover.loading = 'eager';
    const label = target.querySelector('.view-homeShortcutsGrid-name');
    if (label) label.textContent = name;
    for (const indicator of target.querySelectorAll('.view-homeShortcutsGrid-playingEqualizer')) indicator.remove();
    const button = target.querySelector('button');
    if (button) {
      button.setAttribute('aria-label', (window.navigator?.language?.startsWith('es') ? 'Reproducir ' : 'Play ') + name);
      const icon = button.querySelector('svg');
      if (icon && window.Spicetify.SVGIcons?.play) icon.innerHTML = window.Spicetify.SVGIcons.play;
    }
    target.addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (event.target.closest('button')) { stop(false); window.Spicetify.Player.playUri(uri); }
      else window.Spicetify.Platform.History.push(href);
    });
    grid.append(target);
    return true;
  }
  // shortcut: use loaded Spotify Home suggestions; add an API source if those shelves disappear.
  function fillHomeGaps() {
    const native = [...document.querySelectorAll(selector)].filter(target => !target.classList.contains('calma-recommended'));
    const used = new Set(native.map(uriOf).filter(Boolean));
    const needed = Math.max(0, homeLimit - used.size - Number(!!pinnedPlaylist && !used.has(pinnedPlaylist.uri)));
    const grid = document.querySelector('[data-testid="home-page"] .view-homeShortcutsGrid-grid');
    const template = native.find(target => uriOf(target));
    if (!grid || !template) return;
    const extras = [...grid.querySelectorAll('.calma-recommended')];
    let kept = 0;
    for (const target of extras) {
      const uri = uriOf(target);
      if (!uri || used.has(uri) || (uri !== pinnedPlaylist?.uri && kept++ >= needed)) target.remove();
      else used.add(uri);
    }
    if (pinnedPlaylist && !used.has(pinnedPlaylist.uri) && addHomeRecommendation(grid, template, pinnedPlaylist)) used.add(pinnedPlaylist.uri);
    if (used.size >= homeLimit) return;
    for (const link of document.querySelector('[data-testid="home-page"]').querySelectorAll('a[href*="/album/"], a[href^="spotify:album:"]')) {
      if (link.closest('.calma-recommended')) continue;
      const href = link.getAttribute('href'), uri = uriFromHref(href);
      const name = link.getAttribute('title') || link.getAttribute('aria-label') || link.textContent.trim();
      if (!uri || used.has(uri) || !name) continue;
      let image;
      for (let parent = link, depth = 0; parent && depth < 7; parent = parent.parentElement, depth++) {
        if ([...parent.querySelectorAll(collectionLinks)].some(anchor => anchor.getAttribute('href') !== href)) break;
        image = parent.querySelector('img')?.currentSrc || parent.querySelector('img')?.src;
        if (image) break;
      }
      if (!image) continue;
      if (addHomeRecommendation(grid, template, { uri, href, name, image })) used.add(uri);
      if (used.size >= homeLimit) break;
    }
  }
  function scan() {
    scanScheduled = false;
    if (document.hidden) return;
    const api = window.Spicetify;
    if (typeof api?.GraphQL?.Request !== 'function' || typeof api?.Platform?.History?.listen !== 'function'
        || typeof api?.Player?.addEventListener !== 'function') return;
    syncSearchLayout();
    if (!subscribed) {
      subscribed = true;
      let previousPath = api.Platform.History.location?.pathname || '/';
      api.Platform.History.listen(() => {
        const path = api.Platform.History.location?.pathname;
        if (artworkFlight && (artworkFlight.returning ? !/^\/(?:home\/?)?$/.test(path || '/') : uriFromHref(path) !== artworkFlight.uri)) cancelArtworkFlight();
        if (!artworkFlight && /^\/(?:home\/?)?$/.test(path || '/') && uriFromHref(previousPath)) prepareReturnArtwork(uriFromHref(previousPath));
        if (path !== previousPath) cancelCollectionEntrance();
        previousPath = path || '/';
        syncSearchLayout();
        stop();
        releasePalette();
        if (api.Platform.History.location?.pathname !== '/ivLyrics') {
          lyricsRequest++;
          clearTimeout(lyricsTimer);
        }
        const root = document.documentElement;
        if (pendingHomeNavigation) root.setAttribute('data-calma-from-home', 'true');
        else root.removeAttribute('data-calma-from-home');
        pendingHomeNavigation = false;
        scheduleScan();
      });
      api.Player.addEventListener('songchange', () => { stop(true); syncPalette(); animateTrackChange(); });
      api.Player.addEventListener('onplaypause', event => {
        if (event.data?.isPaused === false || api.Player.isPlaying?.() === true) stop(true);
        requestAnimationFrame(() => { if (!document.hidden) syncPlaybackDetails(true); });
      });
    }
    syncPalette();
    syncAlbumPalette();
    syncPlaybackDetails();
    settleArtworkFlight();
    scheduleCollectionEntrance();
    if (!document.querySelector('[data-testid="home-page"]')) return;
    fillHomeGaps();
    let count = 0;
    const homeRank = uri => savedHomeOrder.includes(uri) ? savedHomeOrder.indexOf(uri) : 100;
    const targets = [...document.querySelectorAll(selector)].sort((a, b) => Number(uriOf(b) === pinnedPlaylist?.uri) - Number(uriOf(a) === pinnedPlaylist?.uri)
      || homeRank(uriOf(a)) - homeRank(uriOf(b)));
    for (const target of targets) {
      const uri = uriOf(target);
      const visible = !!uri && count++ < homeLimit;
      target.classList.toggle('calma-home-album', visible);
      if (!visible) continue;
      const index = String(count - 1);
      if (target.style.getPropertyValue('--calma-home-index') !== index) target.style.setProperty('--calma-home-index', index);
      if (target.style.order !== index) target.style.order = index;
      const image = target.querySelector('img')?.currentSrc || target.querySelector('img')?.src;
      const colorKey = uri + '|' + image;
      if (target.getAttribute('data-calma-color-uri') !== colorKey) {
        if (image) {
          target.setAttribute('data-calma-color-uri', colorKey);
          colorFor(uri, image).then(color => { if (color && target.getAttribute('data-calma-color-uri') === colorKey) target.style.setProperty('--calma-cover-tone', color.primary); });
        }
      }
    }
    const page = document.querySelector('[data-testid="home-page"]'), total = String(Math.min(count, homeLimit));
    if (page?.getAttribute('data-calma-album-count') !== total) page?.setAttribute('data-calma-album-count', total);
  }
  const scheduleScan = () => { if (!scanScheduled) { scanScheduled = true; setTimeout(scan, 120); } };
  new MutationObserver(records => {
    if (document.hidden) return;
    settleArtworkFlight();
    scheduleCollectionEntrance();
    if (!subscribed) { scheduleScan(); return; }
    const page = document.querySelector('[data-testid="home-page"], [data-testid="album-page"], [data-testid="playlist-page"]');
    if (page && records.some(record => (!record.target.closest?.('.main-trackList-trackList') && page.contains(record.target))
        || [...record.addedNodes].some(node => node === page || node.contains?.(page)))) scheduleScan();
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'src'] });
  document.addEventListener('pointerover', event => {
    const target = event.target.closest?.(selector);
    if (!target || target.contains(event.relatedTarget)) return;
    const uri = uriOf(target);
    if (!uri || !window.Spicetify?.Player) { releasePalette(); return; }
    hoverPalette(target, uri);
    if (!preferences.previews || window.Spicetify.Player.isPlaying?.() !== false) { stop(true); return; }
    if (target === card) return;
    if (card || audio) stop();
    card = target;
    loadPreview(uri).then(sample => { if (sample) markReady(uri, sample); });
    const token = generation, entered = performance.now();
    dwell = setTimeout(() => start(target, uri, token, entered), 120);
  });
  document.addEventListener('pointerout', event => {
    if (card && event.target.closest?.(selector) === card && !card.contains(event.relatedTarget)) stop();
    if (hoverTarget && event.target.closest?.(selector) === hoverTarget && !hoverTarget.contains(event.relatedTarget)) {
      const crossingGrid = event.relatedTarget?.closest?.('[data-testid="home-page"] .view-homeShortcutsGrid-grid');
      releasePalette(crossingGrid ? 180 : 90);
    }
  });
  document.addEventListener('click', event => {
    const homeTarget = event.target.closest?.(selector);
    const link = event.target.closest?.(collectionLinks);
    const target = homeTarget || link?.closest('.main-card-card, [data-encore-id="card"]');
    if (!target) return;
    const uri = link ? uriFromHref(link.getAttribute('href')) : uriOf(target);
    const button = event.target.closest('button');
    if (card === target) stop(Boolean(button));
    if (event.button !== 0 || event.detail === 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !uri) return;
    if (!button && homeTarget) {
      savedHomeOrder = [...document.querySelectorAll(selector)].filter(node => node.classList.contains('calma-home-album'))
        .sort((a, b) => Number(a.style.order) - Number(b.style.order)).map(uriOf).filter(Boolean);
      savedHomeScroll = document.querySelector('.main-view-container__scroll-node')?.scrollTop || 0;
      beginArtworkFlight(target, uri);
    }
    animateHomePress(target);
    if (!button && homeTarget) pendingHomeNavigation = true;
  }, true);
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || !event.detail || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const button = event.target.closest?.('button');
    const control = event.target.closest?.('a[href="/"], a[href="/home"], [data-testid="home-button"], [data-testid="topbar-back-button"], button[aria-label="Go back"], button[aria-label="Back"], button[aria-label="Atrás"]')
      || (button && button === document.querySelector('.main-globalNav-historyButtonsWrapper button') ? button : null);
    if (control) prepareReturnArtwork();
  }, true);
  document.addEventListener('pointerdown', event => {
    cancelArtworkFlight();
    if (event.button === 3) prepareReturnArtwork();
  }, true);
  function lyricsAvailable() {
    const apps = window.Spicetify?.Config?.custom_apps;
    return !!window.lyricContainer || !!document.querySelector('a[href="/ivLyrics"], [data-id="/ivLyrics"]')
      || (Array.isArray(apps) ? apps.includes('ivLyrics') : typeof apps === 'string' && apps.split('|').includes('ivLyrics'));
  }
  const middleClick = event => {
    const history = window.Spicetify?.Platform?.History;
    if (event.button !== 1 || typeof history?.push !== 'function' || !lyricsAvailable()) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.type !== 'auxclick') return;
    stop(true);
    releasePalette();
    clearTimeout(lyricsTimer);
    const request = ++lyricsRequest;
    if (history.location?.pathname !== '/ivLyrics') {
      window._ivLyricsPreviousPath = history.location?.pathname || '/';
      history.push('/ivLyrics');
    }
    let attempts = 0;
    const enter = () => {
      if (request !== lyricsRequest || history.location?.pathname !== '/ivLyrics' || document.hidden) return;
      const controller = window.lyricContainer;
      if (typeof controller?.toggleFullscreen === 'function') {
        if (!controller.state?.isFullscreen) {
          controller.toggleFullscreen({ presentation: 'screen' });
          return;
        }
        if (controller.fullscreenUsesBrowser || document.fullscreenElement) return;
        controller.toggleFullscreen();
      }
      if (++attempts < 20) lyricsTimer = setTimeout(enter, 100);
    };
    enter();
  };
  document.addEventListener('mousedown', middleClick, true);
  document.addEventListener('auxclick', middleClick, true);
  window.addEventListener('calma:settings', showPreferences);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (document.querySelector('.calma-settings')) {
      window.Spicetify?.PopupModal?.hide();
      document.querySelector('#calma-library-toggle')?.focus({ preventScroll: true });
    }
    cancelArtworkFlight();
    stop();
    lyricsRequest++;
    clearTimeout(lyricsTimer);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(true); releasePalette(); cancelArtworkFlight(); } else scheduleScan(); });
  window.addEventListener('blur', () => { stop(true); releasePalette(); cancelArtworkFlight(); });
  window.addEventListener('resize', cancelArtworkFlight);
  window.addEventListener('pagehide', () => { stop(true); cancelArtworkFlight(); cancelCollectionEntrance(); });
  scan();
  setTimeout(scheduleScan, 1000);
})();
