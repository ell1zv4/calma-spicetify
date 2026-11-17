const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
for (const key of ['name', 'description', 'preview', 'usercss', 'schemes', 'readme']) {
  assert.equal(typeof manifest[key], 'string', 'Missing Marketplace field: ' + key);
  assert.ok(manifest[key].trim());
}
for (const key of ['preview', 'usercss', 'schemes', 'readme']) {
  const target = path.resolve(root, manifest[key]);
  assert.ok(target.startsWith(path.resolve(root) + path.sep), 'Manifest paths must stay in the repository.');
  assert.ok(fs.statSync(target).isFile(), 'Missing manifest asset: ' + key);
}
assert.deepEqual(manifest.include, ['https://ell1zv4.github.io/calma-spicetify/theme.js'], 'Marketplace JavaScript must use the GitHub Pages URL.');
assert.equal(manifest.name, 'Calma');
assert.ok(fs.existsSync(path.join(root, '.nojekyll')));
const js = fs.readFileSync(path.join(root, 'theme.js'), 'utf8');
new vm.Script(js);
assert.ok(js.includes("data-calma-version', '1.0.0'"));
for (const marker of ['CALMA_TEMP_', 'calma-library-readout', 'calma-details-readout', 'calma-perf-readout']) {
  assert.ok(!js.includes(marker), 'Temporary diagnostics must not ship.');
}
const css = fs.readFileSync(path.join(root, manifest.usercss), 'utf8');
assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, 'CSS blocks must be balanced.');
assert.ok(css.includes('data-calma-platform="win"'));
assert.ok(css.includes('data-calma-motion="reduced"'));
assert.ok(fs.readFileSync(path.join(root, manifest.schemes), 'utf8').includes('[Calma]'));
const png = fs.readFileSync(path.join(root, manifest.preview));
assert.ok(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Preview must be a PNG.');
assert.ok(png.readUInt32BE(16) >= 600 && png.readUInt32BE(20) >= 300, 'Preview is too small for the theme listing.');
const skip = new Set(['.git', '.release', 'captures']);
function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) { inspect(target); continue; }
    if (entry.name.endsWith('.png')) continue;
    const text = fs.readFileSync(target, 'utf8');
    assert.ok(!/[A-Za-z]:\\Users\\/.test(text), 'Personal filesystem path: ' + path.relative(root, target));
    assert.ok(!/spotify:playlist:[A-Za-z0-9]{22}\b/.test(text), 'Personal playlist ID: ' + path.relative(root, target));
    assert.ok(!/\bgh[pousr]_[A-Za-z0-9]{20,}\b/.test(text), 'Credential-shaped content: ' + path.relative(root, target));
    assert.ok(!/(?<![:/\w])[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text), 'Embedded email address: ' + path.relative(root, target));
  }
}
inspect(root);
console.log('PASS: Marketplace manifest, script syntax, assets, preview dimensions and public-package privacy checks.');
