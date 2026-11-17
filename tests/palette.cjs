const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'theme.js'), 'utf8');
let pixels;
const context = vm.createContext({
  Image: class { set src(value) { queueMicrotask(() => this.onload()); } },
  document: { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => ({ data: pixels }) }) }) }
});
vm.runInContext('const colors = new Map();\n' + source.slice(source.indexOf('  function colorFor'), source.indexOf('  function paintAmbience')) + '\nthis.extract = colorFor;', context);
function cover(rgb, alpha = 255) { pixels = new Uint8ClampedArray(4096); for (let i = 0; i < pixels.length; i += 4) pixels.set([...rgb, alpha], i); }
async function run() {
  cover([248,248,248]);
  for (let i = 0; i < 20; i += 4) pixels.set([0,20,220,255],i);
  let result = await context.extract('spotify:album:white','https://example.test/white');
  assert.equal(result.primary, '#f8f8f8'); assert.equal(result.secondary, result.primary, 'Tiny blue fringes must not tint a white cover.');
  cover([0,0,0]); result = await context.extract('spotify:album:black','https://example.test/black');
  assert.equal(result.primary, '#000000'); assert.equal(result.secondary, '#000000');
  cover([200,30,40]); for (let i = 2048; i < 4096; i += 4) pixels.set([30,70,200,255],i);
  result = await context.extract('spotify:album:color','https://example.test/color');
  assert.ok(['#c81e28','#1e46c8'].includes(result.primary)); assert.notEqual(result.secondary,result.primary);
  cover([0,0,0],0); result = await context.extract('spotify:album:empty','https://example.test/transparent'); assert.equal(result,null);
  console.log('PASS: white, black, multicolor and transparent covers; minor color fringes do not dominate ambience.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
