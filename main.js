// Copyright (c) 2026 Argenox Technologies LLC. All rights reserved.

const { app, BrowserWindow } = require('electron');
const path = require('path');

const pkg = require('./package.json');
const appTitle = `POE Cascade Calculator${pkg.version ? ` v${pkg.version}` : ''}`;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: appTitle,
  });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
