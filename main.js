// Copyright (c) 2026 Argenox Technologies LLC. All rights reserved.

const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');

const pkg = require('./package.json');
const productName = pkg.build?.productName || pkg.name || 'POE Cascade Calculator';
const appTitle = `${productName}${pkg.version ? ` v${pkg.version}` : ''}`;
const copyrightText = pkg.copyright || 'Copyright (c) 2026 Argenox Technologies LLC. All rights reserved.';

const iconPath = path.join(__dirname, 'build', 'app_icon.png');

function showAboutDialog() {
  const appPkg = require(path.join(app.getAppPath(), 'package.json'));
  const version = appPkg.version || '1.0.0';
  const copyright = appPkg.copyright || copyrightText;
  dialog.showMessageBoxSync({
    type: 'info',
    title: `About ${productName}`,
    message: productName,
    detail: `Version ${version}\n\n${copyright}`,
  });
}

function setApplicationMenu() {
  const isMac = process.platform === 'darwin';
  const aboutItem = isMac
    ? { label: `About ${productName}`, click: showAboutDialog }
    : { label: `About ${productName}`, click: showAboutDialog };

  const template = [
    ...(isMac ? [{
      label: productName,
      submenu: [
        aboutItem,
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    ...(isMac ? [] : [{ label: 'File', submenu: [{ role: 'quit' }] }]),
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Help', submenu: [aboutItem] },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: appTitle,
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock && app.dock.setIcon) {
    app.dock.setIcon(iconPath);
  }
  setApplicationMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
