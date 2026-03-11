import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: 'C:/Users/MossesDev/Documents/PoS Soro Station/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrders() {
    console.log('Checking orders table...');
    const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching orders:', error.message);
    } else {
        console.log('Last 5 orders:', JSON.stringify(data, null, 2));
    }

    // Try to find if order_number column exists by checking a row
    if (data && data.length > 0) {
        const hasCol = 'order_number' in data[0];
        console.log('Is order_number in response keys?', hasCol);
    } else {
        console.log('No orders found to check column presence');
    }
}

checkOrders();
