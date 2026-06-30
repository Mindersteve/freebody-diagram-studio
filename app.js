const NS = "http://www.w3.org/2000/svg";
const svg = document.querySelector("#diagram");
const scene = document.querySelector("#scene");
const selectionLayer = document.querySelector("#selectionLayer");
const draftLayer = document.querySelector("#draftLayer");
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const icons = {
  body: '<rect x="4" y="4" width="16" height="16" rx="1"/>',
  point: '<circle cx="12" cy="12" r="5"/><path d="M12 3v3m0 12v3M3 12h3m12 0h3"/>',
  force: '<path d="M4 18 19 5m-7 1 7-1-1 7"/>',
  spring: '<path d="M2 12h4l2-5 3 10 3-10 3 10 2-5h3"/>',
  damper: '<path d="M2 12h5m0-5v10h7V7H7m7 5h4m0-5v10m0-5h4"/>',
  surface: '<path d="M3 18 20 7v11z"/>',
  dimension: '<path d="M4 12h16m-13-3-3 3 3 3m10-6 3 3-3 3"/>',
  axes: '<path d="M5 19V5m0 0 3 3M5 5 2 8M5 19h14"/>',
  text: '<path d="M5 6h14M12 6v12"/>'
};

let state = {
  tool: "select", objects: [], selectedId: null, selectedIds: [], zoom: 1, snap: true, grid: true,
  background: "#ffffff", gridSize: 20, trimExport: true, history: [], future: [], drag: null, dirty: false
};

const uid = () => "o" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const snap = (n) => state.snap ? Math.round(n / state.gridSize) * state.gridSize : Math.round(n);
const byId = (id) => state.objects.find(o => o.id === id);
const selected = () => byId(state.selectedId);
const selectionIds = () => state.selectedIds?.filter(id=>byId(id)) || (state.selectedId?[state.selectedId]:[]);
function setSelection(ids=[]) {
  state.selectedIds=[...new Set(ids)].filter(id=>byId(id));
  state.selectedId=state.selectedIds.length===1?state.selectedIds[0]:null;
}
const safe = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const FONT_DEFAULTS = {
  body: {fontFamily:"Georgia, serif",fontSize:26,fontWeight:"400",italic:true},
  point: {fontFamily:"Manrope, sans-serif",fontSize:18,fontWeight:"600",italic:false},
  force: {fontFamily:"Manrope, sans-serif",fontSize:22,fontWeight:"700",italic:false},
  spring: {fontFamily:"Manrope, sans-serif",fontSize:17,fontWeight:"600",italic:false},
  damper: {fontFamily:"Manrope, sans-serif",fontSize:17,fontWeight:"600",italic:false},
  surface: {fontFamily:"Georgia, serif",fontSize:18,fontWeight:"400",italic:false},
  dimension: {fontFamily:"Manrope, sans-serif",fontSize:17,fontWeight:"400",italic:false},
  axes: {fontFamily:"Georgia, serif",fontSize:18,fontWeight:"400",italic:true},
  text: {fontFamily:"Manrope, sans-serif",fontSize:20,fontWeight:"600",italic:false}
};

function make(type, props = {}) {
  const typeFont = FONT_DEFAULTS[type] || {};
  const base = {
    id: uid(), type, x: 200, y: 180, w: 160, h: 100, rotation: 0,
    label: type === "body" ? "m" : type === "force" ? "F" : type === "spring" ? "k" : type === "damper" ? "c" : type === "point" ? "A" : type === "surface" ? "\\theta" : type === "text" ? "Annotation" : "",
    color: type === "force" ? "#2563eb" : "#20211f", strokeWidth: type === "force" ? 5 : 3,
    magnitude: 100, showMagnitude: false, showDot: ["body", "force"].includes(type),
    labelDX: 0, labelDY: 0, radius: 7, autoMeasure: type==="dimension",
    showSurfaceLabel:type==="surface", showAngle:type==="surface",
    scale: 0.01, unit: "m", precision: "2", stiffness:100, restLength:100,
    damping:10, velocity:0, mass:10, ...typeFont
  };
  return {...base, ...props};
}

function initialDiagram() {
  return [
    make("surface", {x: 110, y: 470, w: 660, h: 0, x2: 790, y2: 280, color: "#20211f", strokeWidth: 4}),
    make("body", {x: 385, y: 270, w: 205, h: 145, rotation: -16, label: "m"}),
    make("force", {x: 488, y: 342, x2: 488, y2: 500, label: "W", magnitude: 490, showMagnitude: true, color: "#ef6c57"}),
    make("force", {x: 488, y: 342, x2: 445, y2: 185, label: "N", magnitude: 462, showMagnitude: false, color: "#0f9f75"}),
    make("force", {x: 488, y: 342, x2: 665, y2: 292, label: "P", magnitude: 180, showMagnitude: true, color: "#2563eb"}),
    make("axes", {x: 815, y: 135, w: 90, h: 90, rotation: -16, color: "#20211f", strokeWidth: 2})
  ];
}

function serialize() {
  return JSON.stringify({objects: state.objects, background: state.background, gridSize: state.gridSize, trimExport:state.trimExport, title: $("#documentTitle").value});
}

function projectData() {
  return {
    format:"freebody-diagram",
    version:1,
    title:$("#documentTitle").value,
    objects:state.objects,
    background:state.background,
    gridSize:state.gridSize,
    trimExport:state.trimExport,
    savedAt:new Date().toISOString()
  };
}

function saveLocal() {
  localStorage.setItem("freebody-document", serialize());
  $("#saveStatus").textContent = "Saved";
  state.dirty = false;
}

function snapshot() {
  state.history.push(serialize());
  if (state.history.length > 60) state.history.shift();
  state.future = [];
  $("#saveStatus").textContent = "Saving…";
  clearTimeout(snapshot.timer);
  snapshot.timer = setTimeout(saveLocal, 500);
  updateUndo();
}

function restore(raw) {
  const data = JSON.parse(raw);
  state.objects = (data.objects || []).map(o => ({
    labelDX: 0,
    labelDY: 0,
    ...(FONT_DEFAULTS[o.type] || {}),
    ...o,
    ...(o.type==="body" ? {mass:o.mass??10} : {}),
    ...(o.type==="spring" ? {stiffness:o.stiffness??100,restLength:o.restLength??100} : {}),
    ...(o.type==="damper" ? {damping:o.damping??10,velocity:o.velocity??0} : {}),
    ...(o.type==="surface" ? {label:o.label||"\\theta",showSurfaceLabel:o.showSurfaceLabel!==false,showAngle:o.showAngle!==false} : {}),
    showDot: ["body", "force"].includes(o.type) ? o.showDot !== false : o.showDot
  }));
  state.background = data.background || "#ffffff";
  state.gridSize = data.gridSize || 20;
  state.trimExport = data.trimExport !== false;
  if (data.title) $("#documentTitle").value = data.title;
  $("#backgroundColor").value = state.background;
  $("#gridSize").value = state.gridSize;
  $("#trimExport").checked = state.trimExport;
  setSelection([]);
  render();
}

