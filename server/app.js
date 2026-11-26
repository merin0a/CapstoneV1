import express from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { hashPassword, verifyPassword } from './passwords.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const digest = token => createHash('sha256').update(token).digest('hex');
const safeUser = 'u.id,u.name,u.email,u.role,u.household_id,h.block,h.lot';
const reportSelect = `SELECT r.*,u.name AS reporter,(SELECT count(*)::int FROM report_supporters s WHERE s.report_id=r.id) AS affected FROM reports r JOIN users u ON u.id=r.user_id`;
const visitSelect = `SELECT v.*,u.name AS host,h.block,h.lot FROM visits v JOIN users u ON u.id=v.host_id LEFT JOIN households h ON h.id=u.household_id`;
class HttpError extends Error { constructor(status,message) { super(message); this.status=status; } }
const fail = (status,message) => { throw new HttpError(status,message); };
function text(value, label, max = 2000, required = true) {
  if (typeof value !== 'string') { if (!required && value == null) return ''; fail(400,`${label} must be text.`); }
  const result = value.trim();
  if ((required && !result) || result.length > max) fail(400,`${label} is required and must be at most ${max} characters.`);
  return result;
}
function choice(value, values, label) { if (!values.includes(value)) fail(400,`Choose a valid ${label}.`); return value; }
function id(value) { const n=Number(value); if (!Number.isSafeInteger(n) || n<1) fail(400,'Invalid record ID.'); return n; }
const roles = (...allowed) => (req,res,next) => allowed.includes(req.user.role) ? next() : next(new HttpError(403,'Your account cannot do that.'));
const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function visitDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value || value<today()) fail(400,'Choose today or a future date.');
  return value;
}
async function notify(tx,userId,message,link) { await tx.query('INSERT INTO notifications(user_id,message,link) VALUES($1,$2,$3)',[userId,message,link]); }
async function notifyAdmins(tx,message,link) { for(const u of (await tx.query("SELECT id FROM users WHERE role='admin'")).rows) await notify(tx,u.id,message,link); }

