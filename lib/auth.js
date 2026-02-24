const { supabase } = require('./supabase');

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

module.exports = { verifyAuth };
