const path = require('node:path');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: path.join(__dirname, 'assets', 'bright-browse.ico'),
    executableName: 'BrightBrowse'
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'BrightBrowse',
        authors: 'Bright Browse',
        description: 'An allowlist-first browser for children',
        setupExe: 'Bright Browse Setup.exe',
        setupIcon: path.join(__dirname, 'assets', 'bright-browse.ico')
      }
    }
  ]
};
