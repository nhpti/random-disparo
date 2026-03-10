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
  res.setHeader('Cache-Control', 's-maxage=90, stale-while-revalidate=180');

  try {
    const agora = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const hoje = agora.toISOString().split('T')[0];
    const ontemDate = new Date(new Date(`${hoje}T12:00:00`).getTime() - 86400000);
    const ontem = ontemDate.toISOString().split('T')[0];

    // Limites do dia em horário de Brasília (UTC-3)
    const inicioHoje = `${hoje}T00:00:00-03:00`;
    const fimHoje = `${hoje}T23:59:59.999-03:00`;
    const inicioOntem = `${ontem}T00:00:00-03:00`;
    const fimOntem = `${ontem}T23:59:59.999-03:00`;

    // Rodar TODAS as queries em paralelo
    const [
      fgtsNums, bolsaNums, bolsaFamNums,
      fgtsRedirects, bolsaRedirects, bolsaFamRedirects,
      fgtsIpCount, bolsaIpCount, bolsaFamIpCount,
      fgtsRedirectsOntem, bolsaRedirectsOntem, bolsaFamRedirectsOntem,
    ] = await Promise.all([
      // Números
      supabase.from('numeros').select('id, ativo'),
      supabase.from('numeros_bolsa').select('id, ativo'),
      supabase.from('numeros_bolsa_familia').select('id, ativo'),
      // Redirects hoje (count)
      supabase.from('redirect_log').select('*', { count: 'exact', head: true })
        .gte('created_at', inicioHoje).lte('created_at', fimHoje),
      supabase.from('redirect_log_bolsa').select('*', { count: 'exact', head: true })
        .gte('created_at', inicioHoje).lte('created_at', fimHoje),
      supabase.from('redirect_log_bolsa_familia').select('*', { count: 'exact', head: true })
        .gte('created_at', inicioHoje).lte('created_at', fimHoje),
      // IPs hoje
      supabase.from('redirect_log').select('ip')
        .gte('created_at', inicioHoje).lte('created_at', fimHoje)
        .limit(1000),
      supabase.from('redirect_log_bolsa').select('ip')
        .gte('created_at', inicioHoje).lte('created_at', fimHoje)
        .limit(1000),
      supabase.from('redirect_log_bolsa_familia').select('ip')
        .gte('created_at', inicioHoje).lte('created_at', fimHoje)
        .limit(1000),
      // Redirects ontem (count)
      supabase.from('redirect_log').select('*', { count: 'exact', head: true })
        .gte('created_at', inicioOntem).lte('created_at', fimOntem),
      supabase.from('redirect_log_bolsa').select('*', { count: 'exact', head: true })
        .gte('created_at', inicioOntem).lte('created_at', fimOntem),
      supabase.from('redirect_log_bolsa_familia').select('*', { count: 'exact', head: true })
        .gte('created_at', inicioOntem).lte('created_at', fimOntem),
    ]);

    // Helper para contar IPs únicos (com paginação se necessário)
    const countUniqueIps = async (firstRows, table, count) => {
      if (!firstRows || firstRows.length === 0) return 0;
      let allRows = firstRows;
      if (firstRows.length === 1000 && count > 1000) {
        const totalPages = Math.ceil(count / 1000);
        const promises = [];
        for (let p = 1; p < totalPages; p++) {
          promises.push(
            supabase.from(table).select('ip')
              .gte('created_at', inicioHoje).lte('created_at', fimHoje)
              .range(p * 1000, (p + 1) * 1000 - 1)
          );
        }
        const results = await Promise.all(promises);
        for (const r of results) {
          if (r.data) allRows = allRows.concat(r.data);
        }
      }
      const set = new Set();
      for (const r of allRows) if (r.ip) set.add(r.ip);
      return set.size;
    };

    const fgtsData = fgtsNums.data || [];
    const bolsaData = bolsaNums.data || [];
    const bolsaFamData = bolsaFamNums.data || [];

    const [fgtsUnique, bolsaUnique, bolsaFamUnique] = await Promise.all([
      countUniqueIps(fgtsIpCount.data, 'redirect_log', fgtsRedirects.count || 0),
      countUniqueIps(bolsaIpCount.data, 'redirect_log_bolsa', bolsaRedirects.count || 0),
      countUniqueIps(bolsaFamIpCount.data, 'redirect_log_bolsa_familia', bolsaFamRedirects.count || 0),
    ]);

    return res.status(200).json({
      fgts: {
        redirectsHoje: fgtsRedirects.count || 0,
        redirectsOntem: fgtsRedirectsOntem.count || 0,
        uniqueHoje: fgtsUnique,
        totalNumeros: fgtsData.length,
        ativos: fgtsData.filter(n => n.ativo !== false).length,
      },
      bolsa: {
        redirectsHoje: bolsaRedirects.count || 0,
        redirectsOntem: bolsaRedirectsOntem.count || 0,
        uniqueHoje: bolsaUnique,
        totalNumeros: bolsaData.length,
        ativos: bolsaData.filter(n => n.ativo !== false).length,
      },
      'bolsa-familia': {
        redirectsHoje: bolsaFamRedirects.count || 0,
        redirectsOntem: bolsaFamRedirectsOntem.count || 0,
        uniqueHoje: bolsaFamUnique,
        totalNumeros: bolsaFamData.length,
        ativos: bolsaFamData.filter(n => n.ativo !== false).length,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar dashboard stats' });
  }
};
