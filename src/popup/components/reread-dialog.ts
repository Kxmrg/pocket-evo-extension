import { icon } from '../../ui/icons';
import { button, type Text } from '../../ui/markup';
export function createRereadDialog(root:HTMLElement,t:Text):{open():Promise<boolean>;dispose():void} {
  let settle:((value:boolean)=>void)|undefined;
  let dialog:HTMLDialogElement|undefined;
  let pending:Promise<boolean>|undefined;
  return {
    open(){
      if(pending)return pending;
      const focused=document.activeElement as HTMLElement|null;
      pending=new Promise<boolean>(resolve=>{
        dialog=document.createElement('dialog');dialog.className='confirm-dialog';
        dialog.setAttribute('aria-labelledby','refresh-title');dialog.setAttribute('aria-describedby','refresh-description');
        dialog.innerHTML=`<div class="dialog-content"><span class="dialog-icon">${icon('arrows-clockwise')}</span><h2 id="refresh-title">${t('refreshTitle')}</h2><p id="refresh-description">${t('refreshText')}</p><div class="dialog-actions">${button(t('cancel'),'cancel-refresh',undefined,'secondary')}${button(t('confirm'),'confirm-refresh')}</div></div>`;
        settle=value=>{if(!dialog)return;const node=dialog;dialog=undefined;settle=undefined;pending=undefined;node.remove();if(focused?.isConnected)focused.focus();resolve(value);};
        dialog.addEventListener('cancel',e=>{e.preventDefault();settle?.(false);});
        dialog.addEventListener('close',()=>settle?.(false));
        dialog.addEventListener('click',e=>{
          const action=(e.target as Element).closest<HTMLElement>('[data-action]')?.dataset.action;
          if(action==='confirm-refresh')settle?.(true);
          else if(action==='cancel-refresh'||e.target===dialog)settle?.(false);
        });
        root.append(dialog);dialog.showModal();dialog.querySelector<HTMLButtonElement>('[data-action=cancel-refresh]')?.focus();
      });
      return pending;
    },
    dispose(){settle?.(false);},
  };
}
