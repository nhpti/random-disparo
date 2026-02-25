const { supabase } = require('../../lib/supabase');
const { verifyAuth } = require('../../lib/auth');

// DELETE /api/numeros/:id — remover número (autenticado)
// PATCH  /api/numeros/:id — toggle ativo (autenticado)
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Verificar autenticação
  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Não autorizado. Faça login.' });
  }

  try {
    const { id } = req.query;

    if (req.method === 'DELETE') {
      // Buscar número antes de deletar para registrar no log
      const { data: numData } = await supabase
        .from('numeros')
        .select('numero')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('numeros')
        .delete()
        .eq('id', id);
      if (error) throw error;

      // Registrar atividade
      if (numData) {
        await supabase.from('activity_log').insert({
          produto: 'fgts',
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
        .from('numeros')
        .update({ ativo })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Registrar atividade
      await supabase.from('activity_log').insert({
        produto: 'fgts',
        acao: ativo ? 'ativou' : 'pausou',
        numero: data.numero,
        usuario: user.email || 'desconhecido'
      });

      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao processar número' });
  }
};
