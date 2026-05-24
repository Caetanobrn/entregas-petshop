// nav.js — Controle de navegacao entre paginas

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
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      showPage(link.dataset.page);
    });
  });
  showPage('pedidos');
});
