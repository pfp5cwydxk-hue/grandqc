import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('pathInsight:open-slide', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Whole Slide Images', extensions: ['svs', 'ndpi', 'tif', 'tiff', 'mrxs'] },
      { name: 'Alle bestanden', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  return { canceled: false, filePath: result.filePaths[0] };
});

ipcMain.handle('pathInsight:start-pipeline', async (_event, payload) => {
  const slidePath: string | null = payload?.slidePath ?? null;
  if (!slidePath) {
    return { ok: false, slidePath: null, startedAt: Date.now(), message: 'No slide provided' };
  }

  try {
    const fs = require('fs');
    const { spawn } = require('child_process');
    const os = require('os');
    const path = require('path');
    // temporary working dir and repository-level output dir
    const tmp = path.join(process.cwd(), 'tmp_pipeline_' + Date.now());
    fs.mkdirSync(tmp, { recursive: true });

    const repoOutputBase = path.join(process.cwd(), '01_WSI_inference_OPENSLIDE_QC', 'output');
    const outputDir = path.join(repoOutputBase, `pipeline_${Date.now()}`);
    const slidesIn = path.join(outputDir, 'slides_in');
    fs.mkdirSync(slidesIn, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(slidesIn, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });

    // copy selected slide into slides_in
    const basename = require('path').basename(slidePath);
    const destSlide = path.join(slidesIn, basename);
    fs.copyFileSync(slidePath, destSlide);

    const mainWindow = BrowserWindow.getAllWindows()[0];

    const pythonExec = 'python3';

    // helper to run a command and stream logs back to renderer
    const runCmd = (cmd: string, args: string[]) =>
      new Promise<void>((resolve, reject) => {
        const proc = spawn(cmd, args, { cwd: process.cwd(), env: process.env });
        proc.stdout.on('data', (data: Buffer) => {
          const line = data.toString();
          mainWindow.webContents.send('pathInsight:log', line);
        });
        proc.stderr.on('data', (data: Buffer) => {
          const line = data.toString();
          mainWindow.webContents.send('pathInsight:log', line);
        });
        proc.on('close', (code: number) => {
          if (code === 0) resolve();
          else reject(new Error(`Process exited with code ${code}`));
        });
      });

    // 1) run tissue detection
    mainWindow.webContents.send('pathInsight:status', { step: 'tissue-detect', msg: 'Starting tissue detection...' });
    await runCmd(pythonExec, ['01_WSI_inference_OPENSLIDE_QC/wsi_tis_detect.py', '--slide_folder', slidesIn, '--output_dir', outputDir]);

    // 2) run QC pipeline
    mainWindow.webContents.send('pathInsight:status', { step: 'qc', msg: 'Starting QC pipeline...' });
    await runCmd(pythonExec, ['01_WSI_inference_OPENSLIDE_QC/main.py', '--slide_folder', slidesIn, '--output_dir', outputDir, '--mpp_model', '1.5', '--create_geojson', 'Y']);

      // 3) generate HTML report
      mainWindow.webContents.send('pathInsight:status', { step: 'report', msg: 'Generating HTML report...' });
      await runCmd(pythonExec, ['01_WSI_inference_OPENSLIDE_QC/generate_report.py', '--output_dir', outputDir]);

      // 4) generate visual overlays
      mainWindow.webContents.send('pathInsight:status', { step: 'overlays', msg: 'Creating visual overlays...' });
      await runCmd(pythonExec, ['01_WSI_inference_OPENSLIDE_QC/generate_overlays.py', '--output_dir', outputDir]);

    mainWindow.webContents.send('pathInsight:status', { step: 'done', msg: 'Pipeline finished', outputDir });

    return { ok: true, slidePath, startedAt: Date.now(), message: 'Pipeline finished', outputDir } as any;
  } catch (err: any) {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    mainWindow.webContents.send('pathInsight:log', `Pipeline error: ${err?.message || err}`);
    return { ok: false, slidePath, startedAt: Date.now(), message: String(err) } as any;
  }
});

// List files in a directory (used by renderer to show outputs)
ipcMain.handle('pathInsight:list-output', async (_e, dirPath: string) => {
  const fs = require('fs');
  try {
    const files = fs.readdirSync(dirPath).map((f: string) => ({ name: f, path: require('path').join(dirPath, f) }));
    return { ok: true, files };
  } catch (err: any) {
    return { ok: false, message: String(err) };
  }
});

// Open folder in OS
ipcMain.handle('pathInsight:open-output', async (_e, dirPath: string) => {
  const { shell } = require('electron');
  try {
    // show folder in finder/explorer
    shell.showItemInFolder(dirPath);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: String(err) };
  }
});
