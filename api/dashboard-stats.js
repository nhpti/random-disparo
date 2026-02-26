const { supabase } = require('../lib/supabase');
const { verifyAuth } = require('../lib/auth');

// GET /api/dashboard-stats — stats resumidas dos dois produtos em 1 call
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Não autorizado. Faça login.' });

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Cache agressivo — dashboard é só resumo
  res.setHeader('Cache-Control', 's-maxage=45, stale-while-revalidate=90');

  try {
    const agora = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const hoje = agora.toISOString().split('T')[0];

    // Rodar TODAS as queries em paralelo (6 queries simultâneas)
    const [
      fgtsNums, bolsaNums,
      fgtsRedirects, bolsaRedirects,
      fgtsUniqueIps, bolsaUniqueIps,
    ] = await Promise.all([
      // Números FGTS
      supabase.from('numeros').select('id, ativo'),
      // Números Bolsa
      supabase.from('numeros_bolsa').select('id, ativo'),
      // Redirects hoje FGTS
      supabase.from('redirect_log').select('*', { count: 'exact', head: true })
        .gte('created_at', `${hoje}T00:00:00`).lt('created_at', `${hoje}T23:59:59.999`),
      // Redirects hoje Bolsa
      supabase.from('redirect_log_bolsa').select('*', { count: 'exact', head: true })
        .gte('created_at', `${hoje}T00:00:00`).lt('created_at', `${hoje}T23:59:59.999`),
      // IPs únicos hoje FGTS (buscar apenas IPs distintos)
      supabase.from('redirect_log').select('ip')
        .gte('created_at', `${hoje}T00:00:00`).lt('created_at', `${hoje}T23:59:59.999`),
      // IPs únicos hoje Bolsa
      supabase.from('redirect_log_bolsa').select('ip')
        .gte('created_at', `${hoje}T00:00:00`).lt('created_at', `${hoje}T23:59:59.999`),
    ]);

    // Helper para contar IPs únicos
    const countUniqueIps = (rows) => {
      if (!rows || rows.length === 0) return 0;
      const set = new Set();
      for (const r of rows) if (r.ip) set.add(r.ip);
      return set.size;
    };

    const fgtsData = fgtsNums.data || [];
    const bolsaData = bolsaNums.data || [];

    return res.status(200).json({
      fgts: {
        redirectsHoje: fgtsRedirects.count || 0,
        uniqueHoje: countUniqueIps(fgtsUniqueIps.data),
        totalNumeros: fgtsData.length,
        ativos: fgtsData.filter(n => n.ativo !== false).length,
      },
      bolsa: {
        redirectsHoje: bolsaRedirects.count || 0,
        uniqueHoje: countUniqueIps(bolsaUniqueIps.data),
        totalNumeros: bolsaData.length,
        ativos: bolsaData.filter(n => n.ativo !== false).length,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar dashboard stats' });
  }
};
