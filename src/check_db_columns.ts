import { supabase } from './lib/supabase';

async function checkColumns() {
    const { data } = await supabase.from('order_items').select('*').limit(1);
    console.log('Order Items Sample:', data);
    const { data: cat } = await supabase.from('categories').select('*').limit(1);
    console.log('Categories Sample:', cat);
}

checkColumns();
