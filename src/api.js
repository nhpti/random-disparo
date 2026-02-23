// Na Vercel, as API routes ficam no mesmo domínio, então não precisa de URL base
const API = '';

export async function getNumeros() {
  const res = await fetch(`${API}/api/numeros`);
  if (!res.ok) throw new Error('Erro ao buscar números');
  return res.json();
}

export async function addNumero(numero) {
  const res = await fetch(`${API}/api/numeros`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numero }),
  });
  if (!res.ok) throw new Error('Erro ao adicionar');
  return res.json();
}

export async function deleteNumero(id) {
  const res = await fetch(`${API}/api/numeros/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Erro ao remover');
  return res.json();
}

export async function getStats() {
  const res = await fetch(`${API}/api/stats`);
  if (!res.ok) throw new Error('Erro ao buscar stats');
  return res.json();
}
