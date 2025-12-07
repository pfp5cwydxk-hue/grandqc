import { contextBridge, ipcRenderer } from 'electron';

type SlideOpenResult =
  | { canceled: true }
  | { canceled: false; filePath: string };

type PipelineStartResult = {
  ok: boolean;
  slidePath: string | null;
  startedAt: number;
  message: string;
};

const api = {
  openSlide: async (): Promise<SlideOpenResult> =>
    ipcRenderer.invoke('pathInsight:open-slide'),
  startPipeline: async (slidePath: string | null): Promise<PipelineStartResult> =>
    ipcRenderer.invoke('pathInsight:start-pipeline', { slidePath }),
  openReport: async (outputDir: string): Promise<{ ok: boolean; message?: string }> =>
    ipcRenderer.invoke('pathInsight:open-report', outputDir),
  openPDF: async (outputDir: string): Promise<{ ok: boolean; message?: string }> =>
    ipcRenderer.invoke('pathInsight:open-pdf', outputDir),
};

contextBridge.exposeInMainWorld('pathInsight', api);

// allow renderer to subscribe to pipeline logs and events
contextBridge.exposeInMainWorld('pathInsightEvents', {
  onLog: (cb: (line: string) => void) => {
    ipcRenderer.on('pathInsight:log', (_e, line) => cb(line));
  },
  onStatus: (cb: (status: any) => void) => {
    ipcRenderer.on('pathInsight:status', (_e, status) => cb(status));
  },
});

// Additional helpers to list files in output dir and open folder in OS
contextBridge.exposeInMainWorld('pathInsightFs', {
  listDir: async (dirPath: string) => ipcRenderer.invoke('pathInsight:list-output', dirPath),
  openFolder: async (dirPath: string) => ipcRenderer.invoke('pathInsight:open-output', dirPath),
});

declare global {
  interface Window {
    pathInsight: typeof api;
  }
}
