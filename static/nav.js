// nav.js — Controle de navegacao, autenticacao e logout

async function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');

  const link = document.querySelector(`.nav-link[data-page="${id}"]`);
  if (link) link.classList.add('active');

  if (id === 'pedidos')      { await renderMetricas(); await renderPedidos(); }
  if (id === 'novo-pedido')  { await initNovoPedido(); }
  if (id === 'clientes')     { await renderListaClientes(); }
  if (id === 'entregadores') { await renderListaEntregadores(); }
  if (id === 'produtos')     { await renderListaProdutos(); }
  if (id === 'pagamentos')   { await renderListaPagamentos(); }
  if (id === 'relatorios')   { await renderRelatorios(); }
}

async function fazerLogout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
}

document.addEventListener('DOMContentLoaded', async () => {
  // Verifica se esta logado e exibe o nome do usuario na navbar
  try {
    const res = await fetch('/api/me');
    const d = await res.json();
    if (!d.logado) {
      window.location.href = '/login';
      return;
    }
    const el = document.getElementById('nav-usuario');
    if (el) el.textContent = d.usuario;
  } catch (e) {
    window.location.href = '/login';
    return;
  }

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      showPage(link.dataset.page);
    });
  });

  showPage('pedidos');
});
