const { supabase } = require('../../lib/supabase');
const { verifyAuthWithRole } = require('../../lib/auth');

// DELETE /api/numeros/:id — remover número (admin/operador)
// PATCH  /api/numeros/:id — toggle ativo (admin/operador)
module.exports = async function handler(req, res) {
  // CORS
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
      const { ativo, colaborador } = req.body;
      const updates = {};
      if (ativo !== undefined) updates.ativo = ativo;
      if (colaborador !== undefined) {
        updates.colaborador = (colaborador && typeof colaborador === 'string' && colaborador.trim()) ? colaborador.trim() : null;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar' });
      }

      let { data, error } = await supabase
        .from('numeros')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error && error.message && error.message.includes('colaborador') && updates.ativo !== undefined) {
        const fallbackRes = await supabase
          .from('numeros')
          .update({ ativo: updates.ativo })
          .eq('id', id)
          .select()
          .single();
        if (fallbackRes.error) throw fallbackRes.error;
        data = fallbackRes.data;
        error = null;
      } else if (error) {
        throw error;
      }

      // Registrar atividade
      let acaoLog = 'atualizou';
      if (ativo !== undefined && colaborador === undefined) {
        acaoLog = ativo ? 'ativou' : 'pausou';
      } else if (colaborador !== undefined && ativo === undefined) {
        acaoLog = updates.colaborador ? `atribuiu a ${updates.colaborador}` : 'removeu colaborador de';
      }

      await supabase.from('activity_log').insert({
        produto: 'fgts',
        acao: acaoLog,
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
