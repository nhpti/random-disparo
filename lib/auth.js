const { supabase } = require('./supabase');

const ADMIN_EMAIL = 'lucasnhp.ti@gmail.com';

/**
 * Verifica o token JWT do Supabase Auth.
 * Retorna o user se válido, ou null se inválido.
 */
async function verifyAuth(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) return null;

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) return null;

  return user;
}

/**
 * Verifica auth + retorna role do usuário.
 * Auto-provisiona admin para ADMIN_EMAIL.
 * Retorna { user, role } ou { user: null, role: null }.
 */
async function verifyAuthWithRole(req) {
  const user = await verifyAuth(req);
  if (!user) return { user: null, role: null };

  try {
    // Buscar role na tabela usuarios
    const { data, error } = await supabase
      .from('usuarios')
      .select('role')
      .eq('email', user.email)
      .single();

    if (data) return { user, role: data.role };

    // Sem entry: auto-provisionar admin
    if (user.email === ADMIN_EMAIL) {
      await supabase.from('usuarios').upsert({ email: user.email, role: 'admin' }, { onConflict: 'email' });
      return { user, role: 'admin' };
    }

    // Usuário não cadastrado na tabela usuarios
    return { user, role: null };
  } catch (err) {
    // Se tabela não existe ainda, admin email recebe admin
    if (user.email === ADMIN_EMAIL) return { user, role: 'admin' };
    return { user, role: null };
  }
}

module.exports = { verifyAuth, verifyAuthWithRole, ADMIN_EMAIL };
