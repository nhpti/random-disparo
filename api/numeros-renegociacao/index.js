const { supabase } = require('../../lib/supabase');
const { verifyAuth, verifyAuthWithRole } = require('../../lib/auth');

const TABELA_NUMEROS = 'numeros_renegociacao';
const PRODUTO = 'renegociacao';

// GET  /api/numeros-renegociacao - listar todos (autenticado)
// POST /api/numeros-renegociacao - adicionar (admin/operador)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { user, role } = await verifyAuthWithRole(req);
    if (!user) return res.status(401).json({ error: 'Nao autorizado. Faca login.' });
    if (role !== 'admin' && role !== 'operador') return res.status(403).json({ error: 'Sem permissao para esta acao.' });

    try {
      const { numero } = req.body;
      if (!numero || !numero.trim()) {
        return res.status(400).json({ error: 'Numero e obrigatorio' });
      }

      const { data, error } = await supabase
        .from(TABELA_NUMEROS)
        .insert({ numero: numero.trim() })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('activity_log').insert({
        produto: PRODUTO,
        acao: 'adicionou',
        numero: numero.trim(),
        usuario: user.email || 'desconhecido'
      });

      return res.status(201).json(data);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro interno' });
    }
  }

  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Nao autorizado. Faca login.' });

  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');

  try {
    const { data, error } = await supabase
      .from(TABELA_NUMEROS)
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
};
