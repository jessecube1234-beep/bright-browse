const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createPinStore } = require('../src/main/pin-store.cjs');

function temporaryApp() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bright-browse-pin-'));
  return { directory, app: { getPath: () => directory } };
}

test('sets and verifies a numeric PIN without storing the PIN itself', () => {
  const { directory, app } = temporaryApp();
  const store = createPinStore(app);
  assert.equal(store.hasPin(), false);
  assert.equal(store.setPin('2468').ok, true);
  assert.equal(store.hasPin(), true);
  assert.equal(store.verifyPin('2468').ok, true);
  assert.equal(store.verifyPin('1111').ok, false);
  assert.equal(fs.readFileSync(path.join(directory, 'parent-pin.json'), 'utf8').includes('2468'), false);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('rejects PINs that are not 4 to 6 numbers', () => {
  const { directory, app } = temporaryApp();
  const store = createPinStore(app);
  assert.equal(store.setPin('123').ok, false);
  assert.equal(store.setPin('abcd').ok, false);
  assert.equal(store.setPin('1234567').ok, false);
  fs.rmSync(directory, { recursive: true, force: true });
});
