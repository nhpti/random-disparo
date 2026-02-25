// Na Vercel, as API routes ficam no mesmo domínio, então não precisa de URL base
const API = '';

// ── CLT & FGTS ──
export async function getNumeros(token) {
  const res = await fetch(`${API}/api/numeros`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao buscar números');
  return res.json();
}

export async function addNumero(numero, token) {
  const res = await fetch(`${API}/api/numeros`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ numero }),
  });
  if (!res.ok) throw new Error('Erro ao adicionar');
  return res.json();
}

export async function deleteNumero(id, token) {
  const res = await fetch(`${API}/api/numeros/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao remover');
  return res.json();
}

export async function toggleNumero(id, ativo, token) {
  const res = await fetch(`${API}/api/numeros/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ ativo }),
  });
  if (!res.ok) throw new Error('Erro ao alterar status');
  return res.json();
}

export async function getStats(token) {
  const res = await fetch(`${API}/api/stats`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao buscar stats');
  return res.json();
}

export async function getConversoes(token, data) {
  const query = data ? `?data=${data}` : '';
  const res = await fetch(`${API}/api/conversoes${query}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao buscar conversões');
  return res.json();
}

export async function saveConversao(payload, token) {
  const res = await fetch(`${API}/api/conversoes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Erro ao salvar conversão');
  return res.json();
}

// ── BOLSA FAMÍLIA ──
export async function getNumerosBolsa(token) {
  const res = await fetch(`${API}/api/numeros-bolsa`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao buscar números');
  return res.json();
}

export async function addNumeroBolsa(numero, token) {
  const res = await fetch(`${API}/api/numeros-bolsa`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ numero }),
  });
  if (!res.ok) throw new Error('Erro ao adicionar');
  return res.json();
}

export async function deleteNumeroBolsa(id, token) {
  const res = await fetch(`${API}/api/numeros-bolsa/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao remover');
  return res.json();
}

export async function toggleNumeroBolsa(id, ativo, token) {
  const res = await fetch(`${API}/api/numeros-bolsa/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ ativo }),
  });
  if (!res.ok) throw new Error('Erro ao alterar status');
  return res.json();
}

export async function getStatsBolsa(token) {
  const res = await fetch(`${API}/api/stats-bolsa`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao buscar stats');
  return res.json();
}

export async function getConversoesBolsa(token, data) {
  const query = data ? `?data=${data}` : '';
  const res = await fetch(`${API}/api/conversoes-bolsa${query}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao buscar conversões');
  return res.json();
}

export async function saveConversaoBolsa(payload, token) {
  const res = await fetch(`${API}/api/conversoes-bolsa`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Erro ao salvar conversão');
  return res.json();
}
