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
    const path = require('path');
    const os = require('os');
    
    const mainWindow = BrowserWindow.getAllWindows()[0];
    
    // Try to find repo automatically
    let repoRoot = null;
    const candidates = [
      path.join(os.homedir(), 'grandqc'),
      '/Users/huugie/grandqc',
      path.join(process.cwd(), '..', '..'),
    ];
    
    for (const candidate of candidates) {
      if (fs.existsSync(path.join(candidate, '.venv')) && 
          fs.existsSync(path.join(candidate, '01_WSI_inference_OPENSLIDE_QC'))) {
        repoRoot = candidate;
        break;
      }
    }
    
    // If not found, ask user
    if (!repoRoot) {
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openDirectory'],
        title: 'Select the grandqc repository folder',
        message: 'Please select the grandqc folder containing .venv and 01_WSI_inference_OPENSLIDE_QC',
        defaultPath: os.homedir(),
      });
      
      if (result.canceled || !result.filePaths[0]) {
        return { ok: false, message: 'Repository folder not selected' };
      }
      
      repoRoot = result.filePaths[0];
    }
    
    // Verify repo structure
    if (!fs.existsSync(path.join(repoRoot, '.venv')) || 
        !fs.existsSync(path.join(repoRoot, '01_WSI_inference_OPENSLIDE_QC'))) {
      return { ok: false, message: `Selected folder does not contain required .venv and 01_WSI_inference_OPENSLIDE_QC. Checked: ${repoRoot}` };
    }
    
    mainWindow?.webContents.send('pathInsight:log', `Using repo: ${repoRoot}`);
    mainWindow?.webContents.send('pathInsight:log', `Slide: ${slidePath}`);

    const repoOutputBase = path.join(repoRoot, '01_WSI_inference_OPENSLIDE_QC', 'output');
    const outputDir = path.join(repoOutputBase, `pipeline_${Date.now()}`);
    const slidesIn = path.join(outputDir, 'slides_in');
    fs.mkdirSync(slidesIn, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });

    // copy selected slide into slides_in
    const basename = path.basename(slidePath);
    const destSlide = path.join(slidesIn, basename);
    fs.copyFileSync(slidePath, destSlide);
    mainWindow?.webContents.send('pathInsight:log', `Copied slide to: ${destSlide}`);

    // Use venv python
    const pythonPath = path.join(repoRoot, '.venv', 'bin', 'python3');
    if (!fs.existsSync(pythonPath)) {
      return { ok: false, message: `Python not found at ${pythonPath}` };
    }
    mainWindow?.webContents.send('pathInsight:log', `Using python: ${pythonPath}`);

    // helper to run a command and stream logs back to renderer
    const runCmd = (cmd: string, args: string[]) =>
      new Promise<void>((resolve, reject) => {
        mainWindow?.webContents.send('pathInsight:log', `Running: ${cmd} ${args.join(' ')}`);
        const proc = spawn(cmd, args, { cwd: repoRoot, env: process.env });
        proc.stdout.on('data', (data: Buffer) => {
          const line = data.toString();
          mainWindow?.webContents.send('pathInsight:log', line);
        });
        proc.stderr.on('data', (data: Buffer) => {
          const line = data.toString();
          mainWindow?.webContents.send('pathInsight:log', `[ERROR] ${line}`);
        });
        proc.on('close', (code: number) => {
          if (code === 0) resolve();
          else reject(new Error(`Process exited with code ${code}`));
        });
      });

    // 1) run tissue detection
    mainWindow?.webContents.send('pathInsight:status', { step: 'tissue-detect', msg: 'Starting tissue detection...' });
    const tdScript = path.join(repoRoot, '01_WSI_inference_OPENSLIDE_QC', 'wsi_tis_detect.py');
    await runCmd(pythonPath, [tdScript, '--slide_folder', slidesIn, '--output_dir', outputDir]);

    // 2) run QC pipeline (use MPP 1.5 only, skip geojson for speed)
    mainWindow?.webContents.send('pathInsight:status', { step: 'qc', msg: 'Starting QC pipeline...' });
    const qcScript = path.join(repoRoot, '01_WSI_inference_OPENSLIDE_QC', 'main.py');
    await runCmd(pythonPath, [qcScript, '--slide_folder', slidesIn, '--output_dir', outputDir, '--mpp_model', '1.5', '--create_geojson', 'N']);

    // 3) generate HTML report
    mainWindow?.webContents.send('pathInsight:status', { step: 'report', msg: 'Generating HTML report...' });
    const reportScript = path.join(repoRoot, '01_WSI_inference_OPENSLIDE_QC', 'generate_report.py');
    await runCmd(pythonPath, [reportScript, '--output_dir', outputDir]);

    // 3b) generate PDF report with GrandQC scores
    mainWindow?.webContents.send('pathInsight:status', { step: 'pdf-report', msg: 'Generating PDF report with GrandQC scores...' });
    const pdfReportScript = path.join(repoRoot, '01_WSI_inference_OPENSLIDE_QC', 'generate_pdf_report.py');
    await runCmd(pythonPath, [pdfReportScript, '--output_dir', outputDir]);

    // 4) generate visual overlays
    mainWindow?.webContents.send('pathInsight:status', { step: 'overlays', msg: 'Creating visual overlays...' });
    const overlayScript = path.join(repoRoot, '01_WSI_inference_OPENSLIDE_QC', 'generate_overlays.py');
    await runCmd(pythonPath, [overlayScript, '--output_dir', outputDir]);

    mainWindow?.webContents.send('pathInsight:status', { step: 'done', msg: 'Pipeline finished', outputDir });

    return { ok: true, slidePath, startedAt: Date.now(), message: 'Pipeline finished', outputDir } as any;
  } catch (err: any) {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    mainWindow?.webContents.send('pathInsight:log', `Pipeline error: ${err?.message || err}`);
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

// Open report.html in default browser
ipcMain.handle('pathInsight:open-report', async (_e, outputDir: string) => {
  const { shell } = require('electron');
  const path = require('path');
  const fs = require('fs');
  try {
    const reportPath = path.join(outputDir, 'report.html');
    if (!fs.existsSync(reportPath)) {
      return { ok: false, message: 'report.html not found' };
    }
    await shell.openPath(reportPath);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: String(err) };
  }
});

// Open report.pdf in default PDF viewer
ipcMain.handle('pathInsight:open-pdf', async (_e, outputDir: string) => {
  const { shell } = require('electron');
  const path = require('path');
  const fs = require('fs');
  try {
    const pdfPath = path.join(outputDir, 'report.pdf');
    if (!fs.existsSync(pdfPath)) {
      return { ok: false, message: 'report.pdf not found' };
    }
    await shell.openPath(pdfPath);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: String(err) };
  }
});