function undo() {
  if (!state.history.length) return;
  state.future.push(serialize());
  restore(state.history.pop());
  saveLocal(); updateUndo();
}
function redo() {
  if (!state.future.length) return;
  state.history.push(serialize());
  restore(state.future.pop());
  saveLocal(); updateUndo();
}
function updateUndo() {
  $("#undoBtn").disabled = !state.history.length;
  $("#redoBtn").disabled = !state.future.length;
}

function el(tag, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k,v]) => n.setAttribute(k, v));
  return n;
}

const latexSymbols = {
  alpha:"α", beta:"β", gamma:"γ", delta:"δ", epsilon:"ε", zeta:"ζ", eta:"η",
  theta:"θ", iota:"ι", kappa:"κ", lambda:"λ", mu:"μ", nu:"ν", xi:"ξ",
  pi:"π", rho:"ρ", sigma:"σ", tau:"τ", phi:"φ", chi:"χ", psi:"ψ", omega:"ω",
  Gamma:"Γ", Delta:"Δ", Theta:"Θ", Lambda:"Λ", Xi:"Ξ", Pi:"Π", Sigma:"Σ",
  Phi:"Φ", Psi:"Ψ", Omega:"Ω", cdot:"·", times:"×", pm:"±", leq:"≤", geq:"≥",
  neq:"≠", approx:"≈", infty:"∞", degree:"°", partial:"∂", nabla:"∇"
};

function latexSource(value) {
  let s=String(value ?? "").replace(/\$/g,"");
  for(let pass=0;pass<3;pass++) {
    s=s
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g,"$1⁄$2")
      .replace(/\\sqrt\{([^{}]*)\}/g,"√($1)")
      .replace(/\\(?:vec|overrightarrow)\{([^{}]*)\}/g,"$1⃗")
      .replace(/\\hat\{([^{}]*)\}/g,"$1̂")
      .replace(/\\(?:bar|overline)\{([^{}]*)\}/g,"$1̄")
      .replace(/\\(?:mathrm|mathbf|mathit|text)\{([^{}]*)\}/g,"$1");
  }
  s=s.replace(/\\([A-Za-z]+)/g,(all,name)=>latexSymbols[name] ?? name)
    .replace(/\\[,;!]/g," ").replace(/\\ /g," ");
  return s;
}

function latexParts(value) {
  const source=latexSource(value), parts=[];
  let plain="";
  const flush=()=>{if(plain){parts.push({text:plain,mode:"normal"});plain="";}};
  for(let i=0;i<source.length;i++) {
    const c=source[i];
    if(c==="{"||c==="}")continue;
    if(c!=="_"&&c!=="^"){plain+=c;continue;}
    flush();
    const mode=c==="_"?"sub":"super";
    let text="";
    if(source[i+1]==="{") {
      const end=source.indexOf("}",i+2);
      if(end>-1){text=source.slice(i+2,end);i=end;}
    } else if(i+1<source.length) text=source[++i];
    if(text)parts.push({text,mode});
  }
  flush();
  return parts;
}

function mathText(attrs,label) {
  const t=el("text",attrs);
  const parts=latexParts(label);
  t.setAttribute("aria-label",parts.map(part=>part.text).join(""));
  parts.forEach(part=>{
    if(part.mode==="normal")t.append(document.createTextNode(part.text));
    else {
      const span=el("tspan",{"baseline-shift":part.mode,"font-size":"70%"});
      span.textContent=part.text;t.append(span);
    }
  });
  return t;
}

function connectorGeometry(o) {
  const x2=o.x2??o.x+120,y2=o.y2??o.y,dx=x2-o.x,dy=y2-o.y,len=Math.hypot(dx,dy)||1;
  return {x2,y2,dx,dy,len,ux:dx/len,uy:dy/len,nx:-dy/len,ny:dx/len};
}

