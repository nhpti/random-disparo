const { supabase } = require('../../lib/supabase');
const { verifyAuth } = require('../../lib/auth');

// GET/POST /api/conversoes-bolsa — conversões manuais Bolsa Família
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Não autorizado. Faça login.' });
  }

  try {
    if (req.method === 'GET') {
      const data = req.query.data || new Date().toISOString().split('T')[0];

      const { data: rows, error } = await supabase
        .from('conversoes_bolsa')
        .select('*')
        .eq('data', data);
      if (error) throw error;

      return res.status(200).json(rows || []);
    }

    if (req.method === 'POST') {
      const { numero, data, mensagens, conversoes } = req.body;

      if (!numero || !data) {
        return res.status(400).json({ error: 'numero e data são obrigatórios' });
      }

      const { data: existing, error: eFind } = await supabase
        .from('conversoes_bolsa')
        .select('id')
        .eq('numero', numero)
        .eq('data', data)
        .maybeSingle();
      if (eFind) throw eFind;

      if (existing) {
        const { error: eUp } = await supabase
          .from('conversoes_bolsa')
          .update({ mensagens: mensagens || 0, conversoes: conversoes || 0 })
          .eq('id', existing.id);
        if (eUp) throw eUp;
      } else {
        const { error: eIn } = await supabase
          .from('conversoes_bolsa')
          .insert({ numero, data, mensagens: mensagens || 0, conversoes: conversoes || 0 });
        if (eIn) throw eIn;
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao processar conversões' });
  }
};
