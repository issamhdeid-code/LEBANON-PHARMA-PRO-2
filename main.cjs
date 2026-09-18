const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');

const dataPolicyPath = path.join(__dirname, 'build-data-policy.json');
const dataDir = path.join(process.env.ProgramData || 'C:\\ProgramData', 'Lebanon Pharma Pro');

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
  // Apply the packaged data policy ONLY from the single surviving instance. Running the
  // wipe in every launching process (as before) could race two rmSync calls. The "fresh"
  // build data policy wipes the whole ProgramData data folder when the buildId changes —
  // no backup, so upgrades must bump the buildId deliberately.
  try {
    const dataPolicy = JSON.parse(fs.readFileSync(dataPolicyPath, 'utf8'));
    // Record the applied buildId in a state file OUTSIDE the wiped ProgramData folder.
    // The old implementation stored its marker inside the very dataDir it deletes, so the
    // marker was wiped along with everything else and the "fresh" policy re-fired on every
    // launch — silently destroying the pharmacy's data each boot. Keeping the state in
    // the default appData dir (never touched by the installer or this policy) makes the
    // "wipe when the buildId changes" contract hold exactly once per deliberately-bumped
    // buildId, and never on an ordinary restart.
    const policyStatePath = path.join(app.getPath('appData'), 'Lebanon Pharma Pro', 'build-policy-state.json');
    let appliedBuildId = null;
    try {
      appliedBuildId = JSON.parse(fs.readFileSync(policyStatePath, 'utf8')).buildId ?? null;
    } catch (err) { /* first run on this machine: no state yet */ }

    if (dataPolicy.mode === 'fresh' && dataPolicy.buildId !== appliedBuildId) {
      fs.rmSync(dataDir, { recursive: true, force: true });
      fs.mkdirSync(dataDir, { recursive: true });
      fs.mkdirSync(path.dirname(policyStatePath), { recursive: true });
      fs.writeFileSync(policyStatePath, JSON.stringify({ buildId: dataPolicy.buildId }));
    }
  } catch (err) {
    console.error('Could not apply packaged data policy:', err);
  }

  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isMaximized()) mainWindow.maximize();
    mainWindow.focus();
  });
}

// A crashed/hung renderer must not leave a frozen blank window on duty.
function wireRendererCrashGuard(win) {
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('Renderer process gone:', details?.reason);
    try { win.reload(); } catch (err) { console.error('Reload failed:', err); }
  });
  win.webContents.on('unresponsive', () => {
    console.error('Renderer became unresponsive.');
  });
}

// Bump window-all-closed and before-quit so the server's debounced cache writes
// (e.g. the LNDD ingredients JSON, 1s debounce) get a chance to flush before exit.
let quitFlushStarted = false;
app.on('before-quit', (event) => {
  if (quitFlushStarted) return;
  event.preventDefault();
  quitFlushStarted = true;
  setTimeout(() => app.quit(), 1200);
});

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
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    }
  });
  mainWindow.maximize();
  wireRendererCrashGuard(mainWindow);

  // Keep checking if OUR server on port 3000 is ready before loading. A bare TCP
  // probe used to be enough — but that would happily load an unrelated program that
  // happens to occupy port 3000 and hand it this origin's data. We now require the
  // /api/health endpoint to answer with our identity fingerprint.
  let retries = 0;
  const maxRetries = 75; // ~15 seconds at 200ms

  const giveUp = (message) => {
    dialog.showErrorBox("Connection Timeout", message + " The application will now close.");
    app.quit();
  };

  const verifyServerIdentity = () => {
    const req = http.get('http://127.0.0.1:3000/api/health', { timeout: 2000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json && json.status === 'ok' && json.app === 'lebanon-pharma-pro') {
            mainWindow.loadURL('http://localhost:3000')
              .catch((err) => console.error('Failed to load app URL:', err));
            return;
          }
        } catch (err) { /* fall through to retry */ }
        if (retries >= maxRetries) {
          giveUp("Port 3000 is occupied by another program that does not appear to be Lebanon Pharma Pro.");
          return;
        }
        retries++;
        setTimeout(tryLoadURL, 200);
      });
    });
    req.on('error', () => {
      if (retries >= maxRetries) {
        giveUp("The embedded server took too long to start.");
        return;
      }
      retries++;
      setTimeout(tryLoadURL, 200);
    });
    req.on('timeout', () => {
      req.destroy();
      if (retries >= maxRetries) {
        giveUp("The embedded server took too long to start.");
        return;
      }
      retries++;
      setTimeout(tryLoadURL, 200);
    });
  };

  const tryLoadURL = () => {
    const socket = new net.Socket();
    socket.setTimeout(100);
    socket.on('connect', () => {
      socket.destroy();
      verifyServerIdentity();
    }).on('error', () => {
      if (retries >= maxRetries) {
        giveUp("The embedded server took too long to start.");
        return;
      }
      retries++;
      setTimeout(tryLoadURL, 200);
    }).on('timeout', () => {
      socket.destroy();
      if (retries >= maxRetries) {
        giveUp("The embedded server took too long to start.");
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

process.on('uncaughtException', (err) => {
  console.error('Main process uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Main process unhandled rejection:', reason);
});