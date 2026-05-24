// db.js — Comunicacao com a API do servidor Flask
// Usa URL relativa para funcionar tanto local quanto no Railway

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
async function getClientes() {
  return apiFetch('/clientes');
}
async function addCliente(nome, telefone, endereco) {
  return apiFetch('/clientes', {
    method: 'POST',
    body: JSON.stringify({ nome, telefone, endereco })
  });
}
async function deleteCliente(id) {
  return apiFetch(`/clientes/${id}`, { method: 'DELETE' });
}

// ── Entregadores ──────────────────────────────
async function getEntregadores() {
  return apiFetch('/entregadores');
}
async function addEntregador(nome, telefone) {
  return apiFetch('/entregadores', {
    method: 'POST',
    body: JSON.stringify({ nome, telefone })
  });
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
  return apiFetch('/produtos', {
    method: 'POST',
    body: JSON.stringify({ nome, unidade, valor })
  });
}
async function deleteProduto(id) {
  return apiFetch(`/produtos/${id}`, { method: 'DELETE' });
}

// ── Pedidos ───────────────────────────────────
async function getPedidos(filtroStatus) {
  const qs = filtroStatus ? `?status=${filtroStatus}` : '';
  return apiFetch(`/pedidos${qs}`);
}
async function addPedido(clienteId, entregadorId, itens) {
  return apiFetch('/pedidos', {
    method: 'POST',
    body: JSON.stringify({ cliente_id: clienteId, entregador_id: entregadorId, itens })
  });
}
async function avancarStatus(id) {
  return apiFetch(`/pedidos/${id}/avancar`, { method: 'POST' });
}
async function getMetricas() {
  return apiFetch('/metricas');
}
