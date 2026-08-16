const path = require('node:path');
const { app, BrowserWindow, WebContentsView, ipcMain } = require('electron');
const { evaluateUrl, isYoutubeChannelApproved } = require('./policy.cjs');
const { createPolicyStore } = require('./policy-store.cjs');
const { createPinStore } = require('./pin-store.cjs');

// Windows launches the app briefly during install/update/uninstall. This helper
// handles those events so the normal Bright Browse window does not appear.
if (require('electron-squirrel-startup')) app.quit();
app.setAppUserModelId('com.squirrel.BrightBrowse.BrightBrowse');

let window;
let pageView;
let policyStore;
let pinStore;
const parentSessions = new Map();
const TOOLBAR_HEIGHT = 82;
const PARENT_SESSION_LENGTH_MS = 10 * 60 * 1000;

function createParentSession() {
  const crypto = require('node:crypto');
  const token = crypto.randomBytes(32).toString('hex');
  parentSessions.set(token, Date.now() + PARENT_SESSION_LENGTH_MS);
  return token;
}

function isAuthorized(token) {
  const expiresAt = parentSessions.get(token);
  if (!expiresAt || expiresAt < Date.now()) {
    if (token) parentSessions.delete(token);
    return false;
  }
  return true;
}

function sendStatus(status) {
  window?.webContents.send('browser:status', status);
}

function showHome() {
  if (pageView) pageView.setVisible(false);
  sendStatus({ state: 'home' });
}

function showBlocked(url, reason) {
  if (pageView) pageView.setVisible(false);
  sendStatus({ state: 'blocked', url, reason });
}

function resizePageView() {
  if (!window || !pageView) return;
  const [width, height] = window.getContentSize();
  pageView.setBounds({ x: 0, y: TOOLBAR_HEIGHT, width, height: Math.max(0, height - TOOLBAR_HEIGHT) });
}

async function readYoutubeIdentity() {
  return pageView.webContents.executeJavaScript(`(() => {
    const player = window.ytInitialPlayerResponse;
    const details = player && player.videoDetails;
    const owner = document.querySelector('ytd-video-owner-renderer a[href^="/@"]');
    return { channelId: details && details.channelId, handle: owner && owner.getAttribute('href').slice(1) };
  })()`);
}

async function loadYoutubeForVerification(url) {
  pageView.setVisible(false);
  sendStatus({ state: 'checking', url });
  await pageView.webContents.loadURL(url);
  const identity = await readYoutubeIdentity();
  const entries = policyStore.read().entries;
  if (isYoutubeChannelApproved(identity.channelId, identity.handle, entries)) {
    pageView.setVisible(true);
    sendStatus({ state: 'browsing', url });
    return { allowed: true };
  }
  showBlocked(url, 'This video is not from an approved YouTube channel.');
  return { allowed: false };
}

async function hideYoutubeChromeIfNeeded(url) {
  if (!pageView || !pageView.webContents || !require('./policy.cjs').shouldHideYoutubeChrome(url)) return;
  await pageView.webContents.insertCSS(`
    #masthead-container,
    #masthead,
    #topbar,
    #search,
    #search-input,
    ytd-masthead,
    ytd-guide-renderer,
    ytd-mini-guide-renderer,
    #guide,
    #chips,
    #related,
    #secondary,
    ytd-watch-next-secondary-results-renderer,
    ytd-comments,
    ytd-reel-shelf-renderer,
    ytd-searchbox {
      display: none !important;
    }
    #page-manager,
    #content,
    #primary,
    #contents,
    ytd-browse-results-renderer,
    ytd-channel-renderer,
    ytd-video-renderer,
    ytd-watch-flexy {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
    }
    html, body {
      overflow: auto !important;
    }
  `);

  await pageView.webContents.executeJavaScript(`(() => {
    const selectors = [
      '#masthead-container', '#masthead', '#topbar', '#search', '#search-input',
      'ytd-masthead', 'ytd-guide-renderer', 'ytd-mini-guide-renderer', '#guide',
      '#chips', '#related', '#secondary', 'ytd-watch-next-secondary-results-renderer',
      'ytd-comments', 'ytd-reel-shelf-renderer', 'ytd-searchbox'
    ];
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((element) => {
        element.style.display = 'none';
      });
    }
    const contentTargets = [
      document.querySelector('#primary'),
      document.querySelector('#contents'),
      document.querySelector('ytd-watch-flexy'),
      document.querySelector('ytd-channel-renderer'),
      document.querySelector('ytd-browse-results-renderer')
    ].filter(Boolean);
    for (const target of contentTargets) {
      target.style.width = '100%';
      target.style.maxWidth = '100%';
      target.style.minWidth = '0';
    }
    if (document.body) document.body.style.overflow = 'auto';
    if (document.documentElement) document.documentElement.style.overflow = 'auto';
  })();`).catch(() => {});
}

