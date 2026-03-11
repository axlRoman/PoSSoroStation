import { supabase } from './lib/supabase';

async function checkColumns() {
    const { data, error } = await supabase.from('order_items').select('*').limit(1);
    console.log('Order Items Sample:', data);
    const { data: cat, error: catErr } = await supabase.from('categories').select('*').limit(1);
    console.log('Categories Sample:', cat);
}

checkColumns();
