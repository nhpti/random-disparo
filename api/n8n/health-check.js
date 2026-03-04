const { supabase } = require('../../lib/supabase');

// ══════════════════════════════════════════════════════
// HEALTH CHECK para n8n — Alertas de Problema
// GET /api/n8n/health-check?token=SEU_TOKEN
//
// Verifica:
// 1. Números ativos com 0 cliques nas últimas 2h (possível problema)
// 2. Números desativados nas últimas 2h
// 3. Se o sistema inteiro está sem cliques (possível queda)
//
// Retorna: { ok, problemas[], alerta_formatado }
// Se ok=true → tudo normal, nada pra alertar
// Se ok=false → tem problemas detectados
// ══════════════════════════════════════════════════════

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Autenticação
  const tokenEnv = process.env.N8N_API_TOKEN;
  const tokenReq = req.query.token || req.headers['x-n8n-token'];
  if (!tokenEnv || tokenReq !== tokenEnv) {
    return res.status(401).json({ error: 'Token inválido.' });
  }

  try {
    // Horário de Brasília (UTC-3)
    const agora = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const hoje = agora.toISOString().split('T')[0];
    const inicioHoje = `${hoje}T00:00:00-03:00`;
    const fimHoje = `${hoje}T23:59:59.999-03:00`;

    // Últimas 2 horas (janela de checagem)
    const duasHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const problemas = [];

    // ── 1. Buscar números ativos ──
    const [fgtsNums, bolsaNums] = await Promise.all([
      supabase.from('numeros').select('id, numero, ativo').eq('ativo', true),
      supabase.from('numeros_bolsa').select('id, numero, ativo').eq('ativo', true),
    ]);

    const fgtsAtivos = fgtsNums.data || [];
    const bolsaAtivos = bolsaNums.data || [];

    // ── 2. Buscar cliques de hoje por número ──
    const [fgtsCliques, bolsaCliques] = await Promise.all([
      supabase.from('redirect_log').select('numero')
        .gte('created_at', inicioHoje).lte('created_at', fimHoje),
      supabase.from('redirect_log_bolsa').select('numero')
        .gte('created_at', inicioHoje).lte('created_at', fimHoje),
    ]);

    // Contar cliques por número
    const contarPorNumero = (rows) => {
      const contagem = {};
      for (const r of (rows || [])) {
        contagem[r.numero] = (contagem[r.numero] || 0) + 1;
      }
      return contagem;
    };

    const fgtsContagem = contarPorNumero(fgtsCliques.data);
    const bolsaContagem = contarPorNumero(bolsaCliques.data);

    // ── 3. Verificar números ativos com 0 cliques hoje ──
    // Só alerta se já passou das 10h (antes disso é normal ter poucos cliques)
    const horaAtual = agora.getHours();

    if (horaAtual >= 10) {
      for (const n of fgtsAtivos) {
        if (!fgtsContagem[n.numero] || fgtsContagem[n.numero] === 0) {
          problemas.push({
            tipo: 'sem_cliques',
            produto: 'FGTS',
            numero: n.numero,
            mensagem: `⚠️ FGTS: Número ${n.numero} está ATIVO mas tem 0 cliques hoje`,
          });
        }
      }

      for (const n of bolsaAtivos) {
        if (!bolsaContagem[n.numero] || bolsaContagem[n.numero] === 0) {
          problemas.push({
            tipo: 'sem_cliques',
            produto: 'Bolsa',
            numero: n.numero,
            mensagem: `⚠️ Bolsa: Número ${n.numero} está ATIVO mas tem 0 cliques hoje`,
          });
        }
      }
    }

    // ── 4. Verificar se o sistema inteiro está parado ──
    const totalCliquesHoje = (fgtsCliques.data?.length || 0) + (bolsaCliques.data?.length || 0);

    if (horaAtual >= 12 && totalCliquesHoje === 0) {
      problemas.push({
        tipo: 'sistema_parado',
        produto: 'Geral',
        numero: null,
        mensagem: `🚨 SISTEMA PARADO: 0 cliques registrados hoje em TODOS os produtos!`,
      });
    }

    // ── 5. Verificar atividades recentes (números desativados nas últimas 2h) ──
    const { data: atividadesRecentes } = await supabase
      .from('activity_log')
      .select('*')
      .eq('acao', 'pausou')
      .gte('created_at', duasHorasAtras)
      .order('created_at', { ascending: false });

    if (atividadesRecentes && atividadesRecentes.length > 0) {
      for (const a of atividadesRecentes) {
        problemas.push({
          tipo: 'numero_desativado',
          produto: (a.produto || '').toUpperCase(),
          numero: a.numero,
          mensagem: `🔴 ${(a.produto || '').toUpperCase()}: Número ${a.numero} foi DESATIVADO por ${a.usuario_email || 'desconhecido'}`,
        });
      }
    }

    // ── 6. Números ativos com cliques muito abaixo da média ──
    if (horaAtual >= 14) {
      const mediaFgts = Object.values(fgtsContagem).length > 0
        ? Object.values(fgtsContagem).reduce((a, b) => a + b, 0) / Object.values(fgtsContagem).length
        : 0;

      for (const n of fgtsAtivos) {
        const cliques = fgtsContagem[n.numero] || 0;
        if (cliques > 0 && mediaFgts > 10 && cliques < mediaFgts * 0.2) {
          problemas.push({
            tipo: 'baixo_desempenho',
            produto: 'FGTS',
            numero: n.numero,
            mensagem: `📉 FGTS: Número ${n.numero} tem ${cliques} cliques (média: ${Math.round(mediaFgts)}). Desempenho 80% abaixo da média.`,
          });
        }
      }

      const mediaBolsa = Object.values(bolsaContagem).length > 0
        ? Object.values(bolsaContagem).reduce((a, b) => a + b, 0) / Object.values(bolsaContagem).length
        : 0;

      for (const n of bolsaAtivos) {
        const cliques = bolsaContagem[n.numero] || 0;
        if (cliques > 0 && mediaBolsa > 10 && cliques < mediaBolsa * 0.2) {
          problemas.push({
            tipo: 'baixo_desempenho',
            produto: 'Bolsa',
            numero: n.numero,
            mensagem: `📉 Bolsa: Número ${n.numero} tem ${cliques} cliques (média: ${Math.round(mediaBolsa)}). Desempenho 80% abaixo da média.`,
          });
        }
      }
    }

    // ── Resposta ──
    const ok = problemas.length === 0;

    let alerta_formatado = '';
    if (!ok) {
      alerta_formatado = `🚨 *ALERTA — ${hoje} ${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}*\n\n`;
      alerta_formatado += `Foram detectados ${problemas.length} problema(s):\n\n`;
      for (const p of problemas) {
        alerta_formatado += `${p.mensagem}\n`;
      }
      alerta_formatado += `\n---\nVerifique no painel: https://random-disparo.vercel.app`;
    }

    return res.status(200).json({
      ok,
      verificado_em: agora.toISOString(),
      hora_brasilia: `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`,
      total_cliques_hoje: totalCliquesHoje,
      numeros_ativos: { fgts: fgtsAtivos.length, bolsa: bolsaAtivos.length },
      problemas,
      alerta_formatado,
    });

  } catch (err) {
    console.error('[HEALTH CHECK ERROR]', err);
    return res.status(500).json({ error: 'Erro ao verificar saúde do sistema.' });
  }
};
