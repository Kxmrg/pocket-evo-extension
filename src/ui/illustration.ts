interface Animation {
  play(): void;
  pause(): void;
  goToAndStop(value: number, isFrame: boolean): void;
  addEventListener(name: 'DOMLoaded', handler: () => void): void;
  removeEventListener(name: 'DOMLoaded', handler: () => void): void;
  destroy(): void;
}

interface LottieWindow extends Window {
  lottie?: {
    loadAnimation(options: {
      container: HTMLElement;
      renderer: 'svg';
      autoplay: boolean;
      loop: boolean;
      path: string;
    }): Animation;
  };
}

export function mountIllustration(container: HTMLElement): () => void {
  container.setAttribute('aria-hidden', 'true');
  const document = container.ownerDocument;
  const view: LottieWindow | null = document.defaultView;
  if (!view?.lottie) return () => {};

  let animation: Animation;
  try {
    animation = view.lottie.loadAnimation({
      container,
      renderer: 'svg',
      autoplay: false,
      loop: true,
      path: '/animations/astronaut_light_theme.json',
    });
  } catch {
    return () => {};
  }

  const motion = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  let intersecting = typeof IntersectionObserver === 'undefined';
  let disposed = false;
  function updatePlayback() {
    if (disposed) return;
    if (motion?.matches) animation.goToAndStop(0, true);
    else if (document.hidden || !intersecting) animation.pause();
    else animation.play();
  }

  const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver((entries) => {
    intersecting = entries.some((entry) => entry.target === container && entry.isIntersecting);
    updatePlayback();
  });
  observer?.observe(container);
  motion?.addEventListener?.('change', updatePlayback);
  document.addEventListener('visibilitychange', updatePlayback);
  animation.addEventListener('DOMLoaded', updatePlayback);
  updatePlayback();

  return () => {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    motion?.removeEventListener?.('change', updatePlayback);
    document.removeEventListener('visibilitychange', updatePlayback);
    animation.removeEventListener('DOMLoaded', updatePlayback);
    animation.destroy();
  };
}
