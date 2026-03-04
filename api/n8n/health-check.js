const { supabase } = require('../../lib/supabase');

// ══════════════════════════════════════════════════════
// HEALTH CHECK v2 para n8n — Alertas Inteligentes
// GET /api/n8n/health-check?token=SEU_TOKEN
//
// Verifica:
// 1. Sistema parado (0 cliques geral)
// 2. Números ativos sem cliques (ignora recém-reativados)
// 3. Números com desempenho muito abaixo da média
// 4. 🔥 Spike de cliques — disparo forte detectado
//
// NÃO alerta mais:
// - Pausas intencionais (são operação normal)
// - Números recém-reativados (acabaram de voltar)
//
// Retorna: { ok, avisos[], problemas[], alerta_formatado }
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
    const horaAtual = agora.getHours();

    // Janelas de tempo
    const umaHoraAtras = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const duasHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const problemas = []; // Coisas graves (sistema parado, etc)
    const avisos = [];    // Informações úteis (spikes, desempenho)

    // ══════════════════════════════════════════════════
    // BUSCAR DADOS
    // ══════════════════════════════════════════════════

    // Números ativos
    const [fgtsNums, bolsaNums] = await Promise.all([
      supabase.from('numeros').select('id, numero, ativo').eq('ativo', true),
      supabase.from('numeros_bolsa').select('id, numero, ativo').eq('ativo', true),
    ]);

    const fgtsAtivos = fgtsNums.data || [];
    const bolsaAtivos = bolsaNums.data || [];

    // Cliques de hoje e da última hora
    const [fgtsCliquesHoje, bolsaCliquesHoje, fgtsCliques1h, bolsaCliques1h] = await Promise.all([
      supabase.from('redirect_log').select('numero')
        .gte('created_at', inicioHoje).lte('created_at', fimHoje),
      supabase.from('redirect_log_bolsa').select('numero')
        .gte('created_at', inicioHoje).lte('created_at', fimHoje),
      supabase.from('redirect_log').select('numero')
        .gte('created_at', umaHoraAtras),
      supabase.from('redirect_log_bolsa').select('numero')
        .gte('created_at', umaHoraAtras),
    ]);

    // Contagem por número
    const contarPorNumero = (rows) => {
      const contagem = {};
      for (const r of (rows || [])) {
        contagem[r.numero] = (contagem[r.numero] || 0) + 1;
      }
      return contagem;
    };

    const fgtsContagemHoje = contarPorNumero(fgtsCliquesHoje.data);
    const bolsaContagemHoje = contarPorNumero(bolsaCliquesHoje.data);
    const fgtsContagem1h = contarPorNumero(fgtsCliques1h.data);
    const bolsaContagem1h = contarPorNumero(bolsaCliques1h.data);

    const totalCliquesHoje = (fgtsCliquesHoje.data?.length || 0) + (bolsaCliquesHoje.data?.length || 0);
    const totalCliques1h = (fgtsCliques1h.data?.length || 0) + (bolsaCliques1h.data?.length || 0);

    // Buscar números recém-reativados hoje (pra ignorar no check de 0 cliques)
    const { data: reativadosHoje } = await supabase
      .from('activity_log')
      .select('numero, produto')
      .eq('acao', 'ativou')
      .gte('created_at', inicioHoje)
      .order('created_at', { ascending: false });

    const numerosReativadosHoje = new Set(
      (reativadosHoje || []).map(a => `${a.produto}-${a.numero}`)
    );

    // ══════════════════════════════════════════════════
    // 1. SISTEMA PARADO (grave)
    // ══════════════════════════════════════════════════
    if (horaAtual >= 10 && totalCliquesHoje === 0) {
      problemas.push({
        tipo: 'sistema_parado',
        produto: 'Geral',
        numero: null,
        mensagem: `🚨 SISTEMA PARADO: 0 cliques registrados hoje em TODOS os produtos!`,
      });
    }

    // ══════════════════════════════════════════════════
    // 2. NÚMEROS ATIVOS SEM CLIQUES (ignora recém-reativados)
    // ══════════════════════════════════════════════════
    if (horaAtual >= 12) {
      for (const n of fgtsAtivos) {
        // Ignorar se foi reativado hoje
        if (numerosReativadosHoje.has(`fgts-${n.numero}`)) continue;

        if (!fgtsContagemHoje[n.numero] || fgtsContagemHoje[n.numero] === 0) {
          problemas.push({
            tipo: 'sem_cliques',
            produto: 'FGTS',
            numero: n.numero,
            mensagem: `⚠️ FGTS: Número ${n.numero} está ATIVO mas tem 0 cliques hoje`,
          });
        }
      }

      for (const n of bolsaAtivos) {
        if (numerosReativadosHoje.has(`bolsa-${n.numero}`)) continue;

        if (!bolsaContagemHoje[n.numero] || bolsaContagemHoje[n.numero] === 0) {
          problemas.push({
            tipo: 'sem_cliques',
            produto: 'Bolsa',
            numero: n.numero,
            mensagem: `⚠️ Bolsa: Número ${n.numero} está ATIVO mas tem 0 cliques hoje`,
          });
        }
      }
    }

    // ══════════════════════════════════════════════════
    // 3. DESEMPENHO ABAIXO DA MÉDIA
    // ══════════════════════════════════════════════════
    if (horaAtual >= 14) {
      const verificarDesempenho = (ativos, contagem, produto) => {
        const valores = Object.values(contagem);
        if (valores.length === 0) return;
        const media = valores.reduce((a, b) => a + b, 0) / valores.length;

        for (const n of ativos) {
          if (numerosReativadosHoje.has(`${produto.toLowerCase()}-${n.numero}`)) continue;
          const cliques = contagem[n.numero] || 0;
          if (cliques > 0 && media > 10 && cliques < media * 0.2) {
            avisos.push({
              tipo: 'baixo_desempenho',
              produto,
              numero: n.numero,
              mensagem: `📉 ${produto}: Número ${n.numero} tem ${cliques} cliques (média: ${Math.round(media)}). 80% abaixo da média.`,
            });
          }
        }
      };

      verificarDesempenho(fgtsAtivos, fgtsContagemHoje, 'FGTS');
      verificarDesempenho(bolsaAtivos, bolsaContagemHoje, 'Bolsa');
    }

    // ══════════════════════════════════════════════════
    // 4. 🔥 SPIKE DE CLIQUES — Disparo forte!
    // Avisa quando um número tem muitos cliques na última hora
    // Threshold: 200+ cliques/hora por número ou 500+ total/hora
    // ══════════════════════════════════════════════════
    const SPIKE_POR_NUMERO = 200;  // cliques/hora por número
    const SPIKE_TOTAL = 500;       // cliques/hora total

    // Spike por número individual
    const verificarSpike = (contagem1h, produto) => {
      for (const [numero, cliques] of Object.entries(contagem1h)) {
        if (cliques >= SPIKE_POR_NUMERO) {
          avisos.push({
            tipo: 'spike_numero',
            produto,
            numero,
            mensagem: `🔥 ${produto}: Número ${numero} com ${cliques} cliques na última hora! Disparo forte!`,
          });
        }
      }
    };

    verificarSpike(fgtsContagem1h, 'FGTS');
    verificarSpike(bolsaContagem1h, 'Bolsa');

    // Spike geral do sistema
    if (totalCliques1h >= SPIKE_TOTAL) {
      avisos.push({
        tipo: 'spike_total',
        produto: 'Geral',
        numero: null,
        mensagem: `🔥 VOLUME ALTO: ${totalCliques1h} cliques na última hora! (FGTS: ${fgtsCliques1h.data?.length || 0} | Bolsa: ${bolsaCliques1h.data?.length || 0})`,
      });
    }

    // ══════════════════════════════════════════════════
    // 5. INFO: Números recém-reativados hoje (apenas informativo)
    // ══════════════════════════════════════════════════
    if (reativadosHoje && reativadosHoje.length > 0) {
      // Deduplica (pode ter múltiplas ativações do mesmo número)
      const jaAdicionado = new Set();
      for (const a of reativadosHoje) {
        const chave = `${a.produto}-${a.numero}`;
        if (jaAdicionado.has(chave)) continue;
        jaAdicionado.add(chave);
        avisos.push({
          tipo: 'reativado_hoje',
          produto: (a.produto || '').toUpperCase(),
          numero: a.numero,
          mensagem: `🟢 ${(a.produto || '').toUpperCase()}: Número ${a.numero} foi REATIVADO hoje`,
        });
      }
    }

    // ══════════════════════════════════════════════════
    // RESPOSTA
    // ══════════════════════════════════════════════════
    const ok = problemas.length === 0;
    const temAvisos = avisos.length > 0;

    let alerta_formatado = '';

    if (!ok || temAvisos) {
      const hora = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
      alerta_formatado = `📡 *Monitoramento — ${hoje} ${hora}*\n`;
      alerta_formatado += `Total cliques hoje: ${totalCliquesHoje} | Última hora: ${totalCliques1h}\n\n`;

      if (problemas.length > 0) {
        alerta_formatado += `🚨 *PROBLEMAS (${problemas.length}):*\n`;
        for (const p of problemas) {
          alerta_formatado += `${p.mensagem}\n`;
        }
        alerta_formatado += '\n';
      }

      // Separar avisos por tipo
      const spikes = avisos.filter(a => a.tipo.startsWith('spike'));
      const desempenho = avisos.filter(a => a.tipo === 'baixo_desempenho');
      const reativados = avisos.filter(a => a.tipo === 'reativado_hoje');

      if (spikes.length > 0) {
        alerta_formatado += `🔥 *DISPARO FORTE (${spikes.length}):*\n`;
        for (const s of spikes) {
          alerta_formatado += `${s.mensagem}\n`;
        }
        alerta_formatado += '\n';
      }

      if (desempenho.length > 0) {
        alerta_formatado += `📉 *DESEMPENHO BAIXO (${desempenho.length}):*\n`;
        for (const d of desempenho) {
          alerta_formatado += `${d.mensagem}\n`;
        }
        alerta_formatado += '\n';
      }

      if (reativados.length > 0) {
        alerta_formatado += `🟢 *REATIVADOS HOJE (${reativados.length}):*\n`;
        for (const r of reativados) {
          alerta_formatado += `${r.mensagem}\n`;
        }
        alerta_formatado += '\n';
      }

      alerta_formatado += `---\nPainel: https://random-disparo.vercel.app`;
    }

    return res.status(200).json({
      ok,
      tem_avisos: temAvisos,
      verificado_em: agora.toISOString(),
      hora_brasilia: `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`,
      total_cliques_hoje: totalCliquesHoje,
      total_cliques_ultima_hora: totalCliques1h,
      numeros_ativos: { fgts: fgtsAtivos.length, bolsa: bolsaAtivos.length },
      numeros_reativados_hoje: numerosReativadosHoje.size,
      problemas,
      avisos,
      alerta_formatado,
    });

  } catch (err) {
    console.error('[HEALTH CHECK ERROR]', err);
    return res.status(500).json({ error: 'Erro ao verificar saúde do sistema.' });
  }
};
