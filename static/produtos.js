// produtos.js — Produtos com opcoes

let _produtoAtual = null; // produto sendo editado/gerenciado

// ── Cadastro ──────────────────────────────────

async function salvarProduto() {
  const nome = document.getElementById('p-nome').value.trim();
  if (!nome) { alert('Informe o nome do produto.'); return; }
  try {
    const prod = await addProduto(nome, []);
    document.getElementById('p-nome').value = '';
    await renderListaProdutos();
    // Abre automaticamente o gerenciador de opcoes
    abrirGerenciarOpcoes(prod);
  } catch(e) { alert('Erro ao salvar produto: ' + e.message); }
}

// ── Listagem ──────────────────────────────────

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
    el.innerHTML = lista.map(p => {
      const opcoesHtml = p.opcoes.length
        ? p.opcoes.map(o =>
            `<span style="font-size:11.5px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:1px 7px;margin-right:4px;">
              ${o.descricao}${o.valor ? ` &middot; R$ ${parseFloat(o.valor).toFixed(2)}` : ''}
            </span>`).join('')
        : '<span style="font-size:12px;color:var(--text-3);">Sem opcoes cadastradas</span>';

      return `<div class="list-item" style="flex-direction:column;align-items:flex-start;gap:8px;">
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
          <div class="list-name">${p.nome}</div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm" onclick="abrirGerenciarOpcoes(${JSON.stringify(p).replace(/"/g,'&quot;')})">
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>Opcoes
            </button>
            <button class="btn btn-sm" onclick="abrirEdicaoProduto(${p.id},'${p.nome.replace(/'/g,"\\'")}')">
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>Renomear
            </button>
            <button class="btn btn-danger" onclick="removerProduto(${p.id})">
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M3 7h18"/>
              </svg>Remover
            </button>
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">${opcoesHtml}</div>
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = '<div class="empty">Erro ao carregar produtos.</div>';
  }
}

// ── Renomear produto ──────────────────────────

function abrirEdicaoProduto(id, nome) {
  document.getElementById('edit-p-id').value = id;
  document.getElementById('edit-p-nome').value = nome;
  document.getElementById('modal-edit-produto').style.display = 'flex';
}

function fecharEdicaoProduto() {
  document.getElementById('modal-edit-produto').style.display = 'none';
}

async function confirmarEdicaoProduto() {
  const id = parseInt(document.getElementById('edit-p-id').value);
  const nome = document.getElementById('edit-p-nome').value.trim();
  if (!nome) { alert('Informe o nome do produto.'); return; }
  try {
    await editarProduto(id, { nome });
    fecharEdicaoProduto();
    await renderListaProdutos();
  } catch(e) { alert('Erro ao editar produto: ' + e.message); }
}

async function removerProduto(id) {
  if (!confirm('Remover este produto e todas as suas opcoes?')) return;
  try {
    await deleteProduto(id);
    await renderListaProdutos();
  } catch(e) { alert('Erro ao remover produto: ' + e.message); }
}

// ── Gerenciar opcoes ──────────────────────────

function abrirGerenciarOpcoes(prod) {
  if (typeof prod === 'string') prod = JSON.parse(prod);
  _produtoAtual = prod;
  document.getElementById('modal-opcoes-titulo').textContent = prod.nome;
  document.getElementById('modal-opcoes-desc').value = '';
  document.getElementById('modal-opcoes-unidade').value = 'un';
  document.getElementById('modal-opcoes-valor').value = '';
  renderOpcoesList(prod.opcoes);
  document.getElementById('modal-opcoes').style.display = 'flex';
}

function fecharGerenciarOpcoes() {
  document.getElementById('modal-opcoes').style.display = 'none';
  _produtoAtual = null;
}

function renderOpcoesList(opcoes) {
  const el = document.getElementById('modal-opcoes-lista');
  if (!opcoes.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--text-3);padding:8px 0;">Nenhuma opcao cadastrada ainda.</div>';
    return;
  }
  el.innerHTML = opcoes.map(o => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);">
      <div style="flex:1;">
        <span style="font-size:13px;font-weight:500;">${o.descricao}</span>
        <span style="font-size:12px;color:var(--text-3);margin-left:6px;">${o.unidade}${o.valor ? ` &middot; R$ ${parseFloat(o.valor).toFixed(2)}` : ''}</span>
      </div>
      <button class="btn btn-sm" onclick="iniciarEdicaoOpcao(${o.id},'${o.descricao.replace(/'/g,"\\'")}','${o.unidade}','${o.valor||''}')">
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="btn btn-danger btn-xs" onclick="removerOpcao(${o.id})">
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>`).join('');
}

async function adicionarOpcao() {
  if (!_produtoAtual) return;
  const desc = document.getElementById('modal-opcoes-desc').value.trim();
  const unidade = document.getElementById('modal-opcoes-unidade').value;
  const valor = document.getElementById('modal-opcoes-valor').value;
  if (!desc) { alert('Informe a descricao da opcao (ex: 15kg, 3kg, 500g).'); return; }
  try {
    const prod = await addOpcao(_produtoAtual.id, desc, unidade, valor);
    _produtoAtual = prod;
    document.getElementById('modal-opcoes-desc').value = '';
    document.getElementById('modal-opcoes-valor').value = '';
    renderOpcoesList(prod.opcoes);
    await renderListaProdutos();
  } catch(e) { alert('Erro: ' + e.message); }
}

// Edicao inline de opcao
let _opcaoEditandoId = null;

function iniciarEdicaoOpcao(id, desc, unidade, valor) {
  _opcaoEditandoId = id;
  document.getElementById('modal-opcoes-desc').value = desc;
  document.getElementById('modal-opcoes-unidade').value = unidade;
  document.getElementById('modal-opcoes-valor').value = valor;
  document.getElementById('btn-add-opcao').style.display = 'none';
  document.getElementById('btn-salvar-edicao-opcao').style.display = 'inline-flex';
  document.getElementById('btn-cancelar-edicao-opcao').style.display = 'inline-flex';
}

function cancelarEdicaoOpcao() {
  _opcaoEditandoId = null;
  document.getElementById('modal-opcoes-desc').value = '';
  document.getElementById('modal-opcoes-unidade').value = 'un';
  document.getElementById('modal-opcoes-valor').value = '';
  document.getElementById('btn-add-opcao').style.display = 'inline-flex';
  document.getElementById('btn-salvar-edicao-opcao').style.display = 'none';
  document.getElementById('btn-cancelar-edicao-opcao').style.display = 'none';
}

async function salvarEdicaoOpcao() {
  if (!_produtoAtual || !_opcaoEditandoId) return;
  const desc = document.getElementById('modal-opcoes-desc').value.trim();
  const unidade = document.getElementById('modal-opcoes-unidade').value;
  const valor = document.getElementById('modal-opcoes-valor').value;
  if (!desc) { alert('Informe a descricao.'); return; }
  try {
    const prod = await editarOpcao(_produtoAtual.id, _opcaoEditandoId, { descricao: desc, unidade, valor });
    _produtoAtual = prod;
    cancelarEdicaoOpcao();
    renderOpcoesList(prod.opcoes);
    await renderListaProdutos();
  } catch(e) { alert('Erro: ' + e.message); }
}

async function removerOpcao(opcaoId) {
  if (!_produtoAtual) return;
  if (!confirm('Remover esta opcao?')) return;
  try {
    const prod = await deletarOpcao(_produtoAtual.id, opcaoId);
    _produtoAtual = prod;
    renderOpcoesList(prod.opcoes);
    await renderListaProdutos();
  } catch(e) { alert('Erro: ' + e.message); }
}
