// pedidos.js — Listagem, metricas, controle de status e modal de entregador

function badgeHtml(status) {
  const map = {
    aguardando: ['badge-wait', '&#9679; Aguardando'],
    rota:       ['badge-route', '&#9654; Em rota'],
    concluido:  ['badge-done', '&#10003; Concluido']
  };
  const [cls, label] = map[status];
  return `<span class="badge ${cls}">${label}</span>`;
}

function timelineHtml(status) {
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
    let desc = item.descricao || item.desc || '';
    if (item.qtd && item.unidade) desc += ` &mdash; ${item.qtd} ${item.unidade}`;
    if (item.valor) desc += ` &mdash; R$ ${parseFloat(item.valor).toFixed(2)}`;
    return desc;
  }).join('<br>');
}

async function renderMetricas() {
  try {
    const m = await getMetricas();
    document.getElementById('met-total').textContent = m.total;
    document.getElementById('met-rota').textContent = m.rota;
    document.getElementById('met-concluidos').textContent = m.concluidos;
  } catch (e) {
    console.error('Erro ao carregar metricas:', e);
  }
}

async function renderPedidos() {
  const filtro = document.getElementById('filtro-status').value;
  const container = document.getElementById('lista-pedidos');
  const count = document.getElementById('pedidos-count');

  container.innerHTML = '<div class="empty">Carregando...</div>';

  try {
    const [lista, clientes, entregadores] = await Promise.all([
      getPedidos(filtro),
      getClientes(),
      getEntregadores()
    ]);

    count.textContent = lista.length + ' pedido' + (lista.length !== 1 ? 's' : '');

    if (!lista.length) {
      container.innerHTML = `<div class="empty">
        <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M20 7H4a1 1 0 00-1 1v10a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1zM16 3H8l-2 4h12l-2-4z"/>
        </svg>
        Nenhum pedido encontrado
      </div>`;
      return;
    }

    container.innerHTML = lista.map(p => {
      const cliente = clientes.find(c => c.id === p.cliente_id);
      const entregador = entregadores.find(e => e.id === p.entregador_id);
      const nomeCliente = cliente ? cliente.nome : 'Cliente removido';
      const endCliente = cliente ? `<span style="color:var(--text-3)"> &middot; ${cliente.endereco}</span>` : '';
      const nomeEntregador = entregador ? entregador.nome : (p.status === 'aguardando' ? 'A definir' : 'Entregador removido');

      let acoes = '';
      if (p.status === 'aguardando') {
        acoes = `<button class="btn btn-sm" onclick="abrirModalEntregador(${p.id})">
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17l6-5-6-5"/>
          </svg>
          Saiu para entrega
        </button>`;
      } else if (p.status === 'rota') {
        acoes = `<button class="btn btn-sm" onclick="avancarPedido(${p.id})">
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          Marcar como concluido
        </button>`;
      }

      return `<div class="pedido-card">
        <div class="pedido-header">
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="pedido-id">#${String(p.id).padStart(4,'0')}</span>
              ${badgeHtml(p.status)}
            </div>
            <div class="pedido-title" style="margin-top:4px;">${nomeCliente}${endCliente}</div>
            <div class="pedido-meta">
              Entregador: ${nomeEntregador}
              &middot; ${p.criado_em}
              ${p.registrado_por ? `&middot; Registrado por: ${p.registrado_por}` : ''}
            </div>
          </div>
        </div>
        ${timelineHtml(p.status)}
        <div class="pedido-itens">${itensResumo(p.itens)}</div>
        ${acoes ? `<div class="pedido-actions">${acoes}</div>` : ''}
      </div>`;
    }).join('');

  } catch (e) {
    container.innerHTML = `<div class="empty">Erro ao carregar pedidos. O servidor esta rodando?</div>`;
    console.error(e);
  }
}

// ── Modal de selecao de entregador ────────────

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

  if (!entregadorId) {
    erro.textContent = 'Selecione um entregador.';
    erro.style.display = 'block';
    return;
  }

  try {
    await avancarStatusComEntregador(pedidoId, entregadorId);
    fecharModal();
    await Promise.all([renderMetricas(), renderPedidos()]);
  } catch (e) {
    erro.textContent = 'Erro: ' + e.message;
    erro.style.display = 'block';
  }
}

async function popularModalEntregadores() {
  const sel = document.getElementById('modal-entregador-select');
  try {
    const lista = await getEntregadores();
    sel.innerHTML = '<option value="">Selecionar entregador...</option>' +
      lista.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
  } catch (e) {
    sel.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

async function avancarPedido(id) {
  try {
    await avancarStatus(id);
    await Promise.all([renderMetricas(), renderPedidos()]);
  } catch (e) {
    alert('Erro ao atualizar status: ' + e.message);
  }
}

// Fechar modal ao clicar fora
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) fecharModal();
  });
  popularModalEntregadores();
});
