/* ---------- Header / Nav ---------- */
function Header(){
  const head = el('div',{class:'header'});
  const brand = el('div',{class:'brand'},[
    el('h1',{},'Battery QC'),
    el('p',{}, STATE.role==='omtech' ? STAGE_LABEL[STATE.stage] : (SECTOR_LABEL[STATE.role]||''))
  ]);
  const roleTag = STATE.role==='omtech' ? ('QA TECH · STAGE '+STATE.stage) : STATE.role.toUpperCase();
  const user = el('div',{class:'user-info'},[
    el('span',{class:'badge'}, roleTag),
    el('span',{}, STATE.role==='omtech' ? STATE.techName : SECTOR_LABEL[STATE.role]),
    el('button',{class:'btn-sm', onClick:()=>{
      apiFetch('/api/auth/logout',{method:'POST'}).catch(()=>{});
      STATE.role=null; STATE.stage=null; STATE.view='main'; STATE.openId=null; STATE.serialWarning=null;
      render();
    }},'Sign Out')
  ]);
  const themeWrap = el('div',{class:'theme-toggle'});
  const themeSel = el('select',{onChange: (e)=>setTheme(e.target.value)});
  [['light','Light UI'], ['dark','Dark UI']].forEach(([v,l])=>{
    const opt = el('option',{value:v}, l);
    if(v===currentTheme) opt.setAttribute('selected','true');
    themeSel.appendChild(opt);
  });
  themeWrap.appendChild(themeSel);
  const right = el('div',{style:'display:flex;align-items:center;gap:12px;'},[user, themeWrap]);
  head.appendChild(brand); head.appendChild(right);
  return head;
}
function Nav(items, labels){
  const nav = el('div',{class:'nav'});
  items.forEach(k=>{
    const b = el('button',{class: STATE.view===k?'active':''}, labels[k]);
    b.addEventListener('click', ()=>{ STATE.view=k; STATE.openId=null; render(); });
    nav.appendChild(b);
  });
  return nav;
}
