const { supabase } = require('../lib/supabase');
const { verifyAuth } = require('../lib/auth');

// GET /api/realtime-chart — Cliques por minuto (últimos 60 min)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Não autorizado.' });

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  try {
    const sessentaMinAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const agora = Date.now();

    // Buscar cliques de ambos os produtos
    const [fgtsLogs, bolsaLogs] = await Promise.all([
      supabase.from('redirect_log').select('created_at')
        .gte('created_at', sessentaMinAtras).order('created_at', { ascending: true }),
      supabase.from('redirect_log_bolsa').select('created_at')
        .gte('created_at', sessentaMinAtras).order('created_at', { ascending: true }),
    ]);

    // Array de 60 posições (minuto 0 = mais antigo, minuto 59 = agora)
    const minutos = new Array(60).fill(0);
    const fgtsMin = new Array(60).fill(0);
    const bolsaMin = new Array(60).fill(0);

    for (const log of (fgtsLogs.data || [])) {
      const minAgo = Math.floor((agora - new Date(log.created_at).getTime()) / 60000);
      if (minAgo >= 0 && minAgo < 60) {
        const idx = 59 - minAgo;
        minutos[idx]++;
        fgtsMin[idx]++;
      }
    }

    for (const log of (bolsaLogs.data || [])) {
      const minAgo = Math.floor((agora - new Date(log.created_at).getTime()) / 60000);
      if (minAgo >= 0 && minAgo < 60) {
        const idx = 59 - minAgo;
        minutos[idx]++;
        bolsaMin[idx]++;
      }
    }

    const total = (fgtsLogs.data?.length || 0) + (bolsaLogs.data?.length || 0);
    const pico = Math.max(...minutos, 1);

    return res.status(200).json({
      minutos,
      fgts: fgtsMin,
      bolsa: bolsaMin,
      total,
      pico,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[REALTIME CHART ERROR]', err);
    return res.status(500).json({ error: 'Erro ao buscar dados em tempo real.' });
  }
};
