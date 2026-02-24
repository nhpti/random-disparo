// Na Vercel, as API routes ficam no mesmo domínio, então não precisa de URL base
const API = '';

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

export async function getStats(token) {
  const res = await fetch(`${API}/api/stats`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao buscar stats');
  return res.json();
}
