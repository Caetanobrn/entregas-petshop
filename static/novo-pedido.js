// novo-pedido.js — Formulario de criacao de pedido com itens hibridos

let itemRowsCount = 0;
const itemRowsData = {};

async function initNovoPedido() {
  itemRowsCount = 0;
  Object.keys(itemRowsData).forEach(k => delete itemRowsData[k]);
  document.getElementById('np-itens-body').innerHTML = '';

  try {
    const [clientes, entregadores] = await Promise.all([getClientes(), getEntregadores()]);

    document.getElementById('np-cliente').innerHTML =
      '<option value="">Selecionar cliente...</option>' +
      clientes.map(c => `<option value="${c.id}">${c.nome} — ${c.endereco}</option>`).join('');

    document.getElementById('np-entregador').innerHTML =
      '<option value="">Selecionar entregador...</option>' +
      entregadores.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
  } catch (e) {
    console.error('Erro ao carregar selects:', e);
  }

  adicionarItemRow();
}

function adicionarItemRow() {
  const id = ++itemRowsCount;
  itemRowsData[id] = { produtoId: null };

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
      <div style="margin-top:4px;" id="item-tag-${id}">
        <span class="badge badge-free">item livre</span>
      </div>
    </td>
    <td style="padding-right:8px;width:160px;vertical-align:top;">
      <select id="item-tipo-${id}" onchange="onItemTipoChange(${id})">
        <option value="peso">Peso (kg)</option>
        <option value="valor">Valor (R$)</option>
        <option value="ambos">Peso e valor</option>
        <option value="un">Unidade (qtd)</option>
      </select>
    </td>
    <td style="padding-right:8px;width:120px;vertical-align:top;" id="item-qtd-cell-${id}">
      <input type="number" id="item-qtd-${id}" placeholder="0.00" step="0.01" min="0">
    </td>
    <td style="width:90px;vertical-align:top;" id="item-val-cell-${id}"></td>
    <td style="width:36px;vertical-align:top;padding-top:2px;">
      <button class="btn btn-danger btn-xs" onclick="removerItemRow(${id})" title="Remover">
        <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </td>`;
  tbody.appendChild(tr);
}

function removerItemRow(id) {
  const tr = document.getElementById('item-row-' + id);
  if (tr) tr.remove();
  delete itemRowsData[id];
}

async function onItemDescInput(id) {
  const val = document.getElementById('item-desc-' + id).value;
  const ac = document.getElementById('item-ac-' + id);
  const tag = document.getElementById('item-tag-' + id);

  itemRowsData[id].produtoId = null;
  tag.innerHTML = '<span class="badge badge-free">item livre</span>';

  if (!val.trim()) { ac.style.display = 'none'; return; }

  try {
    const matches = await searchProdutos(val);
    if (!matches.length) { ac.style.display = 'none'; return; }

    ac.innerHTML = matches.map(p =>
      `<div class="ac-item" onclick="selecionarProduto(${id}, ${p.id}, '${p.nome.replace(/'/g,"\\'")}', '${p.unidade}', '${p.valor || ''}')">
        <span>${p.nome}</span>
        <small>${p.unidade}${p.valor ? ' &middot; R$ ' + parseFloat(p.valor).toFixed(2) : ''}</small>
      </div>`
    ).join('');
    ac.style.display = 'block';
  } catch (e) {
    ac.style.display = 'none';
  }
}

function selecionarProduto(rowId, prodId, nome, unidade, valor) {
  document.getElementById('item-desc-' + rowId).value = nome;
  document.getElementById('item-ac-' + rowId).style.display = 'none';
  document.getElementById('item-tag-' + rowId).innerHTML =
    '<span class="badge badge-cat">produto cadastrado</span>';

  itemRowsData[rowId].produtoId = prodId;

  const sel = document.getElementById('item-tipo-' + rowId);
  if (unidade === 'kg') sel.value = 'peso';
  else if (unidade === 'l') sel.value = 'valor';
  else sel.value = 'un';

  if (valor) document.getElementById('item-qtd-' + rowId).value = valor;
  onItemTipoChange(rowId);
}

function onItemTipoChange(rowId) {
  const tipo = document.getElementById('item-tipo-' + rowId).value;
  const qtdCell = document.getElementById('item-qtd-cell-' + rowId);
  const valCell = document.getElementById('item-val-cell-' + rowId);

  if (tipo === 'ambos') {
    qtdCell.innerHTML = `<input type="number" id="item-qtd-${rowId}" placeholder="Peso (kg)" step="0.01" min="0">`;
    valCell.innerHTML = `<input type="number" id="item-val-${rowId}" placeholder="Valor (R$)" step="0.01" min="0">`;
    valCell.style.display = '';
  } else {
    const label = tipo === 'peso' ? 'Peso (kg)' : tipo === 'valor' ? 'Valor (R$)' : 'Quantidade';
    qtdCell.innerHTML = `<input type="number" id="item-qtd-${rowId}" placeholder="${label}" step="0.01" min="0">`;
    valCell.style.display = 'none';
    valCell.innerHTML = '';
  }
}

function coletarItens() {
  const itens = [];
  document.querySelectorAll('#np-itens-body tr').forEach(tr => {
    const rowId = parseInt(tr.id.replace('item-row-', ''));
    if (!rowId) return;

    const desc = (document.getElementById('item-desc-' + rowId)?.value || '').trim();
    if (!desc) return;

    const tipo = document.getElementById('item-tipo-' + rowId)?.value;
    const qtdEl = document.getElementById('item-qtd-' + rowId);
    const valEl = document.getElementById('item-val-' + rowId);
    const qtd = qtdEl?.value || '';
    const val = valEl?.value || '';

    const item = { desc, tipo };
    if (tipo === 'peso') { item.qtd = qtd; item.unidade = 'kg'; }
    else if (tipo === 'valor') { item.valor = qtd; }
    else if (tipo === 'un') { item.qtd = qtd; item.unidade = 'un'; }
    else if (tipo === 'ambos') { item.qtd = qtd; item.unidade = 'kg'; item.valor = val; }

    itens.push(item);
  });
  return itens;
}

async function salvarNovoPedido() {
  const clienteId = parseInt(document.getElementById('np-cliente').value);
  const entregadorId = parseInt(document.getElementById('np-entregador').value);

  if (!clienteId) { alert('Selecione um cliente.'); return; }
  if (!entregadorId) { alert('Selecione um entregador.'); return; }

  const itens = coletarItens();
  if (!itens.length) { alert('Adicione ao menos um item ao pedido.'); return; }

  try {
    await addPedido(clienteId, entregadorId, itens);
    showPage('pedidos');
  } catch (e) {
    alert('Erro ao salvar pedido: ' + e.message);
  }
}

document.addEventListener('click', e => {
  if (!e.target.closest('.autocomplete-wrap')) {
    document.querySelectorAll('.ac-list').forEach(el => el.style.display = 'none');
  }
});
