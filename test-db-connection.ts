import { createClient } from '@supabase/supabase-js';

// Supabase credentials from your Supabase dashboard
const SUPABASE_URL = 'https://btflwhesaundzdnpjcdi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_AeBVpLSSyKODlRuc1yhiog_XLYdkUC5';

async function testConnection() {
  try {
    console.log('🔌 Testing Supabase connection...');
    console.log(`URL: ${SUPABASE_URL}`);
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Test connection by querying a simple table
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Connection successful!');
    console.log('Database is accessible');
    return true;
    
  } catch (error: any) {
    console.error('❌ Error testing connection:', error.message);
    return false;
  }
}

testConnection();
