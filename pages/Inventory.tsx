
import React, { useState, useEffect } from 'react';
import { usePharmacy } from '../context/PharmacyContext';
import apiClient from '../lib/apiClient';
import ErrorModal from '../components/ErrorModal';
import { TrendingUp, TrendingDown, Plus, Minus, Search, X, List, Grid3X3 } from 'lucide-react';

const InventoryOverview: React.FC = () => {
  const { currencySymbol, user, themeColor } = usePharmacy();
  const isDarkTheme = themeColor === 'black';
  const isPharmacyAssistant = user?.role === 'pharmacy_assistant';
  const [stats, setStats] = useState<any>({
    totalStockQuantity: 0,
    totalDamagedItems: 0,
    lowStockCount: 0,
    aboutToExpireCount: 0,
    expiredCount: 0,
    totalValue: 0,
    totalStockSold: 0,
    totalStockAdded: 0,
    totalStockRemoved: 0,
    totalSoldPrice: 0,
    totalRemovedPrice: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any[]>([]);
  
  // Error Modal States
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalCode, setErrorModalCode] = useState('');
  const [errorModalTitle, setErrorModalTitle] = useState('');
  const [errorModalMessage, setErrorModalMessage] = useState('');
  
  // Chart data state for real-time updates
  const [weeklySalesData, setWeeklySalesData] = useState<number[]>([0, 0, 0, 0]);
  const [weeklyAddedData, setWeeklyAddedData] = useState<number[]>([0, 0, 0, 0]);
  const [weeklyRemovedData, setWeeklyRemovedData] = useState<number[]>([0, 0, 0, 0]);
  
  // Detail data cache for modal
  const [inventoryDetails, setInventoryDetails] = useState<any>({
    lowStockItems: [],
    expiredItems: [],
    expiringSoonItems: [],
    soldItems: [],
    addedItems: [], // Stock entries added this month
    removedItems: [],
    damagedItems: []
  });

  // Filter state for Recent Inventory Movements
  const [movementFilters, setMovementFilters] = useState<Set<string>>(new Set(['sale', 'damage', 'change']));
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [movementSearchTerm, setMovementSearchTerm] = useState<string>(''); // 'all', 'today', 'week', 'month'
  const [movementViewMode, setMovementViewMode] = useState<'list' | 'grid'>('list');

  useEffect(() => {
    fetchData();
    // Set up auto-refresh every 5 seconds for real-time updates
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch stock entries to calculate stats
      const stockResponse = await apiClient.getStockEntries();
      const damagedResponse = await apiClient.getDamagedItems();
      const salesResponse = await apiClient.getSales();
      const inventoryTransactionsResponse = await apiClient.getInventoryTransactions(100);

      if (stockResponse.success && damagedResponse.success) {
        const stocks = stockResponse.data || [];
        const damaged = damagedResponse.data || [];
        const sales = salesResponse.success ? (salesResponse.data || []) : [];
        const inventoryTransactions = inventoryTransactionsResponse.success ? (inventoryTransactionsResponse.data || []) : [];

        // Get current date and month range with better timezone handling
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0); // Start of month

        // Helper function to normalize date for comparison
        const normalizeDate = (dateStr: any) => {
          if (!dateStr) return new Date(0);
          const date = new Date(dateStr);
          // If date is invalid, try parsing as string
          if (isNaN(date.getTime())) {
            return new Date(0);
          }
          return date;
        };

        // Calculate stats
        let lowStock = 0;
        let expiredCount = 0;
        let aboutToExpire = 0;
        let totalQuantity = 0;
        let totalValue = 0;
        let totalStockSold = 0;
        let totalStockAdded = 0;
        let totalStockRemoved = 0;

        // Process stock entries - group by ProductID to get total quantity and check status
        const stockByProduct: { [key: number]: any } = {};
        stocks.forEach((stock: any) => {
          const productId = stock.ProductID;
          const quantity = stock.Quantity || 0;
          const price = stock.SellingPrice || 0;
          
          if (!stockByProduct[productId]) {
            stockByProduct[productId] = {
              ProductID: productId,
              Particulars: stock.Particulars,
              ProductCode: stock.ProductCode,
              totalQuantity: 0,
              totalValue: 0,
              reorderLevel: stock.ReorderLevel || 10,
              expiredBatches: 0,
              expiringSoonBatches: 0,
              batches: []
            };
          }
          
          stockByProduct[productId].totalQuantity += quantity;
          stockByProduct[productId].totalValue += quantity * price;
          stockByProduct[productId].batches.push(stock);

          // Expiration date checks
          if (stock.ExpirationDate) {
            const expiryDate = normalizeDate(stock.ExpirationDate);
            expiryDate.setHours(0, 0, 0, 0);

            const todayForComparison = new Date(today);
            todayForComparison.setHours(0, 0, 0, 0);

            if (expiryDate < todayForComparison) {
              // Already expired
              stockByProduct[productId].expiredBatches++;
              expiredCount++;
            } else {
              // Check if expiring within 30 days
              const thirtyDaysFromNow = new Date(todayForComparison);
              thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
              
              if (expiryDate <= thirtyDaysFromNow) {
                stockByProduct[productId].expiringSoonBatches++;
                aboutToExpire++;
              }
            }
          }
        });

        // Calculate totals and low stock count from grouped data
        const lowStockItems: any[] = [];
        const expiredItems: any[] = [];
        const expiringSoonItems: any[] = [];

        Object.values(stockByProduct).forEach((product: any) => {
          totalQuantity += product.totalQuantity;
          totalValue += product.totalValue;
          
          // Low stock check (less than reorder level)
          if (product.totalQuantity < product.reorderLevel && product.totalQuantity > 0) {
            lowStock++;
            lowStockItems.push(product);
          }

          // Track expired and expiring items - calculate value for only those batches
          if (product.expiredBatches > 0) {
            let expiredValue = 0;
            let expiredQuantity = 0;
            product.batches.forEach((batch: any) => {
              if (batch.ExpirationDate) {
                const expiryDate = normalizeDate(batch.ExpirationDate);
                expiryDate.setHours(0, 0, 0, 0);
                const todayForComparison = new Date(today);
                todayForComparison.setHours(0, 0, 0, 0);
                
                if (expiryDate < todayForComparison) {
                  expiredQuantity += batch.Quantity || 0;
                  expiredValue += (batch.Quantity || 0) * (batch.SellingPrice || 0);
                }
              }
            });
            expiredItems.push({ 
              ...product, 
              type: 'expired', 
              count: product.expiredBatches,
              totalQuantity: expiredQuantity,
              totalValue: expiredValue
            });
          }
          if (product.expiringSoonBatches > 0) {
            let expiringSoonValue = 0;
            let expiringSoonQuantity = 0;
            const thirtyDaysFromNow = new Date(today);
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
            const todayForComparison = new Date(today);
            todayForComparison.setHours(0, 0, 0, 0);
            
            product.batches.forEach((batch: any) => {
              if (batch.ExpirationDate) {
                const expiryDate = normalizeDate(batch.ExpirationDate);
                expiryDate.setHours(0, 0, 0, 0);
                if (expiryDate > todayForComparison && expiryDate <= thirtyDaysFromNow) {
                  expiringSoonQuantity += batch.Quantity || 0;
                  expiringSoonValue += (batch.Quantity || 0) * (batch.SellingPrice || 0);
                }
              }
            });
            expiringSoonItems.push({ 
              ...product, 
              type: 'expiring_soon', 
              count: product.expiringSoonBatches,
              totalQuantity: expiringSoonQuantity,
              totalValue: expiringSoonValue
            });
          }
        });

        // Calculate transaction metrics for this month
        let soldItems: any[] = [];
        let totalSoldPrice = 0;
        let totalRemovedPrice = 0;
        let weeklySales = [0, 0, 0, 0]; // Array to store sales for 4 weeks (kept for sales revenue tracking only)
        let weeklyRemoved = [0, 0, 0, 0]; // Array to store removed items for 4 weeks
        
        if (sales && Array.isArray(sales)) {
          sales.forEach((sale: any) => {
            const saleDate = normalizeDate(sale.TransactionDate || sale.Date);
            
            // Check if sale is within current month (with proper timezone handling)
            if (saleDate >= monthStart && saleDate <= today) {
              const quantitySold = sale.QuantitySold || 0;
              totalStockRemoved += quantitySold; // Add to total removed
              totalSoldPrice += sale.TotalAmountSold || 0;
              totalRemovedPrice += sale.TotalAmountSold || 0; // Add to removed price
              soldItems.push(sale);
              
              // Calculate which week this sale belongs to
              const dayOfMonth = saleDate.getDate();
              let weekIndex = 0;
              if (dayOfMonth <= 7) {
                weekIndex = 0;
              } else if (dayOfMonth <= 14) {
                weekIndex = 1;
              } else if (dayOfMonth <= 21) {
                weekIndex = 2;
              } else {
                weekIndex = 3;
              }
              weeklySales[weekIndex] += sale.TotalAmountSold || 0;
              weeklyRemoved[weekIndex] += quantitySold; // Add to weekly removed
            }
          });
        }
        
        // Update chart data state - Sales
        setWeeklySalesData([...weeklySales]);

        let addedItems: any[] = [];
        let removedItems: any[] = [];
        let damagedTransactionItems: any[] = [];
        let weeklyAdded = [0, 0, 0, 0]; // Array to store added items for 4 weeks
        
        // Track stock entries added this month for metrics
        stocks.forEach((stock: any) => {
          const dateAdded = normalizeDate(stock.DateAdded);
          
          // Check if stock entry was added within current month
          if (dateAdded >= monthStart && dateAdded <= today) {
            const quantity = stock.Quantity || 0;
            const sellingPrice = stock.SellingPrice || 0;
            const itemTotal = quantity * sellingPrice; // Calculate total value of items added
            totalStockAdded += itemTotal; // Sum the selling price, not quantity
            
            // Calculate which week this stock entry belongs to
            const dayOfMonth = dateAdded.getDate();
            let weekIndex = 0;
            if (dayOfMonth <= 7) {
              weekIndex = 0;
            } else if (dayOfMonth <= 14) {
              weekIndex = 1;
            } else if (dayOfMonth <= 21) {
              weekIndex = 2;
            } else {
              weekIndex = 3;
            }
            
            weeklyAdded[weekIndex] += itemTotal; // Track value added per week
            
            // Add to detail items with only necessary fields
            addedItems.push({
              StockEntryID: stock.StockEntryID,
              ProductID: stock.ProductID,
              Particulars: stock.Particulars,
              ProductCode: stock.ProductCode,
              Quantity: quantity,
              DateAdded: stock.DateAdded,
              BatchNumber: stock.BatchNumber,
              ExpirationDate: stock.ExpirationDate
            });
          }
        });
        
        // Create a map of ProductID to SellingPrice for quick lookup
        const productPriceMap: { [key: number]: number } = {};
        stocks.forEach((stock: any) => {
          if (!productPriceMap[stock.ProductID]) {
            productPriceMap[stock.ProductID] = stock.SellingPrice || 0;
          }
        });
        
        // Process inventory transactions for removals, sales, damages, and exchanges
        inventoryTransactions.forEach((item: any) => {
          const transactionDate = normalizeDate(item.DateAdded);
          
          // Check if transaction is within current month
          if (transactionDate >= monthStart && transactionDate <= today) {
            const transactionType = (item.TransactionType || '').toUpperCase();
            const quantity = item.Quantity || item.QuantitySold || item.QuantityDamaged || 0;
            const sellingPrice = productPriceMap[item.ProductID] || item.SellingPrice || 0;
            
            // Calculate which week this transaction belongs to
            const dayOfMonth = transactionDate.getDate();
            let weekIndex = 0;
            if (dayOfMonth <= 7) {
              weekIndex = 0;
            } else if (dayOfMonth <= 14) {
              weekIndex = 1;
            } else if (dayOfMonth <= 21) {
              weekIndex = 2;
            } else {
              weekIndex = 3;
            }
            
            if (transactionType === 'REMOVAL' || transactionType === 'REMOVE') {
              totalStockRemoved += quantity;
              weeklyRemoved[weekIndex] += quantity;
              totalRemovedPrice += (quantity * sellingPrice);
              removedItems.push({
                ...item,
                SellingPrice: sellingPrice
              });
            } else if (transactionType === 'EXCHANGE_REPLACEMENT') {
              // Replacement items given to customer (treat as REMOVAL)
              totalStockRemoved += quantity;
              weeklyRemoved[weekIndex] += quantity;
              totalRemovedPrice += (quantity * sellingPrice);
              removedItems.push({
                ...item,
                TransactionType: 'REMOVAL',
                ReasonPrefix: '🔄 Exchange Given - ',
                SellingPrice: sellingPrice
              });
            } else if (transactionType === 'DAMAGE') {
              // Damages remove items from inventory
              totalStockRemoved += quantity;
              weeklyRemoved[weekIndex] += quantity;
              totalRemovedPrice += (quantity * sellingPrice);
              damagedTransactionItems.push({
                ...item,
                SellingPrice: sellingPrice
              });
              removedItems.push({
                ...item,
                TransactionType: 'REMOVAL',
                ReasonPrefix: '⚠️ Damage - ',
                SellingPrice: sellingPrice
              });
            } else if (transactionType === 'EXCHANGE_RETURN') {
              // Exchange returns display in movements table only, not in metrics or modal
              // Do nothing here
            }
          }
        });
        
        // Update chart data state - Added & Removed
        setWeeklyAddedData([...weeklyAdded]);
        setWeeklyRemovedData([...weeklyRemoved]);

        const totalDamaged = damaged.reduce((sum: number, d: any) => sum + (d.QuantityDamaged || d.Quantity || 0), 0);

        // Update inventory details state for modal
        setInventoryDetails({
          lowStockItems,
          expiredItems,
          expiringSoonItems,
          soldItems,
          addedItems,
          removedItems,
          damagedItems: damagedTransactionItems.length > 0 ? damagedTransactionItems : damaged
        });

        // Update all stats at once
        setStats({
          totalStockQuantity: totalQuantity,
          totalDamagedItems: totalDamaged,
          lowStockCount: lowStock,
          aboutToExpireCount: aboutToExpire,
          expiredCount: expiredCount,
          totalValue: totalValue,
          totalStockSold: totalStockSold,
          totalStockAdded: totalStockAdded,
          totalStockRemoved: totalStockRemoved,
          totalSoldPrice: totalSoldPrice,
          totalRemovedPrice: totalRemovedPrice
        });
      } else {
        setErrorModalCode('inv001');
        setErrorModalTitle('Failed to Load Data');
        setErrorModalMessage('Unable to load inventory data. Please try again.');
        setShowErrorModal(true);
      }
    } catch (err: any) {
      setErrorModalCode('err002');
      setErrorModalTitle('Connection Error');
      setErrorModalMessage(err.message || 'Error loading inventory data. Please check your connection.');
      setShowErrorModal(true);
      console.error('Inventory fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMetricClick = (metric: string) => {
    let data: any[] = [];

    switch (metric) {
      case 'lowStock':
        data = inventoryDetails.lowStockItems || [];
        break;
      case 'expired':
        data = inventoryDetails.expiredItems || [];
        break;
      case 'expiringSoon':
        data = inventoryDetails.expiringSoonItems || [];
        break;
      case 'sold':
        data = inventoryDetails.soldItems || [];
        break;
      case 'added':
        // Only show manual stock additions, exclude exchange returns
        data = (inventoryDetails.addedItems || []).filter((item: any) => !item.ReasonPrefix);
        break;
      case 'removed':
        data = inventoryDetails.removedItems || [];
        break;
      case 'damaged':
        data = inventoryDetails.damagedItems || [];
        break;
      default:
        data = [];
    }

    setDetailData(data);
    setSelectedMetric(metric);
  };

  // Helper function to get movement type from item
  const getMovementType = (item: any): string => {
    if (item.TransactionType?.includes('EXCHANGE')) {
      return 'change';
    }
    if (item.QuantityDamaged || item.TransactionType === 'DAMAGE') {
      return 'damage';
    }
    if (item.QuantitySold || item.TransactionType === 'SALE') {
      return 'sale';
    }
    return 'other';
  };

  // Helper function to check if item matches date filter
  const matchesDateFilter = (itemDate: string): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const itemDateTime = new Date(itemDate);
    itemDateTime.setHours(0, 0, 0, 0);
    
    if (dateFilter === 'today') {
      return itemDateTime.getTime() === today.getTime();
    }
    
    if (dateFilter === 'week') {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      return itemDateTime >= weekStart && itemDateTime <= today;
    }
    
    if (dateFilter === 'month') {
      return itemDateTime.getMonth() === today.getMonth() && itemDateTime.getFullYear() === today.getFullYear();
    }
    
    return true; // 'all'
  };

  // Get filtered movements
  const getFilteredMovements = () => {
    const allMovements: any[] = [];
    
    // Add all movement types with their type identifier
    inventoryDetails.damagedItems?.forEach((item: any) => {
      allMovements.push({ ...item, movementType: 'damage', date: item.DateAdded || item.DateReported });
    });
    
    inventoryDetails.soldItems?.forEach((item: any) => {
      allMovements.push({ ...item, movementType: 'sale', date: item.TransactionDate || item.Date });
    });
    
    inventoryDetails.addedItems?.forEach((item: any) => {
      const type = item.ReasonPrefix ? 'change' : 'other';
      if (type === 'change' || movementFilters.has('other')) {
        allMovements.push({ ...item, movementType: type, date: item.DateAdded });
      }
    });
    
    inventoryDetails.removedItems?.forEach((item: any) => {
      const type = item.ReasonPrefix ? 'change' : 'other';
      if (type === 'change' || movementFilters.has('other')) {
        allMovements.push({ ...item, movementType: type, date: item.DateAdded });
      }
    });
    
    // Filter by selected types, date, and search term
    return allMovements
      .filter(item => movementFilters.has(item.movementType))
      .filter(item => matchesDateFilter(item.date))
      .filter(item => {
        if (!movementSearchTerm.trim()) return true;
        const searchLower = movementSearchTerm.toLowerCase();
        const productName = (item.ProductName || item.ProductCode || '').toLowerCase();
        const reason = (item.Reason || '').toLowerCase();
        const code = (item.ProductCode || '').toLowerCase();
        return productName.includes(searchLower) || reason.includes(searchLower) || code.includes(searchLower);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const toggleFilter = (filterType: string) => {
    const newFilters = new Set(movementFilters);
    if (newFilters.has(filterType)) {
      newFilters.delete(filterType);
    } else {
      newFilters.add(filterType);
    }
    setMovementFilters(newFilters);
  };

  // Helper function to format numbers with thousand separators
  const formatNumber = (num: number, decimals: number = 0): string => {
    return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center md:hidden">
        <div>
          <h2 className={`text-2xl font-extrabold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Inventory Monitoring</h2>
          <p className={`font-medium ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Stock Level and Expiry Tracking</p>
        </div>
      </div>

      {error && (
        <div className={`p-4 border rounded-lg flex items-center gap-2 ${isDarkTheme ? 'bg-red-900/30 border-red-700 text-red-400' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <span>{error}</span>
          <button onClick={fetchData} className="ml-auto underline font-bold text-sm">Retry</button>
        </div>
      )}

      {/* Transaction Overview This Month */}
      <div>
        <h3 className={`text-lg font-bold mb-4 uppercase tracking-wider ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Transaction Overview This Month</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Stock Sold */}
          <div className={`rounded-xl shadow-sm border p-6 cursor-pointer hover:shadow-md transition-shadow ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`} onClick={() => handleMetricClick('sold')}>
            <div className="flex items-center justify-between mb-4">
              <h4 className={`text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Total Stock Sold</h4>
              <div className={`p-2 rounded-lg ${isDarkTheme ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
                <TrendingDown size={18} className={isDarkTheme ? 'text-blue-400' : 'text-blue-600'} />
              </div>
            </div>
            <div className={`h-40 relative rounded-lg overflow-hidden border ${isDarkTheme ? 'bg-gradient-to-b from-gray-700 to-gray-800 border-gray-700' : 'bg-gradient-to-b from-blue-50 to-white border-blue-100'}`}>
              <svg width="100%" height="100%" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid meet" className="absolute inset-0">
                <defs>
                  <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
                  </linearGradient>
                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="200" height="100" fill="url(#grid)" />
                {weeklySalesData.slice(0, Math.ceil(new Date().getDate() / 7)).length > 0 && (
                  <polygon
                    points={
                      `0,100 ` +
                      weeklySalesData
                        .slice(0, Math.ceil(new Date().getDate() / 7))
                        .map((val: number, idx: number, arr: number[]) => {
                          const maxVal = Math.max(...arr, 1);
                          const x = (idx / Math.max(arr.length - 1, 1)) * 180 + 10;
                          const y = 85 - (val / maxVal) * 70;
                          return `${x},${y}`;
                        })
                        .join(' ') +
                      ` 190,100`
                    }
                    fill="url(#chartGradient)"
                  />
                )}
                <polyline
                  points={
                    weeklySalesData
                      .slice(0, Math.ceil(new Date().getDate() / 7))
                      .map((val: number, idx: number, arr: number[]) => {
                        const maxVal = Math.max(...arr, 1);
                        const x = (idx / Math.max(arr.length - 1, 1)) * 180 + 10;
                        const y = 85 - (val / maxVal) * 70;
                        return `${x},${y}`;
                      })
                      .join(' ')
                  }
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {weeklySalesData
                  .slice(0, Math.ceil(new Date().getDate() / 7))
                  .map((val: number, idx: number, arr: number[]) => {
                    const maxVal = Math.max(...arr, 1);
                    const x = (idx / Math.max(arr.length - 1, 1)) * 180 + 10;
                    const y = 85 - (val / maxVal) * 70;
                    return (
                      <g key={idx}>
                        <circle cx={x} cy={y} r="4" fill="white" stroke="#2563eb" strokeWidth="2" />
                        <circle cx={x} cy={y} r="2.5" fill="#2563eb" />
                      </g>
                    );
                  })}
              </svg>
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-3">
              {[1, 2, 3, 4].slice(0, Math.ceil(new Date().getDate() / 7)).map((week) => (
                <span key={week}>Week {week}</span>
              ))}
            </div>
            <p className={`text-3xl font-bold mt-4 ${isDarkTheme ? 'text-blue-400' : 'text-blue-600'}`}>{currencySymbol}{formatNumber(stats.totalSoldPrice, 2)}</p>
            <p className={`text-xs mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Total sales this month</p>
          </div>

          {/* Total Stock Added */}
          <div className={`rounded-xl shadow-sm border p-6 cursor-pointer hover:shadow-md transition-shadow ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`} onClick={() => handleMetricClick('added')}>
            <div className="flex items-center justify-between mb-4">
              <h4 className={`text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Total Stock Added</h4>
              <div className={`p-2 rounded-lg ${isDarkTheme ? 'bg-green-900/30' : 'bg-green-100'}`}>
                <Plus size={18} className={isDarkTheme ? 'text-green-400' : 'text-green-600'} />
              </div>
            </div>
            <div className={`h-40 relative rounded-lg overflow-hidden border ${isDarkTheme ? 'bg-gradient-to-b from-gray-700 to-gray-800 border-gray-700' : 'bg-gradient-to-b from-green-50 to-white border-green-100'}`}>
              <svg width="100%" height="100%" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid meet" className="absolute inset-0">
                <defs>
                  <linearGradient id="chartGradientGreen" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity="0.05" />
                  </linearGradient>
                  <pattern id="gridGreen" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="200" height="100" fill="url(#gridGreen)" />
                {weeklyAddedData
                  .slice(0, Math.ceil(new Date().getDate() / 7))
                  .length > 0 && (
                  <polygon
                    points={
                      `0,100 ` +
                      weeklyAddedData
                        .slice(0, Math.ceil(new Date().getDate() / 7))
                        .map((val: number, idx: number, arr: number[]) => {
                          const maxVal = Math.max(...arr, 1);
                          const x = (idx / Math.max(arr.length - 1, 1)) * 180 + 10;
                          const y = 85 - (val / maxVal) * 70;
                          return `${x},${y}`;
                        })
                        .join(' ') +
                      ` 190,100`
                    }
                    fill="url(#chartGradientGreen)"
                  />
                )}
                <polyline
                  points={
                    weeklyAddedData
                      .slice(0, Math.ceil(new Date().getDate() / 7))
                      .map((val: number, idx: number, arr: number[]) => {
                        const maxVal = Math.max(...arr, 1);
                        const x = (idx / Math.max(arr.length - 1, 1)) * 180 + 10;
                        const y = 85 - (val / maxVal) * 70;
                        return `${x},${y}`;
                      })
                      .join(' ')
                  }
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {weeklyAddedData
                  .slice(0, Math.ceil(new Date().getDate() / 7))
                  .map((val: number, idx: number, arr: number[]) => {
                    const maxVal = Math.max(...arr, 1);
                    const x = (idx / Math.max(arr.length - 1, 1)) * 180 + 10;
                    const y = 85 - (val / maxVal) * 70;
                    return (
                      <g key={idx}>
                        <circle cx={x} cy={y} r="4" fill="white" stroke="#16a34a" strokeWidth="2" />
                        <circle cx={x} cy={y} r="2.5" fill="#16a34a" />
                      </g>
                    );
                  })}
              </svg>
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-3">
              {[1, 2, 3, 4].slice(0, Math.ceil(new Date().getDate() / 7)).map((week) => (
                <span key={week}>Week {week}</span>
              ))}
            </div>
            <p className={`text-3xl font-bold mt-4 ${isDarkTheme ? 'text-green-400' : 'text-green-600'}`}>{currencySymbol}{formatNumber(stats.totalStockAdded, 2)}</p>
            <p className={`text-xs mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Total value added this month</p>
          </div>

          {/* Total Stock Removed */}
          <div className={`rounded-xl shadow-sm border p-6 cursor-pointer hover:shadow-md transition-shadow ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`} onClick={() => handleMetricClick('removed')}>
            <div className="flex items-center justify-between mb-4">
              <h4 className={`text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Total Stock Removed</h4>
              <div className={`p-2 rounded-lg ${isDarkTheme ? 'bg-red-900/30' : 'bg-red-100'}`}>
                <Minus size={18} className={isDarkTheme ? 'text-red-400' : 'text-red-600'} />
              </div>
            </div>
            <div className={`h-40 relative rounded-lg overflow-hidden border ${isDarkTheme ? 'bg-gradient-to-b from-gray-700 to-gray-800 border-gray-700' : 'bg-gradient-to-b from-red-50 to-white border-red-100'}`}>
              <svg width="100%" height="100%" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid meet" className="absolute inset-0">
                <defs>
                  <linearGradient id="chartGradientRed" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
                  </linearGradient>
                  <pattern id="gridRed" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="200" height="100" fill="url(#gridRed)" />
                {weeklyRemovedData
                  .slice(0, Math.ceil(new Date().getDate() / 7))
                  .length > 0 && (
                  <polygon
                    points={
                      `0,100 ` +
                      weeklyRemovedData
                        .slice(0, Math.ceil(new Date().getDate() / 7))
                        .map((val: number, idx: number, arr: number[]) => {
                          const maxVal = Math.max(...arr, 1);
                          const x = (idx / Math.max(arr.length - 1, 1)) * 180 + 10;
                          const y = 85 - (val / maxVal) * 70;
                          return `${x},${y}`;
                        })
                        .join(' ') +
                      ` 190,100`
                    }
                    fill="url(#chartGradientRed)"
                  />
                )}
                <polyline
                  points={
                    weeklyRemovedData
                      .slice(0, Math.ceil(new Date().getDate() / 7))
                      .map((val: number, idx: number, arr: number[]) => {
                        const maxVal = Math.max(...arr, 1);
                        const x = (idx / Math.max(arr.length - 1, 1)) * 180 + 10;
                        const y = 85 - (val / maxVal) * 70;
                        return `${x},${y}`;
                      })
                      .join(' ')
                  }
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {weeklyRemovedData
                  .slice(0, Math.ceil(new Date().getDate() / 7))
                  .map((val: number, idx: number, arr: number[]) => {
                    const maxVal = Math.max(...arr, 1);
                    const x = (idx / Math.max(arr.length - 1, 1)) * 180 + 10;
                    const y = 85 - (val / maxVal) * 70;
                    return (
                      <g key={idx}>
                        <circle cx={x} cy={y} r="4" fill="white" stroke="#dc2626" strokeWidth="2" />
                        <circle cx={x} cy={y} r="2.5" fill="#dc2626" />
                      </g>
                    );
                  })}
              </svg>
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-3">
              {[1, 2, 3, 4].slice(0, Math.ceil(new Date().getDate() / 7)).map((week) => (
                <span key={week}>Week {week}</span>
              ))}
            </div>
            <p className={`text-3xl font-bold mt-4 ${isDarkTheme ? 'text-red-400' : 'text-red-600'}`}>{currencySymbol}{formatNumber(stats.totalRemovedPrice, 2)}</p>
            <p className={`text-xs mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Total removed this month</p>
          </div>
        </div>
      </div>
      <div>
        <h3 className={`text-lg font-bold mb-4 uppercase tracking-wider ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Inventory Monitoring</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Batches with Low Stock */}
          <div className={`rounded-xl shadow-sm border p-6 cursor-pointer hover:shadow-md transition-shadow ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`} onClick={() => handleMetricClick('lowStock')}>
            <h4 className={`text-xs font-bold uppercase tracking-wider mb-4 ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Batches with Low Stock</h4>
            <div className="h-40 flex items-end justify-center gap-8">
              <div className="text-center">
                <div className="w-12 h-8 bg-red-300 rounded-md mx-auto"></div>
                <p className={`text-xs mt-2 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Critical</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-16 bg-yellow-400 rounded-md mx-auto"></div>
                <p className={`text-xs mt-2 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Warning</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-32 bg-green-500 rounded-md mx-auto"></div>
                <p className={`text-xs mt-2 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Normal</p>
              </div>
            </div>
            <p className={`text-2xl font-bold mt-4 ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{formatNumber(stats.lowStockCount)}</p>
          </div>

          {/* Batches About to Expire */}
          <div className={`rounded-xl shadow-sm border p-6 cursor-pointer hover:shadow-md transition-shadow ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`} onClick={() => handleMetricClick('expiringSoon')}>
            <h4 className={`text-xs font-bold uppercase tracking-wider mb-4 ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Batches About to Expire</h4>
            <div className="h-40 flex items-end justify-center">
              {stats.aboutToExpireCount > 0 ? (
                <div 
                  className="w-20 bg-yellow-300 rounded-md transition-all duration-300"
                  style={{
                    height: `${(stats.aboutToExpireCount / Math.max(stats.aboutToExpireCount, 10)) * 120}px`
                  }}
                ></div>
              ) : (
                <p className={`text-sm ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>No items expiring</p>
              )}
            </div>
            <p className={`text-2xl font-bold mt-4 ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{formatNumber(stats.aboutToExpireCount)}</p>
          </div>

          {/* Expired Batches */}
          <div className={`rounded-xl shadow-sm border p-6 cursor-pointer hover:shadow-md transition-shadow ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`} onClick={() => handleMetricClick('expired')}>
            <h4 className={`text-xs font-bold uppercase tracking-wider mb-4 ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Expired Batches</h4>
            <div className="h-40 flex items-center justify-center">
              <div className="w-24 h-32 bg-red-500 rounded-md"></div>
            </div>
            <p className={`text-2xl font-bold mt-4 ${isDarkTheme ? 'text-red-400' : 'text-red-600'}`}>{formatNumber(stats.expiredCount)}</p>
          </div>
        </div>
      </div>

      {/* Recent Inventory Movements Table */}
      {!isPharmacyAssistant && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className={`text-lg font-bold uppercase tracking-wider ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Recent Inventory Movements</h3>
          </div>
          
          {/* Filter Controls - Professional Style with Search Bar - Matches Products Page */}
          <div className={`rounded-xl shadow-sm border overflow-hidden ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`}>
            {/* Toolbar */}
            <div className={`p-4 border-b ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'border-gray-100 bg-gray-50/50'}`}>
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search Input */}
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search by product name, code, or reason..."
                    value={movementSearchTerm}
                    onChange={(e) => setMovementSearchTerm(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-200 text-slate-900'}`}
                  />
                </div>

                {/* Filter Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Transaction Type Filter */}
                  <select
                    value={Array.from(movementFilters).join(',')}
                    onChange={(e) => {
                      const types = e.target.value ? e.target.value.split(',') : [];
                      setMovementFilters(new Set(types));
                    }}
                    className={`w-full sm:w-auto pl-3 pr-8 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-slate-900'}`}
                  >
                    <option value="sale,damage,change">All Types</option>
                    <option value="sale">Sale</option>
                    <option value="damage">Damage</option>
                    <option value="change">Exchange</option>
                  </select>

                  {/* Date Filter */}
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className={`w-full sm:w-auto pl-3 pr-8 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-slate-900'}`}
                  >
                    <option value="all">All Dates</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                  </select>

                  {/* Clear Filters Button */}
                  <button
                    onClick={() => {
                      setMovementSearchTerm('');
                      setMovementFilters(new Set(['sale', 'damage', 'change']));
                      setDateFilter('all');
                    }}
                    className={`px-4 py-2.5 text-sm font-semibold border rounded-lg transition-all flex items-center gap-2 ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600' : 'bg-white border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-light)]'}`}
                  >
                    <X size={16} />
                    Clear
                  </button>

                  {/* View Mode Toggle */}
                  <div className={`flex items-center gap-2 border rounded-lg p-1 ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                    <button
                      onClick={() => setMovementViewMode('list')}
                      className={`p-2 rounded transition-colors ${movementViewMode === 'list' ? 'bg-[var(--color-primary)] text-white' : 'text-gray-400 hover:text-[var(--color-text)]'}`}
                      title="List view"
                    >
                      <List size={18} />
                    </button>
                    <button
                      onClick={() => setMovementViewMode('grid')}
                      className={`p-2 rounded transition-colors ${movementViewMode === 'grid' ? 'bg-[var(--color-primary)] text-white' : 'text-gray-400 hover:text-[var(--color-text)]'}`}
                      title="Grid view"
                    >
                      <Grid3X3 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`rounded-xl shadow-sm border overflow-hidden ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`}>
            {movementViewMode === 'list' ? (
              // LIST VIEW
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'border-gray-100 bg-gray-50/50'}`}>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Date</th>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Type</th>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Item</th>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Reason</th>
                      <th className={`px-4 py-3 text-right text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredMovements().length > 0 ? (
                      getFilteredMovements().slice(0, 10).map((item: any, idx: number) => {
                        let badge = '';
                        let badgeColor = '';
                        let quantityColor = '';
                        let quantitySymbol = '';

                        if (item.movementType === 'damage') {
                          badge = 'Damaged';
                          badgeColor = isDarkTheme ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-800';
                          quantityColor = isDarkTheme ? 'text-orange-400' : 'text-orange-600';
                          quantitySymbol = '-';
                        } else if (item.movementType === 'sale') {
                          badge = 'Sale';
                          badgeColor = isDarkTheme ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-800';
                          quantityColor = isDarkTheme ? 'text-blue-400' : 'text-blue-600';
                          quantitySymbol = '-';
                        } else if (item.movementType === 'change') {
                          badge = 'Exchange';
                          badgeColor = isDarkTheme ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-800';
                          quantityColor = isDarkTheme ? 'text-purple-400' : 'text-purple-600';
                          quantitySymbol = item.ReasonPrefix?.includes('Return') ? '+' : '-';
                        }

                        return (
                          <tr key={`${item.movementType}-${idx}`} className={`border-b transition ${isDarkTheme ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                            <td className={`px-4 py-3 whitespace-nowrap text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>
                              {new Date(item.date || new Date()).toLocaleDateString()}
                            </td>
                            <td className={`px-4 py-3 whitespace-nowrap`}>
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badgeColor}`}>
                                {badge}
                              </span>
                            </td>
                            <td className={`px-4 py-3 text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>
                              <p className="font-medium">{item.ProductName || item.ProductCode || 'N/A'}</p>
                            </td>
                            <td className={`px-4 py-3 text-sm ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
                              <p className="text-xs">{item.Reason || 'No reason specified'}</p>
                            </td>
                            <td className={`px-4 py-3 text-right whitespace-nowrap text-sm font-semibold ${quantityColor}`}>
                              {quantitySymbol}{item.QuantityDamaged || item.QuantitySold || item.Quantity || 0}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className={`px-6 py-8 text-center text-sm ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                          No movements matching selected filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              // GRID VIEW
              <div className="p-4">
                {getFilteredMovements().length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {getFilteredMovements().slice(0, 12).map((item: any, idx: number) => {
                      let badge = '';
                      let badgeColor = '';
                      let quantityColor = '';
                      let quantitySymbol = '';
                      let bgColor = '';

                      if (item.movementType === 'damage') {
                        badge = 'Damaged';
                        badgeColor = isDarkTheme ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-800';
                        quantityColor = isDarkTheme ? 'text-orange-400' : 'text-orange-600';
                        quantitySymbol = '-';
                        bgColor = isDarkTheme ? 'bg-gray-700/50' : 'bg-orange-50';
                      } else if (item.movementType === 'sale') {
                        badge = 'Sale';
                        badgeColor = isDarkTheme ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-800';
                        quantityColor = isDarkTheme ? 'text-blue-400' : 'text-blue-600';
                        quantitySymbol = '-';
                        bgColor = isDarkTheme ? 'bg-gray-700/50' : 'bg-blue-50';
                      } else if (item.movementType === 'change') {
                        badge = 'Exchange';
                        badgeColor = isDarkTheme ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-800';
                        quantityColor = isDarkTheme ? 'text-purple-400' : 'text-purple-600';
                        quantitySymbol = item.ReasonPrefix?.includes('Return') ? '+' : '-';
                        bgColor = isDarkTheme ? 'bg-gray-700/50' : 'bg-purple-50';
                      }

                      return (
                        <div key={`${item.movementType}-${idx}`} className={`p-4 rounded-lg border transition ${bgColor} ${isDarkTheme ? 'border-gray-600 hover:border-gray-500' : 'border-gray-200 hover:border-gray-300'}`}>
                          <div className="flex justify-between items-start mb-3">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badgeColor}`}>
                              {badge}
                            </span>
                            <span className={`text-2xl font-bold ${quantityColor}`}>
                              {quantitySymbol}{item.QuantityDamaged || item.QuantitySold || item.Quantity || 0}
                            </span>
                          </div>
                          <div className="mb-3">
                            <p className={`font-semibold text-sm ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                              {item.ProductName || item.ProductCode || 'N/A'}
                            </p>
                            <p className={`text-xs mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
                              {item.Reason || 'No reason specified'}
                            </p>
                          </div>
                          <p className={`text-xs ${isDarkTheme ? 'text-gray-500' : 'text-gray-500'}`}>
                            {new Date(item.date || new Date()).toLocaleDateString()}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={`py-12 text-center text-sm ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                    No movements matching selected filters
                  </div>
                )}
              </div>
            )}
            
            {getFilteredMovements().length > 0 && (
              <div className={`px-6 py-4 border-t text-right text-sm ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-50 border-gray-200 text-slate-600'}`}>
                Showing {movementViewMode === 'list' ? 'latest 10' : 'latest 12'} movements • Total matching filters: {getFilteredMovements().length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedMetric && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30 p-4 animate-in fade-in duration-300">
          <div className={`rounded-xl shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-5 duration-500 ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`sticky top-0 border-b p-6 flex justify-between items-center ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
              <div>
                <h3 className={`text-lg font-bold uppercase ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                  {selectedMetric === 'lowStock' && 'Low Stock Items'}
                  {selectedMetric === 'expired' && 'Expired Items'}
                  {selectedMetric === 'expiringSoon' && 'Items Expiring Soon'}
                  {selectedMetric === 'sold' && 'Stock Sold This Month'}
                  {selectedMetric === 'added' && 'Stock Added This Month'}
                  {selectedMetric === 'removed' && 'Stock Removed This Month'}
                  {selectedMetric === 'damaged' && 'Damaged Items'}
                </h3>
                <div className="flex gap-6 mt-2">
                  <p className={`text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>
                    Total Items: <span className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{detailData.length}</span>
                  </p>
                  {(selectedMetric === 'added' || selectedMetric === 'removed') && (
                    <p className={`text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>
                      Total Quantity: <span className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                        {detailData.reduce((sum: number, item: any) => {
                          return sum + (item.Quantity || 0);
                        }, 0)}
                      </span>
                    </p>
                  )}
                  {selectedMetric === 'sold' && (
                    <p className={`text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>
                      Total Quantity: <span className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                        {detailData.reduce((sum: number, item: any) => sum + (item.QuantitySold || 0), 0)}
                      </span>
                    </p>
                  )}
                  {selectedMetric === 'damaged' && (
                    <p className={`text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>
                      Total Quantity: <span className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                        {detailData.reduce((sum: number, item: any) => sum + (item.QuantityDamaged || item.Quantity || 0), 0)}
                      </span>
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedMetric(null)}
                className={`text-2xl ${isDarkTheme ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {detailData.length === 0 ? (
                <p className={`text-center py-8 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>No data to display</p>
              ) : (
                <div className="space-y-3 max-h-[calc(80vh-150px)] overflow-y-auto">
                  {detailData.map((item: any, index: number) => (
                    <div key={index} className={`border rounded-lg p-4 transition ${isDarkTheme ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}>
                      {/* Low Stock Items */}
                      {(selectedMetric === 'lowStock' || selectedMetric === 'expired' || selectedMetric === 'expiringSoon') && (
                        <div>
                          <p className={`font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{item.Particulars || item.ProductCode}</p>
                          <p className={`text-sm mt-1 ${isDarkTheme ? 'text-gray-200' : 'text-slate-600'}`}>
                            Current Quantity: <span className="font-semibold">{item.totalQuantity}</span> / Reorder Level: <span className="font-semibold">{item.reorderLevel}</span>
                          </p>
                          {item.type === 'expired' && (
                            <p className={`text-sm mt-1 ${isDarkTheme ? 'text-red-400' : 'text-red-600'}`}>Expired: {item.count} batch(es)</p>
                          )}
                          {item.type === 'expiring_soon' && (
                            <p className={`text-sm mt-1 ${isDarkTheme ? 'text-amber-400' : 'text-amber-600'}`}>Expiring Soon: {item.count} batch(es)</p>
                          )}
                          <p className={`text-sm mt-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-500'}`}>Total Value: {currencySymbol}{formatNumber(item.totalValue, 2)}</p>
                        </div>
                      )}

                      {/* Sold Items */}
                      {selectedMetric === 'sold' && (
                        <div>
                          <p className={`font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{item.ProductName || item.ProductCode}</p>
                          <p className={`text-sm mt-1 ${isDarkTheme ? 'text-gray-200' : 'text-slate-600'}`}>
                            Quantity Sold: <span className="font-semibold">{item.QuantitySold || item.Quantity}</span>
                          </p>
                          <p className={`text-sm ${isDarkTheme ? 'text-gray-200' : 'text-slate-600'}`}>Unit Price: {currencySymbol}{item.SellingPrice ? formatNumber(item.SellingPrice, 2) : 'N/A'}</p>
                          <p className={`text-sm ${isDarkTheme ? 'text-gray-200' : 'text-slate-600'}`}>Total Amount: {currencySymbol}{item.TotalAmountSold ? formatNumber(item.TotalAmountSold, 2) : 'N/A'}</p>
                          <p className={`text-sm mt-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-500'}`}>Date: {new Date(item.TransactionDate || item.Date).toLocaleDateString()}</p>
                        </div>
                      )}

                      {/* Added Items - Show Stock Entries Only */}
                      {selectedMetric === 'added' && (
                        <div>
                          <p className={`font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                            {item.Particulars || item.ProductCode}
                          </p>
                          <p className={`text-sm mt-1 ${isDarkTheme ? 'text-gray-200' : 'text-slate-600'}`}>
                            Quantity Added: <span className="font-semibold">{item.Quantity}</span>
                          </p>
                          <p className={`text-sm ${isDarkTheme ? 'text-gray-200' : 'text-slate-600'}`}>
                            Batch: {item.BatchNumber || 'N/A'}
                          </p>
                          <p className={`text-sm mt-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-500'}`}>
                            Date: {new Date(item.DateAdded).toLocaleDateString()}
                          </p>
                        </div>
                      )}

                      {/* Removed Items */}
                      {selectedMetric === 'removed' && (
                        <div>
                          <p className={`font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{item.ProductName || item.ProductCode || item.Particulars}</p>
                          <p className={`text-sm mt-1 ${isDarkTheme ? 'text-gray-200' : 'text-slate-600'}`}>
                            Quantity Removed: <span className="font-semibold">{item.Quantity}</span>
                          </p>
                          <p className={`text-sm ${isDarkTheme ? 'text-gray-200' : 'text-slate-600'}`}>
                            Unit Price: {currencySymbol}{formatNumber(item.SellingPrice || 0, 2)}
                          </p>
                          <p className={`text-sm ${isDarkTheme ? 'text-gray-200' : 'text-slate-600'}`}>
                            Total Value: {currencySymbol}{formatNumber((item.Quantity || 0) * (item.SellingPrice || 0), 2)}
                          </p>
                          <p className={`text-sm ${isDarkTheme ? 'text-gray-200' : 'text-slate-600'}`}>Reason: {item.Reason || 'N/A'}</p>
                          <p className={`text-sm mt-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-500'}`}>Date: {new Date(item.DateAdded).toLocaleDateString()}</p>
                        </div>
                      )}

                      {/* Damaged Items */}
                      {selectedMetric === 'damaged' && (
                        <div>
                          <p className={`font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Damage ID: {item.DamageID || item.DamagID}</p>
                          <p className={`text-sm mt-1 ${isDarkTheme ? 'text-gray-200' : 'text-slate-600'}`}>
                            Quantity Damaged: <span className="font-semibold">{item.QuantityDamaged || item.Quantity}</span>
                          </p>
                          <p className={`text-sm ${isDarkTheme ? 'text-gray-200' : 'text-slate-600'}`}>Reason: {item.Reason || 'N/A'}</p>
                          <p className={`text-sm mt-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-500'}`}>Date: {new Date(item.DateReported || new Date()).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  ))}
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

export default InventoryOverview;

