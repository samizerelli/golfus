// Applique le thème clair / sombre avant le premier rendu pour éviter un flash
try {
  var t = JSON.parse(localStorage.getItem('gf.theme') || '"system"');
  if (t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
} catch (e) {}
