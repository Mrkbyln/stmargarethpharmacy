import React, { useState, useEffect, useCallback, memo } from 'react';
import { usePharmacy } from '../context/PharmacyContext';
import apiClient from '../lib/apiClient';
import { formatDateTime } from '../lib/dateFormatter';
import { AlertTriangle, Check, Search, X, CheckCircle, Plus, Loader, ArrowRight, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';

interface Sale {
  SaleID: number;
  SaleDate?: string;
  TransactionDate?: string;
  TotalAmount?: number | string;
  FinalAmount?: number | string;
  ItemCount?: number;
}

interface ChangeItemRecord {
  ChangeID: number;
  OriginalSaleID: number;
  ItemReturned: number;
  QtyReturned: number;
  ItemGiven: string;
  QtyGiven: number;
  ItemGivenPrice: number;
  ReturnedItemPrice: number;
  AdditionalPayment: number;
  PriceDifference: number;
  Reason: string;
  ProcessedBy: number;
  DateProcessed: string;
  ProcessedByName?: string;
  ItemReturnedName?: string;
}

interface StockItem {
  StockEntryID: number;
  ProductID: number;
  Particulars?: string;
  ProductCode?: string;
  Quantity: number;
  SellingPrice: number;
  UnitPrice?: number;
  BatchNumber?: string;
  ExpirationDate?: string;
}

interface SoldItem {
  SaleDetailID?: number;
  SaleID: number;
  ProductID: number;
  ProductName: string;
  ProductCode?: string;
  QuantitySold: number;
  UnitPrice: number;
  SellingPrice: number;
  LineTotal?: number;
  StockEntryID?: number;
}

type ActionType = 'change' | 'damage';

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
      className="w-16 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
    />
  );
});

QuantityInput.displayName = 'QuantityInput';

// Memoized price input component
interface PriceInputProps {
  value: number | '';
  onChange: (value: number) => void;
  placeholder?: string;
  min?: number;
}

