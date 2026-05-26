// db.js — Comunicacao com a API do servidor Flask

const API = '/api';

async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.erro || 'Erro na requisicao');
  }
  return res.json();
}

// ── Clientes ──────────────────────────────────
async function getClientes(termo) {
  const qs = termo ? `?q=${encodeURIComponent(termo)}` : '';
  return apiFetch(`/clientes${qs}`);
}
async function addCliente(nome, telefone, endereco) {
  return apiFetch('/clientes', { method: 'POST', body: JSON.stringify({ nome, telefone, endereco }) });
}
async function deleteCliente(id) {
  return apiFetch(`/clientes/${id}`, { method: 'DELETE' });
}

// ── Entregadores ──────────────────────────────
async function getEntregadores() {
  return apiFetch('/entregadores');
}
async function addEntregador(nome, telefone) {
  return apiFetch('/entregadores', { method: 'POST', body: JSON.stringify({ nome, telefone }) });
}
async function deleteEntregador(id) {
  return apiFetch(`/entregadores/${id}`, { method: 'DELETE' });
}

// ── Produtos ──────────────────────────────────
async function getProdutos() {
  return apiFetch('/produtos');
}
async function searchProdutos(termo) {
  return apiFetch(`/produtos?q=${encodeURIComponent(termo)}`);
}
async function addProduto(nome, unidade, valor) {
  return apiFetch('/produtos', { method: 'POST', body: JSON.stringify({ nome, unidade, valor }) });
}
async function deleteProduto(id) {
  return apiFetch(`/produtos/${id}`, { method: 'DELETE' });
}

// ── Formas de pagamento ───────────────────────
async function getPagamentos() {
  return apiFetch('/pagamentos');
}
async function addPagamento(nome) {
  return apiFetch('/pagamentos', { method: 'POST', body: JSON.stringify({ nome }) });
}
async function deletePagamento(id) {
  return apiFetch(`/pagamentos/${id}`, { method: 'DELETE' });
}

// ── Pedidos ───────────────────────────────────
async function getPedidos(filtroStatus) {
  const qs = filtroStatus ? `?status=${filtroStatus}` : '';
  return apiFetch(`/pedidos${qs}`);
}
async function addPedido(clienteId, nomeAvulso, itens, pagamentoId, total, troco, trocoValor) {
  return apiFetch('/pedidos', {
    method: 'POST',
    body: JSON.stringify({
      cliente_id: clienteId || null,
      nome_avulso: nomeAvulso || '',
      itens,
      pagamento_id: pagamentoId || null,
      total: total || null,
      troco: troco || false,
      troco_valor: trocoValor || null
    })
  });
}
async function editarPedido(id, dados) {
  return apiFetch(`/pedidos/${id}`, { method: 'PATCH', body: JSON.stringify(dados) });
}
async function cancelarPedido(id) {
  return apiFetch(`/pedidos/${id}/cancelar`, { method: 'POST' });
}
async function avancarStatus(id) {
  return apiFetch(`/pedidos/${id}/avancar`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}
async function avancarStatusComEntregador(id, entregadorId) {
  return apiFetch(`/pedidos/${id}/avancar`, {
    method: 'POST',
    body: JSON.stringify({ entregador_id: entregadorId })
  });
}
async function registrarFalhaEntrega(id, motivo) {
  return apiFetch(`/pedidos/${id}/avancar`, {
    method: 'POST',
    body: JSON.stringify({ falha: true, falha_motivo: motivo })
  });
}
async function getMetricas() {
  return apiFetch('/metricas');
}
