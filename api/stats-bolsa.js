const { supabase } = require('../lib/supabase');
const { verifyAuth } = require('../lib/auth');

// GET /api/stats-bolsa — estatísticas Bolsa Família (autenticado)
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

  try {
    const hoje = new Date().toISOString().split('T')[0];

    const { count: totalRedirects, error: e1 } = await supabase
      .from('redirect_log_bolsa')
      .select('*', { count: 'exact', head: true });
    if (e1) throw e1;

    const { count: redirectsHoje, error: e2 } = await supabase
      .from('redirect_log_bolsa')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${hoje}T00:00:00`)
      .lt('created_at', `${hoje}T23:59:59.999`);
    if (e2) throw e2;

    // Buscar em páginas de 1000 para contornar limite do Supabase
    let logsHoje = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data: page, error: ePage } = await supabase
        .from('redirect_log_bolsa')
        .select('numero, ip, created_at')
        .gte('created_at', `${hoje}T00:00:00`)
        .lt('created_at', `${hoje}T23:59:59.999`)
        .range(from, from + PAGE - 1)
        .order('created_at', { ascending: true });
      if (ePage) throw ePage;
      logsHoje = logsHoje.concat(page || []);
      if (!page || page.length < PAGE) break;
      from += PAGE;
    }

    const contagemHoje = {};
    const ipsPorNumero = {};
    const ipsUnicos = new Set();
    const porHora = new Array(24).fill(0);

    for (const log of logsHoje || []) {
      contagemHoje[log.numero] = (contagemHoje[log.numero] || 0) + 1;
      if (log.ip) {
        ipsUnicos.add(log.ip);
        if (!ipsPorNumero[log.numero]) ipsPorNumero[log.numero] = new Set();
        ipsPorNumero[log.numero].add(log.ip);
      }
      if (log.created_at) {
        const hora = new Date(log.created_at).getHours();
        porHora[hora]++;
      }
    }
    const porNumero = Object.entries(contagemHoje)
      .map(([numero, total]) => ({
        numero,
        total,
        uniqueIps: ipsPorNumero[numero] ? ipsPorNumero[numero].size : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const uniqueHoje = ipsUnicos.size;

    const historico = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dia = d.toISOString().split('T')[0];

      const { count, error: eH } = await supabase
        .from('redirect_log_bolsa')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${dia}T00:00:00`)
        .lt('created_at', `${dia}T23:59:59.999`);
      if (eH) throw eH;

      historico.push({
        data: dia,
        dia: `${dia.slice(8, 10)}/${dia.slice(5, 7)}`,
        cliques: count || 0,
      });
    }

    return res.status(200).json({
      totalRedirects: totalRedirects || 0,
      redirectsHoje: redirectsHoje || 0,
      uniqueHoje,
      porNumero,
      porHora,
      historico,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar stats' });
  }
};
