const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('brightBrowse', {
  navigate: (url) => ipcRenderer.invoke('browser:navigate', url),
  back: () => ipcRenderer.invoke('browser:back'),
  home: () => ipcRenderer.invoke('browser:home'),
  getPolicy: () => ipcRenderer.invoke('policy:get'),
  savePolicy: (policy, token) => ipcRenderer.invoke('policy:save', policy, token),
  getParentStatus: () => ipcRenderer.invoke('parent:status'),
  setupPin: (pin) => ipcRenderer.invoke('parent:setup', pin),
  verifyPin: (pin) => ipcRenderer.invoke('parent:verify', pin),
  onStatus: (listener) => ipcRenderer.on('browser:status', (_event, status) => listener(status))
});
