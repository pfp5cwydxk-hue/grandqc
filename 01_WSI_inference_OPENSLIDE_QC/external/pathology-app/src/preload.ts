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
};

contextBridge.exposeInMainWorld('pathInsight', api);

declare global {
  interface Window {
    pathInsight: typeof api;
  }
}
