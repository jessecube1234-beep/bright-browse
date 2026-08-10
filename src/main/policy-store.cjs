const fs = require('node:fs');
const path = require('node:path');

function createPolicyStore(app) {
  const userFile = path.join(app.getPath('userData'), 'approved-content.json');
  const defaultFile = path.join(app.getAppPath(), 'config', 'default-policy.json');

  function readJson(file) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  }

  function normalize(policy) {
    return {
      defaultsVersion: Number(policy?.defaultsVersion) || 0,
      entries: Array.isArray(policy?.entries) ? policy.entries : []
    };
  }

  function entryKey(entry) {
    return `${entry.type}:${String(entry.value).trim().toLowerCase()}`;
  }

  function read() {
    const defaults = normalize(readJson(defaultFile));
    if (!fs.existsSync(userFile)) return defaults;

    const saved = normalize(readJson(userFile));
    if (saved.defaultsVersion >= defaults.defaultsVersion) return saved;

    // A new release may introduce useful starter resources. Add each new
    // default once, then record the version so a parent's later removal sticks.
    const defaultsByKey = new Map(defaults.entries.map((entry) => [entryKey(entry), entry]));
    const updatedSavedEntries = saved.entries.map((entry) => {
      const matchingDefault = defaultsByKey.get(entryKey(entry));
      if (!matchingDefault) return entry;
      return {
        ...matchingDefault,
        ...entry,
        topics: Array.isArray(entry.topics) ? entry.topics : matchingDefault.topics
      };
    });
    const existingKeys = new Set(updatedSavedEntries.map(entryKey));
    const newEntries = defaults.entries.filter((entry) => !existingKeys.has(entryKey(entry)));
    return write({
      defaultsVersion: defaults.defaultsVersion,
      entries: [...updatedSavedEntries, ...newEntries]
    });
  }

  function write(policy) {
    const defaults = normalize(readJson(defaultFile));
    const safePolicy = {
      defaultsVersion: Number(policy.defaultsVersion) || defaults.defaultsVersion,
      entries: Array.isArray(policy.entries) ? policy.entries : []
    };
    fs.mkdirSync(path.dirname(userFile), { recursive: true });
    fs.writeFileSync(userFile, `${JSON.stringify(safePolicy, null, 2)}\n`, 'utf8');
    return safePolicy;
  }

  return { read, write };
}

module.exports = { createPolicyStore };