function renderObject(o) {
  const g = el("g", {"data-id": o.id, class: "diagram-object"});
  if (o.type === "body") {
    const cx = o.x + o.w/2, cy = o.y + o.h/2;
    g.setAttribute("transform", `rotate(${o.rotation} ${cx} ${cy})`);
    g.append(el("rect", {x:o.x, y:o.y, width:o.w, height:o.h, rx:3, fill:"#ffffff", stroke:o.color, "stroke-width":o.strokeWidth, filter:"url(#softShadow)"}));
    const t = mathText({x:cx+(o.labelDX||0), y:cy+8+(o.labelDY||0), "text-anchor":"middle", fill:o.color, "font-size":o.fontSize||26, "font-family":o.fontFamily||"Georgia, serif", "font-weight":o.fontWeight||"400", "font-style":o.italic?"italic":"normal", class:"diagram-label", "data-label-for":o.id},o.label);
    g.append(t);
    if (o.showDot !== false) g.append(el("circle", {cx, cy, r:5, fill:o.color, class:"anchor-dot", "data-dot-for":o.id}));
  } else if (o.type === "force") {
    g.append(el("line", {x1:o.x, y1:o.y, x2:o.x2, y2:o.y2, stroke:"transparent", "stroke-width":22, class:"force-hit"}));
    g.append(el("line", {x1:o.x, y1:o.y, x2:o.x2, y2:o.y2, stroke:o.color, "stroke-width":o.strokeWidth, "stroke-linecap":"round", "marker-end":`url(#arrow-${colorName(o.color)})`}));
    if (o.showDot !== false) g.append(el("circle", {cx:o.x, cy:o.y, r:5.5, fill:"#fff", stroke:o.color, "stroke-width":3, class:"anchor-dot", "data-dot-for":o.id}));
    const dx=o.x2-o.x, dy=o.y2-o.y, len=Math.hypot(dx,dy)||1, nx=-dy/len, ny=dx/len;
    const tx=o.x2-dx/len*18+nx*14+(o.labelDX||0), ty=o.y2-dy/len*18+ny*14+(o.labelDY||0);
    const t = mathText({x:tx, y:ty, fill:o.color, "font-size":o.fontSize||22, "font-weight":o.fontWeight||"700", "font-family":o.fontFamily||"Manrope, sans-serif", "font-style":o.italic?"italic":"normal", "paint-order":"stroke", stroke:"#fff", "stroke-width":5, "stroke-linejoin":"round", class:"diagram-label", "data-label-for":o.id},o.label + (o.showMagnitude ? ` = ${o.magnitude} N` : ""));
    g.append(t);
  } else if (o.type === "spring") {
    const q=connectorGeometry(o),lead=.12*q.len,body=.76*q.len,points=[[o.x,o.y],[o.x+q.ux*lead,o.y+q.uy*lead]];
    for(let i=0;i<9;i++){
      const along=lead+body*i/8,offset=(i===0||i===8)?0:(i%2?11:-11);
      points.push([o.x+q.ux*along+q.nx*offset,o.y+q.uy*along+q.ny*offset]);
    }
    points.push([q.x2,q.y2]);
    g.append(el("line",{x1:o.x,y1:o.y,x2:q.x2,y2:q.y2,stroke:"transparent","stroke-width":24,class:"connector-hit"}));
    g.append(el("polyline",{points:points.map(p=>p.join(",")).join(" "),fill:"none",stroke:o.color,"stroke-width":o.strokeWidth,"stroke-linejoin":"round","stroke-linecap":"round"}));
    [[o.x,o.y],[q.x2,q.y2]].forEach(([cx,cy])=>g.append(el("circle",{cx,cy,r:4,fill:o.color})));
    const t=mathText({x:(o.x+q.x2)/2+q.nx*20+(o.labelDX||0),y:(o.y+q.y2)/2+q.ny*20+(o.labelDY||0),fill:o.color,"text-anchor":"middle","font-size":o.fontSize||17,"font-family":o.fontFamily||"Manrope, sans-serif","font-weight":o.fontWeight||"600","font-style":o.italic?"italic":"normal","paint-order":"stroke",stroke:"#fff","stroke-width":4,class:"diagram-label","data-label-for":o.id},`${o.label||"k"} = ${o.stiffness} N/m`);
    g.append(t);
  } else if (o.type === "damper") {
    const q=connectorGeometry(o),a=.28*q.len,b=.66*q.len,half=12;
    const at=(d,n=0)=>[o.x+q.ux*d+q.nx*n,o.y+q.uy*d+q.ny*n];
    const pA=at(a),pB=at(b);
    g.append(el("line",{x1:o.x,y1:o.y,x2:q.x2,y2:q.y2,stroke:"transparent","stroke-width":24,class:"connector-hit"}));
    g.append(el("line",{x1:o.x,y1:o.y,x2:pA[0],y2:pA[1],stroke:o.color,"stroke-width":o.strokeWidth}));
    g.append(el("polyline",{points:[at(a,-half),at(b,-half),at(b,half),at(a,half),at(a,-half)].map(p=>p.join(",")).join(" "),fill:"none",stroke:o.color,"stroke-width":o.strokeWidth}));
    g.append(el("line",{x1:pB[0],y1:pB[1],x2:q.x2,y2:q.y2,stroke:o.color,"stroke-width":o.strokeWidth}));
    const plate=at(b-8);
    g.append(el("line",{x1:plate[0]+q.nx*9,y1:plate[1]+q.ny*9,x2:plate[0]-q.nx*9,y2:plate[1]-q.ny*9,stroke:o.color,"stroke-width":o.strokeWidth}));
    [[o.x,o.y],[q.x2,q.y2]].forEach(([cx,cy])=>g.append(el("circle",{cx,cy,r:4,fill:o.color})));
    const t=mathText({x:(o.x+q.x2)/2+q.nx*25+(o.labelDX||0),y:(o.y+q.y2)/2+q.ny*25+(o.labelDY||0),fill:o.color,"text-anchor":"middle","font-size":o.fontSize||17,"font-family":o.fontFamily||"Manrope, sans-serif","font-weight":o.fontWeight||"600","font-style":o.italic?"italic":"normal","paint-order":"stroke",stroke:"#fff","stroke-width":4,class:"diagram-label","data-label-for":o.id},`${o.label||"c"} = ${o.damping} N·s/m`);
    g.append(t);
  } else if (o.type === "surface") {
    const x2=o.x2 ?? o.x+o.w, y2=o.y2 ?? o.y;
    const points = `${o.x},${o.y} ${x2},${y2} ${x2},${Math.max(o.y,y2)+80} ${o.x},${Math.max(o.y,y2)+80}`;
    g.append(el("polygon", {points, fill:"#f1f0eb", stroke:"none"}));
    g.append(el("line", {x1:o.x,y1:o.y,x2,y2,stroke:o.color,"stroke-width":o.strokeWidth,"stroke-linecap":"round"}));
    const angle=Math.atan2(o.y-y2,x2-o.x)*180/Math.PI;
    const surfaceLabel=`${o.label||"\\theta"}${o.showAngle!==false?` ${Math.abs(angle).toFixed(0)}\\degree`:""}`;
    if(o.showSurfaceLabel!==false){
      const t=mathText({x:o.x+45+(o.labelDX||0),y:Math.max(o.y,y2)+34+(o.labelDY||0),fill:o.color,"font-size":o.fontSize||18,"font-family":o.fontFamily||"Georgia, serif","font-weight":o.fontWeight||"400","font-style":o.italic?"italic":"normal",class:"diagram-label","data-label-for":o.id},surfaceLabel);
      g.append(t);
    }
  } else if (o.type === "dimension") {
    const x2=o.x2??o.x+o.w,y2=o.y2??o.y;
    const dx=x2-o.x,dy=y2-o.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
    g.append(el("line",{x1:o.x,y1:o.y,x2,y2,stroke:"transparent","stroke-width":22,class:"dimension-hit"}));
    g.append(el("line",{x1:o.x,y1:o.y,x2,y2,stroke:o.color,"stroke-width":o.strokeWidth,"stroke-linecap":"round"}));
    [[o.x,o.y],[x2,y2]].forEach(([px,py])=>g.append(el("line",{x1:px-nx*9,y1:py-ny*9,x2:px+nx*9,y2:py+ny*9,stroke:o.color,"stroke-width":Math.max(1,o.strokeWidth-1)})));
    const dimensionLabel=o.autoMeasure ? `${(len*(Number(o.scale)||1)).toFixed(Number(o.precision)||0)} ${o.unit||""}`.trim() : (o.label||"L");
    const t=mathText({x:(o.x+x2)/2+(o.labelDX||0),y:(o.y+y2)/2-10+(o.labelDY||0),fill:o.color,"text-anchor":"middle","font-size":o.fontSize||17,"font-family":o.fontFamily||"Manrope, sans-serif","font-weight":o.fontWeight||"400","font-style":o.italic?"italic":"normal","paint-order":"stroke",stroke:"#fff","stroke-width":5,class:"diagram-label","data-label-for":o.id},dimensionLabel);
    g.append(t);
  } else if (o.type === "point") {
    const r=o.radius||7;
    g.append(el("circle",{cx:o.x,cy:o.y,r,fill:o.color,stroke:"#fff","stroke-width":3,class:"point-node"}));
    const t=mathText({x:o.x+r+8+(o.labelDX||0),y:o.y-r-3+(o.labelDY||0),fill:o.color,"font-size":o.fontSize||18,"font-family":o.fontFamily||"Manrope, sans-serif","font-weight":o.fontWeight||"600","font-style":o.italic?"italic":"normal","paint-order":"stroke",stroke:"#fff","stroke-width":4,class:"diagram-label","data-label-for":o.id},o.label);
    g.append(t);
  } else if (o.type === "axes") {
    g.setAttribute("transform",`rotate(${o.rotation} ${o.x} ${o.y})`);
    g.append(el("line",{x1:o.x,y1:o.y,x2:o.x+o.w,y2:o.y,stroke:"transparent","stroke-width":22,class:"axes-hit"}));
    g.append(el("line",{x1:o.x,y1:o.y,x2:o.x,y2:o.y-o.h,stroke:"transparent","stroke-width":22,class:"axes-hit"}));
    g.append(el("line",{x1:o.x,y1:o.y,x2:o.x+o.w,y2:o.y,stroke:o.color,"stroke-width":o.strokeWidth,"marker-end":`url(#arrow-${colorName(o.color)})`}));
    g.append(el("line",{x1:o.x,y1:o.y,x2:o.x,y2:o.y-o.h,stroke:o.color,"stroke-width":o.strokeWidth,"marker-end":`url(#arrow-${colorName(o.color)})`}));
    [["x",o.x+o.w+10,o.y+5],["y",o.x-5,o.y-o.h-10]].forEach(([s,x,y])=>g.append(mathText({x,y,fill:o.color,"font-size":o.fontSize||18,"font-family":o.fontFamily||"Georgia, serif","font-weight":o.fontWeight||"400","font-style":o.italic===false?"normal":"italic"},s)));
  } else if (o.type === "text") {
    const t=mathText({x:o.x,y:o.y,fill:o.color,"font-size":o.fontSize||Math.max(14,o.h||20),"font-family":o.fontFamily||"Manrope, sans-serif","font-weight":o.fontWeight||"600","font-style":o.italic?"italic":"normal",class:"diagram-label","data-label-for":o.id},o.label);
    g.append(t);
  }
  return g;
}