export function createApp(db,{production=false,origin}={}) {
  const app=express();
  app.disable('x-powered-by');
  app.use((req,res,next) => {
    res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY'});
    res.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    next();
  });
  app.use(express.json({limit:'4mb'}));
  app.use('/api',(req,res,next) => {
    res.set('Cache-Control','no-store');
    if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
      const expected=origin || `${req.protocol}://${req.get('host')}`;
      if(req.get('origin') && req.get('origin')!==expected) return next(new HttpError(403,'Request origin was rejected.'));
      if(!req.is('application/json')) return next(new HttpError(415,'Send JSON data.'));
    }
    next();
  });
  const attempts=new Map();
  app.post('/api/auth/login',async(req,res) => {
    const email=text(req.body.email,'Email',254).toLowerCase();
    const password=text(req.body.password,'Password',200);
    const key=req.ip;
    const now=Date.now();
    let attempt=attempts.get(key);
    if(attempt && attempt.reset<now) { attempts.delete(key); attempt=null; }
    if(attempt?.count>=20) fail(429,'Too many tries. Please wait 15 minutes.');
    // Keep this small even when many different clients try to log in.
    if(attempts.size>10000) for(const [k,v] of attempts) if(v.reset<now) attempts.delete(k);
    attempts.set(key,{count:(attempt?.count||0)+1,reset:attempt?.reset||now+900000});
    const user=(await db.query(`SELECT ${safeUser},u.password_hash FROM users u LEFT JOIN households h ON h.id=u.household_id WHERE u.email=$1`,[email])).rows[0];
    if(!user || !await verifyPassword(password,user.password_hash)) fail(401,'Email or password is incorrect.');
    attempts.delete(key);
    const token=randomBytes(32).toString('hex');
    await db.query('DELETE FROM sessions WHERE expires_at<now()');
    await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",[digest(token),user.id]);
    res.cookie('sc_session',token,{httpOnly:true,sameSite:'strict',secure:production,maxAge:8*60*60*1000,path:'/'});
    delete user.password_hash;
    res.json({user});
  });
  app.use(async(req,res,next) => {
    const token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('sc_session='))?.slice(11);
    if(token && /^[a-f0-9]{64}$/.test(token)) {
      req.tokenHash=digest(token);
      req.user=(await db.query(`SELECT ${safeUser} FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN households h ON h.id=u.household_id WHERE s.token_hash=$1 AND s.expires_at>now()`,[req.tokenHash])).rows[0];
    }
    next();
  });
  app.use('/api',(req,res,next)=>req.user?next():next(new HttpError(401,'Please log in first.')));
  app.get('/api/auth/me',(req,res)=>res.json({user:req.user}));
  app.post('/api/auth/logout',async(req,res)=>{ await db.query('DELETE FROM sessions WHERE token_hash=$1',[req.tokenHash]); res.clearCookie('sc_session',{path:'/'}); res.json({ok:true}); });
  app.get('/api/users',roles('admin','guard'),async(req,res)=>res.json((await db.query(`SELECT ${safeUser} FROM users u LEFT JOIN households h ON h.id=u.household_id ${req.user.role==='guard'?"WHERE u.role='resident'":''} ORDER BY u.name`)).rows));
  app.post('/api/users',roles('admin'),async(req,res)=>{
    const name=text(req.body.name,'Name',100), email=text(req.body.email,'Email',254).toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400,'Enter a valid email.');
    const password=text(req.body.password,'Password',200); if(password.length<10) fail(400,'Use at least 10 characters for the password.');
    const role=choice(req.body.role,['resident','admin','guard'],'role');
    const block=role==='resident'?text(req.body.block,'Block',30):null, lot=role==='resident'?text(req.body.lot,'Lot',30):null;
    const hash=await hashPassword(password);
    const user=await db.transaction(async tx=>{
      let household=null;
      if(role==='resident') household=(await tx.query('INSERT INTO households(block,lot) VALUES($1,$2) ON CONFLICT(block,lot) DO UPDATE SET block=EXCLUDED.block RETURNING id',[block,lot])).rows[0].id;
      return (await tx.query('INSERT INTO users(name,email,password_hash,role,household_id) VALUES($1,$2,$3,$4,$5) RETURNING id,name,email,role,household_id',[name,email,hash,role,household])).rows[0];
    });
    res.status(201).json(user);
  });
  app.get('/api/reports',roles('resident','admin'),async(req,res)=>res.json((await db.query(reportSelect+' ORDER BY r.created_at DESC,r.id DESC')).rows));
  app.get('/api/reports/:id',roles('resident','admin'),async(req,res)=>{
    const report=(await db.query(reportSelect+' WHERE r.id=$1',[id(req.params.id)])).rows[0]; if(!report) fail(404,'Report not found.');
    report.updates=(await db.query('SELECT t.*,u.name AS author FROM report_updates t JOIN users u ON u.id=t.user_id WHERE report_id=$1 ORDER BY t.created_at DESC,t.id DESC',[report.id])).rows;
    report.supported=!!(await db.query('SELECT 1 FROM report_supporters WHERE report_id=$1 AND user_id=$2',[report.id,req.user.id])).rows.length;
    res.json(report);
  });
  app.post('/api/reports',roles('resident'),async(req,res)=>{
    const b=req.body;
    const values=[req.user.id,text(b.title,'Title',80),text(b.description,'Description',4000),text(b.category,'Category',100),text(b.location,'Location',200),b.urgent===true];
    let photo=null;
    if(b.photo) { if(typeof b.photo!=='string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(b.photo) || b.photo.length>2800000) fail(400,'Use a PNG, JPG, or WebP photo under 2 MB.'); photo=b.photo; }
    const report=await db.transaction(async tx=>{
      const row=(await tx.query('INSERT INTO reports(user_id,title,description,category,location,urgent,photo) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[...values,photo])).rows[0];
      await tx.query('INSERT INTO report_supporters(report_id,user_id) VALUES($1,$2)',[row.id,req.user.id]);
      await tx.query("INSERT INTO report_updates(report_id,user_id,note) VALUES($1,$2,'Report submitted.')",[row.id,req.user.id]);
      await notifyAdmins(tx,`New report: ${row.title}`,`/admin/request-detail.html?id=${row.id}`);
      return row;
    }); res.status(201).json(report);
  });
  app.patch('/api/reports/:id',roles('admin'),async(req,res)=>{
    const reportId=id(req.params.id);
    const status=req.body.status===undefined?null:choice(req.body.status,['pending','in_progress','resolved'],'status');
    const party=req.body.party===undefined?null:choice(req.body.party,['unassigned','hoa','developer','lgu'],'responsible party');
    const note=text(req.body.note,'Note',2000,false);
    if(!status&&!party&&!note) fail(400,'Add an update first.');
    const row=await db.transaction(async tx=>{
      const r=(await tx.query('UPDATE reports SET status=COALESCE($1,status),party=COALESCE($2,party) WHERE id=$3 RETURNING *',[status,party,reportId])).rows[0];
      if(!r) fail(404,'Report not found.');
      const update=[status?`Status: ${status.replaceAll('_',' ')}`:'',party?`Responsible party: ${party}`:'',note].filter(Boolean).join('. ');
      await tx.query('INSERT INTO report_updates(report_id,user_id,note) VALUES($1,$2,$3)',[reportId,req.user.id,update]);
      await notify(tx,r.user_id,`${r.title}: ${update}`,`/resident/request-detail.html?id=${reportId}`); return r;
    }); res.json(row);
  });
  app.post('/api/reports/:id/support',roles('resident'),async(req,res)=>{
    const reportId=id(req.params.id);
    if(!(await db.query('SELECT id FROM reports WHERE id=$1',[reportId])).rows.length) fail(404,'Report not found.');
    if(typeof req.body.supported!=='boolean') fail(400,'Choose whether the report affects you.');
    if(req.body.supported) await db.query('INSERT INTO report_supporters(report_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[reportId,req.user.id]);
    else await db.query('DELETE FROM report_supporters WHERE report_id=$1 AND user_id=$2',[reportId,req.user.id]);
    res.json({ok:true});
  });
  app.get('/api/visits',async(req,res)=>res.json((await db.query(visitSelect+(req.user.role==='resident'?' WHERE v.host_id=$1':'')+' ORDER BY v.visit_date DESC,v.id DESC',req.user.role==='resident'?[req.user.id]:[])).rows));
  app.post('/api/visits',roles('resident','guard'),async(req,res)=>{
    const b=req.body, walkin=req.user.role==='guard';
    if(walkin && b.confirmed!==true) fail(400,'Confirm the visit with the resident first.');
    const hostId=walkin?id(b.host_id):req.user.id;
    if(!(await db.query("SELECT id FROM users WHERE id=$1 AND role='resident'",[hostId])).rows.length) fail(400,'Choose a resident.');
    const name=text(b.name,'Visitor name',100),type=choice(b.type,['Guest','Delivery','Contractor / service','Tricycle / ride'],'visitor type');
    const date=walkin?today():visitDate(b.visit_date), time=text(b.visit_time,'Time',5,false);
    if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail(400,'Choose a valid time.');
    const plate=text(b.plate,'Plate',30,false),note=text(b.note,'Note',1000,false),idLeft=walkin?text(b.id_left,'ID left',100):'';
    const visit=await db.transaction(async tx=>{
      const row=(await tx.query('INSERT INTO visits(code,host_id,name,type,visit_date,visit_time,plate,note,status,id_left) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',['V-'+randomBytes(6).toString('hex').toUpperCase(),hostId,name,type,date,time,plate,note,walkin?'arrived':'expected',idLeft])).rows[0];
      if(walkin) {
        await tx.query("INSERT INTO gate_events(visit_id,guard_id,action,note) VALUES($1,$2,'arrived',$3)",[row.id,req.user.id,`Walk-in; resident confirmed. ID left: ${idLeft}`]);
        await notify(tx,hostId,`${name} checked in as a walk-in.`, '/resident/visitors.html');
      }
      return row;
    }); res.status(201).json(visit);
  });
  app.patch('/api/visits/:id',roles('guard','resident'),async(req,res)=>{
    const visitId=id(req.params.id);
    const action=choice(req.body.status,req.user.role==='guard'?['arrived','left','denied']:['cancelled'],'visitor action');
    const idLeft=action==='arrived'?text(req.body.id_left,'ID left',100):null;
    const result=await db.transaction(async tx=>{
      const source=action==='left'?'arrived':'expected';
      const values=[action,idLeft,visitId,source,today()];
      const owner=req.user.role==='resident'?' AND host_id=$6':''; if(owner) values.push(req.user.id);
      const v=(await tx.query(`UPDATE visits SET status=$1,id_left=COALESCE($2,id_left) WHERE id=$3 AND status=$4 AND ($1<>'arrived' OR visit_date<=$5::date)${owner} RETURNING *`,values)).rows[0];
      if(!v) fail(409,'This action is unavailable. Refresh the visitor list (future visits cannot check in early).');
      if(req.user.role==='guard') {
        await tx.query('INSERT INTO gate_events(visit_id,guard_id,action,note) VALUES($1,$2,$3,$4)',[v.id,req.user.id,action,idLeft?`ID left: ${idLeft}`:'']);
        await notify(tx,v.host_id,`${v.name}: ${action}.`,'/resident/visitors.html');
      }
      return v;
    });res.json(result);
  });
  app.get('/api/gate-events',roles('guard','admin'),async(req,res)=>res.json((await db.query('SELECT e.*,v.name,v.code,u.name AS guard FROM gate_events e JOIN visits v ON v.id=e.visit_id JOIN users u ON u.id=e.guard_id ORDER BY e.created_at DESC,e.id DESC')).rows));
  app.get('/api/announcements',async(req,res)=>res.json((await db.query('SELECT a.*,u.name AS author FROM announcements a JOIN users u ON u.id=a.user_id ORDER BY pinned DESC,created_at DESC,id DESC')).rows));
  app.post('/api/announcements',roles('admin'),async(req,res)=>{
    const title=text(req.body.title,'Title',80),body=text(req.body.body,'Message',4000);
    const row=await db.transaction(async tx=>{
      const a=(await tx.query('INSERT INTO announcements(user_id,title,body,pinned) VALUES($1,$2,$3,$4) RETURNING *',[req.user.id,title,body,req.body.pinned===true])).rows[0];
      for(const u of (await tx.query("SELECT id,role FROM users WHERE role<>'admin'")).rows) await notify(tx,u.id,`Announcement: ${title}`,u.role==='resident'?'/resident/home.html':'/guard/gate.html');
      return a;
    }); res.status(201).json(row);
  });
  app.delete('/api/announcements/:id',roles('admin'),async(req,res)=>{
    const rows=(await db.query('DELETE FROM announcements WHERE id=$1 RETURNING id',[id(req.params.id)])).rows;
    if(!rows.length) fail(404,'Announcement not found.'); res.json({ok:true});
  });
  app.get('/api/notifications',async(req,res)=>res.json((await db.query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100',[req.user.id])).rows));
  app.post('/api/notifications/read',async(req,res)=>{await db.query('UPDATE notifications SET seen=true WHERE user_id=$1',[req.user.id]);res.json({ok:true});});
  app.use('/api',(req,res)=>res.status(404).json({error:'API route not found.'}));
  // Only publish frontend folders, never the database, server source, or .env.
  for(const role of ['resident','admin','guard']) app.use('/'+role,(req,res,next)=>{
    if(!req.user) return res.redirect('/login.html?role='+role);
    if(req.user.role!==role) return res.status(403).send('This page belongs to a different role.');
    next();
  },express.static(root+role,{index:false}));
  for(const folder of ['css','js']) app.use('/'+folder,express.static(root+folder));
  app.get('/',(req,res)=>res.sendFile(root+'index.html'));
  for(const file of ['index.html','login.html']) app.get('/'+file,(req,res)=>res.sendFile(root+file));
  app.use((req,res)=>res.status(404).send('Page not found.'));
  app.use((error,req,res,next)=>{
    if(error.code==='23505') return res.status(409).json({error:'That email or record already exists.'});
    const status=error.status||500;
    if(status>=500) console.error(error);
    res.status(status).json({error:status>=500?'Something went wrong. Please try again.':status===413?'Photo is too large. Use an image under 2 MB.':error.message});
  });
  return app;
}
