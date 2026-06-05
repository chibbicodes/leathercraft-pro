const { app, BrowserWindow, shell, Menu } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

// ── User data location ──
const userDataPath = path.getPath ? app.getPath('userData') : path.join(require('os').homedir(), 'Library', 'Application Support', 'LeatherCraft Pro');
const dataDir = path.join(userDataPath, 'data');
fs.mkdirSync(path.join(dataDir, 'invoices'), { recursive: true });
fs.mkdirSync(path.join(dataDir, 'logos'), { recursive: true });

let serverPort = 3847;
let serverProcess = null;

// ── Find a free port ──
function findFreePort(startPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => resolve(findFreePort(startPort + 1)));
  });
}

// ── Start server as child process using system Node ──
function startServer(port) {
  return new Promise((resolve, reject) => {
    const serverScript = path.join(__dirname, '..', 'server', 'index.js');
    const appRoot = path.join(__dirname, '..');

    // Determine if we're in an asar archive
    let serverDir = appRoot;
    if (appRoot.includes('.asar')) {
      // Extract server files path — asar unpacked
      serverDir = appRoot.replace('.asar', '.asar.unpacked');
    }

    const env = {
      ...process.env,
      PORT: String(port),
      LEATHERCRAFT_DATA_DIR: dataDir,
      NODE_ENV: 'production',
    };

    // Use the bundled node or system node
    const nodePath = process.execPath.includes('Electron')
      ? '/usr/local/bin/node' // fallback to system node
      : process.execPath;

    // Try system node first, fall back to Electron's node with --no-warnings
    const nodeCmd = fs.existsSync('/usr/local/bin/node') ? '/usr/local/bin/node'
      : fs.existsSync('/opt/homebrew/bin/node') ? '/opt/homebrew/bin/node'
      : process.execPath;

    const actualServerScript = serverDir.includes('.asar.unpacked')
      ? path.join(serverDir, 'server', 'index.js')
      : serverScript;

    serverProcess = spawn(nodeCmd, [actualServerScript], {
      env,
      cwd: serverDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let started = false;

    serverProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      console.log('[server]', msg.trim());
      if (msg.includes('running on') && !started) {
        started = true;
        resolve(port);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('[server error]', data.toString().trim());
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start server:', err);
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      console.log('Server exited with code:', code);
      if (!started) reject(new Error(`Server exited with code ${code}`));
    });

    // Timeout — if server doesn't start in 10s, something's wrong
    setTimeout(() => {
      if (!started) {
        started = true;
        // Assume it started anyway and try connecting
        resolve(port);
      }
    }, 10000);
  });
}

// ── Window creation ──
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'LeatherCraft Pro',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#f7f1e8',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  // Load the app
  if (process.env.ELECTRON_DEV) {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(`http://localhost:${serverPort}`);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') && !url.includes(`localhost:${serverPort}`)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── macOS menu ──
function createMenu() {
  const template = [
    {
      label: 'LeatherCraft Pro',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── App lifecycle ──
app.whenReady().then(async () => {
  createMenu();

  try {
    serverPort = await findFreePort(3847);
    await startServer(serverPort);
  } catch (err) {
    console.error('Server failed to start:', err);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (serverProcess) {
      serverProcess.kill();
    }
    app.quit();
  }
});
