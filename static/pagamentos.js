// pagamentos.js — Gerenciamento de formas de pagamento

async function salvarPagamento() {
  const nome = document.getElementById('pag-nome').value.trim();
  if (!nome) { alert('Informe o nome da forma de pagamento.'); return; }
  try {
    await addPagamento(nome);
    document.getElementById('pag-nome').value = '';
    await renderListaPagamentos();
  } catch(e) { alert('Erro: ' + e.message); }
}

async function renderListaPagamentos() {
  const el = document.getElementById('lista-pagamentos');
  el.innerHTML = '<div class="empty">Carregando...</div>';
  try {
    const lista = await getPagamentos();
    if (!lista.length) {
      el.innerHTML = '<div class="empty">Nenhuma forma de pagamento cadastrada</div>'; return;
    }
    el.innerHTML = lista.map(p => `
      <div class="list-item">
        <div class="list-info"><div class="list-name">${p.nome}</div></div>
        <button class="btn btn-danger" onclick="removerPagamento(${p.id})">
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M3 7h18"/>
          </svg>
          Remover
        </button>
      </div>`).join('');
  } catch(e) {
    el.innerHTML = '<div class="empty">Erro ao carregar.</div>';
  }
}

async function removerPagamento(id) {
  if (!confirm('Remover esta forma de pagamento?')) return;
  try {
    await deletePagamento(id);
    await renderListaPagamentos();
  } catch(e) { alert('Erro: ' + e.message); }
}