function colorName(c) {
  const map={"#2563eb":"blue","#0f9f75":"emerald","#ef6c57":"coral","#20211f":"ink"};
  return map[c] || "ink";
}

function bounds(o) {
  if (["force","surface","dimension","spring","damper"].includes(o.type)) {
    const x2=o.x2??o.x+o.w,y2=o.y2??o.y+o.h;
    return {x:Math.min(o.x,x2)-8,y:Math.min(o.y,y2)-8,w:Math.abs(x2-o.x)+16,h:Math.abs(y2-o.y)+16};
  }
  if(o.type==="point"){const r=o.radius||7;return{x:o.x-r-8,y:o.y-r-8,w:r*2+16,h:r*2+16};}
  if (o.type==="axes") return {x:o.x-8,y:o.y-o.h-8,w:o.w+16,h:o.h+16};
  return {x:o.x-8,y:o.y-8,w:(o.w||120)+16,h:(o.h||30)+16};
}

function renderSelection() {
  selectionLayer.replaceChildren();
  const ids=selectionIds();
  if(ids.length>1){
    const boxes=ids.map(id=>bounds(byId(id)));
    boxes.forEach(b=>selectionLayer.append(el("rect",{x:b.x,y:b.y,width:b.w,height:b.h,fill:"none",stroke:"#2563eb","stroke-width":1.25,"stroke-dasharray":"5 4"})));
    const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
    const right=Math.max(...boxes.map(b=>b.x+b.w)),bottom=Math.max(...boxes.map(b=>b.y+b.h));
    selectionLayer.append(el("rect",{x:x-5,y:y-5,width:right-x+10,height:bottom-y+10,fill:"none",stroke:"#2563eb","stroke-width":2}));
    return;
  }
  const o=selected(); if(!o) return;
  if(["spring","damper"].includes(o.type)){
    const q=connectorGeometry(o);
    selectionLayer.append(el("line",{x1:o.x,y1:o.y,x2:q.x2,y2:q.y2,stroke:"#2563eb","stroke-width":12,opacity:.12,"pointer-events":"none"}));
    [["start",o.x,o.y],["end",q.x2,q.y2]].forEach(([handle,cx,cy])=>selectionLayer.append(el("circle",{cx,cy,r:8,fill:"#fff",stroke:"#2563eb","stroke-width":2,class:"connector-handle","data-connector-handle":handle,"data-connector-id":o.id})));
    return;
  }
  if(o.type==="force"){
    selectionLayer.append(el("line",{x1:o.x,y1:o.y,x2:o.x2,y2:o.y2,stroke:"#2563eb","stroke-width":10,opacity:.12,"pointer-events":"none"}));
    [["start",o.x,o.y],["end",o.x2,o.y2]].forEach(([handle,cx,cy])=>{
      selectionLayer.append(el("circle",{cx,cy,r:8,fill:"#fff",stroke:"#2563eb","stroke-width":2,class:"force-handle","data-force-handle":handle,"data-force-id":o.id}));
    });
    return;
  }
  if(o.type==="dimension"){
    const x2=o.x2??o.x+o.w,y2=o.y2??o.y+o.h;
    selectionLayer.append(el("line",{x1:o.x,y1:o.y,x2,y2,stroke:"#2563eb","stroke-width":10,opacity:.12,"pointer-events":"none"}));
    [["start",o.x,o.y],["end",x2,y2]].forEach(([handle,cx,cy])=>{
      selectionLayer.append(el("circle",{cx,cy,r:8,fill:"#fff",stroke:"#2563eb","stroke-width":2,class:"dimension-handle","data-dim-handle":handle,"data-dimension-id":o.id}));
    });
    return;
  }
  const b=bounds(o);
  const r=el("rect",{x:b.x,y:b.y,width:b.w,height:b.h,fill:"none",stroke:"#2563eb","stroke-width":1.5,"stroke-dasharray":"5 4","vector-effect":"non-scaling-stroke"});
  selectionLayer.append(r);
  [[b.x,b.y],[b.x+b.w,b.y],[b.x,b.y+b.h],[b.x+b.w,b.y+b.h]].forEach(([cx,cy])=>selectionLayer.append(el("circle",{cx,cy,r:4.5,fill:"#fff",stroke:"#2563eb","stroke-width":1.5})));
}

let equationText="";

function signedTerms(terms) {
  if(!terms.length)return "0";
  return terms.map((term,i)=>{
    const prefix=term.sign<0?"−":i?"+":"";
    return `${prefix}${term.text}`;
  }).join(" ");
}

function equationHTML(value) {
  const source=latexSource(value);
  const accessible=latexParts(source).map(part=>part.text).join("");
  const renderText=text=>safe(text)
    .replace(/([A-Za-zΑ-Ωα-ω])\u0308/g,'<span class="math-overdot math-overdot-double">$1</span>')
    .replace(/([A-Za-zΑ-Ωα-ω])\u0307/g,'<span class="math-overdot">$1</span>');
  const content=latexParts(source).map(part=>{
    if(part.mode==="sub")return `<sub>${renderText(part.text)}</sub>`;
    if(part.mode==="super")return `<sup>${renderText(part.text)}</sup>`;
    return renderText(part.text);
  }).join("");
  return `<span class="math-formula" role="math" aria-label="${safe(accessible)}">${content}</span>`;
}

