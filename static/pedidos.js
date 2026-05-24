// pedidos.js — Listagem, metricas e controle de status

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
      const nomeEntregador = entregador ? entregador.nome : 'Entregador removido';

      let acoes = '';
      if (p.status === 'aguardando') {
        acoes = `<button class="btn btn-sm" onclick="avancarPedido(${p.id})">
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
            <div class="pedido-meta">Entregador: ${nomeEntregador} &middot; ${p.criado_em}</div>
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

async function avancarPedido(id) {
  try {
    await avancarStatus(id);
    await Promise.all([renderMetricas(), renderPedidos()]);
  } catch (e) {
    alert('Erro ao atualizar status: ' + e.message);
  }
}
