const spokes = Array.from({ length: 12 }, (_, index) => `<i style="--spoke:${index}"></i>`).join('');

export function spinner(): string {
  return `<span class="evo-spinner" aria-hidden="true">${spokes}</span>`;
}
