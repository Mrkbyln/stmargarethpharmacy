import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { usePharmacy } from '../context/PharmacyContext';
import apiClient from '../lib/apiClient';
import { AlertTriangle, Check, Search, Eye, X, CheckCircle, XCircle, Trash2, Plus, Loader, Download, FileText } from 'lucide-react';
import { createPortal } from 'react-dom';
import html2pdf from 'html2pdf.js';

// Memoized quantity input component to prevent unnecessary re-renders
interface QuantityInputProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

const QuantityInput = memo<QuantityInputProps>(({ value, min, max, onChange }) => {
  const { themeColor } = usePharmacy();
  const isDarkTheme = themeColor === 'black';
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
      className={`w-16 px-2 py-1 border rounded text-sm focus:outline-none ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white focus:border-red-500' : 'border-gray-200 focus:border-red-500'}`}
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

// Debounced/local reason input to avoid re-render lag while typing
interface ReasonInputProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

const ReasonInput = React.forwardRef<HTMLTextAreaElement, ReasonInputProps>(({ value, onChange, placeholder = '', rows = 3 }, ref) => {
  const { themeColor } = usePharmacy();
  const isDarkTheme = themeColor === 'black';
  const [localValue, setLocalValue] = useState<string>(value || '');

  // Keep local value in sync when parent value changes (e.g., modal reset)
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  // Debounce updates to parent to reduce frequent parent re-renders
  useEffect(() => {
    const t = setTimeout(() => onChange(localValue), 200);
    return () => clearTimeout(t);
  }, [localValue, onChange]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalValue(e.target.value);
  };

  const handleBlur = () => {
    // Flush immediately on blur
    onChange(localValue);
  };

  return (
    <textarea
      ref={ref}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      rows={rows}
      className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none resize-none ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500' : 'border-gray-200 focus:border-red-500 focus:ring-1 focus:ring-red-500'}`}
    />
  );
});

ReasonInput.displayName = 'ReasonInput';

const DamagedItems: React.FC = () => {
  const { currencySymbol, user, themeColor } = usePharmacy();
  const isDarkTheme = themeColor === 'black';
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
  const [saleItemReplacements, setSaleItemReplacements] = useState<Map<number, { stockEntryId: number; qty: number }[]>>(new Map());
  const [damageNote, setDamageNote] = useState('');
  const [dueAmount, setDueAmount] = useState<number | ''>('');
  const [additionalPayment, setAdditionalPayment] = useState<number>(0);
  const [historyFilter, setHistoryFilter] = useState({
    startDate: '',
    endDate: ''
  });
  const [processedSaleIds, setProcessedSaleIds] = useState<Set<number>>(new Set());
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [debouncedModalSearchTerm, setDebouncedModalSearchTerm] = useState('');
  const [replacementSearchTerm, setReplacementSearchTerm] = useState<Record<number, string>>({});
  const [openReplacementDropdown, setOpenReplacementDropdown] = useState<number | null>(null);
  const [debouncedReplacementSearchTerm, setDebouncedReplacementSearchTerm] = useState<Record<number, string>>({});

  const clearFilters = () => {
    setSearchTerm('');
    setHistoryFilter({ startDate: '', endDate: '' });
  };

  // Pagination state for Mark, Processed and History tables
  const [markCurrentPage, setMarkCurrentPage] = useState<number>(1);
  const [markPageSize, setMarkPageSize] = useState<number>(10);

  const [processedCurrentPage, setProcessedCurrentPage] = useState<number>(1);
  const [processedPageSize, setProcessedPageSize] = useState<number>(10);

  const [historyCurrentPage, setHistoryCurrentPage] = useState<number>(1);
  const [historyPageSize, setHistoryPageSize] = useState<number>(10);

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

  // Debounce modal search to avoid heavy filtering on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedModalSearchTerm(modalSearchTerm), 200);
    return () => clearTimeout(t);
  }, [modalSearchTerm]);

  const filteredModalStocks = useMemo(() => {
    const search = debouncedModalSearchTerm.toLowerCase();
    return stocks.filter(s => {
      const productName = (s.ProductName || s.Particulars || '').toLowerCase();
      const batchNumber = (s.BatchNumber || '').toLowerCase();
      const productCode = (s.ProductCode || '').toLowerCase();
      const hasStock = (s.Quantity || 0) > 0;
      const isNotExpired = !s.ExpirationDate || new Date(s.ExpirationDate) > new Date();
      return (hasStock && isNotExpired) && (productName.includes(search) || batchNumber.includes(search) || productCode.includes(search));
    });
  }, [stocks, debouncedModalSearchTerm]);

  // Debounce replacement search terms to avoid expensive filtering on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedReplacementSearchTerm(replacementSearchTerm), 250);
    return () => clearTimeout(t);
  }, [replacementSearchTerm]);

  // Precompute filtered replacement options per selected sale item to avoid re-filtering on every render
  const filteredReplacementOptions = useMemo(() => {
    const map = new Map<number, any[]>();
    Array.from(selectedSaleItems).forEach((itemIdx) => {
      const returnedItem = saleItems[itemIdx];
      const search = (debouncedReplacementSearchTerm[itemIdx] || '').toLowerCase();
      const list = stocks.filter((stock) => {
        const isSameProduct = stock.ProductID === returnedItem?.ProductID;
        const quantity = parseInt(String(stock.Quantity)) || 0;
        if (isSameProduct || quantity <= 0) return false;
        if (stock.ExpirationDate) {
          const expirationDate = new Date(stock.ExpirationDate);
          expirationDate.setHours(23, 59, 59, 999);
          if (expirationDate < new Date()) return false;
        }
        const productName = (stock.ProductName || stock.Particulars || '').toLowerCase();
        return productName.includes(search);
      });
      map.set(itemIdx, list);
    });
    return map;
  }, [stocks, saleItems, debouncedReplacementSearchTerm, selectedSaleItems]);

  // Memoize exchange calculations to avoid recalculation on every keystroke
  const exchangeData = useMemo(() => {
    const perItem = new Map<number, any>();
    let totalReturnedValue = 0;
    let totalReplacementValue = 0;

    Array.from(selectedSaleItems).forEach((itemIdx) => {
      const returnedItem = saleItems[itemIdx];
      const returnedQty = saleItemQuantities[itemIdx] || 1;
      const returnedPrice = returnedItem?.SellingPrice || returnedItem?.UnitPrice || 0;
      const returnedTotal = returnedQty * returnedPrice;
      totalReturnedValue += returnedTotal;

      const replacements = saleItemReplacements.get(itemIdx) || [];
      let replacementTotal = 0;
      const detailed = replacements.map((r: any) => {
        const prod = stocks.find(s => s.StockEntryID === r.stockEntryId || String(s.StockEntryID) === String(r.stockEntryId));
        const price = typeof (prod?.SellingPrice || prod?.UnitPrice) === 'string' ? parseFloat(prod?.SellingPrice || prod?.UnitPrice || '0') : (prod?.SellingPrice || prod?.UnitPrice || 0);
        const lineTotal = (r.qty || 1) * price;
        replacementTotal += lineTotal;
        return { ...r, product: prod, price, lineTotal };
      });

      totalReplacementValue += replacementTotal;
      perItem.set(itemIdx, { returnedQty, returnedPrice, returnedTotal, replacements: detailed, replacementTotal });
    });

    const totalDue = totalReplacementValue - totalReturnedValue;
    return { perItem, totals: { totalReturnedValue, totalReplacementValue, totalDue, isPriceMismatch: totalDue < -0.01 } };
  }, [selectedSaleItems, saleItemQuantities, saleItems, saleItemReplacements, stocks]);

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

  // --- Pagination helpers ---
  const markTotalPages = Math.max(1, Math.ceil(filteredStocks.length / markPageSize));
  useEffect(() => { setMarkCurrentPage(1); }, [searchTerm, markPageSize, filteredStocks.length, modalSearchTerm]);
  const paginatedStocks = useMemo(() => {
    const start = (markCurrentPage - 1) * markPageSize;
    return filteredStocks.slice(start, start + markPageSize);
  }, [filteredStocks, markCurrentPage, markPageSize]);

  const processedTotalPages = Math.max(1, Math.ceil(filteredSales.length / processedPageSize));
  useEffect(() => { setProcessedCurrentPage(1); }, [searchTerm, processedPageSize, filteredSales.length]);
  const paginatedSales = useMemo(() => {
    const start = (processedCurrentPage - 1) * processedPageSize;
    return filteredSales.slice(start, start + processedPageSize);
  }, [filteredSales, processedCurrentPage, processedPageSize]);

  const historyTotalPages = Math.max(1, Math.ceil(filteredDamagedItems.length / historyPageSize));
  useEffect(() => { setHistoryCurrentPage(1); }, [searchTerm, historyFilter.startDate, historyFilter.endDate, historyPageSize, filteredDamagedItems.length]);
  const paginatedDamagedItems = useMemo(() => {
    const start = (historyCurrentPage - 1) * historyPageSize;
    return filteredDamagedItems.slice(start, start + historyPageSize);
  }, [filteredDamagedItems, historyCurrentPage, historyPageSize]);

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
    setModalSearchTerm('');
    setAdditionalPayment(0);
  };

  const exportDamagedItemsToCSV = () => {
    // Log action to audit trail
    const userId = user?.id ? Number(user.id) : undefined;
    apiClient.logAction('Exported Damaged Items CSV Report', userId).catch(err => console.error('Audit log failed:', err));
    
    // Get filtered data
    const dataToExport = filteredDamagedItems;

    if (dataToExport.length === 0) {
      alert('No damaged items to export');
      return;
    }

    const headers = ['Damaged ID', 'Product', 'Batch Number', 'Quantity', 'Replacement Product', 'Reason', 'Reported By', 'Date Reported'];
    const rows = dataToExport.map(item => [
      item.DamagedItemID,
      item.ProductName || 'N/A',
      item.BatchNumber || 'N/A',
      item.Quantity,
      item.ReplacementProduct || 'None',
      item.Reason,
      item.ReportedByName || 'N/A',
      new Date(item.DateReported).toLocaleString()
    ]);

    // Escape CSV values properly
    const escapeCSV = (value: any) => {
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    let csvContent = headers.map(escapeCSV).join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(escapeCSV).join(',') + '\n';
    });

    const BOM = '\uFEFF'; // UTF-8 BOM
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `damaged_items_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const exportDamagedItemsToPDF = async () => {
    // Log action to audit trail
    const userId = user?.id ? Number(user.id) : undefined;
    apiClient.logAction('Exported Damaged Items PDF Report', userId).catch(err => console.error('Audit log failed:', err));
    
    // Get filtered data
    const dataToExport = filteredDamagedItems;

    if (dataToExport.length === 0) {
      alert('No damaged items to export');
      return;
    }

    const element = document.createElement('div');
    element.style.padding = '20px';
    element.style.fontFamily = 'Arial, sans-serif';
    element.style.backgroundColor = 'white';
    element.style.color = '#000';
    
    // Build HTML content
    const htmlContent = `
      <h1 style="text-align: center; color: #333; margin-bottom: 10px; font-size: 24px; margin-top: 0;">Damaged Items Report</h1>
      <p style="text-align: center; color: #666; margin-bottom: 20px; font-size: 12px;">Generated on: ${new Date().toLocaleString()}</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="border: 1px solid #999; padding: 8px; text-align: left; font-weight: bold;">Damaged ID</th>
            <th style="border: 1px solid #999; padding: 8px; text-align: left; font-weight: bold;">Product</th>
            <th style="border: 1px solid #999; padding: 8px; text-align: left; font-weight: bold;">Batch</th>
            <th style="border: 1px solid #999; padding: 8px; text-align: center; font-weight: bold;">Qty</th>
            <th style="border: 1px solid #999; padding: 8px; text-align: left; font-weight: bold;">Replacement</th>
            <th style="border: 1px solid #999; padding: 8px; text-align: left; font-weight: bold;">Reason</th>
            <th style="border: 1px solid #999; padding: 8px; text-align: left; font-weight: bold;">Reported By</th>
            <th style="border: 1px solid #999; padding: 8px; text-align: left; font-weight: bold;">Date</th>
          </tr>
        </thead>
        <tbody>
          ${dataToExport.map(item => `
            <tr>
              <td style="border: 1px solid #999; padding: 8px;">${item.DamagedItemID}</td>
              <td style="border: 1px solid #999; padding: 8px;">${item.ProductName || 'N/A'}</td>
              <td style="border: 1px solid #999; padding: 8px;">${item.BatchNumber || 'N/A'}</td>
              <td style="border: 1px solid #999; padding: 8px; text-align: center;">${item.Quantity}</td>
              <td style="border: 1px solid #999; padding: 8px;">${item.ReplacementProduct || 'None'}</td>
              <td style="border: 1px solid #999; padding: 8px;">${item.Reason}</td>
              <td style="border: 1px solid #999; padding: 8px;">${item.ReportedByName || 'N/A'}</td>
              <td style="border: 1px solid #999; padding: 8px;">${new Date(item.DateReported).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    
    element.innerHTML = htmlContent;
    document.body.appendChild(element);

    try {
      // Wait for content to render
      await new Promise(resolve => setTimeout(resolve, 300));

      const opt = {
        margin: 8,
        filename: `damaged_items_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { orientation: 'landscape' as const, unit: 'mm' as const, format: 'a4' as const }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to export PDF. Please check the console for details.');
    } finally {
      if (document.body.contains(element)) {
        document.body.removeChild(element);
      }
    }
  };

  const resetSaleDetailsModal = () => {
    setShowSaleDetailsModal(false);
    setSelectedSale(null);
    setSaleItems([]);
    setSelectedSaleItems(new Set());
    setSaleItemQuantities({});
    setSaleItemReplacements(new Map());
    setDamageNote('');
    setDueAmount('');
    setSelectedReplacementProductId(null);
  };

  const handleProcessDamagedReturn = async () => {
    if (selectedSaleItems.size === 0 || !damageNote.trim()) {
      setError('Please select items to return and enter a note');
      return;
    }

    // Ensure each selected sale item has at least one replacement
    for (const itemIdx of Array.from(selectedSaleItems)) {
      const reps = saleItemReplacements.get(itemIdx) || [];
      if (!reps || reps.length === 0) {
        setError('Please select a replacement product for each returned item');
        return;
      }
    }

    // Validate price matching and additional payment
    let totalReturnedValue = 0;
    let totalReplacementValue = 0;

    for (const itemIdx of Array.from(selectedSaleItems)) {
      const returnedItem = saleItems[itemIdx];
      const returnedQty = saleItemQuantities[itemIdx] || 1;
      const returnedPrice = returnedItem?.SellingPrice || returnedItem?.UnitPrice || 0;
      totalReturnedValue += returnedQty * returnedPrice;

      const replacements = saleItemReplacements.get(itemIdx) || [];
      for (const rep of replacements) {
        const replacementProduct = stocks.find(s => s.StockEntryID === rep.stockEntryId || String(s.StockEntryID) === String(rep.stockEntryId));
        const replacementQty = rep.qty || 1;
        const replacementPrice = replacementProduct?.SellingPrice || replacementProduct?.UnitPrice || 0;
        totalReplacementValue += replacementQty * replacementPrice;
      }
    }

    const totalDue = totalReplacementValue - totalReturnedValue;

    // Check if prices match or if additional payment is required
    if (totalDue > 0.01) {
      // Additional payment is required
      if (typeof dueAmount === 'string' || dueAmount === 0) {
        setError('Please enter the additional payment amount');
        return;
      }
      if (Math.abs((dueAmount as number) - totalDue) > 0.01) {
        setError(`Additional payment amount must be ${currencySymbol}${totalDue.toFixed(2)}. You entered ${currencySymbol}${Number(dueAmount).toFixed(2)}`);
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
        const replacements = saleItemReplacements.get(itemIdx) || [];

        for (const rep of replacements) {
          const replacementProduct = stocks.find(s => s.StockEntryID === rep.stockEntryId || String(s.StockEntryID) === String(rep.stockEntryId));
          const replacementQty = rep.qty || 1;

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
            currentUserId: Number(user?.UserID || user?.id || null)
          });

          if (!replacementResponse.success) {
            setError(replacementResponse.message || 'Failed to process damaged return');
            setIsSubmitting(false);
            return;
          }
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
          <h2 className={`text-2xl font-extrabold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Damaged Items</h2>
          <p className={`font-medium ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Manage and track damaged stock</p>
        </div>
      </div>

      {successMessage && (
        <div className={`border p-4 rounded-xl flex items-start gap-3 ${isDarkTheme ? 'bg-green-900/30 border-green-700/50' : 'bg-green-50 border-green-200'}`}>
          <CheckCircle size={20} className={`mt-0.5 ${isDarkTheme ? 'text-green-400' : 'text-green-600'}`} />
          <div>
            <h3 className={`font-bold ${isDarkTheme ? 'text-green-400' : 'text-green-800'}`}>Success</h3>
            <p className={`text-sm ${isDarkTheme ? 'text-green-300' : 'text-green-700'}`}>{successMessage}</p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className={`flex gap-2 border-b ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
        <button
          onClick={() => setActiveTab('mark')}
          className={`px-4 py-3 font-semibold text-sm transition-colors ${
            activeTab === 'mark'
              ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] -mb-0.5'
              : `${isDarkTheme ? 'text-gray-400 hover:text-gray-200' : 'text-slate-600 hover:text-slate-800'}`
          }`}
        >
          Mark Items as Damaged
        </button>
        <button
          onClick={() => setActiveTab('processed')}
          className={`px-4 py-3 font-semibold text-sm transition-colors ${
            activeTab === 'processed'
              ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] -mb-0.5'
              : `${isDarkTheme ? 'text-gray-400 hover:text-gray-200' : 'text-slate-600 hover:text-slate-800'}`
          }`}
        >
          Processed Damaged Items
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-3 font-semibold text-sm transition-colors ${
            activeTab === 'history'
              ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] -mb-0.5'
              : `${isDarkTheme ? 'text-gray-400 hover:text-gray-200' : 'text-slate-600 hover:text-slate-800'}`
          }`}
        >
          Damaged History ({damagedItems.length})
        </button>
      </div>

      {activeTab === 'mark' && (
        <>
          {/* Stock List */}
          <div className={`rounded-xl shadow-sm border overflow-hidden ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`}>
            <div className={`p-4 border-b ${isDarkTheme ? 'border-gray-700 bg-gray-700/50' : 'border-gray-100 bg-gray-50'}`}>
              <div className="relative">
                <Search className={`absolute left-3 top-2.5 w-5 h-5 ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type="text"
                  placeholder="Search by product name, batch number..."
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500' : 'border-gray-200 focus:border-[var(--color-primary)]'}`}
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
                {/* Pagination Controls */}
                <div className={`p-2 mb-2 flex items-center justify-between gap-3 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>
                  <div className="text-sm">Showing <strong>{filteredStocks.length === 0 ? 0 : (markCurrentPage - 1) * markPageSize + 1}</strong> to <strong>{Math.min(markCurrentPage * markPageSize, filteredStocks.length)}</strong> of <strong>{filteredStocks.length}</strong></div>

                  <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full border shadow-sm ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                      <button
                        onClick={() => setMarkCurrentPage(1)}
                        disabled={markCurrentPage === 1}
                        className={`px-3 py-1 rounded-full text-sm font-medium disabled:opacity-40 transition-colors ${isDarkTheme ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-gray-50'}`}
                        title="First page"
                      >First</button>

                      <button
                        onClick={() => setMarkCurrentPage(p => Math.max(1, p - 1))}
                        disabled={markCurrentPage === 1}
                        className={`px-3 py-1 rounded-full text-sm font-medium disabled:opacity-40 transition-colors ${isDarkTheme ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-gray-50'}`}
                        title="Previous page"
                      >Prev</button>

                      <div className={`px-3 text-sm font-medium ${isDarkTheme ? 'text-gray-200' : 'text-slate-700'}`} aria-hidden>{markCurrentPage} of {markTotalPages}</div>

                      <button
                        onClick={() => setMarkCurrentPage(p => Math.min(markTotalPages, p + 1))}
                        disabled={markCurrentPage === markTotalPages}
                        className={`px-3 py-1 rounded-full text-sm font-medium disabled:opacity-40 transition-colors ${isDarkTheme ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-gray-50'}`}
                        title="Next page"
                      >Next</button>

                      <button
                        onClick={() => setMarkCurrentPage(markTotalPages)}
                        disabled={markCurrentPage === markTotalPages}
                        className={`px-3 py-1 rounded-full text-sm font-medium disabled:opacity-40 transition-colors ${isDarkTheme ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-gray-50'}`}
                        title="Last page"
                      >Last</button>
                    </div>

                    <div className={`flex items-center gap-2 px-3 py-1 rounded border ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                      <label className={`text-xs ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Rows</label>
                      <div className="relative">
                        <select
                          value={markPageSize}
                          onChange={(e) => setMarkPageSize(parseInt(e.target.value, 10) || 10)}
                          className={`appearance-none pr-6 pl-2 py-0.5 text-sm bg-transparent focus:outline-none ${isDarkTheme ? 'text-white' : 'text-slate-700'}`}
                          title="Rows per page"
                        >
                          <option value={5} className={isDarkTheme ? 'bg-gray-800 text-white' : ''}>5</option>
                          <option value={10} className={isDarkTheme ? 'bg-gray-800 text-white' : ''}>10</option>
                          <option value={20} className={isDarkTheme ? 'bg-gray-800 text-white' : ''}>20</option>
                        </select>
                        <svg className={`absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.293l3.71-4.06a.75.75 0 111.12 1L10.56 13.06a.75.75 0 01-1.12 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop View */}
                  <div className="hidden md:block">
                  <div className="flex flex-col h-[600px] overflow-hidden">
                    <div className="overflow-x-auto overflow-y-hidden">
                      <table className="w-full" style={{ tableLayout: 'fixed' }}>
                        <thead className={`border-b ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-100'}`}>
                          <tr>
                            <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Product</th>
                            <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Batch</th>
                            <th className={`px-4 py-3 text-center text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Qty</th>
                            <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Action</th>
                          </tr>
                        </thead>
                      </table>
                    </div>
                    <div className={`flex-1 overflow-y-auto overflow-x-auto custom-scrollbar divide-y ${isDarkTheme ? 'divide-gray-700' : 'divide-gray-100'}`}>
                      <table className="w-full" style={{ tableLayout: 'fixed' }}>
                        <tbody>
                          {paginatedStocks.map((stock, idx) => (
                            <tr key={`stock-${stock.StockEntryID}-${idx}`} className={`${isDarkTheme ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
                              <td className="px-4 py-3">
                                <div>
                                  <p className={`font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{stock.ProductName || stock.Particulars || 'Unknown Product'}</p>
                                  <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>{stock.ProductCode || 'N/A'}</p>
                                </div>
                              </td>
                              <td className={`px-4 py-3 text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{stock.BatchNumber || '-'}</td>
                              <td className={`px-4 py-3 text-center font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{stock.Quantity}</td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => {
                                    setSelectedStockItems(new Set([stock.StockEntryID]));
                                    setItemQuantities({ [stock.StockEntryID]: 1 });
                                    setShowProcessModal(true);
                                  }}
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 font-semibold text-xs rounded-lg transition-colors ${isDarkTheme ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-700' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
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
                  <div className={`max-h-[600px] overflow-y-auto custom-scrollbar divide-y ${isDarkTheme ? 'divide-gray-700' : 'divide-gray-100'}`}>
                    {paginatedStocks.map((stock) => (
                      <div key={stock.StockEntryID} className={`p-4 transition-colors ${isDarkTheme ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
                        <div className="space-y-2 mb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className={`text-xs font-semibold ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Product</p>
                              <p className={`font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{stock.ProductName || stock.Particulars || 'Unknown Product'}</p>
                              <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>{stock.ProductCode || 'N/A'}</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-xs font-semibold ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Batch</p>
                              <p className={`text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{stock.BatchNumber || '-'}</p>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <div>
                              <p className={`text-xs font-semibold ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Quantity</p>
                              <p className={`text-lg font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{stock.Quantity}</p>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedStockItems(new Set([stock.StockEntryID]));
                            setItemQuantities({ [stock.StockEntryID]: 1 });
                            setShowProcessModal(true);
                          }}
                          className={`w-full py-2.5 font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 ${isDarkTheme ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-700' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
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
                  <div className={`rounded-xl shadow-2xl max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
                    {/* Modal Header */}
                    <div className={`flex justify-between items-center mb-6 pb-4 border-b ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
                      <div>
                        <h2 className={`text-2xl font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Mark Items as Damaged</h2>
                        <p className={`text-sm mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Select items from inventory</p>
                      </div>
                      <button
                        onClick={resetModal}
                        className={`transition-colors ${isDarkTheme ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        <X size={24} />
                      </button>
                    </div>

                    {/* Modal Content */}
                    <div className="space-y-6">
                      {/* Stock Selection */}
                      <div>
                        <label className={`block text-sm font-semibold mb-3 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Items to Mark as Damaged *</label>
                        
                        {/* Search Bar */}
                        <div className="relative mb-3">
                          <Search className={`absolute left-3 top-2.5 w-5 h-5 ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`} />
                          <input
                            type="text"
                            placeholder="Search by product name or batch..."
                            className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500' : 'border-gray-200 focus:border-[var(--color-primary)]'}`}
                            value={modalSearchTerm}
                            onChange={(e) => setModalSearchTerm(e.target.value)}
                          />
                        </div>

                        <div className={`border rounded-lg overflow-hidden ${isDarkTheme ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200'}`}>
                          <div className={`max-h-[300px] overflow-y-auto divide-y ${isDarkTheme ? 'divide-gray-700' : 'divide-gray-100'}`}>
                            {filteredModalStocks.length > 0 ? (
                              filteredModalStocks.map((stock) => (
                                <div key={stock.StockEntryID} className={`p-4 transition-colors ${isDarkTheme ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
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
                                        <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{stock.ProductName || stock.Particulars || 'Unknown'}</p>
                                        <p className={`text-xs mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
                                          Code: {stock.ProductCode || 'N/A'} | Batch: {stock.BatchNumber || 'N/A'} | Available: {stock.Quantity}
                                        </p>
                                      </label>
                                    </div>
                                    {selectedStockItems.has(stock.StockEntryID) && (
                                      <div className="flex items-center gap-2 ml-auto">
                                        <label className={`text-xs font-semibold ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Qty:</label>
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
                              <div className={`p-8 text-center ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
                                {modalSearchTerm ? 'No matching products found' : 'No stocks available'}
                              </div>
                            )}
                          </div>
                        </div>
                        {selectedStockItems.size > 0 && (
                          <div className={`mt-2 text-sm ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>
                            <strong>{selectedStockItems.size}</strong> item(s) selected
                          </div>
                        )}
                      </div>

                      {/* Reason */}
                      <div>
                        <label className={`block text-sm font-semibold mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Reason for Damage *</label>
                        <ReasonInput
                          value={damageReason}
                          onChange={handleDamageReasonChange}
                          placeholder="e.g., Package damaged, expiration date passed, broke during handling, etc."
                          rows={3}
                        />
                      </div>

                      {/* Additional Payment (for manual tracking) */}
                      <div>
                        <label className={`block text-sm font-semibold mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Additional Payment</label>
                        <div className={`border rounded-lg p-4 ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                          <p className={`text-xs font-semibold mb-2 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Automatic Calculation</p>
                          <div className="flex items-baseline gap-2">
                            <span className={`text-2xl font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{currencySymbol}{additionalPayment.toFixed(2)}</span>
                            <span className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>(computed from price difference)</span>
                          </div>
                        </div>
                      </div>

                      {/* Summary */}
                      {selectedStockItems.size > 0 && (
                        <div className={`border p-4 rounded-lg ${isDarkTheme ? 'bg-red-900/30 border-red-700/50' : 'bg-red-50 border-red-200'}`}>
                          <p className={`text-sm font-semibold ${isDarkTheme ? 'text-red-400' : 'text-red-800'}`}>Summary</p>
                          <p className={`text-sm mt-2 ${isDarkTheme ? 'text-red-300' : 'text-red-700'}`}>
                            <strong>{selectedStockItems.size}</strong> item(s) will be marked as damaged
                          </p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className={`flex gap-3 pt-4 border-t ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
                        <button
                          onClick={resetModal}
                          className={`flex-1 py-2.5 px-4 font-bold rounded-lg transition-colors ${isDarkTheme ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
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
        <div className={`rounded-xl shadow-sm border overflow-hidden ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`}>
          <div className={`p-4 border-b ${isDarkTheme ? 'border-gray-700 bg-gray-700/50' : 'border-gray-100 bg-gray-50'}`}>
            <div className="relative">
              <Search className={`absolute left-3 top-2.5 w-5 h-5 ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`} />
              <input
                type="text"
                placeholder="Search by Sale ID..."
                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500' : 'border-gray-200 focus:border-[var(--color-primary)]'}`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Pagination moved to Damaged History tab */}

          {isLoading ? (
            <div className="p-8 text-center">
              <Loader size={24} className="animate-spin mx-auto text-slate-400 mb-2" />
              <p className="text-slate-600">Loading sales...</p>
            </div>
          ) : filteredSales.length > 0 ? (
            <>
              {/* Processed Sales Pagination Controls */}
              <div className={`p-2 mb-2 flex items-center justify-between gap-3 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>
                <div className="text-sm">Showing <strong>{filteredSales.length === 0 ? 0 : (processedCurrentPage - 1) * processedPageSize + 1}</strong> to <strong>{Math.min(processedCurrentPage * processedPageSize, filteredSales.length)}</strong> of <strong>{filteredSales.length}</strong></div>

                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full border shadow-sm ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <button
                      onClick={() => setProcessedCurrentPage(1)}
                      disabled={processedCurrentPage === 1}
                      className={`px-3 py-1 rounded-full text-sm font-medium disabled:opacity-40 transition-colors ${isDarkTheme ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-gray-50'}`}
                      title="First page"
                    >First</button>

                    <button
                      onClick={() => setProcessedCurrentPage(p => Math.max(1, p - 1))}
                      disabled={processedCurrentPage === 1}
                      className={`px-3 py-1 rounded-full text-sm font-medium disabled:opacity-40 transition-colors ${isDarkTheme ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-gray-50'}`}
                      title="Previous page"
                    >Prev</button>

                    <div className={`px-3 text-sm font-medium ${isDarkTheme ? 'text-gray-200' : 'text-slate-700'}`} aria-hidden>{processedCurrentPage} of {processedTotalPages}</div>

                    <button
                      onClick={() => setProcessedCurrentPage(p => Math.min(processedTotalPages, p + 1))}
                      disabled={processedCurrentPage === processedTotalPages}
                      className={`px-3 py-1 rounded-full text-sm font-medium disabled:opacity-40 transition-colors ${isDarkTheme ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-gray-50'}`}
                      title="Next page"
                    >Next</button>

                    <button
                      onClick={() => setProcessedCurrentPage(processedTotalPages)}
                      disabled={processedCurrentPage === processedTotalPages}
                      className={`px-3 py-1 rounded-full text-sm font-medium disabled:opacity-40 transition-colors ${isDarkTheme ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-gray-50'}`}
                      title="Last page"
                    >Last</button>
                  </div>

                  <div className={`flex items-center gap-2 px-3 py-1 rounded border ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <label className={`text-xs ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Rows</label>
                    <div className="relative">
                      <select
                        value={processedPageSize}
                        onChange={(e) => setProcessedPageSize(parseInt(e.target.value, 10) || 10)}
                        className={`appearance-none pr-6 pl-2 py-0.5 text-sm bg-transparent focus:outline-none ${isDarkTheme ? 'text-white' : 'text-slate-700'}`}
                        title="Rows per page"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop View */}
              <div className="hidden md:block">
                <div className="flex flex-col h-[600px] overflow-hidden">
                  <div className="overflow-x-auto overflow-y-hidden">
                    <table className="w-full" style={{ tableLayout: 'fixed' }}>
                      <thead className={`border-b ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-100'}`}>
                        <tr>
                          <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Sale ID</th>
                          <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Date</th>
                          <th className={`px-4 py-3 text-right text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Amount</th>
                          <th className={`px-4 py-3 text-center text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Items</th>
                          <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Action</th>
                        </tr>
                      </thead>
                    </table>
                  </div>
                  <div className={`flex-1 overflow-y-auto overflow-x-auto custom-scrollbar divide-y ${isDarkTheme ? 'divide-gray-700' : 'divide-gray-100'}`}>
                    <table className="w-full" style={{ tableLayout: 'fixed' }}>
                      <tbody>
                        {paginatedSales.map((sale) => (
                          <tr key={sale.SaleID} className={`${isDarkTheme ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
                            <td className={`px-4 py-3 font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>#INV-{String(sale.SaleID).padStart(6, '0')}</td>
                            <td className={`px-4 py-3 text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>
                              {new Date(sale.SaleDate || sale.TransactionDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className={`px-4 py-3 text-right font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                              {currencySymbol}{(sale.FinalAmount || sale.TotalAmount ? parseFloat(String(sale.FinalAmount || sale.TotalAmount)).toFixed(2) : '0.00')}
                            </td>
                            <td className={`px-4 py-3 text-center text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{sale.ItemCount || 0}</td>
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
                                className={`inline-flex items-center gap-2 px-3 py-1.5 font-semibold text-xs rounded-lg transition-colors ${isDarkTheme ? 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 border border-blue-700' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
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
                <div className={`max-h-[600px] overflow-y-auto custom-scrollbar divide-y ${isDarkTheme ? 'divide-gray-700' : 'divide-gray-100'}`}>
                  {paginatedSales.map((sale) => (
                    <div key={sale.SaleID} className={`p-4 transition-colors ${isDarkTheme ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
                      <div className="space-y-2 mb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className={`text-xs font-semibold ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Sale ID</p>
                            <p className={`text-lg font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>#INV-{String(sale.SaleID).padStart(6, '0')}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-semibold ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Amount</p>
                            <p className={`text-lg font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                              {currencySymbol}{(sale.FinalAmount || sale.TotalAmount ? parseFloat(String(sale.FinalAmount || sale.TotalAmount)).toFixed(2) : '0.00')}
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <div>
                            <p className={`text-xs font-semibold ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Date</p>
                            <p className={`text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>
                              {new Date(sale.SaleDate || sale.TransactionDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className={`text-xs font-semibold ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Items</p>
                            <p className={`text-lg font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{sale.ItemCount || 0}</p>
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
                        className={`w-full py-2.5 font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 ${isDarkTheme ? 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 border border-blue-700' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
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
        <div className={`rounded-xl shadow-sm border overflow-hidden ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`}>
          <div className={`p-4 border-b space-y-4 ${isDarkTheme ? 'border-gray-700 bg-gray-700/50' : 'border-gray-100 bg-gray-50'}`}>
            <div className="flex flex-col md:flex-row gap-3 md:items-end">
              <div className="relative flex-1">
                <Search className={`absolute left-3 top-2.5 w-5 h-5 ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type="text"
                  placeholder="Search damaged items..."
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500' : 'border-gray-200 focus:border-[var(--color-primary)]'}`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="hidden md:flex gap-2 items-end">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>From Date</label>
                  <input
                    type="date"
                    className={`px-3 py-2 border rounded-lg text-sm focus:outline-none ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-gray-200 focus:border-[var(--color-primary)]'}`}
                    value={historyFilter.startDate}
                    onChange={(e) => setHistoryFilter({ ...historyFilter, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>To Date</label>
                  <input
                    type="date"
                    className={`px-3 py-2 border rounded-lg text-sm focus:outline-none ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-gray-200 focus:border-[var(--color-primary)]'}`}
                    value={historyFilter.endDate}
                    onChange={(e) => setHistoryFilter({ ...historyFilter, endDate: e.target.value })}
                  />
                </div>
                <div className="relative group">
                  <button 
                    className={`font-bold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors ${isDarkTheme ? 'bg-white text-slate-900 hover:bg-gray-100' : 'bg-[var(--color-primary)] hover:bg-[var(--color-hover)] text-white'}`}
                  >
                    <Download size={16} strokeWidth={3} />
                    Generate Report
                  </button>
                  <div className={`absolute right-0 mt-2 w-40 border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <button 
                      onClick={exportDamagedItemsToCSV}
                      className={`w-full text-left px-4 py-2.5 hover:opacity-90 flex items-center gap-2 font-semibold text-sm ${isDarkTheme ? 'text-gray-200 hover:bg-gray-700' : 'text-[var(--color-text)] hover:bg-[var(--color-light)]'}`}
                    >
                      <FileText size={16} />
                      Export to CSV
                    </button>
                    <button 
                      onClick={exportDamagedItemsToPDF}
                      className={`w-full text-left px-4 py-2.5 hover:opacity-90 flex items-center gap-2 font-semibold text-sm border-t ${isDarkTheme ? 'text-gray-200 hover:bg-gray-700 border-gray-700' : 'text-[var(--color-text)] hover:bg-[var(--color-light)] border-gray-100'}`}
                    >
                      <FileText size={16} />
                      Export to PDF
                    </button>
                  </div>
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
                <label className={`block text-xs font-semibold mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>From Date</label>
                <input
                  type="date"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-200'}`}
                  value={historyFilter.startDate}
                  onChange={(e) => setHistoryFilter({ ...historyFilter, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>To Date</label>
                <input
                  type="date"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-200'}`}
                  value={historyFilter.endDate}
                  onChange={(e) => setHistoryFilter({ ...historyFilter, endDate: e.target.value })}
                />
              </div>
              <div className="relative group">
                <button 
                  className={`w-full font-bold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors ${isDarkTheme ? 'bg-white text-slate-900 hover:bg-gray-100' : 'bg-[var(--color-primary)] hover:bg-[var(--color-hover)] text-white'}`}
                >
                  <Download size={16} strokeWidth={3} />
                  Generate Report
                </button>
                <div className={`absolute right-0 mt-2 w-40 border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <button 
                    onClick={exportDamagedItemsToCSV}
                    className={`w-full text-left px-4 py-2.5 hover:opacity-90 flex items-center gap-2 font-semibold text-sm ${isDarkTheme ? 'text-gray-200 hover:bg-gray-700' : 'text-[var(--color-text)] hover:bg-[var(--color-light)]'}`}
                  >
                    <FileText size={16} />
                    Export to CSV
                  </button>
                  <button 
                    onClick={exportDamagedItemsToPDF}
                    className={`w-full text-left px-4 py-2.5 hover:opacity-90 flex items-center gap-2 font-semibold text-sm border-t ${isDarkTheme ? 'text-gray-200 hover:bg-gray-700 border-gray-700' : 'text-[var(--color-text)] hover:bg-[var(--color-light)] border-gray-100'}`}
                  >
                    <FileText size={16} />
                    Export to PDF
                  </button>
                </div>
              </div>
              <button 
                onClick={clearFilters} 
                title="Clear all filters"
                className={`px-4 py-2.5 text-sm font-semibold rounded-lg hover:shadow-sm transition-all flex items-center justify-center gap-2 border ${isDarkTheme ? 'text-gray-300 bg-gray-700 border-gray-600 hover:bg-gray-600' : 'text-[var(--color-text)] bg-white border-[var(--color-border)] hover:bg-[var(--color-light)]'}`}
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
              {/* Pagination Controls */}
              <div className={`p-2 mb-2 flex items-center justify-between gap-3 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>
                <div className="text-sm">Showing <strong>{filteredDamagedItems.length === 0 ? 0 : (historyCurrentPage - 1) * historyPageSize + 1}</strong> to <strong>{Math.min(historyCurrentPage * historyPageSize, filteredDamagedItems.length)}</strong> of <strong>{filteredDamagedItems.length}</strong></div>

                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full border shadow-sm ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <button
                      onClick={() => setHistoryCurrentPage(1)}
                      disabled={historyCurrentPage === 1}
                      className={`px-3 py-1 rounded-full text-sm font-medium disabled:opacity-40 transition-colors ${isDarkTheme ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-gray-50'}`}
                      title="First page"
                    >First</button>

                    <button
                      onClick={() => setHistoryCurrentPage(p => Math.max(1, p - 1))}
                      disabled={historyCurrentPage === 1}
                      className={`px-3 py-1 rounded-full text-sm font-medium disabled:opacity-40 transition-colors ${isDarkTheme ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-gray-50'}`}
                      title="Previous page"
                    >Prev</button>

                    <div className={`px-3 text-sm font-medium ${isDarkTheme ? 'text-gray-200' : 'text-slate-700'}`} aria-hidden>{historyCurrentPage} of {historyTotalPages}</div>

                    <button
                      onClick={() => setHistoryCurrentPage(p => Math.min(historyTotalPages, p + 1))}
                      disabled={historyCurrentPage === historyTotalPages}
                      className={`px-3 py-1 rounded-full text-sm font-medium disabled:opacity-40 transition-colors ${isDarkTheme ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-gray-50'}`}
                      title="Next page"
                    >Next</button>

                    <button
                      onClick={() => setHistoryCurrentPage(historyTotalPages)}
                      disabled={historyCurrentPage === historyTotalPages}
                      className={`px-3 py-1 rounded-full text-sm font-medium disabled:opacity-40 transition-colors ${isDarkTheme ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-gray-50'}`}
                      title="Last page"
                    >Last</button>
                  </div>

                  <div className={`flex items-center gap-2 px-3 py-1 rounded border ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <label className={`text-xs ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Rows</label>
                    <div className="relative">
                      <select
                        value={historyPageSize}
                        onChange={(e) => setHistoryPageSize(parseInt(e.target.value, 10) || 10)}
                        className={`appearance-none pr-6 pl-2 py-0.5 text-sm bg-transparent focus:outline-none ${isDarkTheme ? 'text-white' : 'text-slate-700'}`}
                        title="Rows per page"
                      >
                        <option value={5} className={isDarkTheme ? 'bg-gray-800 text-white' : ''}>5</option>
                        <option value={10} className={isDarkTheme ? 'bg-gray-800 text-white' : ''}>10</option>
                        <option value={20} className={isDarkTheme ? 'bg-gray-800 text-white' : ''}>20</option>
                      </select>
                      <svg className={`absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.293l3.71-4.06a.75.75 0 111.12 1L10.56 13.06a.75.75 0 01-1.12 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              {/* Desktop View */}
              <div className="hidden md:block">
                <div className="flex flex-col h-[600px] overflow-hidden">
                  <div className="overflow-x-auto overflow-y-hidden">
                    <table className="w-full" style={{ tableLayout: 'fixed' }}>
                      <thead className={`border-b ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-100'}`}>
                        <tr>
                          <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Product</th>
                          <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Batch</th>
                          <th className={`px-4 py-3 text-center text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Qty</th>
                          <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Replacement</th>
                          <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Reason</th>
                          <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Date</th>
                        </tr>
                      </thead>
                    </table>
                  </div>
                  <div className={`flex-1 overflow-y-auto overflow-x-auto custom-scrollbar divide-y ${isDarkTheme ? 'divide-gray-700' : 'divide-gray-100'}`}>
                    <table className="w-full" style={{ tableLayout: 'fixed' }}>
                      <tbody>
                        {paginatedDamagedItems.map((item, idx) => (
                          <tr key={`damaged-${item.DamagedItemID}-${idx}`} className={`${isDarkTheme ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
                            <td className="px-4 py-3">
                              <div>
                                <p className={`font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{item.ProductName || 'Unknown Product'}</p>
                                <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>{item.ProductCode || 'N/A'}</p>
                              </div>
                            </td>
                            <td className={`px-4 py-3 text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{item.BatchNumber || '-'}</td>
                            <td className="px-4 py-3 text-center font-bold text-red-600">{item.Quantity}</td>
                            <td className={`px-4 py-3 text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{item.ReplacementProduct || '-'}</td>
                            <td className={`px-4 py-3 text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{item.Reason}</td>
                            <td className={`px-4 py-3 text-sm ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>
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
                <div className={`max-h-[600px] overflow-y-auto custom-scrollbar divide-y ${isDarkTheme ? 'divide-gray-700' : 'divide-gray-100'}`}>
                  {paginatedDamagedItems.map((item) => (
                    <div key={item.DamagedItemID} className={`p-4 transition-colors ${isDarkTheme ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className={`text-xs font-semibold ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Product</p>
                            <p className={`font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{item.ProductName || 'Unknown Product'}</p>
                            <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>{item.ProductCode || 'N/A'}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-semibold ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Batch</p>
                            <p className={`text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{item.BatchNumber || '-'}</p>
                          </div>
                        </div>
                        <div className={`flex justify-between items-center pt-2 border-t ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
                          <div>
                            <p className={`text-xs font-semibold ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Quantity</p>
                            <p className="text-lg font-bold text-red-600">{item.Quantity}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-semibold ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Date</p>
                            <p className={`text-sm ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>
                              {item.DateReported ? new Date(item.DateReported).toLocaleDateString() : '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="pt-3 border-b-2 border-[var(--color-primary)]">
                        <p className={`text-xs font-semibold mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Replacement Product</p>
                        <p className={`text-sm pb-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{item.ReplacementProduct || 'None'}</p>
                      </div>
                      <div className="pt-3 border-b-2 border-[var(--color-primary)]">
                        <p className={`text-xs font-semibold mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Reason</p>
                        <p className={`text-sm pb-3 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{item.Reason}</p>
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
              <div className={`rounded-xl shadow-2xl max-w-3xl w-full p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
                {/* Modal Header */}
                <div className={`flex justify-between items-center mb-6 pb-4 border-b ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div>
                    <h2 className={`text-2xl font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Process Damaged Return</h2>
                    <p className={`text-sm mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Sale #INV-{String(selectedSale.SaleID).padStart(6, '0')}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowSaleDetailsModal(false);
                      setSelectedSale(null);
                      setSaleItems([]);
                    }}
                    className={`transition-colors ${isDarkTheme ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Modal Content */}
                {/* Sale Info */}
                <div className={`border p-4 rounded-lg ${isDarkTheme ? 'bg-blue-900/30 border-blue-700/50' : 'bg-blue-50 border-blue-200'}`}>
                  <p className={`text-xs font-semibold mb-2 ${isDarkTheme ? 'text-blue-300' : 'text-slate-600'}`}>SALE DETAILS</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className={`text-xs ${isDarkTheme ? 'text-blue-300' : 'text-slate-600'}`}>Date</p>
                      <p className={`font-semibold ${isDarkTheme ? 'text-blue-100' : 'text-slate-800'}`}>
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
                      <p className={`text-xs ${isDarkTheme ? 'text-blue-300' : 'text-slate-600'}`}>Amount</p>
                      <p className={`font-semibold ${isDarkTheme ? 'text-blue-100' : 'text-slate-800'}`}>
                        {currencySymbol}{(selectedSale.FinalAmount || selectedSale.TotalAmount ? parseFloat(String(selectedSale.FinalAmount || selectedSale.TotalAmount)).toFixed(2) : '0.00')}
                      </p>
                    </div>
                    <div>
                      <p className={`text-xs ${isDarkTheme ? 'text-blue-300' : 'text-slate-600'}`}>Items</p>
                      <p className={`font-semibold ${isDarkTheme ? 'text-blue-100' : 'text-slate-800'}`}>{selectedSale.ItemCount || saleItems.length}</p>
                    </div>
                  </div>
                </div>

                {/* Items to Return as Damaged */}
                <div>
                  <label className={`block text-sm font-semibold mb-3 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Items to Return as Damaged *</label>
                  <div className={`border rounded-lg overflow-hidden ${isDarkTheme ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200'}`}>
                    <div className={`max-h-[300px] overflow-y-auto divide-y ${isDarkTheme ? 'divide-gray-700' : 'divide-gray-100'}`}>
                      {saleItems.length > 0 ? (
                        saleItems.map((item, idx) => (
                          <div key={idx} className={`p-4 transition-colors ${isDarkTheme ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
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
                                  <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{item.ProductName || 'Unknown'}</p>
                                  <p className={`text-xs mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Available: {item.QuantitySold}</p>
                                </label>
                              </div>
                              {selectedSaleItems.has(idx) && (
                                <div className="flex items-center gap-2 ml-auto">
                                  <label className={`text-xs font-semibold ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Qty:</label>
                                  <input
                                    type="number"
                                    min="1"
                                    max={item.QuantitySold}
                                    value={saleItemQuantities[idx] || 1}
                                    onChange={(e) => {
                                      const qty = Math.min(Math.max(1, parseInt(e.target.value) || 1), item.QuantitySold);
                                      setSaleItemQuantities({ ...saleItemQuantities, [idx]: qty });
                                    }}
                                    className={`w-16 px-2 py-1 border rounded text-sm focus:outline-none ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-gray-200 focus:border-blue-500'}`}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className={`p-8 text-center ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
                          Loading items...
                        </div>
                      )}
                    </div>
                  </div>
                  {selectedSaleItems.size > 0 && (
                    <div className={`mt-2 text-sm ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>
                      <strong>{selectedSaleItems.size}</strong> item(s) selected for return
                    </div>
                  )}
                </div>

                {/* Replacement Product Selection */}
                {selectedSaleItems.size > 0 && (
                  <div>
                    <label className={`block text-sm font-semibold mb-3 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Select Replacement Product from Inventory * ({selectedSaleItems.size} item{selectedSaleItems.size > 1 ? 's' : ''})</label>
                    <div className={`space-y-4 border rounded-lg p-4 ${isDarkTheme ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200'}`}>
                      {Array.from(selectedSaleItems).map((itemIdx, idx) => {
                        const saleItem = saleItems[itemIdx];
                        const replacements = saleItemReplacements.get(itemIdx) || [];

                        return (
                          <div key={itemIdx} className={`border-b pb-4 last:border-b-0 last:pb-0 ${isDarkTheme ? 'border-gray-700' : 'border-gray-100'}`}>
                            <p className={`text-xs font-semibold mb-3 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>
                              Item {idx + 1}: <span className={isDarkTheme ? 'text-blue-400' : 'text-blue-600'}>{saleItem?.ProductName}</span> (Qty: {saleItemQuantities[itemIdx] || 1})
                            </p>
                            <div className="space-y-3">
                              {/* Custom Searchable Dropdown */}
                              <div className="relative">
                                {/* Search Input */}
                                <div className={`border rounded-t-lg overflow-hidden ${isDarkTheme ? 'border-gray-600 bg-gray-700' : 'border-gray-200'}`}>
                                  <input
                                    type="text"
                                    placeholder="Search products..."
                                    value={replacementSearchTerm[itemIdx] || ''}
                                    onChange={(e) => {
                                      setReplacementSearchTerm(prev => ({ ...prev, [itemIdx]: e.target.value }));
                                      setOpenReplacementDropdown(itemIdx);
                                    }}
                                    onFocus={() => setOpenReplacementDropdown(itemIdx)}
                                    className={`w-full px-4 py-2.5 text-sm focus:outline-none ${isDarkTheme ? 'bg-gray-700 border-0 text-white placeholder-gray-400' : 'border-gray-200 placeholder-gray-500'}`}
                                  />
                                </div>

                                {/* Dropdown Options */}
                                {openReplacementDropdown === itemIdx && (() => {
                                  const options = filteredReplacementOptions.get(itemIdx) || [];
                                  return (
                                    <div className={`absolute top-full left-0 right-0 border rounded-b-lg shadow-lg z-50 max-h-[300px] overflow-y-auto ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                                      {options.length > 0 ? (
                                        options.map((stock) => {
                                          const price = typeof (stock.SellingPrice || stock.UnitPrice) === 'string'
                                            ? parseFloat(stock.SellingPrice || stock.UnitPrice)
                                            : (stock.SellingPrice || stock.UnitPrice || 0);
                                          return (
                                            <div
                                              key={stock.StockEntryID}
                                              onClick={async () => {
                                                const newReplacements = new Map(saleItemReplacements);
                                                const arr = newReplacements.get(itemIdx) ? [...newReplacements.get(itemIdx)!] : [];

                                                const existingIdx = arr.findIndex(r => String(r.stockEntryId) === String(stock.StockEntryID));
                                                if (existingIdx > -1) {
                                                  const existing = arr[existingIdx];
                                                  const maxQty = parseInt(String(stock.Quantity)) || 1;
                                                  const newQty = Math.min((existing.qty || 0) + 1, maxQty);
                                                  arr[existingIdx] = { ...existing, qty: newQty };
                                                } else {
                                                  arr.push({ stockEntryId: stock.StockEntryID, qty: 1 });
                                                }

                                                newReplacements.set(itemIdx, arr);
                                                setSaleItemReplacements(newReplacements);

                                                // no immediate refresh to avoid extra network calls; stocks updated when modal opens or after processing

                                                setReplacementSearchTerm(prev => ({ ...prev, [itemIdx]: '' }));
                                                setOpenReplacementDropdown(null);
                                              }}
                                              className={`px-4 py-3 text-sm cursor-pointer transition-colors ${isDarkTheme ? 'hover:bg-gray-600 text-gray-100' : 'hover:bg-gray-100 text-slate-800'}`}>
                                              <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{stock.ProductName || stock.Particulars || 'Unknown'}</p>
                                              <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Stock: {stock.Quantity || 0} | Price: {currencySymbol}{price.toFixed(2)}</p>
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <div className={`px-4 py-3 text-sm text-center ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>No matching products</div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Selected replacements list (supports multiple replacements per returned item) */}
                              {replacements.length > 0 && (
                                <div className="space-y-2">
                                  {replacements.map((rep, repIdx) => {
                                    const repProduct = stocks.find(s => s.StockEntryID === rep.stockEntryId || String(s.StockEntryID) === String(rep.stockEntryId));
                                    return (
                                      <div key={`${itemIdx}-${repIdx}`} className={`p-3 rounded-lg border ${isDarkTheme ? 'bg-blue-900/30 border-blue-700/50' : 'bg-blue-50 border-blue-200'}`}>
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <p className={`text-xs font-semibold ${isDarkTheme ? 'text-blue-300' : 'text-slate-600'}`}>Selected Replacement</p>
                                            <p className={`text-sm font-bold ${isDarkTheme ? 'text-blue-100' : 'text-slate-800'}`}>{repProduct?.ProductName || repProduct?.Particulars || 'Unknown'}</p>
                                            <p className={`text-xs mt-1 ${isDarkTheme ? 'text-blue-300' : 'text-slate-600'}`}>Stock: {repProduct?.Quantity || 0} units</p>
                                          </div>
                                          <div className="text-right">
                                            <label className={`text-xs font-semibold ${isDarkTheme ? 'text-blue-300' : 'text-slate-600'}`}>Exchange Qty:</label>
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="number"
                                                min="1"
                                                max={repProduct?.Quantity || 1}
                                                value={rep.qty}
                                                onChange={(e) => {
                                                  const qty = Math.min(Math.max(1, parseInt(e.target.value) || 1), repProduct?.Quantity || 1);
                                                  const newMap = new Map(saleItemReplacements);
                                                  const arr = newMap.get(itemIdx) ? [...newMap.get(itemIdx)!] : [];
                                                  arr[repIdx] = { ...arr[repIdx], qty };
                                                  newMap.set(itemIdx, arr);
                                                  setSaleItemReplacements(newMap);
                                                }}
                                                className={`w-20 px-2 py-1 border rounded text-sm focus:outline-none ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-200'}`}
                                              />
                                              <button
                                                onClick={() => {
                                                  const newMap = new Map(saleItemReplacements);
                                                  const arr = newMap.get(itemIdx) ? [...newMap.get(itemIdx)!] : [];
                                                  arr.splice(repIdx, 1);
                                                  newMap.set(itemIdx, arr);
                                                  setSaleItemReplacements(newMap);
                                                }}
                                                className={`px-2 py-1 text-sm rounded ${isDarkTheme ? 'bg-red-700 text-white' : 'bg-red-100 text-red-700'}`}
                                              >
                                                Remove
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
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
                  <div className={`border p-4 rounded-lg ${isDarkTheme ? 'bg-blue-900/30 border-blue-700/50' : 'bg-blue-50 border-blue-200'}`}>
                    <p className={`text-xs font-semibold mb-4 ${isDarkTheme ? 'text-blue-300' : 'text-slate-600'}`}>EXCHANGE SUMMARY (Equal Value Required)</p>
                    <div className="space-y-4">
                      {Array.from(selectedSaleItems).map((itemIdx, idx) => {
                        const returnedItem = saleItems[itemIdx];
                        const returnedQty = saleItemQuantities[itemIdx] || 1;
                        const returnedPrice = typeof (returnedItem?.SellingPrice || returnedItem?.UnitPrice) === 'string'
                          ? parseFloat(returnedItem?.SellingPrice || returnedItem?.UnitPrice || '0')
                          : (returnedItem?.SellingPrice || returnedItem?.UnitPrice || 0);
                        const returnedTotal = returnedQty * returnedPrice;
                        
                        const replacements = saleItemReplacements.get(itemIdx) || [];
                        const replacementQtyTotal = replacements.reduce((s, r) => s + (r.qty || 0), 0);
                        const replacementTotal = replacements.reduce((sum, r) => {
                          const prod = stocks.find(s => s.StockEntryID === r.stockEntryId || String(s.StockEntryID) === String(r.stockEntryId));
                          const price = typeof (prod?.SellingPrice || prod?.UnitPrice) === 'string'
                            ? parseFloat(prod?.SellingPrice || prod?.UnitPrice || '0')
                            : (prod?.SellingPrice || prod?.UnitPrice || 0);
                          return sum + (r.qty || 0) * price;
                        }, 0);
                        const priceDifference = replacementTotal - returnedTotal;
                        const hasAdditionalPayment = priceDifference > 0.01;

                        return (
                          <div key={itemIdx} className={`border rounded-lg p-3 ${isDarkTheme ? 'border-green-700/50 bg-green-900/30' : 'border-green-200 bg-green-50'}`}>
                            <div className="flex items-center justify-between mb-3">
                              <span className={`font-bold ${isDarkTheme ? 'text-green-400' : 'text-green-700'}`}>ITEM {idx + 1}</span>
                              {hasAdditionalPayment && <span className={`text-xs font-semibold ${isDarkTheme ? 'text-green-400' : 'text-green-700'}`}>✓ WITH ADDITIONAL PAYMENT</span>}
                            </div>
                            
                            <div className={`mb-3 pb-3 border-b ${isDarkTheme ? 'border-green-700/50' : 'border-green-200'}`}>
                              <p className={`text-xs font-semibold mb-2 ${isDarkTheme ? 'text-green-300' : 'text-slate-600'}`}>RETURNED ITEM</p>
                              <p className={`font-semibold ${isDarkTheme ? 'text-green-100' : 'text-slate-800'}`}>{returnedItem?.ProductName || 'Unknown'}</p>
                              <p className={`text-sm ${isDarkTheme ? 'text-green-400' : 'text-slate-600'}`}>Qty: {returnedQty} × {currencySymbol}{returnedPrice.toFixed(2)}</p>
                              <p className={`text-right font-bold mt-1 ${isDarkTheme ? 'text-green-200' : 'text-slate-800'}`}>{currencySymbol}{returnedTotal.toFixed(2)}</p>
                            </div>

                            <div className={`mb-3 pb-3 border-b ${isDarkTheme ? 'border-green-700/50' : 'border-green-200'}`}>
                              <p className={`text-xs font-semibold mb-1 ${isDarkTheme ? 'text-green-300' : 'text-slate-600'}`}>Quantity Match:</p>
                              <p className={`text-sm font-bold ${isDarkTheme ? 'text-green-400' : 'text-green-700'}`}>Returned: {returnedQty} → Replaced: {replacementQtyTotal}</p>
                              <p className={`text-xs font-semibold mb-1 mt-2 ${isDarkTheme ? 'text-green-300' : 'text-slate-600'}`}>Replacement Value:</p>
                              <p className={`text-sm font-bold ${isDarkTheme ? 'text-blue-400' : 'text-blue-600'}`}>{currencySymbol}{replacementTotal.toFixed(2)} ({priceDifference > 0 ? `+${currencySymbol}${priceDifference.toFixed(2)} more` : '='})</p>
                            </div>

                            <div>
                              <p className={`text-xs font-semibold mb-2 ${isDarkTheme ? 'text-green-300' : 'text-slate-600'}`}>REPLACEMENT ITEM(S)</p>
                              <div className="space-y-1">
                                {replacements.map((rep, ridx) => {
                                  const repProduct = stocks.find(s => s.StockEntryID === rep.stockEntryId || String(s.StockEntryID) === String(rep.stockEntryId));
                                  const repPrice = typeof (repProduct?.SellingPrice || repProduct?.UnitPrice) === 'string'
                                    ? parseFloat(repProduct?.SellingPrice || repProduct?.UnitPrice || '0')
                                    : (repProduct?.SellingPrice || repProduct?.UnitPrice || 0);
                                  return (
                                    <div key={`${itemIdx}-rep-${ridx}`} className="flex items-center justify-between">
                                      <div className={`font-semibold ${isDarkTheme ? 'text-green-100' : 'text-slate-800'}`}>{repProduct?.ProductName || repProduct?.Particulars || repProduct?.ProductCode || 'Unknown'}</div>
                                      <div className={`text-sm ${isDarkTheme ? 'text-green-400' : 'text-slate-600'}`}>Qty: {rep.qty} × {currencySymbol}{repPrice.toFixed(2)}</div>
                                    </div>
                                  );
                                })}
                                <p className={`text-right font-bold mt-1 ${isDarkTheme ? 'text-green-200' : 'text-slate-800'}`}>{currencySymbol}{replacementTotal.toFixed(2)}</p>
                              </div>
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

                    const replacements = saleItemReplacements.get(itemIdx) || [];
                    for (const rep of replacements) {
                      const replacementProduct = stocks.find(s => s.StockEntryID === rep.stockEntryId || String(s.StockEntryID) === String(rep.stockEntryId));
                      const replacementPrice = replacementProduct?.SellingPrice || replacementProduct?.UnitPrice || 0;
                      totalReplacementValue += (rep.qty || 1) * replacementPrice;
                    }
                  });

                  const totalDue = totalReplacementValue - totalReturnedValue;
                  const isPriceMismatch = totalDue < -0.01;

                  return (
                    <>
                      {isPriceMismatch && (
                        <div className={`border p-4 rounded-lg flex items-start gap-3 ${isDarkTheme ? 'bg-red-900/30 border-red-700/50' : 'bg-red-50 border-red-200'}`}>
                          <AlertTriangle size={20} className={`mt-0.5 flex-shrink-0 ${isDarkTheme ? 'text-red-400' : 'text-red-600'}`} />
                          <div>
                            <h3 className={`font-bold ${isDarkTheme ? 'text-red-400' : 'text-red-800'}`}>Error</h3>
                            <p className={`text-sm mt-1 ${isDarkTheme ? 'text-red-300' : 'text-red-700'}`}>Replacement item(s) price must be equal to or more than the returned item(s) price</p>
                            <p className={`text-xs mt-2 ${isDarkTheme ? 'text-red-400' : 'text-red-600'}`}>Returned Value: {currencySymbol}{totalReturnedValue.toFixed(2)} | Replacement Value: {currencySymbol}{totalReplacementValue.toFixed(2)}</p>
                          </div>
                        </div>
                      )}

                      {totalDue > 0.01 && (
                        <div className={`border p-4 rounded-lg ${isDarkTheme ? 'bg-amber-900/30 border-amber-700/50' : 'bg-amber-50 border-amber-200'}`}>
                          <p className={`text-sm font-semibold mb-3 ${isDarkTheme ? 'text-amber-300' : 'text-amber-900'}`}>Additional Payment Required</p>
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div>
                              <p className={`text-xs font-semibold ${isDarkTheme ? 'text-amber-300' : 'text-amber-700'}`}>Returned Value</p>
                              <p className={`font-bold ${isDarkTheme ? 'text-amber-200' : 'text-amber-900'}`}>{currencySymbol}{totalReturnedValue.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className={`text-xs font-semibold ${isDarkTheme ? 'text-amber-300' : 'text-amber-700'}`}>Replacement Value</p>
                              <p className={`font-bold ${isDarkTheme ? 'text-amber-200' : 'text-amber-900'}`}>{currencySymbol}{totalReplacementValue.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className={`text-xs font-semibold ${isDarkTheme ? 'text-amber-300' : 'text-amber-700'}`}>Due Amount</p>
                              <p className={`font-bold ${isDarkTheme ? 'text-amber-200' : 'text-amber-900'}`}>{currencySymbol}{totalDue.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Due Amount Input */}
                      {totalDue > 0.01 && (
                        <div>
                          <label className={`block text-sm font-semibold mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Due Amount</label>
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
                  <label className={`block text-sm font-semibold mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Note *</label>
                  <ReasonInput
                    value={damageNote}
                    onChange={setDamageNote}
                    placeholder="Reason for damage/return..."
                    rows={2}
                  />
                </div>

                {/* Action Buttons */}
                <div className={`flex gap-3 pt-6 border-t mt-6 ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
                  <button
                    onClick={() => resetSaleDetailsModal()}
                    className={`flex-1 py-2.5 px-4 font-bold rounded-lg transition-colors ${isDarkTheme ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    Close
                  </button>
                  {selectedSaleItems.size > 0 && Array.from(selectedSaleItems).every(idx => (saleItemReplacements.get(idx) || []).length > 0) && (
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

