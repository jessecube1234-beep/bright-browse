const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateUrl, isYoutubeChannelApproved, shouldHideYoutubeChrome } = require('../src/main/policy.cjs');

const entries = [
  { type: 'website', value: 'khanacademy.org' },
  { type: 'webpage', value: 'https://example.com/approved/' },
  { type: 'youtubeChannel', value: 'UC123' },
  { type: 'youtubeChannel', value: '@goodchannel' }
];

test('website approval includes subdomains but not lookalike domains', () => {
  assert.equal(evaluateUrl('https://www.khanacademy.org/math', entries).action, 'allow');
  assert.equal(evaluateUrl('https://evil-khanacademy.org', entries).action, 'block');
});

test('webpage approval is exact apart from a trailing slash and fragment', () => {
  assert.equal(evaluateUrl('https://example.com/approved#section', entries).action, 'allow');
  assert.equal(evaluateUrl('https://example.com/approved/another', entries).action, 'block');
});

test('approved YouTube channel URLs are allowed', () => {
  assert.equal(evaluateUrl('https://youtube.com/channel/UC123', entries).action, 'allow');
  assert.equal(evaluateUrl('https://www.youtube.com/@goodchannel', entries).action, 'allow');
  assert.equal(evaluateUrl('https://youtube.com/@notapproved', entries).action, 'block');
});

test('YouTube watch pages require channel verification', () => {
  assert.equal(evaluateUrl('https://youtube.com/watch?v=abc', entries).action, 'verify-youtube');
  assert.equal(isYoutubeChannelApproved('UC123', null, entries), true);
  assert.equal(isYoutubeChannelApproved(null, '@goodchannel', entries), true);
  assert.equal(isYoutubeChannelApproved('UC999', null, entries), false);
});

test('the general YouTube homepage routes to the safe Bright Browse home', () => {
  assert.equal(evaluateUrl('https://youtube.com', entries).action, 'safe-youtube-home');
  assert.equal(evaluateUrl('https://www.youtube.com/', entries).action, 'safe-youtube-home');
  assert.equal(evaluateUrl('https://youtube.com/results?search_query=science', entries).action, 'block');
});

test('YouTube channels and videos hide the extra site chrome but keep the main content', () => {
  assert.equal(shouldHideYoutubeChrome('https://www.youtube.com/@goodchannel'), true);
  assert.equal(shouldHideYoutubeChrome('https://www.youtube.com/watch?v=abc'), true);
  assert.equal(shouldHideYoutubeChrome('https://www.youtube.com/results?search_query=science'), false);
  assert.equal(shouldHideYoutubeChrome('https://youtube.com'), false);
});
