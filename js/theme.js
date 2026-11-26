try {
  const theme=localStorage.getItem('cc_theme');
  if(theme) document.documentElement.dataset.theme=theme;
} catch {}
