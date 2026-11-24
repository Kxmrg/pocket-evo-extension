import type { ArchitectureId } from '../domain/types';
import type { PopupActions } from './state';

export function bindPopup(root:HTMLElement, getActions:()=>PopupActions, locate:()=>void, blur:(id:string)=>void):()=>void {
  const abort = new AbortController();
  const options = {signal:abort.signal};
  const trigger=()=>root.querySelector<HTMLButtonElement>('[data-architecture-trigger]');
  const menu=()=>root.querySelector<HTMLElement>('[data-architecture-menu]');
  const close=()=>{const m=menu();if(m)m.hidden=true;trigger()?.setAttribute('aria-expanded','false');};
  const open=(last=false)=>{const m=menu();if(!m)return;m.hidden=false;trigger()?.setAttribute('aria-expanded','true');const items=[...m.querySelectorAll<HTMLButtonElement>('[role=option]')];(last?items.at(-1):items.find(item=>item.getAttribute('aria-selected')==='true')??items[0])?.focus();};
  root.addEventListener('click',event=>{
    const target=(event.target as Element).closest<HTMLButtonElement>('button');
    if(!target||target.disabled||!root.contains(target))return;
    const a=getActions();
    if(target.hasAttribute('data-architecture-trigger')){menu()?.hidden?open():close();return;}
    if(target.dataset.architectureOption){close();a.onArchitectureChange(target.dataset.architectureOption as ArchitectureId);trigger()?.focus();return;}
    if(target.dataset.reveal){a.onToggleCredential(target.dataset.reveal);return;}
    if(target.dataset.tagToggle){a.onTagToggle(target.dataset.tagToggle);return;}
    if(target.dataset.pageRemove!==undefined){const index=Number(target.dataset.pageRemove);a.onPageRemove(index);const remaining=[...root.querySelectorAll<HTMLButtonElement>('[data-page-remove]')];(remaining[Math.min(index,remaining.length-1)]??root.querySelector<HTMLButtonElement>('[data-action=add-manual-page]'))?.focus();return;}
    const actions:Record<string,()=>void>={read:a.onRead,refresh:a.onRefresh,permission:a.onRequestPermission,retry:a.onRetry,generate:a.onGenerate,fullscreen:a.onFullscreen,back:a.onBack,'add-current-page':a.onPageAddCurrent,'add-manual-page':a.onPageAddManual,locate};
    const action=target.dataset.action;if(action)actions[action]?.();
  },options);
  const update=(event:Event)=>{
    if(!(event.target instanceof HTMLInputElement))return;
    const input=event.target, a=getActions();
    if(input.dataset.field)a.onFieldChange(input.dataset.field,input.type==='checkbox'?input.checked:input.value);
    else if(input.dataset.pageIndex!==undefined&&(input.dataset.pageField==='name'||input.dataset.pageField==='path'))a.onPageChange(Number(input.dataset.pageIndex),input.dataset.pageField,input.value);
  };
  root.addEventListener('input',update,options);
  root.addEventListener('change',update,options);
  root.addEventListener('submit',e=>e.preventDefault(),options);
  root.addEventListener('focusout',e=>{
    if(e.target instanceof HTMLInputElement)blur(e.target.id);
    const control=root.querySelector('.select-control');
    if(control?.contains(e.target as Node)&&!control.contains(e.relatedTarget as Node|null))close();
  },options);
  root.addEventListener('pointerdown',e=>{if(!root.querySelector('.select-control')?.contains(e.target as Node))close();},options);
  root.addEventListener('keydown',e=>{
    const control=root.querySelector('.select-control');if(!control?.contains(e.target as Node))return;
    if(e.key==='Escape'){e.preventDefault();close();trigger()?.focus();return;}
    if(e.target===trigger()&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();open(e.key==='ArrowUp');return;}
    const m=menu();if(!m||m.hidden)return;
    const items=[...m.querySelectorAll<HTMLButtonElement>('[role=option]')],i=items.indexOf(document.activeElement as HTMLButtonElement);
    const next=e.key==='Home'?0:e.key==='End'?items.length-1:e.key==='ArrowDown'?(i+1)%items.length:e.key==='ArrowUp'?(i+items.length-1)%items.length:-1;
    if(next>=0){e.preventDefault();items[next]?.focus();}
  },options);
  return ()=>abort.abort();
}
