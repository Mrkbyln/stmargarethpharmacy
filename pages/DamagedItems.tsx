import React, { useState, useEffect, useCallback, memo } from 'react';
import { usePharmacy } from '../context/PharmacyContext';
import apiClient from '../lib/apiClient';
import { AlertTriangle, Check, Search, Eye, X, CheckCircle, XCircle, Trash2, Plus, Loader } from 'lucide-react';
import { createPortal } from 'react-dom';

// Memoized quantity input component to prevent unnecessary re-renders
interface QuantityInputProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

const QuantityInput = memo<QuantityInputProps>(({ value, min, max, onChange }) => {
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e) => {
        const qty = Math.min(Math.max(min, parseInt(e.target.value) || min), max);
        onChange(qty);
      }}
      className="w-16 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-red-500"
    />
  );
});

QuantityInput.displayName = 'QuantityInput';

// Memoized price input component
interface PriceInputProps {
  value: number | '';
  onChange: (value: number | '') => void;
  placeholder?: string;
  min?: number;
}

const PriceInput = memo<PriceInputProps>(({ value, onChange, placeholder = '0.00', min = 0 }) => {
  return (
    <input
      type="number"
      min={min}
      step="any"
      value={value === '' ? '' : (typeof value === 'number' ? value : parseFloat(String(value)) || '')}
      onChange={(e) => {
        const val = e.target.value;
        if (val === '' || val === '-') {
          onChange('');
        } else {
          const numVal = parseFloat(val) || 0;
          onChange(Math.max(min, numVal));
        }
      }}
      onBlur={(e) => {
        // Format the display when user leaves the field
        const val = e.currentTarget.value;
        if (val && val !== '' && val !== '-') {
          const numVal = parseFloat(val) || 0;
          const formatted = Math.max(min, numVal);
          onChange(formatted);
        }
      }}
      placeholder={placeholder}
      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
    />
  );
});

PriceInput.displayName = 'PriceInput';

