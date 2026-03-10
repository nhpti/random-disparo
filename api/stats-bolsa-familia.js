const { supabase } = require('../lib/supabase');
const { verifyAuth } = require('../lib/auth');

// GET /api/stats-bolsa-familia — estatísticas Bolsa Família (autenticado)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Não autorizado. Faça login.' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  try {
    const agora = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const hoje = agora.toISOString().split('T')[0];

    const de = req.query.de || hoje;
    const ate = req.query.ate || hoje;

    const inicioFiltro = `${de}T00:00:00-03:00`;
    const fimFiltro = `${ate}T23:59:59.999-03:00`;

    const PAGE = 1000;

    const [countTotal, countPeriodo, firstPage] = await Promise.all([
      supabase.from('redirect_log_bolsa_familia').select('*', { count: 'exact', head: true }),
      supabase.from('redirect_log_bolsa_familia').select('*', { count: 'exact', head: true })
        .gte('created_at', inicioFiltro).lte('created_at', fimFiltro),
      supabase.from('redirect_log_bolsa_familia').select('numero, ip, created_at')
        .gte('created_at', inicioFiltro).lte('created_at', fimFiltro)
        .range(0, PAGE - 1).order('created_at', { ascending: true }),
    ]);

    if (countTotal.error) throw countTotal.error;
    if (countPeriodo.error) throw countPeriodo.error;
    if (firstPage.error) throw firstPage.error;

    const totalRedirects = countTotal.count;
    const redirectsPeriodo = countPeriodo.count;

    let logsPeriodo = firstPage.data || [];
    if (logsPeriodo.length === PAGE && redirectsPeriodo > PAGE) {
      const totalPages = Math.ceil(redirectsPeriodo / PAGE);
      const BATCH = 5;
      for (let batch = 1; batch < totalPages; batch += BATCH) {
        const promises = [];
        for (let p = batch; p < Math.min(batch + BATCH, totalPages); p++) {
          promises.push(
            supabase.from('redirect_log_bolsa_familia').select('numero, ip, created_at')
              .gte('created_at', inicioFiltro).lte('created_at', fimFiltro)
              .range(p * PAGE, (p + 1) * PAGE - 1)
              .order('created_at', { ascending: true })
          );
        }
        const results = await Promise.all(promises);
        for (const r of results) {
          if (r.error) throw r.error;
          if (r.data) logsPeriodo = logsPeriodo.concat(r.data);
        }
      }
    }

    const contagemPeriodo = {};
    const ipsPorNumero = {};
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
