const { supabase } = require('./supabase');

/**
 * Round-robin: retorna o próximo número da lista em ordem sequencial.
 * Usa RPC atômico no Supabase para evitar race conditions.
 * Fallback para random se houver qualquer erro.
 */
async function getNextNumero(tabela, numeros) {
  if (!numeros || numeros.length === 0) return null;

  // Ordena por id (mesma ordem do painel)
  const sorted = [...numeros].sort((a, b) => a.id - b.id);

  try {
    // RPC atômico: incrementa e retorna o valor anterior numa única operação
    const { data, error } = await supabase.rpc('increment_round_robin', {
      p_tabela: tabela,
    });

    if (error) throw error;

    const counter = data ?? 0;
    const index = counter % sorted.length;

    return sorted[index];
  } catch (err) {
    console.error(`[ROUND-ROBIN ERROR] tabela=${tabela}:`, err.message);
    // Fallback: random se round-robin falhar
    return sorted[Math.floor(Math.random() * sorted.length)];
  }
}

module.exports = { getNextNumero };
