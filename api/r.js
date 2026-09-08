const { supabase } = require('../lib/supabase');
const { getNextNumero } = require('../lib/round-robin');
const { getFallbackNumber } = require('../lib/fallback');

// Mapeamento de produtos para tabelas do Supabase
const MAPA_PRODUTOS_TABELAS = {
  'fgts': 'numeros',
  'clt': 'numeros',
  'garantia-veicular': 'numeros',
  'bolsa': 'numeros_bolsa',
  'bolsa-familia': 'numeros_bolsa_familia',
  'inss': 'numeros_bolsa_familia',
  'renegociacao': 'numeros_renegociacao'
};

// ══════════════════════════════════════════════════════
// REDIRECT DINÂMICO DE PARCEIROS
// GET /api/r?produto=fgts&parceiro=joao&origem=i8
// ══════════════════════════════════════════════════════
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { produto, parceiro, origem } = req.query;

  const prodKey = (produto || '').toLowerCase().trim();
  const origemKey = (origem || '').toLowerCase().trim();
  const parceiroKey = (parceiro || '').toLowerCase().trim();

  try {
    // 1. Buscar a rota do parceiro cadastrada ou usar defaults
    let mensagemTemplate = '({origem}) Olá! Quero saber mais informações.';
    let tabelaAlvo = MAPA_PRODUTOS_TABELAS[prodKey] || 'numeros';

    // Determina o código de origem candidato (pode estar em origem, parceiro ou produto)
    const codigoBusca = origemKey || parceiroKey || prodKey;

    if (codigoBusca) {
      // Tenta buscar primeiro combinando código de origem + produto específico
      let rota = null;
      if (prodKey) {
        const { data: rotaProd } = await supabase
          .from('rotas_parceiros')
          .select('*')
          .eq('codigo_origem', codigoBusca)
          .eq('produto', prodKey)
          .eq('ativo', true)
          .order('criado_em', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (rotaProd) rota = rotaProd;
      }

      // Se não encontrou por produto específico, busca apenas pelo código de origem
      if (!rota) {
        const { data: rotaGenerica } = await supabase
          .from('rotas_parceiros')
          .select('*')
          .eq('codigo_origem', codigoBusca)
          .eq('ativo', true)
          .order('criado_em', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (rotaGenerica) rota = rotaGenerica;
      }

      if (rota) {
        if (rota.mensagem_template && rota.mensagem_template.trim()) {
          mensagemTemplate = rota.mensagem_template;
        }
        if (rota.produto && MAPA_PRODUTOS_TABELAS[rota.produto]) {
          tabelaAlvo = MAPA_PRODUTOS_TABELAS[rota.produto];
        }
      }
    }

    // 2. Substituir variáveis no template ({origem}, (origem), {parceiro}, {produto})
    let mensagemFinal = mensagemTemplate
      .replace(/\{origem\}/gi, codigoBusca)
      .replace(/\(origem\)/gi, codigoBusca ? `(${codigoBusca})` : '')
      .replace(/\{parceiro\}/gi, parceiroKey)
      .replace(/\{produto\}/gi, prodKey);

    // Garante que o código de origem fique formatado uma única vez
    if (codigoBusca && !mensagemFinal.includes(`(${codigoBusca})`)) {
      mensagemFinal = `(${codigoBusca}) ${mensagemFinal}`;
    }

    // Remove eventual parêntese duplo acidental
    if (codigoBusca) {
      mensagemFinal = mensagemFinal.replace(new RegExp(`\\(\\(${codigoBusca}\\)\\)`, 'gi'), `(${codigoBusca})`);
    }

    const textParam = `?text=${encodeURIComponent(mensagemFinal)}`;

    // 3. Buscar números ativos da tabela correspondente ao produto
    const { data: numeros, error } = await supabase
      .from(tabelaAlvo)
      .select('id, numero')
      .neq('ativo', false);

    if (error || !numeros || numeros.length === 0) {
      console.log(`[ROTA PARCEIRO FALLBACK] Tabela ${tabelaAlvo} sem números ativos`);
      const fb = await getFallbackNumber(tabelaAlvo);
      return res.redirect(302, `https://wa.me/55${fb || '0'}${textParam}`);
    }

    // 4. Executar Round-Robin / Randomizador
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const sorteado = await getNextNumero(tabelaAlvo, numeros, clientIp);
    const limpo = sorteado.numero.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${limpo}${textParam}`;

    console.log(`[ROTA PARCEIRO REDIRECT] [${prodKey}/${parceiroKey}/${origemKey}] → ${sorteado.numero}`);

    // Log assíncrono (tabela genérica de redirect ou do produto)
    if (!req.query.test) {
      supabase
        .from('redirect_log')
        .insert({
          numero: sorteado.numero,
          ip: clientIp,
        })
        .then(() => {})
        .catch(() => {});
    }

    return res.redirect(302, whatsappUrl);
  } catch (err) {
    console.error('[ROTA PARCEIRO REDIRECT ERROR]', err);
    return res.redirect(302, `https://wa.me/550?text=${encodeURIComponent('Olá!')}`);
  }
};
