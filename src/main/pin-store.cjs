const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PIN_PATTERN = /^\d{4,6}$/;

function hashPin(pin, salt) {
  return crypto.scryptSync(pin, salt, 32).toString('hex');
}

function createPinStore(app) {
  const pinFile = path.join(app.getPath('userData'), 'parent-pin.json');
  let failedAttempts = 0;
  let lockedUntil = 0;

  function readRecord() {
    try {
      return JSON.parse(fs.readFileSync(pinFile, 'utf8'));
    } catch {
      return null;
    }
  }

  function hasPin() {
    const record = readRecord();
    return Boolean(record?.salt && record?.hash);
  }

  function setPin(pin) {
    if (!PIN_PATTERN.test(String(pin))) {
      return { ok: false, error: 'Choose a PIN containing 4 to 6 numbers.' };
    }
    if (hasPin()) {
      return { ok: false, error: 'A parent PIN has already been created.' };
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const record = { salt, hash: hashPin(String(pin), salt) };
    fs.mkdirSync(path.dirname(pinFile), { recursive: true });
    fs.writeFileSync(pinFile, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    return { ok: true };
  }

  function verifyPin(pin) {
    const now = Date.now();
    if (now < lockedUntil) {
      return { ok: false, error: `Too many attempts. Try again in ${Math.ceil((lockedUntil - now) / 1000)} seconds.` };
    }
    const record = readRecord();
    if (!record) return { ok: false, error: 'No parent PIN has been created yet.' };

    const suppliedHash = Buffer.from(hashPin(String(pin), record.salt), 'hex');
    const savedHash = Buffer.from(record.hash, 'hex');
    const matches = suppliedHash.length === savedHash.length && crypto.timingSafeEqual(suppliedHash, savedHash);
    if (matches) {
      failedAttempts = 0;
      lockedUntil = 0;
      return { ok: true };
    }

    failedAttempts += 1;
    if (failedAttempts >= 5) {
      failedAttempts = 0;
      lockedUntil = now + 30_000;
      return { ok: false, error: 'Too many attempts. Try again in 30 seconds.' };
    }
    return { ok: false, error: 'That PIN is incorrect.' };
  }

  return { hasPin, setPin, verifyPin };
}

module.exports = { createPinStore, hashPin, PIN_PATTERN };
