const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');

const dataPolicyPath = path.join(__dirname, 'build-data-policy.json');
const dataDir = path.join(process.env.ProgramData || 'C:\\ProgramData', 'Lebanon Pharma Pro');
try {
  const dataPolicy = JSON.parse(fs.readFileSync(dataPolicyPath, 'utf8'));
  const policyMarker = path.join(dataDir, `.build-policy-${dataPolicy.buildId}`);
  if (dataPolicy.mode === 'fresh' && !fs.existsSync(policyMarker)) {
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(policyMarker, 'applied');
  }
} catch (err) {
  console.error('Could not apply packaged data policy:', err);
}

// Store app data (settings/cache used by the renderer's localStorage & IndexedDB) in a
// stable, install-independent location instead of %APPDATA%\react-example. ProgramData is
// writable without admin rights and is never touched by the app's installer/uninstaller,
// so upgrading or uninstalling the app can never wipe the pharmacy's data.
// Must be set before 'ready' fires, per Electron's app.setPath() requirements.
try {
  fs.mkdirSync(dataDir, { recursive: true });
  app.setPath('userData', dataDir);
} catch (err) {
  console.error('Failed to set custom userData path, falling back to default:', err);
}

let mainWindow;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isMaximized()) mainWindow.maximize();
    mainWindow.focus();
  });
}

function createWindow() {
  // Start the server directly in the main Electron process
  // This bypasses any .asar fork issues
  try {
    // Set NODE_ENV to production so Express serves static files instead of Vite
    process.env.NODE_ENV = 'production';
    require(path.join(__dirname, 'dist', 'server.cjs'));
  } catch (err) {
    console.error("Failed to start embedded server:", err);
    dialog.showErrorBox("Server Startup Failed", "Failed to start the embedded server:\n" + (err.stack || err.message || err));
    app.quit();
    return;
  }

  // Create the Desktop App Window
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Lebanon Pharma Pro",
    autoHideMenuBar: true, 
    webPreferences: {
      nodeIntegration: false
    }
  });
  mainWindow.maximize();

  // Keep checking if port 3000 is ready before loading
  let retries = 0;
  const maxRetries = 75; // ~15 seconds at 200ms
  
  const tryLoadURL = () => {
    const socket = new net.Socket();
    socket.setTimeout(100);
    socket.on('connect', () => {
      socket.destroy();
      mainWindow.loadURL('http://localhost:3000');
    }).on('error', () => {
      // Server not ready yet, wait and try again
      if (retries >= maxRetries) {
        dialog.showErrorBox("Connection Timeout", "The embedded server took too long to start. The application will now close.");
        app.quit();
        return;
      }
      retries++;
      setTimeout(tryLoadURL, 200);
    }).on('timeout', () => {
      socket.destroy();
      if (retries >= maxRetries) {
        dialog.showErrorBox("Connection Timeout", "The embedded server took too long to start. The application will now close.");
        app.quit();
        return;
      }
      retries++;
      setTimeout(tryLoadURL, 200);
    });
    socket.connect(3000, '127.0.0.1');
  };

  tryLoadURL();
}

if (gotSingleInstanceLock) {
  app.whenReady().then(createWindow);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
