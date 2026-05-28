// produtos.js

async function salvarProduto() {
  const nome = document.getElementById('p-nome').value.trim();
  const unidade = document.getElementById('p-unidade').value;
  const valor = document.getElementById('p-valor').value;
  if (!nome) { alert('Informe o nome do produto.'); return; }
  try {
    await addProduto(nome, unidade, valor);
    document.getElementById('p-nome').value = '';
    document.getElementById('p-valor').value = '';
    await renderListaProdutos();
  } catch(e) { alert('Erro ao salvar produto: ' + e.message); }
}

async function renderListaProdutos() {
  const el = document.getElementById('lista-produtos');
  el.innerHTML = '<div class="empty">Carregando...</div>';
  try {
    const lista = await getProdutos();
    if (!lista.length) {
      el.innerHTML = `<div class="empty">
        <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M20 7H4a1 1 0 00-1 1v10a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1zM16 3H8l-2 4h12l-2-4z"/>
        </svg>Nenhum produto cadastrado</div>`; return;
    }
    el.innerHTML = lista.map(p => `
      <div class="list-item">
        <div class="list-info">
          <div class="list-name">${p.nome}</div>
          <div class="list-sub">
            ${p.unidade}${p.valor ? ` &middot; R$ ${parseFloat(p.valor).toFixed(2)}` : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm" onclick="abrirEdicaoProduto(${p.id},'${p.nome.replace(/'/g,"\\'")}','${p.unidade}','${p.valor||''}')">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>Editar
          </button>
          <button class="btn btn-danger" onclick="removerProduto(${p.id})">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M3 7h18"/>
            </svg>Remover
          </button>
        </div>
      </div>`).join('');
  } catch(e) {
    el.innerHTML = '<div class="empty">Erro ao carregar produtos.</div>';
  }
}

function abrirEdicaoProduto(id, nome, unidade, valor) {
  document.getElementById('edit-p-id').value = id;
  document.getElementById('edit-p-nome').value = nome;
  document.getElementById('edit-p-unidade').value = unidade;
  document.getElementById('edit-p-valor').value = valor;
  document.getElementById('modal-edit-produto').style.display = 'flex';
}

function fecharEdicaoProduto() {
  document.getElementById('modal-edit-produto').style.display = 'none';
}

async function confirmarEdicaoProduto() {
  const id = parseInt(document.getElementById('edit-p-id').value);
  const nome = document.getElementById('edit-p-nome').value.trim();
  const unidade = document.getElementById('edit-p-unidade').value;
  const valor = document.getElementById('edit-p-valor').value;
  if (!nome) { alert('Informe o nome do produto.'); return; }
  try {
    await editarProduto(id, { nome, unidade, valor });
    fecharEdicaoProduto();
    await renderListaProdutos();
  } catch(e) { alert('Erro ao editar produto: ' + e.message); }
}

async function removerProduto(id) {
  if (!confirm('Remover este produto?')) return;
  try {
    await deleteProduto(id);
    await renderListaProdutos();
  } catch(e) { alert('Erro ao remover produto: ' + e.message); }
}
