
import React, { useState, useEffect } from 'react';
import { Shield, User, ShoppingCart, Settings, Package, Trash2, Edit, AlertCircle, Loader, Search, X, Download, RefreshCw } from 'lucide-react';
import apiClient from '../lib/apiClient';
import { usePharmacy } from '../context/PharmacyContext';
import { useConnectivity } from '../lib/useConnectivity';
import { fetchAuditLogs as fetchAuditLogsFromDataFetcher } from '../lib/dataFetcher';

// Theme color mapping - matches Settings.tsx color options
const themeColorClass = {
  'amber': 'bg-amber-400 border-amber-400 text-white',
  'teal': 'bg-teal-400 border-teal-400 text-white',
  'blue': 'bg-blue-400 border-blue-400 text-white',
  'rose': 'bg-rose-400 border-rose-400 text-white',
  'emerald': 'bg-emerald-400 border-emerald-400 text-white'
};

const AuditLogs: React.FC = () => {
  const { getRoleBadgeColor, themeColor } = usePharmacy();
  const { isOnline } = useConnectivity();
  const isDarkTheme = themeColor === 'black';
  const [logs, setLogs] = useState<any[]>([]);
  const [originalLogs, setOriginalLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'Supabase' | 'Local'>('Local');
  
  // Get theme color class for badges
  const badgeThemeClass = themeColorClass[themeColor as keyof typeof themeColorClass] || 'bg-amber-400 border-amber-400 text-white';
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedAction, setSelectedAction] = useState('All Actions');

  // Listen for backup/import events
  useEffect(() => {
    const handleAuditUpdate = () => {
      console.log('Audit logs update event received, refreshing...');
      fetchAuditLogs();
    };
    
    window.addEventListener('auditLogsUpdated', handleAuditUpdate);
    window.addEventListener('backupImported', handleAuditUpdate);
    
    return () => {
      window.removeEventListener('auditLogsUpdated', handleAuditUpdate);
      window.removeEventListener('backupImported', handleAuditUpdate);
    };
  }, []);

  // Fetch all audit logs from API on component mount and when connectivity changes
  useEffect(() => {
    fetchAuditLogs();
  }, [isOnline]);

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Use Rule 3 routing - fetches from Supabase when online, Local when offline
      const logs = await fetchAuditLogsFromDataFetcher();
      
      if (logs && logs.length > 0) {
        // The API might already sort, but we ensure it here.
        const sortedLogs = logs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLogs(sortedLogs);
        setOriginalLogs(sortedLogs);
        // Set data source based on connectivity
        setDataSource(isOnline ? 'Supabase' : 'Local');
        console.log(`📊 Audit logs loaded from ${isOnline ? 'Supabase' : 'Local API'}`);
      } else {
        setLogs([]);
        setOriginalLogs([]);
        setDataSource(isOnline ? 'Supabase' : 'Local');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading audit logs');
      console.error('Audit logs fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = (action: string) => {
    if (!action) return <Package size={20} />;
    const actionStr = String(action).toLowerCase();
    if (actionStr.includes('login') || actionStr.includes('user') || actionStr.includes('add')) return <User size={20} />;
    if (actionStr.includes('sale') || actionStr.includes('transaction')) return <ShoppingCart size={20} />;
    if (actionStr.includes('settings') || actionStr.includes('generate')) return <Settings size={20} />;
    if (actionStr.includes('delete') || actionStr.includes('remove')) return <Trash2 size={20} />;
    if (actionStr.includes('update') || actionStr.includes('adjustment')) return <Edit size={20} />;
    if (actionStr.includes('backup')) return <Shield size={20} />;
    if (actionStr.includes('export')) return <Download size={20} />;
    return <Package size={20} />;
  };

  const extractChanges = (action: string | undefined) => {
    // Extract changes from action string like "User updated: ID 20 with changes: Username = john, Role = Admin"
    if (!action) return '';
    const match = action.match(/with changes: (.*)/);
    if (match && match[1]) {
      const changes = match[1].trim();
      // Format: "Username = john, Role = Admin" -> "username updated to: john\nrole updated to: Admin"
      return changes
        .split(', ')
        .filter(change => change.trim() && change.includes('=')) // Only include changes with = sign
        .map(change => {
          const [key, value] = change.split(' = ');
          if (key && value && value.trim()) {
            return `${key.trim().toLowerCase()} updated to: ${value.trim()}`;
          }
          return null;
        })
        .filter(Boolean) // Remove null values
        .join('\n');
    }
    // If no changes pattern found, return the original action
    return action;
  };

  // Combined client-side filtering logic
  useEffect(() => {
    let filtered = originalLogs;

    // Filter by search term
    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        filtered = filtered.filter(log => {
          const action = (log.ActionPerformed || log.action || '').toLowerCase();
          const details = (log.details || '').toLowerCase();
          const user = (log.UserName || log.user || '').toLowerCase();
          const role = (log.Role || log.role || '').toLowerCase();

          return action.includes(lowercasedTerm) ||
                 details.includes(lowercasedTerm) ||
                 user.includes(lowercasedTerm) ||
                 role.includes(lowercasedTerm);
        });
    }
    
    // Filter by selected action
    if (selectedAction !== 'All Actions') {
      filtered = filtered.filter(log => {
        const action = (log.action || log.ActionPerformed || '').toLowerCase();
        const filter = selectedAction.toLowerCase();
        if (filter === 'transaction') return action.includes('sale');
        if (filter === 'remove') return action.includes('delete');
        if (filter === 'import') return action.includes('imported') || action.includes('import');
        return action.includes(filter);
      });
    }

    // Filter by start date
    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0); // Beginning of the day
        filtered = filtered.filter(log => {
            const logDate = new Date(log.Timestamp || log.timestamp);
            return logDate >= start;
        });
    }

    // Filter by end date
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // End of the day
        filtered = filtered.filter(log => {
            const logDate = new Date(log.Timestamp || log.timestamp);
            return logDate <= end;
        });
    }

    setLogs(filtered);
  }, [searchTerm, selectedAction, startDate, endDate, originalLogs]);

  const formatTimestamp = (timestamp: string | undefined) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      // Format in local timezone (matches localhost)
      return date.toLocaleString('en-PH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (e) {
      return timestamp;
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setSelectedAction('All Actions');
  };

  return (
    <div className={`space-y-6 ${isDarkTheme ? 'bg-gray-900' : 'bg-white'}`}>
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={fetchAuditLogs} className="ml-auto underline font-bold">Retry</button>
        </div>
      )}

      <div className="flex flex-wrap gap-4 items-center justify-between md:hidden">
        <div>
          <h2 className={`text-2xl font-extrabold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Audit & Logs</h2>
          <p className={`font-medium ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>System activity and transaction history</p>
          <p className={`text-xs mt-1 font-semibold ${dataSource === 'Supabase' ? 'text-blue-600' : 'text-orange-600'}`}>
            📊 Data from: {dataSource} | ⏰ Time: Local Timezone (PH)
          </p>
        </div>
        <button
          onClick={fetchAuditLogs}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className={`rounded-xl shadow-sm border overflow-hidden ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`}>
        <div className={`p-4 border-b ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-50/50 border-gray-100'}`}>
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search logs by action, user, or details..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all ${isDarkTheme ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-400' : 'bg-white border-gray-200 text-gray-900'}`}
                    />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                      value={selectedAction}
                      onChange={(e) => setSelectedAction(e.target.value)}
                      className={`w-full sm:w-auto pl-3 pr-8 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm ${isDarkTheme ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                  >
                      {['All Actions', 'Login', 'Update', 'Remove', 'Add', 'Transaction', 'Generate', 'Backup', 'Export', 'Import'].map(action => (
                          <option key={action} value={action}>{action}</option>
                      ))}
                  </select>
                  <input
                      type="date"
                      id="startDate"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={`w-full sm:w-auto px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm ${isDarkTheme ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                      title="Start Date"
                  />
                  <input
                      type="date"
                      id="endDate"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={`w-full sm:w-auto px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm ${isDarkTheme ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                      title="End Date"
                  />
                  <button 
                    onClick={clearFilters} 
                    title="Clear all filters"
                    className={`px-4 py-2.5 text-sm font-semibold rounded-lg hover:shadow-sm transition-all flex items-center gap-2 ${isDarkTheme ? 'text-gray-200 bg-gray-700 border border-gray-600 hover:bg-gray-600' : 'text-[var(--color-text)] bg-white border border-[var(--color-border)] hover:bg-[var(--color-light)]'}`}
                  >
                      <X size={16} /> Clear Filters
                  </button>
                </div>
            </div>
        </div>
        
        {isLoading && (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Loader className="animate-spin text-[var(--color-primary)] mb-4" size={32} />
            <p className={`font-semibold ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Loading audit logs...</p>
          </div>
        )}

        {!isLoading && logs.length === 0 ? (
          <div className={`p-8 text-center ${isDarkTheme ? 'text-gray-400' : 'text-gray-400'}`}>
            No activity logs found for the selected filters.
          </div>
        ) : !isLoading ? (
          <div className={`divide-y max-h-[65vh] overflow-y-auto custom-scrollbar ${isDarkTheme ? 'divide-gray-700' : 'divide-gray-100'}`}>
              {logs.map(log => (
                  <div key={log.LogID || log.id} className={`p-4 flex flex-col gap-3 transition-colors ${isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                      <div className="flex items-start justify-between gap-3">
                          <div className="shrink-0">
                              {log.profileImage ? (
                                  <img src={log.profileImage} alt={log.username} className="w-10 h-10 rounded-full object-cover" />
                              ) : (
                                  <div className={`p-3 rounded-full ${isDarkTheme ? 'bg-gray-700 text-gray-400' : 'bg-slate-100 text-slate-600'}`}>
                                      {getIcon(log.action)}
                                  </div>
                              )}
                          </div>
                          <div className="flex-1 min-w-0">
                              <h4 className={`font-bold break-words whitespace-normal ${isDarkTheme ? 'text-gray-200' : 'text-slate-800'}`}>
                                  {extractChanges(log.ActionPerformed || log.action) || (log.ActionPerformed || log.action) || 'Action'}
                              </h4>
                          </div>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${isDarkTheme ? 'text-gray-400 bg-gray-700' : 'text-slate-400 bg-slate-50'}`}>
                              {formatTimestamp(log.Timestamp || log.timestamp)}
                          </span>
                      </div>
                      <div className="flex flex-col sm:flex-row items-start gap-2 ml-13">
                          <span className={`text-xs font-mono px-2 py-1 rounded border flex-shrink-0 ${isDarkTheme ? 'text-gray-400 bg-gray-700 border-gray-600' : 'text-gray-600 bg-gray-50 border-gray-100'}`}>
                              User: <span className={`font-semibold ${isDarkTheme ? 'text-gray-300' : 'text-gray-800'}`}>{log.UserName || log.user || 'N/A'}</span>
                          </span>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${isDarkTheme ? 'bg-white text-slate-800' : badgeThemeClass}`}>
                              {log.Role || log.role || 'N/A'}
                          </span>
                      </div>
                  </div>
              ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AuditLogs;

