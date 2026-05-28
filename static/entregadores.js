// entregadores.js

async function salvarEntregador() {
  const nome = document.getElementById('e-nome').value.trim();
  const telefone = document.getElementById('e-tel').value.trim();
  if (!nome) { alert('Informe o nome do entregador.'); return; }
  if (!telefone) { alert('Informe o telefone do entregador.'); return; }
  try {
    await addEntregador(nome, telefone);
    document.getElementById('e-nome').value = '';
    document.getElementById('e-tel').value = '';
    await renderListaEntregadores();
  } catch(e) { alert('Erro ao salvar entregador: ' + e.message); }
}

async function renderListaEntregadores() {
  const el = document.getElementById('lista-entregadores');
  el.innerHTML = '<div class="empty">Carregando...</div>';
  try {
    const lista = await getEntregadores();
    if (!lista.length) {
      el.innerHTML = `<div class="empty">
        <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M12 4a4 4 0 100 8 4 4 0 000-8zM6 20v-1a6 6 0 0112 0v1"/>
        </svg>Nenhum entregador cadastrado</div>`; return;
    }
    el.innerHTML = lista.map(e => `
      <div class="list-item">
        <div class="list-info">
          <div class="list-name">${e.nome}</div>
          <div class="list-sub">${e.telefone}</div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm" onclick="abrirEdicaoEntregador(${e.id},'${e.nome.replace(/'/g,"\\'")}','${e.telefone.replace(/'/g,"\\'")}')">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>Editar
          </button>
          <button class="btn btn-danger" onclick="removerEntregador(${e.id})">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M3 7h18"/>
            </svg>Remover
          </button>
        </div>
      </div>`).join('');
  } catch(e) {
    el.innerHTML = '<div class="empty">Erro ao carregar entregadores.</div>';
  }
}

function abrirEdicaoEntregador(id, nome, telefone) {
  document.getElementById('edit-e-id').value = id;
  document.getElementById('edit-e-nome').value = nome;
  document.getElementById('edit-e-tel').value = telefone;
  document.getElementById('modal-edit-entregador').style.display = 'flex';
}

function fecharEdicaoEntregador() {
  document.getElementById('modal-edit-entregador').style.display = 'none';
}

async function confirmarEdicaoEntregador() {
  const id = parseInt(document.getElementById('edit-e-id').value);
  const nome = document.getElementById('edit-e-nome').value.trim();
  const telefone = document.getElementById('edit-e-tel').value.trim();
  if (!nome || !telefone) { alert('Preencha todos os campos.'); return; }
  try {
    await editarEntregador(id, { nome, telefone });
    fecharEdicaoEntregador();
    await renderListaEntregadores();
  } catch(e) { alert('Erro ao editar entregador: ' + e.message); }
}

async function removerEntregador(id) {
  if (!confirm('Remover este entregador?')) return;
  try {
    await deleteEntregador(id);
    await renderListaEntregadores();
  } catch(e) { alert('Erro ao remover entregador: ' + e.message); }
}
