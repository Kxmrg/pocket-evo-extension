export interface FullscreenQrSession {
  text: string;
  siteName: string;
}

interface StoredFullscreenQrSession extends FullscreenQrSession {
  expiresAt: number;
}

interface OpenFullscreenQrServices {
  createId: () => string;
  set: (key: string, value: StoredFullscreenQrSession) => Promise<void>;
  remove: (key: string) => Promise<void>;
  open: (url: string) => Promise<unknown>;
  getUrl: (path: string) => string;
}

interface ConsumeFullscreenQrServices {
  get: (key: string) => Promise<unknown>;
  remove: (key: string) => Promise<void>;
}

const storageKey = (id: string) => `fullscreenQr:${id}`;
const transferLifetimeMs = 5 * 60 * 1_000;

export async function cleanupExpiredFullscreenQrSessions(): Promise<void> {
  const stored = await chrome.storage.session.get(null);
  const now = Date.now();
  const expiredKeys = Object.entries(stored)
    .filter(([key, value]) => key.startsWith('fullscreenQr:') && (!validSession(value) || value.expiresAt <= now))
    .map(([key]) => key);
  if (expiredKeys.length) await chrome.storage.session.remove(expiredKeys);
}

function defaultOpenServices(): OpenFullscreenQrServices {
  return {
    createId: () => crypto.randomUUID(),
    set: async (key, value) => {
      await cleanupExpiredFullscreenQrSessions();
      await chrome.storage.session.set({ [key]: value });
    },
    remove: async (key) => { await chrome.storage.session.remove(key); },
    open: async (url) => chrome.tabs.create({ url }),
    getUrl: (path) => chrome.runtime.getURL(path),
  };
}

function defaultConsumeServices(): ConsumeFullscreenQrServices {
  return {
    get: async (key) => (await chrome.storage.session.get(key))[key],
    remove: async (key) => { await chrome.storage.session.remove(key); },
  };
}

function validSession(value: unknown): value is StoredFullscreenQrSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredFullscreenQrSession>;
  return typeof candidate.text === 'string'
    && candidate.text.startsWith('pocket-evo://import/site?')
    && typeof candidate.siteName === 'string'
    && typeof candidate.expiresAt === 'number'
    && Number.isFinite(candidate.expiresAt);
}

export async function openFullscreenQr(
  session: FullscreenQrSession,
  services: OpenFullscreenQrServices = defaultOpenServices(),
): Promise<void> {
  const id = services.createId();
  const key = storageKey(id);
  await services.set(key, { ...session, expiresAt: Date.now() + transferLifetimeMs });
  try {
    await services.open(services.getUrl(`fullscreen.html#${id}`));
  } catch (error) {
    await services.remove(key);
    throw error;
  }
}

export async function consumeFullscreenQr(
  hash: string,
  services: ConsumeFullscreenQrServices = defaultConsumeServices(),
): Promise<FullscreenQrSession | null> {
  const id = hash.replace(/^#/, '');
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return null;
  const key = storageKey(id);
  const value = await services.get(key);
  await services.remove(key);
  return validSession(value) && value.expiresAt > Date.now()
    ? { text: value.text, siteName: value.siteName }
    : null;
}
