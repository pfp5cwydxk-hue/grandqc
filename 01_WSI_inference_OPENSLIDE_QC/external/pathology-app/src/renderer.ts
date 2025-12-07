/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';

type PathInsightAPI = {
  openSlide: () => Promise<{ canceled: true } | { canceled: false; filePath: string }>;
  startPipeline: (slidePath: string | null) => Promise<{
    ok: boolean;
    slidePath: string | null;
    startedAt: number;
    message: string;
  }>;
  openReport: (outputDir: string) => Promise<{ ok: boolean; message?: string }>;
  openPDF: (outputDir: string) => Promise<{ ok: boolean; message?: string }>;
};

declare global {
  interface Window {
    pathInsight?: PathInsightAPI;
  }
}

type StepStatus = 'ready' | 'research' | 'design' | 'planned';

type PipelineStep = {
  title: string;
  detail: string;
  status: StepStatus;
  hint?: string;
};

const statusLabel: Record<StepStatus, string> = {
  ready: 'klaar voor prototyping',
  research: 'researchbasis',
  design: 'designfase',
  planned: 'in planning',
};

const pipelineSteps: PipelineStep[] = [
  {
    title: '1. Tissue vs. achtergrond',
    detail:
      'Foreground-segmentatie om alleen weefsel te behouden en glasinformatie te filteren.',
    status: 'ready',
    hint: 'Kan starten met een lichtgewicht U-Net of traditionele kleurfiltering als baseline.',
  },
  {
    title: '2. Kwaliteitscontrole (HistoQC/GrandQC-achtig)',
    detail:
      'Automatische checks voor focus, kleurdrift, plooien en artefacten voordat analyses draaien.',
    status: 'research',
    hint: 'Gebruik tile-kwaliteitsscores en een samenvattende heatmap per slide.',
  },
  {
    title: '3. Tumorbed en stroma detectie',
    detail:
      'Contextuele segmentatie van tumorbed, stroma en overige compartimenten voor downstream analyses.',
    status: 'design',
  },
  {
    title: '4. Celtype segmentatie & classificatie',
    detail:
      'Instantie-segmentatie van nuclei met classificatie van tumorcellen, lymfocyten, macrofagen en stromale cellen.',
    status: 'design',
    hint: 'Combineer morfologie + micro-omgeving (infiltratiepatronen) voor meer robuuste labels.',
  },
  {
    title: '5. Rapportage & audit trail',
    detail:
      'Per stap een reproduceerbare samenvatting (PDF/HTML) met thumbnails, QC-scores en logboek.',
    status: 'planned',
  },
  {
    title: '6. Histoplus + Palga integratie',
    detail:
      'Gegenereerde rapporten koppelen aan het Palga-protocol voor mammarcarcinoom, met LLM + spraak om velden voor te vullen.',
    status: 'planned',
  },
];

const app = document.querySelector<HTMLDivElement>('#app');

// Define helpers outside the if block so they're accessible globally
let logList: HTMLUListElement | null = null;
let progressBar: HTMLDivElement | null = null;
let slideStatus: HTMLDivElement | null = null;

const pushLog = (line: string) => {
  if (!logList) return;
  const li = document.createElement('li');
  li.textContent = line;
  logList.appendChild(li);
  logList.scrollTop = logList.scrollHeight;
};

const setProgress = (pct: number) => {
  if (progressBar) {
    progressBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  }
};

const updateStatus = (text: string) => {
  if (slideStatus) {
    slideStatus.textContent = text;
  }
};

const resetLogs = () => {
  if (!logList) return;
  logList.innerHTML = '';
};

