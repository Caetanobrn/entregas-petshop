// novo-pedido.js

let itemRowsCount = 0;
const itemRowsData = {};
let clienteSelecionadoId = null;

async function initNovoPedido() {
  itemRowsCount = 0;
  clienteSelecionadoId = null;
  Object.keys(itemRowsData).forEach(k => delete itemRowsData[k]);
  document.getElementById('np-itens-body').innerHTML = '';
  document.getElementById('np-cliente-input').value = '';
  document.getElementById('np-cliente-tag').innerHTML = '';
  document.getElementById('np-cliente-ac').style.display = 'none';
  document.getElementById('np-nome-avulso').value = '';

  // Popular formas de pagamento
  try {
    const pagamentos = await getPagamentos();
    const sel = document.getElementById('np-pagamento');
    sel.innerHTML = '<option value="">Sem forma de pagamento</option>' +
      pagamentos.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
  } catch(e) { console.error(e); }

  adicionarItemRow();
}

// ── Busca de cliente ──────────────────────────

async function onClienteInput() {
  const val = document.getElementById('np-cliente-input').value.trim();
  const ac = document.getElementById('np-cliente-ac');
  const tag = document.getElementById('np-cliente-tag');
  clienteSelecionadoId = null;
  tag.innerHTML = '';

  if (val.length < 2) { ac.style.display = 'none'; return; }

  try {
    const lista = await getClientes(val);
    if (!lista.length) {
      ac.innerHTML = '<div style="padding:8px 12px;font-size:13px;color:var(--text-3);">Nenhum cliente encontrado</div>';
    } else {
      ac.innerHTML = lista.map(c => `
        <div class="ac-item" onclick="selecionarCliente(${c.id}, '${c.nome.replace(/'/g,"\\'")}', '${c.endereco.replace(/'/g,"\\'")}')">
          <span>${c.nome}</span>
          <small>${c.telefone} &middot; ${c.endereco}</small>
        </div>`).join('');
    }
    ac.style.display = 'block';
  } catch(e) { ac.style.display = 'none'; }
}

function selecionarCliente(id, nome, endereco) {
  clienteSelecionadoId = id;
  document.getElementById('np-cliente-input').value = nome;
  document.getElementById('np-cliente-ac').style.display = 'none';
  document.getElementById('np-nome-avulso').value = '';
  document.getElementById('np-cliente-tag').innerHTML =
    `<span class="badge badge-cat" style="margin-top:4px;display:inline-block;">${endereco}</span>`;
}

// ── Itens ─────────────────────────────────────

function adicionarItemRow() {
  const id = ++itemRowsCount;
  itemRowsData[id] = { produtoId: null, valorUnitario: null };
  const tbody = document.getElementById('np-itens-body');
  const tr = document.createElement('tr');
  tr.id = 'item-row-' + id;
  tr.innerHTML = `
    <td style="padding-right:8px;vertical-align:top;">
      <div class="autocomplete-wrap">
        <input type="text" id="item-desc-${id}" placeholder="Buscar produto ou digitar item livre..."
          oninput="onItemDescInput(${id})" autocomplete="off">
        <div class="ac-list" id="item-ac-${id}" style="display:none;"></div>
      </div>
      <div style="margin-top:4px;" id="item-tag-${id}"><span class="badge badge-free">item livre</span></div>
    </td>
    <td style="padding-right:8px;width:150px;vertical-align:top;">
      <select id="item-tipo-${id}" onchange="onItemTipoChange(${id})">
        <option value="peso">Peso (kg)</option>
        <option value="valor">Valor direto (R$)</option>
        <option value="un">Unidade (qtd)</option>
      </select>
    </td>
    <td style="padding-right:8px;width:100px;vertical-align:top;">
      <input type="number" id="item-qtd-${id}" placeholder="Qtd" step="0.01" min="0" oninput="recalcularTotal()">
    </td>
    <td style="padding-right:8px;width:100px;vertical-align:top;">
      <input type="number" id="item-vunit-${id}" placeholder="R$ unit." step="0.01" min="0" oninput="recalcularTotal()">
    </td>
    <td style="width:36px;vertical-align:top;padding-top:2px;">
      <button class="btn btn-danger btn-xs" onclick="removerItemRow(${id})">
        <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </td>`;
  tbody.appendChild(tr);
}

function removerItemRow(id) {
  document.getElementById('item-row-' + id)?.remove();
  delete itemRowsData[id];
  recalcularTotal();
}

