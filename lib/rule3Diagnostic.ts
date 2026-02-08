/**
 * Rule 3 Diagnostic - Debug Data Source Issues
 * 
 * This file helps diagnose why data might be coming from wrong source
 * Run this in browser console: import { diagnoseRule3 } from './lib/rule3Diagnostic'
 */

import { connectivityService } from './connectivityService';
import { fetchFromSupabase } from './supabaseClient';
import apiClient from './apiClient';

interface Rule3Diagnosis {
  timestamp: string;
  connectivity: {
    isOnline: boolean;
    shouldUseSupabase: boolean;
    supabaseConfigured: boolean;
  };
  supabaseTest: {
    url: string;
    keyConfigured: boolean;
    canConnect: boolean;
    error?: string;
  };
  localApiTest: {
    canConnect: boolean;
    error?: string;
  };
  dataFetchTest: {
    table: string;
    source: 'supabase' | 'local' | 'failed';
    recordCount: number;
    error?: string;
  };
}

export async function diagnoseRule3(): Promise<Rule3Diagnosis> {
  console.log('🔍 Starting Rule 3 Diagnosis...\n');

  const diagnosis: Rule3Diagnosis = {
    timestamp: new Date().toISOString(),
    connectivity: {
      isOnline: connectivityService.isConnected(),
      shouldUseSupabase: connectivityService.shouldUseSupabase(),
      supabaseConfigured: !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY),
    },
    supabaseTest: {
      url: import.meta.env.VITE_SUPABASE_URL || '(not set)',
      keyConfigured: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
      canConnect: false,
    },
    localApiTest: {
      canConnect: false,
    },
    dataFetchTest: {
      table: 'products',
      source: 'failed',
      recordCount: 0,
    },
  };

  // Test 1: Connectivity Status
  console.log('📡 CONNECTIVITY STATUS:');
  console.log(`  IsOnline: ${diagnosis.connectivity.isOnline ? '🟢' : '🔴'}`);
  console.log(`  Should Use Supabase: ${diagnosis.connectivity.shouldUseSupabase ? '✅' : '❌'}`);
  console.log(`  Supabase Configured: ${diagnosis.connectivity.supabaseConfigured ? '✅' : '❌'}`);
  console.log();

  // Test 2: Supabase Connection
  console.log('☁️  SUPABASE CONNECTION TEST:');
  console.log(`  URL: ${diagnosis.supabaseTest.url}`);
  console.log(`  Key Configured: ${diagnosis.supabaseTest.keyConfigured ? '✅' : '❌'}`);
  
  if (diagnosis.connectivity.supabaseConfigured) {
    try {
      const response = await fetch(import.meta.env.VITE_SUPABASE_URL, {
        method: 'HEAD',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });
      diagnosis.supabaseTest.canConnect = response.ok;
      console.log(`  Connection: ${response.ok ? '✅ Connected' : '❌ Failed'} (Status: ${response.status})`);
    } catch (error) {
      diagnosis.supabaseTest.error = String(error);
      console.log(`  Connection: ❌ ${error}`);
    }
  }
  console.log();

  // Test 3: Local API Connection
  console.log('💾 LOCAL API CONNECTION TEST:');
  try {
    const response = await apiClient.getProducts();
    diagnosis.localApiTest.canConnect = true;
    console.log(`  Connection: ✅ Connected`);
  } catch (error) {
    diagnosis.localApiTest.error = String(error);
    diagnosis.localApiTest.canConnect = false;
    console.log(`  Connection: ❌ ${error}`);
  }
  console.log();

  // Test 4: Actual Data Fetch
  console.log('📊 DATA FETCH TEST (products table):');
  console.log(`  Expected Source: ${diagnosis.connectivity.shouldUseSupabase ? 'Supabase' : 'Local API'}`);
  
  if (diagnosis.connectivity.shouldUseSupabase) {
    try {
      const data = await fetchFromSupabase('products');
      diagnosis.dataFetchTest.source = 'supabase';
      diagnosis.dataFetchTest.recordCount = Array.isArray(data) ? data.length : 0;
      console.log(`  ✅ Supabase fetch successful: ${diagnosis.dataFetchTest.recordCount} records`);
    } catch (error) {
      diagnosis.dataFetchTest.source = 'failed';
      diagnosis.dataFetchTest.error = String(error);
      console.log(`  ❌ Supabase fetch failed: ${error}`);
    }
  } else {
    try {
      const response = await apiClient.getProducts();
      diagnosis.dataFetchTest.source = 'local';
      diagnosis.dataFetchTest.recordCount = Array.isArray(response.data) ? response.data.length : 0;
      console.log(`  ✅ Local API fetch successful: ${diagnosis.dataFetchTest.recordCount} records`);
    } catch (error) {
      diagnosis.dataFetchTest.source = 'failed';
      diagnosis.dataFetchTest.error = String(error);
      console.log(`  ❌ Local API fetch failed: ${error}`);
    }
  }
  console.log();

  // Summary
  console.log('📋 DIAGNOSIS SUMMARY:');
  console.log(JSON.stringify(diagnosis, null, 2));
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  if (!diagnosis.connectivity.shouldUseSupabase && diagnosis.connectivity.isOnline) {
    console.log('⚠️  ISSUE: System thinks it\'s offline but isOnline is true!');
    console.log('    → Check Supabase configuration');
    console.log('    → Verify Supabase URL and API key are correct');
  }
  
  if (diagnosis.dataFetchTest.source === 'failed') {
    console.log('⚠️  ISSUE: Data fetch failed!');
    console.log('    → Check network connection');
    console.log('    → Verify database contains data');
    console.log('    → Check RLS policies in Supabase');
  }
  
  if (diagnosis.dataFetchTest.recordCount === 0 && diagnosis.dataFetchTest.source !== 'failed') {
    console.log('⚠️  WARNING: Data source connected but returned 0 records');
    console.log('    → This is normal if no data has been added yet');
  }

  return diagnosis;
}

export default {
  diagnoseRule3,
};
