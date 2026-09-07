require('dotenv').config();
const express=require('express');
const cookieParser=require('cookie-parser');
const jwt=require('jsonwebtoken');
const Database=require('better-sqlite3');
const bcrypt=require('bcryptjs');
const path=require('path');
const fs=require('fs');

const PORT=Number(process.env.PORT||3000);
const HOST=process.env.HOST||'0.0.0.0';
const JWT_SECRET=process.env.JWT_SECRET;
if(!JWT_SECRET || JWT_SECRET.length<32){ console.error('JWT_SECRET must be set to a random value of at least 32 characters.'); process.exit(1); }
const COOKIE_NAME='bqc_session';
const DATA_DIR=path.join(__dirname,'data'); fs.mkdirSync(DATA_DIR,{recursive:true});
const db=new Database(path.join(DATA_DIR,'battery-qc.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY,
  store_key TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_records_store ON records(store_key);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  role TEXT,
  action TEXT NOT NULL,
  store_key TEXT,
  record_id TEXT,
  created_at TEXT NOT NULL,
  ip TEXT,
  details TEXT
);
`);

const STORE_ROLES={
  om_chain_records:['omtech','omadmin','quality'],
  plant_records:['plant','quality'],
  new_battery_records:['inventory','quality'],
  inventory_adjustments:['inventory','quality'],
  warranty_records:['quality']
};
const ALL_STORES=Object.keys(STORE_ROLES);
const DEFAULT_PINS={
  omadmin:process.env.OMADMIN_PIN||'1234',
  plant:process.env.PLANT_PIN||'2345',
  inventory:process.env.INVENTORY_PIN||'3456',
  quality:process.env.QUALITY_PIN||'9999',
  stage1:process.env.STAGE1_PIN||'1001',
  stage2:process.env.STAGE2_PIN||'1002',
  stage3:process.env.STAGE3_PIN||'1003'
};
function now(){return new Date().toISOString();}
function audit(req,action,storeKey=null,recordId=null,details=null){
  const u=req.user||{}; db.prepare('INSERT INTO audit_log(username,role,action,store_key,record_id,created_at,ip,details) VALUES(?,?,?,?,?,?,?,?)').run(u.name||u.role||null,u.role||null,action,storeKey,recordId,now(),req.ip,details?JSON.stringify(details):null);
}
function sign(user){return jwt.sign(user,JWT_SECRET,{expiresIn:process.env.SESSION_TTL||'12h'});}
function auth(req,res,next){
  try{const token=req.cookies[COOKIE_NAME]; if(!token)return res.status(401).json({error:'Authentication required.'}); req.user=jwt.verify(token,JWT_SECRET); next();}
  catch(e){return res.status(401).json({error:'Session expired. Please sign in again.'});}
}
function canAccess(role,key){return (STORE_ROLES[key]||[]).includes(role);}
function rowsForStore(key){return db.prepare('SELECT id,payload FROM records WHERE store_key=? ORDER BY created_at ASC').all(key).map(r=>{try{return JSON.parse(r.payload)}catch{return null}}).filter(Boolean);}
function upsertMerged(key,incoming){
  const tx=db.transaction(()=>{
    const existing=db.prepare('SELECT id,payload,created_at FROM records WHERE store_key=?').all(key);
    const map=new Map(existing.map(r=>[r.id,r]));
    const insert=db.prepare('INSERT INTO records(id,store_key,payload,created_at,updated_at) VALUES(?,?,?,?,?)');
    const update=db.prepare('UPDATE records SET payload=?,updated_at=? WHERE id=? AND store_key=?');
    const t=now();
    for(const item of incoming){
      if(!item || !item.id) continue;
      const payload=JSON.stringify(item); const old=map.get(String(item.id));
      if(old) update.run(payload,t,String(item.id),key); else insert.run(String(item.id),key,payload,item.createdAt||t,t);
    }
  }); tx();
}

const app=express();
app.disable('x-powered-by');
app.set('trust proxy',1);
app.use(express.json({limit:'5mb'}));
app.use(cookieParser());
app.use((req,res,next)=>{res.setHeader('Cache-Control','no-store'); next();});

app.get('/api/health',(req,res)=>res.json({ok:true,service:'Battery QC API',time:now()}));
app.post('/api/auth/login',(req,res)=>{
  const {mode,pin,name}=req.body||{};
  let user=null;
  if(mode==='omtech'){
    if(!name || !String(name).trim()) return res.status(400).json({error:'Technician name is required.'});
    const stage=pin===DEFAULT_PINS.stage1?1:pin===DEFAULT_PINS.stage2?2:pin===DEFAULT_PINS.stage3?3:null;
    if(!stage) return res.status(401).json({error:'Invalid stage PIN.'});
    user={role:'omtech',name:String(name).trim(),stage};
  } else if(['omadmin','plant','inventory','quality'].includes(mode)){
    if(pin!==DEFAULT_PINS[mode]) return res.status(401).json({error:'Invalid PIN.'});
    user={role:mode,name:mode};
  } else return res.status(400).json({error:'Invalid login mode.'});
  res.cookie(COOKIE_NAME,sign(user),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:12*60*60*1000,path:'/'});
  audit({user,ip:req.ip},'LOGIN');
  res.json({ok:true,user});
});
app.post('/api/auth/logout',(req,res)=>{res.clearCookie(COOKIE_NAME,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/'});res.json({ok:true});});
app.get('/api/auth/me',(req,res)=>{try{const t=req.cookies[COOKIE_NAME]; if(!t)return res.json({authenticated:false}); const u=jwt.verify(t,JWT_SECRET);res.json({authenticated:true,user:u});}catch{res.json({authenticated:false});}});

app.get('/api/data/:key',auth,(req,res)=>{
  const key=req.params.key; if(!ALL_STORES.includes(key))return res.status(404).json({error:'Unknown data store.'});
  if(!canAccess(req.user.role,key))return res.status(403).json({error:'You do not have access to this sector.'});
  const data=rowsForStore(key); audit(req,'READ',key); res.json({data});
});
app.put('/api/data/:key',auth,(req,res)=>{
  const key=req.params.key; if(!ALL_STORES.includes(key))return res.status(404).json({error:'Unknown data store.'});
  if(!canAccess(req.user.role,key))return res.status(403).json({error:'You do not have permission to write this sector.'});
  if(!Array.isArray(req.body?.data))return res.status(400).json({error:'data must be an array.'});
  if(req.body.data.length>100000)return res.status(413).json({error:'Too many records in one request.'});
  try{upsertMerged(key,req.body.data); audit(req,'WRITE',key,null,{count:req.body.data.length}); res.json({ok:true,data:rowsForStore(key)});}
  catch(e){console.error(e);res.status(500).json({error:'Database write failed.'});}
});
app.get('/api/audit',auth,(req,res)=>{
  if(!['omadmin','quality'].includes(req.user.role))return res.status(403).json({error:'Admin access required.'});
  const rows=db.prepare('SELECT id,username,role,action,store_key,record_id,created_at,ip,details FROM audit_log ORDER BY id DESC LIMIT 1000').all(); res.json({data:rows});
});
app.get('/api/backup',auth,(req,res)=>{
  if(!['omadmin','quality'].includes(req.user.role))return res.status(403).json({error:'Admin access required.'});
  const out=path.join(DATA_DIR,`battery-qc-backup-${Date.now()}.sqlite`); db.backup(out).then(()=>{audit(req,'BACKUP');res.download(out,'battery-qc-backup.sqlite',()=>{try{fs.unlinkSync(out)}catch{}});}).catch(()=>res.status(500).json({error:'Backup failed.'}));
});

app.use(express.static(path.join(__dirname,'public'),{extensions:['html']}));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,HOST,()=>console.log(`Battery QC server listening on http://${HOST==='0.0.0.0'?'localhost':HOST}:${PORT}`));
