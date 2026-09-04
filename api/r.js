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

    if (origemKey) {
      const { data: rota } = await supabase
        .from('rotas_parceiros')
        .select('*')
        .eq('codigo_origem', origemKey)
        .eq('ativo', true)
        .single();

      if (rota) {
        mensagemTemplate = rota.mensagem_template;
        if (rota.produto && MAPA_PRODUTOS_TABELAS[rota.produto]) {
          tabelaAlvo = MAPA_PRODUTOS_TABELAS[rota.produto];
        }
      }
    }

    // 2. Substituir variáveis no template ({origem}, (origem), {parceiro}, {produto})
    let mensagemFinal = mensagemTemplate
      .replace(/\{origem\}/gi, origemKey)
      .replace(/\(origem\)/gi, origemKey ? `(${origemKey})` : '')
      .replace(/\{parceiro\}/gi, parceiroKey)
      .replace(/\{produto\}/gi, prodKey);

    // Garante que o código de origem fique formatado uma única vez
    if (origemKey && !mensagemFinal.includes(`(${origemKey})`)) {
      mensagemFinal = `(${origemKey}) ${mensagemFinal}`;
    }

    // Remove eventual parêntese duplo acidental
    if (origemKey) {
      mensagemFinal = mensagemFinal.replace(new RegExp(`\\(\\(${origemKey}\\)\\)`, 'gi'), `(${origemKey})`);
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
