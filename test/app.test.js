import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, migrate } from '../server/db.js';
import { createApp } from '../server/app.js';
import { seed, DEMO_PASSWORD } from '../server/seed.js';

test('Saved accounts, reports, visitors, permissions, and announcements work together',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'subdivision-test-'));
  let db=await openDatabase({dataDir:join(dir,'pg')});
  let server;
  try {
    await migrate(db);await seed(db);
    server=createApp(db).listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    const base=`http://127.0.0.1:${server.address().port}`;
    async function request(path,{method='GET',body,cookie,headers={}}={}) {
      const res=await fetch(base+path,{method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...headers},body:body!==undefined?JSON.stringify(body):undefined,redirect:'manual'});
      const data=res.headers.get('content-type')?.includes('application/json')?await res.json():await res.text();
      return {status:res.status,data,cookie:res.headers.get('set-cookie')?.split(';')[0],headers:res.headers};
    }
    async function login(email) {const r=await request('/api/auth/login',{method:'POST',body:{email,password:DEMO_PASSWORD}});assert.equal(r.status,200);return r.cookie;}
    let resident,admin,guard,other,report,visit;
    const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    await t.test('Login is real and source/database files are private',async()=>{
      assert.equal((await request('/')).status,200);
      assert.equal((await request('/api/reports')).status,401);
      assert.equal((await request('/admin/dashboard.html')).status,302);
      for(const path of ['/server/app.js','/data/pgdata/PG_VERSION','/.env','/package.json']) assert.equal((await request(path)).status,404);
      assert.equal((await request('/api/auth/login',{method:'POST',body:{email:'maria.santos@carmela.ph',password:'wrong'}})).status,401);
      const loginResult=await request('/api/auth/login',{method:'POST',body:{email:'maria.santos@carmela.ph',password:DEMO_PASSWORD}});
      assert.match(loginResult.headers.get('set-cookie'),/HttpOnly/);assert.match(loginResult.headers.get('set-cookie'),/SameSite=Strict/);
      resident=loginResult.cookie;admin=await login('admin@carmela.ph');guard=await login('guard.tony@carmela.ph');
      assert.equal((await request('/admin/dashboard.html',{cookie:resident})).status,403);
      assert.equal((await request('/api/auth/me',{cookie:resident})).data.user.role,'resident');
      assert.equal((await request('/api/auth/me',{cookie:resident})).data.user.password_hash,undefined);
      assert.equal((await request('/api/announcements',{method:'POST',cookie:resident,body:{title:'x',body:'y'}})).status,403);
      assert.equal((await request('/api/reports',{cookie:guard})).status,403);
      assert.equal((await request('/api/auth/logout',{method:'POST',cookie:resident,body:{},headers:{Origin:'https://wrong.example'}})).status,403);
    });
    await t.test('Admin provisions accounts; account data is validated',async()=>{
      const body={name:'Second Resident',email:'second@example.com',password:DEMO_PASSWORD,role:'resident',block:'4',lot:'2'};
      assert.equal((await request('/api/users',{method:'POST',cookie:resident,body})).status,403);
      assert.equal((await request('/api/users',{method:'POST',cookie:admin,body:{...body,password:'short'}})).status,400);
      assert.equal((await request('/api/users',{method:'POST',cookie:admin,body})).status,201);
      assert.equal((await request('/api/users',{method:'POST',cookie:admin,body})).status,409);
      other=await login('second@example.com');
      assert.equal((await request('/api/users',{cookie:guard})).data.every(u=>u.role==='resident'),true);
    });
    await t.test('Reports, photos, support, and admin updates are saved',async()=>{
      const body={title:'Test streetlight',description:'Light is broken.',category:'Streetlight',location:'Block 3',urgent:true,photo:'data:image/png;base64,iVBORw0KGgo='};
      assert.equal((await request('/api/reports',{method:'POST',cookie:resident,body:{...body,title:''}})).status,400);
      const created=await request('/api/reports',{method:'POST',cookie:resident,body});assert.equal(created.status,201);report=created.data;
      assert.equal((await request('/api/reports/'+report.id,{cookie:resident})).data.affected,1);
      for(let i=0;i<2;i++) assert.equal((await request(`/api/reports/${report.id}/support`,{method:'POST',cookie:other,body:{supported:true}})).status,200);
      assert.equal((await request('/api/reports/'+report.id,{cookie:resident})).data.affected,2);
      assert.equal((await request('/api/reports/'+report.id,{method:'PATCH',cookie:resident,body:{status:'resolved'}})).status,403);
      assert.equal((await request('/api/reports/'+report.id,{method:'PATCH',cookie:admin,body:{status:'invalid'}})).status,400);
      const updated=await request('/api/reports/'+report.id,{method:'PATCH',cookie:admin,body:{status:'in_progress',party:'hoa',note:'Electrician is coming.'}});assert.equal(updated.status,200);
      const saved=(await request('/api/reports/'+report.id,{cookie:resident})).data;
      assert.equal(saved.status,'in_progress');assert.equal(saved.photo,body.photo);assert.equal(saved.updates.length,2);
      assert.match(saved.updates[0].note,/Electrician/);
      assert.equal((await request('/api/notifications',{cookie:resident})).data.length,1);
      await request('/api/notifications/read',{method:'POST',cookie:resident,body:{}});
      assert.equal((await request('/api/notifications',{cookie:resident})).data[0].seen,true);
    });
    await t.test('Visitor ownership, unique codes, valid transitions, and gate logs',async()=>{
      const body={name:'Jose Test',type:'Guest',visit_date:date,plate:'ABC 123'};
      const created=await request('/api/visits',{method:'POST',cookie:resident,body});assert.equal(created.status,201);visit=created.data;
      assert.match(visit.code,/^V-[A-F0-9]{12}$/);
      assert.equal((await request('/api/visits',{cookie:other})).data.length,0);
      assert.equal((await request('/api/visits/'+visit.id,{method:'PATCH',cookie:other,body:{status:'cancelled'}})).status,409);
      assert.equal((await request('/api/visits/'+visit.id,{method:'PATCH',cookie:resident,body:{status:'arrived',id_left:'School ID'}})).status,400);
      assert.equal((await request('/api/visits/'+visit.id,{method:'PATCH',cookie:guard,body:{status:'left'}})).status,409);
      assert.equal((await request('/api/visits/'+visit.id,{method:'PATCH',cookie:guard,body:{status:'arrived',id_left:'School ID'}})).status,200);
      assert.equal((await request('/api/visits/'+visit.id,{method:'PATCH',cookie:guard,body:{status:'arrived',id_left:'School ID'}})).status,409);
      assert.equal((await request('/api/visits/'+visit.id,{method:'PATCH',cookie:guard,body:{status:'left'}})).status,200);
      const log=await request('/api/gate-events',{cookie:guard});assert.equal(log.data.length,2);assert.equal(log.data[0].action,'left');
      assert.equal((await request('/api/gate-events',{cookie:resident})).status,403);
      const host=(await request('/api/auth/me',{cookie:resident})).data.user.id;
      assert.equal((await request('/api/visits',{method:'POST',cookie:guard,body:{...body,host_id:host,id_left:'License'}})).status,400);
      assert.equal((await request('/api/visits',{method:'POST',cookie:guard,body:{...body,host_id:host,id_left:'License',confirmed:true}})).status,201);
      const future={...body,visit_date:'2099-01-01'};
      const fv=(await request('/api/visits',{method:'POST',cookie:resident,body:future})).data;
      assert.equal((await request('/api/visits/'+fv.id,{method:'PATCH',cookie:guard,body:{status:'arrived',id_left:'ID'}})).status,409);
      assert.equal((await request('/api/visits/'+fv.id,{method:'PATCH',cookie:resident,body:{status:'cancelled'}})).status,200);
    });
    await t.test('Announcements reach residents and can be removed by admins',async()=>{
      const posted=await request('/api/announcements',{method:'POST',cookie:admin,body:{title:'Water interruption',body:'Tomorrow at 9 AM.',pinned:true}});assert.equal(posted.status,201);
      assert.equal((await request('/api/announcements',{cookie:resident})).data[0].title,'Water interruption');
      assert.ok((await request('/api/notifications',{cookie:other})).data.some(n=>n.message.includes('Water interruption')));
      assert.equal((await request('/api/announcements/'+posted.data.id,{method:'DELETE',cookie:resident,body:{}})).status,403);
      assert.equal((await request('/api/announcements/'+posted.data.id,{method:'DELETE',cookie:admin,body:{}})).status,200);
    });
    await t.test('Logout invalidates the session',async()=>{
      assert.equal((await request('/api/auth/logout',{method:'POST',cookie:other,body:{}})).status,200);
      assert.equal((await request('/api/auth/me',{cookie:other})).status,401);
    });
    await t.test('Closing and reopening the on-disk database keeps records',async()=>{
      await new Promise(resolve=>server.close(resolve));server=null;
      await db.close();db=await openDatabase({dataDir:join(dir,'pg')});await migrate(db);await seed(db);
      assert.equal((await db.query('SELECT title FROM reports WHERE id=$1',[report.id])).rows[0].title,'Test streetlight');
      assert.equal((await db.query('SELECT status FROM visits WHERE id=$1',[visit.id])).rows[0].status,'left');
      assert.equal((await db.query('SELECT count(*)::int AS n FROM users')).rows[0].n,4);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM gate_events')).rows[0].n,3);
    });
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    await db.close();await rm(dir,{recursive:true,force:true});
  }
});