if (app) {
  let selectedSlidePath: string | null = null;
  let timers: number[] = [];

  const formatPath = (fullPath: string) => {
    const parts = fullPath.split(/[\\/]/);
    return parts.slice(-2).join('/');
  };

  const stepCards = pipelineSteps
    .map(
      (step) => `
        <article class="card">
          <div class="card-top">
            <h3>${step.title}</h3>
            <span class="badge badge-${step.status}">${statusLabel[step.status]}</span>
          </div>
          <p class="detail">${step.detail}</p>
          ${
            step.hint
              ? `<p class="hint">Tip: ${step.hint}</p>`
              : ''
          }
          <div class="actions">
            <button class="ghost">Instructie</button>
            <button class="primary">Markeer als klaar</button>
          </div>
        </article>
      `,
    )
    .join('');

  app.innerHTML = `
    <main class="layout">
      <header class="hero">
        <div class="hero-text">
          <p class="eyebrow">PathInsight · agentisch padologieplatform</p>
          <h1>Van WSI naar gestandaardiseerde verslaglegging</h1>
          <p class="lede">
            Volg het pad van weefselherkenning, QC, compartiment-detectie en celtype-classificatie.
            Resultaten worden klaargezet voor rapportage en automatische Palga-invulling.
          </p>
          <div class="cta-row">
            <button class="primary" data-action="load-wsi">Laad WSI</button>
            <button class="ghost" data-action="start-pipeline">Start pipeline</button>
            <span class="note">Alles draait lokaal · ontworpen voor ziekenhuisomgeving</span>
          </div>
          <div class="status-bubble" id="slide-status">Geen WSI geladen.</div>
        </div>
        <div class="hero-panel">
          <p class="panel-title">Case snapshot</p>
          <ul>
            <li><strong>Input</strong><span>WSI (SVS/NDPI)</span></li>
            <li><strong>Agent</strong><span>Detekt → QC → Segmentatie → Rapportage</span></li>
            <li><strong>Export</strong><span>HTML/PDF + Palga module</span></li>
          </ul>
          <div class="pill">Geen internet nodig · GPU optioneel</div>
        </div>
      </header>

      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Pipeline</p>
            <h2>Segmentatie en classificatie in logische stappen</h2>
          </div>
          <button class="ghost">Bekijk ontwerpnotities</button>
        </div>
        <div class="grid">
          ${stepCards}
        </div>
      </section>

      <section class="section two-col">
        <div class="panel">
          <p class="eyebrow">Rapportage</p>
          <h3>Overzicht & audit trail</h3>
          <ul class="checklist">
            <li>QC-heatmaps en tile-scores</li>
            <li>Tumorbed/stroma contouren + overlays</li>
            <li>Celtype tellingen en dichtheden</li>
            <li>Downloadbare rapporten (PDF/HTML)</li>
            <li>Logboek per stap voor reproduceerbaarheid</li>
          </ul>
        </div>
        <div class="panel">
          <p class="eyebrow">LLM & spraak</p>
          <h3>Palga protocol (mamma)</h3>
          <p class="detail">
            Gebruik de gegenereerde rapporten als context voor een lokaal draaiende LLM.
            Vul velden aan via spraakherkenning en valideer voordat het protocol wordt opgeslagen.
          </p>
          <div class="pill">Kernwoorden: consistentie-checks · validatie voor opslaan</div>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Dummy run</p>
            <h2>Pipeline simulatie (voor demo)</h2>
          </div>
        </div>
        <div class="run-box">
          <div class="progress">
            <div class="progress-bar" id="progress-bar" style="width: 0%"></div>
          </div>
          <ul class="log-list" id="log-list">
            <li>Geen pipeline gestart.</li>
          </ul>
        </div>
      </section>
    </main>
  `;

  slideStatus = document.querySelector<HTMLDivElement>('#slide-status');
  const loadButton = document.querySelector<HTMLButtonElement>('[data-action="load-wsi"]');
  const startButton = document.querySelector<HTMLButtonElement>('[data-action="start-pipeline"]');
  progressBar = document.querySelector<HTMLDivElement>('#progress-bar');
  logList = document.querySelector<HTMLUListElement>('#log-list');

  const clearTimers = () => {
    timers.forEach((id) => window.clearTimeout(id));
    timers = [];
  };

  const runDummyPipeline = () => {
    clearTimers();
    resetLogs();
    setProgress(0);
    pushLog('Pipeline gestart...');

    const steps = [
      { label: 'QC', message: 'QC-scores per tile en heatmap genereren...', duration: 800 },
      { label: 'Tissue mask', message: 'Weefselmasker maken (foreground/background)...', duration: 900 },
      { label: 'Tumorbed', message: 'Tumorbed en stroma contouren bepalen...', duration: 900 },
      { label: 'Celtype', message: 'Celdetectie en classificatie (tumor/lymfocyt/stroma)...', duration: 1100 },
      { label: 'Rapport', message: 'Samenvatting en rapport voorbereiden...', duration: 700 },
    ];

    const total = steps.reduce((sum, s) => sum + s.duration, 0);
    let elapsed = 0;

    steps.forEach((step, idx) => {
      const t = window.setTimeout(() => {
        elapsed += step.duration;
        pushLog(step.message);
        const pct = Math.round(((idx + 1) / steps.length) * 100);
        setProgress(pct);
        if (idx === steps.length - 1) {
          pushLog('Klaar. Rapport klaarzetten voor Palga/LLM.');
          startButton?.removeAttribute('disabled');
        }
      }, elapsed);
      timers.push(t);
    });
  };

  loadButton?.addEventListener('click', async () => {
    if (!window.pathInsight) {
      updateStatus('Geen preload-bridge gevonden.');
      return;
    }
    updateStatus('Dialoog openen...');
    const result = await window.pathInsight.openSlide();
    if (result.canceled) {
      updateStatus('Geen WSI geselecteerd.');
      return;
    }
    selectedSlidePath = result.filePath;
    updateStatus(`Geselecteerd: ${formatPath(result.filePath)}`);
  });

  startButton?.addEventListener('click', async () => {
    if (!window.pathInsight) {
      updateStatus('Geen preload-bridge gevonden.');
      return;
    }
    startButton.setAttribute('disabled', 'true');
    updateStatus('Pipeline starten...');
    const res = await window.pathInsight.startPipeline(selectedSlidePath);
    updateStatus(res.ok ? `Gestart voor: ${res.slidePath ?? 'n.v.t.'}` : 'Start mislukt.');
    runDummyPipeline();
  });
}

