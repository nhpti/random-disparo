const { supabase } = require('../../lib/supabase');
const { verifyAuthWithRole } = require('../../lib/auth');

// GET  /api/usuarios — listar todos (admin only)
// POST /api/usuarios — adicionar usuário (admin only)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { user, role } = await verifyAuthWithRole(req);
  if (!user) return res.status(401).json({ error: 'Não autorizado.' });
  if (role !== 'admin') return res.status(403).json({ error: 'Apenas administradores.' });

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { email, role: newRole, senha } = req.body;

      if (!email || !email.trim()) {
        return res.status(400).json({ error: 'Email é obrigatório.' });
      }

      const validRoles = ['admin', 'operador', 'viewer'];
      const roleToUse = validRoles.includes(newRole) ? newRole : 'viewer';

      // Criar conta no Supabase Auth
      const password = senha || Math.random().toString(36).slice(-10) + 'A1!';
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
      });

      if (authError) {
        // Se já existe no Auth, só adicionar na tabela
        if (!authError.message.includes('already') && !authError.message.includes('exists')) {
          throw authError;
        }
      }

      // Inserir na tabela usuarios
      const { data, error } = await supabase
        .from('usuarios')
        .upsert({ email: email.trim().toLowerCase(), role: roleToUse }, { onConflict: 'email' })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ ...data, senhaTemporaria: authError ? null : password });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Erro interno' });
  }
};
