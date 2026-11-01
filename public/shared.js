export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money=c=>new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR',maximumFractionDigits:c%100?2:0}).format(c/100);
export async function api(path,body){const res=await fetch(path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await res.json();if(!res.ok){const e=new Error(data.error||'Something went wrong.');e.status=res.status;throw e;}return data;}
export function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>el.classList.remove('show'),4000);}
export function openDialog(dialog){if(!dialog.open)dialog.showModal();}
export function bindClose(dialog){dialog.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>dialog.close()));dialog.onclick=e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}};}
export const closeButton='<button class="icon-button close" data-close aria-label="Close">×</button>';
export const date=v=>new Date(v).toLocaleString('en-MY',{dateStyle:'medium',timeStyle:'short'});
