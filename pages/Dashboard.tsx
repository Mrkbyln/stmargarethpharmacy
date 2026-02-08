import React, { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePharmacy } from '../context/PharmacyContext';
import apiClient from '../lib/apiClient';
import ErrorModal from '../components/ErrorModal';
import { formatDateTime, formatDateTimeWithSpace } from '../lib/dateFormatter';
import { 
  AlertTriangle, 
  Package, 
  ShoppingBag,
  Receipt
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';



const Dashboard: React.FC = () => {
  const { medicines, sales: contextSales, currencySymbol, user, getRoleBadgeColor, themeColor } = usePharmacy();
  const isDarkTheme = themeColor === 'black';
  const navigate = useNavigate();
  const [dbSales, setDbSales] = useState<any[]>([]);
  const [rawSalesData, setRawSalesData] = useState<any[]>([]);
  const [expiredProducts, setExpiredProducts] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllTransactionsModal, setShowAllTransactionsModal] = useState(false);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [saleItems, setSaleItems] = useState<Record<string, any[]>>({}); // Store items for each sale
  const [loadingSaleItems, setLoadingSaleItems] = useState<Record<string, boolean>>({}); // Track loading state per sale
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<'all' | 'sale' | 'exchange'>('all');
  const [showViewAllDropdown, setShowViewAllDropdown] = useState(false);
  const [chartTimeFrame, setChartTimeFrame] = useState<'weekly' | 'monthly'>('weekly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  
  // Theme color mapping for badges - matches Settings.tsx color options
  const badgeThemeClass = {
    'amber': 'bg-amber-400 border-amber-400 text-white',
    'teal': 'bg-teal-400 border-teal-400 text-white',
    'blue': 'bg-blue-400 border-blue-400 text-white',
    'rose': 'bg-rose-400 border-rose-400 text-white',
    'emerald': 'bg-emerald-400 border-emerald-400 text-white',
    'black': 'bg-gray-800 border-gray-800 text-white'
  }[themeColor] || 'bg-amber-400 border-amber-400 text-white';
  
  // Error Modal States
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalCode, setErrorModalCode] = useState('');
  const [errorModalTitle, setErrorModalTitle] = useState('');
  const [errorModalMessage, setErrorModalMessage] = useState('');

  const isAdmin = user?.role === 'admin';

  // Helper function to format numbers with thousand separators
  const formatNumberWithCommas = (num: number): string => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  // Function to fetch sale items when expanding a sale
  const fetchSaleItems = async (saleId: string, isExchange: boolean = false) => {
    if (saleItems[saleId] || loadingSaleItems[saleId]) return; // Already loaded or loading
    
    setLoadingSaleItems(prev => ({ ...prev, [saleId]: true }));
    try {
      if (isExchange) {
        // Exchanges don't need items fetching, they already have item details
        setSaleItems(prev => ({ ...prev, [saleId]: [] }));
      } else {
        // Fetch items for POS sales
        const response = await fetch(`/api/sales/read.php?saleId=${saleId}`);
        const data = await response.json();
        
        if (data.success && data.items) {
          setSaleItems(prev => ({ ...prev, [saleId]: data.items }));
        } else {
          setSaleItems(prev => ({ ...prev, [saleId]: [] }));
        }
      }
    } catch (error) {
      console.error('Error fetching sale items:', error);
      setSaleItems(prev => ({ ...prev, [saleId]: [] }));
    } finally {
      setLoadingSaleItems(prev => ({ ...prev, [saleId]: false }));
    }
  };

  // Helper function to detect discount type from discount name
  const getDiscountTypeLabel = (discountName: string | null | undefined): { type: 'pwd' | 'senior' | null; label: string } => {
    if (!discountName) return { type: null, label: '' };
    const lowerName = discountName.toLowerCase();
    if (lowerName.includes('pwd')) {
      return { type: 'pwd', label: 'PWD' };
    } else if (lowerName.includes('senior')) {
      return { type: 'senior', label: 'Senior' };
    }
    return { type: null, label: '' };
  };

  // Fetch all transactions (sales + exchange payments)
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await apiClient.getAllTransactions();
        console.log('getAllTransactions response:', response);
        if (response.success && response.data) {
          console.log('Transaction data loaded:', response.data.length, 'transactions');
          setDbSales(response.data);
          setRawSalesData(response.data);
        } else {
          console.warn('Failed to fetch transactions:', response.message);
          setErrorModalCode('err001');
          setErrorModalTitle('Failed to Load Transactions');
          setErrorModalMessage('Unable to fetch transaction data. Displaying fallback data.');
          setShowErrorModal(true);
          setDbSales(contextSales);
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
        setErrorModalCode('err002');
        setErrorModalTitle('Connection Error');
        setErrorModalMessage('Failed to load transactions. Please check your connection.');
        setShowErrorModal(true);
        setDbSales(contextSales);
      }
    };

    // Fetch expired products
    const fetchExpiredProducts = async () => {
      try {
        // Use the dedicated endpoint for expired items
        const response = await apiClient.getExpiredItems();
        if (response.success && response.data) {
          // Fetch stock entries to exclude products with new stocks
          const stockResponse = await apiClient.getStockEntries();
          let productsWithNewStocks = new Set<number>();
          
          if (stockResponse.success && stockResponse.data) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Find products that have stock entries added today or recently
            productsWithNewStocks = new Set(
              stockResponse.data
                .filter((entry: any) => {
                  const entryDate = new Date(entry.DateAdded);
                  entryDate.setHours(0, 0, 0, 0);
                  return entryDate >= today;
                })
                .map((entry: any) => entry.ProductID)
            );
          }
          
          // Filter out products that have new stocks
          const filteredExpired = response.data.filter((product: any) => 
            !productsWithNewStocks.has(product.ProductID)
          );
          
          setExpiredProducts(filteredExpired);
        } else {
          console.warn('Failed to fetch expired products:', response.message);
        }
      } catch (error) {
        console.error('Error fetching expired products:', error);
      }
    };

    // Fetch low stock products
    const fetchLowStockProducts = async () => {
      try {
        const response = await apiClient.getInventory();
        if (response.success && response.data) {
          // Fetch stock entries to exclude products with new stocks
          const stockResponse = await apiClient.getStockEntries();
          let productsWithNewStocks = new Set<number>();
          
          if (stockResponse.success && stockResponse.data) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Find products that have stock entries added today or recently
            productsWithNewStocks = new Set(
              stockResponse.data
                .filter((entry: any) => {
                  const entryDate = new Date(entry.DateAdded);
                  entryDate.setHours(0, 0, 0, 0);
                  return entryDate >= today;
                })
                .map((entry: any) => entry.ProductID)
            );
          }
          
          const lowStock = response.data.filter((product: any) => {
            // Exclude products with new stocks added today
            if (productsWithNewStocks.has(product.ProductID)) {
              return false;
            }
            
            const reorderLevel = parseInt(product.ReorderLevel) || 10;
            const currentStock = parseInt(product.CurrentStock) || 0;
            return currentStock <= reorderLevel;
          });
          
          setLowStockProducts(lowStock);
        }
      } catch (error) {
        console.error('Error fetching low stock products:', error);
      }
    };

    const fetchAllData = async () => {
      setLoading(true);
      await Promise.all([
        fetchTransactions(),
        fetchExpiredProducts(),
        fetchLowStockProducts()
      ]);
      setLoading(false);
    };

    fetchAllData();
  }, []);

  // Fetch items for all POS sales when modal opens
  useEffect(() => {
    if (!showAllTransactionsModal || rawSalesData.length === 0) return;

    // Get all unique POS sale IDs
    const uniqueSaleIds = new Set<string>();
    rawSalesData.forEach((sale: any) => {
      if (sale.TransactionType !== 'exchange') {
        uniqueSaleIds.add(String(sale.SaleID));
      }
    });

    // Fetch items for each sale that hasn't been fetched yet
    uniqueSaleIds.forEach((saleId) => {
      if (!saleItems[saleId] && !loadingSaleItems[saleId]) {
        fetchSaleItems(saleId, false);
      }
    });
  }, [showAllTransactionsModal, rawSalesData]);

  const todayTransactions = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    let filtered = dbSales.filter(t => {
      if (!t.TransactionDate) return false;
      try {
        const transactionDate = new Date(t.TransactionDate);
        return transactionDate >= todayStart && transactionDate <= todayEnd;
      } catch (e) {
        console.error("Failed to parse transaction date:", t.TransactionDate, e);
        return false;
      }
    });

    // Apply transaction type filter
    if (transactionTypeFilter !== 'all') {
      filtered = filtered.filter(t => t.TransactionType === transactionTypeFilter);
    }

    // Sort by TransactionDate descending (newest first - current transaction at top)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.TransactionDate).getTime();
      const dateB = new Date(b.TransactionDate).getTime();
      return dateB - dateA;
    });
  }, [dbSales, transactionTypeFilter]);

  const stats = useMemo(() => {
    // Calculate today's revenue from all transactions
    const todayRevenue = todayTransactions.reduce((acc, curr) => {
      const amount = parseFloat(curr.FinalAmount || curr.AdditionalPayment || 0);
      return acc + (isNaN(amount) ? 0 : amount);
    }, 0);

    return {
      totalMedicines: medicines.length,
      todayRevenue,
      lowStockCount: lowStockProducts.length,
      expiredCount: expiredProducts.length,
    };
  }, [medicines.length, todayTransactions, lowStockProducts, expiredProducts]);


  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const availableYears = useMemo(() => {
    const years = new Set(dbSales.map(sale => new Date(sale.TransactionDate).getFullYear()));
    if (years.size === 0) return [new Date().getFullYear()];
    return Array.from(years).sort((a, b) => b - a); // Descending order
  }, [dbSales]);

  // Sync selected year with available data
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears]);

  // Prepare data for chart
  const chartData = useMemo(() => {
    if (chartTimeFrame === 'monthly') {
      const salesForYear = dbSales.filter(sale => new Date(sale.TransactionDate).getFullYear() === selectedYear);
      
      const grouped = salesForYear.reduce((acc, transaction) => {
        const transactionDate = new Date(transaction.TransactionDate);
        const monthKey = transactionDate.getMonth(); // 0-11
        const amount = parseFloat(transaction.FinalAmount || transaction.AdditionalPayment || 0);
        const validAmount = isNaN(amount) ? 0 : amount;
        acc[monthKey] = (acc[monthKey] || 0) + validAmount;
        return acc;
      }, {} as Record<number, number>);

      // Ensure all months are present for the selected year
      return monthNames.map((name, index) => ({
        name: name,
        revenue: grouped[index] || 0
      }));

    } else { // weekly - show calendar weeks (Monday-Sunday) across the month
      const salesForMonth = dbSales.filter(sale => {
        const saleDate = new Date(sale.TransactionDate);
        return saleDate.getFullYear() === selectedYear && saleDate.getMonth() === selectedMonth;
      });

      // Get the first day of the month and number of days
      const firstDay = new Date(selectedYear, selectedMonth, 1);
      const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

      // Initialize data for each calendar week
      const grouped = salesForMonth.reduce((acc, transaction) => {
        const transactionDate = new Date(transaction.TransactionDate);
        const day = transactionDate.getDate();
        
        // Find which calendar week (Mon-Sun) this day belongs to
        // Get the Monday of the week containing this day
        const dateObj = new Date(selectedYear, selectedMonth, day);
        const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const mondayOfWeek = new Date(dateObj);
        mondayOfWeek.setDate(day + mondayOffset);
        const weekKey = mondayOfWeek.getTime(); // Use Monday as unique week identifier
        
        const amount = parseFloat(transaction.FinalAmount || transaction.AdditionalPayment || 0);
        const validAmount = isNaN(amount) ? 0 : amount;
        
        if (!acc[weekKey]) {
          acc[weekKey] = { revenue: 0, mondayDate: new Date(mondayOfWeek) };
        }
        acc[weekKey].revenue += validAmount;
        return acc;
      }, {} as Record<number, { revenue: number; mondayDate: Date }>);

      // Create array of all calendar weeks that span this month
      const weeklyData = [];
      const weeks = new Map<number, { revenue: number; mondayDate: Date }>();
      
      // Iterate through all days of the month to find all weeks
      for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(selectedYear, selectedMonth, day);
        const dayOfWeek = dateObj.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const mondayOfWeek = new Date(dateObj);
        mondayOfWeek.setDate(day + mondayOffset);
        const weekKey = mondayOfWeek.getTime();
        
        if (!weeks.has(weekKey)) {
          weeks.set(weekKey, { revenue: 0, mondayDate: new Date(mondayOfWeek) });
        }
      }

      // Populate revenue for each week
      weeks.forEach((weekData, weekKey) => {
        const amount = grouped[weekKey];
        if (amount) {
          weeks.set(weekKey, { ...weekData, revenue: amount.revenue });
        }
      });

      // Sort weeks chronologically and create display data
      const sortedWeeks = Array.from(weeks.entries()).sort((a, b) => a[0] - b[0]);
      
      sortedWeeks.forEach((entry, index) => {
        const weekData = entry[1];
        const weekStartDate = new Date(weekData.mondayDate);
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekEndDate.getDate() + 6);
        
        // For display, only show days that are in the current month
        const displayStart = weekStartDate.getMonth() === selectedMonth ? weekStartDate.getDate() : 1;
        const displayEnd = weekEndDate.getMonth() === selectedMonth ? weekEndDate.getDate() : daysInMonth;
        
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const weekStartDayName = dayNames[weekStartDate.getDay()];
        const weekEndDayName = dayNames[weekEndDate.getDay()];
        
        // Check if this week is partial (extends beyond month-end)
        const isPartialWeek = weekEndDate.getMonth() !== selectedMonth;
        const weekLabel = isPartialWeek 
          ? `Week ${index + 1}: ${monthNames[selectedMonth]} ${displayStart}-${displayEnd} (partial week)`
          : `Week ${index + 1}: ${monthNames[selectedMonth]} ${displayStart}-${displayEnd}`;
        
        weeklyData.push({
          name: weekLabel,
          dateRange: `${displayStart}-${displayEnd}`,
          revenue: weekData.revenue
        });
      });

      return weeklyData;
    }
  }, [dbSales, chartTimeFrame, selectedYear, selectedMonth]);

  return (
    <div className="space-y-4 md:space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 md:gap-4">
        <div>
          <h2 className={`text-2xl font-extrabold md:hidden ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Dashboard</h2>
          <p className={`font-medium md:hidden ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Stock and Inventory Overview This Month</p>
        </div>
        <span className={`text-sm font-medium px-3 py-1 rounded-full shadow-sm md:hidden ${isDarkTheme ? 'bg-gray-800 text-gray-300' : 'text-slate-500 bg-white'}`}>{formatDateTime(new Date())}</span>
      </div>

      {/* Stats Grid */}
      <div 
        className="w-full grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <div 
          onClick={() => navigate('/products')}
          className={`p-6 rounded-xl shadow-sm border flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`}
        >
          <div className="p-3 bg-[var(--color-light)] rounded-lg text-[var(--color-text)] group-hover:scale-110 transition-transform shrink-0">
            <Package className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Total Products</p>
            <p className={`text-2xl font-extrabold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{formatNumberWithCommas(stats.totalMedicines)}</p>
          </div>
        </div>

        <div 
          onClick={() => navigate('/reports')}
          className={`p-6 rounded-xl shadow-sm border flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`}
        >
          <div className="p-3 bg-[var(--color-light)] rounded-lg text-[var(--color-text)] text-2xl font-bold flex items-center justify-center w-14 h-14 shrink-0">
            {currencySymbol}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Today's Revenue</p>
            <p className={`text-2xl font-extrabold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{currencySymbol}{formatNumberWithCommas(Math.floor(stats.todayRevenue))}.{String(Math.round((stats.todayRevenue % 1) * 100)).padStart(2, '0')}</p>
          </div>
        </div>

        <div 
          onClick={() => navigate('/products')}
          className={`p-6 rounded-xl shadow-sm border flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`}
        >
          <div className={`p-3 rounded-lg group-hover:scale-110 transition-transform shrink-0 ${isDarkTheme ? 'bg-orange-900 text-orange-400' : 'bg-orange-100 text-orange-600'}`}>
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Low Stock</p>
            <p className={`text-2xl font-extrabold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{formatNumberWithCommas(stats.lowStockCount)}</p>
          </div>
        </div>

        <div 
          onClick={() => navigate('/products')}
          className={`p-6 rounded-xl shadow-sm border flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`}
        >
          <div className={`p-3 rounded-lg group-hover:scale-110 transition-transform shrink-0 ${isDarkTheme ? 'bg-red-900 text-red-400' : 'bg-red-100 text-red-600'}`}>
            <ShoppingBag className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Expired</p>
            <p className={`text-2xl font-extrabold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{formatNumberWithCommas(stats.expiredCount)}</p>
          </div>
        </div>
      </div>

      {/* Sales Chart and Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className={`p-4 md:p-6 rounded-xl shadow-sm border ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`}>
          <div className="flex justify-between items-center mb-3 md:mb-4 gap-2">
            <h3 className={`font-bold text-base md:text-lg ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Sales Overview</h3>
            <div className="flex items-center gap-2">
              {/* Year/Month Filters */}
              <div className="flex items-center gap-1">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className={`p-1 rounded-lg text-sm font-semibold border-none focus:ring-2 focus:ring-[var(--color-primary)] ${isDarkTheme ? 'bg-gray-700 text-gray-200' : 'bg-slate-100 text-slate-600'}`}
                >
                  {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                </select>
                {chartTimeFrame === 'weekly' && (
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className={`p-1 rounded-lg text-sm font-semibold border-none focus:ring-2 focus:ring-[var(--color-primary)] ${isDarkTheme ? 'bg-gray-700 text-gray-200' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {monthNames.map((name, index) => <option key={name} value={index}>{name}</option>)}
                  </select>
                )}
              </div>

              {/* Time Frame Toggles */}
              <div className={`flex items-center gap-1 p-1 rounded-lg ${isDarkTheme ? 'bg-gray-700' : 'bg-slate-100'}`}>
                <button 
                  onClick={() => setChartTimeFrame('weekly')}
                  className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${chartTimeFrame === 'weekly' ? `${isDarkTheme ? 'bg-gray-800 text-white' : 'bg-white text-[var(--color-primary)]'} shadow-sm` : `${isDarkTheme ? 'text-gray-400 hover:bg-gray-600' : 'text-slate-500 hover:bg-slate-200'}`}`}
                >
                  Weekly
                </button>
                <button 
                  onClick={() => setChartTimeFrame('monthly')}
                  className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${chartTimeFrame === 'monthly' ? `${isDarkTheme ? 'bg-gray-800 text-white' : 'bg-white text-[var(--color-primary)]'} shadow-sm` : `${isDarkTheme ? 'text-gray-400 hover:bg-gray-600' : 'text-slate-500 hover:bg-slate-200'}`}`}
                >
                  Monthly
                </button>
              </div>
            </div>
          </div>
          <div className="w-full" style={{ height: '320px', minHeight: '320px' }}>
             {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {chartTimeFrame === 'weekly' ? (
                    <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkTheme ? '#4b5563' : 'var(--color-border)'} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: isDarkTheme ? '#9ca3af' : '#64748b', fontSize: 9}} 
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: isDarkTheme ? '#9ca3af' : '#64748b'}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: isDarkTheme ? '#1f2937' : '#fff', color: isDarkTheme ? '#f3f4f6' : '#000' }}
                        cursor={{ stroke: 'var(--color-primary)', strokeWidth: 2, strokeDasharray: '3 3' }}
                        formatter={(value: any) => {
                          const num = typeof value === 'number' ? value : parseFloat(value);
                          return isNaN(num) ? ['N/A', 'Revenue'] : [`${currencySymbol}${num.toFixed(2)}`, 'Revenue'];
                        }}
                      />
                      <Line type="monotone" dataKey="revenue" stroke={isDarkTheme ? '#ffffff' : 'var(--color-primary)'} strokeWidth={2} dot={{ r: 4, fill: isDarkTheme ? '#ffffff' : 'var(--color-primary)' }} activeDot={{ r: 8 }} />
                    </LineChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkTheme ? '#4b5563' : 'var(--color-border)'} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: isDarkTheme ? '#9ca3af' : '#64748b'}} interval={0} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: isDarkTheme ? '#9ca3af' : '#64748b'}} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: isDarkTheme ? '#1f2937' : '#fff', color: isDarkTheme ? '#f3f4f6' : '#000' }}
                          cursor={{ fill: 'var(--color-light)' }}
                          formatter={(value: any) => {
                            const num = typeof value === 'number' ? value : parseFloat(value);
                            return isNaN(num) ? ['N/A', 'Revenue'] : [`${currencySymbol}${num.toFixed(2)}`, 'Revenue'];
                          }}
                        />
                        <Bar dataKey="revenue" fill={isDarkTheme ? '#ffffff' : 'var(--color-primary)'} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
             ) : (
                 <div className={`h-full flex items-center justify-center rounded-lg border border-dashed ${isDarkTheme ? 'text-gray-400 bg-gray-700/50 border-gray-600' : 'text-slate-400 bg-slate-50 border-slate-200'}`}>
                     No sales data available yet
                 </div>
             )}
          </div>
          {chartTimeFrame === 'weekly' && (
            <div className={`text-xs mt-2 px-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
              <p className="font-medium">Showing {chartData.length} weeks for {monthNames[selectedMonth]} {selectedYear}</p>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className={`p-4 md:p-6 rounded-xl shadow-sm border ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`}>
          <div className="flex items-center justify-between mb-3 md:mb-4 gap-2 flex-wrap">
            <div className="flex items-center gap-2 md:gap-3">
              <Receipt className="w-4 md:w-5 h-4 md:h-5 text-[var(--color-primary)]" />
              <h3 className={`font-bold text-base md:text-lg ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Recent Transactions</h3>
            </div>
            <div className="relative">
              <button
                onClick={() => {
                  setShowViewAllDropdown(!showViewAllDropdown);
                  if (!showViewAllDropdown) {
                    setTransactionTypeFilter('all');
                  }
                }}
                className="px-3 py-1.5 text-sm font-semibold text-white bg-[var(--color-primary)] hover:opacity-90 rounded-lg transition-opacity flex items-center gap-1"
              >
                View All
                <span className={`text-xs transition-transform ${showViewAllDropdown ? 'rotate-180' : ''}`}>▼</span>
              </button>
              
              {showViewAllDropdown && (
                <div className={`absolute right-0 mt-2 border rounded-lg shadow-lg z-40 min-w-[180px] ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-white border-[var(--color-border)]'}`}>
                  <button
                    onClick={() => {
                      setTransactionTypeFilter('all');
                      setShowAllTransactionsModal(true);
                      setShowViewAllDropdown(false);
                    }}
                    className={`block w-full text-left px-4 py-2.5 text-sm font-medium transition-colors first:rounded-t-lg border-b ${isDarkTheme ? 'text-gray-200 hover:bg-gray-600 border-gray-600' : 'text-slate-700 hover:bg-slate-50 border-[var(--color-border)]'}`}
                  >
                    All Transactions
                  </button>
                  <button
                    onClick={() => {
                      setTransactionTypeFilter('sale');
                      setShowViewAllDropdown(false);
                    }}
                    className={`block w-full text-left px-4 py-2.5 text-sm font-medium transition-colors border-b ${isDarkTheme ? 'text-gray-200 hover:bg-gray-600 border-gray-600' : 'text-slate-700 hover:bg-slate-50 border-[var(--color-border)]'}`}
                  >
                    Sales Only
                  </button>
                  <button
                    onClick={() => {
                      setTransactionTypeFilter('exchange');
                      setShowViewAllDropdown(false);
                    }}
                    className={`block w-full text-left px-4 py-2.5 text-sm font-medium transition-colors last:rounded-b-lg ${isDarkTheme ? 'text-gray-200 hover:bg-gray-600' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    Exchanges Only
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="overflow-y-auto max-h-80">
            {loading ? (
              <div className={`py-8 text-center ${isDarkTheme ? 'text-gray-400' : 'text-slate-400'}`}>
                <p>Loading...</p>
              </div>
            ) : (
              todayTransactions.length > 0 ? (
                <table className="w-full text-xs">
                  <thead className={`sticky top-0 ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
                    <tr className={`border-b ${isDarkTheme ? 'border-gray-700' : 'border-[var(--color-border)]'}`}>
                      <th className={`text-left py-2 px-1 font-semibold ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Type</th>
                      <th className={`text-left py-2 px-1 font-semibold ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Date & Time</th>
                      <th className={`text-left py-2 px-1 font-semibold ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Processed By</th>
                      <th className={`text-right py-2 px-1 font-semibold ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayTransactions.map((transaction) => {
                      const transactionDate = formatDateTimeWithSpace(transaction.TransactionDate);
                      const isExchange = transaction.TransactionType === 'exchange';
                      const amount = parseFloat(isExchange ? transaction.AdditionalPayment : transaction.FinalAmount) || 0;
                      const userRole = transaction.UserRole ? transaction.UserRole : 'N/A';
                      const displayRole = userRole === 'Admin' ? 'Admin' : userRole === 'Pharmacy Assistant' ? 'Pharmacy Assistant' : 'N/A';
                      
                      return (
                        <tr 
                          key={`${transaction.TransactionType}-${transaction.SaleID || transaction.ChangeID}`} 
                          className={`border-b transition-colors ${isDarkTheme ? `border-gray-700 hover:bg-gray-700 ${isExchange ? 'bg-yellow-900/30' : ''}` : `border-[var(--color-border)] hover:bg-slate-50 ${isExchange ? 'bg-amber-50' : ''}`}`}
                        >
                          <td className="py-2 px-1">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                              isExchange 
                                ? isDarkTheme ? 'text-yellow-300 bg-yellow-900/50' : 'text-amber-600 bg-amber-100'
                                : isDarkTheme ? 'text-blue-300 bg-blue-900/50' : 'text-blue-600 bg-blue-50'
                            }`}>
                              {isExchange ? 'Exchange' : 'Sale'}
                            </span>
                          </td>
                          <td className={`py-2 px-1 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>{transactionDate}</td>
                          <td className="py-2 px-1">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badgeThemeClass}`}>
                              {displayRole}
                            </span>
                          </td>
                          <td className={`py-2 px-1 font-semibold text-right whitespace-nowrap ${isExchange && amount > 0 ? isDarkTheme ? 'text-green-400' : 'text-green-600' : isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                            {isExchange && amount > 0 ? '+' : ''}{currencySymbol}{formatNumberWithCommas(Math.floor(amount))}.{String(Math.round((amount % 1) * 100)).padStart(2, '0')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className={`py-8 text-center ${isDarkTheme ? 'text-gray-400' : 'text-slate-400'}`}>
                  <Receipt className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No transactions today</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* All Transactions Modal */}
      {showAllTransactionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl shadow-lg max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between p-6 border-b ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-4">
                <h2 className={`text-2xl font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                  {transactionTypeFilter === 'exchange' ? 'Exchanges' : transactionTypeFilter === 'sale' ? 'POS Sales' : 'Transactions'}
                </h2>
                <select
                  value={transactionTypeFilter}
                  onChange={(e) => setTransactionTypeFilter(e.target.value as 'all' | 'sale' | 'exchange')}
                  className={`text-sm rounded-lg focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] block p-2.5 border ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                >
                  <option value="all">All Transactions</option>
                  <option value="sale">Sales Only</option>
                  <option value="exchange">Exchanges Only</option>
                </select>
              </div>
              <button
                onClick={() => setShowAllTransactionsModal(false)}
                className={`text-2xl ${isDarkTheme ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1">
              {rawSalesData.length > 0 ? (() => {
                // Group raw sales data by SaleID for detailed view - ONLY POS SALES (filter out exchanges)
                const groupedBySaleId = rawSalesData.reduce((acc: any, sale: any) => {
                  // Apply transaction type filter
                  if (transactionTypeFilter === 'sale' && sale.TransactionType === 'exchange') {
                    return acc;
                  }
                  if (transactionTypeFilter === 'exchange' && sale.TransactionType !== 'exchange') {
                    return acc;
                  }
                  
                  const isExchange = sale.TransactionType === 'exchange';
                  const uniqueId = isExchange ? `exch_${sale.ChangeID}` : `sale_${sale.SaleID}`;
                  
                  if (!acc[uniqueId]) {
                    acc[uniqueId] = {
                      uniqueId: uniqueId,
                      SaleID: isExchange ? sale.ChangeID : sale.SaleID,
                      TransactionType: sale.TransactionType,
                      TransactionDate: sale.TransactionDate,
                      TotalAmount: sale.TotalAmount,
                      Discount: sale.Discount,
                      DiscountType: sale.DiscountType, // Capture discount type
                      FinalAmount: sale.FinalAmount,
                      CashReceived: sale.CashReceived,
                      ChangeGiven: sale.ChangeGiven,
                      ProcessedByName: sale.ProcessedByName,
                      UserRole: sale.UserRole, // Capture UserRole
                      // Exchange specific fields
                      ItemReturned: sale.ItemReturned,
                      ReturnedItemName: sale.ReturnedItemName,
                      QtyReturned: sale.QtyReturned,
                      ItemGiven: sale.ItemGiven,
                      QtyGiven: sale.QtyGiven,
                      ItemGivenPrice: sale.ItemGivenPrice,
                      ReturnedItemPrice: sale.ReturnedItemPrice,
                      AdditionalPayment: sale.AdditionalPayment,
                      
                      items: [],
                      itemKeys: new Set() // Track added items to prevent duplicates
                    };
                  }
                  // Get product particulars - use either ProductName or Particulars field
                  if ((sale.ProductName || sale.Particulars) && !isExchange) {
                    // Create a unique key for this item to prevent duplicates
                    const itemKey = `${sale.ProductCode}-${sale.SellingPrice}`;
                    if (!acc[uniqueId].itemKeys.has(itemKey)) {
                      acc[uniqueId].items.push({
                        ProductName: sale.ProductName || sale.Particulars,
                        ProductCode: sale.ProductCode,
                        QuantitySold: sale.QuantitySold,
                        SellingPrice: sale.SellingPrice,
                        TotalAmountSold: sale.TotalAmountSold
                      });
                      acc[uniqueId].itemKeys.add(itemKey);
                    }
                  }
                  return acc;
                }, {});
                
                const salesArray = Object.values(groupedBySaleId).map((sale: any) => {
                  // Remove the temporary itemKeys Set before mapping
                  const { itemKeys, ...cleanSale } = sale;
                  return cleanSale;
                }).sort((a: any, b: any) => {
                  const dateA = new Date(a.TransactionDate).getTime();
                  const dateB = new Date(b.TransactionDate).getTime();
                  return dateB - dateA; // DESC: newest first
                });

                // Calculate total additional payment for exchanges
                const totalAdditionalPayment = salesArray.reduce((sum: number, sale: any) => {
                    return sum + (parseFloat(sale.AdditionalPayment) || 0);
                }, 0);

                return (
                  <div className="space-y-2">
                    {/* Total Summary for Exchanges */}
                    {transactionTypeFilter === 'exchange' && (
                        <div className={`px-6 py-4 border-b flex justify-between items-center sticky top-0 z-20 ${isDarkTheme ? 'bg-blue-900 border-blue-800' : 'bg-blue-50 border-blue-100'}`}>
                            <span className={`font-bold text-sm uppercase tracking-wide ${isDarkTheme ? 'text-blue-100' : 'text-blue-800'}`}>Total Additional Payment</span>
                            <span className={`font-extrabold text-2xl ${isDarkTheme ? 'text-blue-200' : 'text-blue-900'}`}>{currencySymbol}{totalAdditionalPayment.toFixed(2)}</span>
                        </div>
                    )}

                    {/* Table Headers */}
                    <div className={`grid ${transactionTypeFilter === 'exchange' ? 'grid-cols-6' : 'grid-cols-7'} gap-4 items-center px-4 py-3 border-b sticky ${transactionTypeFilter === 'exchange' ? 'top-[60px]' : 'top-0'} z-10 ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                      <div>
                        <p className={`text-xs font-semibold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-gray-600'}`}>Invoice ID</p>
                      </div>
                      <div>
                        <p className={`text-xs font-semibold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-gray-600'}`}>Date</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-xs font-semibold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-gray-600'}`}>Items</p>
                      </div>
                      {transactionTypeFilter !== 'exchange' && (
                        <div className="text-right">
                          <p className={`text-xs font-semibold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-gray-600'}`}>Discount</p>
                        </div>
                      )}
                      <div className="text-right">
                        <p className={`text-xs font-semibold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-gray-600'}`}>
                          {transactionTypeFilter === 'exchange' ? 'Additional Payment' : 'Final Amount'}
                        </p>
                      </div>
                      <div className="text-left">
                        <p className={`text-xs font-semibold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-gray-600'}`}>Processed By</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-xs font-semibold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-gray-600'}`}>Action</p>
                      </div>
                    </div>

                    {salesArray.map((sale: any) => {
                      const transactionDate = formatDateTime(sale.TransactionDate);
                      const totalAmount = parseFloat(sale.TotalAmount) || 0;
                      const discount = parseFloat(sale.Discount) || 0;
                      const finalAmount = parseFloat(sale.FinalAmount) || 0;
                      const cashReceived = parseFloat(sale.CashReceived) || 0;
                      const changeGiven = parseFloat(sale.ChangeGiven) || 0;
                      const isExpanded = expandedSaleId === sale.uniqueId; // Use uniqueId for expansion state
                      const isExchange = sale.TransactionType === 'exchange';

                      return (
                        <div key={sale.uniqueId} className={`border-b ${isDarkTheme ? 'border-gray-700' : 'border-gray-100'}`}>
                          {/* Main Transaction Row */}
                          <button
                            onClick={() => {
                              const newExpanded = isExpanded ? null : sale.uniqueId;
                              setExpandedSaleId(newExpanded);
                              // Fetch items when expanding a POS sale
                              if (newExpanded && !isExchange) {
                                fetchSaleItems(sale.SaleID, isExchange);
                              }
                            }}
                            className={`w-full text-left transition-colors p-4 ${isExchange ? (isDarkTheme ? 'hover:bg-amber-900/30 bg-amber-900/20' : 'hover:bg-gray-50 bg-amber-50/30') : (isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-50')}`}
                          >
                            <div className={`grid ${transactionTypeFilter === 'exchange' ? 'grid-cols-6' : 'grid-cols-7'} gap-4 items-center`}>
                              <div>
                                <p className={`text-sm font-medium ${isDarkTheme ? 'text-gray-200' : 'text-gray-700'}`}>
                                  {isExchange ? `#EXCH-${String(sale.SaleID).padStart(6, '0')}` : `#INV-${String(sale.SaleID).padStart(6, '0')}`}
                                </p>
                                {isExchange && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDarkTheme ? 'text-amber-300 bg-amber-900' : 'text-amber-600 bg-amber-100'}`}>EXCHANGE</span>}
                              </div>
                              <div>
                                <p className={`text-sm ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>{transactionDate}</p>
                              </div>
                              <div className="text-center">
                                <p className={`text-sm font-medium ${isDarkTheme ? 'text-gray-200' : 'text-gray-700'}`}>
                                  {isExchange ? '1 pair' : loadingSaleItems[sale.SaleID] ? 'Loading...' : `${(saleItems[sale.SaleID] || sale.items || []).length} item${(saleItems[sale.SaleID] || sale.items || []).length !== 1 ? 's' : ''}`}
                                </p>
                              </div>
                              {transactionTypeFilter !== 'exchange' && (
                                <div className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <p className={`text-sm ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>{discount > 0 ? `${currencySymbol}${formatNumberWithCommas(Math.floor(discount))}.${String(Math.round((discount % 1) * 100)).padStart(2, '0')}` : `${currencySymbol}0.00`}</p>
                                    {discount > 0 && sale.DiscountType && (
                                      <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded whitespace-nowrap ${
                                        getDiscountTypeLabel(sale.DiscountType).type === 'pwd'
                                          ? isDarkTheme ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700'
                                          : getDiscountTypeLabel(sale.DiscountType).type === 'senior'
                                          ? isDarkTheme ? 'bg-purple-900 text-purple-300' : 'bg-purple-100 text-purple-700'
                                          : ''
                                      }`}>
                                        {getDiscountTypeLabel(sale.DiscountType).label}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                              <div className="text-right">
                                <p className={`text-sm font-semibold ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>{currencySymbol}{formatNumberWithCommas(Math.floor(finalAmount))}.{String(Math.round((finalAmount % 1) * 100)).padStart(2, '0')}</p>
                              </div>
                              <div className="text-left">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${isDarkTheme ? 'bg-white text-slate-800' : badgeThemeClass}`}>
                                  {sale.UserRole || 'N/A'}
                                </span>
                              </div>
                              <div className="text-center">
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${isDarkTheme ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                                  {isExpanded ? '▼ Collapse' : '▶ Expand'}
                                </span>
                              </div>
                            </div>
                          </button>

                          {/* Expanded Content for Exchange */}
                          {isExpanded && isExchange && (
                            <div className={`p-4 border-t ${isDarkTheme ? 'bg-amber-900/20 border-amber-700' : 'bg-amber-50/50 border-amber-100'}`}>
                              <p className={`text-sm font-bold mb-3 uppercase tracking-wider ${isDarkTheme ? 'text-amber-200' : 'text-slate-800'}`}>Exchange Details</p>
                              <div className="flex flex-col md:flex-row gap-4 mb-4">
                                {/* Returned Item */}
                                <div className={`flex-1 border rounded-lg p-3 ${isDarkTheme ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-100'}`}>
                                  <p className={`text-xs font-bold uppercase mb-2 ${isDarkTheme ? 'text-red-300' : 'text-red-600'}`}>Returned Item</p>
                                  <p className={`font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{sale.ReturnedItemName || (sale.ItemReturned ? `Item #${sale.ItemReturned}` : 'N/A')}</p>
                                  <div className={`flex justify-between mt-2 text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-500'}`}>
                                    <span>Qty: {sale.QtyReturned > 0 ? sale.QtyReturned : '-'}</span>
                                    <span className={`font-semibold ${isDarkTheme ? 'text-gray-200' : 'text-slate-700'}`}>Value: {currencySymbol}{parseFloat(sale.ReturnedItemPrice || 0).toFixed(2)}</span>
                                  </div>
                                </div>
                                
                                {/* Exchange Arrow */}
                                <div className={`flex items-center justify-center ${isDarkTheme ? 'text-gray-500' : 'text-slate-400'}`}>
                                  →
                                </div>

                                {/* New Item */}
                                <div className={`flex-1 border rounded-lg p-3 ${isDarkTheme ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-100'}`}>
                                  <p className={`text-xs font-bold uppercase mb-2 ${isDarkTheme ? 'text-green-300' : 'text-green-600'}`}>New Item</p>
                                  <p className={`font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                                    {sale.ItemGiven && typeof sale.ItemGiven === 'string' 
                                      ? sale.ItemGiven
                                      : 'N/A'}
                                  </p>
                                  <div className="flex justify-end mt-2 text-sm">
                                    <span className={`font-semibold ${isDarkTheme ? 'text-gray-200' : 'text-slate-700'}`}>Price: {currencySymbol}{formatNumberWithCommas(Math.floor(parseFloat(sale.ItemGivenPrice || 0)))}.{String(Math.round((parseFloat(sale.ItemGivenPrice || 0) % 1) * 100)).padStart(2, '0')}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className={`flex justify-end pt-3 border-t ${isDarkTheme ? 'border-amber-700' : 'border-amber-200'}`}>
                                <div className="text-right">
                                  <p className={`text-xs uppercase font-bold ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Additional Payment</p>
                                  <p className={`text-xl font-extrabold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{currencySymbol}{formatNumberWithCommas(Math.floor(parseFloat(sale.AdditionalPayment || 0)))}.{String(Math.round((parseFloat(sale.AdditionalPayment || 0) % 1) * 100)).padStart(2, '0')}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Expanded Product Details for Sales */}
                          {isExpanded && !isExchange && (
                            <div className={`p-4 border-t ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-100'}`}>
                              <div className="mb-3">
                                <p className={`text-sm font-semibold mb-2 ${isDarkTheme ? 'text-gray-200' : 'text-gray-700'}`}>Products in this transaction:</p>
                              </div>
                              {loadingSaleItems[sale.SaleID] ? (
                                <div className={`py-4 text-center ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>Loading products...</div>
                              ) : (saleItems[sale.SaleID] || sale.items || []).length > 0 ? (
                                <>
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className={`border-b ${isDarkTheme ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-200'}`}>
                                        <th className={`text-left py-2 px-3 font-semibold ${isDarkTheme ? 'text-gray-200' : 'text-gray-600'}`}>Product Name</th>
                                        <th className={`text-left py-2 px-3 font-semibold ${isDarkTheme ? 'text-gray-200' : 'text-gray-600'}`}>Code</th>
                                        <th className={`text-center py-2 px-3 font-semibold ${isDarkTheme ? 'text-gray-200' : 'text-gray-600'}`}>Qty</th>
                                        <th className={`text-right py-2 px-3 font-semibold ${isDarkTheme ? 'text-gray-200' : 'text-gray-600'}`}>Unit Price</th>
                                        <th className={`text-right py-2 px-3 font-semibold ${isDarkTheme ? 'text-gray-200' : 'text-gray-600'}`}>Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(saleItems[sale.SaleID] || sale.items || []).map((item: any, idx: number) => (
                                        <tr key={idx} className={`border-b transition-colors ${isDarkTheme ? 'border-gray-600 hover:bg-gray-600' : 'border-gray-100 hover:bg-white'}`}>
                                          <td className={`py-2 px-3 font-medium ${isDarkTheme ? 'text-gray-200' : 'text-gray-800'}`}>{item.ProductName || item.Particulars}</td>
                                          <td className={`py-2 px-3 ${isDarkTheme ? 'text-gray-300' : 'text-gray-600'}`}>{item.ProductCode}</td>
                                          <td className={`py-2 px-3 text-center ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>{item.QuantitySold}</td>
                                          <td className={`py-2 px-3 text-right ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>{currencySymbol}{formatNumberWithCommas(Math.floor(parseFloat(item.SellingPrice)))}.{String(Math.round((parseFloat(item.SellingPrice) % 1) * 100)).padStart(2, '0')}</td>
                                          <td className={`py-2 px-3 text-right font-semibold ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>{currencySymbol}{formatNumberWithCommas(Math.floor(parseFloat(item.TotalAmountSold)))}.{String(Math.round((parseFloat(item.TotalAmountSold) % 1) * 100)).padStart(2, '0')}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  <div className={`mt-3 flex justify-end gap-8 text-sm border-t pt-3 ${isDarkTheme ? 'border-gray-600' : 'border-gray-200'}`}>
                                    <div>
                                      <p className={isDarkTheme ? 'text-gray-400' : 'text-gray-600'}>Subtotal:</p>
                                      <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>{currencySymbol}{formatNumberWithCommas(Math.floor(totalAmount))}.{String(Math.round((totalAmount % 1) * 100)).padStart(2, '0')}</p>
                                    </div>
                                    <div>
                                      <p className={isDarkTheme ? 'text-gray-400' : 'text-gray-600'}>Discount:</p>
                                      <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>{currencySymbol}{formatNumberWithCommas(Math.floor(discount))}.{String(Math.round((discount % 1) * 100)).padStart(2, '0')}</p>
                                    </div>
                                    <div>
                                      <p className={isDarkTheme ? 'text-gray-400' : 'text-gray-600'}>Total:</p>
                                      <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>{currencySymbol}{formatNumberWithCommas(Math.floor(finalAmount))}.{String(Math.round((finalAmount % 1) * 100)).padStart(2, '0')}</p>
                                    </div>
                                    <div>
                                      <p className={isDarkTheme ? 'text-gray-400' : 'text-gray-600'}>Cash Received:</p>
                                      <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>{currencySymbol}{formatNumberWithCommas(Math.floor(cashReceived))}.{String(Math.round((cashReceived % 1) * 100)).padStart(2, '0')}</p>
                                    </div>
                                    <div>
                                      <p className={isDarkTheme ? 'text-gray-400' : 'text-gray-600'}>Change Given:</p>
                                      <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>{currencySymbol}{formatNumberWithCommas(Math.floor(changeGiven))}.{String(Math.round((changeGiven % 1) * 100)).padStart(2, '0')}</p>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className={`py-4 text-center ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>No products found for this transaction</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })() : (
                <div className="py-16 text-center text-gray-400">
                  <Receipt className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">No POS sales found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Error Modal - Rendered via Portal */}
      <ErrorModal
        isOpen={showErrorModal}
        errorCode={errorModalCode}
        title={errorModalTitle}
        message={errorModalMessage}
        onClose={() => setShowErrorModal(false)}
      />
    </div>
  );
};

export default Dashboard;