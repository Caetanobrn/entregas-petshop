// pedidos.js

function badgeHtml(status) {
  const map = {
    aguardando: ['badge-wait', '&#9679; Aguardando'],
    rota:       ['badge-route', '&#9654; Em rota'],
    concluido:  ['badge-done', '&#10003; Concluido'],
    cancelado:  ['badge-cancel', '&#10005; Cancelado']
  };
  const [cls, label] = map[status] || ['badge-wait', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

function timelineHtml(status) {
  if (status === 'cancelado') return '<div style="font-size:12px;color:var(--danger);margin:6px 0;">Pedido cancelado</div>';
  const steps = ['aguardando', 'rota', 'concluido'];
  const labels = ['Aguardando', 'Em rota', 'Concluido'];
  const cur = steps.indexOf(status);
  return '<div class="timeline">' + steps.map((s, i) => {
    const cls = i < cur ? 'done' : (i === cur ? 'active' : '');
    return `<span class="tl-step ${cls}">${labels[i]}</span>`;
  }).join('') + '</div>';
}

function itensResumo(itens) {
  return itens.map(item => {
    const desc = item.descricao || item.desc || '';
    const qtd = parseFloat(item.qtd) || 0;
    const vunit = parseFloat(item.valor) || 0;
    let linha = desc;
    if (item.tipo === 'valor') {
      linha += vunit > 0 ? ` &mdash; R$ ${vunit.toFixed(2)}` : '';
    } else {
      if (qtd > 0) linha += ` &mdash; ${qtd} ${item.unidade || ''}`;
      if (vunit > 0) linha += ` &mdash; R$ ${vunit.toFixed(2)}/un`;
      if (qtd > 0 && vunit > 0) linha += ` <strong>= R$ ${(qtd*vunit).toFixed(2)}</strong>`;
    }
    return linha;
  }).join('<br>');
}

function calcularTotal(itens) {
  return itens.reduce((acc, item) => {
    const qtd = parseFloat(item.qtd) || 0;
    const vunit = parseFloat(item.valor) || 0;
    if (item.tipo === 'valor') return acc + vunit;
    if (qtd > 0 && vunit > 0) return acc + qtd * vunit;
    return acc;
  }, 0);
}

async function renderMetricas() {
  try {
    const m = await getMetricas();
    document.getElementById('met-total').textContent = m.total;
    document.getElementById('met-rota').textContent = m.rota;
    document.getElementById('met-concluidos').textContent = m.concluidos;
  } catch(e) { console.error(e); }
}

async function renderPedidos() {
  const filtro = document.getElementById('filtro-status').value;
  const container = document.getElementById('lista-pedidos');
  const count = document.getElementById('pedidos-count');
  container.innerHTML = '<div class="empty">Carregando...</div>';
  try {
    const [lista, clientes, entregadores, pagamentos] = await Promise.all([
      getPedidos(filtro), getClientes(), getEntregadores(), getPagamentos()
    ]);
    count.textContent = lista.length + ' pedido' + (lista.length !== 1 ? 's' : '');
    if (!lista.length) {
      container.innerHTML = `<div class="empty">
        <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M20 7H4a1 1 0 00-1 1v10a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1zM16 3H8l-2 4h12l-2-4z"/>
        </svg>Nenhum pedido encontrado</div>`; return;
    }
    container.innerHTML = lista.map(p => {
      const cliente = clientes.find(c => c.id === p.cliente_id);
      const entregador = entregadores.find(e => e.id === p.entregador_id);
      const pagamento = pagamentos.find(pg => pg.id === p.pagamento_id);
      const nomeExibido = p.nome_avulso || (cliente ? cliente.nome : 'Cliente removido');
      const endCliente = cliente ? `<span style="color:var(--text-3)"> &middot; ${cliente.endereco}</span>` : (p.nome_avulso ? ' <span class="badge badge-free">sem cadastro</span>' : '');
      const nomeEntregador = entregador ? entregador.nome : (p.status === 'aguardando' ? 'A definir' : 'Entregador removido');
      const total = p.total || calcularTotal(p.itens);
      const totalHtml = total > 0 ? `<span style="font-weight:600;color:var(--accent);">Total: R$ ${total.toFixed(2)}</span>` : '';
      const pagHtml = pagamento ? `<span class="badge badge-free" style="margin-left:4px;">${pagamento.nome}</span>` : '';
      let acoes = '';
      if (p.status === 'aguardando') {
        acoes = `
          <button class="btn btn-sm" onclick="abrirModalEntregador(${p.id})">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17l6-5-6-5"/></svg>
            Saiu para entrega
          </button>
          <button class="btn btn-sm" onclick="abrirModalEdicao(${p.id})">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Editar
          </button>
          <button class="btn btn-sm btn-danger" onclick="pedidoCancelar(${p.id})">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            Cancelar
          </button>`;
      } else if (p.status === 'rota') {
        acoes = `<button class="btn btn-sm" onclick="avancarPedido(${p.id})">
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
          Marcar como concluido
        </button>`;
      }
      return `<div class="pedido-card">
        <div class="pedido-header">
          <div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span class="pedido-id">#${String(p.id).padStart(4,'0')}</span>
              ${badgeHtml(p.status)}
              ${pagHtml}
            </div>
            <div class="pedido-title" style="margin-top:4px;">${nomeExibido}${endCliente}</div>
            <div class="pedido-meta">
              Entregador: ${nomeEntregador} &middot; ${p.criado_em}
              ${p.registrado_por ? `&middot; por: ${p.registrado_por}` : ''}
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0;">${totalHtml}</div>
        </div>
        ${timelineHtml(p.status)}
        <div class="pedido-itens">${itensResumo(p.itens)}</div>
        ${acoes ? `<div class="pedido-actions">${acoes}</div>` : ''}
      </div>`;
    }).join('');
  } catch(e) {
    container.innerHTML = `<div class="empty">Erro ao carregar pedidos.</div>`;
    console.error(e);
  }
}

// ── Modal entregador ──────────────────────────

function abrirModalEntregador(pedidoId) {
  document.getElementById('modal-pedido-id').value = pedidoId;
  document.getElementById('modal-entregador-select').value = '';
  document.getElementById('modal-erro').style.display = 'none';
  document.getElementById('modal-overlay').style.display = 'flex';
}

function fecharModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

async function confirmarSaidaEntrega() {
  const pedidoId = parseInt(document.getElementById('modal-pedido-id').value);
  const entregadorId = parseInt(document.getElementById('modal-entregador-select').value);
  const erro = document.getElementById('modal-erro');
  if (!entregadorId) { erro.textContent = 'Selecione um entregador.'; erro.style.display = 'block'; return; }
  try {
    await avancarStatusComEntregador(pedidoId, entregadorId);
    fecharModal();
    await Promise.all([renderMetricas(), renderPedidos()]);
  } catch(e) { erro.textContent = 'Erro: ' + e.message; erro.style.display = 'block'; }
}

async function popularModalEntregadores() {
  const sel = document.getElementById('modal-entregador-select');
  try {
    const lista = await getEntregadores();
    sel.innerHTML = '<option value="">Selecionar entregador...</option>' +
      lista.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
  } catch(e) { sel.innerHTML = '<option value="">Erro ao carregar</option>'; }
}

// ── Modal edicao ──────────────────────────────

let _pedidoEditando = null;

async function abrirModalEdicao(pedidoId) {
  const [pedidos, clientes, pagamentos] = await Promise.all([
    getPedidos(), getClientes(), getPagamentos()
  ]);
  _pedidoEditando = pedidos.find(p => p.id === pedidoId);
  if (!_pedidoEditando) return;

  const cliente = clientes.find(c => c.id === _pedidoEditando.cliente_id);

  // Nome
  document.getElementById('edit-nome-avulso').value = _pedidoEditando.nome_avulso || (cliente ? cliente.nome : '');

  // Pagamento
  const sel = document.getElementById('edit-pagamento');
  sel.innerHTML = '<option value="">Sem forma de pagamento</option>' +
    pagamentos.map(p => `<option value="${p.id}" ${p.id === _pedidoEditando.pagamento_id ? 'selected' : ''}>${p.nome}</option>`).join('');

  // Itens
  const tbody = document.getElementById('edit-itens-body');
  tbody.innerHTML = _pedidoEditando.itens.map((item, i) => {
    const tipo = item.tipo || 'un';
    return `<tr id="edit-row-${i}">
      <td style="padding-right:8px;"><input type="text" id="edit-desc-${i}" value="${item.descricao||''}" style="font-size:13px;"></td>
      <td style="padding-right:8px;width:130px;">
        <select id="edit-tipo-${i}" style="font-size:13px;">
          <option value="peso" ${tipo==='peso'?'selected':''}>Peso (kg)</option>
          <option value="valor" ${tipo==='valor'?'selected':''}>Valor direto</option>
          <option value="un" ${tipo==='un'?'selected':''}>Unidade</option>
        </select>
      </td>
      <td style="padding-right:8px;width:90px;"><input type="number" id="edit-qtd-${i}" value="${item.qtd||''}" step="0.01" style="font-size:13px;" placeholder="Qtd"></td>
      <td style="width:90px;"><input type="number" id="edit-vunit-${i}" value="${item.valor||''}" step="0.01" style="font-size:13px;" placeholder="R$ unit."></td>
      <td style="width:32px;"><button class="btn btn-danger btn-xs" onclick="document.getElementById('edit-row-${i}').remove()">
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button></td>
    </tr>`;
  }).join('');

  document.getElementById('edit-erro').style.display = 'none';
  document.getElementById('modal-edicao-overlay').style.display = 'flex';
}

function fecharModalEdicao() {
  document.getElementById('modal-edicao-overlay').style.display = 'none';
  _pedidoEditando = null;
}

async function confirmarEdicao() {
  if (!_pedidoEditando) return;
  const nomeAvulso = document.getElementById('edit-nome-avulso').value.trim();
  const pagamentoId = document.getElementById('edit-pagamento').value || null;
  const itens = [];
  document.querySelectorAll('#edit-itens-body tr').forEach(tr => {
    const i = parseInt(tr.id.replace('edit-row-',''));
    if (isNaN(i)) return;
    const desc = document.getElementById('edit-desc-'+i)?.value.trim();
    if (!desc) return;
    const tipo = document.getElementById('edit-tipo-'+i)?.value;
    const qtd = document.getElementById('edit-qtd-'+i)?.value || '';
    const vunit = document.getElementById('edit-vunit-'+i)?.value || '';
    const item = { desc, tipo };
    if (tipo === 'peso') { item.qtd = qtd; item.unidade = 'kg'; item.valor = vunit; }
    else if (tipo === 'un') { item.qtd = qtd; item.unidade = 'un'; item.valor = vunit; }
    else { item.valor = qtd; }
    itens.push(item);
  });
  const total = itens.reduce((acc, item) => {
    const qtd = parseFloat(item.qtd)||0;
    const v = parseFloat(item.valor)||0;
    return acc + (item.tipo==='valor' ? v : qtd*v);
  }, 0);
  try {
    await editarPedido(_pedidoEditando.id, { nome_avulso: nomeAvulso, pagamento_id: pagamentoId, itens, total: total||null });
    fecharModalEdicao();
    await Promise.all([renderMetricas(), renderPedidos()]);
  } catch(e) {
    document.getElementById('edit-erro').textContent = 'Erro: ' + e.message;
    document.getElementById('edit-erro').style.display = 'block';
  }
}

async function pedidoCancelar(id) {
  if (!confirm('Cancelar este pedido?')) return;
  try {
    await cancelarPedido(id);
    await Promise.all([renderMetricas(), renderPedidos()]);
  } catch(e) { alert('Erro: ' + e.message); }
}

async function avancarPedido(id) {
  try {
    await avancarStatus(id);
    await Promise.all([renderMetricas(), renderPedidos()]);
  } catch(e) { alert('Erro ao atualizar status: ' + e.message); }
}

document.addEventListener('DOMContentLoaded', () => {
  popularModalEntregadores();
  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) fecharModal();
  });
  document.getElementById('modal-edicao-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-edicao-overlay')) fecharModalEdicao();
  });
});