async function onItemDescInput(id) {
  const val = document.getElementById('item-desc-' + id).value;
  const ac = document.getElementById('item-ac-' + id);
  const tag = document.getElementById('item-tag-' + id);
  itemRowsData[id].produtoId = null;
  itemRowsData[id].valorUnitario = null;
  tag.innerHTML = '<span class="badge badge-free">item livre</span>';
  if (!val.trim()) { ac.style.display = 'none'; return; }
  try {
    const matches = await searchProdutos(val);
    if (!matches.length) { ac.style.display = 'none'; return; }
    ac.innerHTML = matches.map(p =>
      `<div class="ac-item" onclick="selecionarProduto(${id},${p.id},'${p.nome.replace(/'/g,"\\'")}','${p.unidade}','${p.valor||''}')">
        <span>${p.nome}</span>
        <small>${p.unidade}${p.valor ? ' &middot; R$ '+parseFloat(p.valor).toFixed(2) : ''}</small>
      </div>`).join('');
    ac.style.display = 'block';
  } catch(e) { ac.style.display = 'none'; }
}

function selecionarProduto(rowId, prodId, nome, unidade, valor) {
  document.getElementById('item-desc-' + rowId).value = nome;
  document.getElementById('item-ac-' + rowId).style.display = 'none';
  document.getElementById('item-tag-' + rowId).innerHTML = '<span class="badge badge-cat">produto cadastrado</span>';
  itemRowsData[rowId].produtoId = prodId;
  itemRowsData[rowId].valorUnitario = valor ? parseFloat(valor) : null;
  const sel = document.getElementById('item-tipo-' + rowId);
  sel.value = unidade === 'kg' ? 'peso' : 'un';
  if (valor) document.getElementById('item-vunit-' + rowId).value = parseFloat(valor).toFixed(2);
  recalcularTotal();
}

function onItemTipoChange(rowId) {
  recalcularTotal();
}

function recalcularTotal() {
  let total = 0;
  document.querySelectorAll('#np-itens-body tr').forEach(tr => {
    const rowId = parseInt(tr.id.replace('item-row-', ''));
    if (!rowId) return;
    const tipo = document.getElementById('item-tipo-' + rowId)?.value;
    const qtd = parseFloat(document.getElementById('item-qtd-' + rowId)?.value) || 0;
    const vunit = parseFloat(document.getElementById('item-vunit-' + rowId)?.value) || 0;
    if (tipo === 'valor') {
      total += qtd; // valor direto
    } else if (qtd > 0 && vunit > 0) {
      total += qtd * vunit;
    }
  });
  const el = document.getElementById('np-total');
  if (el) el.textContent = total > 0 ? `Total: R$ ${total.toFixed(2)}` : '';
  return total;
}

function coletarItens() {
  const itens = [];
  document.querySelectorAll('#np-itens-body tr').forEach(tr => {
    const rowId = parseInt(tr.id.replace('item-row-', ''));
    if (!rowId) return;
    const desc = (document.getElementById('item-desc-' + rowId)?.value || '').trim();
    if (!desc) return;
    const tipo = document.getElementById('item-tipo-' + rowId)?.value;
    const qtd = document.getElementById('item-qtd-' + rowId)?.value || '';
    const vunit = document.getElementById('item-vunit-' + rowId)?.value || '';
    const item = { desc, tipo };
    if (tipo === 'peso') { item.qtd = qtd; item.unidade = 'kg'; item.valor = vunit; }
    else if (tipo === 'un') { item.qtd = qtd; item.unidade = 'un'; item.valor = vunit; }
    else if (tipo === 'valor') { item.valor = qtd; }
    itens.push(item);
  });
  return itens;
}

async function salvarNovoPedido() {
  const nomeAvulso = document.getElementById('np-nome-avulso').value.trim();
  if (!clienteSelecionadoId && !nomeAvulso) {
    alert('Selecione um cliente ou informe um nome para o pedido.'); return;
  }
  const itens = coletarItens();
  if (!itens.length) { alert('Adicione ao menos um item ao pedido.'); return; }
  const pagamentoId = document.getElementById('np-pagamento').value || null;
  const total = recalcularTotal();
  try {
    await addPedido(clienteSelecionadoId, nomeAvulso, itens, pagamentoId, total || null);
    showPage('pedidos');
  } catch(e) {
    alert('Erro ao salvar pedido: ' + e.message);
  }
}

document.addEventListener('click', e => {
  if (!e.target.closest('#np-cliente-wrap') && !e.target.closest('.autocomplete-wrap')) {
    document.querySelectorAll('.ac-list').forEach(el => el.style.display = 'none');
    const ac = document.getElementById('np-cliente-ac');
    if (ac) ac.style.display = 'none';
  }
});
