export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
export const safeUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : '#'; } catch { return '#'; } };
export const areas = [ ['taste','Taste'], ['smell','Smell'], ['chemesthesis','Chemesthesis'], ['distributed','Distributed sensing'], ['internal','Internal sensing'], ['oral_bridge','Oral & dental'] ];
export const palette = { taste:'#ecc48d', smell:'#b4a2dd', chemesthesis:'#e6a598', distributed:'#99d2b8', internal:'#91c6dc', oral_bridge:'#d3c990' };
export function topicOf(node) { return node.concepts.find(c => c.kind === 'domain')?.id || 'distributed'; }
export function filterRecords(records, topic, text, archive = false) {
  const query = text.trim().toLowerCase();
  return records.filter(r => (archive ? r.analysis.eligible : r.reading_list) &&
    (topic === 'all' || r.analysis.concepts.some(c => c.id === topic)) &&
    (!query || [r.paper.title,r.paper.abstract,r.paper.journal,...(r.paper.authors || []),...r.analysis.concepts.map(c => c.label)].join(' ').toLowerCase().includes(query)));
}
export function buildEdges(nodes, layer = 'concept') {
  const buckets = new Map();
  for (const n of nodes) {
    const values = layer === 'author' ? [...new Set(n.authors.filter(a => a.trim().split(/\s+/).length > 1))].map(a => ({ id:a, label:a, specific:true })) : n.concepts.filter(c => c.linkable).map(c => ({ ...c, specific:c.kind === 'mechanism' }));
    for (const c of values) {
      if (!buckets.has(c.id)) buckets.set(c.id, { label:c.label, specific:c.specific, nodes:[] });
      buckets.get(c.id).nodes.push(n.id);
    }
  }
  const pairs = new Map();
  for (const [concept, b] of buckets) {
    for (let i=0;i<b.nodes.length;i++) for (let j=i+1;j<b.nodes.length;j++) {
      const key = [b.nodes[i], b.nodes[j]].sort().join(':');
      if (!pairs.has(key)) pairs.set(key,{ source:b.nodes[i], target:b.nodes[j], shared:[], weight:0, specific:false });
      const p = pairs.get(key); p.shared.push({ id:concept, label:b.label });
      p.weight += Math.log(1 + nodes.length / b.nodes.length);
      p.specific ||= b.specific && b.nodes.length <= Math.max(2,nodes.length*.4);
    }
  }
  const eligible = [...pairs.values()].filter(p => layer === 'author' || p.shared.length >= 2 || p.specific).sort((a,b) => b.weight-a.weight);
  // Keep the map legible as its archive grows: at most six strongest links per node.
  const degree = new Map();
  return eligible.filter(e => {
    if ((degree.get(e.source)||0)>=6 || (degree.get(e.target)||0)>=6) return false;
    degree.set(e.source,(degree.get(e.source)||0)+1); degree.set(e.target,(degree.get(e.target)||0)+1); return true;
  });
}
export function selectGraphNodes(nodes, weeks, archive, topic, query, older, layer) {
  const weekSet = new Set(weeks);
  const q = query.trim().toLowerCase();
  const matches = n => (topic==='all'||n.concepts.some(c=>c.id===topic)) && (!q||[n.title,n.journal,...n.authors,...n.concepts.map(c=>c.label)].join(' ').toLowerCase().includes(q));
  const base = nodes.filter(n => (archive?n.weeks:n.selected_weeks).some(w=>weekSet.has(w)) && matches(n));
  const primary = new Set(base.map(n=>n.id));
  const pool = older ? nodes.filter(n => matches(n) && (archive || n.selected_weeks.length) && n.weeks.some(w => w <= [...weekSet].sort().at(-1))) : base;
  let result = base;
  if (older) {
    const linked = new Set(buildEdges(pool.slice(0,500),layer).filter(e=>primary.has(e.source)||primary.has(e.target)).flatMap(e=>[e.source,e.target]));
    result = pool.filter(n=>primary.has(n.id)||linked.has(n.id));
  }
  const sorted = result.slice().sort((a,b)=>Number(primary.has(b.id))-Number(primary.has(a.id))||b.score-a.score||a.id.localeCompare(b.id));
  return { nodes:sorted.slice(0,200).map(n=>({...n,context:!primary.has(n.id)})), total:sorted.length, primary };
}
