
import React, { useState, useEffect } from 'react';
import { usePharmacy } from '../context/PharmacyContext';
import apiClient from '../lib/apiClient';
import ErrorModal from '../components/ErrorModal';
import { TrendingUp, TrendingDown, Plus, Minus } from 'lucide-react';

const InventoryOverview: React.FC = () => {
  const { currencySymbol, user } = usePharmacy();
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
    addedItems: [],
    removedItems: [],
    damagedItems: []
  });

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
      const changeItemsResponse = await apiClient.getChangeItemHistory();

      if (stockResponse.success && damagedResponse.success) {
        const stocks = stockResponse.data || [];
        const damaged = damagedResponse.data || [];
        const sales = salesResponse.success ? (salesResponse.data || []) : [];
        const changeItems = changeItemsResponse.success ? (changeItemsResponse.data || []) : [];

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
        let weeklySales = [0, 0, 0, 0]; // Array to store sales for 4 weeks
        
        if (sales && Array.isArray(sales)) {
          sales.forEach((sale: any) => {
            const saleDate = normalizeDate(sale.TransactionDate || sale.Date);
            
            // Check if sale is within current month (with proper timezone handling)
            if (saleDate >= monthStart && saleDate <= today) {
              totalStockSold += sale.QuantitySold || 0;
              totalSoldPrice += sale.TotalAmountSold || 0;
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
            }
          });
        }
        
        // Update chart data state - Sales
        setWeeklySalesData([...weeklySales]);

        let addedItems: any[] = [];
        let removedItems: any[] = [];
        let totalRemovedPrice = 0;
        let weeklyAdded = [0, 0, 0, 0]; // Array to store added items for 4 weeks
        let weeklyRemoved = [0, 0, 0, 0]; // Array to store removed items for 4 weeks
        
        changeItems.forEach((item: any) => {
          const changeDate = normalizeDate(item.DateProcessed || item.Date);
          
          // Check if change is within current month
          if (changeDate >= monthStart && changeDate <= today) {
            const reason = (item.Reason || '').toLowerCase();
            const type = (item.Type || '').toLowerCase();
            
            // Calculate which week this change belongs to
            const dayOfMonth = changeDate.getDate();
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
            
            if (reason.includes('add') || reason.includes('restock') || reason.includes('addition') || type === 'add') {
              totalStockAdded += item.QtyGiven || 0;
              weeklyAdded[weekIndex] += item.QtyGiven || 0;
              addedItems.push(item);
            } else if (reason.includes('remove') || reason.includes('damage') || reason.includes('removal') || type === 'remove') {
              totalStockRemoved += item.QtyReturned || 0;
              totalRemovedPrice += (item.QtyReturned || 0) * (item.ReturnedItemPrice || 0);
              weeklyRemoved[weekIndex] += item.QtyReturned || 0;
              removedItems.push(item);
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
          damagedItems: damaged
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
        data = inventoryDetails.addedItems || [];
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center md:hidden">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800">Inventory Monitoring</h2>
          <p className="text-slate-500 font-medium">Stock Level and Expiry Tracking</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <span>{error}</span>
          <button onClick={fetchData} className="ml-auto underline font-bold text-sm">Retry</button>
        </div>
      )}

      {/* Transaction Overview This Month */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 mb-4 uppercase tracking-wider">Transaction Overview This Month</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Stock Sold */}
          <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] p-6 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleMetricClick('sold')}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Total Stock Sold</h4>
              <div className="bg-blue-100 p-2 rounded-lg">
                <TrendingDown size={18} className="text-blue-600" />
              </div>
            </div>
            <div className="h-40 relative bg-gradient-to-b from-blue-50 to-white rounded-lg overflow-hidden border border-blue-100">
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
            <p className="text-3xl font-bold text-blue-600 mt-4">{currencySymbol}{stats.totalSoldPrice.toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-1">Total sales this month</p>
          </div>

          {/* Total Stock Added */}
          <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] p-6 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleMetricClick('added')}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Total Stock Added</h4>
              <div className="bg-green-100 p-2 rounded-lg">
                <Plus size={18} className="text-green-600" />
              </div>
            </div>
            <div className="h-40 relative bg-gradient-to-b from-green-50 to-white rounded-lg overflow-hidden border border-green-100">
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
            <p className="text-3xl font-bold text-green-600 mt-4">{stats.totalStockAdded}</p>
            <p className="text-xs text-slate-500 mt-1">Items added this month</p>
          </div>

          {/* Total Stock Removed */}
          <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] p-6 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleMetricClick('removed')}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Total Stock Removed</h4>
              <div className="bg-red-100 p-2 rounded-lg">
                <Minus size={18} className="text-red-600" />
              </div>
            </div>
            <div className="h-40 relative bg-gradient-to-b from-red-50 to-white rounded-lg overflow-hidden border border-red-100">
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
            <p className="text-3xl font-bold text-red-600 mt-4">{currencySymbol}{stats.totalRemovedPrice.toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-1">Total removed this month</p>
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-lg font-bold text-slate-800 mb-4 uppercase tracking-wider">Inventory Monitoring</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Batches with Low Stock */}
          <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] p-6 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleMetricClick('lowStock')}>
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4">Batches with Low Stock</h4>
            <div className="h-40 flex items-end justify-center gap-8">
              <div className="text-center">
                <div className="w-12 h-8 bg-red-300 rounded-md mx-auto"></div>
                <p className="text-xs text-slate-500 mt-2">Critical</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-16 bg-yellow-400 rounded-md mx-auto"></div>
                <p className="text-xs text-slate-500 mt-2">Warning</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-32 bg-green-500 rounded-md mx-auto"></div>
                <p className="text-xs text-slate-500 mt-2">Normal</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-800 mt-4">{stats.lowStockCount}</p>
          </div>

          {/* Batches About to Expire */}
          <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] p-6 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleMetricClick('expiringSoon')}>
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4">Batches About to Expire</h4>
            <div className="h-40 flex items-center justify-center">
              <div className="w-20 h-32 bg-yellow-300 rounded-md"></div>
            </div>
            <p className="text-2xl font-bold text-slate-800 mt-4">{stats.aboutToExpireCount}</p>
          </div>

          {/* Expired Batches */}
          <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] p-6 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleMetricClick('expired')}>
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4">Expired Batches</h4>
            <div className="h-40 flex items-center justify-center">
              <div className="w-24 h-32 bg-red-500 rounded-md"></div>
            </div>
            <p className="text-2xl font-bold text-red-600 mt-4">{stats.expiredCount}</p>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {selectedMetric && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30 p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-5 duration-500">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-800 uppercase">
                  {selectedMetric === 'lowStock' && 'Low Stock Items'}
                  {selectedMetric === 'expired' && 'Expired Items'}
                  {selectedMetric === 'expiringSoon' && 'Items Expiring Soon'}
                  {selectedMetric === 'sold' && 'Stock Sold This Month'}
                  {selectedMetric === 'added' && 'Stock Added This Month'}
                  {selectedMetric === 'removed' && 'Stock Removed This Month'}
                  {selectedMetric === 'damaged' && 'Damaged Items'}
                </h3>
                <div className="flex gap-6 mt-2">
                  <p className="text-sm text-slate-600">
                    Total Items: <span className="font-semibold text-slate-800">{detailData.length}</span>
                  </p>
                  {selectedMetric !== 'removed' && (
                    <p className="text-sm text-slate-600">
                      Total Quantity: <span className="font-semibold text-slate-800">
                        {detailData.reduce((sum: number, item: any) => {
                          if (selectedMetric === 'sold') {
                            return sum + (item.QuantitySold || 0);
                          } else if (selectedMetric === 'added') {
                            return sum + (item.QtyGiven || 0);
                          } else if (selectedMetric === 'removed') {
                            return sum + (item.QtyReturned || 0);
                          } else if (selectedMetric === 'damaged') {
                            return sum + (item.QuantityDamaged || item.Quantity || 0);
                          } else {
                            return sum + (item.totalQuantity || 0);
                          }
                        }, 0)}
                      </span>
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedMetric(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {detailData.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No data to display</p>
              ) : (
                <div className="space-y-3 max-h-[calc(80vh-150px)] overflow-y-auto">
                  {detailData.map((item: any, index: number) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition">
                      {/* Low Stock Items */}
                      {(selectedMetric === 'lowStock' || selectedMetric === 'expired' || selectedMetric === 'expiringSoon') && (
                        <div>
                          <p className="font-bold text-slate-800">{item.Particulars || item.ProductCode}</p>
                          <p className="text-sm text-slate-600 mt-1">
                            Current Quantity: <span className="font-semibold">{item.totalQuantity}</span> / Reorder Level: <span className="font-semibold">{item.reorderLevel}</span>
                          </p>
                          {item.type === 'expired' && (
                            <p className="text-sm text-red-600 mt-1">Expired: {item.count} batch(es)</p>
                          )}
                          {item.type === 'expiring_soon' && (
                            <p className="text-sm text-amber-600 mt-1">Expiring Soon: {item.count} batch(es)</p>
                          )}
                          <p className="text-sm text-slate-500 mt-2">Total Value: {currencySymbol}{item.totalValue.toFixed(2)}</p>
                        </div>
                      )}

                      {/* Sold Items */}
                      {selectedMetric === 'sold' && (
                        <div>
                          <p className="font-bold text-slate-800">{item.ProductName || item.ProductCode}</p>
                          <p className="text-sm text-slate-600 mt-1">
                            Quantity Sold: <span className="font-semibold">{item.QuantitySold || item.Quantity}</span>
                          </p>
                          <p className="text-sm text-slate-600">Unit Price: {currencySymbol}{item.SellingPrice?.toFixed(2) || 'N/A'}</p>
                          <p className="text-sm text-slate-600">Total Amount: {currencySymbol}{item.TotalAmountSold?.toFixed(2) || 'N/A'}</p>
                          <p className="text-sm text-slate-500 mt-2">Date: {new Date(item.TransactionDate || item.Date).toLocaleDateString()}</p>
                        </div>
                      )}

                      {/* Added/Removed Items */}
                      {(selectedMetric === 'added' || selectedMetric === 'removed') && (
                        <div>
                          <p className="font-bold text-slate-800">Item #{item.ChangeID || index + 1}</p>
                          <p className="text-sm text-slate-600 mt-1">
                            {selectedMetric === 'added' ? 'Quantity Added' : 'Quantity Removed'}: <span className="font-semibold">{item.QtyGiven || item.QtyReturned || 0}</span>
                          </p>
                          <p className="text-sm text-slate-600">Item: {item.ItemGiven || item.ItemReturned || 'N/A'}</p>
                          <p className="text-sm text-slate-600">Reason: {item.Reason || 'N/A'}</p>
                          <p className="text-sm text-slate-500 mt-2">Date: {new Date(item.DateProcessed || new Date()).toLocaleDateString()}</p>
                        </div>
                      )}

                      {/* Damaged Items */}
                      {selectedMetric === 'damaged' && (
                        <div>
                          <p className="font-bold text-slate-800">Damage ID: {item.DamageID || item.DamagID}</p>
                          <p className="text-sm text-slate-600 mt-1">
                            Quantity Damaged: <span className="font-semibold">{item.QuantityDamaged || item.Quantity}</span>
                          </p>
                          <p className="text-sm text-slate-600">Reason: {item.Reason || 'N/A'}</p>
                          <p className="text-sm text-slate-500 mt-2">Date: {new Date(item.DateReported || new Date()).toLocaleDateString()}</p>
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