const DamagedItems: React.FC = () => {
  const { currencySymbol, user } = usePharmacy();
  const [stocks, setStocks] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [damagedItems, setDamagedItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sales, setSales] = useState<any[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  
  // New modal state
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showSaleDetailsModal, setShowSaleDetailsModal] = useState(false);
  const [selectedStockItems, setSelectedStockItems] = useState<Set<number>>(new Set());
  const [itemQuantities, setItemQuantities] = useState<Record<number, number>>({});
  const [selectedReplacementProduct, setSelectedReplacementProduct] = useState<Map<number, number>>(new Map());
  const [replacementQuantity, setReplacementQuantity] = useState<Map<number, number>>(new Map());
  const [damageReason, setDamageReason] = useState('');
  const [replacementProductNote, setReplacementProductNote] = useState('');
  const [selectedReplacementProductId, setSelectedReplacementProductId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'mark' | 'history' | 'processed'>('mark');
  const [selectedSaleItems, setSelectedSaleItems] = useState<Set<number>>(new Set());
  const [saleItemQuantities, setSaleItemQuantities] = useState<Record<number, number>>({});
  const [saleItemReplacements, setSaleItemReplacements] = useState<Map<number, number>>(new Map());
  const [saleItemReplacementQty, setSaleItemReplacementQty] = useState<Map<number, number>>(new Map());
  const [damageNote, setDamageNote] = useState('');
  const [dueAmount, setDueAmount] = useState<number | ''>('');
  const [historyFilter, setHistoryFilter] = useState({
    startDate: '',
    endDate: ''
  });
  const [processedSaleIds, setProcessedSaleIds] = useState<Set<number>>(new Set());

  const clearFilters = () => {
    setSearchTerm('');
    setHistoryFilter({ startDate: '', endDate: '' });
  };

  useEffect(() => {
    // Load processed sales from localStorage
    const stored = localStorage.getItem('processedDamagedReturnSales');
    if (stored) {
      try {
        setProcessedSaleIds(new Set(JSON.parse(stored)));
      } catch (e) {
        console.error('Error loading processed sales:', e);
      }
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [stockResponse, damagedResponse, productsResponse, salesResponse] = await Promise.all([
        apiClient.getStockEntries(),
        apiClient.getDamagedItems(),
        apiClient.getProducts(),
        apiClient.getSales()
      ]);

      if (stockResponse.success) {
        setStocks(stockResponse.data || []);
      }

      if (damagedResponse.success) {
        setDamagedItems(damagedResponse.data || []);
      }

      if (productsResponse && productsResponse.success) {
        setProducts(productsResponse.data || []);
      }

      if (salesResponse && salesResponse.success) {
        const salesData = salesResponse.data || [];
        // Group sales by SaleID and count items per sale
        const salesMap = new Map<number, any>();
        
        salesData.forEach((item: any) => {
          const saleId = item.SaleID;
          if (!salesMap.has(saleId)) {
            salesMap.set(saleId, {
              ...item,
              ItemCount: 0
            });
          }
          const sale = salesMap.get(saleId)!;
          sale.ItemCount += 1;
        });
        
        setSales(Array.from(salesMap.values()));
      }
    } catch (err: any) {
      setError(err.message || 'Error loading data');
      console.error('Data fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSaleItems = async (saleId: number) => {
    try {
      const response = await apiClient.getSaleItems(saleId);
      if (response.success) {
        setSaleItems(response.items || response.data || []);
      } else {
        setError('Failed to load sale items');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading sale items');
      console.error('Fetch sale items error:', err);
    }
  };

  const filteredStocks = stocks.filter(s => {
    const productName = (s.ProductName || s.Particulars || '').toLowerCase();
    const batchNumber = (s.BatchNumber || '').toLowerCase();
    const productCode = (s.ProductCode || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    return productName.includes(search) || batchNumber.includes(search) || productCode.includes(search);
  });

  const filteredSales = sales
    .filter(sale => {
      // Filter out already processed sales
      if (processedSaleIds.has(sale.SaleID)) {
        return false;
      }
      const saleId = `#INV-${String(sale.SaleID).padStart(6, '0')}`.toLowerCase();
      const search = searchTerm.toLowerCase();
      return saleId.includes(search);
    })
    .sort((a, b) => a.SaleID - b.SaleID);

  const filteredDamagedItems = damagedItems.filter(item => {
    const productName = (item.ProductName || '').toLowerCase();
    const batchNumber = (item.BatchNumber || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    
    // Date filtering
    const itemDate = new Date(item.DateReported);
    const startDate = historyFilter.startDate ? new Date(historyFilter.startDate) : null;
    const endDate = historyFilter.endDate ? new Date(historyFilter.endDate) : null;
    
    if (startDate && itemDate < startDate) {
      return false;
    }
    if (endDate) {
      const endDateWithTime = new Date(endDate);
      endDateWithTime.setHours(23, 59, 59, 999);
      if (itemDate > endDateWithTime) {
        return false;
      }
    }

    return (productName.includes(search) || batchNumber.includes(search));
  });

  const handleSelectStock = useCallback((stockEntryId: number) => {
    const newSelection = new Set(selectedStockItems);
    if (newSelection.has(stockEntryId)) {
      newSelection.delete(stockEntryId);
      const newQuantities = { ...itemQuantities };
      delete newQuantities[stockEntryId];
      setItemQuantities(newQuantities);
    } else {
      newSelection.add(stockEntryId);
      const stock = stocks.find(s => s.StockEntryID === stockEntryId);
      if (stock) {
        setItemQuantities(prev => ({ ...prev, [stockEntryId]: 1 }));
      }
    }
    setSelectedStockItems(newSelection);
  }, [selectedStockItems, itemQuantities, stocks]);

  const handleQuantityChange = useCallback((stockEntryId: number, value: number) => {
    const stock = stocks.find(s => s.StockEntryID === stockEntryId);
    if (!stock) return;
    
    const qty = Math.min(Math.max(1, value || 1), stock.Quantity);
    setItemQuantities(prev => ({ ...prev, [stockEntryId]: qty }));
  }, [stocks]);

  const handleDamageReasonChange = useCallback((value: string) => {
    setDamageReason(value);
  }, []);

  const handleDueAmountChange = useCallback((value: number | '') => {
    setDueAmount(value);
  }, []);

  const handleMarkDamaged = async () => {
    if (selectedStockItems.size === 0 || !damageReason.trim()) {
      setError('Please select at least one item and enter a reason');
      return;
    }

    // Validate all quantities before submission
    for (const stockId of Array.from(selectedStockItems)) {
      const stock = stocks.find(s => s.StockEntryID === stockId);
      const qty = itemQuantities[stockId] || 1;
      
      if (!stock || qty > stock.Quantity || qty < 1) {
        setError(`Invalid quantity for ${stock?.ProductName || 'item'}: selected ${qty}, but only ${stock?.Quantity} available`);
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Mark all selected items as damaged
      for (const stockId of Array.from(selectedStockItems)) {
        const stock = stocks.find(s => s.StockEntryID === stockId);
        if (!stock) continue;

        const qty = itemQuantities[stockId] || 1;
        const response = await apiClient.markItemsDamaged({
          stockEntryId: stockId,
          quantity: qty,
          reason: damageReason,
          replacementProduct: selectedReplacementProductId ? 
            products.find(p => p.ProductID === selectedReplacementProductId)?.Particulars || '' 
            : '',
          currentUserId: Number(user?.UserID || user?.id || null)
        });

        if (!response.success) {
          setError(response.message || `Failed to mark ${stock.ProductName} as damaged`);
          setIsSubmitting(false);
          return;
        }
      }

      setSuccessMessage(`${selectedStockItems.size} item(s) marked as damaged successfully`);
      resetModal();
      fetchData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error marking items as damaged');
      console.error('Mark damaged error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetModal = () => {
    setShowProcessModal(false);
    setSelectedStockItems(new Set());
    setItemQuantities({});
    setSelectedReplacementProduct(new Map());
    setReplacementQuantity(new Map());
    setDamageReason('');
    setReplacementProductNote('');
    setSelectedReplacementProductId(null);
  };

  const resetSaleDetailsModal = () => {
    setShowSaleDetailsModal(false);
    setSelectedSale(null);
    setSaleItems([]);
    setSelectedSaleItems(new Set());
    setSaleItemQuantities({});
    setSaleItemReplacements(new Map());
    setSaleItemReplacementQty(new Map());
    setDamageNote('');
    setDueAmount('');
    setSelectedReplacementProductId(null);
  };

  const handleProcessDamagedReturn = async () => {
    if (selectedSaleItems.size === 0 || !damageNote.trim()) {
      setError('Please select items to return and enter a note');
      return;
    }

    if (saleItemReplacements.size !== selectedSaleItems.size) {
      setError('Please select a replacement product for each returned item');
      return;
    }

    // Validate price matching and additional payment
    let totalReturnedValue = 0;
    let totalReplacementValue = 0;

    for (const itemIdx of Array.from(selectedSaleItems)) {
      const returnedItem = saleItems[itemIdx];
      const returnedQty = saleItemQuantities[itemIdx] || 1;
      const returnedPrice = returnedItem?.SellingPrice || returnedItem?.UnitPrice || 0;
      totalReturnedValue += returnedQty * returnedPrice;

      const replacementStockEntryId = saleItemReplacements.get(itemIdx);
      const replacementProduct = stocks.find(s => s.StockEntryID === replacementStockEntryId || s.StockEntryID === String(replacementStockEntryId));
      const replacementQty = saleItemReplacementQty.get(itemIdx) || 1;
      const replacementPrice = replacementProduct?.SellingPrice || replacementProduct?.UnitPrice || 0;
      totalReplacementValue += replacementQty * replacementPrice;
    }

    const totalDue = totalReplacementValue - totalReturnedValue;

    // Check if prices match or if additional payment is required
    if (totalDue > 0.01) {
      // Additional payment is required
      if (typeof dueAmount === 'string' || dueAmount === '' || dueAmount === 0) {
        setError('Please enter the additional payment amount');
        return;
      }
      if (Math.abs(dueAmount - totalDue) > 0.01) {
        setError(`Additional payment amount must be ${currencySymbol}${totalDue.toFixed(2)}. You entered ${currencySymbol}${dueAmount.toFixed(2)}`);
        return;
      }
    } else if (totalDue < -0.01) {
      // Replacement is cheaper than returned item
      setError('Replacement item(s) price must be equal to or more than the returned item(s) price');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Process the damaged return transaction
      for (const itemIdx of Array.from(selectedSaleItems)) {
        const saleItem = saleItems[itemIdx];
        const returnQty = saleItemQuantities[itemIdx] || 1;
        const replacementStockEntryId = saleItemReplacements.get(itemIdx);
        const replacementProduct = stocks.find(s => s.StockEntryID === replacementStockEntryId || s.StockEntryID === String(replacementStockEntryId));
        const replacementQty = saleItemReplacementQty.get(itemIdx) || 1;

        if (!replacementProduct) {
          setError(`Replacement product not found for item ${itemIdx + 1}`);
          setIsSubmitting(false);
          return;
        }

        // Only reduce stock for the REPLACEMENT product from inventory
        // The returned item does NOT reduce stock since it was already sold
        const replacementResponse = await apiClient.markItemsDamaged({
          stockEntryId: replacementProduct.StockEntryID,
          quantity: replacementQty,
          reason: `Replacement for damaged ${saleItem.ProductName || 'item'} from Sale #${selectedSale.SaleID} - ${damageNote}`,
          replacementProduct: saleItem.ProductName || '',
          relatedSaleId: selectedSale.SaleID,
          currentUserId: Number(user?.UserID || user?.id || null),
          additionalPayment: totalDue > 0.01 ? dueAmount : 0
        });

        if (!replacementResponse.success) {
          setError(replacementResponse.message || 'Failed to process damaged return');
          setIsSubmitting(false);
          return;
        }
      }

      setSuccessMessage(`${selectedSaleItems.size} item(s) processed as damaged return successfully`);
      
      resetSaleDetailsModal();
      
      // Refresh all data to reflect changes (sale removal, stock updates, etc)
      fetchData();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error processing damaged return');
      console.error('Process damaged return error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center md:hidden">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800">Damaged Items</h2>
          <p className="text-slate-500 font-medium">Manage and track damaged stock</p>
        </div>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-start gap-3">
          <CheckCircle size={20} className="text-green-600 mt-0.5" />
          <div>
            <h3 className="font-bold text-green-800">Success</h3>
            <p className="text-green-700 text-sm">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('mark')}
          className={`px-4 py-3 font-semibold text-sm transition-colors ${
            activeTab === 'mark'
              ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] -mb-0.5'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Mark Items as Damaged
        </button>
        <button
          onClick={() => setActiveTab('processed')}
          className={`px-4 py-3 font-semibold text-sm transition-colors ${
            activeTab === 'processed'
              ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] -mb-0.5'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Processed Damaged Items
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-3 font-semibold text-sm transition-colors ${
            activeTab === 'history'
              ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] -mb-0.5'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Damaged History ({damagedItems.length})
        </button>
      </div>

      {activeTab === 'mark' && (
        <>
          {/* Stock List */}
          <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by product name, batch number..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {isLoading ? (
              <div className="p-8 text-center">
                <Loader size={24} className="animate-spin mx-auto text-slate-400" />
              </div>
            ) : (
              <>
                {/* Desktop View */}
                <div className="hidden md:block">
                  <div className="flex flex-col h-[600px] overflow-hidden">
                    <div className="overflow-x-auto overflow-y-hidden">
                      <table className="w-full" style={{ tableLayout: 'fixed' }}>
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Product</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Batch</th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase">Qty</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Action</th>
                          </tr>
                        </thead>
                      </table>
                    </div>
                    <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar">
                      <table className="w-full" style={{ tableLayout: 'fixed' }}>
                        <tbody className="divide-y divide-gray-100">
                          {filteredStocks.map((stock, idx) => (
                            <tr key={`stock-${stock.StockEntryID}-${idx}`} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-bold text-slate-800">{stock.ProductName || stock.Particulars || 'Unknown Product'}</p>
                                  <p className="text-xs text-slate-500">{stock.ProductCode || 'N/A'}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-700">{stock.BatchNumber || '-'}</td>
                              <td className="px-4 py-3 text-center font-bold text-slate-800">{stock.Quantity}</td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => {
                                    setSelectedStockItems(new Set([stock.StockEntryID]));
                                    setItemQuantities({ [stock.StockEntryID]: 1 });
                                    setShowProcessModal(true);
                                  }}
                                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 font-semibold text-xs rounded-lg hover:bg-red-100 transition-colors"
                                >
                                  <AlertTriangle size={14} /> Mark
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Mobile View */}
                <div className="md:hidden">
                  <div className="max-h-[600px] overflow-y-auto custom-scrollbar divide-y divide-gray-100">
                    {filteredStocks.map((stock) => (
                      <div key={stock.StockEntryID} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="space-y-2 mb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs text-slate-500 font-semibold">Product</p>
                              <p className="font-bold text-slate-800">{stock.ProductName || stock.Particulars || 'Unknown Product'}</p>
                              <p className="text-xs text-slate-500">{stock.ProductCode || 'N/A'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-500 font-semibold">Batch</p>
                              <p className="text-sm text-slate-700">{stock.BatchNumber || '-'}</p>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-xs text-slate-500 font-semibold">Quantity</p>
                              <p className="text-lg font-bold text-slate-800">{stock.Quantity}</p>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedStockItems(new Set([stock.StockEntryID]));
                            setItemQuantities({ [stock.StockEntryID]: 1 });
                            setShowProcessModal(true);
                          }}
                          className="w-full py-2.5 bg-red-50 text-red-700 font-bold text-sm rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                        >
                          <AlertTriangle size={16} /> Mark
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* New Process Modal */}
          {showProcessModal && (
            <>
              {createPortal(
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
                  <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                    {/* Modal Header */}
                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                      <div>
                        <h2 className="text-2xl font-bold text-slate-800">Mark Items as Damaged</h2>
                        <p className="text-sm text-slate-500 mt-1">Select items from inventory</p>
                      </div>
                      <button
                        onClick={resetModal}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X size={24} />
                      </button>
                    </div>

                    {/* Modal Content */}
                    <div className="space-y-6">
                      {/* Stock Selection */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-600 mb-3">Items to Mark as Damaged *</label>
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-100">
                            {stocks.length > 0 ? (
                              stocks.map((stock) => (
                                <div key={stock.StockEntryID} className="p-4 hover:bg-gray-50 transition-colors">
                                  <div className="flex items-start gap-4">
                                    <input
                                      type="checkbox"
                                      id={`stock-${stock.StockEntryID}`}
                                      checked={selectedStockItems.has(stock.StockEntryID)}
                                      onChange={() => handleSelectStock(stock.StockEntryID)}
                                      className="mt-1 w-4 h-4 cursor-pointer"
                                    />
                                    <div className="flex-1">
                                      <label htmlFor={`stock-${stock.StockEntryID}`} className="cursor-pointer block">
                                        <p className="font-semibold text-slate-800">{stock.ProductName || stock.Particulars || 'Unknown'}</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                          Code: {stock.ProductCode || 'N/A'} | Batch: {stock.BatchNumber || 'N/A'} | Available: {stock.Quantity}
                                        </p>
                                      </label>
                                    </div>
                                    {selectedStockItems.has(stock.StockEntryID) && (
                                      <div className="flex items-center gap-2 ml-auto">
                                        <label className="text-xs text-slate-600 font-semibold">Qty:</label>
                                        <QuantityInput
                                          value={itemQuantities[stock.StockEntryID] || 1}
                                          min={1}
                                          max={stock.Quantity}
                                          onChange={(qty) => setItemQuantities(prev => ({ ...prev, [stock.StockEntryID]: qty }))}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="p-8 text-center text-slate-500">
                                No stocks available
                              </div>
                            )}
                          </div>
                        </div>
                        {selectedStockItems.size > 0 && (
                          <div className="mt-2 text-sm text-slate-600">
                            <strong>{selectedStockItems.size}</strong> item(s) selected
                          </div>
                        )}
                      </div>

                      {/* Reason */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-600 mb-2">Reason for Damage *</label>
                        <textarea
                          value={damageReason}
                          onChange={(e) => handleDamageReasonChange(e.target.value)}
                          placeholder="e.g., Package damaged, expiration date passed, broke during handling, etc."
                          rows={3}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 resize-none"
                        />
                      </div>

                      {/* Summary */}
                      {selectedStockItems.size > 0 && (
                        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                          <p className="text-sm font-semibold text-red-800">Summary</p>
                          <p className="text-sm text-red-700 mt-2">
                            <strong>{selectedStockItems.size}</strong> item(s) will be marked as damaged
                          </p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-4 border-t border-gray-200">
                        <button
                          onClick={resetModal}
                          className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleMarkDamaged}
                          disabled={
                            isSubmitting ||
                            selectedStockItems.size === 0 ||
                            !damageReason.trim()
                          }
                          className="flex-1 py-2.5 px-4 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSubmitting ? 'Marking...' : 'Mark as Damaged'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>,
                document.body
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'processed' && (
        <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by Sale ID..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <Loader size={24} className="animate-spin mx-auto text-slate-400 mb-2" />
              <p className="text-slate-600">Loading sales...</p>
            </div>
          ) : filteredSales.length > 0 ? (
            <>
              {/* Desktop View */}
              <div className="hidden md:block">
                <div className="flex flex-col h-[600px] overflow-hidden">
                  <div className="overflow-x-auto overflow-y-hidden">
                    <table className="w-full" style={{ tableLayout: 'fixed' }}>
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Sale ID</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Date</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Amount</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase">Items</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Action</th>
                        </tr>
                      </thead>
                    </table>
                  </div>
                  <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar">
                    <table className="w-full" style={{ tableLayout: 'fixed' }}>
                      <tbody className="divide-y divide-gray-100">
                        {filteredSales.map((sale) => (
                          <tr key={sale.SaleID} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-bold text-slate-800">#INV-{String(sale.SaleID).padStart(6, '0')}</td>
                            <td className="px-4 py-3 text-sm text-slate-700">
                              {new Date(sale.SaleDate || sale.TransactionDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800">
                              {currencySymbol}{(sale.FinalAmount || sale.TotalAmount ? parseFloat(String(sale.FinalAmount || sale.TotalAmount)).toFixed(2) : '0.00')}
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-slate-700">{sale.ItemCount || 0}</td>
                            <td className="px-4 py-3">
                              <button 
                                onClick={async () => {
                                  setSelectedSale(sale);
                                  setShowSaleDetailsModal(true);
                                  fetchSaleItems(sale.SaleID);
                                  // Refresh stocks to ensure latest data for replacement selection
                                  const stockResponse = await apiClient.getStockEntries();
                                  if (stockResponse.success) {
                                    setStocks(stockResponse.data || []);
                                  }
                                }}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 font-semibold text-xs rounded-lg hover:bg-blue-100 transition-colors">
                                <Plus size={14} /> View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Mobile View */}
              <div className="md:hidden">
                <div className="max-h-[600px] overflow-y-auto custom-scrollbar divide-y divide-gray-100">
                  {filteredSales.map((sale) => (
                    <div key={sale.SaleID} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="space-y-2 mb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs text-slate-500 font-semibold">Sale ID</p>
                            <p className="text-lg font-bold text-slate-800">#INV-{String(sale.SaleID).padStart(6, '0')}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500 font-semibold">Amount</p>
                            <p className="text-lg font-bold text-slate-800">
                              {currencySymbol}{(sale.FinalAmount || sale.TotalAmount ? parseFloat(String(sale.FinalAmount || sale.TotalAmount)).toFixed(2) : '0.00')}
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-xs text-slate-500 font-semibold">Date</p>
                            <p className="text-sm text-slate-700">
                              {new Date(sale.SaleDate || sale.TransactionDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-500 font-semibold">Items</p>
                            <p className="text-lg font-bold text-slate-800">{sale.ItemCount || 0}</p>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={async () => {
                          setSelectedSale(sale);
                          setShowSaleDetailsModal(true);
                          fetchSaleItems(sale.SaleID);
                          // Refresh stocks to ensure latest data for replacement selection
                          const stockResponse = await apiClient.getStockEntries();
                          if (stockResponse.success) {
                            setStocks(stockResponse.data || []);
                          }
                        }}
                        className="w-full py-2.5 bg-blue-50 text-blue-700 font-bold text-sm rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2">
                        <Plus size={16} /> View
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center">
              <CheckCircle size={32} className="mx-auto text-blue-600 mb-2" />
              <p className="text-slate-600 font-semibold">No sales found</p>
              <p className="text-slate-400 text-sm mt-2">Sales will appear here once items are marked as damaged</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 space-y-4">
            <div className="flex flex-col md:flex-row gap-3 md:items-end">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search damaged items..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="hidden md:flex gap-2 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">From Date</label>
                  <input
                    type="date"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                    value={historyFilter.startDate}
                    onChange={(e) => setHistoryFilter({ ...historyFilter, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">To Date</label>
                  <input
                    type="date"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                    value={historyFilter.endDate}
                    onChange={(e) => setHistoryFilter({ ...historyFilter, endDate: e.target.value })}
                  />
                </div>
                <button 
                  onClick={clearFilters} 
                  title="Clear all filters"
                  className="px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] bg-white border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-light)] hover:shadow-sm transition-all flex items-center gap-2"
                >
                  <X size={16} />
                  Clear Filters
                </button>
              </div>
            </div>
            <div className="md:hidden grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">From Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  value={historyFilter.startDate}
                  onChange={(e) => setHistoryFilter({ ...historyFilter, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">To Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  value={historyFilter.endDate}
                  onChange={(e) => setHistoryFilter({ ...historyFilter, endDate: e.target.value })}
                />
              </div>
              <button 
                onClick={clearFilters} 
                title="Clear all filters"
                className="col-span-2 px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] bg-white border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-light)] hover:shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <X size={16} />
                Clear Filters
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <Loader size={24} className="animate-spin mx-auto text-slate-400" />
            </div>
          ) : filteredDamagedItems.length > 0 ? (
            <>
              {/* Desktop View */}
              <div className="hidden md:block">
                <div className="flex flex-col h-[600px] overflow-hidden">
                  <div className="overflow-x-auto overflow-y-hidden">
                    <table className="w-full" style={{ tableLayout: 'fixed' }}>
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Product</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Batch</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase">Qty</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Replacement</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Reason</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Date</th>
                        </tr>
                      </thead>
                    </table>
                  </div>
                  <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar">
                    <table className="w-full" style={{ tableLayout: 'fixed' }}>
                      <tbody className="divide-y divide-gray-100">
                        {filteredDamagedItems.map((item, idx) => (
                          <tr key={`damaged-${item.DamagedItemID}-${idx}`} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-bold text-slate-800">{item.ProductName || 'Unknown Product'}</p>
                                <p className="text-xs text-slate-500">{item.ProductCode || 'N/A'}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700">{item.BatchNumber || '-'}</td>
                            <td className="px-4 py-3 text-center font-bold text-red-600">{item.Quantity}</td>
                            <td className="px-4 py-3 text-sm text-slate-700">{item.ReplacementProduct || '-'}</td>
                            <td className="px-4 py-3 text-sm text-slate-700">{item.Reason}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {item.DateReported ? new Date(item.DateReported).toLocaleDateString() : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Mobile View */}
              <div className="md:hidden">
                <div className="max-h-[600px] overflow-y-auto custom-scrollbar divide-y divide-gray-100">
                  {filteredDamagedItems.map((item) => (
                    <div key={item.DamagedItemID} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs text-slate-500 font-semibold">Product</p>
                            <p className="font-bold text-slate-800">{item.ProductName || 'Unknown Product'}</p>
                            <p className="text-xs text-slate-500">{item.ProductCode || 'N/A'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500 font-semibold">Batch</p>
                            <p className="text-sm text-slate-700">{item.BatchNumber || '-'}</p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                          <div>
                            <p className="text-xs text-slate-500 font-semibold">Quantity</p>
                            <p className="text-lg font-bold text-red-600">{item.Quantity}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500 font-semibold">Date</p>
                            <p className="text-sm text-slate-600">
                              {item.DateReported ? new Date(item.DateReported).toLocaleDateString() : '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="pt-3 border-b-2 border-[var(--color-primary)]">
                        <p className="text-xs text-slate-500 font-semibold mb-1">Replacement Product</p>
                        <p className="text-sm text-slate-700 pb-2">{item.ReplacementProduct || 'None'}</p>
                      </div>
                      <div className="pt-3 border-b-2 border-[var(--color-primary)]">
                        <p className="text-xs text-slate-500 font-semibold mb-1">Reason</p>
                        <p className="text-sm text-slate-700 pb-3">{item.Reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center">
              <CheckCircle size={32} className="mx-auto text-green-600 mb-2" />
              <p className="text-slate-600 font-semibold">No damaged items recorded</p>
            </div>
          )}
        </div>
      )}

      {/* Sale Details Modal */}
      {showSaleDetailsModal && selectedSale && (
        <>
          {createPortal(
            <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Process Damaged Return</h2>
                    <p className="text-sm text-slate-500 mt-1">Sale #INV-{String(selectedSale.SaleID).padStart(6, '0')}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowSaleDetailsModal(false);
                      setSelectedSale(null);
                      setSaleItems([]);
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Modal Content */}
                {/* Sale Info */}
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 font-semibold mb-2">SALE DETAILS</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-slate-600">Date</p>
                      <p className="font-semibold text-slate-800">
                        {new Date(selectedSale.SaleDate || selectedSale.TransactionDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Amount</p>
                      <p className="font-semibold text-slate-800">
                        {currencySymbol}{(selectedSale.FinalAmount || selectedSale.TotalAmount ? parseFloat(String(selectedSale.FinalAmount || selectedSale.TotalAmount)).toFixed(2) : '0.00')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Items</p>
                      <p className="font-semibold text-slate-800">{selectedSale.ItemCount || saleItems.length}</p>
                    </div>
                  </div>
                </div>

                {/* Items to Return as Damaged */}
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-3">Items to Return as Damaged *</label>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-100">
                      {saleItems.length > 0 ? (
                        saleItems.map((item, idx) => (
                          <div key={idx} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start gap-4">
                              <input
                                type="checkbox"
                                id={`sale-item-${idx}`}
                                checked={selectedSaleItems.has(idx)}
                                onChange={() => {
                                  const newSelection = new Set(selectedSaleItems);
                                  if (newSelection.has(idx)) {
                                    newSelection.delete(idx);
                                    const newQties = { ...saleItemQuantities };
                                    delete newQties[idx];
                                    setSaleItemQuantities(newQties);
                                  } else {
                                    newSelection.add(idx);
                                    setSaleItemQuantities({ ...saleItemQuantities, [idx]: 1 });
                                  }
                                  setSelectedSaleItems(newSelection);
                                }}
                                className="mt-1 w-4 h-4 cursor-pointer"
                              />
                              <div className="flex-1">
                                <label htmlFor={`sale-item-${idx}`} className="cursor-pointer block">
                                  <p className="font-semibold text-slate-800">{item.ProductName || 'Unknown'}</p>
                                  <p className="text-xs text-slate-500 mt-1">Available: {item.QuantitySold}</p>
                                </label>
                              </div>
                              {selectedSaleItems.has(idx) && (
                                <div className="flex items-center gap-2 ml-auto">
                                  <label className="text-xs text-slate-600 font-semibold">Qty:</label>
                                  <input
                                    type="number"
                                    min="1"
                                    max={item.QuantitySold}
                                    value={saleItemQuantities[idx] || 1}
                                    onChange={(e) => {
                                      const qty = Math.min(Math.max(1, parseInt(e.target.value) || 1), item.QuantitySold);
                                      setSaleItemQuantities({ ...saleItemQuantities, [idx]: qty });
                                    }}
                                    className="w-16 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-slate-500">
                          Loading items...
                        </div>
                      )}
                    </div>
                  </div>
                  {selectedSaleItems.size > 0 && (
                    <div className="mt-2 text-sm text-slate-600">
                      <strong>{selectedSaleItems.size}</strong> item(s) selected for return
                    </div>
                  )}
                </div>

                {/* Replacement Product Selection */}
                {selectedSaleItems.size > 0 && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-3">Select Replacement Product from Inventory * ({selectedSaleItems.size} item{selectedSaleItems.size > 1 ? 's' : ''})</label>
                    <div className="space-y-4 border border-gray-200 rounded-lg p-4">
                      {Array.from(selectedSaleItems).map((itemIdx, idx) => {
                        const saleItem = saleItems[itemIdx];
                        const selectedStockEntryId = saleItemReplacements.get(itemIdx);
                        const replacementProduct = stocks.find(s => s.StockEntryID === selectedStockEntryId || s.StockEntryID === String(selectedStockEntryId));
                        const replacementQty = saleItemReplacementQty.get(itemIdx) || 1;

                        return (
                          <div key={itemIdx} className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                            <p className="text-xs text-slate-600 font-semibold mb-3">
                              Item {idx + 1}: <span className="text-blue-600">{saleItem?.ProductName}</span> (Qty: {saleItemQuantities[itemIdx] || 1})
                            </p>
                            <div className="space-y-3">
                              <select
                                value={selectedStockEntryId || ''}
                                onChange={async (e) => {
                                  const newReplacements = new Map(saleItemReplacements);
                                  if (e.target.value) {
                                    newReplacements.set(itemIdx, parseInt(e.target.value));
                                  } else {
                                    newReplacements.delete(itemIdx);
                                  }
                                  setSaleItemReplacements(newReplacements);
                                  
                                  // Initialize replacement quantity if not set
                                  if (!saleItemReplacementQty.has(itemIdx)) {
                                    const newQty = new Map(saleItemReplacementQty);
                                    newQty.set(itemIdx, 1);
                                    setSaleItemReplacementQty(newQty);
                                  }
                                  
                                  // Refresh stocks to ensure Exchange Summary can find the selected product
                                  if (e.target.value) {
                                    const stockResponse = await apiClient.getStockEntries();
                                    if (stockResponse.success) {
                                      setStocks(stockResponse.data || []);
                                    }
                                  }
                                }}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                              >
                                <option value="">-- Select replacement product --</option>
                                {stocks.map((stock) => {
                                  const returnedItem = saleItems[itemIdx];
                                  const isSameProduct = stock.ProductID === returnedItem?.ProductID;
                                  
                                  // Filter out items with zero or negative stock
                                  if (isSameProduct || (stock.Quantity || 0) <= 0) {
                                    return null;
                                  }
                                  
                                  const price = typeof (stock.SellingPrice || stock.UnitPrice) === 'string' 
                                    ? parseFloat(stock.SellingPrice || stock.UnitPrice) 
                                    : (stock.SellingPrice || stock.UnitPrice || 0);
                                  return (
                                    <option key={stock.StockEntryID} value={stock.StockEntryID}>
                                      {stock.ProductName || stock.Particulars || 'Unknown'} | Stock: {stock.Quantity || 0} | Price: {currencySymbol}{price.toFixed(2)}
                                    </option>
                                  );
                                })}
                              </select>

                              {replacementProduct && (
                                <div className="space-y-2 bg-blue-50 border border-blue-200 p-3 rounded-lg">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-xs text-slate-600 font-semibold">Selected Replacement</p>
                                      <p className="text-sm font-bold text-slate-800">{replacementProduct.ProductName || replacementProduct.Particulars || 'Unknown'}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xs text-slate-600 font-semibold">Available</p>
                                      <p className="text-sm font-bold text-blue-600">{replacementProduct.Quantity || 0} units</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 pt-2 border-t border-blue-200">
                                    <label className="text-xs text-slate-600 font-semibold">Exchange Qty:</label>
                                    <input
                                      type="number"
                                      min="1"
                                      max={replacementProduct.Quantity || 1}
                                      value={replacementQty}
                                      onChange={(e) => {
                                        const qty = Math.min(Math.max(1, parseInt(e.target.value) || 1), replacementProduct.Quantity || 1);
                                        const newQty = new Map(saleItemReplacementQty);
                                        newQty.set(itemIdx, qty);
                                        setSaleItemReplacementQty(newQty);
                                      }}
                                      className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Exchange Summary */}
                {selectedSaleItems.size > 0 && saleItemReplacements.size > 0 && (
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <p className="text-xs text-slate-600 font-semibold mb-4">EXCHANGE SUMMARY (Equal Value Required)</p>
                    <div className="space-y-4">
                      {Array.from(selectedSaleItems).map((itemIdx, idx) => {
                        const returnedItem = saleItems[itemIdx];
                        const returnedQty = saleItemQuantities[itemIdx] || 1;
                        const returnedPrice = typeof (returnedItem?.SellingPrice || returnedItem?.UnitPrice) === 'string'
                          ? parseFloat(returnedItem?.SellingPrice || returnedItem?.UnitPrice || '0')
                          : (returnedItem?.SellingPrice || returnedItem?.UnitPrice || 0);
                        const returnedTotal = returnedQty * returnedPrice;
                        
                        const replacementStockEntryId = saleItemReplacements.get(itemIdx);
                        const replacementProduct = stocks.find(s => s.StockEntryID === replacementStockEntryId || s.StockEntryID === String(replacementStockEntryId));
                        const replacementQty = saleItemReplacementQty.get(itemIdx) || 1;
                        const replacementPrice = typeof (replacementProduct?.SellingPrice || replacementProduct?.UnitPrice) === 'string'
                          ? parseFloat(replacementProduct?.SellingPrice || replacementProduct?.UnitPrice || '0')
                          : (replacementProduct?.SellingPrice || replacementProduct?.UnitPrice || 0);
                        const replacementTotal = replacementQty * replacementPrice;
                        const priceDifference = replacementTotal - returnedTotal;
                        const hasAdditionalPayment = priceDifference > 0.01;

                        return (
                          <div key={itemIdx} className="border border-green-200 rounded-lg p-3 bg-green-50">
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-bold text-green-700">ITEM {idx + 1}</span>
                              {hasAdditionalPayment && <span className="text-xs font-semibold text-green-700">✓ WITH ADDITIONAL PAYMENT</span>}
                            </div>
                            
                            <div className="mb-3 pb-3 border-b border-green-200">
                              <p className="text-xs font-semibold text-slate-600 mb-2">RETURNED ITEM</p>
                              <p className="font-semibold text-slate-800">{returnedItem?.ProductName || 'Unknown'}</p>
                              <p className="text-sm text-slate-600">Qty: {returnedQty} × {currencySymbol}{returnedPrice.toFixed(2)}</p>
                              <p className="text-right font-bold text-slate-800 mt-1">{currencySymbol}{returnedTotal.toFixed(2)}</p>
                            </div>

                            <div className="mb-3 pb-3 border-b border-green-200">
                              <p className="text-xs font-semibold text-slate-600 mb-1">Quantity Match:</p>
                              <p className="text-sm font-bold text-green-700">✓ Both {replacementQty}</p>
                              <p className="text-xs font-semibold text-slate-600 mb-1 mt-2">Replacement Value:</p>
                              <p className="text-sm font-bold text-blue-600">{currencySymbol}{replacementTotal.toFixed(2)} ({priceDifference > 0 ? `+${currencySymbol}${priceDifference.toFixed(2)} more` : '='})</p>
                            </div>

                            <div>
                              <p className="text-xs font-semibold text-slate-600 mb-2">REPLACEMENT ITEM(S)</p>
                              <p className="font-semibold text-slate-800">{replacementProduct?.ProductName || replacementProduct?.Particulars || replacementProduct?.ProductCode || 'Unknown'}</p>
                              <p className="text-sm text-slate-600">Qty: {replacementQty} × {currencySymbol}{replacementPrice.toFixed(2)}</p>
                              <p className="text-right font-bold text-slate-800 mt-1">{currencySymbol}{replacementTotal.toFixed(2)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Additional Payment Section & Due Amount Input */}
                {selectedSaleItems.size > 0 && saleItemReplacements.size > 0 && (() => {
                  let totalReturnedValue = 0;
                  let totalReplacementValue = 0;
                  
                  Array.from(selectedSaleItems).forEach((itemIdx) => {
                    const returnedItem = saleItems[itemIdx];
                    const returnedQty = saleItemQuantities[itemIdx] || 1;
                    const returnedPrice = returnedItem?.SellingPrice || returnedItem?.UnitPrice || 0;
                    totalReturnedValue += returnedQty * returnedPrice;

                    const replacementStockEntryId = saleItemReplacements.get(itemIdx);
                    const replacementProduct = stocks.find(s => s.StockEntryID === replacementStockEntryId || s.StockEntryID === String(replacementStockEntryId));
                    const replacementQty = saleItemReplacementQty.get(itemIdx) || 1;
                    const replacementPrice = replacementProduct?.SellingPrice || replacementProduct?.UnitPrice || 0;
                    totalReplacementValue += replacementQty * replacementPrice;
                  });

                  const totalDue = totalReplacementValue - totalReturnedValue;
                  const isPriceMismatch = totalDue < -0.01;

                  return (
                    <>
                      {isPriceMismatch && (
                        <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start gap-3">
                          <AlertTriangle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <h3 className="font-bold text-red-800">Error</h3>
                            <p className="text-red-700 text-sm mt-1">Replacement item(s) price must be equal to or more than the returned item(s) price</p>
                            <p className="text-red-600 text-xs mt-2">Returned Value: {currencySymbol}{totalReturnedValue.toFixed(2)} | Replacement Value: {currencySymbol}{totalReplacementValue.toFixed(2)}</p>
                          </div>
                        </div>
                      )}

                      {totalDue > 0.01 && (
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                          <p className="text-sm font-semibold text-amber-900 mb-3">Additional Payment Required</p>
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div>
                              <p className="text-xs text-amber-700 font-semibold">Returned Value</p>
                              <p className="font-bold text-amber-900">{currencySymbol}{totalReturnedValue.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-amber-700 font-semibold">Replacement Value</p>
                              <p className="font-bold text-amber-900">{currencySymbol}{totalReplacementValue.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-amber-700 font-semibold">Due Amount</p>
                              <p className="font-bold text-amber-900">{currencySymbol}{totalDue.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Due Amount Input */}
                      {totalDue > 0.01 && (
                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-2">Due Amount</label>
                          <PriceInput
                            value={dueAmount}
                            onChange={handleDueAmountChange}
                            placeholder="0.00"
                            min={0}
                          />
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Note */}
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-2">Note *</label>
                  <textarea
                    value={damageNote}
                    onChange={(e) => setDamageNote(e.target.value)}
                    placeholder="Reason for damage/return..."
                    rows={2}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-6 border-t border-gray-200 mt-6">
                  <button
                    onClick={() => resetSaleDetailsModal()}
                    className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                  {selectedSaleItems.size > 0 && saleItemReplacements.size === selectedSaleItems.size && (
                    <button
                      onClick={handleProcessDamagedReturn}
                      disabled={isSubmitting || !damageNote.trim()}
                      className="flex-1 py-2.5 px-4 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSubmitting ? 'Processing...' : 'Process Damaged Return'}
                    </button>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
};

export default DamagedItems;

