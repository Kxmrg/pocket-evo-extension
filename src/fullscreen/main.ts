import { consumeFullscreenQr, type FullscreenQrSession } from '../browser/fullscreen-qr';
import { mountIllustration } from '../ui/illustration';
import { createText, resolveLocale } from '../ui/locales';
import { drawQrCanvas } from '../ui/qr-canvas';
import { fullscreenErrorView, fullscreenQrView } from './view';
import '../ui/tokens.css';
import '../ui/controls.css';
import './styles.css';

const rootElement = document.querySelector<HTMLElement>('#fullscreen-app');
if (!rootElement) throw new Error('Fullscreen QR root is missing');
const root: HTMLElement = rootElement;
const locale = resolveLocale(navigator.languages);
const t = createText(locale);
document.documentElement.lang = locale;
document.title = t('qrLabel');

let session: FullscreenQrSession | null = null;
let disposeArt: (() => void) | undefined;
let resizeTimer: number | undefined;
let drawVersion = 0;
let disposed = false;

function showError(expired = false): void {
  session = null;
  disposeArt?.();
  root.innerHTML = fullscreenErrorView(t, expired);
  const art = root.querySelector<HTMLElement>('.astronaut');
  disposeArt = art ? mountIllustration(art) : undefined;
}

function qrSize(slot: HTMLElement): number {
  const width = slot.clientWidth || window.innerWidth - 48;
  const height = slot.clientHeight || window.innerHeight - 176;
  return Math.max(1, Math.min(width, height, 360));
}

async function draw(version: number): Promise<void> {
  if (disposed || version !== drawVersion || !session) return;
  const slot = root.querySelector<HTMLElement>('[data-canvas-slot]');
  if (!slot) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'fullscreen-qr';
  canvas.setAttribute('aria-label', t('qrLabel'));
  canvas.setAttribute('role', 'img');
  try {
    await drawQrCanvas(canvas, session.text, qrSize(slot));
    if (disposed || version !== drawVersion) return;
    // The QR library sets inline dimensions. Let the slot constrain the rendered square.
    canvas.style.removeProperty('width');
    canvas.style.removeProperty('height');
    slot.replaceChildren(canvas);
    slot.removeAttribute('aria-busy');
  } catch {
    if (!disposed && version === drawVersion) showError();
  }
}

async function start(): Promise<void> {
  try {
    const data = await consumeFullscreenQr(window.location.hash);
    if (disposed) return;
    if (!data) {
      showError(true);
      return;
    }
    session = data;
    root.innerHTML = fullscreenQrView(t, data.siteName);
    await draw(++drawVersion);
  } catch {
    if (!disposed) showError();
  }
}

function scheduleDraw(): void {
  if (!session) return;
  const version = ++drawVersion;
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => { void draw(version); }, 100);
}

function dispose(): void {
  disposed = true;
  session = null;
  window.clearTimeout(resizeTimer);
  window.removeEventListener('resize', scheduleDraw);
  disposeArt?.();
  disposeArt = undefined;
  root.replaceChildren();
}

window.addEventListener('resize', scheduleDraw);
window.addEventListener('pagehide', dispose, { once: true });
void start();