async function navigate(rawUrl) {
  let url = String(rawUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const decision = evaluateUrl(url, policyStore.read().entries);
  if (decision.action === 'block') {
    showBlocked(url, decision.reason);
    return { allowed: false, reason: decision.reason };
  }
  if (decision.action === 'safe-youtube-home') {
    if (pageView) pageView.setVisible(false);
    sendStatus({
      state: 'youtube-home'
    });
    return { allowed: true, redirectedToSafeHome: true };
  }
  if (decision.action === 'verify-youtube') return loadYoutubeForVerification(url);
  await pageView.webContents.loadURL(url);
  await hideYoutubeChromeIfNeeded(url);
  pageView.setVisible(true);
  sendStatus({ state: 'browsing', url });
  return { allowed: true };
}

function createWindow() {
  window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 760,
    minHeight: 540,
    title: 'Bright Browse',
    backgroundColor: '#f6fbff',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  pageView = new WebContentsView({ webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.contentView.addChildView(pageView);
  pageView.setVisible(false);
  resizePageView();

  pageView.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    navigate(url).catch(() => showBlocked(url, 'Bright Browse could not open this page.'));
  });
  pageView.webContents.on('will-redirect', (event, url) => {
    const decision = evaluateUrl(url, policyStore.read().entries);
    if (decision.action !== 'allow') {
      event.preventDefault();
      navigate(url).catch(() => showBlocked(url, 'Bright Browse could not follow this redirect.'));
    }
  });
  pageView.webContents.on('did-finish-load', () => {
    const currentUrl = pageView?.webContents?.getURL();
    if (currentUrl && require('./policy.cjs').shouldHideYoutubeChrome(currentUrl)) {
      hideYoutubeChromeIfNeeded(currentUrl).catch(() => {});
    }
  });
  pageView.webContents.setWindowOpenHandler(({ url }) => {
    navigate(url).catch(() => showBlocked(url, 'Bright Browse could not open this link.'));
    return { action: 'deny' };
  });

  window.on('resize', resizePageView);
  window.on('closed', () => { window = null; pageView = null; });
  window.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  policyStore = createPolicyStore(app);
  pinStore = createPinStore(app);
  ipcMain.handle('browser:navigate', (_event, url) => navigate(url));
  ipcMain.handle('browser:back', () => {
    if (pageView?.webContents.navigationHistory.canGoBack()) pageView.webContents.navigationHistory.goBack();
  });
  ipcMain.handle('browser:home', showHome);
  ipcMain.handle('policy:get', () => policyStore.read());
  ipcMain.handle('policy:save', (_event, policy, token) => {
    if (!isAuthorized(token)) return { ok: false, error: 'Parent access expired. Enter your PIN again.' };
    return { ok: true, policy: policyStore.write(policy) };
  });
  ipcMain.handle('parent:status', () => ({ hasPin: pinStore.hasPin() }));
  ipcMain.handle('parent:setup', (_event, pin) => {
    const result = pinStore.setPin(pin);
    return result.ok ? { ok: true, token: createParentSession() } : result;
  });
  ipcMain.handle('parent:verify', (_event, pin) => {
    const result = pinStore.verifyPin(pin);
    return result.ok ? { ok: true, token: createParentSession() } : result;
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
