/* The page design is HTML/CSS. This file loads and saves its real data. */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const role=document.body.dataset.role;
  const page=location.pathname.split('/').pop();
  const main=$('#main');
  let user,notifications=[],reports=[],visits=[],events=[],currentReport;
  const labels={pending:'Pending',in_progress:'In progress',resolved:'Resolved',expected:'Expected',arrived:'On site',left:'Left',denied:'Denied',cancelled:'Cancelled'};
  const tones={pending:'amber',in_progress:'blue',resolved:'green',expected:'amber',arrived:'green',denied:'red'};
  const parties={unassigned:'Not assigned',hoa:'HOA',developer:'Developer',lgu:'LGU / barangay'};
  const categories=['Drainage / flooding','Water supply','Streetlight','Road damage','Stray animals','Noise / disturbance','Security concern','Internet / utilities','Water leak (warranty)','Other'];
  const visitorTypes=['Guest','Delivery','Contractor / service','Tricycle / ride'];
  const icon=name=>`<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${{
    report:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 11h6M9 15h4"/>',
    check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    people:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5"/>',
    bell:'<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5ZM10 21h4"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    home:'<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>'
  }[name]||''}</svg>`;
  const date=value=>value?new Date(value).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'}):'';
  const day=value=>String(value).slice(0,10);
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const chip=status=>`<span class="chip ${tones[status]||''}">${esc(labels[status]||status)}</span>`;
  const options=(values,selected)=>values.map(v=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(labels[v]||parties[v]||v)}</option>`).join('');
  const empty=message=>`<p class="live-empty">${esc(message)}</p>`;
  const header=(title,subtitle='',actions='')=>`<div class="page-head"><div><span class="page-kicker">${role==='admin'?'HOA WORKSPACE':role==='guard'?'GATE WORKSPACE':'YOUR COMMUNITY'}</span><h1>${esc(title)}</h1><p class="muted">${esc(subtitle)}</p></div><div class="live-actions">${actions}</div></div>`;
  const card=(title,body,action='')=>`<section class="card live-card"><div class="section-heading"><h2>${esc(title)}</h2>${action}</div>${body}</section>`;
  const field=(label,name,type='text',extra='')=>`<label>${esc(label)}<input class="input" name="${name}" type="${type}" ${extra}></label>`;
  const select=(label,name,values,selected)=>`<label>${esc(label)}<select class="input" name="${name}">${options(values,selected)}</select></label>`;
  const area=(label,name,max=4000)=>`<label>${esc(label)}<textarea class="input" name="${name}" required maxlength="${max}"></textarea></label>`;
  function toast(message,error=false) {
    let host=$('#toast-root');if(!host) { host=document.createElement('div');host.id='toast-root';host.setAttribute('aria-live','polite');document.body.append(host); }
    const item=document.createElement('div');item.className='toast'+(error?' err':'');item.textContent=message;host.append(item);setTimeout(()=>item.remove(),5000);
  }
  async function api(path,{method='GET',body}={}) {
    const response=await fetch('/api'+path,{method,headers:body!==undefined?{'Content-Type':'application/json'}:{},body:body!==undefined?JSON.stringify(body):undefined});
    const data=await response.json();
    if(response.status===401) {location.assign('/login.html?role='+role);throw new Error('Please log in again.');}
    if(!response.ok) throw new Error(data.error||'Could not save. Please try again.');
    return data;
  }
  function dialog(title,body) {
    $('#live-dialog')?.remove();
    const d=document.createElement('dialog');d.id='live-dialog';d.className='live-dialog card';
    d.innerHTML=`<div class="live-row between"><h2>${esc(title)}</h2><button class="btn sm" data-close-dialog type="button">Close</button></div><div style="margin-top:20px">${body}</div>`;
    document.body.append(d);d.showModal();return d;
  }
  function showError(error) {toast(error.message,true);}
  function reportRows(rows,emptyMessage='No reports yet.') {
    return rows.length?rows.map(r=>`<article class="live-entry"><div class="live-row between"><span class="live-meta">R-${r.id} · ${esc(r.category)}</span>${chip(r.status)}</div><h3><a href="request-detail.html?id=${r.id}">${esc(r.title)}</a></h3><p class="live-meta">${esc(r.location)} · ${esc(r.reporter)} · ${date(r.created_at)}</p><div class="live-row"><span>${r.affected} affected</span>${r.urgent?'<span class="chip red">Urgent</span>':''}<span class="chip">${esc(parties[r.party])}</span></div></article>`).join(''):empty(emptyMessage);
  }
  function annRows(rows) {
    return rows.length?rows.map(a=>`<article class="live-entry"><div class="live-row between"><h3>${esc(a.title)}</h3>${a.pinned?'<span class="chip brand">Pinned</span>':''}</div><p>${esc(a.body)}</p><div class="live-row between"><small>${esc(a.author)} · ${date(a.created_at)}</small>${role==='admin'?`<button class="btn sm danger" data-delete-ann="${a.id}" type="button">Delete</button>`:''}</div></article>`).join(''):empty('No announcements yet.');
  }
  function visitRows(rows) {
    return rows.length?rows.map(v=>`<article class="live-entry"><div class="live-row between"><h3>${esc(v.name)}</h3>${chip(v.status)}</div><p><strong>${esc(v.code)}</strong> · ${esc(v.type)}</p><p class="live-meta">${esc(day(v.visit_date))} ${esc(v.visit_time)} · ${esc(v.host)}${v.block?` · Block ${esc(v.block)}, Lot ${esc(v.lot)}`:''}</p>${v.plate?`<p>Plate: ${esc(v.plate)}</p>`:''}${v.note?`<p>${esc(v.note)}</p>`:''}${v.id_left?`<p class="live-meta">ID left: ${esc(v.id_left)}</p>`:''}<div class="live-actions">${role==='guard'&&v.status==='expected'?`<button class="btn primary sm" data-checkin="${v.id}" type="button">Check in</button><button class="btn danger sm" data-visit-action="denied" data-id="${v.id}" type="button">Deny</button>`:''}${role==='guard'&&v.status==='arrived'?`<button class="btn sm" data-visit-action="left" data-id="${v.id}" type="button">Mark left</button>`:''}${role==='resident'&&v.status==='expected'?`<button class="btn sm danger" data-visit-action="cancelled" data-id="${v.id}" type="button">Cancel visit</button>`:''}</div></article>`).join(''):empty('No visitors found.');
  }
  function stats(items) { return `<div class="live-stats">${items.map(([n,label],i)=>`<div class="card"><div class="stat-heading"><span>${esc(label)}</span><span class="stat-icon">${icon(['report','check','people'][i%3])}</span></div><strong>${n}</strong><span class="stat-foot">${role==='resident'?'Your household activity':role==='guard'?'Visitor activity':'Community activity'}</span></div>`).join('')}</div>`; }
  async function dashboard() {
    const [allReports,announcements,allVisits]=await Promise.all([api('/reports'),api('/announcements'),api('/visits')]);
    reports=allReports;
    const own=role==='resident'?reports.filter(r=>r.user_id===user.id):reports;
    const resolved=own.filter(r=>r.status==='resolved').length;
    const progress=own.length?Math.round(resolved/own.length*100):0;
    const quickLink=(href,ic,title,desc)=>`<a class="quick-link" href="${href}"><span class="stat-icon">${icon(ic)}</span><span><b>${title}</b><small>${desc}</small></span></a>`;
    const dateLabel=new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',weekday:'long',month:'long',day:'numeric'}).format(new Date());
    main.innerHTML=header(role==='admin'?'Community overview':`Welcome back, ${user.name.split(' ')[0]}.`,dateLabel,role==='resident'?`<a class="btn primary" href="request-new.html">${icon('plus')} Submit a report</a>`:`<a class="btn primary" href="requests.html">${icon('report')} Manage reports</a>`)+`<div class="live-stack"><section class="welcome-banner"><div class="welcome-copy"><span class="eyebrow">CARMELA SUBDIVISION</span><h2>${role==='admin'?'A connected community starts with you.':'Your neighborhood. Your everyday, made easier.'}</h2><p>${role==='admin'?'Keep concerns moving and your neighbors in the loop.':'Report a concern, welcome a guest, or catch up on what’s happening.'}</p><a class="btn" href="${role==='admin'?'announcements.html':'visitors.html'}">${role==='admin'?'Post an announcement':'Register a visitor'}</a></div><img class="welcome-art" src="/css/neighborhood.svg" alt="" aria-hidden="true"></section>${stats([[own.length-resolved,'Open reports'],[resolved,'Resolved reports'],[allVisits.filter(v=>v.status==='arrived').length,'Visitors on site']])}<div class="dashboard-grid"><div class="live-stack">${card(role==='resident'?'Your latest reports':'Latest community reports',`<div class="live-list">${reportRows(own.slice(0,4))}</div>`,'<a class="text-link" href="requests.html">View all reports</a>')}${card('Community board',`<div class="live-list">${annRows(announcements.slice(0,3))}</div>`,role==='admin'?'<a class="text-link" href="announcements.html">Manage posts</a>':'')}</div><div class="live-stack">${card('Quick actions',`<div class="quick-links">${role==='resident'?quickLink('request-new.html','report','Submit a report','Let us know what needs attention')+quickLink('visitors.html','people','Register a visitor','Make their arrival a little easier'):quickLink('requests.html','report','Review reports','Follow up on community concerns')+quickLink('announcements.html','bell','Share an update','Keep your neighbors informed')+quickLink('#accounts','people','Manage accounts','Help someone get connected')}</div>`)}${card('Report progress',`<p class="live-meta">${role==='resident'?'A quick look at your submitted reports.':'A quick look at community reports.'}</p><div class="overview-row"><span>Resolved reports</span><b>${resolved} of ${own.length}</b></div><div class="progress-track" role="progressbar" aria-label="Resolved reports" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${progress}%"></div></div><div class="overview-row"><span>In progress</span><b>${own.filter(r=>r.status==='in_progress').length}</b></div><div class="overview-row"><span>Waiting for review</span><b>${own.filter(r=>r.status==='pending').length}</b></div>`)}</div></div>${role==='admin'?'<div id="accounts" class="dashboard-accounts">'+card('Community accounts','<p class="live-meta">Help residents, admins, and guards access their workspace.</p><div id="account-list" class="live-list" style="margin-top:20px"></div>','<button class="btn sm" type="button" data-add-user>Add account</button>')+'</div>':''}</div>`;
    if(role==='admin') {
      const users=await api('/users');$('#account-list').innerHTML=users.map(u=>`<div class="live-entry"><b>${esc(u.name)}</b> · ${esc(u.role)}<p class="live-meta">${esc(u.email)}${u.block?` · Block ${esc(u.block)}, Lot ${esc(u.lot)}`:''}</p></div>`).join('');
    }
  }
  async function reportList() {
    reports=await api('/reports');
    main.innerHTML=header('Reports','See community concerns and follow their progress.',role==='resident'?'<a class="btn primary" href="request-new.html">Submit a report</a>':'')+`<div class="live-stack"><div class="live-row"><input class="input live-search" id="report-search" placeholder="Search reports" aria-label="Search reports"><select class="input" id="report-status" aria-label="Filter status" style="width:auto"><option value="all">All statuses</option>${options(Object.keys(labels).slice(0,3))}</select>${role==='resident'?'<label class="live-row"><input id="own-reports" type="checkbox">My reports only</label>':''}</div><div class="live-list" id="report-list">${reportRows(reports)}</div></div>`;
  }
  function filterReports() {
    const q=$('#report-search').value.toLowerCase(),status=$('#report-status').value,own=$('#own-reports')?.checked;
    $('#report-list').innerHTML=reportRows(reports.filter(r=>(!own||r.user_id===user.id)&&(status==='all'||r.status===status)&&`${r.title} ${r.category} ${r.location} ${r.reporter} R-${r.id}`.toLowerCase().includes(q)),'No reports match these filters. Try another search.');
  }
  function newReport() {
    main.innerHTML=header('Submit a report','Tell the HOA what happened and where.')+card('Report details',`<form class="live-form" data-form="report">${field('Title','title','text','required maxlength="80" placeholder="e.g. Broken streetlight near the gate"')}${select('Category','category',categories)}${area('What happened?','description')}${field('Location','location','text',`required maxlength="200" value="${esc(user.block?`Block ${user.block}, Lot ${user.lot}`:'')}"`)}<label class="check"><input type="checkbox" name="urgent">Urgent: there is a safety or health concern</label>${field('Photo (optional, JPG/PNG/WebP under 2 MB)','photo','file','accept="image/jpeg,image/png,image/webp"')}<button class="btn primary" type="submit">Send report</button></form>`);
  }
  async function reportDetail() {
    const reportId=new URLSearchParams(location.search).get('id');
    if(!reportId) {main.innerHTML=header('Choose a report')+'<a class="btn" href="requests.html">View reports</a>';return;}
    const r=currentReport=await api('/reports/'+encodeURIComponent(reportId));
    document.title=r.title+' · Subdivision Connect';
    main.innerHTML=header(r.title,`R-${r.id} · ${r.category}`,'<a class="btn" href="requests.html">Back to reports</a>')+`<div class="live-stack">${card('Report details',`<div class="live-row">${chip(r.status)}<span class="chip">Responsible: ${esc(parties[r.party])}</span>${r.urgent?'<span class="chip red">Urgent</span>':''}</div><p style="white-space:pre-wrap;margin-top:16px">${esc(r.description)}</p><p class="live-meta">${esc(r.location)} · ${esc(r.reporter)} · ${date(r.created_at)}</p>${r.photo?`<img class="live-photo" src="${esc(r.photo)}" alt="Photo attached to this report">`:''}<p style="margin-top:16px">${r.affected} resident(s) affected</p>${role==='resident'?`<button class="btn ${r.supported?'primary':''}" data-support type="button">${r.supported?'This affects me too ✓':'This affects me too'}</button>`:''}`)}${role==='admin'?card('Update this report',`<form class="live-form" data-form="update">${select('Status','status',['pending','in_progress','resolved'],r.status)}${select('Responsible party','party',Object.keys(parties),r.party)}<label>Update or follow-up note<textarea class="input" name="note" maxlength="2000" placeholder="What has been done or what happens next?"></textarea></label><button class="btn primary" type="submit">Save update</button></form>`):''}${card('Updates',`<ol class="live-timeline">${r.updates.map(u=>`<li><b>${esc(u.author)}</b> <span class="live-meta">${date(u.created_at)}</span><p>${esc(u.note)}</p></li>`).join('')}</ol>`)}</div>`;
  }
  function visitorForm(hosts) {
    const walkin=role==='guard';
    return `<form class="live-form" data-form="${walkin?'walkin':'visitor'}">${field('Visitor name','name','text','required maxlength="100"')}${select('Visitor type','type',visitorTypes)}${walkin?`<label>Visiting resident<select class="input" name="host_id" required><option value="">Choose a resident</option>${hosts.map(h=>`<option value="${h.id}">${esc(h.name)} · Block ${esc(h.block)}, Lot ${esc(h.lot)}</option>`).join('')}</select></label>${field('ID left at gate','id_left','text','required maxlength="100" placeholder="e.g. School ID"')}<label class="check"><input type="checkbox" name="confirmed" required>Resident confirmed the visit by phone</label>`:`${field('Visit date','visit_date','date',`required min="${today()}" value="${today()}"`)}${field('Time (optional)','visit_time','time')}`}${field('Plate number (optional)','plate','text','maxlength="30"')}${field('Note (optional)','note','text','maxlength="1000"')}<button class="btn primary" type="submit">${walkin?'Log walk-in':'Register visitor'}</button><div id="visit-result" aria-live="polite"></div></form>`;
  }
  async function visitorsPage() {
    visits=await api('/visits');
    main.innerHTML=header(role==='guard'?'Gate Management':'Visitors',role==='resident'?'Register a visitor and share their code with them.':'Find a visitor by name or code.',role==='guard'?'<button class="btn primary" data-walkin type="button">Log a walk-in</button>':'')+`<div class="live-stack">${role==='resident'?card('Register a visitor',visitorForm([])):stats([[visits.filter(v=>v.status==='expected'&&day(v.visit_date)===today()).length,'Expected today'],[visits.filter(v=>v.status==='arrived').length,'On site'],[visits.filter(v=>v.status==='left').length,'Completed visits']])}<div class="live-row"><input class="input live-search" id="visit-search" placeholder="Search visitor name or code" aria-label="Search visitors"><select class="input" id="visit-status" aria-label="Filter visitor status" style="width:auto"><option value="all">All statuses</option>${options(['expected','arrived','left','denied','cancelled'])}</select><button class="btn" data-refresh type="button">Refresh</button></div><div class="live-list" id="visitor-list">${visitRows(visits)}</div>${role==='guard'?card('Announcements',`<div id="gate-announcements" class="live-list"></div>`):''}</div>`;
    if(role==='guard') $('#gate-announcements').innerHTML=annRows(await api('/announcements'));
  }
  function filterVisits() {
    const q=$('#visit-search').value.toLowerCase(),status=$('#visit-status').value;
    $('#visitor-list').innerHTML=visitRows(visits.filter(v=>(status==='all'||v.status===status)&&`${v.name} ${v.code} ${v.host} ${v.plate}`.toLowerCase().includes(q)));
  }
  async function gateLog() {
    events=await api('/gate-events');
    main.innerHTML=header('Gate log','Every check-in, checkout, and denied entry is saved.','<button class="btn" data-export type="button">Download CSV</button><button class="btn" data-refresh type="button">Refresh</button>')+card('Visitor activity',`<div class="live-list">${events.length?events.map(e=>`<article class="live-entry"><div class="live-row between"><b>${esc(e.name)} · ${esc(e.code)}</b>${chip(e.action)}</div><p>${esc(e.note)}</p><small>${date(e.created_at)} · ${esc(e.guard)}</small></article>`).join(''):empty('No gate activity yet.')}</div>`);
  }
  async function announcementsPage() {
    const announcements=await api('/announcements');
    main.innerHTML=header('Announcements','Post a message for the community.')+`<div class="live-stack">${card('New announcement',`<form class="live-form" data-form="announcement">${field('Title','title','text','required maxlength="80"')}${area('Message','body')}<label class="check"><input type="checkbox" name="pinned">Pin this announcement</label><button class="btn primary" type="submit">Post announcement</button></form>`)}${card('Posted announcements',`<div class="live-list">${annRows(announcements)}</div>`)}</div>`;
  }
  async function refreshNotifications() {
    notifications=await api('/notifications');
    $$('.bell-dot').forEach(el=>el.hidden=!notifications.some(n=>!n.seen));
  }
  async function loadPage() {
    if(['home.html','dashboard.html'].includes(page)) await dashboard();
    else if(page==='requests.html') await reportList();
    else if(page==='request-new.html') newReport();
    else if(page==='request-detail.html') await reportDetail();
    else if(['visitors.html','gate.html'].includes(page)) await visitorsPage();
    else if(page==='log.html') await gateLog();
    else if(page==='announcements.html') await announcementsPage();
    await refreshNotifications();
  }
  async function fileData(file) {
    if(!file?.size) return null;
    if(file.size>2*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Use a JPG, PNG, or WebP photo under 2 MB.');
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read photo.'));reader.readAsDataURL(file);});
  }
  document.addEventListener('submit',async event=>{
    const f=event.target.closest('[data-form]');if(!f) return;event.preventDefault();
    if(!f.reportValidity()) return;
    const button=$('button[type="submit"]',f);button.disabled=true;
    const b=Object.fromEntries(new FormData(f));
    try {
      switch(f.dataset.form) {
        case 'report': {
          const r=await api('/reports',{method:'POST',body:{...b,urgent:f.elements.urgent.checked,photo:await fileData(f.elements.photo.files[0])}});
          location.assign('request-detail.html?id='+r.id);break;
        }
        case 'update': await api('/reports/'+currentReport.id,{method:'PATCH',body:b});await reportDetail();toast('Update saved.');break;
        case 'visitor':
        case 'walkin': {
          const v=await api('/visits',{method:'POST',body:{...b,confirmed:!!f.elements.confirmed?.checked}});
          $('#live-dialog')?.close();await visitorsPage();
          if(role==='resident') {const result=$('#visit-result');result.className='live-success';result.innerHTML=`Visitor registered. Share this code: <strong>${esc(v.code)}</strong>`;}
          toast(role==='guard'?'Walk-in saved.':'Visitor registered.');break;
        }
        case 'checkin': await api('/visits/'+f.dataset.id,{method:'PATCH',body:{status:'arrived',id_left:b.id_left}});$('#live-dialog').close();await visitorsPage();toast('Visitor checked in.');break;
        case 'announcement': await api('/announcements',{method:'POST',body:{...b,pinned:f.elements.pinned.checked}});await announcementsPage();toast('Announcement posted.');break;
        case 'user': await api('/users',{method:'POST',body:b});$('#live-dialog').close();await dashboard();toast('Account added.');break;
      }
      await refreshNotifications();
    } catch(error) {
      let message=$('[data-form-error]',f);if(!message) {message=document.createElement('p');message.dataset.formError='';message.className='live-alert';message.setAttribute('role','alert');f.append(message);}message.textContent=error.message;
    } finally {button.disabled=false;}
  });
  document.addEventListener('click',async event=>{
    const target=event.target.closest('button,a');if(!target) return;
    try {
      if(target.matches('[data-theme-toggle]')) {
        const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;localStorage.setItem('cc_theme',theme);
      } else if(target.matches('[data-logout]')) {
        event.preventDefault();await api('/auth/logout',{method:'POST',body:{}});location.assign('/');
      } else if(target.matches('[data-close-dialog]')) target.closest('dialog').close();
      else if(target.matches('[data-open="notif"]')) {
        await refreshNotifications();dialog('Notifications',`<div class="live-list">${notifications.length?notifications.map(n=>`<a class="live-entry" href="${esc(n.link)}"><b>${esc(n.message)}</b><p class="live-meta">${date(n.created_at)}</p></a>`).join(''):empty('You have no notifications yet.')}</div>`);await api('/notifications/read',{method:'POST',body:{}});await refreshNotifications();
      } else if(target.matches('[data-refresh]')) await loadPage();
      else if(target.matches('[data-support]')) {target.disabled=true;await api('/reports/'+currentReport.id+'/support',{method:'POST',body:{supported:!currentReport.supported}});await reportDetail();}
      else if(target.matches('[data-delete-ann]')) {if(!confirm('Delete this announcement?')) return;await api('/announcements/'+target.dataset.deleteAnn,{method:'DELETE',body:{}});await announcementsPage();}
      else if(target.matches('[data-checkin]')) {
        const v=visits.find(v=>v.id===Number(target.dataset.checkin));dialog('Check in '+v.name,`<form class="live-form" data-form="checkin" data-id="${v.id}">${field('ID left at the gate','id_left','text','required maxlength="100" placeholder="e.g. School ID or No ID left"')}<button class="btn primary" type="submit">Confirm check-in</button></form>`);
      } else if(target.matches('[data-visit-action]')) {
        const action=target.dataset.visitAction;if(!confirm(`${labels[action]}: confirm this visitor action?`)) return;
        target.disabled=true;await api('/visits/'+target.dataset.id,{method:'PATCH',body:{status:action}});await visitorsPage();toast('Visitor updated.');
      } else if(target.matches('[data-walkin]')) {const hosts=await api('/users');dialog('Log a walk-in',visitorForm(hosts));}
      else if(target.matches('[data-add-user]')) dialog('Add an account',`<form class="live-form" data-form="user">${field('Full name','name','text','required maxlength="100"')}${field('Email','email','email','required maxlength="254"')}${field('Password (at least 10 characters)','password','password','required minlength="10" maxlength="200" autocomplete="new-password"')}${select('Role','role',['resident','admin','guard'])}<p class="muted small">Block and lot are required for resident accounts.</p>${field('Block','block','text','maxlength="30"')}${field('Lot','lot','text','maxlength="30"')}<button class="btn primary" type="submit">Add account</button></form>`);
      else if(target.matches('[data-export]')) {
        const csvCell=value=>{let s=String(value??'');if(/^[=+@\-\t\r]/.test(s)) s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
        const rows=[['Time','Visitor','Code','Action','Guard','Note'],...events.map(e=>[date(e.created_at),e.name,e.code,e.action,e.guard,e.note])];
        const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='gate-log.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
    } catch(error) {showError(error);target.disabled=false;}
  });
  document.addEventListener('input',event=>{if(event.target.matches('#report-search,#report-status,#own-reports')) filterReports();if(event.target.matches('#visit-search,#visit-status')) filterVisits();});
  document.addEventListener('change',event=>{if(event.target.matches('#report-status,#own-reports')) filterReports();if(event.target.matches('#visit-status')) filterVisits();});
  async function start() {
    try {
      try {const theme=localStorage.getItem('cc_theme');if(theme) document.documentElement.dataset.theme=theme;} catch {}
      user=(await api('/auth/me')).user;
      $$('[data-user-name],.side-user b').forEach(el=>el.textContent=user.name);
      $$('.side-user small').forEach(el=>el.textContent=user.role==='resident'?`Resident · Block ${user.block}, Lot ${user.lot}`:user.role==='admin'?'HOA Administrator':'Gate guard');
      $$('[data-user-initials],.side-user .avatar').forEach(el=>el.textContent=user.name.split(' ').map(n=>n[0]).slice(0,2).join(''));
      $$('a[href="../index.html"]').filter(el=>el.closest('.side-foot')||el.getAttribute('aria-label')==='Logout').forEach(el=>{el.dataset.logout='';});
      await loadPage();
      // Keep typed forms intact when returning from another window or a file picker.
      window.addEventListener('focus',()=>refreshNotifications().catch(showError));
    } catch(error) {main.innerHTML=header('Could not load this page')+`<p class="live-alert">${esc(error.message)}</p><button class="btn" data-refresh type="button">Try again</button>`;}
  }
  start();
})();
