const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);

function normalizeHost(value) {
  return String(value).trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
}

function normalizePage(value) {
  const url = new URL(value);
  url.hash = '';
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/$/, '');
  return url.toString();
}

function isYoutube(url) {
  return YOUTUBE_HOSTS.has(url.hostname.toLowerCase());
}

function youtubeChannelFromUrl(url) {
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'channel' && parts[1]) return parts[1];
  if (parts[0]?.startsWith('@')) return parts[0].toLowerCase();
  return null;
}

function approvedYoutubeValues(entries) {
  return entries
    .filter((entry) => entry.type === 'youtubeChannel')
    .map((entry) => String(entry.value).trim().toLowerCase());
}

function evaluateUrl(rawUrl, entries = []) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { action: 'block', reason: 'That is not a valid web address.' };
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { action: 'block', reason: 'Only normal web addresses are supported.' };
  }

  if (isYoutube(url)) {
    if (url.pathname === '/' || url.pathname === '') {
      return { action: 'safe-youtube-home' };
    }
    const channel = youtubeChannelFromUrl(url);
    const approved = approvedYoutubeValues(entries);
    if (channel) {
      return approved.includes(channel.toLowerCase())
        ? { action: 'allow', matched: channel }
        : { action: 'block', reason: 'That YouTube channel is not approved.' };
    }
    if (url.pathname === '/watch' && url.searchParams.has('v')) {
      return { action: 'verify-youtube', videoId: url.searchParams.get('v') };
    }
    return { action: 'block', reason: 'Only approved YouTube channels and their videos are available.' };
  }

  for (const entry of entries) {
    if (entry.type === 'website') {
      const approvedHost = normalizeHost(entry.value);
      const actualHost = normalizeHost(url.hostname);
      if (actualHost === approvedHost || actualHost.endsWith(`.${approvedHost}`)) {
        return { action: 'allow', matched: entry.value };
      }
    }
    if (entry.type === 'webpage') {
      try {
        if (normalizePage(url.toString()) === normalizePage(entry.value)) {
          return { action: 'allow', matched: entry.value };
        }
      } catch {
        // An invalid saved entry never grants access.
      }
    }
  }

  return { action: 'block', reason: 'This page is not on the approved list.' };
}

function isYoutubeChannelApproved(channelId, handle, entries = []) {
  const approved = approvedYoutubeValues(entries);
  return approved.includes(String(channelId || '').toLowerCase()) ||
    approved.includes(String(handle || '').toLowerCase());
}

module.exports = { evaluateUrl, isYoutubeChannelApproved, normalizeHost, normalizePage };
