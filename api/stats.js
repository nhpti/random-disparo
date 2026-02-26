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

  // Cache na CDN da Vercel por 30s, stale-while-revalidate por 60s
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  try {
    // Usar horário de Brasília (UTC-3)
    const agora = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const hoje = agora.toISOString().split('T')[0]; // YYYY-MM-DD em BRT

    // Filtro por período (opcional)
    const de = req.query.de || hoje;
    const ate = req.query.ate || hoje;

    // Rodar contagens e primeira página de logs EM PARALELO (não sequencial)
    const PAGE = 5000; // páginas maiores = menos round-trips
    const [countTotal, countPeriodo, firstPage] = await Promise.all([
      // Total de redirects (todos os tempos)
      supabase.from('redirect_log').select('*', { count: 'exact', head: true }),
      // Redirects no período
      supabase.from('redirect_log').select('*', { count: 'exact', head: true })
        .gte('created_at', `${de}T00:00:00`).lt('created_at', `${ate}T23:59:59.999`),
      // Primeira página de logs detalhados
      supabase.from('redirect_log').select('numero, ip, created_at')
        .gte('created_at', `${de}T00:00:00`).lt('created_at', `${ate}T23:59:59.999`)
        .range(0, PAGE - 1).order('created_at', { ascending: true }),
    ]);

    if (countTotal.error) throw countTotal.error;
    if (countPeriodo.error) throw countPeriodo.error;
    if (firstPage.error) throw firstPage.error;

    const totalRedirects = countTotal.count;
    const redirectsPeriodo = countPeriodo.count;

    // Buscar restante dos logs só se primeira página estiver cheia
    let logsPeriodo = firstPage.data || [];
    if (logsPeriodo.length === PAGE) {
      let from = PAGE;
      while (true) {
        const { data: page, error: ePage } = await supabase
          .from('redirect_log')
          .select('numero, ip, created_at')
          .gte('created_at', `${de}T00:00:00`)
          .lt('created_at', `${ate}T23:59:59.999`)
          .range(from, from + PAGE - 1)
          .order('created_at', { ascending: true });
        if (ePage) throw ePage;
        logsPeriodo = logsPeriodo.concat(page || []);
        if (!page || page.length < PAGE) break;
        from += PAGE;
      }
    }

    const contagemPeriodo = {};
    const ipsPorNumero = {};    // IPs únicos por número
    const ipsUnicos = new Set();
    const porHora = new Array(24).fill(0);

    for (const log of logsPeriodo || []) {
      contagemPeriodo[log.numero] = (contagemPeriodo[log.numero] || 0) + 1;
      if (log.ip) {
        ipsUnicos.add(log.ip);
        if (!ipsPorNumero[log.numero]) ipsPorNumero[log.numero] = new Set();
        ipsPorNumero[log.numero].add(log.ip);
      }
      if (log.created_at) {
        // Converter para horário de Brasília (UTC-3)
        const horaBrt = new Date(new Date(log.created_at).getTime() - 3 * 60 * 60 * 1000);
        porHora[horaBrt.getUTCHours()]++;
      }
    }
    const porNumero = Object.entries(contagemPeriodo)
      .map(([numero, total]) => ({
        numero,
        total,
        uniqueIps: ipsPorNumero[numero] ? ipsPorNumero[numero].size : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const uniquePeriodo = ipsUnicos.size;

    // Histórico por dia no período (com IPs únicos)
    const porDia = {};
    for (const log of logsPeriodo) {
      const brt = new Date(new Date(log.created_at).getTime() - 3 * 60 * 60 * 1000);
      const diaKey = brt.toISOString().split('T')[0];
      if (!porDia[diaKey]) porDia[diaKey] = { cliques: 0, ips: new Set() };
      porDia[diaKey].cliques++;
      if (log.ip) porDia[diaKey].ips.add(log.ip);
    }

    const historico = [];
    const dInicio = new Date(`${de}T12:00:00`);
    const dFim = new Date(`${ate}T12:00:00`);
    for (let d = new Date(dInicio); d <= dFim; d.setDate(d.getDate() + 1)) {
      const diaStr = d.toISOString().split('T')[0];
      const info = porDia[diaStr] || { cliques: 0, ips: new Set() };
      const isHoje = diaStr === hoje;
      historico.push({
        data: diaStr,
        dia: `${diaStr.slice(8, 10)}/${diaStr.slice(5, 7)}`,
        cliques: info.cliques,
        uniqueIps: info.ips.size,
        isHoje,
      });
    }

    return res.status(200).json({
      totalRedirects: totalRedirects || 0,
      redirectsHoje: redirectsPeriodo || 0,
      uniqueHoje: uniquePeriodo,
      porNumero,
      porHora,
      historico,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar stats' });
  }
};