function governingEquations() {
  const forces=state.objects.filter(o=>o.type==="force");
  const springs=state.objects.filter(o=>o.type==="spring");
  const dampers=state.objects.filter(o=>o.type==="damper");
  const bodies=state.objects.filter(o=>o.type==="body");
  const xTerms=[],yTerms=[];
  forces.forEach(o=>{
    const dx=o.x2-o.x,py=o.y-o.y2,len=Math.hypot(dx,py)||1,ux=dx/len,uy=py/len;
    const angle=Math.abs(Math.round(Math.atan2(py,dx)*180/Math.PI)),name=latexSource(o.label||"F");
    if(Math.abs(ux)>.01)xTerms.push({sign:Math.sign(ux),text:Math.abs(ux)>.995?name:`${name} cos(${angle}°)`});
    if(Math.abs(uy)>.01)yTerms.push({sign:Math.sign(uy),text:Math.abs(uy)>.995?name:`${name} sin(${angle}°)`});
  });
  [...springs,...dampers].forEach(o=>{
    const q=connectorGeometry(o),ux=q.ux,uy=-q.uy,name=latexSource(o.label||(o.type==="spring"?"k":"c"));
    const magnitude=o.type==="spring"?`${name} ΔL`:`${name} v_{rel}`;
    if(Math.abs(ux)>.01)xTerms.push({sign:Math.sign(ux),text:Math.abs(ux)>.995?magnitude:`${magnitude} cos(θ_{${name}})`});
    if(Math.abs(uy)>.01)yTerms.push({sign:Math.sign(uy),text:Math.abs(uy)>.995?magnitude:`${magnitude} sin(θ_{${name}})`});
  });
  const mass=bodies.length?bodies.map(o=>latexSource(o.label||"m")).join(" + "):"m";
  const rows=[
    {name:"x force balance",formula:`${signedTerms(xTerms)} = (${mass}) a_x`},
    {name:"y force balance",formula:`${signedTerms(yTerms)} = (${mass}) a_y`}
  ];
  bodies.forEach(o=>rows.push({name:`mass ${latexSource(o.label||"m")}`,formula:`${latexSource(o.label||"m")} = ${o.mass} kg`}));
  springs.forEach(o=>rows.push({name:`spring ${latexSource(o.label||"k")}`,formula:`F_{${latexSource(o.label||"s")}} = ${latexSource(o.label||"k")} (L − L_0),   k = ${o.stiffness} N/m`}));
  dampers.forEach(o=>rows.push({name:`damper ${latexSource(o.label||"c")}`,formula:`F_{${latexSource(o.label||"d")}} = ${latexSource(o.label||"c")} v_{rel},   c = ${o.damping} N·s/m`}));
  if(springs.length||dampers.length){
    const c=dampers.map(o=>latexSource(o.label||"c")).join(" + ")||"0";
    const k=springs.map(o=>latexSource(o.label||"k")).join(" + ")||"0";
    rows.push({name:"reduced equation of motion",formula:`(${mass}) ẍ + (${c}) ẋ + (${k}) x = F_{ext}(t)`});
  }
  return rows;
}

function renderEquations() {
  const rows=governingEquations();
  equationText=rows.map(r=>`${r.name}: ${r.formula}`).join("\n");
  $("#equationOutput").innerHTML=state.objects.length?rows.map(r=>`<div class="equation-row"><small>${safe(r.name)}</small><div class="equation-expression">${equationHTML(r.formula)}</div></div>`).join(""):`<p class="equation-empty">Add a body, forces, springs, or dampers to derive equations.</p>`;
}

function render() {
  scene.replaceChildren(...state.objects.map(renderObject));
  renderSelection();
  $("#gridBackground").setAttribute("fill", state.grid ? "url(#majorGrid)" : state.background);
  $("#gridBackground").style.fill = state.grid ? "" : state.background;
  $("#diagram").style.background = state.background;
  const count=state.objects.length;
  $("#objectCount").textContent=`${count} object${count===1?"":"s"}`;
  $("#layerCount").textContent=count;
  renderLayers();
  renderInspector();
  renderEquations();
}

function renderLayers() {
  const ids=selectionIds();
  $("#layerList").innerHTML=state.objects.slice().reverse().map(o=>`<div class="layer-item ${ids.includes(o.id)?"active":""}" data-layer="${o.id}"><svg viewBox="0 0 24 24">${icons[o.type]||icons.text}</svg><span>${safe(o.label||o.type[0].toUpperCase()+o.type.slice(1))}</span></div>`).join("");
}

function renderInspector() {
  const ids=selectionIds(),multi=ids.length>1,o=selected(),has=!!o;
  $("#documentInspector").classList.toggle("hidden",has||multi);
  $("#objectInspector").classList.toggle("hidden",!has);
  $("#multiInspector").classList.toggle("hidden",!multi);
  $("#deleteBtn").classList.toggle("hidden",ids.length===0);
  $("#inspectorTitle").textContent=multi?`${ids.length} objects`:has ? o.type[0].toUpperCase()+o.type.slice(1) : "Document";
  if(multi)$("#multiCount").textContent=`${ids.length} objects`;
  if(!o)return;
  $$("[data-prop]").forEach(input=>{
    const p=input.dataset.prop;
    if(input.type==="checkbox") input.checked=!!o[p];
    else if(p==="w" && ["force","surface","dimension","spring","damper"].includes(o.type)) input.value=Math.round(Math.abs((o.x2??o.x)-o.x));
    else if(p==="h" && ["force","surface","dimension","spring","damper"].includes(o.type)) input.value=Math.round(Math.abs((o.y2??o.y)-o.y));
    else input.value=o[p]??"";
    input.disabled=(["w","h"].includes(p) && ["text","point"].includes(o.type));
  });
  $("#forceSection").classList.toggle("hidden",o.type!=="force");
  $("#bodySection").classList.toggle("hidden",o.type!=="body");
  $("#springSection").classList.toggle("hidden",o.type!=="spring");
  $("#damperSection").classList.toggle("hidden",o.type!=="damper");
  $("#dimensionSection").classList.toggle("hidden",o.type!=="dimension");
  $("#surfaceSection").classList.toggle("hidden",o.type!=="surface");
  $("#pointSection").classList.toggle("hidden",o.type!=="point");
  $("#dotField").classList.toggle("hidden",!["body","force"].includes(o.type));
  $("#labelField").classList.toggle("hidden",o.type==="axes");
  $("#latexHelp").classList.toggle("hidden",o.type==="axes");
}

function toPoint(evt) {
  const pt=svg.createSVGPoint(); pt.x=evt.clientX; pt.y=evt.clientY;
  const p=pt.matrixTransform(svg.getScreenCTM().inverse());
  return {x:snap(p.x),y:snap(p.y)};
}

function chooseTool(tool) {
  state.tool=tool; svg.dataset.tool=tool;
  $$(".tool[data-tool]").forEach(b=>b.classList.toggle("active",b.dataset.tool===tool));
  const hints={select:"Click an object or drag across empty space to select several",force:"Drag from the force origin to its direction",spring:"Drag between two attachment points",damper:"Drag between two attachment points",body:"Drag to draw a rigid body",point:"Click to place a labeled point",surface:"Drag along the contact surface",dimension:"Drag between features — endpoints snap automatically",axes:"Click to place coordinate axes",text:"Click to add an annotation"};
  $("#canvasHint").textContent=hints[tool];
}

function hitId(evt) {
  return evt.target.closest?.(".diagram-object")?.dataset.id || null;
}

function smartSnapPoint(p,ignoreId=null) {
  const candidates=[];
  state.objects.forEach(o=>{
    if(o.id===ignoreId)return;
    if(o.type==="body"){
      const cx=o.x+o.w/2,cy=o.y+o.h/2,a=(o.rotation||0)*Math.PI/180;
      const rotated=(x,y)=>[cx+(x-cx)*Math.cos(a)-(y-cy)*Math.sin(a),cy+(x-cx)*Math.sin(a)+(y-cy)*Math.cos(a)];
      candidates.push(rotated(o.x,o.y),rotated(o.x+o.w,o.y),rotated(o.x,o.y+o.h),rotated(o.x+o.w,o.y+o.h),[cx,cy]);
    } else if(["force","surface","dimension","spring","damper"].includes(o.type)){
      candidates.push([o.x,o.y],[o.x2??o.x+o.w,o.y2??o.y+o.h]);
    } else if(o.type==="axes"){
      candidates.push([o.x,o.y],[o.x+o.w,o.y],[o.x,o.y-o.h]);
    } else candidates.push([o.x,o.y]);
  });
  let best=null,bestDistance=24;
  candidates.forEach(([x,y])=>{const d=Math.hypot(x-p.x,y-p.y);if(d<bestDistance){bestDistance=d;best={x,y,snapped:true};}});
  return best||{...p,snapped:false};
}

