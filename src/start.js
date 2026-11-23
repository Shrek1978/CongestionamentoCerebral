import('./app.js').catch(error => {
  document.querySelector('.shell').hidden = true;
  document.getElementById('settings-open').disabled = true;
  const status = document.getElementById('catalog-error');
  status.textContent = `Não foi possível carregar os desafios. ${error.message}`;
  status.hidden = false;
  console.error(error);
});
