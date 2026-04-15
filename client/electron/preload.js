const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Get app version
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    // Force update trigger (called from renderer when 426 received)
    forceUpdate: () => ipcRenderer.send('force-update'),

    // Listen for update status changes
    onUpdateStatus: (callback) => {
        ipcRenderer.on('update-status', (event, data) => callback(data));
    },

    // Check if running in Electron
    isElectron: true,
});
