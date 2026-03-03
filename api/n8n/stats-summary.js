const { supabase } = require('../../lib/supabase');

// ══════════════════════════════════════════════════════
// STATS SUMMARY para n8n consumir
// GET /api/n8n/stats-summary
// Autenticação via ?token=SEU_TOKEN_SECRETO (variável de ambiente)
// Ideal para o n8n chamar via HTTP Request node
// ══════════════════════════════════════════════════════

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Autenticação simples via token na query string
  // A variável N8N_API_TOKEN deve ser configurada na Vercel
  const tokenEnv = process.env.N8N_API_TOKEN;
  const tokenReq = req.query.token || req.headers['x-n8n-token'];

  if (!tokenEnv || tokenReq !== tokenEnv) {
    return res.status(401).json({ error: 'Token inválido ou não configurado.' });
  }

  try {
    // Horário de Brasília (UTC-3)
    const agora = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const hoje = agora.toISOString().split('T')[0];
    const inicioHoje = `${hoje}T00:00:00-03:00`;
    const fimHoje = `${hoje}T23:59:59.999-03:00`;

    // Helper para buscar TODOS os registros com paginação automática
    const PAGE_SIZE = 1000;
    async function fetchAllRows(table, campo, inicio, fim) {
      let allRows = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from(table)
          .select(campo)
          .gte('created_at', inicio)
          .lte('created_at', fim)
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (error || !data || data.length === 0) break;
        allRows = allRows.concat(data);
        hasMore = data.length === PAGE_SIZE;
        page++;
      }
      return allRows;
    }

    // Queries iniciais em paralelo (números + counts)
    const [
      fgtsNums, bolsaNums,
      fgtsRedirects, bolsaRedirects,
    ] = await Promise.all([
      supabase.from('numeros').select('id, numero, ativo'),
      supabase.from('numeros_bolsa').select('id, numero, ativo'),
      supabase.from('redirect_log').select('*', { count: 'exact', head: true })
        .gte('created_at', inicioHoje).lte('created_at', fimHoje),
      supabase.from('redirect_log_bolsa').select('*', { count: 'exact', head: true })
        .gte('created_at', inicioHoje).lte('created_at', fimHoje),
    ]);

    // Buscar TODOS os IPs e números com paginação (em paralelo)
    const [fgtsAllIps, bolsaAllIps, fgtsAllNumeros, bolsaAllNumeros] = await Promise.all([
      fetchAllRows('redirect_log', 'ip', inicioHoje, fimHoje),
      fetchAllRows('redirect_log_bolsa', 'ip', inicioHoje, fimHoje),
      fetchAllRows('redirect_log', 'numero', inicioHoje, fimHoje),
      fetchAllRows('redirect_log_bolsa', 'numero', inicioHoje, fimHoje),
    ]);

    // Contar IPs únicos
    const uniqueIps = (rows) => {
      if (!rows || rows.length === 0) return 0;
      return new Set(rows.map(r => r.ip).filter(Boolean)).size;
    };

    // Ranking de números mais acessados
    const rankingNumeros = (rows) => {
      if (!rows || rows.length === 0) return [];
      const contagem = {};
      for (const r of rows) {
        contagem[r.numero] = (contagem[r.numero] || 0) + 1;
      }
      return Object.entries(contagem)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([numero, cliques]) => ({ numero, cliques }));
    };

    const fgtsData = fgtsNums.data || [];
    const bolsaData = bolsaNums.data || [];

    // Montar resposta formatada para n8n
    const resumo = {
      data: hoje,
      gerado_em: new Date().toISOString(),
      fgts: {
        cliques_hoje: fgtsRedirects.count || 0,
        ips_unicos_hoje: uniqueIps(fgtsAllIps),
        numeros_total: fgtsData.length,
        numeros_ativos: fgtsData.filter(n => n.ativo !== false).length,
        numeros_inativos: fgtsData.filter(n => n.ativo === false).length,
        top_numeros: rankingNumeros(fgtsAllNumeros),
        lista_numeros: fgtsData.map(n => ({
          numero: n.numero,
          ativo: n.ativo !== false,
        })),
      },
      bolsa: {
        cliques_hoje: bolsaRedirects.count || 0,
        ips_unicos_hoje: uniqueIps(bolsaAllIps),
        numeros_total: bolsaData.length,
        numeros_ativos: bolsaData.filter(n => n.ativo !== false).length,
        numeros_inativos: bolsaData.filter(n => n.ativo === false).length,
        top_numeros: rankingNumeros(bolsaAllNumeros),
        lista_numeros: bolsaData.map(n => ({
          numero: n.numero,
          ativo: n.ativo !== false,
        })),
      },
      totais: {
        cliques_total: (fgtsRedirects.count || 0) + (bolsaRedirects.count || 0),
        ips_unicos_total: uniqueIps([...fgtsAllIps, ...bolsaAllIps]),
        numeros_ativos_total: fgtsData.filter(n => n.ativo !== false).length + bolsaData.filter(n => n.ativo !== false).length,
      },
      // Texto formatado para enviar direto por email/whatsapp
      mensagem_formatada: montarMensagem(hoje, fgtsRedirects.count || 0, bolsaRedirects.count || 0,
        uniqueIps(fgtsAllIps), uniqueIps(bolsaAllIps),
        fgtsData, bolsaData,
        rankingNumeros(fgtsAllNumeros), rankingNumeros(bolsaAllNumeros)),
    };

    return res.status(200).json(resumo);
  } catch (err) {
    console.error('[STATS SUMMARY ERROR]', err);
    return res.status(500).json({ error: 'Erro ao gerar resumo.' });
  }
};

// Monta texto formatado para enviar diretamente por email/WhatsApp
function montarMensagem(data, fgtsClicks, bolsaClicks, fgtsIps, bolsaIps, fgtsNums, bolsaNums, fgtsTop, bolsaTop) {
  const fgtsAtivos = fgtsNums.filter(n => n.ativo !== false).length;
  const bolsaAtivos = bolsaNums.filter(n => n.ativo !== false).length;

  let msg = `📊 *Relatório Diário — ${data}*\n\n`;

  msg += `💼 *CLT & FGTS*\n`;
  msg += `   Cliques: ${fgtsClicks}\n`;
  msg += `   IPs únicos: ${fgtsIps}\n`;
  msg += `   Números ativos: ${fgtsAtivos}/${fgtsNums.length}\n`;
  if (fgtsTop.length > 0) {
    msg += `   Top números:\n`;
    fgtsTop.forEach((t, i) => {
      msg += `     ${i + 1}. ${t.numero} → ${t.cliques} cliques\n`;
    });
  }

  msg += `\n👨‍👩‍👧‍👦 *Bolsa Família*\n`;
  msg += `   Cliques: ${bolsaClicks}\n`;
  msg += `   IPs únicos: ${bolsaIps}\n`;
  msg += `   Números ativos: ${bolsaAtivos}/${bolsaNums.length}\n`;
  if (bolsaTop.length > 0) {
    msg += `   Top números:\n`;
    bolsaTop.forEach((t, i) => {
      msg += `     ${i + 1}. ${t.numero} → ${t.cliques} cliques\n`;
    });
  }

  msg += `\n📈 *Totais*\n`;
  msg += `   Cliques total: ${fgtsClicks + bolsaClicks}\n`;
  msg += `   Números ativos total: ${fgtsAtivos + bolsaAtivos}\n`;

  return msg;
}
