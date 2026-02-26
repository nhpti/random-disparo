const { verifyAuthWithRole } = require('../lib/auth');

// GET /api/me — retorna email e role do usuário logado
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user, role } = await verifyAuthWithRole(req);
  if (!user) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  if (!role) {
    return res.status(403).json({ error: 'Sem permissão. Contate o administrador.' });
  }

  return res.status(200).json({ email: user.email, role });
};
