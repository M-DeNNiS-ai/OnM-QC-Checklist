function Toast(){ return el('div',{class:'banner ok'},[STATE.toast]); }

function ChecklistCard(title, map, items, onSet){
  const card = el('div',{class:'card'});
  const res = checklistResult(map, items);
  card.appendChild(el('div',{style:'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;'},[
    el('h3',{},title),
    el('span',{class:'status-chip '+res}, res)
  ]));
  items.forEach(([key,label])=>{
    const row = el('div',{class:'check-row'});
    row.appendChild(el('span',{},label));
    const seg = el('div',{class:'seg'});
    ['PASS','FAIL','NA'].forEach(v=>{
      const cur = map[key];
      const b = el('button',{class: cur===v ? 'sel-'+v.toLowerCase() : ''}, v==='NA'?'N/A':v);
      b.addEventListener('click', ()=>{ onSet(key, cur===v ? undefined : v); render(); });
      seg.appendChild(b);
    });
    row.appendChild(seg);
    card.appendChild(row);
  });
  return card;
}
function IssuesCard(d){
  const card = el('div',{class:'card'});
  card.appendChild(el('h3',{},'Defect Diagnostics'));
  card.appendChild(el('div',{class:'sub'},'Select all applicable failure modes observed on arrival.'));
  ISSUE_ITEMS.forEach(([key,label])=>{
    const row = el('div',{class:'bool-row'});
    const cb = el('input',{type:'checkbox'});
    cb.checked = !!d.issues[key];
    cb.addEventListener('change', ()=>{ d.issues[key]=cb.checked; render(); });
    row.appendChild(cb);
    row.appendChild(el('label',{},label));
    card.appendChild(row);
  });
  if(d.issues.other){
    card.appendChild(field('Details of Other Failure Mode', textareaInput(d.otherNote, v=>d.otherNote=v, {key:'issue-otherNote'})));
  }
  return card;
}
function TestsCard(d){
  const card = el('div',{class:'card'});
  const res = testsResult(d);
  card.appendChild(el('div',{style:'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;'},[
    el('h3',{},'Verification Tests'),
    el('span',{class:'status-chip '+res}, res)
  ]));
  const grid = el('div',{class:'grid narrow'});
  grid.appendChild(field('Pack Voltage (V)', textInput(d.tests.packVoltage, v=>d.tests.packVoltage=v, {type:'number', mono:true, step:'0.01', key:'s3-packVoltage'})));
  grid.appendChild(field('Min Cell (V)', textInput(d.tests.minCell, v=>d.tests.minCell=v, {type:'number', mono:true, step:'0.01', key:'s3-minCell'})));
  grid.appendChild(field('Max Cell (V)', textInput(d.tests.maxCell, v=>d.tests.maxCell=v, {type:'number', mono:true, step:'0.01', key:'s3-maxCell'})));
  grid.appendChild(field('IR Measured (MΩ)', textInput(d.tests.irMeasured, v=>{d.tests.irMeasured=v; render();}, {type:'number', mono:true, step:'0.1', key:'s3-irMeasured'})));
  grid.appendChild(field('IR Threshold (MΩ)', textInput(d.tests.irThreshold, v=>{d.tests.irThreshold=v; render();}, {type:'number', mono:true, step:'0.1', key:'s3-irThreshold'})));
  card.appendChild(grid);
  card.appendChild(el('div',{style:'margin-top:8px;'}));
  TEST_BOOLS.forEach(([key,label])=>{
    const row = el('div',{class:'bool-row'});
    const cb = el('input',{type:'checkbox'});
    cb.checked = !!d.testBools[key];
    cb.addEventListener('change', ()=>{ d.testBools[key]=cb.checked; render(); });
    row.appendChild(cb);
    row.appendChild(el('label',{},label));
    card.appendChild(row);
  });
  return card;
}
function statBox(num, label){
  const s = el('div',{class:'stat'});
  const n = el('div',{class:'n'});
  const str = String(num);
  if(/^-?\d+(\.\d+)?$/.test(str)){
    n.dataset.target = str;
    n.textContent = '0';
  } else {
    n.textContent = str;
  }
  s.appendChild(n);
  s.appendChild(el('div',{class:'l'}, label));
  return s;
}
