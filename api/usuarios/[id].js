const { supabase } = require('../../lib/supabase');
const { verifyAuthWithRole } = require('../../lib/auth');

// PATCH  /api/usuarios/:id — alterar role (admin only)
// DELETE /api/usuarios/:id — remover usuário (admin only)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { user, role } = await verifyAuthWithRole(req);
  if (!user) return res.status(401).json({ error: 'Não autorizado.' });
  if (role !== 'admin') return res.status(403).json({ error: 'Apenas administradores.' });

  const { id } = req.query;

  try {
    if (req.method === 'PATCH') {
      const { role: newRole } = req.body;
      const validRoles = ['admin', 'operador', 'viewer'];
      if (!validRoles.includes(newRole)) {
        return res.status(400).json({ error: 'Role inválida.' });
      }

      // Impedir que admin remova próprio admin
      const { data: target } = await supabase.from('usuarios').select('email').eq('id', id).single();
      if (target && target.email === user.email && newRole !== 'admin') {
        return res.status(400).json({ error: 'Você não pode remover seu próprio acesso admin.' });
      }

      const { data, error } = await supabase
        .from('usuarios')
        .update({ role: newRole })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      // Impedir auto-remoção
      const { data: target } = await supabase.from('usuarios').select('email').eq('id', id).single();
      if (target && target.email === user.email) {
        return res.status(400).json({ error: 'Você não pode remover a si mesmo.' });
      }

      const { error } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Erro interno' });
  }
};
