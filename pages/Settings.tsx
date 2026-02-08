
import React, { useState, useEffect } from 'react';
import { Save, Globe, Check, Palette, Type, Database, Download, Upload, Search, Calendar, X, Cloud, LogIn } from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { saveBackupFileOnlineOnly, saveAuditLogToSupabase } from '../lib/supabaseOperations';

const Settings: React.FC = () => {
  const { currencySymbol, themeColor, fontFamily, pharmacyName, updateSettings, user } = usePharmacy();
  const [curr, setCurr] = useState(currencySymbol);
  const [color, setColor] = useState(themeColor);
  const [font, setFont] = useState(fontFamily);
  const [name, setName] = useState(pharmacyName);
  const [saved, setSaved] = useState(false);
  const [isGeneratingBackup, setIsGeneratingBackup] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const [backups, setBackups] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All Backups');
  const [filterDate, setFilterDate] = useState('');
  const [selectedBackup, setSelectedBackup] = useState<any>(null);
  const [googleDriveConfigured, setGoogleDriveConfigured] = useState(false);
  const [googleDriveAuthenticated, setGoogleDriveAuthenticated] = useState(false);
  const [googleAuthUrl, setGoogleAuthUrl] = useState('');
  const [checkingGoogleStatus, setCheckingGoogleStatus] = useState(false);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  
  const isDarkTheme = themeColor === 'black';

  // Sync state with context if it changes externally
  useEffect(() => {
    setName(pharmacyName);
    setCurr(currencySymbol);
    setColor(themeColor);
    setFont(fontFamily);
  }, [pharmacyName, currencySymbol, themeColor, fontFamily]);

  // Fetch backups on component mount
  useEffect(() => {
    const fetchBackups = async () => {
      try {
        const response = await fetch('/api/backup/list.php');
        if (response.ok) {
          const data = await response.json();
          setBackups(data);
        }
      } catch (error) {
        console.error('Failed to fetch backups:', error);
      }
    };
    fetchBackups();

    // Listen for background backup completion
    const handleBackupCreated = () => {
      console.log('Backup created event received, refreshing list...');
      fetchBackups();
    };
    
    window.addEventListener('backupCreated', handleBackupCreated);
    
    return () => {
        window.removeEventListener('backupCreated', handleBackupCreated);
    };
  }, []);

  // Check Google Drive status on component mount
  useEffect(() => {
    const checkGoogleDriveStatus = async () => {
      setCheckingGoogleStatus(true);
      try {
        const response = await fetch('/api/backup/google-auth-status.php');
        if (response.ok) {
          const data = await response.json();
          setGoogleDriveConfigured(data.configured);
          setGoogleDriveAuthenticated(data.authenticated);
          if (data.authUrl) {
            setGoogleAuthUrl(data.authUrl);
          }
        }
      } catch (error) {
        console.error('Failed to check Google Drive status:', error);
      } finally {
        setCheckingGoogleStatus(false);
      }
    };
    
    checkGoogleDriveStatus();
    
    // Listen for storage changes (when another tab/window updates settings)
    window.addEventListener('storage', checkGoogleDriveStatus);
    
    // Periodically check for auth status changes (useful if returning from auth popup)
    const interval = setInterval(checkGoogleDriveStatus, 3000);
    
    return () => {
      window.removeEventListener('storage', checkGoogleDriveStatus);
      clearInterval(interval);
    };
  }, []);

  const handleDisconnectGoogle = async () => {
    setDisconnectingGoogle(true);
    try {
      const response = await fetch('/api/backup/google-disconnect.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        setBackupMessage('✅ ' + data.message);
        setGoogleDriveAuthenticated(false);
        
        // Refetch the auth status to get the new auth URL
        const statusResponse = await fetch('/api/backup/google-auth-status.php');
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          if (statusData.authUrl) {
            setGoogleAuthUrl(statusData.authUrl);
          }
        }
        
        setShowDisconnectConfirm(false);
        setTimeout(() => setBackupMessage(''), 3000);
      } else {
        const data = await response.json();
        setBackupMessage('❌ ' + (data.message || 'Failed to disconnect'));
      }
    } catch (error) {
      setBackupMessage('❌ Error disconnecting: ' + (error instanceof Error ? error.message : 'Unknown error'));
      console.error(error);
    } finally {
      setDisconnectingGoogle(false);
    }
  };

  const handleSave = async () => {
    // Update local settings
    updateSettings({ 
      currencySymbol: curr,
      themeColor: color,
      fontFamily: font,
      pharmacyName: name
    });
    
    // Save to database for email use
    try {
      const response = await fetch('/api/config/settings.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme_color: color,
          font_family: font,
          currency_symbol: curr,
          pharmacy_name: name
        })
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        console.error('Failed to save settings to database');
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleGenerateBackup = async () => {
    setIsGeneratingBackup(true);
    setBackupMessage('');
    try {
      const userId = user?.UserID || user?.id;
      const response = await fetch('/api/backup/create.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      
      if (response.ok) {
        // Parse JSON response (now contains SQL data + audit data)
        const data = await response.json();
        
        console.log('📦 Backup created:', data);
        
        if (data.success) {
          // Decode base64 SQL data
          const sqlData = atob(data.sqlData);
          const blob = new Blob([sqlData], { type: 'application/octet-stream' });
          const backupFileName = data.backupId + '.sql';
          
          console.log('Backup file size:', data.fileSize, 'bytes');
          console.log('Google Drive status:', data.googleDriveStatus);
          
          // Rule 1 & 2: Handle audit data
          // If online: auditData.shouldSync === true and location === 'supabase_only'
          // If offline: auditData.shouldSync === false and location === 'local_only'
          if (data.auditData) {
            console.log('📝 Audit data received:', data.auditData);
            
            // Rule 1: ONLINE - Save audit data ONLY to Supabase
            if (data.auditData.shouldSync && data.auditData.location === 'supabase_only') {
              try {
                const auditSaved = await saveAuditLogToSupabase(data.auditData.data);
                console.log('✅ Audit log saved to Supabase:', auditSaved);
              } catch (error) {
                console.error('❌ Failed to save audit to Supabase:', error);
              }
            }
            // Rule 2: OFFLINE - Audit already saved to local MySQL by backend
            else if (!data.auditData.shouldSync && data.auditData.location === 'local_only') {
              console.log('✅ Audit log already saved to local XAMPP (offline mode)');
            }
          }
          
          // Use exclusive Supabase save: When online save ONLY to Supabase, when offline save to local
          const saveResult = await saveBackupFileOnlineOnly(blob, backupFileName, 'Manual');
          console.log('Backup save result:', saveResult);
          
          if (saveResult.location === 'supabase') {
            // Online: File saved ONLY to Supabase
            setBackupMessage(`✅ Backup saved ONLY to Supabase (online mode). Location: ${saveResult.location}`);
            
            // Download the file for user convenience (they already have it in Supabase)
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = backupFileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            console.log('📥 Backup file also downloaded to browser for user convenience');
          } else {
            // Offline: File will be saved to local XAMPP as fallback
            setBackupMessage(`✅ System is offline - Backup queued for Supabase. Fallback: Local storage will be used.`);
          }
          
          // Refresh backup list
          const listResponse = await fetch('/api/backup/list.php');
          if (listResponse.ok) {
            const data = await listResponse.json();
            setBackups(data);
          }
          
          setTimeout(() => setBackupMessage(''), 5000);
        } else {
          setBackupMessage(data.message || 'Failed to create backup');
        }
      } else {
        // For error responses, try to parse JSON, but handle failures
        try {
          const errorData = await response.json();
          setBackupMessage(errorData.message || 'Failed to create backup');
        } catch {
          setBackupMessage(`Failed to create backup (Status: ${response.status})`);
        }
      }
    } catch (error) {
      setBackupMessage('Error creating backup: ' + (error instanceof Error ? error.message : 'Unknown error'));
      console.error(error);
    } finally {
      setIsGeneratingBackup(false);
    }
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsGeneratingBackup(true);
    setBackupMessage('');
    
    const formData = new FormData();
    formData.append('backup', file);

    try {
      setBackupMessage('⏳ Importing database from file: ' + file.name + '...');
      
      const userId = user?.UserID || user?.id;
      const response = await fetch(`/api/backup/import.php?userId=${userId}`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setBackupMessage(`✅ ${data.message}`);
        
        // Refresh backup list
        const listResponse = await fetch('/api/backup/list.php');
        if (listResponse.ok) {
          const backupList = await listResponse.json();
          setBackups(backupList);
        }
        
        // Trigger audit logs refresh
        window.dispatchEvent(new Event('backupImported'));
        window.dispatchEvent(new Event('auditLogsUpdated'));
        
        setTimeout(() => setBackupMessage(''), 5000);
      } else {
        setBackupMessage('❌ ' + (data.message || 'Failed to import backup'));
      }
    } catch (error) {
      setBackupMessage('❌ Error importing database: ' + (error instanceof Error ? error.message : 'Unknown error'));
      console.error(error);
    } finally {
      setIsGeneratingBackup(false);
      // Reset the file input
      event.target.value = '';
    }
  };

  const downloadBackup = async (backupId: string) => {
    try {
      const userId = user?.UserID || user?.id;
      const response = await fetch(`/api/backup/download.php?backupId=${encodeURIComponent(backupId)}&action=download&userId=${userId}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${backupId}.sql`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        setBackupMessage('Failed to download backup');
      }
    } catch (error) {
      setBackupMessage('Error downloading backup');
      console.error(error);
    }
  };

  const restoreBackup = async (backupId: string) => {
    setIsGeneratingBackup(true);
    setBackupMessage('');
    
    try {
      const userId = user?.UserID || user?.id;
      const response = await fetch(`/api/backup/download.php?backupId=${encodeURIComponent(backupId)}&action=restore&userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        setBackupMessage('✅ ' + data.message);
        setTimeout(() => setBackupMessage(''), 3000);
      } else {
        const errorData = await response.json();
        setBackupMessage(errorData.message || 'Failed to restore backup');
      }
    } catch (error) {
      setBackupMessage('Error restoring backup');
      console.error(error);
    } finally {
      setIsGeneratingBackup(false);
    }
  };

  const filteredBackups = backups.filter((backup) => {
    const matchesSearch = backup.id?.toString().includes(searchQuery);
    
    let matchesType = true;
    if (filterType === 'Recent') {
      const backupDate = new Date(backup.backupDate);
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      matchesType = backupDate >= sevenDaysAgo;
    } else if (filterType === 'This Month') {
      const backupDate = new Date(backup.backupDate);
      const now = new Date();
      matchesType = backupDate.getMonth() === now.getMonth() && backupDate.getFullYear() === now.getFullYear();
    } else if (filterType === 'Manual') {
      matchesType = backup.backupType === 'Manual';
    } else if (filterType === 'Automatic') {
      matchesType = backup.backupType === 'Automatic';
    }
    
    const matchesDate = !filterDate || backup.backupDate?.includes(filterDate);
    return matchesSearch && matchesType && matchesDate;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setFilterType('All Backups');
    setFilterDate('');
  };

  return (
    <div className={`space-y-6 max-w-4xl mx-auto ${font}`}>
      <div className="md:hidden">
        <h2 className={`text-2xl font-extrabold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>System Settings</h2>
        <p className="text-slate-500 font-medium">Manage system backups and configurations</p>
      </div>

      <div className={`bg-white rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden ${isDarkTheme ? 'bg-gray-800' : ''}`}>
        {/* General Info */}
        <div className={`p-6 border-b ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'border-gray-100'}`}>
            <h3 className={`font-bold text-lg ${isDarkTheme ? 'text-white' : 'text-slate-800'} flex items-center gap-2`}>
                <Globe size={20} className={isDarkTheme ? 'text-white' : 'text-[var(--color-text)]'} /> General Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="space-y-2">
                    <label className={`text-sm font-bold ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Pharmacy Name</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none font-medium ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} 
                    />
                </div>
                <div className="space-y-2">
                    <label className={`text-sm font-bold ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Currency Symbol</label>
                    <select 
                      value={curr}
                      onChange={(e) => setCurr(e.target.value)}
                      className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none font-medium ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    >
                        <option value="$">$ - USD</option>
                        <option value="€">€ - EUR</option>
                        <option value="₱">₱ - PHP</option>
                        <option value="£">£ - GBP</option>
                    </select>
                </div>
            </div>
        </div>

        {/* Appearance Settings */}
        <div className={`p-6 border-b ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'border-gray-100'}`}>
            <h3 className={`font-bold text-lg ${isDarkTheme ? 'text-white' : 'text-slate-800'} flex items-center gap-2`}>
                <Palette size={20} className={isDarkTheme ? 'text-white' : 'text-[var(--color-text)]'} /> Appearance & Theme
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="space-y-2">
                    <label className={`text-sm font-bold ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Theme Color</label>
                    <div className="grid grid-cols-6 gap-0">
                        {['amber', 'teal', 'blue', 'rose', 'emerald', 'black'].map((c) => (
                            <button
                                key={c}
                                onClick={() => setColor(c)}
                                className={`h-10 w-10 rounded-full border-2 flex items-center justify-center transition-all ${
                                  color === c 
                                    ? isDarkTheme && c === 'black'
                                      ? 'border-white scale-110 shadow-md'
                                      : 'border-slate-800 scale-110 shadow-md'
                                    : isDarkTheme && c === 'black'
                                    ? 'border-white border-opacity-30'
                                    : 'border-transparent'
                                }`}
                                style={{ backgroundColor: `var(--color-${c}-400, ${c === 'amber' ? '#FED053' : c === 'teal' ? '#2dd4bf' : c === 'blue' ? '#60a5fa' : c === 'rose' ? '#fb7185' : c === 'emerald' ? '#34d399' : '#1f2937'})` }}
                            >
                                {color === c && <Check size={16} className={c === 'black' ? 'text-white' : 'text-slate-900'} />}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="space-y-2">
                    <label className={`text-sm font-bold ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'} flex items-center gap-2`}><Type size={16}/> Font Family</label>
                    <select 
                      value={font}
                      onChange={(e) => setFont(e.target.value)}
                      className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none font-medium ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    >
                        <option value="font-sans">Inter</option>
                        <option value="font-serif">Merriweather</option>
                        <option value="font-mono">Monospace</option>
                        <option value="font-poppins">Poppins</option>
                        <option value="font-nunito">Nunito</option>
                    </select>
                </div>
            </div>
        </div>

        {/* Save Button */}
        <div className={`p-6 flex justify-end border-b ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-100'}`}>
            <button 
              onClick={handleSave}
              className={`${isDarkTheme ? 'bg-gray-900 hover:bg-gray-950' : 'bg-slate-900 hover:bg-slate-800'} text-white font-bold px-6 py-2.5 rounded-lg shadow-md transition-all flex items-center gap-2`}
            >
                {saved ? <Check size={20} /> : <Save size={20} />}
                {saved ? 'Changes Saved' : 'Save Changes'}
            </button>
        </div>

        {/* Backup & Recovery */}
        <div className={`p-6 border-b ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'border-gray-100'}`}>
            <h3 className={`font-bold text-lg ${isDarkTheme ? 'text-white' : 'text-slate-800'} flex items-center gap-2`}>
                <Database size={20} className={isDarkTheme ? 'text-white' : 'text-[var(--color-text)]'} /> Backup & Recovery
            </h3>
            <p className={`text-sm ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'} mt-2 mb-4`}>Manage system backups and data recovery</p>
            
            {/* Google Drive Authentication Status */}
            {googleDriveConfigured && (
              <div className={`mb-4 p-4 rounded-lg border flex items-center justify-between ${googleDriveAuthenticated ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-center gap-3">
                  <Cloud size={18} className={googleDriveAuthenticated ? 'text-green-600' : 'text-amber-600'} />
                  <div>
                    <p className={`font-semibold text-sm ${googleDriveAuthenticated ? 'text-green-700' : 'text-amber-700'}`}>
                      Google Drive {googleDriveAuthenticated ? 'Connected' : 'Not Connected'}
                    </p>
                    <p className={`text-xs ${googleDriveAuthenticated ? 'text-green-600' : 'text-amber-600'}`}>
                      {googleDriveAuthenticated ? 'Backups will be automatically uploaded to Google Drive' : 'Authenticate to enable automatic Google Drive backups'}
                    </p>
                  </div>
                </div>
                {!googleDriveAuthenticated && googleAuthUrl && (
                  <a
                    href={googleAuthUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap"
                  >
                    <LogIn size={16} />
                    Connect to Google
                  </a>
                )}
                {googleDriveAuthenticated && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-green-600 font-semibold text-sm">
                      <Check size={18} />
                      Connected
                    </div>
                    <button
                      onClick={() => setShowDisconnectConfirm(true)}
                      disabled={disconnectingGoogle}
                      className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-semibold rounded-lg transition-all disabled:opacity-50"
                    >
                      {disconnectingGoogle ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <button
                  onClick={handleGenerateBackup}
                  disabled={isGeneratingBackup}
                  className="flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold px-6 py-3 rounded-lg border border-blue-200 transition-all disabled:opacity-50"
                >
                    <Download size={18} />
                    {isGeneratingBackup ? 'Creating...' : 'Generate Backup'}
                </button>
                <label className="w-full">
                  <input
                    type="file"
                    accept=".sql,.zip"
                    onChange={handleImportBackup}
                    disabled={isGeneratingBackup}
                    className="hidden"
                  />
                  <div className="w-full flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold px-6 py-3 rounded-lg border border-amber-200 transition-all cursor-pointer">
                    <Upload size={18} />
                    {isGeneratingBackup ? 'Importing...' : 'Import Backup'}
                  </div>
                </label>
            </div>

            {backupMessage && (
              <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${backupMessage.includes('success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {backupMessage}
              </div>
            )}

            {/* Search and Filter */}
            <div className="mb-4">
              <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search backups..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] outline-none ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300 bg-white text-gray-900'}`}
                  />
                </div>
                <div className="flex flex-col sm:flex-row lg:flex-row gap-2 items-stretch sm:items-center lg:items-center">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] outline-none font-semibold text-sm ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-700'}`}
                  >
                    <option>All Backups</option>
                    <option>Recent</option>
                    <option>This Month</option>
                    <option>Manual</option>
                    <option>Automatic</option>
                  </select>
                  <div className="relative">
                    <Calendar size={18} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] outline-none text-sm ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300 bg-white text-gray-900'}`}
                    />
                  </div>
                  <button 
                    onClick={clearFilters} 
                    title="Clear all filters"
                    className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${isDarkTheme ? 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600' : 'text-[var(--color-text)] bg-white border border-[var(--color-border)] hover:bg-[var(--color-light)] hover:shadow-sm'}`}
                  >
                    <X size={16} />
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Backup Table */}
            <div className={`border rounded-lg flex flex-col ${isDarkTheme ? 'border-gray-700 bg-gray-800' : 'border-gray-200'}`}>
              <table className="w-full text-sm">
                <thead className={`sticky top-0 border-b ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                  <tr>
                    <th className={`px-6 py-3 text-left font-bold ${isDarkTheme ? 'text-gray-200' : 'text-gray-700'}`}>Backup ID</th>
                    <th className={`px-6 py-3 text-left font-bold ${isDarkTheme ? 'text-gray-200' : 'text-gray-700'}`}>Backup Date</th>
                    <th className={`hidden md:table-cell px-6 py-3 text-left font-bold ${isDarkTheme ? 'text-gray-200' : 'text-gray-700'}`}>File Size</th>
                    <th className={`px-6 py-3 text-left font-bold ${isDarkTheme ? 'text-gray-200' : 'text-gray-700'}`}>Type</th>
                  </tr>
                </thead>
              </table>
              <div className={`overflow-y-auto max-h-96 ${isDarkTheme ? 'bg-gray-800' : ''}`}>
                <table className="w-full text-sm">
                  <tbody>
                  {filteredBackups.length > 0 ? (
                    filteredBackups.map((backup) => (
                      <tr key={backup.id} className={`border-b ${isDarkTheme ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-100 hover:bg-gray-50'} md:cursor-default cursor-pointer transition-colors`} onClick={() => {
                        const isMobile = window.innerWidth < 768;
                        if (isMobile) {
                          setSelectedBackup(backup);
                        }
                      }}>
                        <td className={`px-6 py-4 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                          <span className="inline-flex items-center gap-2 font-mono text-xs">
                            📁 {backup.id?.substring(17, 33)}
                          </span>
                        </td>
                        <td className={`px-6 py-4 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                          {backup.backupDate ? new Date(backup.backupDate).toLocaleString('en-PH', { 
                            year: 'numeric', 
                            month: '2-digit', 
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                          }) : 'N/A'}
                        </td>
                        <td className={`hidden md:table-cell px-6 py-4 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>{backup.fileSizeFormatted || 'N/A'}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                            backup.backupType === 'Automatic' 
                              ? isDarkTheme ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-700' 
                              : isDarkTheme ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {backup.backupType || 'Manual'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className={`px-6 py-8 text-center ${isDarkTheme ? 'text-gray-500' : 'text-gray-500'}`}>
                        No backups found
                      </td>
                    </tr>
                  )}
                </tbody>
                </table>
              </div>
            </div>
        </div>
      </div>

      {/* Backup Details Modal */}
      {selectedBackup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Backup Details</h3>
              <button
                onClick={() => setSelectedBackup(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase">Backup ID</label>
                <p className="text-sm text-gray-700 font-mono mt-1">{selectedBackup.id}</p>
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase">Backup Date</label>
                <p className="text-sm text-gray-700 mt-1">
                  {selectedBackup.backupDate ? new Date(selectedBackup.backupDate).toLocaleString('en-PH', { 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                  }) : 'N/A'}
                </p>
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase">File Size</label>
                <p className="text-sm text-gray-700 mt-1">{selectedBackup.fileSizeFormatted || 'N/A'}</p>
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase">Backup Type</label>
                <p className="mt-1">
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                    {selectedBackup.backupType || 'Local'}
                  </span>
                </p>
              </div>
            </div>
            
            <div className="p-6 bg-gray-50 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => downloadBackup(selectedBackup.id)}
                className="flex-1 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 font-semibold rounded-lg transition-all"
              >
                ⬇️ Download
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to restore this backup? This will replace all current data.')) {
                    restoreBackup(selectedBackup.id);
                    setSelectedBackup(null);
                  }
                }}
                className="flex-1 px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 font-semibold rounded-lg transition-all"
              >
                ↩️ Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Google Drive Confirmation Modal */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-slate-800">Disconnect Google Drive?</h3>
            </div>
            
            <div className="p-6">
              <p className="text-gray-700 text-sm leading-relaxed">
                Are you sure you want to disconnect from Google Drive? Future backups will no longer be uploaded to Google Drive.
              </p>
            </div>
            
            <div className="p-6 bg-gray-50 border-t border-gray-200 flex gap-3 rounded-b-lg">
              <button
                onClick={() => setShowDisconnectConfirm(false)}
                disabled={disconnectingGoogle}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnectGoogle}
                disabled={disconnectingGoogle}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
              >
                {disconnectingGoogle ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
