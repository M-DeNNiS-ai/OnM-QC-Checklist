/* ---------- Server-backed storage ----------
   All persistent data is stored in the backend SQLite database. The browser keeps
   only UI state; records are loaded/saved through authenticated /api/data endpoints.
*/
async function apiFetch(path, options={}){
  const res = await fetch(path, { credentials:'include', headers:{'Content-Type':'application/json', ...(options.headers||{})}, ...options });
  let body=null; try { body=await res.json(); } catch(e) {}
  if(!res.ok){ const msg = body && body.error ? body.error : `Server error (${res.status})`; throw new Error(msg); }
  return body;
}
async function loadStore(key){ try { const r=await apiFetch('/api/data/'+encodeURIComponent(key)); return Array.isArray(r.data)?r.data:[]; } catch(e){ console.error('loadStore failed', key, e); return []; } }
async function saveStore(key,list){ try { await apiFetch('/api/data/'+encodeURIComponent(key), {method:'PUT', body:JSON.stringify({data:list})}); return true; } catch(e){ console.error('saveStore failed', key, e); return false; } }
async function loadOm(){ return loadStore('om_chain_records'); }
async function saveOm(list){ return saveStore('om_chain_records',list); }
async function loadPlant(){ return loadStore('plant_records'); }
async function savePlant(list){ return saveStore('plant_records',list); }
async function loadPlantStock(){ return loadStore('plant_stock_records'); }
async function savePlantStock(list){ return saveStore('plant_stock_records',list); }
async function loadNewBattery(){ return loadStore('new_battery_records'); }
async function saveNewBattery(list){ return saveStore('new_battery_records',list); }
async function loadAdjustments(){ return loadStore('inventory_adjustments'); }
async function saveAdjustments(list){ return saveStore('inventory_adjustments',list); }
async function loadWarranty(){ return loadStore('warranty_records'); }
async function saveWarranty(list){ return saveStore('warranty_records',list); }
