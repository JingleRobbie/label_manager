const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let dbModule;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function registerIpcHandlers() {
  ipcMain.handle('db:getAllParts', () => dbModule.getAllParts());

  ipcMain.handle('db:getPart', (_, id) => dbModule.getPart(id));

  ipcMain.handle('db:updateDescription', (_, { id, description, updated_at }) => {
    dbModule.updateDescription(id, description, updated_at);
    return { success: true };
  });

  ipcMain.handle('db:importParts', (_, parts) => {
    const count = dbModule.importParts(parts);
    dbModule.setSetting('last_import_date', new Date().toISOString());
    return { success: true, count };
  });

  ipcMain.handle('db:getSetting', (_, key) => dbModule.getSetting(key));

  ipcMain.handle('db:setSetting', (_, { key, value }) => {
    dbModule.setSetting(key, value);
    return { success: true };
  });

  ipcMain.handle('db:getAllSettings', () => dbModule.getAllSettings());

  ipcMain.handle('print:getInstalledPrinters', async () => {
    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers.map(p => p.name);
  });

  ipcMain.handle('print:printLabel', async (_, { html, printerName }) => {
    return new Promise((resolve) => {
      const win = new BrowserWindow({
        show: false,
        webPreferences: { javascript: true }
      });

      win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

      win.webContents.once('did-finish-load', () => {
        win.webContents.print(
          {
            silent: true,
            deviceName: printerName,
            pageSize: { width: 152400, height: 101600 }
          },
          (success, errorType) => {
            win.close();
            if (success) {
              resolve({ success: true });
            } else {
              resolve({ success: false, error: errorType || 'Unknown print error' });
            }
          }
        );
      });

      win.webContents.on('did-fail-load', (_, code, desc) => {
        win.close();
        resolve({ success: false, error: `Failed to load label: ${desc}` });
      });
    });
  });

  ipcMain.handle('dialog:openFile', async (_, { filters } = {}) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters || [{ name: 'All Files', extensions: ['*'] }]
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('fs:readFileBase64', (_, filePath) => {
    const data = fs.readFileSync(filePath);
    return data.toString('base64');
  });
}

app.whenReady().then(() => {
  dbModule = require('./db/database');
  dbModule.initDatabase();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
