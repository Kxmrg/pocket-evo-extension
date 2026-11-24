import type { ArchitectureId } from '../../domain/types';
import { icon } from '../../ui/icons';
import { esc, type Text } from '../../ui/markup';
const names: Partial<Record<ArchitectureId,string>> = {nexusphp:'NexusPHP',gazelle:'Gazelle',unit3d:'UNIT3D',btitracker:'BtiTracker'};
export const architectureName = (id: ArchitectureId, t: Text): string => names[id] ?? t(id === 'unknown' ? 'unknown' : 'independent');
export const architectureCategory = (id: ArchitectureId): ArchitectureId => names[id] || id === 'unknown' ? id : 'api';
export function architectureSelect(id: ArchitectureId, t: Text): string {
  const category = architectureCategory(id);
  const options: [ArchitectureId,string][] = [...(id === 'unknown' ? [['unknown','—'] as [ArchitectureId,string]] : []), ['nexusphp','NP'],['gazelle','GZ'],['unit3d','U3D'],['btitracker','BT'],['api','API']];
  return `<div class="field"><div class="field-label"><label id="architecture-label">${t('architecture')}<span class="required" aria-hidden="true"> *</span></label></div><div class="select-control"><button type="button" id="architecture" class="select-trigger" data-architecture-trigger aria-haspopup="listbox" aria-expanded="false" aria-labelledby="architecture-label architecture-value" aria-describedby="error-architecture"><span id="architecture-value">${esc(architectureName(id,t))}</span>${icon('caret-down')}</button><div class="select-menu" data-architecture-menu role="listbox" aria-labelledby="architecture-label" hidden>${options.map(([value,abbr]) => `<button type="button" role="option" tabindex="-1" data-architecture-option="${value}" aria-selected="${category === value}"><span class="architecture-monogram">${abbr}</span><span>${esc(architectureName(value,t))}</span>${category === value ? icon('check') : ''}</button>`).join('')}</div></div><span class="sr-only" id="error-architecture" data-field-error="architecture"></span></div>`;
}
