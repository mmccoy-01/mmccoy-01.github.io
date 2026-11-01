import { palette, topicOf } from './chemosciences-core.js';
const NS='http://www.w3.org/2000/svg';
function element(tag,attrs={}) { const e=document.createElementNS(NS,tag); for(const [k,v] of Object.entries(attrs)) e.setAttribute(k,v); return e; }
export function mountGraph(container,data,edges,onSelect) {
  const width=800,height=570;
  const nodes=data.map((n,i)=>({...n,x:width/2+Math.cos(i*2.39996)*Math.sqrt(i+1)*30,y:height/2+Math.sin(i*2.39996)*Math.sqrt(i+1)*24,vx:0,vy:0}));
  const byId=new Map(nodes.map(n=>[n.id,n]));
  const links=edges.map(e=>({...e,a:byId.get(e.source),b:byId.get(e.target)}));
  // Settles once; no perpetual animation or background CPU usage.
  for(let step=0;step<160;step++) {
    const cooling=1-step/170;
    for(let i=0;i<nodes.length;i++) {
      const a=nodes[i]; a.vx+=(width/2-a.x)*.0015; a.vy+=(height/2-a.y)*.0015;
      for(let j=i+1;j<nodes.length;j++) {
        const b=nodes[j],dx=a.x-b.x,dy=a.y-b.y,d2=dx*dx+dy*dy+40;
        const force=130/d2;
        a.vx+=dx*force; a.vy+=dy*force; b.vx-=dx*force; b.vy-=dy*force;
      }
    }
    for(const e of links) {
      const dx=e.b.x-e.a.x,dy=e.b.y-e.a.y,d=Math.hypot(dx,dy)||1,f=(d-95)*.005;
      e.a.vx+=dx/d*f; e.a.vy+=dy/d*f; e.b.vx-=dx/d*f; e.b.vy-=dy/d*f;
    }
    for(const n of nodes) { n.vx*=.65; n.vy*=.65; n.x+=n.vx*cooling; n.y+=n.vy*cooling; }
  }
  const svg=element('svg',{viewBox:`0 0 ${width} ${height}`,role:'group','aria-label':'Research connection network. Papers are also available in the list below.'});
  const scene=element('g'); svg.append(scene);
  container.replaceChildren(svg);
  let zoom=1,panX=0,panY=0,active=null,gesture=null,moved=false;
  const lineEls=links.map(e=>{
    const line=element('line',{stroke:'#8dbfaf','stroke-opacity':'.2','stroke-width':Math.min(2,.5+e.shared.length*.2)});
    const title=element('title'); title.textContent=e.shared.map(c=>c.label).join(' · '); line.append(title); scene.append(line); return line;
  });
  const nodeEls=nodes.map(n=>{
    const g=element('g',{tabindex:'0',role:'button','aria-label':n.title,'data-id':n.id,cursor:'pointer'});
    const circle=element('circle',{r:6,fill:palette[topicOf(n)]||'#b1e4ce',stroke:n.editor_weeks.length?'#fff2c5':'#102126','stroke-width':n.editor_weeks.length?2:1});
    const title=element('title'); title.textContent=n.title+(n.preprint?' · PREPRINT':''); circle.append(title); g.append(circle);
    const label=element('text',{x:12,y:4,fill:'#e2eee5','font-size':11,'pointer-events':'none',display:'none'});label.textContent=n.title.slice(0,48)+(n.title.length>48?'…':'');g.append(label);
    g.addEventListener('keydown',event=>{ if(event.key==='Enter'||event.key===' ') {event.preventDefault();select(n.id);} });
    g.addEventListener('pointerdown',event=>{event.stopPropagation();moved=false;gesture={node:n,startX:event.clientX,startY:event.clientY};svg.setPointerCapture(event.pointerId);});
    scene.append(g); return g;
  });
  function draw() {
    scene.setAttribute('transform',`translate(${panX} ${panY}) scale(${zoom})`);
    const neighbors=new Set(links.filter(e=>e.source===active||e.target===active).flatMap(e=>[e.source,e.target]));
    links.forEach((e,i)=>{
      const l=lineEls[i]; for(const [k,v] of Object.entries({x1:e.a.x,y1:e.a.y,x2:e.b.x,y2:e.b.y})) l.setAttribute(k,v);
      l.setAttribute('stroke-opacity',active?(e.source===active||e.target===active?'.8':'.035'):'.2');
    });
    nodes.forEach((n,i)=>{
      const g=nodeEls[i];g.setAttribute('transform',`translate(${n.x} ${n.y})`);
      g.setAttribute('opacity',active&&!neighbors.has(n.id)&&n.id!==active?'.15':n.context?'.4':'1');
      g.querySelector('text').setAttribute('display',n.id===active?'block':'none');
      g.querySelector('text').setAttribute('font-size',11/zoom);
      g.querySelector('text').setAttribute('x',12/zoom);
      g.querySelector('text').setAttribute('y',4/zoom);
      g.querySelector('circle').setAttribute('r',6/zoom);
      g.querySelector('circle').setAttribute('stroke',n.id===active?'#fff':n.editor_weeks.length?'#fff2c5':'#102126');
      g.querySelector('circle').setAttribute('stroke-width',(n.id===active?3:n.editor_weeks.length?2:1)/zoom);
    });
  }
  function select(id) { const n=byId.get(id);if(!n)return;active=id;draw();onSelect(n,links.filter(e=>e.source===id||e.target===id).map(edge=>({edge,node:edge.source===id?edge.b:edge.a}))); }
  function reset() {
    active=null;
    const minX=Math.min(...nodes.map(n=>n.x),width/2)-45,maxX=Math.max(...nodes.map(n=>n.x),width/2)+45;
    const minY=Math.min(...nodes.map(n=>n.y),height/2)-45,maxY=Math.max(...nodes.map(n=>n.y),height/2)+45;
    zoom=Math.min(1.5,width/(maxX-minX),height/(maxY-minY));panX=width/2-(minX+maxX)/2*zoom;panY=height/2-(minY+maxY)/2*zoom;draw();
  }
  svg.addEventListener('pointerdown',event=>{gesture={startX:event.clientX,startY:event.clientY,x:panX,y:panY};svg.setPointerCapture(event.pointerId);});
  svg.addEventListener('pointermove',event=>{
    if(!gesture)return;const scale=width/svg.getBoundingClientRect().width,dx=(event.clientX-gesture.startX)*scale,dy=(event.clientY-gesture.startY)*scale;
    if(Math.abs(dx)+Math.abs(dy)>4)moved=true;
    if(gesture.node){gesture.node.x+=dx/zoom;gesture.node.y+=dy/zoom;gesture.startX=event.clientX;gesture.startY=event.clientY;}
    else {panX=gesture.x+dx;panY=gesture.y+dy;}draw();
  });
  // Pointer capture targets the SVG, so handle a node tap before releasing its
  // gesture instead of waiting for a click retargeted away from the node.
  svg.addEventListener('pointerup',()=>{const tapped=gesture?.node;gesture=null;if(tapped&&!moved)select(tapped.id);});
  svg.addEventListener('pointercancel',()=>{gesture=null;});
  function magnify(factor) {const next=Math.max(.15,Math.min(5,zoom*factor));panX=width/2-(width/2-panX)*next/zoom;panY=height/2-(height/2-panY)*next/zoom;zoom=next;draw();}
  svg.addEventListener('wheel',event=>{event.preventDefault();magnify(event.deltaY<0?1.12:1/1.12);},{passive:false});
  const controls=document.createElement('div');controls.className='co-zoom';
  for(const [text,label,fn] of [['+','Zoom in',()=>magnify(1.3)],['−','Zoom out',()=>magnify(1/1.3)],['↺','Fit network',reset]]) {const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',label);b.addEventListener('click',fn);controls.append(b);}container.append(controls);
  reset();
  return {select,reset,destroy(){container.replaceChildren();}};
}
