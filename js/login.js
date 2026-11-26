(() => {
  try { const theme=localStorage.getItem('cc_theme');if(theme) document.documentElement.dataset.theme=theme; } catch {}
  const roles={resident:['Resident','maria.santos@carmela.ph'],admin:['HOA Admin','admin@carmela.ph'],guard:['Guard','guard.tony@carmela.ph']};
  const role=new URLSearchParams(location.search).get('role')||'resident';
  if(!roles[role]) { location.replace('/'); return; }
  const [label,email]=roles[role];
  document.querySelector('#login-title').textContent=label+' Log in';
  document.querySelector('#login-description').textContent='Enter your email and password.';
  const form=document.querySelector('#demo-login');
  document.querySelector('.password-toggle')?.addEventListener('click',event=>{
    const button=event.currentTarget;
    const showing=form.elements.pass.type==='password';
    form.elements.pass.type=showing?'text':'password';
    button.textContent=showing?'Hide':'Show';
    button.setAttribute('aria-label',showing?'Hide password':'Show password');
    button.setAttribute('aria-pressed',String(showing));
  });
  form.elements.email.value=email;
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=form.querySelector('button[type="submit"]');button.disabled=true;
    const error=document.querySelector('#login-error');error.textContent='';
    try {
      const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.elements.email.value,password:form.elements.pass.value})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error);
      const destinations={resident:'/resident/home.html',admin:'/admin/dashboard.html',guard:'/guard/gate.html'};
      location.assign(destinations[data.user.role]);
    } catch(e) { error.textContent=e.message;button.disabled=false; }
  });
})();
