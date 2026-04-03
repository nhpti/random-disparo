const { supabase } = require('../lib/supabase');
const { dispararWebhook } = require('../lib/webhook');
const { getFallbackNumber } = require('../lib/fallback');
const { getNextNumero } = require('../lib/round-robin');

// ══════════════════════════════════════════════════════
// REDIRECT PÚBLICO — SMS FGTS (sf1)
// GET /sms-fgts → pega número aleatório → 302 → wa.me
// ══════════════════════════════════════════════════════

const TABELA_NUMEROS = 'numeros';

// Mensagem pré-preenchida que aparece no WhatsApp (código sf1)
const MENSAGEM = '(sf1) Olá Novo Horizonte! Quero sacar meu FGTS e receber agora!';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const textParam = `?text=${encodeURIComponent(MENSAGEM)}`;

  try {
    // Buscar todos os números ativos
    const { data: numeros, error } = await supabase
      .from('numeros')
      .select('id, numero')
      .neq('ativo', false);

    if (error) throw error;

    if (!numeros || numeros.length === 0) {
      console.log(`[SMS-FGTS FALLBACK] Nenhum número cadastrado, buscando fallback ativo`);
      const fb = await getFallbackNumber(TABELA_NUMEROS);
      return res.redirect(302, `https://wa.me/55${fb || '0'}${textParam}`);
    }

    // Round-robin: próximo número em ordem sequencial
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const sorteado = await getNextNumero(TABELA_NUMEROS, numeros, clientIp);
    const limpo = sorteado.numero.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${limpo}${textParam}`;

    console.log(`[SMS-FGTS REDIRECT] ${new Date().toISOString()} → ${sorteado.numero} → ${whatsappUrl}`);

    // Registrar no log (async, não bloqueia o redirect)
    if (!req.query.test) {
      supabase
        .from('redirect_log')
        .insert({
          numero: sorteado.numero,
          ip: clientIp,
        })
        .then(() => {})
        .catch(() => {});

      // Disparar webhook para n8n
      dispararWebhook('redirect.sms-fgts', {
        produto: 'SMS FGTS',
        codigo: 'sf1',
        numero: sorteado.numero,
        ip: clientIp,
        url: whatsappUrl,
      });
    }

    return res.redirect(302, whatsappUrl);
  } catch (err) {
    console.error('[SMS-FGTS ERROR]', err);
    const fb = await getFallbackNumber(TABELA_NUMEROS);
    return res.redirect(302, `https://wa.me/55${fb || '0'}${textParam}`);
  }
};
