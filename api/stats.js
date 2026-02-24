const { supabase } = require('../lib/supabase');
const { verifyAuth } = require('../lib/auth');

// GET /api/stats — estatísticas de redirects (autenticado)
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Verificar autenticação
  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Não autorizado. Faça login.' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Total de redirects
    const { count: totalRedirects, error: e1 } = await supabase
      .from('redirect_log')
      .select('*', { count: 'exact', head: true });
    if (e1) throw e1;

    // Redirects de hoje
    const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const { count: redirectsHoje, error: e2 } = await supabase
      .from('redirect_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${hoje}T00:00:00`)
      .lt('created_at', `${hoje}T23:59:59.999`);
    if (e2) throw e2;

    // Contagem por número
    const { data: logs, error: e3 } = await supabase
      .from('redirect_log')
      .select('numero');
    if (e3) throw e3;

    // Agrupar manualmente (Supabase JS client não tem GROUP BY direto)
    const contagem = {};
    for (const log of logs || []) {
      contagem[log.numero] = (contagem[log.numero] || 0) + 1;
    }
    const porNumero = Object.entries(contagem)
      .map(([numero, total]) => ({ numero, total }))
      .sort((a, b) => b.total - a.total);

    return res.status(200).json({
      totalRedirects: totalRedirects || 0,
      redirectsHoje: redirectsHoje || 0,
      porNumero,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar stats' });
  }
};
