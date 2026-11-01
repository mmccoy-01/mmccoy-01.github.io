import './week-calendar.js';
import { rangeLabel } from './week-calendar.js';
import { escapeHtml as esc, safeUrl, areas, palette, filterRecords, selectGraphNodes, buildEdges } from './chemosciences-core.js';

const root=document.getElementById('chemo-dashboard');
const $=id=>root.querySelector(`#co-${id}`);
let runs=[], records=[], network=null, source='', snapshot=false, topic='all', map=null, activeTab='reading', requestId=0, mapRequestId=0;
const selectedWeek=()=>$('week').value;
const status=message=>{ $('status').textContent=message; };
async function json(url) { const response=await fetch(url,{cache:'no-cache'}); if(!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }
function chips(record) {
  return `${record.paper.preprint?'<span class="co-chip co-preprint">PREPRINT</span>':''}${record.analysis.concepts.filter(c=>c.kind==='domain').map(c=>`<span class="co-chip">${esc(c.label)}</span>`).join('')}`;
}
function detail(record) {
  const a=record.analysis;
  return `<details><summary>Why this score · matched concepts &amp; abstract</summary><div class="co-breakdown">${Object.entries(a.breakdown).map(([k,v])=>`<div>${esc(k==='method'?'Methods (all approaches)':k[0].toUpperCase()+k.slice(1))}<b>${v}</b></div>`).join('')}<div>Combination bonuses<b>${a.bonus_total}</b></div></div>${a.concepts.map(c=>`<p class="co-term"><strong>${esc(c.label)}</strong> +${c.points} · ${esc(c.terms.join(', '))}${c.title_match?' · title match':''}</p>`).join('')}${a.bonuses.map(b=>`<p class="co-term">Combination: ${esc(b.label)} +${b.points}</p>`).join('')}<p>${esc(a.assessment)} Category and bonus caps apply; repeated words do not increase a score.</p><div class="co-abstract">${esc(record.paper.abstract||'No abstract supplied by PubMed.')}</div><p>${esc((record.paper.authors||[]).join(', '))}</p><button type="button" class="co-text-button" data-ris="${esc(record.paper.pmid)}">Export to Zotero / RIS</button></details>`;
}
function digestCard(record,index) {
  const p=record.paper,a=record.analysis;
  return `<article class="co-card" id="digest-${esc(p.pmid)}"><div class="co-card-top"><span class="co-number">${String(index+1).padStart(2,'0')}</span><span class="co-score"><b>${a.score}</b> / 100</span></div><div class="co-chips">${chips(record)}</div><h3><a href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener noreferrer">${esc(p.title)}</a></h3><p class="co-meta">${esc(p.journal)} · ${esc(p.pubdate)}</p><p class="co-why">${esc(a.why)}</p><div class="co-card-bottom"><a href="#paper-${esc(p.pmid)}">Abstract &amp; score ↓</a><button type="button" class="co-text-button" data-explore="${esc(p.pmid)}">Explore connections ↗</button></div></article>`;
}
function paperCard(record) {
  const p=record.paper;
  return `<article class="co-paper" id="paper-${esc(p.pmid)}"><div class="co-paper-heading"><div><h3><a href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener noreferrer">${esc(p.title)}</a></h3><p class="co-meta">${esc(p.journal)} · ${esc(p.pubdate)} · ${esc((p.authors||[]).slice(0,3).join(', '))}</p></div><span class="co-score"><b>${record.analysis.score}</b><br>/ 100</span></div><div class="co-chips">${chips(record)}${record.editor_pick?'<span class="co-chip">EDITOR’S DIGEST</span>':''}</div><p class="co-why">${esc(record.analysis.why)}</p>${detail(record)}</article>`;
}
function render() {
  const filtered=filterRecords(records,topic,$('search').value,$('archive').checked);
  const picks=filterRecords(records,topic,$('search').value,false).filter(r=>r.editor_pick).sort((a,b)=>a.editor_order-b.editor_order);
  $('digest').innerHTML=picks.map(digestCard).join('')||'<p class="co-empty">No digest picks match these filters. Try another topic or search.</p>';
  $('papers').innerHTML=filtered.map(paperCard).join('')||'<p class="co-empty">No papers match these filters.</p>';
  const eligible=records.filter(r=>r.analysis.eligible).length;
  $('count').textContent=`${records.filter(r=>r.reading_list).length} reading picks · ${eligible} matched candidates · ${records.length} screened`;
  $('topics').innerHTML=[['all','All connections'],...areas.filter(([id])=>records.some(r=>r.analysis.concepts.some(c=>c.id===id)))].map(([id,label])=>`<button type="button" class="co-topic" data-topic="${id}" aria-pressed="${topic===id}">${label}</button>`).join('');
  if(activeTab==='map') renderMap();
}
async function loadWeek(id) {
  const ticket=++requestId;
  status('Loading this search window…');
  try {
    const run=runs.find(r=>r.id===id);
    const data=await json(`${source}/${run.path}`);
    if(ticket!==requestId) return;
    records=data.records;
    status(`${snapshot?'Saved snapshot · Live updates unavailable. ':''}${rangeLabel(run)} · PubMed entry dates · Updated ${data.generated_at.slice(0,10)}`);
    render();
  } catch(error) { if(ticket===requestId) status(`This week could not be loaded (${error.message}). Choose another week or reload to retry.`); }
}
function mapWeeks() {
  if($('map-range').value==='all') return runs.map(r=>r.id);
  if($('map-range').value==='custom') return [...$('map-weeks').querySelectorAll('input:checked')].map(i=>i.value);
  return [selectedWeek()];
}
async function renderMap() {
  const ticket=++mapRequestId;
  $('map-status').textContent='Opening the connection map…';
  try {
    const graph=await import('./chemosciences-graph.js');
    if(!network) network=await json(`${source}/network.json`);
    if(activeTab!=='map'||ticket!==mapRequestId) return;
    const layer=$('map-layer').value;
    const selection=selectGraphNodes(network.nodes,mapWeeks(),$('map-archive').checked,topic,$('search').value,$('map-neighbors').checked,layer);
    const edges=buildEdges(selection.nodes,layer);
    map?.destroy();
    map=graph.mountGraph($('network'),selection.nodes,edges,inspect);
    $('inspector').innerHTML='<span class="co-eyebrow">LOOK CLOSER</span><h3>Choose a paper</h3><p>Drag to explore. Scroll to zoom. Select a node to inspect its connections.</p><p>Lines show shared concepts or author names, not citations.</p>';
    $('map-status').textContent=`${selection.nodes.length} papers · ${edges.length} ${layer==='author'?'author-overlap':'shared-biology'} links.${selection.total>200?` Showing 200 of ${selection.total}; narrow the weeks or topics to see others.`:''} ${$('map-neighbors').checked?'Faint nodes are earlier connections.':''} Links indicate similarity, not citations.`;
    $('map-accessible').innerHTML=`<p>${areas.map(([id,label])=>`<span style="color:${palette[id]};margin-right:14px">● ${label}</span>`).join('')}<span>Outlined: editor’s digest</span></p><details><summary>Browse the ${selection.nodes.length} visible papers as a list</summary>${selection.nodes.map(n=>`<button type="button" data-node="${esc(n.id)}">${esc(n.title)}</button>`).join('')}</details>`;
    if(!selection.nodes.length) $('inspector').innerHTML='<h3>No matching papers</h3><p>Choose a week or clear a filter to explore.</p>';
    if(root.dataset.focus) { const id=root.dataset.focus; delete root.dataset.focus; map.select(id); }
  } catch(error) { if(ticket===mapRequestId) $('map-status').textContent=`The map could not load (${error.message}). The reading room is still available.`; }
}
function inspect(node,neighbors) {
  $('inspector').innerHTML=`<p class="co-eyebrow">${node.context?'EARLIER CONNECTION':'SELECTED PAPER'}</p><h3><a href="${esc(safeUrl(node.url))}" target="_blank" rel="noopener noreferrer">${esc(node.title)}</a></h3><p>${esc(node.journal)}${node.preprint?' · PREPRINT':''} · Signal ${node.score}/100</p><p>${esc(node.why)}</p><p>${neighbors.length?`Connected through ${$('map-layer').value==='author'?'matching author names':'shared concepts'}:`:'No displayed links meet the current connection criteria.'}</p>${neighbors.map(({node:n,edge:e})=>`<button type="button" data-node="${esc(n.id)}">${esc(n.title)}<span>${esc(e.shared.map(c=>c.label).join(' · '))}</span></button>`).join('')}<p class="co-caption">Shared concepts suggest reading connections; they do not establish equivalent cells or mechanisms.${$('map-layer').value==='author'?' Author names can be ambiguous; this is not identity disambiguation.':''}</p>`;
}
async function tab(name) {
  activeTab=name;
  for(const id of ['reading','map']) {
    $(id).hidden=id!==name;
    $(`${id}-tab`).setAttribute('aria-selected',String(id===name));
    $(`${id}-tab`).tabIndex=id===name?0:-1;
  }
  if(name==='map') await renderMap();
}
$('reading-tab').addEventListener('click',()=>tab('reading'));
$('map-tab').addEventListener('click',()=>tab('map'));
root.querySelector('.co-tabs').addEventListener('keydown',event=>{
  if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) { event.preventDefault(); const name=event.key==='Home'?'reading':event.key==='End'?'map':activeTab==='reading'?'map':'reading'; tab(name); $(`${name}-tab`).focus(); }
});
$('week').addEventListener('change',()=>loadWeek(selectedWeek()));
$('search').addEventListener('input',render);
$('archive').addEventListener('change',render);
$('topics').addEventListener('click',event=>{ const button=event.target.closest('[data-topic]'); if(button) { topic=button.dataset.topic; render(); $('topics').querySelector(`[data-topic="${topic}"]`)?.focus(); } });
$('reset').addEventListener('click',()=>{ topic='all'; $('search').value=''; $('archive').checked=false; render(); });
for(const id of ['map-layer','map-archive','map-neighbors']) $(id).addEventListener('change',renderMap);
$('map-range').addEventListener('change',()=>{ $('map-weeks').hidden=$('map-range').value!=='custom'; renderMap(); });
$('map-weeks').addEventListener('change',renderMap);
$('map-reset').addEventListener('click',()=>map?.reset());
root.addEventListener('click',async event=>{
  const explore=event.target.closest('[data-explore]');
  if(explore) { root.dataset.focus=explore.dataset.explore; await tab('map'); $('map').scrollIntoView({block:'start'}); }
  const node=event.target.closest('[data-node]'); if(node) map?.select(node.dataset.node);
  const ris=event.target.closest('[data-ris]');
  if(ris) {
    const p=records.find(r=>r.paper.pmid===ris.dataset.ris)?.paper; if(!p) return;
    const lines=['TY  - JOUR',`TI  - ${p.title}`,...(p.authors||[]).map(a=>`AU  - ${a}`),`JO  - ${p.journal}`,`PY  - ${p.pubdate}`,`DO  - ${p.doi}`,`UR  - ${p.url}`,`AB  - ${p.abstract.replace(/\s+/g,' ')}`,'ER  - '];
    const url=URL.createObjectURL(new Blob([lines.join('\r\n')],{type:'application/x-research-info-systems'}));
    const a=document.createElement('a'); a.href=url; a.download=`${p.pmid}.ris`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
});
try {
  let index;
  try { source=root.dataset.source; index=await json(`${source}/index.json`); }
  catch { source=root.dataset.fallback; index=await json(`${source}/index.json`); snapshot=true; }
  runs=index.runs;
  if(!runs.length) throw new Error('No completed searches yet');
  $('week').runs=runs; $('week').value=runs[0].id;
  $('map-weeks').innerHTML=runs.map((r,i)=>`<label class="co-check"><input type="checkbox" value="${esc(r.id)}" ${i===0?'checked':''}> ${esc(rangeLabel(r))}</label>`).join('');
  await loadWeek(runs[0].id);
} catch(error) { status(`The observatory could not load (${error.message}). Reload to retry.`); }
