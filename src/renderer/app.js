const $ = (selector) => document.querySelector(selector);
const homeScreen = $('#home-screen');
const youtubeScreen = $('#youtube-screen');
const messageScreen = $('#message-screen');
const settings = $('#settings');
const pinDialog = $('#pin-dialog');
let policy = { entries: [] };
let parentToken = null;
let pinMode = 'verify';

function showHome() {
  homeScreen.classList.remove('hidden');
  youtubeScreen.classList.add('hidden');
  messageScreen.classList.add('hidden');
}

function showYoutubeHome() {
  homeScreen.classList.add('hidden');
  messageScreen.classList.add('hidden');
  youtubeScreen.classList.remove('hidden');
}

function showMessage(title, text, icon = '🛡️') {
  homeScreen.classList.add('hidden');
  youtubeScreen.classList.add('hidden');
  messageScreen.classList.remove('hidden');
  $('#message-title').textContent = title;
  $('#message-text').textContent = text;
  $('#message-icon').textContent = icon;
}

function destinationFor(entry) {
  if (entry.type === 'website') return `https://${entry.value.replace(/^https?:\/\//, '')}`;
  if (entry.type === 'youtubeChannel') {
    return entry.value.startsWith('@')
      ? `https://www.youtube.com/${entry.value}`
      : `https://www.youtube.com/channel/${entry.value}`;
  }
  return entry.value;
}

function makeResourceCard(entry) {
  const button = document.createElement('button');
  button.className = 'approved-card';
  button.innerHTML = `<span>${entry.type === 'youtubeChannel' ? '▶' : '✦'}</span><strong></strong><small></small>`;
  button.querySelector('strong').textContent = entry.label || entry.value;
  button.querySelector('small').textContent = entry.type === 'youtubeChannel' ? 'YouTube channel' : entry.value;
  button.addEventListener('click', () => window.brightBrowse.navigate(destinationFor(entry)));
  return button;
}

