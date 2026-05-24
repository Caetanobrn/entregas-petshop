// clientes.js — Cadastro e listagem de clientes

async function salvarCliente() {
  const nome = document.getElementById('c-nome').value.trim();
  const telefone = document.getElementById('c-tel').value.trim();
  const endereco = document.getElementById('c-end').value.trim();

  if (!nome) { alert('Informe o nome do cliente.'); return; }
  if (!telefone) { alert('Informe o telefone do cliente.'); return; }
  if (!endereco) { alert('Informe o endereco do cliente.'); return; }

  try {
    await addCliente(nome, telefone, endereco);
    document.getElementById('c-nome').value = '';
    document.getElementById('c-tel').value = '';
    document.getElementById('c-end').value = '';
    await renderListaClientes();
  } catch (e) {
    alert('Erro ao salvar cliente: ' + e.message);
  }
}

async function renderListaClientes() {
  const el = document.getElementById('lista-clientes');
  el.innerHTML = '<div class="empty">Carregando...</div>';

  try {
    const lista = await getClientes();

    if (!lista.length) {
      el.innerHTML = `<div class="empty">
        <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8z"/>
        </svg>
        Nenhum cliente cadastrado
      </div>`;
      return;
    }

    el.innerHTML = lista.map(c => `
      <div class="list-item">
        <div class="list-info">
          <div class="list-name">${c.nome}</div>
          <div class="list-sub">
            ${c.telefone}
            <span style="margin:0 4px;">&middot;</span>
            ${c.endereco}
          </div>
        </div>
        <button class="btn btn-danger" onclick="removerCliente(${c.id})" title="Remover cliente">
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M3 7h18"/>
          </svg>
          Remover
        </button>
      </div>`).join('');
  } catch (e) {
    el.innerHTML = '<div class="empty">Erro ao carregar clientes. O servidor esta rodando?</div>';
    console.error(e);
  }
}

async function removerCliente(id) {
  if (!confirm('Remover este cliente?')) return;
  try {
    await deleteCliente(id);
    await renderListaClientes();
  } catch (e) {
    alert('Erro ao remover cliente: ' + e.message);
  }
}
