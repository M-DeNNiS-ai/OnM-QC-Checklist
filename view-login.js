/* ---------- Login ---------- */
function LoginView(){
  const gate = el('div',{class:'gate'});
  gate.appendChild(el('h2',{},'Battery QC'));
  gate.appendChild(el('p',{},'Sign in to the secure Battery QC server.'));
  let mode='omtech';
  const modeSel=el('select',{style:'margin-bottom:12px;'});
  [['omtech','Quality Technician (chain inspection)'],['omadmin','O&M Manager (pipeline oversight)'],['plant','Plant & Inventory (Plant credentials)'],['inventory','Plant & Inventory (Inventory credentials)'],['quality','Quality Engineer']].forEach(([v,l])=>modeSel.appendChild(el('option',{value:v},l)));
  gate.appendChild(modeSel);
  const body=el('div'); gate.appendChild(body);
  function renderBody(){
    body.innerHTML='';
    if(mode==='omtech'){
      body.appendChild(el('label',{},'Your Name'));
      const nameInp=el('input',{placeholder:'Name'}); body.appendChild(nameInp);
      body.appendChild(el('label',{},'Stage PIN'));
      const pinInp=el('input',{type:'password',placeholder:'••••'}); body.appendChild(pinInp);
      body.appendChild(el('div',{class:'pin-hint'},'Stage PIN is validated by the server.'));
      const errBox=el('div',{class:'err'}); body.appendChild(errBox);
      const go=el('button',{class:'btn-primary btn-block',style:'margin-top:12px;'},'Sign In');
      go.addEventListener('click',async()=>{
        errBox.textContent='';
        if(!nameInp.value.trim()){errBox.textContent='Enter your name.';return;}
        try{
          const auth=await apiFetch('/api/auth/login',{method:'POST',body:JSON.stringify({mode,name:nameInp.value.trim(),pin:pinInp.value})});
          STATE.techName=auth.user.name||nameInp.value.trim(); STATE.role='omtech'; STATE.stage=auth.user.stage; STATE.view='main';
          STATE.omRecords=await loadOm(); STATE.intakeDraft=emptyIntakeDraft(STATE.techName); render();
        }catch(e){errBox.textContent=e.message;}
      }); body.appendChild(go);
    }else{
      body.appendChild(el('label',{},SECTOR_LABEL[mode]+' PIN'));
      const inp=el('input',{type:'password',placeholder:'••••'}); body.appendChild(inp);
      const errBox=el('div',{class:'err'}); body.appendChild(errBox);
      const go=el('button',{class:'btn-primary btn-block',style:'margin-top:12px;'},'Authenticate');
      go.addEventListener('click',async()=>{
        errBox.textContent='';
        try{
          const auth=await apiFetch('/api/auth/login',{method:'POST',body:JSON.stringify({mode,pin:inp.value})});
          STATE.role=mode; STATE.view='main';
          if(mode==='omadmin'){STATE.omRecords=await loadOm(); STATE.plantStockRecords=await loadPlantStock(); STATE.warrantyRecords=await loadWarranty(); STATE.view='dashboard';}
          else if(mode==='plant' || mode==='inventory'){ await loadPlantInventorySector(); STATE.view='bulk'; }
          else if(mode==='quality'){STATE.warrantyRecords=await loadWarranty();STATE.warrantyDraft=emptyWarrantyDraft();STATE.omRecords=await loadOm();STATE.plantRecords=await loadPlant();STATE.plantStockRecords=await loadPlantStock();STATE.newBatteryRecords=await loadNewBattery();STATE.adjustments=await loadAdjustments();STATE.view='warranty';}
          render();
        }catch(e){errBox.textContent=e.message;}
      }); body.appendChild(go);
    }
  }
  modeSel.addEventListener('change',()=>{mode=modeSel.value;renderBody();}); renderBody(); return gate;
}
