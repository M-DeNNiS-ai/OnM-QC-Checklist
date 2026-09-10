const root = document.getElementById('root');
let pendingCharts = [];

function loadingLabel(isLoading, label){
  if(!isLoading) return label;
  const wrap = document.createElement('span');
  wrap.style.display='inline-flex'; wrap.style.alignItems='center'; wrap.style.gap='6px';
  const sp = document.createElement('span'); sp.className='spinner';
  wrap.appendChild(sp);
  wrap.appendChild(document.createTextNode(label));
  return wrap;
}

function animateStatNumbers(){
  const nodes = root.querySelectorAll('.stat .n[data-target]');
  nodes.forEach(node=>{
    const target = parseFloat(node.dataset.target);
    if(isNaN(target)) return;
    const isInt = Number.isInteger(target);
    const t0 = performance.now(); const duration = 480;
    function step(t){
      const p = Math.min(1, (t-t0)/duration);
      const eased = 1 - Math.pow(1-p, 3);
      const val = target*eased;
      node.textContent = isInt ? String(Math.round(val)) : val.toFixed(1);
      if(p<1) requestAnimationFrame(step);
      else node.textContent = isInt ? String(target) : target.toFixed(1);
    }
    requestAnimationFrame(step);
  });
}

function render(){
  const active = document.activeElement;
  let focusInfo = null;
  if(active && root.contains(active) && active.dataset && active.dataset.fkey){
    focusInfo = {
      fkey: active.dataset.fkey,
      selStart: (typeof active.selectionStart === 'number') ? active.selectionStart : null,
      selEnd: (typeof active.selectionEnd === 'number') ? active.selectionEnd : null,
    };
  }
  const scrollY = window.scrollY;
  pendingCharts = [];
  root.innerHTML='';
  root.appendChild(View());
  pendingCharts.forEach(({canvas, config})=>{
    try{ if(typeof Chart!=='undefined') new Chart(canvas.getContext('2d'), config); }
    catch(e){ console.error('Chart render error', e); }
  });
  pendingCharts = [];
  animateStatNumbers();
  if(focusInfo){
    const restored = root.querySelector('[data-fkey="'+focusInfo.fkey.replace(/"/g,'')+'"]');
    if(restored){
      restored.focus({preventScroll:true});
      if(focusInfo.selStart!=null && typeof restored.setSelectionRange==='function'){
        try{ restored.setSelectionRange(focusInfo.selStart, focusInfo.selEnd); }catch(e){}
      }
      window.scrollTo(0, scrollY);
    }
  }
}

function el(tag, attrs={}, children=[]){
  const e = document.createElement(tag);
  for(const k in attrs){
    if(k==='class') e.className = attrs[k];
    else if(k==='disabled'){ if(attrs[k]) e.setAttribute('disabled','true'); }
    else if(k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
    else e.setAttribute(k, attrs[k]);
  }
  (Array.isArray(children)?children:[children]).forEach(c=>{
    if(c==null) return;
    e.appendChild(typeof c==='string' ? document.createTextNode(c) : c);
  });
  return e;
}
function field(label, inputEl){
  const w = el('div');
  w.appendChild(el('label',{},label));
  w.appendChild(inputEl);
  return w;
}
function textInput(value, onChange, opts={}){
  const i = el('input',{type:opts.type||'text', value: value||''});
  if(opts.mono) i.className = 'mono';
  if(opts.placeholder) i.setAttribute('placeholder', opts.placeholder);
  if(opts.readonly) i.setAttribute('readonly','true');
  if(opts.step) i.setAttribute('step', opts.step);
  if(opts.key) i.dataset.fkey = opts.key;
  i.addEventListener('input', ()=>onChange(i.value));
  if(value!==undefined) i.value = value;
  return i;
}
function textareaInput(value, onChange, opts={}){
  const t = el('textarea',{});
  t.value = value||'';
  if(opts.mono) t.className = (t.className+' mono').trim();
  if(opts.extraClass) t.className = (t.className+' '+opts.extraClass).trim();
  if(opts.key) t.dataset.fkey = opts.key;
  t.addEventListener('input', ()=>onChange(t.value));
  return t;
}
function selectInput(value, options, onChange, opts={}){
  const s = el('select',{});
  if(opts.key) s.dataset.fkey = opts.key;
  options.forEach(([v,l])=>{
    const o = el('option',{value:v}, l);
    if(v===value) o.setAttribute('selected','true');
    s.appendChild(o);
  });
  s.addEventListener('change', ()=>onChange(s.value));
  return s;
}