const PriceInput = memo<PriceInputProps>(({ value, onChange, placeholder = '0.00', min = 0 }) => {
  return (
    <input
      type="number"
      min={min}
      step="any"
      autoComplete="off"
      value={value === '' ? '' : (typeof value === 'number' ? value : parseFloat(String(value)) || '')}
      onChange={(e) => {
        const val = e.target.value;
        if (val === '' || val === '-') {
          onChange(0);
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
      className="flex-1 px-3 py-2 border border-amber-200 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm"
    />
  );
});

PriceInput.displayName = 'PriceInput';

const ChangeItem: React.FC = () => {
  const { user, currencySymbol } = usePharmacy();
  const [sales, setSales] = useState<Sale[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [saleItems, setSaleItems] = useState<SoldItem[]>([]);
  const [changeHistory, setChangeHistory] = useState<ChangeItemRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'process' | 'history'>('process');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  
  // New modal state
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [selectedStockItems, setSelectedStockItems] = useState<Set<number>>(new Set());
  const [itemQuantities, setItemQuantities] = useState<Record<number, number>>({});
  const [selectedReplacementProduct, setSelectedReplacementProduct] = useState<Map<number, string>>(new Map());
  const [replacementQuantity, setReplacementQuantity] = useState<Map<number, number>>(new Map());
  // Multiple replacement products per returned item: Map<returnedItemIdx, Map<productIdx, {code, qty}>>
  const [multipleReplacements, setMultipleReplacements] = useState<Map<number, Map<number, {code: string; qty: number}>>>(new Map());
  const [actionType, setActionType] = useState<ActionType>('change');
  const [itemGiven, setItemGiven] = useState('');
  const [itemGivenPrice, setItemGivenPrice] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<ChangeItemRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState({
    startDate: '',
    endDate: ''
  });
  const [additionalPayment, setAdditionalPayment] = useState<number>(0);

  // Validation error for item given price
  const [priceValidationError, setPriceValidationError] = useState<string | null>(null);

  const clearFilters = () => {
    setSearchTerm('');
    setHistoryFilter({ startDate: '', endDate: '' });
  };

  // Helper function to safely format prices
  const formatPrice = (value: any): string => {
    if (value === null || value === undefined) return '0.00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  // Get the date from Sale object (handles both SaleDate and TransactionDate)
  const getSaleDate = (sale: Sale): string | undefined => {
    return sale.SaleDate || sale.TransactionDate;
  };

  // Fetch items for a specific sale
  const fetchSaleItems = async (saleID: number) => {
    try {
      const response = await apiClient.getSalesForReturn();
      if (response.success) {
        // Filter items for this specific sale
        const items = response.data?.filter((item: any) => item.SaleID === saleID) || [];
        setSaleItems(items);
      }
    } catch (err) {
      setSaleItems([]);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [salesResponse, historyResponse, stockResponse] = await Promise.all([
        apiClient.getSalesForReturn(),
        apiClient.getChangeItemHistory(),
        apiClient.getStockEntries()
      ]);

      if (salesResponse && salesResponse.success) {
        const salesData = salesResponse.data || [];

        // Group sales by SaleID to get unique transactions with item counts
        const groupedSales: Record<number, any> = {};
        salesData.forEach((sale: any, idx: number) => {
          if (!groupedSales[sale.SaleID]) {
            groupedSales[sale.SaleID] = {
              SaleID: sale.SaleID,
              TransactionDate: sale.TransactionDate,
              TotalAmount: sale.TotalAmount,
              FinalAmount: sale.FinalAmount,
              ItemCount: 0
            };
          }
          // Increment item count for this sale
          groupedSales[sale.SaleID].ItemCount += sale.QuantitySold || 1;
        });
        
        const groupedSalesArray = Object.values(groupedSales);
        setSales(groupedSalesArray);
      } else if (salesResponse && !salesResponse.success) {
        setError(salesResponse.message || 'Failed to load sales');
      }

      if (historyResponse && historyResponse.success) {
        setChangeHistory(historyResponse.data || []);
      }

      if (stockResponse && stockResponse.success) {
        setStocks(stockResponse.data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading data');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSales = sales.filter(s =>
    s.SaleID.toString().includes(searchTerm) ||
    (getSaleDate(s) || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredHistory = changeHistory.filter(ch =>
    ch.ChangeID.toString().includes(searchTerm) ||
    ch.OriginalSaleID.toString().includes(searchTerm) ||
    (ch.ItemReturnedName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
    ch.ItemGiven.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    setPriceValidationError(null);
  }, [selectedStockItems, itemQuantities, stocks]);

  const handleQuantityChange = useCallback((stockEntryId: number, value: number) => {
    const stock = stocks.find(s => s.StockEntryID === stockEntryId);
    if (!stock) return;
    
    const qty = Math.min(Math.max(1, value || 1), stock.Quantity);
    setItemQuantities(prev => ({ ...prev, [stockEntryId]: qty }));
  }, [stocks]);

  const handleReasonChange = useCallback((value: string) => {
    setReason(value);
    setPriceValidationError(null);
  }, []);

  const handleReplacementProductChange = useCallback((itemIdx: number, productCode: string) => {
    if (productCode) {
      const newMap = new Map(selectedReplacementProduct);
      newMap.set(itemIdx, productCode);
      setSelectedReplacementProduct(newMap);
      
      // Only set replacement quantity to 1 if not already set
      if (!replacementQuantity.has(itemIdx)) {
        const qtyMap = new Map(replacementQuantity);
        qtyMap.set(itemIdx, 1);
        setReplacementQuantity(qtyMap);
        
        // Only update the corresponding item quantity if not already set
        if (!itemQuantities[itemIdx]) {
          setItemQuantities(prev => ({ ...prev, [itemIdx]: 1 }));
        }
      }
    }
  }, [selectedReplacementProduct, replacementQuantity, itemQuantities]);

  const validateItemGivenPrice = (): boolean => {
    setPriceValidationError(null);

    if (!selectedSale) {
      setPriceValidationError('Please select a sale first');
      return false;
    }

    if (selectedStockItems.size === 0) {
      setPriceValidationError('Please select at least one item to return');
      return false;
    }

    if (actionType === 'change' && selectedReplacementProduct.size === 0) {
      setPriceValidationError('Please select a replacement product for each returned item');
      return false;
    }

    // Ensure all selected replacement products exist in inventory
    if (actionType === 'change') {
      for (const [itemIdx, productCode] of Array.from(selectedReplacementProduct.entries())) {
        let product;
        
        // Try to find by ProductCode first
        product = stocks.find(s => s.ProductCode === productCode);
        
        // If not found and the code is in ENTRY-ID format, try matching by StockEntryID
        if (!product && productCode.startsWith('ENTRY-')) {
          const entryId = parseInt(productCode.replace('ENTRY-', ''));
          product = stocks.find(s => s.StockEntryID === entryId);
        }
        
        if (!product) {
          setPriceValidationError(`Replacement product not found for item #${itemIdx + 1} (code: ${productCode})`);
          return false;
        }
      }

      // Replacement items can have equal or higher prices (with additional payment if higher)
      for (const [itemIdx, productCode] of Array.from(selectedReplacementProduct.entries())) {
        const returnedItem = saleItems[itemIdx];
        const returnedQty = itemQuantities[itemIdx] || 1;
        const returnedPrice = returnedItem?.SellingPrice || returnedItem?.UnitPrice || 0;
        const returnedTotal = returnedQty * returnedPrice;
        
        let replacementProduct = stocks.find(s => s.ProductCode === productCode);
        if (!replacementProduct && productCode.startsWith('ENTRY-')) {
          const entryId = parseInt(productCode.replace('ENTRY-', ''));
          replacementProduct = stocks.find(s => s.StockEntryID === entryId);
        }
        
        const replacementQty = replacementQuantity.get(itemIdx) || 1;
        const replacementPrice = replacementProduct?.SellingPrice || replacementProduct?.UnitPrice || 0;
        const primaryReplacementTotal = replacementQty * replacementPrice;
        
        // Calculate additional replacement items total (if any)
        let additionalReplacementTotal = 0;
        multipleReplacements.get(itemIdx)?.forEach(({code, qty}) => {
          let product = stocks.find(s => s.ProductCode === code);
          if (!product && code.startsWith('ENTRY-')) {
            const entryId = parseInt(code.replace('ENTRY-', ''));
            product = stocks.find(s => s.StockEntryID === entryId);
          }
          const price = product?.SellingPrice || product?.UnitPrice || 0;
          additionalReplacementTotal += qty * price;
        });
        
        const totalReplacementPrice = primaryReplacementTotal + additionalReplacementTotal;
        
        // Replacement price must be equal or greater - additional payment allowed if higher
        const priceDifference = totalReplacementPrice - returnedTotal;
        if (priceDifference < -0.01) {
          const replacementDetail = `${replacementQty} unit(s) @ ₱${replacementPrice.toFixed(2)}${additionalReplacementTotal > 0 ? ` + additional items` : ''}`;
          setPriceValidationError(`Item #${itemIdx + 1}: Replacement price cannot be less than returned item price. Returned: ₱${returnedTotal.toFixed(2)} | Replacement: ₱${totalReplacementPrice.toFixed(2)} (${replacementDetail}).`);
          return false;
        }
      }
    }
    
    return true;
  };

  const handleProcessTransaction = async () => {
    if (!selectedSale || selectedStockItems.size === 0 || !reason.trim()) {
      setError('Please select a sale, items to return, and a reason');
      return;
    }

    if (!validateItemGivenPrice()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const selectedItemsData = Array.from(selectedStockItems).map(itemIdx => {
        const item = saleItems[itemIdx];
        const qty = itemQuantities[itemIdx] || 1;
        return {
          particulars: item?.ProductName || '',
          quantity: qty,
          sellingPrice: item?.SellingPrice || item?.UnitPrice || 0
        };
      });

      if (actionType === 'change') {
        // Build the replacement product details from selected products
        let itemGivenDetails = '';
        let totalGivenPrice = 0;
        let totalQtyGiven = 0;
        
        // NOTE: Returned items should NOT reduce inventory - they are being returned to stock
        // Only replacement items will be deducted from inventory
        
        Array.from(selectedReplacementProduct.entries()).forEach(([itemIdx, productCode]) => {
          
          let product;
          
          // Try to find by ProductCode first
          product = stocks.find(s => s.ProductCode === productCode);
          
          // If not found and the code is in ENTRY-ID format, try matching by StockEntryID
          if (!product && productCode.startsWith('ENTRY-')) {
            const entryId = parseInt(productCode.replace('ENTRY-', ''));
            product = stocks.find(s => s.StockEntryID === entryId);
          }
          
          const qty = replacementQuantity.get(itemIdx) || 1;
          if (product) {
            const price = product.SellingPrice || product.UnitPrice || 0;
            if (itemGivenDetails) itemGivenDetails += ', ';
            const productName = product.Particulars || product.ProductCode || 'Unknown';
            itemGivenDetails += `${productName} x${qty}`;
            totalGivenPrice += price * qty;
            totalQtyGiven += qty;
          }
        });

        // Process multiple replacement products for each returned item
        multipleReplacements.forEach((itemReplacements, itemIdx) => {
          itemReplacements.forEach(({code, qty}) => {
            let product = stocks.find(s => s.ProductCode === code);
            if (!product && code.startsWith('ENTRY-')) {
              const entryId = parseInt(code.replace('ENTRY-', ''));
              product = stocks.find(s => s.StockEntryID === entryId);
            }
            
            if (product) {
              const price = product.SellingPrice || product.UnitPrice || 0;
              if (itemGivenDetails) itemGivenDetails += ', ';
              itemGivenDetails += `${product.Particulars || 'Unknown'} x${qty}`;
              totalGivenPrice += price * qty;
              totalQtyGiven += qty;
            }
          });
        });

        // Ensure itemGiven is not empty
        if (!itemGivenDetails.trim()) {
          setError('Replacement product details are missing. Please ensure all replacement products are properly selected.');
          setIsSubmitting(false);
          return;
        }
        
        // ItemReturned stores the first returned item's ProductID
        const itemReturnedId = saleItems[Array.from(selectedStockItems)[0]]?.ProductID || 0;
        const qtyReturnedTotal = selectedItemsData.reduce((sum, s) => sum + s.quantity, 0);

        // Calculate returned items total price
        const returnedItemsPrice = Array.from(selectedStockItems).reduce((sum, itemIdx) => {
          const item = saleItems[itemIdx];
          const qty = itemQuantities[itemIdx] || 1;
          return sum + ((item?.SellingPrice || item?.UnitPrice || 0) * qty);
        }, 0);

        // Calculate additional payment if replacements exceed returned value
        const priceDifference = totalGivenPrice - returnedItemsPrice;
        const additionalPaymentAmount = Math.max(0, priceDifference); // Only positive differences

        // Get the StockEntryID of the first replacement item for inventory reduction
        const firstReplacementItemIdx = Array.from(selectedReplacementProduct.entries())[0]?.[0];
        let replacementStockEntryId: number | undefined;
        
        if (firstReplacementItemIdx !== undefined) {
          const productCode = selectedReplacementProduct.get(firstReplacementItemIdx);
          if (productCode) {
            let product = stocks.find(s => s.ProductCode === productCode);
            if (!product && productCode.startsWith('ENTRY-')) {
              const entryId = parseInt(productCode.replace('ENTRY-', ''));
              product = stocks.find(s => s.StockEntryID === entryId);
            }
            if (product) {
              replacementStockEntryId = product.StockEntryID;
            }
          }
        }

        // Get the StockEntryID of the first returned item for inventory addition
        let returnedStockEntryId: number | undefined;
        const firstReturnedItemIdx = Array.from(selectedStockItems)[0];
        if (firstReturnedItemIdx !== undefined) {
          // Try to find the stock entry from stocks array that matches this returned product
          const returnedSaleItem = saleItems[firstReturnedItemIdx];
          if (returnedSaleItem?.StockEntryID) {
            returnedStockEntryId = returnedSaleItem.StockEntryID;
          } else {
            // Fallback: find any stock entry for this product
            const matchingStock = stocks.find(s => s.ProductID === itemReturnedId || s.ProductCode === returnedSaleItem?.ProductCode);
            if (matchingStock) {
              returnedStockEntryId = matchingStock.StockEntryID;
            }
          }
        }

        // Create transaction with calculated additional payment
        const response = await apiClient.createChangeItem({
          originalSaleID: selectedSale.SaleID,
          itemReturned: itemReturnedId,
          qtyReturned: qtyReturnedTotal,
          itemGiven: itemGivenDetails,
          qtyGiven: totalQtyGiven,
          itemGivenPrice: totalGivenPrice,
          returnedItemPrice: returnedItemsPrice,
          additionalPayment: additionalPaymentAmount,
          priceDifference: priceDifference,
          reason,
          processedBy: Number(user?.UserID || user?.id || 0),
          returnedStockEntryId,
          replacementStockEntryId
        });

        if (response.success) {
          setSuccessMessage('Item change processed successfully');
          resetModal();
          fetchData();
          setTimeout(() => setSuccessMessage(null), 3000);
        } else {
          setError(response.message || 'Failed to process change');
        }
      } else if (actionType === 'damage') {
        // Process as damaged items - Note: This would need adjustment as damaged items need stock entry IDs
        // For now, we'll just record the transaction
        setSuccessMessage('Items marked as damaged successfully');
        resetModal();
        fetchData();
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Error processing transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetModal = () => {
    setShowProcessModal(false);
    setSelectedSale(null);
    setSelectedStockItems(new Set());
    setItemQuantities({});
    setSelectedReplacementProduct(new Map());
    setReplacementQuantity(new Map());
    setMultipleReplacements(new Map());
    setActionType('change');
    setItemGiven('');
    setItemGivenPrice(0);
    setReason('');
    setAdditionalPayment(0);
    setPriceValidationError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center md:hidden">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800">Item Exchange</h2>
          <p className="text-slate-500 font-medium">Process customer item returns and exchanges</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-600 mt-0.5" />
          <div>
            <h3 className="font-bold text-red-800">Error</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

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
          onClick={() => setActiveTab('process')}
          className={`px-4 py-3 font-semibold text-sm transition-colors ${
            activeTab === 'process'
              ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] -mb-0.5'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Process Exchange
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-3 font-semibold text-sm transition-colors ${
            activeTab === 'history'
              ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] -mb-0.5'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Exchange History ({changeHistory.length})
        </button>
      </div>

      {activeTab === 'process' && (
        <>
          {/* Sales List */}
          <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by Sale ID or date..."
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
                                {formatDateTime(getSaleDate(sale))}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-slate-800">
                                ₱{(sale.FinalAmount || sale.TotalAmount ? parseFloat(String(sale.FinalAmount || sale.TotalAmount)).toFixed(2) : '0.00')}
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-slate-700">{sale.ItemCount || 0}</td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => {
                                    setSelectedSale(sale);
                                    setShowProcessModal(true);
                                    fetchSaleItems(sale.SaleID);
                                  }}
                                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 font-semibold text-xs rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                  <Plus size={14} /> Select
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
                                ₱{(sale.FinalAmount || sale.TotalAmount ? parseFloat(String(sale.FinalAmount || sale.TotalAmount)).toFixed(2) : '0.00')}
                              </p>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-xs text-slate-500 font-semibold">Date</p>
                              <p className="text-sm text-slate-700">{formatDateTime(getSaleDate(sale))}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-slate-500 font-semibold">Items</p>
                              <p className="text-lg font-bold text-slate-800">{sale.ItemCount || 0}</p>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedSale(sale);
                            setShowProcessModal(true);
                            fetchSaleItems(sale.SaleID);
                          }}
                          className="w-full py-2.5 bg-blue-50 text-blue-700 font-bold text-sm rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                        >
                          <Plus size={16} /> Select
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center">
                <p className="text-slate-600 font-semibold">No sales found</p>
                <p className="text-slate-400 text-sm mt-2">Process a sale first to enable exchanges</p>
              </div>
            )}
          </div>

          {/* New Process Modal */}
          {showProcessModal && selectedSale && (
            <>
              {createPortal(
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
                  <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                    {/* Modal Header */}
                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                      <div>
                        <h2 className="text-2xl font-bold text-slate-800">Process Transaction</h2>
                        <p className="text-sm text-slate-500 mt-1">Sale #INV-{String(selectedSale.SaleID).padStart(6, '0')}</p>
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
                      {/* Sale Info */}
                      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                        <p className="text-xs text-slate-600 font-semibold mb-2">SALE DETAILS</p>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-slate-600">Date</p>
                            <p className="font-semibold text-slate-800">{formatDateTime(getSaleDate(selectedSale))}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-600">Amount</p>
                            <p className="font-semibold text-slate-800">₱{(selectedSale.FinalAmount || selectedSale.TotalAmount ? parseFloat(String(selectedSale.FinalAmount || selectedSale.TotalAmount)).toFixed(2) : '0.00')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-600">Items</p>
                            <p className="font-semibold text-slate-800">{selectedSale.ItemCount || 0}</p>
                          </div>
                        </div>
                      </div>

                      {/* Stock Selection */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-600 mb-3">Items to {actionType === 'change' ? 'Return' : 'Mark as Damaged'} *</label>
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-100">
                            {saleItems.length > 0 ? (
                              saleItems.map((item, idx) => {
                                const itemKey = `sale-item-${item.ProductID}-${idx}`;
                                const hasReplacement = actionType === 'change' && selectedReplacementProduct.has(idx);
                                const isDisabled = hasReplacement && !selectedStockItems.has(idx);
                                const selectedQty = itemQuantities[idx] || 0;
                                const remainingQty = item.QuantitySold - selectedQty;
                                
                                return (
                                  <div key={itemKey} className={`p-4 transition-colors ${isDisabled ? 'bg-gray-100 opacity-60' : 'hover:bg-gray-50'}`}>
                                    <div className="flex items-start gap-4">
                                      <input
                                        type="checkbox"
                                        id={itemKey}
                                        checked={selectedStockItems.has(idx)}
                                        onChange={() => handleSelectStock(idx)}
                                        disabled={isDisabled}
                                        className="mt-1 w-4 h-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                      />
                                      <div className="flex-1">
                                        <label htmlFor={itemKey} className={`block ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                          <p className={`font-semibold ${isDisabled ? 'text-gray-500' : 'text-slate-800'}`}>{item.ProductName}</p>
                                          <p className="text-xs text-slate-500 mt-1">
                                            Code: {item.ProductCode || 'N/A'} | Sold: {remainingQty} {selectedQty > 0 && <span className="text-orange-600 font-semibold">(returning {selectedQty})</span>}
                                          </p>
                                          {(item.SellingPrice || item.UnitPrice) && (
                                            <p className="text-xs text-slate-600 mt-1">Selling Price: {currencySymbol}{(item.SellingPrice || item.UnitPrice).toFixed(2)}</p>
                                          )}
                                          {hasReplacement && (
                                            <p className="text-xs text-green-600 mt-2 font-semibold">✓ Replacement already selected</p>
                                          )}
                                        </label>
                                      </div>
                                      {selectedStockItems.has(idx) && (
                                        <div className="flex items-center gap-2 ml-auto">
                                          <label className="text-xs text-slate-600 font-semibold">Qty:</label>
                                          <QuantityInput
                                            value={itemQuantities[idx] || 1}
                                            min={1}
                                            max={item.QuantitySold}
                                            onChange={(qty) => setItemQuantities(prev => ({ ...prev, [idx]: qty }))}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="p-8 text-center text-slate-500">
                                No items found in this sale
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

                      {/* Replacement Product Selection */}
                      {selectedStockItems.size > 0 && (
                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-3">Select Replacement Product from Inventory * ({selectedStockItems.size} item{selectedStockItems.size > 1 ? 's' : ''})</label>
                          <div className="space-y-4 border border-gray-200 rounded-lg p-4">
                            {Array.from(selectedStockItems).map((itemIdx, idx) => {
                              const saleItem = saleItems[itemIdx];
                              const selectedProductCode = selectedReplacementProduct.get(itemIdx);
                              
                              // Find selected product using same logic as transaction handler
                              let selectedProduct;
                              if (selectedProductCode) {
                                selectedProduct = stocks.find(s => s.ProductCode === selectedProductCode);
                                if (!selectedProduct && selectedProductCode.startsWith('ENTRY-')) {
                                  const entryId = parseInt(selectedProductCode.replace('ENTRY-', ''));
                                  selectedProduct = stocks.find(s => s.StockEntryID === entryId);
                                }
                              }
                              
                              const replacementQty = replacementQuantity.get(itemIdx) || 1;
                              const itemReplacements = multipleReplacements.get(itemIdx) || new Map();
                              
                              return (
                                <div key={itemIdx} className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                                  <p className="text-xs text-slate-600 font-semibold mb-2">
                                    Item {idx + 1}: <span className="text-blue-600">{saleItem?.ProductName}</span> (Qty: {replacementQty})
                                  </p>
                                  <div className="space-y-3">
                                    <select
                                      value={selectedProductCode || ''}
                                      onChange={(e) => handleReplacementProductChange(itemIdx, e.target.value)}
                                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                                    >
                                      <option value="">-- Select replacement product --</option>
                                      {stocks.map((stock) => {
                                        const code = stock.ProductCode || `ENTRY-${stock.StockEntryID}`;
                                        // Exclude the returned item from replacement product options
                                        if (saleItem?.ProductCode === code || saleItem?.ProductID === stock.ProductID) {
                                          return null;
                                        }
                                        return (
                                          <option key={stock.StockEntryID} value={code}>
                                            {stock.Particulars || 'Unknown'} - Code: {code} | Stock: {stock.Quantity} | Price: {currencySymbol}{((stock.SellingPrice || stock.UnitPrice) || 0).toFixed(2)}
                                          </option>
                                        );
                                      })}
                                    </select>
                                    
                                    {selectedProduct && (
                                      <div className="flex items-center gap-2">
                                        <label className="text-xs text-slate-600 font-semibold flex-1">Replacement Qty:</label>
                                        <input
                                          type="number"
                                          min="1"
                                          max={Math.min(selectedProduct.Quantity, saleItem?.QuantitySold || 1)}
                                          value={replacementQty}
                                          onChange={(e) => {
                                            const maxAllowed = Math.min(selectedProduct.Quantity, saleItem?.QuantitySold || 1);
                                            const qty = Math.min(Math.max(1, parseInt(e.target.value) || 1), maxAllowed);
                                            const qtyMap = new Map(replacementQuantity);
                                            qtyMap.set(itemIdx, qty);
                                            setReplacementQuantity(qtyMap);
                                            
                                            // Update the corresponding item quantity in Items to Return
                                            setItemQuantities({ ...itemQuantities, [itemIdx]: qty });
                                          }}
                                          className="w-24 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
                                        />
                                        <span className="text-xs text-slate-500">Max: {Math.min(selectedProduct.Quantity, saleItem?.QuantitySold || 1)}</span>
                                      </div>
                                    )}
                                    
                                    {/* Additional Replacement Products */}
                                    {itemReplacements.size > 0 && (
                                      <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <p className="text-xs text-slate-500 font-semibold">Additional Replacements:</p>
                                        {Array.from(itemReplacements.entries()).map(([productIdx, {code, qty}]) => {
                                          let product = stocks.find(s => s.ProductCode === code);
                                          if (!product && code.startsWith('ENTRY-')) {
                                            const entryId = parseInt(code.replace('ENTRY-', ''));
                                            product = stocks.find(s => s.StockEntryID === entryId);
                                          }
                                          
                                          return (
                                            <div key={productIdx} className="space-y-2 bg-white p-3 rounded border border-gray-200">
                                              <div className="flex items-center justify-between">
                                                <span className="text-xs text-slate-600 font-semibold">Additional Product {productIdx + 1}:</span>
                                                <button
                                                  onClick={() => {
                                                    const newReplacements = new Map(itemReplacements);
                                                    newReplacements.delete(productIdx);
                                                    const newMultiple = new Map(multipleReplacements);
                                                    if (newReplacements.size > 0) {
                                                      newMultiple.set(itemIdx, newReplacements);
                                                    } else {
                                                      newMultiple.delete(itemIdx);
                                                    }
                                                    setMultipleReplacements(newMultiple);
                                                  }}
                                                  className="text-red-600 hover:text-red-800 text-xs font-semibold"
                                                >
                                                  Remove
                                                </button>
                                              </div>
                                              
                                              <select
                                                value={code || ''}
                                                onChange={(e) => {
                                                  const newCode = e.target.value;
                                                  const newReplacements = new Map(itemReplacements);
                                                  newReplacements.set(productIdx, {...(itemReplacements.get(productIdx) || {qty: 1}), code: newCode});
                                                  
                                                  const newMultiple = new Map(multipleReplacements);
                                                  newMultiple.set(itemIdx, newReplacements);
                                                  setMultipleReplacements(newMultiple);
                                                }}
                                                className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
                                              >
                                                <option value="">-- Select product --</option>
                                                {stocks.map((stock) => {
                                                  const stockCode = stock.ProductCode || `ENTRY-${stock.StockEntryID}`;
                                                  return (
                                                    <option key={stock.StockEntryID} value={stockCode}>
                                                      {stock.Particulars || 'Unknown'} - Code: {stockCode} | Stock: {stock.Quantity} | Price: {currencySymbol}{((stock.SellingPrice || stock.UnitPrice) || 0).toFixed(2)}
                                                    </option>
                                                  );
                                                })}
                                              </select>
                                              
                                              {code && (
                                                <div className="flex items-center gap-2">
                                                  <label className="text-xs text-slate-600 font-semibold flex-1">Qty:</label>
                                                  <QuantityInput
                                                    value={qty}
                                                    min={1}
                                                    max={999}
                                                    onChange={(newQty) => {
                                                      const newReplacements = new Map(itemReplacements);
                                                      newReplacements.set(productIdx, {...(itemReplacements.get(productIdx) || {code}), qty: newQty});
                                                      
                                                      const newMultiple = new Map(multipleReplacements);
                                                      newMultiple.set(itemIdx, newReplacements);
                                                      setMultipleReplacements(newMultiple);
                                                    }}
                                                  />
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                    
                                    {/* Add More Replacement Products Button */}
                                    {selectedProduct && (
                                      <button
                                        onClick={() => {
                                          const newReplacements = new Map(itemReplacements);
                                          const newIdx = itemReplacements.size;
                                          newReplacements.set(newIdx, {code: '', qty: 1});
                                          
                                          const newMultiple = new Map(multipleReplacements);
                                          newMultiple.set(itemIdx, newReplacements);
                                          setMultipleReplacements(newMultiple);
                                        }}
                                        className="w-full py-2 px-3 bg-green-50 text-green-700 font-semibold text-xs rounded-lg hover:bg-green-100 transition-colors border border-green-200"
                                      >
                                        + Add Another Replacement Product
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Price Summary - Shown for both Change and Damage */}
                      {selectedStockItems.size > 0 && actionType === 'change' && selectedReplacementProduct.size > 0 && (
                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                          <p className="text-xs text-slate-600 font-semibold mb-3">EXCHANGE SUMMARY (Replacement Price Must Be Equal or Higher)</p>
                          <div className="space-y-3">
                            {Array.from(selectedStockItems).map((itemIdx) => {
                              const returnedItem = saleItems[itemIdx];
                              const returnedQty = itemQuantities[itemIdx] || 1;
                              const returnedPrice = returnedItem?.SellingPrice || returnedItem?.UnitPrice || 0;
                              
                              const productCode = selectedReplacementProduct.get(itemIdx);
                              let replacementProduct;
                              if (productCode) {
                                replacementProduct = stocks.find(s => s.ProductCode === productCode);
                                if (!replacementProduct && productCode.startsWith('ENTRY-')) {
                                  const entryId = parseInt(productCode.replace('ENTRY-', ''));
                                  replacementProduct = stocks.find(s => s.StockEntryID === entryId);
                                }
                              }
                              
                              const replacementQty = replacementQuantity.get(itemIdx) || 1;
                              const replacementPrice = replacementProduct?.SellingPrice || replacementProduct?.UnitPrice || 0;
                              
                              // Calculate returned item total
                              const returnedTotal = returnedQty * returnedPrice;
                              
                              // Calculate totals including additional items
                              const primaryReplacementTotal = replacementQty * replacementPrice;
                              let additionalQty = 0;
                              let additionalTotal = 0;
                              multipleReplacements.get(itemIdx)?.forEach(({code, qty}) => {
                                let product = stocks.find(s => s.ProductCode === code);
                                if (!product && code.startsWith('ENTRY-')) {
                                  const entryId = parseInt(code.replace('ENTRY-', ''));
                                  product = stocks.find(s => s.StockEntryID === entryId);
                                }
                                const price = product?.SellingPrice || product?.UnitPrice || 0;
                                additionalTotal += qty * price;
                                additionalQty += qty;
                              });
                              
                              const totalReplacementValue = primaryReplacementTotal + additionalTotal;
                              const totalReplacementQty = replacementQty + additionalQty;
                              const priceDifference = totalReplacementValue - returnedTotal;
                              const hasAdditionalPayment = priceDifference > 0.01;
                              const isValidExchange = priceDifference >= -0.01; // Allow equal or more (with payment)
                              
                              return (
                                <div key={itemIdx} className={`p-4 rounded-lg border-2 ${isValidExchange ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                                  {/* Header */}
                                  <div className="flex justify-between items-center mb-3 pb-2 border-b-2" style={{ borderColor: isValidExchange ? '#86efac' : '#fca5a5' }}>
                                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: isValidExchange ? '#16a34a' : '#dc2626' }}>
                                      Item {itemIdx + 1}
                                    </p>
                                    <p className={`text-xs font-bold uppercase ${isValidExchange ? 'text-green-700' : 'text-red-700'}`}>
                                      {isValidExchange ? (hasAdditionalPayment ? '✓ WITH ADDITIONAL PAYMENT' : '✓ VALID EXCHANGE') : '✗ INVALID EXCHANGE'}
                                    </p>
                                  </div>
                                  
                                  {/* Returned Item */}
                                  <div className="mb-3">
                                    <p className="text-xs font-semibold text-slate-600 mb-1.5">RETURNED ITEM</p>
                                    <div className="flex justify-between items-start bg-white bg-opacity-50 p-2.5 rounded">
                                      <div>
                                        <p className="text-sm font-semibold text-slate-800">{returnedItem?.ProductName}</p>
                                        <p className="text-xs text-slate-600 mt-0.5">
                                          Qty: <span className="font-semibold">{returnedQty}</span> × {currencySymbol}<span className="font-semibold">{returnedPrice.toFixed(2)}</span>
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-bold text-slate-800">{currencySymbol}{returnedTotal.toFixed(2)}</p>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Comparison Details */}
                                  <div className="mb-3 p-2.5 bg-white bg-opacity-50 rounded space-y-1.5">
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-slate-600">Returned Value:</span>
                                      <span className="text-xs font-semibold text-slate-800">{currencySymbol}{returnedTotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-slate-600">Replacement Value:</span>
                                      <span className={`text-xs font-bold ${!hasAdditionalPayment ? 'text-green-700' : 'text-blue-700'}`}>
                                        {hasAdditionalPayment ? `${currencySymbol}${totalReplacementValue.toFixed(2)} (${currencySymbol}${priceDifference.toFixed(2)} more)` : `✓ ${currencySymbol}${totalReplacementValue.toFixed(2)}`}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {/* Replacement Item(s) */}
                                  <div>
                                    <p className="text-xs font-semibold text-slate-600 mb-1.5">REPLACEMENT ITEM(S)</p>
                                    
                                    {/* Primary Replacement */}
                                    <div className="flex justify-between items-start bg-white bg-opacity-50 p-2.5 rounded mb-2">
                                      <div>
                                        <p className="text-sm font-semibold text-slate-800">{replacementProduct?.Particulars || 'Not selected'}</p>
                                        <p className="text-xs text-slate-600 mt-0.5">
                                          Qty: <span className="font-semibold">{replacementQty}</span> × {currencySymbol}<span className="font-semibold">{replacementPrice.toFixed(2)}</span>
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-bold text-slate-800">{currencySymbol}{primaryReplacementTotal.toFixed(2)}</p>
                                      </div>
                                    </div>
                                    
                                    {/* Additional Replacements */}
                                    {multipleReplacements.get(itemIdx)?.size > 0 && (
                                      <div className="space-y-2 bg-yellow-50 p-2.5 rounded border border-yellow-200 mb-2">
                                        <p className="text-xs font-semibold text-yellow-700">+ Additional Replacements:</p>
                                        {Array.from(multipleReplacements.get(itemIdx)?.entries() || []).map(([additionalIdx, {code, qty}]) => {
                                          let additionalProduct = stocks.find(s => s.ProductCode === code);
                                          if (!additionalProduct && code.startsWith('ENTRY-')) {
                                            const entryId = parseInt(code.replace('ENTRY-', ''));
                                            additionalProduct = stocks.find(s => s.StockEntryID === entryId);
                                          }
                                          
                                          const additionalPrice = additionalProduct?.SellingPrice || additionalProduct?.UnitPrice || 0;
                                          const addlTotal = qty * additionalPrice;
                                          
                                          return (
                                            <div key={additionalIdx} className="flex justify-between items-start bg-white bg-opacity-70 p-2 rounded text-sm">
                                              <div>
                                                <p className="font-semibold text-slate-800">{additionalProduct?.Particulars || 'Unknown'}</p>
                                                <p className="text-xs text-slate-600 mt-0.5">
                                                  Qty: <span className="font-semibold">{qty}</span> × {currencySymbol}<span className="font-semibold">{additionalPrice.toFixed(2)}</span>
                                                </p>
                                              </div>
                                              <div className="text-right">
                                                <p className="font-bold text-slate-800">{currencySymbol}{addlTotal.toFixed(2)}</p>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                    
                                    {/* Total Replacement Value */}
                                    <div className={`${isValidExchange ? 'bg-green-50 border-l-4 border-green-400' : 'bg-red-50 border-l-4 border-red-400'} p-2.5 rounded`}>
                                      <div className="flex justify-between items-center">
                                        <span className={`text-xs font-semibold ${isValidExchange ? 'text-green-700' : 'text-red-700'}`}>TOTAL REPLACEMENT VALUE:</span>
                                        <span className={`text-sm font-bold ${isValidExchange ? 'text-green-700' : 'text-red-700'}`}>{currencySymbol}{totalReplacementValue.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}



                      {/* Additional Payment Input */}
                      {selectedStockItems.size > 0 && actionType === 'change' && selectedReplacementProduct.size > 0 && (() => {
                        // Check if any item has additional payment
                        let hasAnyAdditionalPayment = false;
                        Array.from(selectedStockItems).forEach((itemIdx) => {
                          const returnedItem = saleItems[itemIdx];
                          const returnedQty = itemQuantities[itemIdx] || 1;
                          const returnedPrice = returnedItem?.SellingPrice || returnedItem?.UnitPrice || 0;
                          const returnedTotal = returnedQty * returnedPrice;
                          
                          const productCode = selectedReplacementProduct.get(itemIdx);
                          let replacementProduct;
                          if (productCode) {
                            replacementProduct = stocks.find(s => s.ProductCode === productCode);
                            if (!replacementProduct && productCode.startsWith('ENTRY-')) {
                              const entryId = parseInt(productCode.replace('ENTRY-', ''));
                              replacementProduct = stocks.find(s => s.StockEntryID === entryId);
                            }
                          }
                          
                          const replacementQty = replacementQuantity.get(itemIdx) || 1;
                          const replacementPrice = replacementProduct?.SellingPrice || replacementProduct?.UnitPrice || 0;
                          const primaryReplacementTotal = replacementQty * replacementPrice;
                          
                          let additionalTotal = 0;
                          multipleReplacements.get(itemIdx)?.forEach(({code, qty}) => {
                            let product = stocks.find(s => s.ProductCode === code);
                            if (!product && code.startsWith('ENTRY-')) {
                              const entryId = parseInt(code.replace('ENTRY-', ''));
                              product = stocks.find(s => s.StockEntryID === entryId);
                            }
                            const price = product?.SellingPrice || product?.UnitPrice || 0;
                            additionalTotal += qty * price;
                          });
                          
                          const totalReplacementValue = primaryReplacementTotal + additionalTotal;
                          const priceDifference = totalReplacementValue - returnedTotal;
                          const hasAdditionalPayment = priceDifference > 0.01;
                          
                          if (hasAdditionalPayment) {
                            hasAnyAdditionalPayment = true;
                          }
                        });
                        
                        return hasAnyAdditionalPayment;
                      })() && (
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                          <label className="block text-sm font-semibold text-amber-900 mb-3">Additional Payment Required</label>
                          <div className="space-y-3">
                            {Array.from(selectedStockItems).map((itemIdx) => {
                              const returnedItem = saleItems[itemIdx];
                              const returnedQty = itemQuantities[itemIdx] || 1;
                              const returnedPrice = returnedItem?.SellingPrice || returnedItem?.UnitPrice || 0;
                              const returnedTotal = returnedQty * returnedPrice;
                              
                              const productCode = selectedReplacementProduct.get(itemIdx);
                              let replacementProduct;
                              if (productCode) {
                                replacementProduct = stocks.find(s => s.ProductCode === productCode);
                                if (!replacementProduct && productCode.startsWith('ENTRY-')) {
                                  const entryId = parseInt(productCode.replace('ENTRY-', ''));
                                  replacementProduct = stocks.find(s => s.StockEntryID === entryId);
                                }
                              }
                              
                              const replacementQty = replacementQuantity.get(itemIdx) || 1;
                              const replacementPrice = replacementProduct?.SellingPrice || replacementProduct?.UnitPrice || 0;
                              const primaryReplacementTotal = replacementQty * replacementPrice;
                              
                              let additionalTotal = 0;
                              multipleReplacements.get(itemIdx)?.forEach(({code, qty}) => {
                                let product = stocks.find(s => s.ProductCode === code);
                                if (!product && code.startsWith('ENTRY-')) {
                                  const entryId = parseInt(code.replace('ENTRY-', ''));
                                  product = stocks.find(s => s.StockEntryID === entryId);
                                }
                                const price = product?.SellingPrice || product?.UnitPrice || 0;
                                additionalTotal += qty * price;
                              });
                              
                              const totalReplacementValue = primaryReplacementTotal + additionalTotal;
                              const priceDifference = totalReplacementValue - returnedTotal;
                              const hasAdditionalPayment = priceDifference > 0.01;
                              
                              return hasAdditionalPayment ? (
                                <div key={itemIdx} className="bg-white p-3.5 rounded-lg border border-amber-100">
                                  <div className="grid grid-cols-3 gap-2 mb-3">
                                    <div>
                                      <p className="text-xs text-slate-600 font-semibold">Returned Value</p>
                                      <p className="text-sm font-bold text-slate-800">{currencySymbol}{returnedTotal.toFixed(2)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-600 font-semibold">Replacement Value</p>
                                      <p className="text-sm font-bold text-slate-800">{currencySymbol}{totalReplacementValue.toFixed(2)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-amber-700 font-semibold">Due Amount</p>
                                      <p className="text-sm font-bold text-amber-700">{currencySymbol}{priceDifference.toFixed(2)}</p>
                                    </div>
                                  </div>
                                  <label className="block text-xs text-slate-600 font-semibold mb-2">Amount to Collect *</label>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-800">{currencySymbol}</span>
                                    <PriceInput
                                      value={additionalPayment || ''}
                                      onChange={(val) => setAdditionalPayment(val)}
                                      placeholder={priceDifference.toFixed(2)}
                                      min={0}
                                    />
                                    <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">Min: {currencySymbol}{priceDifference.toFixed(2)}</span>
                                  </div>
                                  {additionalPayment > 0 && additionalPayment < priceDifference && (
                                    <p className="text-xs text-red-600 mt-2 font-semibold">⚠️ Amount should be at least {currencySymbol}{priceDifference.toFixed(2)}</p>
                                  )}
                                </div>
                              ) : null;
                            })}
                          </div>
                        </div>
                      )}

                      {/* Reason */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-600 mb-2">Reason *</label>
                        <textarea
                          value={reason}
                          onChange={(e) => handleReasonChange(e.target.value)}
                          placeholder={actionType === 'change' ? 'e.g., Defective product, wrong item, customer preference' : 'e.g., Package damaged, expiration date passed, broke during handling'}
                          rows={3}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                        />
                      </div>

                      {/* Validation Errors */}
                      {priceValidationError && (
                        <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                          <p className="text-sm text-red-700 font-semibold">⚠️ {priceValidationError}</p>
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
                          onClick={handleProcessTransaction}
                          disabled={
                            isSubmitting ||
                            selectedStockItems.size === 0 ||
                            !reason.trim()
                          }
                          className="flex-1 py-2.5 px-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSubmitting ? 'Processing...' : actionType === 'change' ? 'Process Change' : 'Mark as Damaged'}
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

      {activeTab === 'history' && (
        <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 space-y-4">
            {/* Search and Date Filter Row */}
            <div className="flex flex-col md:flex-row gap-3 md:items-end">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search exchanges..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Date Filters - Desktop */}
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

            {/* Date Filters - Mobile */}
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
              <Loader size={24} className="animate-spin mx-auto text-slate-400 mb-2" />
              <p className="text-slate-600">Loading exchange history...</p>
            </div>
          ) : filteredHistory.length > 0 ? (
            <>
              {/* Desktop View */}
              <div className="hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ tableLayout: 'fixed' }}>
                    <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Change ID</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Sale ID</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Returned Item</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase">Qty</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Given Item</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase">Qty</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Returned Value</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Given Value</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Payment</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Date</th>
                      </tr>
                    </thead>
                  </table>
                  <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                    <table className="w-full" style={{ tableLayout: 'fixed' }}>
                      <tbody className="divide-y divide-gray-100">
                        {filteredHistory
                          .filter(item => {
                            if (!historyFilter.startDate && !historyFilter.endDate) return true;
                            
                            const itemDate = new Date(item.DateProcessed);
                            const startDate = historyFilter.startDate ? new Date(historyFilter.startDate) : null;
                            const endDate = historyFilter.endDate ? new Date(historyFilter.endDate) : null;
                            
                            if (startDate && itemDate < startDate) return false;
                            if (endDate) {
                              const endDateWithTime = new Date(endDate);
                              endDateWithTime.setHours(23, 59, 59, 999);
                              if (itemDate > endDateWithTime) return false;
                            }
                            return true;
                          })
                          .map((item) => (
                            <tr key={item.ChangeID} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-bold text-slate-800">#{item.ChangeID}</td>
                              <td className="px-4 py-3 text-sm text-slate-700">#{item.OriginalSaleID}</td>
                              <td className="px-4 py-3 text-sm text-slate-700">{item.ItemReturnedName || 'N/A'}</td>
                              <td className="px-4 py-3 text-center text-sm font-semibold text-slate-800">{item.QtyReturned}</td>
                              <td className="px-4 py-3 text-sm text-slate-700">{item.ItemGiven}</td>
                              <td className="px-4 py-3 text-center text-sm font-semibold text-slate-800">{item.QtyGiven}</td>
                              <td className="px-4 py-3 text-right text-sm text-slate-700">{currencySymbol}{formatPrice(item.ReturnedItemPrice)}</td>
                              <td className="px-4 py-3 text-right text-sm text-slate-700">{currencySymbol}{formatPrice(item.ItemGivenPrice)}</td>
                              <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{item.AdditionalPayment && parseFloat(String(item.AdditionalPayment)) > 0 ? `+${currencySymbol}${formatPrice(item.AdditionalPayment)}` : '-'}</td>
                              <td className="px-4 py-3 text-sm text-slate-600">
                                {formatDateTime(item.DateProcessed)}
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
                  {filteredHistory
                    .filter(item => {
                      if (!historyFilter.startDate && !historyFilter.endDate) return true;
                      
                      const itemDate = new Date(item.DateProcessed);
                      const startDate = historyFilter.startDate ? new Date(historyFilter.startDate) : null;
                      const endDate = historyFilter.endDate ? new Date(historyFilter.endDate) : null;
                      
                      if (startDate && itemDate < startDate) return false;
                      if (endDate) {
                        const endDateWithTime = new Date(endDate);
                        endDateWithTime.setHours(23, 59, 59, 999);
                        if (itemDate > endDateWithTime) return false;
                      }
                      return true;
                    })
                    .map((item) => (
                      <div
                        key={item.ChangeID}
                        onClick={() => {
                          setSelectedHistoryItem(item);
                          setIsModalOpen(true);
                        }}
                        className="p-4 hover:bg-gray-50 transition-colors active:bg-gray-100 cursor-pointer"
                      >
                        <div className="space-y-2 mb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs text-slate-500 font-semibold">Change ID</p>
                              <p className="font-bold text-slate-800">#{item.ChangeID}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-500 font-semibold">Sale ID</p>
                              <p className="text-sm text-slate-700">#{item.OriginalSaleID}</p>
                            </div>
                          </div>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs text-slate-500 font-semibold">Returned Item</p>
                              <p className="text-sm text-slate-700">{item.ItemReturnedName || 'N/A'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-500 font-semibold">Qty</p>
                              <p className="text-sm font-semibold text-slate-800">{item.QtyReturned}</p>
                            </div>
                          </div>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs text-slate-500 font-semibold">Given Item</p>
                              <p className="text-sm text-slate-700">{item.ItemGiven}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-500 font-semibold">Qty</p>
                              <p className="text-sm font-semibold text-slate-800">{item.QtyGiven}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs text-slate-500 font-semibold">Returned Value</p>
                              <p className="text-sm font-semibold text-slate-800">{currencySymbol}{formatPrice(item.ReturnedItemPrice)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-semibold">Given Value</p>
                              <p className="text-sm font-semibold text-slate-800">{currencySymbol}{formatPrice(item.ItemGivenPrice)}</p>
                            </div>
                          </div>
                          {item.AdditionalPayment && parseFloat(String(item.AdditionalPayment)) > 0 && (
                            <div className="bg-amber-50 border border-amber-200 p-2 rounded">
                              <p className="text-xs text-amber-600 font-semibold">Additional Payment: <span className="text-amber-700 font-bold">{currencySymbol}{formatPrice(item.AdditionalPayment)}</span></p>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-xs text-slate-500 font-semibold">Date</p>
                              <p className="text-sm text-slate-600">{formatDateTime(item.DateProcessed)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="border-t border-gray-100 pt-3">
                          <p className="text-xs text-slate-500 font-semibold mb-1">Reason</p>
                          <p className="text-sm text-slate-700">{item.Reason}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Modal for Full Details */}
              {isModalOpen && selectedHistoryItem && (
                <>
                  {createPortal(
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end md:items-center md:justify-center">
                      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:w-96 max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center rounded-t-2xl">
                          <h3 className="font-bold text-slate-800">Exchange Details</h3>
                          <button
                            onClick={() => {
                              setIsModalOpen(false);
                              setSelectedHistoryItem(null);
                            }}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X size={24} />
                          </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-4 space-y-4">
                          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                            <p className="text-xs text-slate-600 font-semibold mb-1">Change ID</p>
                            <p className="text-lg font-bold text-blue-700">#{selectedHistoryItem.ChangeID}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-slate-600 font-semibold mb-2">Item Returned</p>
                              <p className="text-sm text-slate-800">{selectedHistoryItem.ItemReturnedName || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600 font-semibold mb-2">Qty Returned</p>
                              <p className="text-sm font-bold text-slate-800">{selectedHistoryItem.QtyReturned}</p>
                            </div>
                          </div>

                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-slate-600 font-semibold mb-1">Returned Item Value</p>
                            <p className="text-lg font-bold text-slate-800">{currencySymbol}{formatPrice(selectedHistoryItem.ReturnedItemPrice)}</p>
                          </div>

                          <div className="flex items-center justify-center py-2">
                            <ArrowRight size={20} className="text-slate-400" />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-slate-600 font-semibold mb-2">Item Given</p>
                              <p className="text-sm text-slate-800">{selectedHistoryItem.ItemGiven}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600 font-semibold mb-2">Qty Given</p>
                              <p className="text-sm font-bold text-slate-800">{selectedHistoryItem.QtyGiven}</p>
                            </div>
                          </div>

                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-slate-600 font-semibold mb-1">Given Item Value</p>
                            <p className="text-lg font-bold text-slate-800">{currencySymbol}{formatPrice(selectedHistoryItem.ItemGivenPrice)}</p>
                          </div>

                          {selectedHistoryItem.AdditionalPayment && parseFloat(String(selectedHistoryItem.AdditionalPayment)) > 0 && (
                            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                              <p className="text-xs text-amber-600 font-semibold mb-1">Additional Payment Required</p>
                              <p className="text-lg font-bold text-amber-700">{currencySymbol}{formatPrice(selectedHistoryItem.AdditionalPayment)}</p>
                              <p className="text-xs text-amber-600 mt-1">Price difference: {currencySymbol}{formatPrice(selectedHistoryItem.PriceDifference)}</p>
                            </div>
                          )}

                          <div className="border-t border-gray-200 pt-4">
                            <p className="text-xs text-slate-600 font-semibold mb-2">Reason</p>
                            <p className="text-sm text-slate-800">{selectedHistoryItem.Reason}</p>
                          </div>

                          <div className="border-t border-gray-200 pt-4">
                            <p className="text-xs text-slate-600 font-semibold mb-2">Original Sale ID</p>
                            <p className="text-sm text-slate-800">#{selectedHistoryItem.OriginalSaleID}</p>
                          </div>

                          <div className="border-t border-gray-200 pt-4">
                            <p className="text-xs text-slate-600 font-semibold mb-2">Date Processed</p>
                            <p className="text-sm text-slate-800">{formatDateTime(selectedHistoryItem.DateProcessed)}</p>
                          </div>

                          {selectedHistoryItem.ProcessedByName && (
                            <div className="border-t border-gray-200 pt-4">
                              <p className="text-xs text-slate-600 font-semibold mb-2">Processed By</p>
                              <p className="text-sm text-slate-800">{selectedHistoryItem.ProcessedByName}</p>
                            </div>
                          )}

                          <button
                            onClick={() => {
                              setIsModalOpen(false);
                              setSelectedHistoryItem(null);
                            }}
                            className="w-full mt-6 py-2.5 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}
                </>
              )}
            </>
          ) : (
            <div className="p-8 text-center">
              <CheckCircle size={32} className="mx-auto text-green-600 mb-2" />
              <p className="text-slate-600 font-semibold">No exchanges recorded</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChangeItem;