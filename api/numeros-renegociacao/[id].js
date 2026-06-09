const { supabase } = require('../../lib/supabase');
const { verifyAuthWithRole } = require('../../lib/auth');

const TABELA_NUMEROS = 'numeros_renegociacao';
const PRODUTO = 'renegociacao';

// DELETE /api/numeros-renegociacao/:id - remover numero (admin/operador)
// PATCH  /api/numeros-renegociacao/:id - toggle ativo (admin/operador)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { user, role } = await verifyAuthWithRole(req);
  if (!user) return res.status(401).json({ error: 'Nao autorizado. Faca login.' });
  if (role !== 'admin' && role !== 'operador') return res.status(403).json({ error: 'Sem permissao para esta acao.' });

  try {
    const { id } = req.query;

    if (req.method === 'DELETE') {
      const { data: numData } = await supabase
        .from(TABELA_NUMEROS)
        .select('numero')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from(TABELA_NUMEROS)
        .delete()
        .eq('id', id);
      if (error) throw error;

      if (numData) {
        await supabase.from('activity_log').insert({
          produto: PRODUTO,
          acao: 'removeu',
          numero: numData.numero,
          usuario: user.email || 'desconhecido'
        });
      }

      return res.status(200).json({ ok: true });
    }

    if (req.method === 'PATCH') {
      const { ativo } = req.body;
      const { data, error } = await supabase
        .from(TABELA_NUMEROS)
        .update({ ativo })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      await supabase.from('activity_log').insert({
        produto: PRODUTO,
        acao: ativo ? 'ativou' : 'pausou',
        numero: data.numero,
        usuario: user.email || 'desconhecido'
      });

      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao processar numero' });
  }
};
