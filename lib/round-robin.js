const { supabase } = require('./supabase');

// Cache em memória para evitar duplo-incremento por requests duplicados
// Chave: "tabela:ip" → valor: { numero, timestamp }
const recentCache = new Map();
const DEDUP_WINDOW = 5000; // 5 segundos

// Limpa cache antigo a cada 30s
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of recentCache) {
    if (now - val.timestamp > DEDUP_WINDOW) recentCache.delete(key);
  }
}, 30000);

/**
 * Round-robin: retorna o próximo número da lista em ordem sequencial.
 * Usa RPC atômico no Supabase para evitar race conditions.
 * Deduplica requests do mesmo IP em janela de 5s.
 * Fallback para random se houver qualquer erro.
 */
async function getNextNumero(tabela, numeros, clientIp) {
  if (!numeros || numeros.length === 0) return null;

  // Ordena por id (mesma ordem do painel)
  const sorted = [...numeros].sort((a, b) => a.id - b.id);

  // Dedup: mesmo IP + mesma tabela em 5s → retorna o mesmo número
  if (clientIp) {
    const cacheKey = `${tabela}:${clientIp}`;
    const cached = recentCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < DEDUP_WINDOW) {
      return cached.resultado;
    }
  }

  try {
    // RPC atômico: incrementa e retorna o valor anterior numa única operação
    const { data, error } = await supabase.rpc('increment_round_robin', {
      p_tabela: tabela,
    });

    if (error) throw error;

    const counter = data ?? 0;
    const index = counter % sorted.length;
    const resultado = sorted[index];

    // Salva no cache de dedup
    if (clientIp) {
      recentCache.set(`${tabela}:${clientIp}`, { resultado, timestamp: Date.now() });
    }

    return resultado;
  } catch (err) {
    console.error(`[ROUND-ROBIN ERROR] tabela=${tabela}:`, err.message);
    // Fallback: random se round-robin falhar
    return sorted[Math.floor(Math.random() * sorted.length)];
  }
}

module.exports = { getNextNumero };
