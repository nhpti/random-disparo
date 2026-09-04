import { supabase } from './supabaseClient';

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

export async function getStats(token, de, ate) {
  const params = [];
  if (de) params.push(`de=${de}`);
  if (ate) params.push(`ate=${ate}`);
  const query = params.length ? `?${params.join('&')}` : '';
  const res = await fetch(`${API}/api/stats${query}`, {
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

export async function getStatsBolsa(token, de, ate) {
  const params = [];
  if (de) params.push(`de=${de}`);
  if (ate) params.push(`ate=${ate}`);
  const query = params.length ? `?${params.join('&')}` : '';
  const res = await fetch(`${API}/api/stats-bolsa${query}`, {
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

// ── BOLSA FAMÍLIA (novo produto) ──
export async function getNumerosBolsaFamilia(token) {
  const res = await fetch(`${API}/api/numeros-bolsa-familia`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao buscar números');
  return res.json();
}

export async function addNumeroBolsaFamilia(numero, token) {
  const res = await fetch(`${API}/api/numeros-bolsa-familia`, {
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

export async function deleteNumeroBolsaFamilia(id, token) {
  const res = await fetch(`${API}/api/numeros-bolsa-familia/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao remover');
  return res.json();
}

export async function toggleNumeroBolsaFamilia(id, ativo, token) {
  const res = await fetch(`${API}/api/numeros-bolsa-familia/${id}`, {
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

export async function getStatsBolsaFamilia(token, de, ate) {
  const params = [];
  if (de) params.push(`de=${de}`);
  if (ate) params.push(`ate=${ate}`);
  const query = params.length ? `?${params.join('&')}` : '';
  const res = await fetch(`${API}/api/stats-bolsa-familia${query}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao buscar stats');
  return res.json();
}

// ── LOG DE ATIVIDADES ──
// RENEGOCIACAO
export async function getNumerosRenegociacao(token) {
  const res = await fetch(`${API}/api/numeros-renegociacao`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao buscar numeros');
  return res.json();
}

export async function addNumeroRenegociacao(numero, token) {
  const res = await fetch(`${API}/api/numeros-renegociacao`, {
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

export async function deleteNumeroRenegociacao(id, token) {
  const res = await fetch(`${API}/api/numeros-renegociacao/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao remover');
  return res.json();
}

export async function toggleNumeroRenegociacao(id, ativo, token) {
  const res = await fetch(`${API}/api/numeros-renegociacao/${id}`, {
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

export async function getStatsRenegociacao(token, de, ate) {
  const params = [];
  if (de) params.push(`de=${de}`);
  if (ate) params.push(`ate=${ate}`);
  const query = params.length ? `?${params.join('&')}` : '';
  const res = await fetch(`${API}/api/stats-renegociacao${query}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao buscar stats');
  return res.json();
}

export async function getActivityLog(token, produto) {
  const query = produto ? `?produto=${produto}` : '';
  const res = await fetch(`${API}/api/activity-log${query}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao buscar atividades');
  return res.json();
}

// ── DASHBOARD STATS (unificado) ──
export async function getDashboardStats(token) {
  const res = await fetch(`${API}/api/dashboard-stats`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao buscar dashboard stats');
  return res.json();
}

// ── USUÁRIOS / ROLES ──
export async function getMe(token) {
  const res = await fetch(`${API}/api/me`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao buscar perfil');
  return res.json();
}

export async function getUsuarios(token) {
  const res = await fetch(`${API}/api/usuarios`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao buscar usuários');
  return res.json();
}

export async function addUsuario(email, role, senha, token) {
  const res = await fetch(`${API}/api/usuarios`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ email, role, senha }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao adicionar usuário');
  }
  return res.json();
}

export async function updateUsuarioRole(id, role, token) {
  const res = await fetch(`${API}/api/usuarios/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao alterar role');
  }
  return res.json();
}

export async function deleteUsuario(id, token) {
  const res = await fetch(`${API}/api/usuarios/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao remover usuário');
  }
  return res.json();
}

// ── HEALTH STATUS (painel) ──
export async function getHealthStatus(token) {
  const res = await fetch(`${API}/api/health-status`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao buscar health status');
  return res.json();
}

// ── REALTIME CHART (último 60 min) ──
export async function getRealtimeChart(token) {
  const res = await fetch(`${API}/api/realtime-chart`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Erro ao buscar dados em tempo real');
  return res.json();
}

// ── ROTAS PARCEIROS ──
export async function getRotasParceiros(token) {
  const { data, error } = await supabase
    .from('rotas_parceiros')
    .select('*')
    .order('criado_em', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function addRotaParceiro(dados, token) {
  const { nome_parceiro, codigo_origem, produto, mensagem_template } = dados;
  if (!nome_parceiro || !codigo_origem || !produto || !mensagem_template) {
    throw new Error('Preencha todos os campos obrigatórios.');
  }

  const { data, error } = await supabase
    .from('rotas_parceiros')
    .insert({
      nome_parceiro: nome_parceiro.trim(),
      codigo_origem: codigo_origem.trim().toLowerCase(),
      produto: produto.trim().toLowerCase(),
      mensagem_template: mensagem_template.trim(),
      ativo: true
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateRotaParceiro(id, dados, token) {
  const { nome_parceiro, codigo_origem, produto, mensagem_template, ativo } = dados;
  const updates = { atualizado_em: new Date().toISOString() };
  if (nome_parceiro !== undefined) updates.nome_parceiro = nome_parceiro.trim();
  if (codigo_origem !== undefined) updates.codigo_origem = codigo_origem.trim().toLowerCase();
  if (produto !== undefined) updates.produto = produto.trim().toLowerCase();
  if (mensagem_template !== undefined) updates.mensagem_template = mensagem_template.trim();
  if (ativo !== undefined) updates.ativo = ativo;

  const { data, error } = await supabase
    .from('rotas_parceiros')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteRotaParceiro(id, token) {
  const { error } = await supabase
    .from('rotas_parceiros')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}
