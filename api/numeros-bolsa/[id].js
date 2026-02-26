const { supabase } = require('../../lib/supabase');
const { verifyAuthWithRole } = require('../../lib/auth');

// DELETE /api/numeros-bolsa/:id — remover número (admin/operador)
// PATCH  /api/numeros-bolsa/:id — toggle ativo (admin/operador)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { user, role } = await verifyAuthWithRole(req);
  if (!user) return res.status(401).json({ error: 'Não autorizado. Faça login.' });
  if (role !== 'admin' && role !== 'operador') return res.status(403).json({ error: 'Sem permissão para esta ação.' });

  try {
    const { id } = req.query;

    if (req.method === 'DELETE') {
      // Buscar número antes de deletar para registrar no log
      const { data: numData } = await supabase
        .from('numeros_bolsa')
        .select('numero')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('numeros_bolsa')
        .delete()
        .eq('id', id);
      if (error) throw error;

      // Registrar atividade
      if (numData) {
        await supabase.from('activity_log').insert({
          produto: 'bolsa',
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
        .from('numeros_bolsa')
        .update({ ativo })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Registrar atividade
      await supabase.from('activity_log').insert({
        produto: 'bolsa',
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
