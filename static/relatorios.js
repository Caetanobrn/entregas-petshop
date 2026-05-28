// relatorios.js — Relatorios de pagamentos, itens vendidos e resumo geral

let _relData = null;
let _itensOrdem = 'desc'; // 'desc' = maior primeiro, 'asc' = menor primeiro
let _itensColunaOrdem = 'qtd_total'; // 'qtd_total' ou 'valor_total'

async function renderRelatorios() {
  document.getElementById('rel-loading').style.display = 'block';
  document.getElementById('rel-content').style.display = 'none';

  try {
    _relData = await getRelatorios();
    renderResumo(_relData.resumo);
    renderPagamentosChart(_relData.pagamentos);
    renderItensTabela(_relData.itens);
    document.getElementById('rel-loading').style.display = 'none';
    document.getElementById('rel-content').style.display = 'block';
  } catch(e) {
    document.getElementById('rel-loading').textContent = 'Erro ao carregar relatorios.';
    console.error(e);
  }
}

// ── Resumo geral ──────────────────────────────

function renderResumo(r) {
  const statusLabel = {
    aguardando: 'Aguardando', rota: 'Em rota',
    concluido: 'Concluido', cancelado: 'Cancelado', falha: 'Falha'
  };
  const statusColor = {
    aguardando: 'var(--warn)', rota: 'var(--info)',
    concluido: 'var(--success)', cancelado: 'var(--text-3)', falha: 'var(--warn)'
  };

  document.getElementById('rel-total-pedidos').textContent = r.total_pedidos;
  document.getElementById('rel-total-valor').textContent = `R$ ${r.total_valor.toFixed(2)}`;
  document.getElementById('rel-ticket').textContent = r.ticket_medio > 0 ? `R$ ${r.ticket_medio.toFixed(2)}` : '—';

  const statusEl = document.getElementById('rel-por-status');
  const entries = Object.entries(r.por_status).sort((a,b) => b[1] - a[1]);
  statusEl.innerHTML = entries.map(([s, n]) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:13px;color:${statusColor[s]||'var(--text-2)'};">${statusLabel[s]||s}</span>
      <span style="font-weight:600;font-size:14px;">${n}</span>
    </div>`).join('');
}

// ── Formas de pagamento ───────────────────────

function renderPagamentosChart(lista) {
  if (!lista.length) {
    document.getElementById('rel-pagamentos').innerHTML =
      '<div style="color:var(--text-3);font-size:13px;padding:12px 0;">Nenhum dado disponivel</div>';
    return;
  }

  const maxQtd = Math.max(...lista.map(p => p.qtd_pedidos), 1);
  const totalQtd = lista.reduce((a, p) => a + p.qtd_pedidos, 0);
  const totalValor = lista.reduce((a, p) => a + p.valor_total, 0);

  document.getElementById('rel-pag-total-qtd').textContent = totalQtd + ' pedidos';
  document.getElementById('rel-pag-total-valor').textContent = `R$ ${totalValor.toFixed(2)}`;

  document.getElementById('rel-pagamentos').innerHTML = lista.map(p => {
    const pct = maxQtd > 0 ? Math.round((p.qtd_pedidos / maxQtd) * 100) : 0;
    const pctTotal = totalQtd > 0 ? ((p.qtd_pedidos / totalQtd) * 100).toFixed(1) : '0.0';
    return `
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
          <span style="font-size:13px;font-weight:500;">${p.nome}</span>
          <span style="font-size:12px;color:var(--text-3);">${p.qtd_pedidos} pedido${p.qtd_pedidos !== 1 ? 's' : ''} &middot; ${pctTotal}% &middot; R$ ${p.valor_total.toFixed(2)}</span>
        </div>
        <div style="height:8px;background:var(--bg);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:4px;transition:width 0.4s;"></div>
        </div>
      </div>`;
  }).join('');
}

// ── Itens mais vendidos ───────────────────────

function renderItensTabela(itens) {
  const el = document.getElementById('rel-itens-body');
  const vazio = document.getElementById('rel-itens-vazio');

  if (!itens.length) {
    el.innerHTML = '';
    vazio.style.display = 'block';
    return;
  }
  vazio.style.display = 'none';

  const sorted = [...itens].sort((a, b) => {
    const va = a[_itensColunaOrdem] || 0;
    const vb = b[_itensColunaOrdem] || 0;
    return _itensOrdem === 'desc' ? vb - va : va - vb;
  });

  el.innerHTML = sorted.map((item, i) => `
    <tr>
      <td style="padding:8px 0;font-size:13px;font-weight:${i < 3 ? '600' : '400'};">
        ${i < 3 ? `<span style="color:var(--accent);margin-right:4px;">#${i+1}</span>` : `<span style="color:var(--text-3);margin-right:4px;">${i+1}</span>`}
        ${item.descricao}
      </td>
      <td style="padding:8px 0;font-size:13px;text-align:right;">${parseFloat(item.qtd_total||0).toFixed(2)}</td>
      <td style="padding:8px 0;font-size:13px;text-align:right;color:var(--accent);font-weight:500;">R$ ${parseFloat(item.valor_total||0).toFixed(2)}</td>
      <td style="padding:8px 0;font-size:13px;text-align:right;color:var(--text-3);">${item.em_pedidos}</td>
    </tr>`).join('');
}

function ordenarItens(coluna) {
  if (_itensColunaOrdem === coluna) {
    _itensOrdem = _itensOrdem === 'desc' ? 'asc' : 'desc';
  } else {
    _itensColunaOrdem = coluna;
    _itensOrdem = 'desc';
  }
  if (_relData) renderItensTabela(_relData.itens);
  atualizarSetasOrdenacao();
}

function atualizarSetasOrdenacao() {
  ['qtd_total', 'valor_total'].forEach(col => {
    const el = document.getElementById('rel-th-' + col);
    if (!el) return;
    const seta = _itensColunaOrdem === col ? (_itensOrdem === 'desc' ? ' ↓' : ' ↑') : ' ↕';
    el.querySelector('.seta').textContent = seta;
  });
}
