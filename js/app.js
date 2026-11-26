/* app.js: behaviour for the Carmela Subdivision prototype (demo). Load after layout.js. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const on = (ev, fn) => document.addEventListener(ev, fn);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const now = () => new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  const iso = () => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  };
  const dates = () => $$('form[data-demo="visitor"] input[type=date]').forEach(d => {
    d.defaultValue = d.value = d.min = iso();
  });
  const openDlg = id => {
    const d = document.getElementById(id);
    d?.showModal?.();
    return d;
  };

  /* theme */
  const root = document.documentElement;
  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  try {
    const t = localStorage.getItem('cc_theme');
    if (t) root.dataset.theme = t;
  } catch (e) { }

  /* toast */
  const toast = (msg, tone = '') => {
    let host = $('#toast-root');
    if (!host) {
      host = Object.assign(document.createElement('div'), { id: 'toast-root' });
      host.setAttribute('aria-live', 'polite');
      document.body.append(host);
    }
    const t = Object.assign(document.createElement('div'), { className: 'toast ' + tone, textContent: msg });
    t.setAttribute('role', 'status');
    host.append(t);
    setTimeout(() => t.classList.add('out'), 2800);
    setTimeout(() => t.remove(), 3300);
  };
  window.CC = { toast };

  /* shared demo reports for request-detail pages */
  const REPORTS = {
    'R-1001': {
      title: 'Clogged drain at the corner of Block 4',
      kind: 'Issue',
      category: 'Drainage / flooding',
      status: 'pending',
      party: 'hoa',
      where: 'Block 4',
      reporter: 'Carlos Mendoza',
      reported: 'Oct 21, 10:15 AM',
      affected: 3,
      urgent: true,
      waitDays: 0,
      desc: 'Rainwater pools up to ankle-deep near the corner drain whenever it rains heavily.',
      timeline: [
        { cls: 'pending', title: 'Pending', when: 'Oct 21, 10:15 AM', note: 'Report submitted', by: 'Carlos' }
      ]
    },
    'R-1002': {
      title: 'Brown water from the taps',
      kind: 'Issue',
      category: 'Water supply',
      status: 'in_progress',
      party: 'hoa',
      where: 'Block 3, Lot 12',
      reporter: 'Maria Santos',
      reported: 'Oct 20, 8:10 AM',
      affected: 3,
      urgent: true,
      waitDays: 0,
      desc: 'Water has been brown since Monday morning. The tank may need cleaning.',
      timeline: [
        { cls: 'in_progress', title: 'In progress', when: 'Oct 20, 2:15 PM', note: 'Acknowledged by the HOA. Tank inspection scheduled.', by: 'HOA' },
        { cls: 'pending', title: 'Pending', when: 'Oct 20, 8:10 AM', note: 'Report submitted', by: 'Maria' }
      ]
    },
    'R-1003': {
      title: 'Leak under the kitchen sink wall',
      kind: 'Service request',
      category: 'Water leak (warranty)',
      status: 'in_progress',
      party: 'developer',
      where: 'Block 5, Lot 4',
      reporter: 'Juan Dela Cruz',
      reported: 'Oct 7, 9:30 AM',
      affected: 1,
      urgent: false,
      waitDays: 16,
      desc: 'Leak started a month after turnover. This should be covered by the developer’s warranty.',
      timeline: [
        { cls: 'in_progress', title: 'In progress', when: 'Oct 7, 3:30 PM', note: 'Forwarded to the developer. Waiting for a reply.', by: 'HOA' },
        { cls: 'pending', title: 'Pending', when: 'Oct 7, 9:30 AM', note: 'Report submitted', by: 'Juan' }
      ]
    },
    'R-1004': {
      title: 'Bathroom wall leaking into the next room',
      kind: 'Service request',
      category: 'Water leak (warranty)',
      status: 'pending',
      party: 'developer',
      where: 'Block 7, Lot 9',
      reporter: 'Elena Cruz',
      reported: 'Oct 12, 11:00 AM',
      affected: 2,
      urgent: false,
      waitDays: 11,
      desc: 'Damp spots and peeling paint appeared on the bedroom wall behind the shower.',
      timeline: [
        { cls: 'pending', title: 'Pending', when: 'Oct 12, 11:00 AM', note: 'Report submitted and queued for developer warranty check.', by: 'Elena' }
      ]
    },
    'R-1005': {
      title: 'Stray dogs tearing trash bags',
      kind: 'Issue',
      category: 'Stray animals',
      status: 'pending',
      party: 'lgu',
      where: 'Block 6',
      reporter: 'Maria Santos',
      reported: 'Oct 22, 7:20 AM',
      affected: 2,
      urgent: false,
      waitDays: 0,
      desc: 'Three stray dogs enter through the side fence before garbage pickup.',
      timeline: [
        { cls: 'pending', title: 'Pending', when: 'Oct 22, 7:20 AM', note: 'Endorsed to barangay animal control.', by: 'HOA' }
      ]
    },
    'R-1006': {
      title: 'Streetlight out near Block 2 corner',
      kind: 'Issue',
      category: 'Streetlight',
      status: 'resolved',
      party: 'hoa',
      where: 'Block 2',
      reporter: 'Ramon Villanueva',
      reported: 'Oct 14, 7:45 PM',
      affected: 3,
      urgent: false,
      waitDays: 0,
      desc: 'Corner lamp post flickered and went completely dark at night.',
      timeline: [
        { cls: 'resolved', title: 'Resolved', when: 'Oct 16, 4:00 PM', note: 'Bulb and ballast replaced by maintenance.', by: 'HOA' },
        { cls: 'pending', title: 'Pending', when: 'Oct 14, 7:45 PM', note: 'Report submitted', by: 'Ramon' }
      ]
    },
    'R-1008': {
      title: 'Loud karaoke past midnight',
      kind: 'Issue',
      category: 'Noise / disturbance',
      status: 'resolved',
      party: 'hoa',
      where: 'Block 1',
      reporter: 'Ana Reyes',
      reported: 'Oct 11, 12:35 AM',
      affected: 1,
      urgent: false,
      waitDays: 0,
      desc: 'Music volume remained high past subdivision quiet hours (10:00 PM).',
      timeline: [
        { cls: 'resolved', title: 'Resolved', when: 'Oct 11, 12:50 AM', note: 'Roving guard reminded household of quiet hours.', by: 'Guard' },
        { cls: 'pending', title: 'Pending', when: 'Oct 11, 12:35 AM', note: 'Report submitted', by: 'Ana' }
      ]
    },
    'R-1009': {
      title: 'Pothole on the main road near the gate',
      kind: 'Issue',
      category: 'Road damage',
      status: 'in_progress',
      party: 'hoa',
      where: 'Main road',
      reporter: 'Tony Valdez',
      reported: 'Oct 18, 2:10 PM',
      affected: 3,
      urgent: false,
      waitDays: 0,
      desc: 'Deep pothole near the inbound lane slows tricycles and cars entering the gate.',
      timeline: [
        { cls: 'in_progress', title: 'In progress', when: 'Oct 19, 9:00 AM', note: 'Cold-mix asphalt patching scheduled this week.', by: 'HOA' },
        { cls: 'pending', title: 'Pending', when: 'Oct 18, 2:10 PM', note: 'Report submitted', by: 'Tony' }
      ]
    },
    'R-1010': {
      title: 'Only one internet provider available',
      kind: 'Issue',
      category: 'Internet / utilities',
      status: 'pending',
      party: 'developer',
      where: 'Block 8',
      reporter: 'Maria Santos',
      reported: 'Oct 3, 1:05 PM',
      affected: 3,
      urgent: false,
      waitDays: 20,
      desc: 'Phase 2 lines are still locked to a single ISP while residents wait on pole clearance.',
      timeline: [
        { cls: 'pending', title: 'Pending', when: 'Oct 3, 1:05 PM', note: 'Waiting for developer utility clearance.', by: 'HOA' }
      ]
    }
  };

  const PARTY_LABEL = {
    unassigned: 'Not assigned',
    hoa: 'HOA',
    developer: 'Developer',
    lgu: 'LGU / barangay'
  };

  const STATUS = {
    pending: ['Pending', 'amber'],
    in_progress: ['In progress', 'blue'],
    resolved: ['Resolved', 'green']
  };

  /* click actions: one entry per data-* attribute */
  const A = {
    'data-theme-toggle': () => {
      const n = isDark() ? 'light' : 'dark';
      root.dataset.theme = n;
      try { localStorage.setItem('cc_theme', n); } catch (e) { }
    },
    'data-open': t => {
      const d = openDlg(t.dataset.open);
      if (!d) return;
      if (t.dataset.title) $('[data-dlg-title]', d)?.replaceChildren(t.dataset.title);
      if (t.dataset.block) {
        d.dataset.block = t.dataset.block;
        $('[data-dlg-block]', d)?.replaceChildren(t.dataset.block);
      }
    },
    'data-close': t => t.closest('dialog')?.close(),
    'data-print': () => print(),
    'data-csv': t => exportCsv(t.dataset.csv, t.dataset.file || 'export.csv'),
    'data-copy': t => {
      const s = $(t.dataset.copy);
      (navigator.clipboard
        ? navigator.clipboard.writeText((s?.value || s?.textContent || '').trim())
        : Promise.reject()
      ).then(() => toast('Copied.'), () => toast('Select the text and copy it manually.', 'err'));
    },
    'data-set-status': setStatus,
    'data-affect': t => {
      const n = $('[data-affect-n]');
      if (!n) return;
      const p = t.classList.toggle('primary');
      t.classList.toggle('ghost', !p);
      n.textContent = +n.textContent + (p ? 1 : -1);
      const txt = $('[data-affect-t]', t);
      if (txt) txt.textContent = p ? 'You said this affects you too' : 'This affects me too';
    },
    'data-gate': t => {
      const row = t.closest('.gate-row');
      const a = t.dataset.gate;
      if (!row) return;
      if (a === 'left') {
        setGate(row, 'left');
        toast('Checked out.');
      }
      if (a === 'denied') {
        setGate(row, 'denied');
        toast('Entry denied. Resident notified (demo).');
      }
    },
    'data-open-checkin': t => {
      const row = t.closest('.gate-row');
      const d = openDlg('checkin');
      if (!row || !d) return;
      d.dataset.row = row.id;
      $('[data-who]', d).textContent = row.dataset.name;
    },
    'data-del': t => {
      const el = t.closest(t.dataset.del);
      if (el) {
        el.remove();
        toast('Removed.');
      }
    },
    'data-use-cat': t => {
      const s = $('#category');
      if (s) s.value = t.dataset.useCat;
      const box = $('#suggest-box');
      if (box) box.hidden = true;
    },
    'data-approve': t => {
      const r = t.closest('[data-res]');
      const s = $('[data-res-status]', r);
      const ok = t.dataset.approve === 'yes';
      if (s) {
        s.className = 'chip ' + (ok ? 'green' : 'red');
        s.textContent = ok ? 'Approved' : 'Declined';
      }
      $$('[data-approve]', r).forEach(b => b.remove());
      toast(`Reservation ${ok ? 'approved' : 'declined'}. Resident notified (demo).`);
    }
  };

  const actionSel = Object.keys(A).map(k => `[${k}]`).join();
  on('click', e => {
    const t = e.target.closest(actionSel);
    if (!t) return e.target.tagName === 'DIALOG' && e.target.close();
    A[Object.keys(A).find(k => t.hasAttribute(k))](t);
  });

  /* list filtering: chips, selects and search drive one list */
  function filter(id) {
    const list = document.getElementById(id);
    if (!list) return;
    const ctl = $$(`[data-filter-for="${id}"]`);
    const empty = $$(`[data-empty-for="${id}"]`);
    const q = ($(`[data-search-for="${id}"]`)?.value || '').toLowerCase();
    let n = 0;
    $$('[data-item]', list).forEach(it => {
      const ok = ctl.every(c => {
        const v = c.matches('select,input') ? c.value : $('.on', c)?.dataset.value;
        const k = c.dataset.filterKey;
        return !v || v === 'all' || (v === 'open' ? it.dataset[k] !== 'resolved' : it.dataset[k] === v);
      }) && (!q || it.textContent.toLowerCase().includes(q));
      it.hidden = !ok;
      n += ok;
    });
    $$(`[data-count-for="${id}"]`).forEach(x => x.textContent = n);
    empty.forEach(x => x.hidden = n > 0);
    list.hidden = n === 0 && empty.length > 0;
  }

  on('click', e => {
    const b = e.target.closest('[data-filter-for] button');
    if (!b) return;
    const g = b.closest('[data-filter-for]');
    $$('button', g).forEach(x => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-pressed', x === b);
    });
    filter(g.dataset.filterFor);
  });

  on('input', e => {
    const s = e.target.closest('[data-search-for],select[data-filter-for]');
    if (s) filter(s.dataset.searchFor || s.dataset.filterFor);
  });

  on('change', e => {
    const s = e.target.closest('select[data-filter-for]');
    if (s) filter(s.dataset.filterFor);

    const f = e.target.closest('input[type=file][data-preview]');
    if (f?.files[0]) {
      const r = new FileReader();
      r.onload = () => $('#' + f.dataset.preview).innerHTML = `<img alt="Selected photo" src="${r.result}">`;
      r.readAsDataURL(f.files[0]);
    }

    const p = e.target.closest('[data-party]');
    if (p) {
      const label = p.options[p.selectedIndex].text;
      toast('Responsible party set to ' + label + '.');
      const w = $('#dev-wait');
      if (w) w.hidden = p.value !== 'developer';
      const pc = $('[data-party-chip]');
      if (pc) {
        pc.className = 'chip ' + (p.value === 'developer' ? 'red' : '');
        pc.textContent = 'Responsible: ' + label;
      }
    }
  });

  /* category suggestion (keyword preview; an AI model can replace it later) */
  const RULES = [
    ['Drainage / flooding', /drain|flood|baha|canal|clog/i],
    ['Water supply', /brown|dirty water|no water|walang tubig|murky/i],
    ['Streetlight', /street ?light|lamp|dark|ilaw/i],
    ['Road damage', /pothole|road|crack|butas/i],
    ['Stray animals', /dog|aso|stray|pusa/i],
    ['Noise / disturbance', /noise|karaoke|loud|ingay|drunk|lasing/i],
    ['Security concern', /security|suspicious|theft|nakaw|trespass/i],
    ['Internet / utilities', /internet|wifi|wi-fi|cable|provider/i],
    ['Water leak (warranty)', /leak|tulo|tagas/i]
  ];

  on('input', e => {
    if (!e.target.matches('[data-suggest]')) return;
    const box = $('#suggest-box');
    const s = $('#category');
    if (!box || !s) return;
    const hit = RULES.find(r => r[1].test(e.target.value))?.[0];
    box.hidden = !(hit && s.value !== hit && $$('option', s).some(o => o.value === hit));
    if (!box.hidden) {
      box.innerHTML = `Looks like <b>${esc(hit)}</b>. <button type="button" class="link" data-use-cat="${esc(hit)}">Use this</button> <span class="small">· keyword preview</span>`;
    }
  });

  /* demo forms */
  const FORMS = {
    visitor: f => {
      const code = 'V-' + (2044 + Math.floor(Math.random() * 40));
      const name = f.elements.name.value.trim();
      const type = f.elements.type.value;
      const plate = f.elements.plate.value.trim();
      const timeVal = f.elements.time.value;

      $('#code-out').textContent = code;
      $('#code-name').textContent = name;

      const list = $('#resident-visitors-list');
      if (list) {
        const item = document.createElement('div');
        item.className = 'item';
        const timeStr = timeVal ? ` · ${timeVal}` : '';
        const plateStr = plate ? ` · ${esc(plate)}` : '';
        item.innerHTML = `
          <span class="item-ic brand"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14.5c2.5 0 4 1.5 4.5 4.5"/></svg></span>
          <span class="item-main">
            <span class="item-t">${esc(name)}${plateStr}</span>
            <span class="item-s">${esc(type)} · Today${esc(timeStr)} · code <b>${code}</b></span>
          </span>
          <span class="chip amber">Expected</span>
        `;
        list.prepend(item);
      }

      openDlg('code-dlg');
      f.reset();
      dates();
    },
    announce: f => {
      const list = $('#ann-list') || $('.ann')?.parentElement;
      if (!list) return toast('Could not find the announcement list.', 'err');
      const pin = f.elements.pin.checked;
      const a = document.createElement('article');
      a.className = 'ann' + (pin ? ' pin' : '');
      a.innerHTML = `<div class="ann-h"><b>${esc(f.elements.title.value)}</b>${pin ? '<span class="chip brand">Pinned</span>' : ''}</div><p>${esc(f.elements.body.value)}</p><small class="muted">just now · Posted by HOA</small>`;
      pin ? list.prepend(a) : list.insertBefore(a, $('.ann:not(.pin)', list));
      f.reset();
      toast('Announcement posted. Residents are notified (demo).');
    },
    walkin: addWalkIn,
    note: f => {
      const li = document.createElement('li');
      li.className = $('[data-status-chip]') ? currentStatus() : 'pending';
      li.innerHTML = `<span class="tl-dot"></span><div><b>Update</b> · just now<p>${esc(f.elements.note.value)} <small class="muted">— HOA</small></p></div>`;
      $('#timeline')?.prepend(li);
      f.reset();
      toast('Update posted. Resident notified (demo).');
    }
  };

  on('submit', e => {
    const f = e.target.closest('form[data-demo]');
    if (!f) return;
    e.preventDefault();
    if (!f.reportValidity()) return;
    if (FORMS[f.dataset.demo]) return FORMS[f.dataset.demo](f);
    toast(f.dataset.toast || 'Saved.');
    if (f.dataset.redirect) setTimeout(() => location.href = f.dataset.redirect, 900);
  });

  /* admin: request status */
  const currentStatus = () => $('#status-group .on')?.dataset.setStatus || 'pending';
  function setStatus(b) {
    const s = b.dataset.setStatus;
    const [label, tone] = STATUS[s];
    const c = $('[data-status-chip]');
    const li = document.createElement('li');
    $$('#status-group button').forEach(x => x.classList.toggle('on', x === b));
    if (c) {
      c.className = 'chip ' + tone;
      c.textContent = label;
    }
    li.className = s;
    li.innerHTML = `<span class="tl-dot"></span><div><b>${label}</b> · just now<p>Status changed by HOA.</p></div>`;
    $('#timeline')?.prepend(li);
    toast(`Status set to “${label}”. Resident notified (demo).`);
  }

  /* guard: gate log & live stats */
  const GATE = {
    expected: ['Expected', 'amber'],
    arrived: ['On site', 'green'],
    left: ['Left', ''],
    denied: ['Denied', 'red']
  };

  function updateGateStats() {
    const list = $('#gate-list');
    if (!list) return;
    const rows = $$('.gate-row', list);
    const counts = {
      expected: rows.filter(r => r.dataset.status === 'expected').length,
      arrived: rows.filter(r => r.dataset.status === 'arrived').length,
      left: rows.filter(r => r.dataset.status === 'left').length
    };
    const eEl = $('[data-gate-stat="expected"]');
    const aEl = $('[data-gate-stat="arrived"]');
    const lEl = $('[data-gate-stat="left"]');
    const totEl = $('[data-gate-total]');
    if (eEl) eEl.textContent = counts.expected;
    if (aEl) aEl.textContent = counts.arrived;
    if (lEl) lEl.textContent = counts.left;
    if (totEl) totEl.textContent = `${rows.length} record${rows.length === 1 ? '' : 's'}`;
  }

  function setGate(row, st, note) {
    const c = $('[data-gate-chip]', row);
    if (c) {
      c.className = 'chip ' + GATE[st][1];
      c.textContent = GATE[st][0];
    }
    row.dataset.status = st;
    const act = $('.gate-act', row);
    if (act) {
      act.innerHTML = st === 'arrived' ? '<button class="btn sm" data-gate="left">Mark left</button>' : '';
    }
    if (note) $('[data-gate-note]', row)?.replaceChildren(note);
    updateGateStats();
  }

  on('submit', e => {
    const f = e.target.closest('form[data-checkin]');
    const l = e.target.closest('form[data-code-lookup]');
    if (f) {
      e.preventDefault();
      const d = $('#checkin');
      const plate = f.elements.plate.value ? ' · Plate ' + f.elements.plate.value.toUpperCase() : '';
      setGate(document.getElementById(d.dataset.row), 'arrived', `ID left: ${f.elements.idleft.value}${plate} · in at ${now()}`);
      d.close();
      f.reset();
      toast('Checked in. Resident notified (demo).');
    } else if (l) {
      e.preventDefault();
      const code = l.elements.code.value.trim().toLowerCase();
      const rows = $$('.gate-row');
      const row = rows.find(r => (r.dataset.code || '').toLowerCase() === code);
      rows.forEach(r => r.style.background = '');
      if (!row) return toast('No visitor with that code. Use “Log a walk-in”.', 'err');
      row.style.background = 'var(--brand-soft)';
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast('Found: ' + row.dataset.name);
    }
  });

  function addWalkIn(f) {
    const id = 'w' + Date.now();
    const n = f.elements.name.value;
    const row = document.createElement('div');
    Object.assign(row, { className: 'gate-row', id });
    Object.assign(row.dataset, { name: 'Walk-in: ' + n, status: 'arrived', code: 'W-' + id.slice(-3) });
    row.innerHTML = `<div class="grow"><b>Walk-in: ${esc(n)}</b><div class="small muted">${esc(f.elements.type.value)} → ${esc(f.elements.dest.value)}${f.elements.confirmed.checked ? ' · confirmed by phone' : ' · <b style="color:var(--red)">not confirmed</b>'}</div><div class="small muted" data-gate-note>ID left: ${esc(f.elements.idleft.value)} · in at ${now()}</div></div><span class="chip green" data-gate-chip>On site</span><div class="gate-act"><button class="btn sm" data-gate="left">Mark left</button></div>`;
    $('#gate-list')?.prepend(row);
    $('#walkin')?.close();
    f.reset();
    updateGateStats();
    toast('Walk-in logged.');
  }

  /* CSV export of a table */
  function exportCsv(id, name) {
    const t = document.getElementById(id);
    if (!t) return;
    const rows = $$('tr', t)
      .filter(r => !r.hidden)
      .map(r => $$('th,td', r).map(c => '"' + c.textContent.replace(/\s+/g, ' ').trim().replace(/"/g, '""') + '"').join(','));
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv' })),
      download: name
    });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  /* hydrate request-detail.html when ?id= is provided, or filter from ?block= / ?type= */
  function hydrateFromQuery() {
    const params = new URLSearchParams(location.search);
    const block = params.get('block');
    if (block) {
      const sel = $('select[data-filter-for="req-table"][data-filter-key="block"]');
      if (sel && [...sel.options].some(o => o.value === block)) sel.value = block;
    }

    const reqType = params.get('type');
    if (reqType === 'service') {
      const cat = $('#category');
      if (cat) cat.value = 'Water leak (warranty)';
    }

    const id = params.get('id');
    const rep = id && REPORTS[id];
    const titleEl = $('[data-report-title]');
    if (rep && titleEl) {
      document.title = `Report ${id} · Carmela Subdivision`;
      titleEl.textContent = rep.title;
      $('[data-report-meta]').textContent = `${id} · ${rep.kind} · ${rep.category}`;
      $('[data-report-desc]').textContent = rep.desc;
      $('[data-report-where]').textContent = rep.where;
      $('[data-report-by]').textContent = rep.reporter;
      $('[data-report-when]').textContent = rep.reported;
      const aff = $('[data-affect-n]');
      if (aff) aff.textContent = rep.affected;

      const [stLabel, stTone] = STATUS[rep.status];
      const sc = $('[data-status-chip]');
      if (sc) {
        sc.className = 'chip ' + stTone;
        sc.textContent = stLabel;
      }

      const pc = $('[data-party-chip]');
      if (pc) {
        pc.className = 'chip ' + (rep.party === 'developer' ? 'red' : '');
        pc.textContent = 'Responsible: ' + PARTY_LABEL[rep.party];
      }

      const uc = $('[data-urgent-chip]');
      if (uc) uc.hidden = !rep.urgent;

      $$('#status-group button').forEach(b => b.classList.toggle('on', b.dataset.setStatus === rep.status));
      const partySel = $('[data-party]');
      if (partySel) partySel.value = rep.party;

      const waitBanner = $('#dev-wait');
      if (waitBanner) {
        waitBanner.hidden = rep.party !== 'developer';
        const dEl = $('[data-wait-days]', waitBanner);
        if (dEl) dEl.textContent = `${rep.waitDays || 1} days`;
      }

      const followup = $('#followup');
      if (followup) {
        followup.value = `Follow-up on ${id}: ${rep.title}\nLocation: ${rep.where}\nCategory: ${rep.category}\nFirst reported: ${rep.reported}\nPeople affected: ${rep.affected}\nDetails: ${rep.desc}\n\nPlease advise when this will be addressed. - Carmela Subdivision HOA`;
      }

      const tl = $('#timeline');
      if (tl) {
        tl.innerHTML = rep.timeline.map(item => `
          <li class="${item.cls}">
            <span class="tl-dot"></span>
            <div>
              <b>${esc(item.title)}</b> · ${esc(item.when)}
              <p>${esc(item.note)} <small class="muted">— ${esc(item.by)}</small></p>
            </div>
          </li>
        `).join('');
      }
    }
  }

  /* start-up */
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    $$('.view > *').forEach((el, i) => {
      el.classList.add('rv');
      el.style.animationDelay = Math.min(i * 45, 320) + 'ms';
    });
  }
  hydrateFromQuery();
  dates();
  updateGateStats();
  $$('[data-filter-for]').forEach(c => filter(c.dataset.filterFor));
})();
