const { supabase } = require('./supabase');

/**
 * Round-robin: retorna o próximo número da lista em ordem sequencial.
 * Usa a tabela `round_robin` no Supabase para manter o contador persistente.
 * Fallback para random se houver qualquer erro.
 */
async function getNextNumero(tabela, numeros) {
  if (!numeros || numeros.length === 0) return null;

  // Ordena sempre igual para manter sequência consistente
  const sorted = [...numeros].sort((a, b) => a.numero.localeCompare(b.numero));

  try {
    // Garante que a linha existe
    await supabase
      .from('round_robin')
      .upsert({ tabela, contador: 0 }, { onConflict: 'tabela', ignoreDuplicates: true });

    // Lê o contador atual
    const { data: row, error: readErr } = await supabase
      .from('round_robin')
      .select('contador')
      .eq('tabela', tabela)
      .single();

    if (readErr) throw readErr;

    const current = row?.contador || 0;
    const index = current % sorted.length;

    // Incrementa o contador
    await supabase
      .from('round_robin')
      .update({ contador: current + 1 })
      .eq('tabela', tabela);

    return sorted[index];
  } catch (err) {
    console.error(`[ROUND-ROBIN ERROR] tabela=${tabela}:`, err.message);
    // Fallback: random se round-robin falhar
    return sorted[Math.floor(Math.random() * sorted.length)];
  }
}

module.exports = { getNextNumero };