svg.addEventListener("pointerdown", evt=>{
  const p=toPoint(evt);
  if(state.tool==="select") {
    const connectorHandle=evt.target.closest?.("[data-connector-handle]");
    if(connectorHandle){
      const id=connectorHandle.dataset.connectorId,o=byId(id);
      if(o){
        setSelection([id]);
        state.drag={mode:`connector-${connectorHandle.dataset.connectorHandle}`,start:p,original:JSON.parse(JSON.stringify(o)),changed:false};
        svg.setPointerCapture(evt.pointerId);
      }
      return;
    }
    const forceHandle=evt.target.closest?.("[data-force-handle]");
    if(forceHandle){
      const id=forceHandle.dataset.forceId,o=byId(id);
      if(o){
        setSelection([id]);
        state.drag={mode:`force-${forceHandle.dataset.forceHandle}`,start:p,original:JSON.parse(JSON.stringify(o)),changed:false};
        svg.setPointerCapture(evt.pointerId);
      }
      return;
    }
    const dimensionHandle=evt.target.closest?.("[data-dim-handle]");
    if(dimensionHandle){
      const id=dimensionHandle.dataset.dimensionId,o=byId(id);
      if(o){
        setSelection([id]);
        state.drag={mode:`dimension-${dimensionHandle.dataset.dimHandle}`,start:p,original:JSON.parse(JSON.stringify(o)),changed:false};
        svg.setPointerCapture(evt.pointerId);
      }
      return;
    }
    const dotId=evt.target.closest?.("[data-dot-for]")?.dataset.dotFor;
    if(dotId){
      const dotObject=byId(dotId);
      if(dotObject){snapshot();dotObject.showDot=false;setSelection([dotId]);render();}
      return;
    }
    const id=hitId(evt);
    const current=selectionIds();
    if(evt.shiftKey&&id){
      setSelection(current.includes(id)?current.filter(item=>item!==id):id?[...current,id]:current);
      render();return;
    }
    if(id) {
      if(current.includes(id)&&current.length>1){
        state.drag={mode:"move-group",start:p,originals:current.map(item=>[item,JSON.parse(JSON.stringify(byId(item)))]),changed:false};
        svg.setPointerCapture(evt.pointerId);render();return;
      }
      setSelection([id]);
      const o=byId(id);
      const isLabel=!!evt.target.closest?.("[data-label-for]") && o.type!=="text";
      state.drag={mode:isLabel?"label":"move",start:p,original:JSON.parse(JSON.stringify(o)),changed:false};
      svg.setPointerCapture(evt.pointerId);
    } else {
      const baseIds=evt.shiftKey?current:[];
      if(!evt.shiftKey)setSelection([]);
      state.drag={mode:"marquee",start:p,current:p,baseIds};
      svg.setPointerCapture(evt.pointerId);
    }
    render();
    return;
  }
  snapshot();
  let o;
  const start=["dimension","spring","damper"].includes(state.tool)?smartSnapPoint(p):p;
  if(state.tool==="body") o=make("body",{x:p.x,y:p.y,w:0,h:0});
  else if(["force","surface","dimension","spring","damper"].includes(state.tool)) o=make(state.tool,{x:start.x,y:start.y,x2:start.x,y2:start.y,label:state.tool==="dimension"?"L":undefined});
  else if(state.tool==="point"){o=make("point",{x:p.x,y:p.y,w:0,h:0});state.objects.push(o);setSelection([o.id]);chooseTool("select");render();saveLocal();return;}
  else if(state.tool==="axes") o=make("axes",{x:p.x,y:p.y,w:90,h:90});
  else if(state.tool==="text") {
    const label=prompt("Annotation text (LaTeX supported):","$F_k = \\mu N$");
    if(label) { o=make("text",{x:p.x,y:p.y,label,w:Math.max(80,label.length*10),h:20}); state.objects.push(o); setSelection([o.id]); }
    chooseTool("select"); render(); return;
  }
  if(o) {state.objects.push(o);setSelection([o.id]);state.drag={mode:"create",start:p,object:o};svg.setPointerCapture(evt.pointerId);render();}
});

svg.addEventListener("pointermove",evt=>{
  if(!state.drag)return;
  const p=toPoint(evt),d=state.drag;
  if(d.mode==="marquee"){
    d.current=p;
    const x=Math.min(d.start.x,p.x),y=Math.min(d.start.y,p.y),w=Math.abs(p.x-d.start.x),h=Math.abs(p.y-d.start.y);
    draftLayer.replaceChildren(el("rect",{x,y,width:w,height:h,class:"marquee-selection"}));
    return;
  }
  if(d.mode==="move-group"){
    const dx=p.x-d.start.x,dy=p.y-d.start.y;
    d.originals.forEach(([id,orig])=>{const item=byId(id);if(!item)return;item.x=orig.x+dx;item.y=orig.y+dy;if(orig.x2!=null){item.x2=orig.x2+dx;item.y2=orig.y2+dy;}});
    d.changed=!!(dx||dy);
    scene.replaceChildren(...state.objects.map(renderObject));renderSelection();return;
  }
  const o=selected();if(!o)return;
  if(d.mode==="move") {
    const dx=p.x-d.start.x,dy=p.y-d.start.y,orig=d.original;
    o.x=orig.x+dx;o.y=orig.y+dy;
    if(orig.x2!=null){o.x2=orig.x2+dx;o.y2=orig.y2+dy;}
    d.changed=!!(dx||dy);
  } else if(d.mode==="label") {
    const dx=p.x-d.start.x,dy=p.y-d.start.y,orig=d.original;
    o.labelDX=(orig.labelDX||0)+dx;o.labelDY=(orig.labelDY||0)+dy;
    d.changed=!!(dx||dy);
  } else if(d.mode==="dimension-start"||d.mode==="dimension-end") {
    const end=smartSnapPoint(p,o.id);
    if(d.mode==="dimension-start"){o.x=end.x;o.y=end.y;}
    else{o.x2=end.x;o.y2=end.y;}
    d.changed=true;
    draftLayer.replaceChildren();
    if(end.snapped)draftLayer.append(el("circle",{cx:end.x,cy:end.y,r:10,fill:"none",stroke:"#2563eb","stroke-width":2}));
  } else if(d.mode==="force-start"||d.mode==="force-end") {
    const end=d.mode==="force-start"?smartSnapPoint(p,o.id):p;
    if(d.mode==="force-start"){o.x=end.x;o.y=end.y;}
    else{o.x2=end.x;o.y2=end.y;}
    d.changed=true;
    draftLayer.replaceChildren();
    if(end.snapped)draftLayer.append(el("circle",{cx:end.x,cy:end.y,r:10,fill:"none",stroke:"#2563eb","stroke-width":2}));
  } else if(d.mode==="connector-start"||d.mode==="connector-end") {
    const end=smartSnapPoint(p,o.id);
    if(d.mode==="connector-start"){o.x=end.x;o.y=end.y;}
    else{o.x2=end.x;o.y2=end.y;}
    d.changed=true;draftLayer.replaceChildren();
    if(end.snapped)draftLayer.append(el("circle",{cx:end.x,cy:end.y,r:10,fill:"none",stroke:"#2563eb","stroke-width":2}));
  } else {
    if(o.type==="body"){
      o.x=Math.min(d.start.x,p.x);o.y=Math.min(d.start.y,p.y);
      o.w=Math.max(20,Math.abs(p.x-d.start.x));o.h=Math.max(20,Math.abs(p.y-d.start.y));
    }
    else if(["force","surface","dimension","spring","damper"].includes(o.type)){
      const end=["dimension","spring","damper"].includes(o.type)?smartSnapPoint(p,o.id):p;
      o.x2=end.x;o.y2=end.y;
      draftLayer.replaceChildren();
      if(end.snapped)draftLayer.append(el("circle",{cx:end.x,cy:end.y,r:9,fill:"none",stroke:"#2563eb","stroke-width":2}));
    }
  }
  scene.replaceChildren(...state.objects.map(renderObject));renderSelection();
});

svg.addEventListener("pointerup",()=>{
  if(!state.drag)return;
  if(state.drag.mode==="marquee"){
    const d=state.drag,x=Math.min(d.start.x,d.current.x),y=Math.min(d.start.y,d.current.y);
    const right=Math.max(d.start.x,d.current.x),bottom=Math.max(d.start.y,d.current.y);
    const hits=state.objects.filter(o=>{const b=bounds(o);return b.x<=right&&b.x+b.w>=x&&b.y<=bottom&&b.y+b.h>=y;}).map(o=>o.id);
    setSelection([...d.baseIds,...hits]);state.drag=null;draftLayer.replaceChildren();render();return;
  }
  if(state.drag.mode==="move-group"){
    if(state.drag.changed){
      const currents=state.drag.originals.map(([id])=>[id,JSON.parse(JSON.stringify(byId(id)))]);
      state.drag.originals.forEach(([id,orig])=>Object.assign(byId(id),orig));
      snapshot();currents.forEach(([id,current])=>Object.assign(byId(id),current));
    }
    state.drag=null;saveLocal();render();return;
  }
  if(["move","label","dimension-start","dimension-end","force-start","force-end","connector-start","connector-end"].includes(state.drag.mode)&&state.drag.changed) {
    const current=JSON.parse(JSON.stringify(selected()));
    Object.assign(selected(),state.drag.original);
    snapshot();
    Object.assign(selected(),current);
  }
  state.drag=null;draftLayer.replaceChildren();saveLocal();render();
  if(state.tool!=="select")chooseTool("select");
});

svg.addEventListener("dblclick",evt=>{
  const o=byId(hitId(evt));if(!o||o.type==="axes")return;
  const value=prompt("Edit label (LaTeX supported):",o.label);
  if(value!==null){snapshot();o.label=value;render();}
});

function deleteSelected() {
  const ids=selectionIds();if(!ids.length)return;snapshot();
  state.objects=state.objects.filter(o=>!ids.includes(o.id));setSelection([]);render();
}

$$(".tool[data-tool]").forEach(b=>b.addEventListener("click",()=>chooseTool(b.dataset.tool)));
$("#deleteBtn").addEventListener("click",deleteSelected);
$("#undoBtn").addEventListener("click",undo);$("#redoBtn").addEventListener("click",redo);
$("#clearBtn").addEventListener("click",()=>{if(confirm("Clear every object from this diagram?")){snapshot();state.objects=[];setSelection([]);render();}});
$("#layerList").addEventListener("click",e=>{const row=e.target.closest("[data-layer]");if(row){const current=selectionIds();setSelection(e.shiftKey?(current.includes(row.dataset.layer)?current.filter(id=>id!==row.dataset.layer):[...current,row.dataset.layer]):[row.dataset.layer]);chooseTool("select");render();}});

let inspectorEditStart=null;

function applyInspectorValue(input) {
  const p=input.dataset.prop,o=selected();if(!p||!o)return;
  let v=input.type==="checkbox"?input.checked:input.value;
  if(input.type==="number")v=Number(v);
  if(p==="w"&&["force","surface","dimension","spring","damper"].includes(o.type))o.x2=o.x+v;
  else if(p==="h"&&["force","surface","dimension","spring","damper"].includes(o.type))o.y2=o.y+v;
  else o[p]=v;
}

$("#objectInspector").addEventListener("focusin",e=>{
  if(e.target.dataset.prop && inspectorEditStart===null)inspectorEditStart=serialize();
});

$("#objectInspector").addEventListener("input",e=>{
  if(!e.target.dataset.prop)return;
  applyInspectorValue(e.target);
  render();
  $("#saveStatus").textContent="Saving…";
  clearTimeout(snapshot.timer);
  snapshot.timer=setTimeout(saveLocal,500);
});

$("#objectInspector").addEventListener("change",e=>{
  if(!e.target.dataset.prop)return;
  if(inspectorEditStart!==null){
    state.history.push(inspectorEditStart);
    if(state.history.length>60)state.history.shift();
    inspectorEditStart=null;state.future=[];updateUndo();
  } else snapshot();
  applyInspectorValue(e.target);
  saveLocal();render();
});
$$("[data-color]").forEach(b=>b.addEventListener("click",()=>{const o=selected();if(o){snapshot();o.color=b.dataset.color;render();}}));

$("#gridToggle").addEventListener("change",e=>{state.grid=e.target.checked;render();});
$("#snapToggle").addEventListener("change",e=>state.snap=e.target.checked);
$("#backgroundColor").addEventListener("input",e=>{state.background=e.target.value;render();saveLocal();});
$("#gridSize").addEventListener("change",e=>{state.gridSize=Math.max(10,Math.min(100,+e.target.value));saveLocal();});
$("#documentTitle").addEventListener("input",()=>{$("#saveStatus").textContent="Saving…";clearTimeout(snapshot.timer);snapshot.timer=setTimeout(saveLocal,500);});

function setZoom(z) {
  state.zoom=Math.max(.5,Math.min(1.5,z));
  $("#pageShell").style.width=`${state.zoom*1000}px`;
  $("#zoomLevel").textContent=`${Math.round(state.zoom*100)}%`;
}
$("#zoomIn").addEventListener("click",()=>setZoom(state.zoom+.1));
$("#zoomOut").addEventListener("click",()=>setZoom(state.zoom-.1));
$("#zoomLevel").addEventListener("click",()=>setZoom(1));
$("#fitBtn").addEventListener("click",()=>{const box=$("#canvasScroll").getBoundingClientRect();setZoom(Math.min(1,(box.width-80)/1000,(box.height-80)/650));});

$("#exportBtn").addEventListener("click",e=>{e.stopPropagation();$("#exportMenu").classList.toggle("open");});
document.addEventListener("click",()=>$("#exportMenu").classList.remove("open"));
$("#exportMenu").addEventListener("click",e=>{
  const b=e.target.closest("[data-export]");
  if(b)exportDiagram(b.dataset.export);
  else e.stopPropagation();
});
$("#trimExport").addEventListener("change",e=>{state.trimExport=e.target.checked;saveLocal();});

