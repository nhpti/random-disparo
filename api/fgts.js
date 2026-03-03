const { supabase } = require('../lib/supabase');
const { dispararWebhook } = require('../lib/webhook');

// ══════════════════════════════════════════════════════
// REDIRECT PÚBLICO — substitui o CurtLink
// GET /fgts → pega número aleatório → 302 → wa.me
// ══════════════════════════════════════════════════════

// Número de fallback caso o banco esteja fora ou sem números
// TROCAR pelo número principal de vocês ↓
const FALLBACK_NUMBER = '5548999632212';

// Mensagem pré-preenchida que aparece no WhatsApp
const MENSAGEM = '(b05)Olá Novo Horizonte! Quero sacar meu FGTS e receber agora!';

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
      // Fallback — sem números cadastrados
      console.log(`[FALLBACK] Nenhum número cadastrado, usando fallback`);
      return res.redirect(302, `https://wa.me/${FALLBACK_NUMBER}${textParam}`);
    }

    // Escolher um aleatório
    const sorteado = numeros[Math.floor(Math.random() * numeros.length)];
    const limpo = sorteado.numero.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${limpo}${textParam}`;

    console.log(`[REDIRECT] ${new Date().toISOString()} → ${sorteado.numero} → ${whatsappUrl}`);

    // Registrar no log (async, não bloqueia o redirect)
    // Pular log se for teste (?test=1)
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
      dispararWebhook('redirect.fgts', {
        produto: 'CLT & FGTS',
        numero: sorteado.numero,
        ip: clientIp,
        url: whatsappUrl,
      });
    }

    return res.redirect(302, whatsappUrl);
  } catch (err) {
    console.error('[FGTS ERROR]', err);
    // Em caso de QUALQUER erro, usa o fallback para não perder leads
    return res.redirect(302, `https://wa.me/${FALLBACK_NUMBER}${textParam}`);
  }
};
