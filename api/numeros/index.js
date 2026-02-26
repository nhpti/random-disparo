const { supabase } = require('../../lib/supabase');
const { verifyAuth, verifyAuthWithRole } = require('../../lib/auth');

// GET  /api/numeros — listar todos (autenticado)
// POST /api/numeros — adicionar (admin/operador)
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // POST requer role admin ou operador
  if (req.method === 'POST') {
    const { user, role } = await verifyAuthWithRole(req);
    if (!user) return res.status(401).json({ error: 'Não autorizado. Faça login.' });
    if (role !== 'admin' && role !== 'operador') return res.status(403).json({ error: 'Sem permissão para esta ação.' });

    try {
      const { numero } = req.body;
      if (!numero || !numero.trim()) {
        return res.status(400).json({ error: 'Número é obrigatório' });
      }

      const { data, error } = await supabase
        .from('numeros')
        .insert({ numero: numero.trim() })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('activity_log').insert({
        produto: 'fgts',
        acao: 'adicionou',
        numero: numero.trim(),
        usuario: user.email || 'desconhecido'
      });

      return res.status(201).json(data);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro interno' });
    }
  }

  // GET — qualquer usuário autenticado
  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Não autorizado. Faça login.' });

  // Cache na CDN por 15s
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');

  try {
    const { data, error } = await supabase
      .from('numeros')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
