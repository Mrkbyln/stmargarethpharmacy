import React, { useState, useEffect } from 'react';
import { useConnectivity } from '../lib/useConnectivity';
import { connectivityService } from '../lib/connectivityService';
import { Network, Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

const DiagnosticsPage: React.FC = () => {
  const { shouldUseSupabase, isOnline, lastChecked } = useConnectivity();
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    const results: any = {
      timestamp: new Date().toISOString(),
      navigator: {
        onLine: navigator.onLine,
        userAgent: navigator.userAgent,
        language: navigator.language,
      },
      connectivity: connectivityService.getStatus(),
      tests: {},
    };

    // Test 1: Browser online status
    results.tests.browserOnline = navigator.onLine;

    // Test 2: Test local API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch('/api/config/settings.php', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      results.tests.localAPI = {
        status: 'SUCCESS',
        code: response.status,
        ok: response.ok,
      };
    } catch (error: any) {
      results.tests.localAPI = {
        status: 'FAILED',
        error: error.message,
      };
    }

    // Test 3: Test Google favicon
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
        mode: 'no-cors',
      });

      clearTimeout(timeoutId);
      results.tests.googleFavicon = {
        status: 'SUCCESS',
        code: response.status,
      };
    } catch (error: any) {
      results.tests.googleFavicon = {
        status: 'FAILED',
        error: error.message,
      };
    }

    // Test 4: Test GitHub favicon
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch('https://www.github.com/favicon.ico', {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
        mode: 'no-cors',
      });

      clearTimeout(timeoutId);
      results.tests.githubFavicon = {
        status: 'SUCCESS',
        code: response.status,
      };
    } catch (error: any) {
      results.tests.githubFavicon = {
        status: 'FAILED',
        error: error.message,
      };
    }

    // Test 5: Test environment variables
    results.tests.environment = {
      hasSupabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
      hasSupabaseKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
      hasAPIUrl: !!import.meta.env.VITE_API_BASE_URL,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL ? 'SET' : 'MISSING',
      apiUrl: import.meta.env.VITE_API_BASE_URL || 'Using default /api',
    };

    setDiagnostics(results);
    setTestResults(results.tests);
    setLoading(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🔧 System Diagnostics</h1>

      {/* Real-time Connectivity Status */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg mb-6 border-2 border-blue-300">
        <h2 className="text-xl font-bold mb-4 text-blue-900">📡 Real-time Connectivity</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-800">Browser Status</p>
            <div className="flex items-center gap-2 mt-2">
              {navigator.onLine ? (
                <>
                  <Wifi size={24} className="text-green-500" />
                  <span className="text-lg font-bold text-green-700">ONLINE</span>
                </>
              ) : (
                <>
                  <WifiOff size={24} className="text-red-500" />
                  <span className="text-lg font-bold text-red-700">OFFLINE</span>
                </>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-blue-800">Service Status</p>
            <div className="flex items-center gap-2 mt-2">
              {isOnline ? (
                <>
                  <Network size={24} className="text-green-500" />
                  <span className="text-lg font-bold text-green-700">ONLINE</span>
                </>
              ) : (
                <>
                  <AlertCircle size={24} className="text-red-500" />
                  <span className="text-lg font-bold text-red-700">OFFLINE</span>
                </>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-blue-800">Use Supabase?</p>
            <div className="flex items-center gap-2 mt-2">
              {shouldUseSupabase ? (
                <>
                  <CheckCircle2 size={24} className="text-green-500" />
                  <span className="text-lg font-bold text-green-700">YES</span>
                </>
              ) : (
                <>
                  <AlertCircle size={24} className="text-orange-500" />
                  <span className="text-lg font-bold text-orange-700">NO</span>
                </>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-blue-800">Last Check</p>
            <p className="text-sm text-blue-700 mt-2">{new Date(lastChecked).toLocaleTimeString()}</p>
          </div>
        </div>
      </div>

      {/* Test Results */}
      <div className="bg-white p-6 rounded-lg mb-6 border-2 border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">🧪 Connectivity Tests</h2>
          <button
            onClick={runDiagnostics}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            <RefreshCw size={18} />
            {loading ? 'Running...' : 'Run Tests'}
          </button>
        </div>

        {testResults && (
          <div className="space-y-3">
            {/* Browser Online */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="font-semibold">Browser Online Status</span>
              <span className={`px-3 py-1 rounded-full text-white font-bold ${testResults.browserOnline ? 'bg-green-500' : 'bg-red-500'}`}>
                {testResults.browserOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            {/* Local API */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="font-semibold">Local API (/api/config/settings.php)</span>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-white font-bold ${
                  testResults.localAPI.status === 'SUCCESS' ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  {testResults.localAPI.status}
                </span>
                {testResults.localAPI.status === 'SUCCESS' && (
                  <span className="text-xs text-gray-600">{testResults.localAPI.code}</span>
                )}
                {testResults.localAPI.status === 'FAILED' && (
                  <span className="text-xs text-red-600">{testResults.localAPI.error}</span>
                )}
              </div>
            </div>

            {/* Google Favicon */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="font-semibold">Google Favicon (External Test 1)</span>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-white font-bold ${
                  testResults.googleFavicon.status === 'SUCCESS' ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  {testResults.googleFavicon.status}
                </span>
                {testResults.googleFavicon.status === 'FAILED' && (
                  <span className="text-xs text-red-600">{testResults.googleFavicon.error}</span>
                )}
              </div>
            </div>

            {/* GitHub Favicon */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="font-semibold">GitHub Favicon (External Test 2)</span>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-white font-bold ${
                  testResults.githubFavicon.status === 'SUCCESS' ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  {testResults.githubFavicon.status}
                </span>
                {testResults.githubFavicon.status === 'FAILED' && (
                  <span className="text-xs text-red-600">{testResults.githubFavicon.error}</span>
                )}
              </div>
            </div>

            {/* Environment */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="font-semibold">Environment Variables</span>
              <div className="text-xs space-y-1 text-right">
                <p>Supabase URL: {testResults.environment.supabaseUrl}</p>
                <p>API URL: {testResults.environment.apiUrl}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Debug Info */}
      <div className="bg-gray-900 p-6 rounded-lg text-gray-100 font-mono text-xs overflow-auto max-h-96">
        <h3 className="text-white font-bold mb-3">📋 Debug Info (JSON)</h3>
        <pre>{JSON.stringify(diagnostics || connectivityService.getStatus(), null, 2)}</pre>
      </div>

      {/* Troubleshooting Guide */}
      <div className="bg-yellow-50 p-6 rounded-lg mt-6 border-2 border-yellow-300">
        <h3 className="text-lg font-bold text-yellow-900 mb-3">⚠️ Troubleshooting</h3>
        <div className="space-y-2 text-sm text-yellow-800">
          {!navigator.onLine && (
            <p>✗ Browser says you're offline. Check your internet connection.</p>
          )}
          {isOnline === false && (
            <p>✗ Service is showing OFFLINE. All connectivity tests failed. Check your network.</p>
          )}
          {shouldUseSupabase === false && isOnline === true && (
            <p>✗ Service says ONLINE but Supabase is not being used. Supabase client may not be initialized.</p>
          )}
          {testResults?.localAPI?.status === 'FAILED' && (
            <p>✗ Local API test failed. Your backend API may be down or unreachable.</p>
          )}
          {testResults?.googleFavicon?.status === 'FAILED' && testResults?.githubFavicon?.status === 'FAILED' && (
            <p>✗ All external tests failed. You may be behind a corporate firewall blocking external connections.</p>
          )}
          {shouldUseSupabase === true && (
            <p>✓ System is ONLINE and configured to use Supabase.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiagnosticsPage;
