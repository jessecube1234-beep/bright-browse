const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createPolicyStore } = require('../src/main/policy-store.cjs');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bright-browse-policy-'));
  const userData = path.join(root, 'user');
  fs.mkdirSync(path.join(root, 'config'));
  fs.writeFileSync(path.join(root, 'config', 'default-policy.json'), JSON.stringify({
    defaultsVersion: 2,
    entries: [
      { type: 'youtubeChannel', value: '@one', topics: ['science'] },
      { type: 'youtubeChannel', value: '@two' }
    ]
  }));
  const app = { getPath: () => userData, getAppPath: () => root };
  return { root, userData, store: createPolicyStore(app) };
}

test('adds new release defaults to an older saved profile once', () => {
  const { root, userData, store } = fixture();
  fs.mkdirSync(userData);
  fs.writeFileSync(path.join(userData, 'approved-content.json'), JSON.stringify({
    defaultsVersion: 1,
    entries: [{ type: 'youtubeChannel', value: '@one' }]
  }));
  const migrated = store.read();
  assert.equal(migrated.defaultsVersion, 2);
  assert.deepEqual(migrated.entries.map((entry) => entry.value), ['@one', '@two']);
  assert.deepEqual(migrated.entries[0].topics, ['science']);

  store.write({ defaultsVersion: 2, entries: [{ type: 'youtubeChannel', value: '@one' }] });
  assert.deepEqual(store.read().entries.map((entry) => entry.value), ['@one']);
  fs.rmSync(root, { recursive: true, force: true });
});
