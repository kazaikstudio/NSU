type DownloadAction = 'pause' | 'resume' | 'cancel';

type DownloadControlState = {
  paused: boolean;
  cancelled: boolean;
  resolveResume: (() => void) | null;
  onCancel: () => void;
};

const activeControls = new Map<string, DownloadControlState>();
let listenerInstalled = false;

function installControlListener() {
  if (listenerInstalled || typeof window === 'undefined') return;
  listenerInstalled = true;

  window.addEventListener('nsu-download-control', (event) => {
    const detail = (event as CustomEvent<{ title?: string; action?: DownloadAction }>).detail;
    if (detail?.title && detail.action) {
      controlClientDownload(detail.title, detail.action);
    }
  });
}

export function registerClientDownload(title: string, onCancel: () => void) {
  installControlListener();

  const state: DownloadControlState = {
    paused: false,
    cancelled: false,
    resolveResume: null,
    onCancel,
  };
  activeControls.set(title, state);

  return {
    isPaused: () => state.paused,
    isCancelled: () => state.cancelled,
    waitUntilResumed: () => {
      if (!state.paused || state.cancelled) return Promise.resolve();
      return new Promise<void>((resolve) => {
        state.resolveResume = resolve;
      });
    },
    unregister: () => {
      if (activeControls.get(title) === state) {
        activeControls.delete(title);
      }
      state.resolveResume?.();
      state.resolveResume = null;
    },
  };
}

export function controlClientDownload(title: string, action: DownloadAction) {
  const state = activeControls.get(title);
  if (!state) return;

  if (action === 'pause') {
    state.paused = true;
    return;
  }

  if (action === 'resume') {
    state.paused = false;
    state.resolveResume?.();
    state.resolveResume = null;
    return;
  }

  state.cancelled = true;
  state.paused = false;
  state.resolveResume?.();
  state.resolveResume = null;
  state.onCancel();
}
