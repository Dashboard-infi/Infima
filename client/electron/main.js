const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const log = require('electron-log');

// ========== LOGGING ==========
log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// ========== STATE ==========
let mainWindow = null;
let updateWindow = null;
let isUpdateRequired = false;
let updateDownloaded = false;

// ========== APP VERSION ==========
const APP_VERSION = app.getVersion();
log.info(`Cabinet Donneville v${APP_VERSION} demarrage...`);

// ========== PREVENT MULTIPLE INSTANCES ==========
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}

// ========== CREATE UPDATE WINDOW (BLOCKING) ==========
function createUpdateWindow() {
    if (updateWindow) return updateWindow;

    updateWindow = new BrowserWindow({
        width: 420,
        height: 340,
        resizable: false,
        movable: true,
        minimizable: false,
        maximizable: false,
        closable: false,           // anti-fermeture
        fullscreenable: false,
        alwaysOnTop: true,
        frame: false,
        transparent: false,
        backgroundColor: '#0A3D62',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    updateWindow.loadFile(path.join(__dirname, 'update.html'));
    updateWindow.setMenu(null);

    // Empecher fermeture pendant update
    updateWindow.on('close', (e) => {
        if (isUpdateRequired && !updateDownloaded) {
            e.preventDefault();
        }
    });

    return updateWindow;
}

// ========== CREATE MAIN WINDOW ==========
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 420,
        height: 760,
        minWidth: 360,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        icon: path.join(__dirname, '..', 'public', 'favicon.ico'),
        show: false,
    });

    mainWindow.setMenu(null);

    // Load React build or dev server
    const isDev = !app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'build', 'index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        if (!isUpdateRequired) {
            mainWindow.show();
        }
    });

    // Empecher fermeture si update en cours
    mainWindow.on('close', (e) => {
        if (isUpdateRequired) {
            e.preventDefault();
        }
    });

    return mainWindow;
}

// ========== VERSION CHECK AGAINST SERVER ==========
async function checkServerVersion() {
    try {
        const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const https = require('http');
        const url = new URL(`${API_URL}/api/version`);

        return new Promise((resolve) => {
            const mod = url.protocol === 'https:' ? require('https') : require('http');
            const req = mod.get(url.href, { timeout: 10000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve(json);
                    } catch { resolve(null); }
                });
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
        });
    } catch {
        return null;
    }
}

function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na > nb) return 1;
        if (na < nb) return -1;
    }
    return 0;
}

// ========== AUTO-UPDATER EVENTS ==========
autoUpdater.on('checking-for-update', () => {
    log.info('[UPDATE] Verification en cours...');
    sendUpdateStatus('checking', 'Verification des mises a jour...');
});

autoUpdater.on('update-available', (info) => {
    log.info(`[UPDATE] Mise a jour disponible: v${info.version}`);
    isUpdateRequired = true;

    // Show blocking update screen
    if (mainWindow) mainWindow.hide();
    const win = createUpdateWindow();
    win.show();

    sendUpdateStatus('downloading', `Telechargement de la version ${info.version}...`, 0);

    // Auto-download
    autoUpdater.downloadUpdate();
});

autoUpdater.on('update-not-available', () => {
    log.info('[UPDATE] Application a jour.');
    isUpdateRequired = false;

    if (updateWindow) {
        updateWindow.destroy();
        updateWindow = null;
    }

    if (mainWindow) {
        mainWindow.show();
    }
});

autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    const speed = (progress.bytesPerSecond / 1024).toFixed(0);
    log.info(`[UPDATE] Progression: ${percent}% (${speed} KB/s)`);
    sendUpdateStatus('downloading', `Telechargement en cours... ${percent}%`, percent, `${speed} KB/s`);
});

autoUpdater.on('update-downloaded', () => {
    log.info('[UPDATE] Telechargement termine. Installation...');
    updateDownloaded = true;
    sendUpdateStatus('installing', 'Installation en cours... Redemarrage automatique.', 100);

    // Install and restart after short delay
    setTimeout(() => {
        autoUpdater.quitAndInstall(false, true);
    }, 2000);
});

autoUpdater.on('error', (err) => {
    log.error('[UPDATE] Erreur:', err.message);
    sendUpdateStatus('error', `Erreur: ${err.message}. Nouvelle tentative dans 30s...`);

    // Retry after 30 seconds
    setTimeout(() => {
        autoUpdater.checkForUpdates();
    }, 30000);
});

// ========== SEND STATUS TO UPDATE WINDOW ==========
function sendUpdateStatus(status, message, progress, speed) {
    if (updateWindow && !updateWindow.isDestroyed()) {
        updateWindow.webContents.send('update-status', { status, message, progress, speed });
    }
}

// ========== FULL VERSION CHECK FLOW ==========
async function performVersionCheck() {
    log.info('[VERSION] Verification de version...');

    // 1. Check server-side minimum version
    const serverInfo = await checkServerVersion();

    if (!serverInfo) {
        // No connectivity — block app
        log.warn('[VERSION] Impossible de joindre le serveur.');
        isUpdateRequired = true;

        if (mainWindow) mainWindow.hide();
        const win = createUpdateWindow();
        win.show();
        sendUpdateStatus('offline', 'Connexion requise pour verifier les mises a jour. Nouvelle tentative dans 30s...');

        setTimeout(performVersionCheck, 30000);
        return;
    }

    // 2. Compare local vs minimum_required
    if (compareVersions(APP_VERSION, serverInfo.minimum_required_version) < 0) {
        log.info(`[VERSION] Version locale ${APP_VERSION} < minimum ${serverInfo.minimum_required_version}. Update obligatoire.`);
        isUpdateRequired = true;

        if (mainWindow) mainWindow.hide();
        const win = createUpdateWindow();
        win.show();
        sendUpdateStatus('checking', 'Mise a jour obligatoire detectee...');

        // Trigger electron-updater
        autoUpdater.checkForUpdates();
        return;
    }

    // 3. Also check for optional electron-updater updates
    // (in case version matches minimum but newer available)
    try {
        autoUpdater.checkForUpdates();
    } catch (err) {
        log.error('[VERSION] Erreur check updates:', err.message);
    }

    // Version OK — show main window
    isUpdateRequired = false;
    if (updateWindow) {
        updateWindow.destroy();
        updateWindow = null;
    }
    if (mainWindow && !mainWindow.isVisible()) {
        mainWindow.show();
    }
}

// ========== IPC HANDLERS ==========
ipcMain.handle('get-app-version', () => APP_VERSION);
ipcMain.on('force-update', () => {
    performVersionCheck();
});

// ========== APP LIFECYCLE ==========
app.whenReady().then(async () => {
    createMainWindow();

    // Initial version check
    await performVersionCheck();

    // Periodic check every 6 hours
    setInterval(performVersionCheck, 6 * 60 * 60 * 1000);

    // Check on focus (foreground return)
    app.on('browser-window-focus', () => {
        performVersionCheck();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

// Prevent navigation to external URLs
app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (e, url) => {
        if (isUpdateRequired) {
            e.preventDefault();
        }
    });
});