// Subscribe to logs and status from preload bridge
if (window.pathInsightEvents) {
  window.pathInsightEvents.onLog((line) => {
    pushLog(line);
  });
  window.pathInsightEvents.onStatus(async (status) => {
    pushLog(`STATUS: ${status.step} - ${status.msg}`);
    if (status.step === 'done' && status.outputDir) {
      // show viewer
      try {
        const out = status.outputDir as string;
        // list overlays and maps
        const mapsDir = `${out}/maps_qc`;
        const overlaysDir = `${out}/overlays_qc`;
        const thumbs = [] as string[];
        try {
          const resMaps = await (window as any).pathInsightFs.listDir(mapsDir);
          if (resMaps.ok) {
            resMaps.files.forEach((f: any) => thumbs.push(f.path));
          }
        } catch (e) {}
        try {
          const resOv = await (window as any).pathInsightFs.listDir(overlaysDir);
          if (resOv.ok) {
            resOv.files.forEach((f: any) => thumbs.push(f.path));
          }
        } catch (e) {}

        if (thumbs.length > 0) {
          // create viewer area
          const viewerId = 'pipeline-viewer';
          let viewer = document.getElementById(viewerId);
          if (!viewer) {
            viewer = document.createElement('div');
            viewer.id = viewerId;
            viewer.className = 'viewer';
            const container = document.querySelector('.run-box');
            container?.appendChild(viewer);
          }
          viewer.innerHTML = `<h4>Pipeline output</h4><div class="thumbs" id="thumbs"></div><div><button id="open-report" style="margin-right: 8px;">📄 Open Report</button><button id="open-pdf" style="margin-right: 8px;">📋 Open PDF</button><button id="open-output">📁 Open folder</button></div>`;
          const thumbsEl = document.getElementById('thumbs');
          thumbsEl!.innerHTML = '';
          thumbs.forEach((p) => {
            const img = document.createElement('img');
            img.src = `file://${p}`;
            img.width = 240;
            img.style.margin = '8px';
            thumbsEl!.appendChild(img);
          });

          const reportBtn = document.getElementById('open-report');
          reportBtn?.addEventListener('click', async () => {
            if (window.pathInsight) {
              const res = await window.pathInsight.openReport(status.outputDir);
              if (!res.ok) pushLog('Error opening report: ' + (res.message || 'unknown'));
            }
          });

          const pdfBtn = document.getElementById('open-pdf');
          pdfBtn?.addEventListener('click', async () => {
            if (window.pathInsight) {
              const res = await window.pathInsight.openPDF(status.outputDir);
              if (!res.ok) pushLog('Error opening PDF: ' + (res.message || 'unknown'));
            }
          });

          const openBtn = document.getElementById('open-output');
          openBtn?.addEventListener('click', () => {
            (window as any).pathInsightFs.openFolder(status.outputDir);
          });
        } else {
          pushLog('Geen gegenereerde afbeeldingen gevonden in output folder.');
        }
      } catch (err) {
        pushLog('Fout bij het laden van output: ' + String(err));
      }
    }
  });
}