function exploreTopic(query) {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return;
  const words = cleanQuery.split(/\s+/).filter(Boolean);
  const matches = policy.entries
    .map((entry) => {
      const searchable = [entry.label, entry.value, ...(entry.topics || [])].join(' ').toLowerCase();
      return { entry, score: words.filter((word) => searchable.includes(word)).length };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score);

  const grid = $('#topic-grid');
  grid.replaceChildren(...matches.map(({ entry }) => makeResourceCard(entry)));
  $('#topic-results-title').textContent = `Resources for “${query.trim()}”`;
  $('#topic-empty').classList.toggle('hidden', matches.length > 0);
  $('#topic-results').classList.remove('hidden');
  $('#all-resources-title').classList.add('hidden');
  $('#approved-grid').classList.add('hidden');
  $('#topic-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearTopicSearch() {
  $('#topic-query').value = '';
  $('#topic-results').classList.add('hidden');
  $('#all-resources-title').classList.remove('hidden');
  $('#approved-grid').classList.remove('hidden');
}

function renderCards() {
  const grid = $('#approved-grid');
  const youtubeGrid = $('#youtube-grid');
  grid.replaceChildren();
  youtubeGrid.replaceChildren();
  policy.entries.forEach((entry) => {
    grid.append(makeResourceCard(entry));

    if (entry.type === 'youtubeChannel') {
      const channel = document.createElement('button');
      channel.className = 'youtube-channel';
      const initial = (entry.label || entry.value).trim().charAt(0).toUpperCase();
      channel.innerHTML = '<span class="channel-avatar"></span><strong></strong><small>View channel</small>';
      channel.querySelector('.channel-avatar').textContent = initial;
      channel.querySelector('strong').textContent = entry.label || entry.value;
      channel.addEventListener('click', () => window.brightBrowse.navigate(destinationFor(entry)));
      youtubeGrid.append(channel);
    }
  });
}

function addEntry(entry = { type: 'website', label: '', value: '' }) {
  const row = $('#entry-template').content.firstElementChild.cloneNode(true);
  row.querySelector('.entry-type').value = entry.type;
  row.querySelector('.entry-label').value = entry.label || '';
  row.querySelector('.entry-value').value = entry.value || '';
  row.querySelector('.remove-entry').addEventListener('click', () => row.remove());
  $('#entry-list').append(row);
}

async function showSettings() {
  policy = await window.brightBrowse.getPolicy();
  $('#entry-list').replaceChildren();
  policy.entries.forEach(addEntry);
  settings.showModal();
}

function openPinDialog(mode) {
  pinMode = mode;
  const setup = mode === 'setup';
  $('#pin-title').textContent = setup ? 'Create a parent PIN' : 'Enter parent PIN';
  $('#pin-help').textContent = setup
    ? 'Choose 4 to 6 numbers. You will use this PIN to change approved content.'
    : 'Enter your PIN to manage approved content.';
  $('#submit-pin').textContent = setup ? 'Create PIN' : 'Unlock settings';
  $('#confirm-pin-group').classList.toggle('hidden', !setup);
  $('#confirm-pin').required = setup;
  $('#pin').value = '';
  $('#confirm-pin').value = '';
  $('#pin-error').textContent = '';
  pinDialog.showModal();
  $('#pin').focus();
}

async function requestParentAccess() {
  const status = await window.brightBrowse.getParentStatus();
  openPinDialog(status.hasPin ? 'verify' : 'setup');
}

$('#address-form').addEventListener('submit', (event) => {
  event.preventDefault();
  window.brightBrowse.navigate($('#address').value);
});
$('#topic-form').addEventListener('submit', (event) => {
  event.preventDefault();
  exploreTopic($('#topic-query').value);
});
document.querySelectorAll('[data-topic]').forEach((button) => {
  button.addEventListener('click', () => {
    $('#topic-query').value = button.dataset.topic;
    exploreTopic(button.dataset.topic);
  });
});
$('#clear-topic').addEventListener('click', clearTopicSearch);
$('#home').addEventListener('click', () => window.brightBrowse.home());
$('#back').addEventListener('click', () => window.brightBrowse.back());
$('#parents').addEventListener('click', requestParentAccess);
$('#cancel-pin').addEventListener('click', () => pinDialog.close());
$('#pin-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const pin = $('#pin').value;
  if (pinMode === 'setup' && pin !== $('#confirm-pin').value) {
    $('#pin-error').textContent = 'Those PINs do not match.';
    return;
  }
  const result = pinMode === 'setup'
    ? await window.brightBrowse.setupPin(pin)
    : await window.brightBrowse.verifyPin(pin);
  if (!result.ok) {
    $('#pin-error').textContent = result.error;
    $('#pin').select();
    return;
  }
  parentToken = result.token;
  pinDialog.close();
  await showSettings();
});
$('#message-home').addEventListener('click', () => window.brightBrowse.home());
$('#close-settings').addEventListener('click', () => settings.close());
$('#cancel-settings').addEventListener('click', () => settings.close());
$('#add-entry').addEventListener('click', () => addEntry());
$('#settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const entries = [...document.querySelectorAll('.entry-row')].map((row) => ({
    type: row.querySelector('.entry-type').value,
    label: row.querySelector('.entry-label').value.trim(),
    value: row.querySelector('.entry-value').value.trim()
  })).filter((entry) => entry.value);
  const result = await window.brightBrowse.savePolicy({ entries }, parentToken);
  if (!result.ok) {
    settings.close();
    parentToken = null;
    openPinDialog('verify');
    $('#pin-error').textContent = result.error;
    return;
  }
  policy = result.policy;
  renderCards();
  settings.close();
});

window.brightBrowse.onStatus((status) => {
  if (status.state === 'home') showHome();
  if (status.state === 'youtube-home') showYoutubeHome();
  if (status.state === 'blocked') showMessage('This page needs approval', status.reason);
  if (status.state === 'checking') showMessage('Checking this video…', 'Bright Browse is making sure it comes from an approved channel.', '🔎');
});

window.brightBrowse.getPolicy().then((savedPolicy) => {
  policy = savedPolicy;
  renderCards();
  window.brightBrowse.getParentStatus().then((status) => {
    if (!status.hasPin) openPinDialog('setup');
  });
});
