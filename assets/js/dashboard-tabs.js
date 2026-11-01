const names=['phd','chemosciences'];
const tabs={phd:document.getElementById('phd-research-tab'),chemosciences:document.getElementById('chemosciences-research-tab')};
const panels={phd:document.getElementById('phd-research-panel'),chemosciences:document.getElementById('chemosciences-research-panel')};
let loading=null;
async function loadChemosciences() {
  if(loading) return loading;
  loading=(async()=>{
    const panel=panels.chemosciences;
    const response=await fetch(panel.dataset.panelUrl);
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    panel.innerHTML=await response.text();
    await import('./chemosciences.js');
  })().catch(()=>{
    loading=null;
    panels.chemosciences.innerHTML='<p class="research-dashboard-loading" role="status">Chemosciences could not load. <button type="button">Try again</button></p>';
    panels.chemosciences.querySelector('button').addEventListener('click',loadChemosciences);
  });
  return loading;
}
function select(name,updateUrl=true) {
  for(const key of names) {
    const active=key===name;
    panels[key].hidden=!active;
    tabs[key].setAttribute('aria-selected',String(active));
    tabs[key].tabIndex=active?0:-1;
  }
  if(updateUrl) history.replaceState(null,'',name==='chemosciences'?'#chemosciences':location.pathname+location.search);
  if(name==='chemosciences') loadChemosciences();
}
for(const name of names) tabs[name].addEventListener('click',()=>select(name));
document.querySelector('.research-dashboard-tabs').addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  event.preventDefault();
  const name=event.key==='Home'?'phd':event.key==='End'?'chemosciences':tabs.phd.getAttribute('aria-selected')==='true'?'chemosciences':'phd';
  select(name);tabs[name].focus();
});
window.addEventListener('hashchange',()=>{if(location.hash==='#chemosciences'||location.hash==='#phd'||!location.hash)select(location.hash==='#chemosciences'?'chemosciences':'phd',false);});
select(location.hash==='#chemosciences'?'chemosciences':'phd',false);
