const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  db: {
    getAllParts: () => ipcRenderer.invoke('db:getAllParts'),
    getPart: (id) => ipcRenderer.invoke('db:getPart', id),
    updateDescription: (data) => ipcRenderer.invoke('db:updateDescription', data),
    importParts: (parts) => ipcRenderer.invoke('db:importParts', parts),
    getSetting: (key) => ipcRenderer.invoke('db:getSetting', key),
    setSetting: (key, value) => ipcRenderer.invoke('db:setSetting', { key, value }),
    getAllSettings: () => ipcRenderer.invoke('db:getAllSettings')
  },
  print: {
    getInstalledPrinters: () => ipcRenderer.invoke('print:getInstalledPrinters'),
    printLabel: (data) => ipcRenderer.invoke('print:printLabel', data)
  },
  dialog: {
    openFile: (options) => ipcRenderer.invoke('dialog:openFile', options)
  },
  fs: {
    readFileBase64: (filePath) => ipcRenderer.invoke('fs:readFileBase64', filePath)
  }
});
