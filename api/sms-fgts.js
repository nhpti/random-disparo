const { supabase } = require('../lib/supabase');
const { dispararWebhook } = require('../lib/webhook');

// ══════════════════════════════════════════════════════
// REDIRECT PÚBLICO — SMS FGTS (sf1)
// GET /sms-fgts → pega número aleatório → 302 → wa.me
// ══════════════════════════════════════════════════════

// Número de fallback caso o banco esteja fora ou sem números
const FALLBACK_NUMBER = '5548996743343';

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
      .select('numero')
      .neq('ativo', false);

    if (error) throw error;

    if (!numeros || numeros.length === 0) {
      console.log(`[SMS-FGTS FALLBACK] Nenhum número cadastrado, usando fallback`);
      return res.redirect(302, `https://wa.me/${FALLBACK_NUMBER}${textParam}`);
    }

    // Escolher um aleatório
    const sorteado = numeros[Math.floor(Math.random() * numeros.length)];
    const limpo = sorteado.numero.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${limpo}${textParam}`;

    console.log(`[SMS-FGTS REDIRECT] ${new Date().toISOString()} → ${sorteado.numero} → ${whatsappUrl}`);

    // Registrar no log (async, não bloqueia o redirect)
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
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
    return res.redirect(302, `https://wa.me/${FALLBACK_NUMBER}${textParam}`);
  }
};