function exportSVGData() {
  const clone=svg.cloneNode(true);
  clone.querySelector("#selectionLayer").remove();clone.querySelector("#draftLayer").remove();
  clone.querySelectorAll(".force-hit,.dimension-hit,.axes-hit,.connector-hit").forEach(node=>node.remove());
  const bg=clone.querySelector("#gridBackground");bg.setAttribute("fill",state.background);bg.removeAttribute("style");
  let x=0,y=0,width=1000,height=650;
  if(state.trimExport && state.objects.length){
    const box=scene.getBBox(),padding=28;
    x=Math.floor(box.x-padding);y=Math.floor(box.y-padding);
    width=Math.ceil(box.x+box.width+padding)-x;
    height=Math.ceil(box.y+box.height+padding)-y;
  }
  bg.setAttribute("x",x);bg.setAttribute("y",y);
  bg.setAttribute("width",width);bg.setAttribute("height",height);
  clone.setAttribute("viewBox",`${x} ${y} ${width} ${height}`);
  clone.setAttribute("width",width);clone.setAttribute("height",height);
  clone.setAttribute("xmlns",NS);
  return {data:new XMLSerializer().serializeToString(clone),width,height,viewBox:`${x} ${y} ${width} ${height}`};
}
function download(blob,ext) {
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);
  a.download=($("#documentTitle").value||"free-body-diagram").replace(/[^\w-]+/g,"-").toLowerCase()+"."+ext;
  a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function saveProjectFile() {
  download(new Blob([JSON.stringify(projectData(),null,2)],{type:"application/json"}),"fbd.json");
  showToast("Project file saved");
}

function newDiagram() {
  snapshot();
  state.objects=[];state.background="#ffffff";state.gridSize=20;state.trimExport=true;
  setSelection([]);state.history=[];state.future=[];
  $("#documentTitle").value="Untitled diagram";
  $("#backgroundColor").value=state.background;$("#gridSize").value=state.gridSize;
  $("#trimExport").checked=true;
  render();saveLocal();updateUndo();showToast("New diagram created");
}

async function openProjectFile(file) {
  try {
    const data=JSON.parse(await file.text());
    const project=data.document||data;
    if(!project||!Array.isArray(project.objects))throw new Error("Invalid project");
    if(project.format&&project.format!=="freebody-diagram")throw new Error("Unsupported project");
    snapshot();restore(JSON.stringify(project));state.history=[];state.future=[];
    updateUndo();saveLocal();showToast(`Opened ${file.name}`);
  } catch {
    showToast("Could not open that diagram file");
  } finally {
    $("#openFileInput").value="";
  }
}

$("#newBtn").addEventListener("click",()=>$("#newModal").classList.add("open"));
$$("[data-close-new]").forEach(b=>b.addEventListener("click",()=>$("#newModal").classList.remove("open")));
$("#newModal").addEventListener("click",e=>{if(e.target===e.currentTarget)e.currentTarget.classList.remove("open");});
$("#confirmNewBtn").addEventListener("click",()=>{$("#newModal").classList.remove("open");newDiagram();});
$("#saveBtn").addEventListener("click",saveProjectFile);
$("#openBtn").addEventListener("click",()=>$("#openFileInput").click());
$("#openFileInput").addEventListener("change",e=>{const file=e.target.files?.[0];if(file)openProjectFile(file);});

function exportDiagram(type) {
  const exported=exportSVGData();
  if(type==="svg") download(new Blob([exported.data],{type:"image/svg+xml"}),"svg");
  else {
    const img=new Image(),url=URL.createObjectURL(new Blob([exported.data],{type:"image/svg+xml"}));
    img.onload=()=>{const c=document.createElement("canvas");c.width=exported.width*2;c.height=exported.height*2;const ctx=c.getContext("2d");ctx.drawImage(img,0,0,c.width,c.height);c.toBlob(b=>download(b,"png"),"image/png");URL.revokeObjectURL(url);};img.src=url;
  }
  showToast(`${type.toUpperCase()} exported · ${exported.width} × ${exported.height}`);
}
function showToast(msg){$("#toast span").textContent=msg;$("#toast").classList.add("show");setTimeout(()=>$("#toast").classList.remove("show"),1800);}

function applyPreset(name) {
  snapshot();setSelection([]);
  if(name==="incline")state.objects=initialDiagram();
  else state.objects=[
    make("text",{x:450,y:80,label:"Fixed support",w:130,h:18}),
    make("surface",{x:370,y:100,x2:630,y2:100,strokeWidth:4}),
    make("force",{x:500,y:265,x2:500,y2:125,label:"T",magnitude:120,showMagnitude:true,color:"#0f9f75"}),
    make("body",{x:430,y:260,w:140,h:115,label:"m"}),
    make("force",{x:500,y:318,x2:500,y2:475,label:"W",magnitude:120,showMagnitude:true,color:"#ef6c57"})
  ];
  render();saveLocal();
}
$("#presetIncline").addEventListener("click",()=>applyPreset("incline"));
$("#presetHanging").addEventListener("click",()=>applyPreset("hanging"));
$("#helpBtn").addEventListener("click",()=>$("#helpModal").classList.add("open"));
$$("[data-close-modal]").forEach(b=>b.addEventListener("click",()=>$("#helpModal").classList.remove("open")));
$("#helpModal").addEventListener("click",e=>{if(e.target===e.currentTarget)e.currentTarget.classList.remove("open");});
$("#copyEquationsBtn").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText(equationText);showToast("Equations copied");}
  catch{showToast("Could not copy equations");}
});

document.addEventListener("keydown",e=>{
  const key=e.key.toLowerCase();
  if((e.metaKey||e.ctrlKey)&&key==="s"){e.preventDefault();saveProjectFile();return;}
  if((e.metaKey||e.ctrlKey)&&key==="o"){e.preventDefault();$("#openFileInput").click();return;}
  if((e.metaKey||e.ctrlKey)&&key==="n"){e.preventDefault();$("#newModal").classList.add("open");return;}
  if(["INPUT","TEXTAREA"].includes(document.activeElement.tagName))return;
  if((e.metaKey||e.ctrlKey)&&key==="z"){e.preventDefault();e.shiftKey?redo():undo();return;}
  if((e.metaKey||e.ctrlKey)&&key==="d"){e.preventDefault();const ids=selectionIds();if(ids.length){snapshot();const copies=ids.map(id=>{const c=JSON.parse(JSON.stringify(byId(id)));c.id=uid();c.x+=20;c.y+=20;if(c.x2!=null){c.x2+=20;c.y2+=20;}return c;});state.objects.push(...copies);setSelection(copies.map(c=>c.id));render();}return;}
  if(["delete","backspace"].includes(key)){e.preventDefault();deleteSelected();return;}
  const map={v:"select",f:"force",k:"spring",c:"damper",b:"body",p:"point",s:"surface",d:"dimension",a:"axes",t:"text"};
  if(map[key])chooseTool(map[key]);
  if(key==="escape"){setSelection([]);chooseTool("select");render();}
});

const stored=localStorage.getItem("freebody-document");
if(stored){try{restore(stored);}catch{state.objects=initialDiagram();render();}}
else {state.objects=initialDiagram();render();saveLocal();}
chooseTool("select");updateUndo();
