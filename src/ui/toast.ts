export function createToast(root: HTMLElement): { show(message: string): void; dispose(): void } {
  const node = root.ownerDocument.createElement('div');
  node.className = 'evo-toast';
  node.setAttribute('role', 'status');
  node.setAttribute('aria-atomic', 'true');
  root.append(node);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  return {
    show(message) {
      if (disposed || !message) return;
      if (node.textContent !== message) node.textContent = message;
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        node.textContent = '';
      }, 3000);
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      timer = undefined;
      node.remove();
    },
  };
}
