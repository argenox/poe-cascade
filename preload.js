// Copyright (c) 2026 Argenox Technologies LLC. All rights reserved.

const { contextBridge } = require('electron');
const path = require('path');

let appVersion = '0.1.10';
try {
  const pkg = require(path.join(__dirname, 'package.json'));
  if (pkg && typeof pkg.version === 'string') appVersion = pkg.version;
} catch (_) {}

contextBridge.exposeInMainWorld('electronAPI', {
  appVersion,
});
