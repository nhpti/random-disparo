const { supabase } = require('../../lib/supabase');
const { verifyAuth } = require('../../lib/auth');

// DELETE /api/numeros-bolsa/:id — remover número (autenticado)
// PATCH  /api/numeros-bolsa/:id — toggle ativo (autenticado)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Não autorizado. Faça login.' });
  }

  try {
    const { id } = req.query;

    if (req.method === 'DELETE') {
      const { error } = await supabase
        .from('numeros_bolsa')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'PATCH') {
      const { ativo } = req.body;
      const { data, error } = await supabase
        .from('numeros_bolsa')
        .update({ ativo })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao processar número' });
  }
};
