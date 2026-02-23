const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('⚠ SUPABASE_URL e SUPABASE_SERVICE_KEY devem estar configurados nas variáveis de ambiente.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };
