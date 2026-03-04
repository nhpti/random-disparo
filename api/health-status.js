const { supabase } = require('../lib/supabase');
const { verifyAuth } = require('../lib/auth');

// GET /api/health-status — Health check para o painel (usa auth do usuário)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Não autorizado.' });

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=180');

  try {
    const agora = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const hoje = agora.toISOString().split('T')[0];
    const inicioHoje = `${hoje}T00:00:00-03:00`;
    const fimHoje = `${hoje}T23:59:59.999-03:00`;
    const horaAtual = agora.getHours();
    const umaHoraAtras = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

    const problemas = [];
    const avisos = [];

    // Buscar dados em paralelo
    const [fgtsNums, bolsaNums, fgtsHoje, bolsaHoje, fgts1h, bolsa1h, reativados] = await Promise.all([
      supabase.from('numeros').select('id, numero, ativo').eq('ativo', true),
      supabase.from('numeros_bolsa').select('id, numero, ativo').eq('ativo', true),
      supabase.from('redirect_log').select('numero').gte('created_at', inicioHoje).lte('created_at', fimHoje),
      supabase.from('redirect_log_bolsa').select('numero').gte('created_at', inicioHoje).lte('created_at', fimHoje),
      supabase.from('redirect_log').select('numero').gte('created_at', umaHoraAtras),
      supabase.from('redirect_log_bolsa').select('numero').gte('created_at', umaHoraAtras),
      supabase.from('activity_log').select('numero, produto').eq('acao', 'ativou').gte('created_at', inicioHoje),
    ]);

    const fgtsAtivos = fgtsNums.data || [];
    const bolsaAtivos = bolsaNums.data || [];

    const contarPorNumero = (rows) => {
      const c = {};
      for (const r of (rows || [])) c[r.numero] = (c[r.numero] || 0) + 1;
      return c;
    };

    const fgtsContagemHoje = contarPorNumero(fgtsHoje.data);
    const bolsaContagemHoje = contarPorNumero(bolsaHoje.data);
    const fgtsContagem1h = contarPorNumero(fgts1h.data);
    const bolsaContagem1h = contarPorNumero(bolsa1h.data);

    const totalCliquesHoje = (fgtsHoje.data?.length || 0) + (bolsaHoje.data?.length || 0);
    const totalCliques1h = (fgts1h.data?.length || 0) + (bolsa1h.data?.length || 0);

    const numerosReativados = new Set(
      (reativados.data || []).map(a => `${a.produto}-${a.numero}`)
    );

    // 1. Sistema parado
    if (horaAtual >= 10 && totalCliquesHoje === 0) {
      problemas.push({
        tipo: 'sistema_parado',
        mensagem: '🚨 Sistema parado: 0 cliques em todos os produtos hoje!',
      });
    }

    // 2. Números sem cliques
    if (horaAtual >= 12) {
      for (const n of fgtsAtivos) {
        if (numerosReativados.has(`fgts-${n.numero}`)) continue;
        if (!fgtsContagemHoje[n.numero]) {
          problemas.push({
            tipo: 'sem_cliques', produto: 'FGTS', numero: n.numero,
            mensagem: `⚠️ FGTS: ${n.numero} sem cliques hoje`,
          });
        }
      }
      for (const n of bolsaAtivos) {
        if (numerosReativados.has(`bolsa-${n.numero}`)) continue;
        if (!bolsaContagemHoje[n.numero]) {
          problemas.push({
            tipo: 'sem_cliques', produto: 'Bolsa', numero: n.numero,
            mensagem: `⚠️ Bolsa: ${n.numero} sem cliques hoje`,
          });
        }
      }
    }

    // 3. Desempenho baixo
    if (horaAtual >= 14) {
      const checkDesempenho = (ativos, contagem, produto) => {
        const vals = Object.values(contagem);
        if (vals.length === 0) return;
        const media = vals.reduce((a, b) => a + b, 0) / vals.length;
        for (const n of ativos) {
          if (numerosReativados.has(`${produto.toLowerCase()}-${n.numero}`)) continue;
          const c = contagem[n.numero] || 0;
          if (c > 0 && media > 10 && c < media * 0.2) {
            avisos.push({
              tipo: 'baixo_desempenho', produto, numero: n.numero,
              mensagem: `📉 ${produto}: ${n.numero} tem ${c} cliques (média: ${Math.round(media)})`,
            });
          }
        }
      };
      checkDesempenho(fgtsAtivos, fgtsContagemHoje, 'FGTS');
      checkDesempenho(bolsaAtivos, bolsaContagemHoje, 'Bolsa');
    }

    // 4. Spikes
    const checkSpike = (contagem1h, produto) => {
      for (const [numero, cliques] of Object.entries(contagem1h)) {
        if (cliques >= 200) {
          avisos.push({
            tipo: 'spike', produto, numero,
            mensagem: `🔥 ${produto}: ${numero} com ${cliques} cliques na última hora!`,
          });
        }
      }
    };
    checkSpike(fgtsContagem1h, 'FGTS');
    checkSpike(bolsaContagem1h, 'Bolsa');

    if (totalCliques1h >= 500) {
      avisos.push({
        tipo: 'spike_total',
        mensagem: `🔥 Volume alto: ${totalCliques1h} cliques na última hora!`,
      });
    }

    const ok = problemas.length === 0;

    return res.status(200).json({
      ok,
      verificado_em: new Date().toISOString(),
      hora_brasilia: `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`,
      total_cliques_hoje: totalCliquesHoje,
      total_cliques_1h: totalCliques1h,
      numeros_ativos: { fgts: fgtsAtivos.length, bolsa: bolsaAtivos.length },
      problemas,
      avisos,
    });
  } catch (err) {
    console.error('[HEALTH STATUS ERROR]', err);
    return res.status(500).json({ error: 'Erro ao verificar saúde do sistema.' });
  }
};
