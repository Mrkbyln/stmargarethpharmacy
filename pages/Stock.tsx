import { Link } from 'react-router-dom';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { usePharmacy } from '../context/PharmacyContext';
import apiClient from '../lib/apiClient';
import realtimeNotificationService from '../lib/realtimeNotificationService';
import { AlertTriangle, Check, Search, ArrowUp, ArrowDown, Eye, X, CheckCircle, XCircle, AlertCircle, Loader, Plus, Edit, Trash2, Save, Download, FileText, Barcode, Grid3X3, List } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';
import JsBarcode from 'jsbarcode';

// Simple debounce hook
const useDebounce = (value: string, delay: number): string => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};


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
  ReorderLevel?: number;
  DateAdded?: string;
  BrandName?: string;
  Description?: string;
}

type ActionType = 'change' | 'damage';

// Barcode display component
const BarcodeDisplay: React.FC<{ value: string; size?: 'small' | 'medium' | 'large' }> = ({ value, size = 'small' }) => {
  const { themeColor } = usePharmacy();
  const isDarkTheme = themeColor === 'black';
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current && value) {
      try {
        JsBarcode(barcodeRef.current, value, {
          format: 'CODE128',
          width: size === 'small' ? 1.5 : size === 'medium' ? 2 : 2.5,
          height: size === 'small' ? 40 : size === 'medium' ? 80 : 100,
          displayValue: false,
        });
      } catch (err) {
        console.error('Barcode generation error:', err);
      }
    }
  }, [value, size]);

  if (!value) return null;

  return (
    <div className="flex flex-col items-center">
      <svg ref={barcodeRef}></svg>
      <p className={`text-center font-mono tracking-widest text-sm mt-2 ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
};


const Stock: React.FC = () => {
  const { currencySymbol, user, themeColor } = usePharmacy();
  const isDarkTheme = themeColor === 'black';
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [realtimeExpiredProducts, setRealtimeExpiredProducts] = useState<any[]>([]);

  // Re-added filter and sort states
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showOutOfStockOnly, setShowOutOfStockOnly] = useState(false);
  const [showExpiredOnly, setShowExpiredOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'quantity' | 'date' | 'status'>('quantity');

  // View Mode State - Persist to localStorage
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('stockViewMode');
      return (saved as 'table' | 'grid') || 'table';
    }
    return 'table';
  });

  // Edit and Delete states
  const [editingStock, setEditingStock] = useState<StockItem | null>(null);
  const [deleteStockId, setDeleteStockId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    quantity: '',
    unitPrice: '',
    batchNumber: '',
    expirationDate: ''
  });

  // Save view mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('stockViewMode', viewMode);
  }, [viewMode]);

  // States for the new Add Stock Modal
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(productSearchTerm, 300);
  const [productSearchResults, setProductSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [selectedProductStockEntries, setSelectedProductStockEntries] = useState<any[]>([]);
  const [stockFormData, setStockFormData] = useState({
    quantity: '',
    unitPrice: '',
    batchNumber: '',
    expirationDate: ''
  });
  const [selectedStockItem, setSelectedStockItem] = useState<StockItem | null>(null);
  const [isStockDetailModalOpen, setIsStockDetailModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [addStockError, setAddStockError] = useState<string | null>(null);
  const barcodeScanInputRef = useRef<HTMLInputElement>(null);

  // Mark Damaged States
  const [isMarkDamagedModalOpen, setIsMarkDamagedModalOpen] = useState(false);
  const [damageQuantity, setDamageQuantity] = useState('');
  const [damageReason, setDamageReason] = useState('');
  const [isDamagingItem, setIsDamagingItem] = useState(false);

  // Change Item States (new from ChangeItem.tsx)
  const [isChangeItemModalOpen, setIsChangeItemModalOpen] = useState(false);
  const [selectedStockItems, setSelectedStockItems] = useState<Set<number>>(new Set());
  const [itemQuantities, setItemQuantities] = useState<Record<number, number>>({});
  const [selectedReplacementProduct, setSelectedReplacementProduct] = useState<Map<number, string>>(new Map());
  const [replacementQuantity, setReplacementQuantity] = useState<Map<number, number>>(new Map());
  const [multipleReplacements, setMultipleReplacements] = useState<Map<number, Map<number, {code: string; qty: number}>>>(new Map());
  const [actionType, setActionType] = useState<ActionType>('change');
  const [itemGiven, setItemGiven] = useState('');
  const [itemGivenPrice, setItemGivenPrice] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [additionalPayment, setAdditionalPayment] = useState<number>(0);
  const [priceValidationError, setPriceValidationError] = useState<string | null>(null);

  useEffect(() => {
    fetchStockEntries();
  }, []);



  const fetchStockEntries = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.getStockEntries();
      if (response.success) {
        setStocks(response.data || []);
      } else {
        setError(response.message || 'Failed to load stock entries');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading stock entries');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddStockModal = () => {
    setSelectedProduct(null);
    setProductSearchTerm('');
    setProductSearchResults([]);
    setSelectedProductStockEntries([]);
    setStockFormData({ quantity: '', unitPrice: '', batchNumber: '', expirationDate: '' });
    setAddStockError(null);
    setIsAddStockModalOpen(true);
    setTimeout(() => barcodeScanInputRef.current?.focus(), 100);
  };

  const handleSelectProduct = (product: any) => {
    // Check if product is eligible for stock addition (low stock, out of stock, or expired)
    const entries = stocks.filter(s => s.ProductID === product.ProductID);
    const totalQty = entries.reduce((sum, e) => sum + e.Quantity, 0);
    const isLowStock = totalQty >= 1 && totalQty <= 15;
    const isOutOfStock = totalQty === 0;
    const isExpired = entries.some(e => e.ExpirationDate && new Date(e.ExpirationDate) < new Date());
    
    const productName = product.Particulars || product.ProductName || product.Name || 'Unknown Product';
    
    if (!isLowStock && !isOutOfStock && !isExpired) {
      setAddStockError(`Cannot add stock to "${productName}". Product has ${totalQty} units in stock. You can only add stock when product is low stock (1-15 units), out of stock (0 units), or expired.`);
      setSelectedProduct(null);
      return;
    }
    
    setAddStockError(null);
    setSelectedProduct(product);
    setProductSearchTerm('');
    setProductSearchResults([]);
    setSelectedProductStockEntries(entries);
    
    // Get the most recent expiry date from existing stock entries
    let mostRecentExpiryDate = '';
    if (entries.length > 0) {
      const validDates = entries
        .filter(e => e.ExpirationDate)
        .sort((a, b) => new Date(b.ExpirationDate).getTime() - new Date(a.ExpirationDate).getTime());
      
      if (validDates.length > 0) {
        // Convert to YYYY-MM-DD format for the date input
        mostRecentExpiryDate = new Date(validDates[0].ExpirationDate).toISOString().split('T')[0];
      }
    }
    
    setStockFormData(prev => ({
      ...prev,
      batchNumber: '',
      expirationDate: mostRecentExpiryDate
    }));
  };

  const handleAddNewStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      setAddStockError("Please select a product first.");
      return;
    }

    if (!stockFormData.quantity || Number(stockFormData.quantity) <= 0) {
      setAddStockError("Quantity must be greater than 0.");
      return;
    }
    
    const qty = Number(stockFormData.quantity);
    if (qty > 100) {
      setAddStockError(`Error Code: 101 - Maximum stock quantity allowed is 100 units. You entered ${qty} units.`);
      return;
    }
    
    // Verify quantity is integer
    if (!Number.isInteger(qty)) {
      setAddStockError("Quantity must be a whole number.");
      return;
    }
    
    // Expiration date is required for adding stock
    if (!stockFormData.expirationDate) {
      setAddStockError('Expiration date is required for this product.');
      return;
    }
    
    const newStockData = {
      product_id: selectedProduct.ProductID,
      quantity: qty,
      batchNumber: null,
      expirationDate: stockFormData.expirationDate
    }; // Batch number is always auto-generated to ensure uniqueness
    
    console.log('Sending stock data:', newStockData);
    
    try {
      const response = await apiClient.addStockEntry(newStockData);
      console.log('Add Stock Response:', response);
      
      if (response.success) {
        console.log('Stock added successfully with quantity:', response.data?.Quantity);
        
        // Refresh stock entries first
        await fetchStockEntries();
        
        // Clear form and close modal after successful refresh
        setIsAddStockModalOpen(false);
        setStockFormData({ quantity: '', unitPrice: '', batchNumber: '', expirationDate: '' });
        setSelectedProduct(null);
        setAddStockError(null);
        
        setSuccessMessage('Stock entry added successfully!');
      } else {
        alert(response.message || 'Failed to add stock');
      }
    } catch (err: any) {
      console.error("Failed to add new stock", err);
      alert(`Error: ${err.message || 'An error occurred while adding the stock entry.'}`);
    }
  };

  useEffect(() => {
    if (debouncedSearchTerm) {
      setIsSearching(true);
      apiClient.getInventory({})
        .then(response => {
          if (response.success) {
            const filtered = (response.data || []).filter(product => {
              const name = (product.ProductName || product.Particulars || '').toLowerCase();
              const particulars = (product.Particulars || '').toLowerCase();
              const code = (product.ProductCode || '').toLowerCase();
              const searchLower = debouncedSearchTerm.toLowerCase();
              return name.includes(searchLower) || particulars.includes(searchLower) || code.includes(searchLower);
            }).slice(0, 10);
            setProductSearchResults(filtered);
          }
        })
        .finally(() => setIsSearching(false));
    } else {
      setProductSearchResults([]);
    }
  }, [debouncedSearchTerm]);

  const handleBarcodeScan = async (scannedCode: string) => {
      if(!scannedCode) return;
      setIsSearching(true);
      try {
        const response = await apiClient.getInventory({});
        if (response.success && response.data) {
          const found = response.data.find(product => (product.ProductCode || '').toLowerCase() === scannedCode.toLowerCase());
          if (found) {
            handleSelectProduct(found);
          } else {
            alert(`No product found with barcode: ${scannedCode}`);
            setSelectedProduct(null);
          }
        } else {
          alert(`No product found with barcode: ${scannedCode}`);
          setSelectedProduct(null);
        }
      } catch (error) {
        console.error("Error searching by barcode", error);
        alert("An error occurred while searching for the product.");
      } finally {
        setIsSearching(false);
        setProductSearchTerm('');
      }
  };

  // Edit and delete handlers
  const handleOpenEditModal = async (stock: any) => {
    setEditingStock(stock);
    setEditFormData({ // Pre-fill with existing data while fetching
      quantity: stock.Quantity || '',
      unitPrice: stock.SellingPrice || '',
      batchNumber: stock.BatchNumber || '',
      expirationDate: stock.ExpirationDate ? new Date(stock.ExpirationDate).toISOString().split('T')[0] : ''
    });

    try {
      // Fetch the full product list to find the detailed product info
      const response = await apiClient.getInventory({});
      if (response.success && response.data) {
        const productDetails = response.data.find(p => p.ProductID === stock.ProductID);
        if (productDetails && productDetails.SellingPrice) {
          setEditFormData(prev => ({
            ...prev,
            unitPrice: productDetails.SellingPrice, // Update with the selling price
          }));
        }
      }
    } catch (error) {
      console.error("Failed to fetch selling price for edit modal:", error);
      // Silently fail and keep the original unit price from the stock entry
    }
  };

  const handleCloseEditModal = () => {
    setEditingStock(null);
  };

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStock) return;
    
    const qty = Number(editFormData.quantity);
    if (!editFormData.quantity || qty <= 0) {
      alert("Quantity must be greater than 0.");
      return;
    }

    if (!editFormData.unitPrice || Number(editFormData.unitPrice) < 0) {
      alert("Please enter a valid selling price.");
      return;
    }
    
    try {
      const updateData = {
        quantity: Number(editFormData.quantity),
        unitPrice: Number(editFormData.unitPrice),
        expirationDate: editFormData.expirationDate || null,
        currentUserId: user?.id ? Number(user.id) : null
      };

      const response = await apiClient.updateStockEntry(editingStock.StockEntryID, updateData);
      console.log('Update Stock Response:', response);
      
      if (response.success) {
        // Refresh stock entries
        await fetchStockEntries();
        
        // Close modal
        handleCloseEditModal();
        
        setSuccessMessage('Stock entry updated successfully!');
      } else {
        alert(response.message || 'Failed to update stock');
      }
    } catch (err: any) {
      console.error("Failed to update stock", err);
      alert(`Error: ${err.message || 'An error occurred while updating the stock entry.'}`);
    }
  };
  
  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };

  const handleConfirmDelete = (stockId: string) => {
    setDeleteStockId(stockId);
    
    if (stockId) {
      // Find the stock entry for logging
      const stockToDelete = stocks.find(s => s.StockEntryID === Number(stockId));
      const productInfo = stockToDelete ? `${stockToDelete.Particulars || stockToDelete.ProductCode} (Batch: ${stockToDelete.BatchNumber})` : stockId;
      
      // Call API to soft delete stock entry
      apiClient.deleteStockEntry(Number(stockId)).then(response => {
        if (response.success) {
          setDeleteStockId(null);
          fetchStockEntries(); // Refresh list after deletion
          setSuccessMessage('Stock entry deleted successfully!');
        } else {
          alert(response.message || 'Failed to delete stock entry');
        }
      }).catch(err => {
        console.error('Delete stock error:', err);
        alert('Error deleting stock entry: ' + err.message);
      });
    }
  };

  const handleOpenMarkDamagedModal = (stock: StockItem) => {
    setSelectedStockItem(stock);
    setDamageQuantity('1');
    setDamageReason('');
    setIsMarkDamagedModalOpen(true);
  };

  const handleMarkItemDamaged = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStockItem || !damageQuantity || !damageReason.trim()) {
      alert('Please fill in all fields');
      return;
    }

    const qty = Number(damageQuantity);
    if (qty <= 0) {
      alert('Quantity to damage must be greater than 0.');
      return;
    }
    if (qty > selectedStockItem.Quantity) {
      alert(`Cannot mark more than ${selectedStockItem.Quantity} units as damaged.`);
      return;
    }

    setIsDamagingItem(true);
    try {
      const response = await apiClient.markItemsDamaged({
        stockEntryId: selectedStockItem.StockEntryID,
        quantity: qty,
        reason: damageReason,
        currentUserId: user?.id ? Number(user.id) : null
      });

      if (response.success) {
        setIsMarkDamagedModalOpen(false);
        setIsStockDetailModalOpen(false);
        fetchStockEntries();
        setSuccessMessage('Item marked as damaged successfully!');
        setDamageQuantity('');
        setDamageReason('');
      } else {
        alert(response.message || 'Failed to mark item as damaged');
      }
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Failed to mark item as damaged'));
    } finally {
      setIsDamagingItem(false);
    }
  };

  const handleOpenChangeItemModal = (stock: StockItem) => {
    setSelectedStockItem(stock);
    setIsChangeItemModalOpen(true);
  };

  const resetModal = () => {
    setIsChangeItemModalOpen(false);
    setSelectedStockItem(null);
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


  const handleCreateChangeItem = async () => {
    if (!selectedStockItem || selectedReplacementProduct.size === 0 || !reason.trim()) {
      setError('Please select an item to return, a replacement product, and a reason');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const returnedItem = selectedStockItem;
      const returnedQty = itemQuantities[0] || 1;
      
      if (!returnedQty || returnedQty <= 0) {
        setError('Quantity to return must be greater than 0.');
        setIsSubmitting(false);
        return;
      }
      
      if (returnedQty > returnedItem.Quantity) {
        setError(`Cannot return more than ${returnedItem.Quantity} units available.`);
        setIsSubmitting(false);
        return;
      }
      
      const replacementProductCode = selectedReplacementProduct.get(0);
      if (!replacementProductCode) {
        throw new Error('Replacement product not selected.');
      }

      let replacementProduct = stocks.find(s => s.ProductCode === replacementProductCode || `ENTRY-${s.StockEntryID}` === replacementProductCode);
      if (!replacementProduct) {
        throw new Error('Replacement product not found in stock.');
      }
      
      const replacementQtyValue = replacementQuantity.get(0) || 1;

      // 1. "Return" the item by marking it as damaged/exchanged
      const markDamagedResponse = await apiClient.markItemsDamaged({
        stockEntryId: returnedItem.StockEntryID,
        quantity: returnedQty,
        reason: `Exchanged for ${replacementProduct.Particulars}. Reason: ${reason}`,
        currentUserId: user?.id ? Number(user.id) : null
      });

      if (!markDamagedResponse.success) {
        throw new Error(markDamagedResponse.message || 'Failed to process the item return.');
      }

      // 2. Add the new item to stock
      const addStockResponse = await apiClient.addStockEntry({
        product_id: replacementProduct.ProductID,
        quantity: replacementQtyValue,
        expirationDate: null
      });

      if (!addStockResponse.success) {
        // This is not a true transaction, so we have to inform the user about the partial success
        throw new Error(`Item was returned, but failed to add new item to stock: ${addStockResponse.message}`);
      }

      setSuccessMessage('Item exchange processed successfully!');
      resetModal();
      fetchStockEntries();
      setTimeout(() => setSuccessMessage(null), 3000);

    } catch (err: any) {
      setError(err.message || 'Error processing transaction');
      console.error('Process transaction error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };


  // Restored filtering and sorting logic
  const filteredStocks = stocks
    .filter(s => {
      const productName = (s.Particulars || '').toLowerCase();
      const batchNumber = (s.BatchNumber || '').toLowerCase();
      const productCode = (s.ProductCode || '').toLowerCase();
      const search = searchTerm.toLowerCase();
      const quantity = s.Quantity || 0;
      const isExpired = s.ExpirationDate && new Date(s.ExpirationDate) < new Date();

      return (productName.includes(search) || batchNumber.includes(search) || productCode.includes(search)) &&
      (!showLowStockOnly || (quantity >= 1 && quantity <= 15)) &&
      (!showOutOfStockOnly || quantity === 0) &&
      (!showExpiredOnly || isExpired);
    })
    .sort((a, b) => {
      if (sortBy === 'quantity') {
        return b.Quantity - a.Quantity; // High to Low
      }
      if (sortBy === 'date') {
        const dateA = a.ExpirationDate ? new Date(a.ExpirationDate).getTime() : -Infinity;
        const dateB = b.ExpirationDate ? new Date(b.ExpirationDate).getTime() : -Infinity;
        return dateB - dateA; // Newest first
      }
      if (sortBy === 'status') {
        const getStatus = (item: any) => {
            const qty = item.Quantity || 0;
            const isExpired = item.ExpirationDate && new Date(item.ExpirationDate) < new Date();
            if (qty === 0) return 0; // Out of stock (most critical)
            if (isExpired) return 1; // Expired items (critical)
            if (qty >= 1 && qty <= 15) return 2; // Low stock
            return 3; // In stock
        };
        return getStatus(a) - getStatus(b); // Out of stock (0) comes first, then expired, then low stock
      }
      return 0;
    });

    const clearFilters = () => {
        setSearchTerm('');
        setShowLowStockOnly(false);
        setShowOutOfStockOnly(false);
        setShowExpiredOnly(false);
        setSortBy('quantity');
    };

  // Export Functions
  const exportToCSV = () => {
    // Log action to audit trail
    const userId = user?.id ? Number(user.id) : undefined;
    apiClient.logAction('Exported Stock Report CSV', userId).catch(err => console.error('Audit log failed:', err));
    
    if (filteredStocks.length === 0) return alert('No stock entries to export');
    const headers = ['Product Name', 'Product Code', 'Quantity', 'Batch Number', 'Expiry Date', 'Unit Price'];
    const rows = filteredStocks.map(s => [
      s.Particulars || 'N/A', s.ProductCode || 'N/A', s.Quantity || 0, s.BatchNumber || 'N/A',
      s.ExpirationDate ? new Date(s.ExpirationDate).toLocaleDateString() : 'N/A', Number(s.SellingPrice || 0).toFixed(2)
    ]);
    const escapeCSV = (val: any) => `"${String(val).replace(/"/g, '""')}"`;
    let csvContent = headers.map(escapeCSV).join(',') + '\n';
    rows.forEach(row => { csvContent += row.map(escapeCSV).join(',') + '\n' });
    saveAs(new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }), `stock_report_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const exportToPDF = async () => {
    // Log action to audit trail
    const userId = user?.id ? Number(user.id) : undefined;
    apiClient.logAction('Exported Stock Report PDF', userId).catch(err => console.error('Audit log failed:', err));
    
    if (filteredStocks.length === 0) return alert('No stock entries to export');
    const el = document.createElement('div');
    el.style.position = 'absolute'; el.style.left = '-9999px';
    el.innerHTML = `<div style="padding:20px;font-family:Arial,sans-serif;background:white;width:1200px"><h1 style="text-align:center;font-size:24px;">Stock Report</h1><p style="text-align:center;font-size:12px;">Generated on: ${new Date().toLocaleString()}</p><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background-color:#f5f5f5"><th style="border:1px solid #ddd;padding:8px">Product Name</th><th style="border:1px solid #ddd;padding:8px">Code</th><th style="border:1px solid #ddd;padding:8px;text-align:center">Qty</th><th style="border:1px solid #ddd;padding:8px">Batch #</th><th style="border:1px solid #ddd;padding:8px">Expiry</th><th style="border:1px solid #ddd;padding:8px">Unit Price</th></tr></thead><tbody>${filteredStocks.map(s=>`<tr><td style="border:1px solid #ddd;padding:8px">${s.Particulars||'N/A'}</td><td style="border:1px solid #ddd;padding:8px">${s.ProductCode||'N/A'}</td><td style="border:1px solid #ddd;padding:8px;text-align:center">${s.Quantity||0}</td><td style="border:1px solid #ddd;padding:8px">${s.BatchNumber||'N/A'}</td><td style="border:1px solid #ddd;padding:8px">${s.ExpirationDate?new Date(s.ExpirationDate).toLocaleDateString():'N/A'}</td><td style="border:1px solid #ddd;padding:8px">${currencySymbol}${Number(s.SellingPrice||0).toFixed(2)}</td></tr>`).join('')}</tbody></table></div>`;
    document.body.appendChild(el);
    try {
      const canvas = await html2canvas(el, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
      const w = 297, h = 210, imgH = canvas.height * w / canvas.width;
      let heightLeft = imgH, pos = 0;
      pdf.addImage(imgData, 'PNG', 0, pos, w, imgH);
      heightLeft -= h;
      while (heightLeft > 0) { pos = heightLeft - imgH; pdf.addPage(); pdf.addImage(imgData, 'PNG', 0, pos, w, imgH); heightLeft -= h; }
      pdf.save(`stock_report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch(e) { console.error(e); alert('Error generating PDF.'); } 
    finally { document.body.removeChild(el); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4">
        <div className="md:hidden mr-auto">
          <h2 className={`text-2xl font-extrabold md:hidden ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Stock Management</h2>
          <p className={`font-medium md:hidden ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Efficient Inventory Tracking and Management</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative group">
            <button className={`font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-colors ${isDarkTheme ? 'bg-white text-slate-900 hover:bg-gray-100' : 'bg-[var(--color-primary)] hover:bg-[var(--color-hover)] text-white'}`}>
              <Download size={18} strokeWidth={3} /> Generate Report
            </button>
            <div className={`absolute right-0 mt-2 w-40 border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <button onClick={exportToCSV} className={`w-full text-left px-4 py-2.5 flex items-center gap-2 font-semibold text-sm ${isDarkTheme ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-[var(--color-light)] text-[var(--color-text)]'}`}><FileText size={16} /> Export to CSV</button>
              <button onClick={exportToPDF} className={`w-full text-left px-4 py-2.5 flex items-center gap-2 font-semibold text-sm border-t ${isDarkTheme ? 'hover:bg-gray-700 text-gray-300 border-gray-700' : 'hover:bg-[var(--color-light)] text-[var(--color-text)] border-gray-100'}`}><FileText size={16} /> Export to PDF</button>
            </div>
          </div>
          <button onClick={handleOpenAddStockModal} className={`bg-[var(--color-primary)] hover:bg-[var(--color-hover)] text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-colors ${user?.role === 'pharmacy_assistant' ? 'hidden' : ''}`}>
            <Plus size={20} strokeWidth={3} /> Add Stock
          </button>
        </div>
      </div>
      
        {/* Stock List */}
        <div className={`lg:col-span-3 rounded-xl shadow-sm border flex flex-col h-screen md:h-[700px] ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`}>
           <div className={`p-4 border-b flex-shrink-0 ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'border-gray-100 bg-gray-50/50'}`}>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-grow">
                  <Search className={`absolute left-3 top-2.5 w-5 h-5 ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input 
                    type="text" 
                    placeholder="Search by product name, code, or batch number..."
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-200'}`}
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value as any)} 
                    className={`w-full sm:w-auto pl-3 pr-8 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200'}`}
                  >
                    <option value="">Sort By</option>
                    <option value="quantity">Quantity (High to Low)</option>
                    <option value="date">Date (Newest First)</option>
                    <option value="status">Status (Critical First)</option>
                  </select>
                  <button 
                    onClick={() => setShowLowStockOnly(!showLowStockOnly)} 
                    className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${showLowStockOnly ? (isDarkTheme ? 'bg-blue-900/30 border border-blue-700 text-blue-300' : 'bg-[var(--color-light)] text-[var(--color-text)] border border-[var(--color-border)]') : (isDarkTheme ? 'text-gray-300 bg-gray-700 border border-gray-600 hover:bg-gray-600' : 'text-[var(--color-text)] bg-white border border-[var(--color-border)] hover:bg-[var(--color-light)]')}`}
                  >
                    {showLowStockOnly ? '✓ Low Stock' : 'Low Stock'}
                  </button>
                  <button 
                    onClick={() => setShowOutOfStockOnly(!showOutOfStockOnly)} 
                    className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${showOutOfStockOnly ? (isDarkTheme ? 'bg-blue-900/30 border border-blue-700 text-blue-300' : 'bg-[var(--color-light)] text-[var(--color-text)] border border-[var(--color-border)]') : (isDarkTheme ? 'text-gray-300 bg-gray-700 border border-gray-600 hover:bg-gray-600' : 'text-[var(--color-text)] bg-white border border-[var(--color-border)] hover:bg-[var(--color-light)]')}`}
                  >
                    {showOutOfStockOnly ? '✓ Out of Stock' : 'Out of Stock'}
                  </button>
                  <button 
                    onClick={() => setShowExpiredOnly(!showExpiredOnly)} 
                    className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${showExpiredOnly ? (isDarkTheme ? 'bg-red-900/30 border border-red-700 text-red-300' : 'bg-red-50 text-red-600 border border-red-200') : (isDarkTheme ? 'text-gray-300 bg-gray-700 border border-gray-600 hover:bg-gray-600' : 'text-[var(--color-text)] bg-white border border-[var(--color-border)] hover:bg-[var(--color-light)]')}`}
                  >
                    {showExpiredOnly ? '✓ Expired Items' : 'Expired Items'}
                  </button>
                  <button 
                    onClick={clearFilters} 
                    title="Clear all filters"
                    className={`px-4 py-2.5 text-sm font-semibold rounded-lg hover:shadow-sm transition-all flex items-center gap-2 border ${isDarkTheme ? 'text-gray-300 bg-gray-700 border-gray-600 hover:bg-gray-600' : 'text-[var(--color-text)] bg-white border-[var(--color-border)] hover:bg-[var(--color-light)]'}`}
                  >
                    <X size={16} />
                    Clear Filters
                  </button>
                  <div className={`flex items-center gap-2 border rounded-lg p-1 ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`p-2 rounded transition-colors ${viewMode === 'table' ? 'bg-[var(--color-primary)] text-white' : (isDarkTheme ? 'text-gray-400 hover:bg-gray-600' : 'text-gray-400 hover:text-[var(--color-text)]')}`}
                      title="Table view"
                    >
                      <List size={18} />
                    </button>
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-[var(--color-primary)] text-white' : (isDarkTheme ? 'text-gray-400 hover:bg-gray-600' : 'text-gray-400 hover:text-[var(--color-text)]')}`}
                      title="Grid view"
                    >
                      <Grid3X3 size={18} />
                    </button>
                  </div>
                </div>
              </div>
          </div>
          
          {isLoading ? (
            <div className={`p-12 text-center flex flex-col items-center justify-center flex-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}><Loader className="animate-spin text-[var(--color-primary)] mb-4" size={32} /><p className="font-semibold">Loading stock entries...</p></div>
          ) : error ? (
            <div className={`p-6 text-center flex-1 ${isDarkTheme ? 'text-red-400' : 'text-red-600'}`}>{error}</div>
          ) : viewMode === 'table' ? (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
                  <thead className={`font-bold text-sm uppercase sticky top-0 z-10 ${isDarkTheme ? 'bg-gray-700 text-gray-200' : 'bg-[var(--color-light)] text-slate-700'}`}>
                    <tr>
                      <th className="px-3 sm:px-6 py-4 whitespace-nowrap min-w-[100px] sm:min-w-[150px]">Item Name</th>
                      <th className="px-3 sm:px-6 py-4 whitespace-nowrap text-center min-w-[80px] sm:min-w-[100px]">Product Code</th>
                      <th className="px-3 sm:px-6 py-4 whitespace-nowrap text-center min-w-[70px] sm:min-w-[90px]">Quantity</th>
                      <th className="hidden md:table-cell px-6 py-4 whitespace-nowrap min-w-[80px]">Batch #</th>
                      <th className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-center min-w-[100px]">Expiry Date</th>
                    </tr>
                  </thead>
                </table>
              </div>
              <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1">
                <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
                  <tbody className={`${isDarkTheme ? 'divide-gray-700' : 'divide-gray-100'} divide-y`}>
                    {filteredStocks.length > 0 ? filteredStocks.map((stock, idx) => (
                      <tr key={`stock-${stock.StockEntryID}-${idx}`} className={`cursor-pointer ${isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`} onClick={() => { setSelectedStockItem(stock); setIsStockDetailModalOpen(true); }}>
                        <td className={`px-3 sm:px-6 py-4 font-bold break-words text-sm sm:text-base min-w-[100px] sm:min-w-[150px] ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{stock.Particulars || 'N/A'}</td>
                        <td className={`px-3 sm:px-6 py-4 text-sm sm:text-base text-center min-w-[80px] sm:min-w-[100px] ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{stock.ProductCode || 'N/A'}</td>
                        <td className={`px-3 sm:px-6 py-4 font-bold text-center text-sm sm:text-base min-w-[70px] sm:min-w-[90px] ${stock.Quantity === 0 ? 'text-red-500' : stock.Quantity >= 1 && stock.Quantity <= 15 ? 'text-red-500' : (isDarkTheme ? 'text-gray-300' : 'text-slate-800')}`}>{stock.Quantity}</td>
                        <td className={`hidden md:table-cell px-6 py-4 whitespace-nowrap min-w-[80px] ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{stock.BatchNumber || 'N/A'}</td>
                        <td className={`hidden md:table-cell px-6 py-4 whitespace-nowrap text-center min-w-[100px] ${stock.ExpirationDate && new Date(stock.ExpirationDate) < new Date() ? 'text-red-500 font-bold' : (isDarkTheme ? 'text-gray-300' : 'text-slate-700')}`}>{stock.ExpirationDate ? new Date(stock.ExpirationDate).toLocaleDateString() : 'N/A'}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className={`text-center py-12 ${isDarkTheme ? 'text-gray-400' : 'text-slate-400'}`}>No stock entries found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-6">
                {filteredStocks.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredStocks.map((stock, idx) => {
                    const isLowStock = stock.Quantity >= 1 && stock.Quantity <= 15;
                    const isExpired = stock.ExpirationDate && new Date(stock.ExpirationDate) < new Date();
                    return (
                    <div key={`stock-grid-${stock.StockEntryID}-${idx}`} className={`border rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden relative ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                      {(isLowStock || isExpired) && user?.role === 'admin' && (
                        <div className="absolute top-2 right-2 z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectProduct({ ProductID: stock.ProductID, Particulars: stock.Particulars, ProductCode: stock.ProductCode });
                              setIsAddStockModalOpen(true);
                            }}
                            className="px-2 py-1 text-xs bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors shadow-md"
                            title="Quick add stock"
                          >
                            + Add Stock
                          </button>
                        </div>
                      )}
                      <div className="p-4 space-y-4">
                        {/* Header with code and quantity */}
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <div className={`font-mono font-bold text-xs px-2 py-1 rounded inline-block ${isDarkTheme ? 'bg-gray-600 text-gray-200' : 'bg-gray-100 text-slate-700'}`}>
                              {stock.ProductCode || 'N/A'}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold text-lg ${stock.Quantity < (stock.ReorderLevel || 10) ? 'text-red-500' : (isDarkTheme ? 'text-white' : 'text-slate-800')}`}>
                              {stock.Quantity} units
                            </p>
                          </div>
                        </div>

                        {/* Product name */}
                        <div>
                          <h3 className={`font-bold line-clamp-2 ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                            {stock.Particulars || 'N/A'}
                          </h3>
                        </div>

                        {/* Batch Number and Expiry */}
                        <div className="space-y-2">
                          <div>
                            <p className={`text-xs font-semibold uppercase ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Batch Number</p>
                            <p className={`font-semibold ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{stock.BatchNumber || 'N/A'}</p>
                          </div>
                          <div>
                            <p className={`text-xs font-semibold uppercase ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Expiry Date</p>
                            <p className={`font-semibold ${stock.ExpirationDate && new Date(stock.ExpirationDate) < new Date() ? 'text-red-500 font-bold' : (isDarkTheme ? 'text-gray-300' : 'text-slate-700')}`}>
                              {stock.ExpirationDate ? new Date(stock.ExpirationDate).toLocaleDateString() : 'N/A'}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className={`pt-2 border-t ${isDarkTheme ? 'border-gray-600' : 'border-gray-100'}`}>
                          {stock.Quantity === 0 ? (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${isDarkTheme ? 'bg-red-900/30 text-red-400 border-red-700' : 'bg-red-50 text-red-600 border-red-200'}`}>
                              Out of Stock
                            </span>
                          ) : stock.Quantity < (stock.ReorderLevel || 10) ? (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${isDarkTheme ? 'bg-orange-900/30 text-orange-400 border-orange-700' : 'bg-orange-50 text-orange-600 border-orange-200'}`}>
                              Low Stock
                            </span>
                          ) : (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${isDarkTheme ? 'bg-green-900/30 text-green-400 border-green-700' : 'bg-green-50 text-green-600 border-green-200'}`}>
                              In Stock
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        {(isLowStock || isExpired) && user?.role === 'admin' && (
                          <div className={`pt-2 border-t flex gap-2 ${isDarkTheme ? 'border-gray-600' : 'border-gray-100'}`}>
                            <button
                              onClick={() => {
                                handleSelectProduct({ ProductID: stock.ProductID, Particulars: stock.Particulars, ProductCode: stock.ProductCode });
                                setIsAddStockModalOpen(true);
                              }}
                              className={`flex-1 p-2 rounded-lg transition-colors text-xs font-semibold flex items-center justify-center gap-1 ${isDarkTheme ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                              title="Quick add stock"
                            >
                              <Plus size={14} /> Add Stock
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className={`text-center py-12 ${isDarkTheme ? 'text-gray-400' : 'text-slate-400'}`}>
                  <p>No stock entries found.</p>
                </div>
              )}
              </div>
            </div>
          )}
      </div>

      {isStockDetailModalOpen && selectedStockItem && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4 font-poppins">
          <div className={`rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`px-6 py-4 flex justify-between items-center shrink-0 border-b ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-50/50 border-gray-200'}`}>
              <h3 className={`font-extrabold text-lg flex items-center gap-3 ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                <Barcode size={24} className="text-[var(--color-primary)]" />
                Stock Item Details
              </h3>
              <button onClick={() => setIsStockDetailModalOpen(false)} className={`p-1.5 rounded-full transition-colors ${isDarkTheme ? 'text-gray-400 hover:bg-gray-600' : 'text-slate-500 hover:bg-gray-200'}`}>
                <X size={20} />
              </button>
            </div>
            
            <div className={`p-6 overflow-y-auto space-y-8 custom-scrollbar ${isDarkTheme ? 'bg-gray-800' : ''}`}>
              <div className="grid md:grid-cols-2 gap-8">
                {/* Left Column: Product Info & Barcode */}
                <div className="space-y-6 flex flex-col">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Product Name</p>
                    <h2 className={`font-bold text-2xl ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{selectedStockItem.Particulars || 'N/A'}</h2>
                  </div>
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Product Code</p>
                    <p className={`font-mono font-bold text-lg px-3 py-1 rounded-md inline-block ${isDarkTheme ? 'text-white bg-gray-700' : 'text-[var(--color-primary)] bg-gray-100'}`}>{selectedStockItem.ProductCode || 'N/A'}</p>
                  </div>
                  <div className={`flex-grow flex items-center justify-center rounded-lg p-4 mt-auto ${isDarkTheme ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    {selectedStockItem.ProductCode ? (
                      <BarcodeDisplay value={selectedStockItem.ProductCode} size="large" />
                    ) : (
                      <p className={isDarkTheme ? 'text-gray-400' : 'text-slate-400'}>No barcode available</p>
                    )}
                  </div>
                </div>

                {/* Right Column: Stock Details */}
                <div className="space-y-6">
                  {/* Status */}
                  <div className="p-4 rounded-lg border-2">
                    {(() => {
                      const isExpired = selectedStockItem.ExpirationDate && new Date(selectedStockItem.ExpirationDate) < new Date();
                      const quantity = selectedStockItem.Quantity;
                      const reorderLevel = selectedStockItem.ReorderLevel || 10;
                      let status, Icon, colorClass;

                      if (isExpired) {
                        status = 'Expired'; Icon = AlertCircle; colorClass = isDarkTheme ? 'border-red-700 bg-red-900/30 text-red-400' : 'border-red-500 bg-red-50 text-red-700';
                      } else if (quantity === 0) {
                        status = 'Out of Stock'; Icon = XCircle; colorClass = isDarkTheme ? 'border-red-700 bg-red-900/30 text-red-400' : 'border-red-500 bg-red-50 text-red-700';
                      } else if (quantity < reorderLevel) {
                        status = 'Low Stock'; Icon = AlertTriangle; colorClass = isDarkTheme ? 'border-orange-700 bg-orange-900/30 text-orange-400' : 'border-orange-500 bg-orange-50 text-orange-700';
                      } else {
                        status = 'In Stock'; Icon = CheckCircle; colorClass = isDarkTheme ? 'border-green-700 bg-green-900/30 text-green-400' : 'border-green-500 bg-green-50 text-green-700';
                      }

                      return (
                        <div className={`flex items-center gap-3 ${colorClass}`}>
                          <Icon size={24} className="shrink-0" />
                          <div className="flex-grow">
                            <p className="font-bold text-lg">{status}</p>
                            {isExpired && <p className="text-xs font-semibold">Expired on: {new Date(selectedStockItem.ExpirationDate).toLocaleDateString()}</p>}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Stock Levels */}
                  <div className="grid grid-cols-1 gap-4">
                    <div className={`border rounded-lg p-4 ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-slate-50/70 border-slate-200'}`}>
                        <p className={`text-xs font-semibold uppercase tracking-wider ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Reorder Level</p>
                        <p className={`font-extrabold text-3xl ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{selectedStockItem.ReorderLevel || 'N/A'}</p>
                        <p className={`text-sm font-semibold ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>units</p>
                    </div>
                  </div>
                  
                  {/* Other Details */}
                  <div className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                       <div>
                         <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Batch Number</p>
                         <p className={`font-semibold px-2 py-1 rounded w-fit ${isDarkTheme ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-slate-700'}`}>{selectedStockItem.BatchNumber || 'N/A'}</p>
                       </div>
                       <div>
                         <p className={`text-xs font-semibold uppercase tracking-wider ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Quantity</p>
                         <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                           {selectedStockItem.Quantity} units
                         </p>
                       </div>
                       <div>
                         <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Selling Price</p>
                         <p className={`font-semibold ${isDarkTheme ? 'text-green-400' : 'text-slate-700'}`}>{currencySymbol}{Number(selectedStockItem.SellingPrice || 0).toFixed(2)}</p>
                       </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4 text-sm">
                       <div>
                          <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Date Added</p>
                          <p className={`font-semibold ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{selectedStockItem.DateAdded ? new Date(selectedStockItem.DateAdded).toLocaleDateString() : 'N/A'}</p>
                       </div>
                       <div>
                         <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Expiry Date</p>
                         <p className={`font-semibold ${selectedStockItem.ExpirationDate && new Date(selectedStockItem.ExpirationDate) < new Date() ? 'text-red-500 font-bold' : (isDarkTheme ? 'text-gray-300' : 'text-slate-700')}`}>
                           {selectedStockItem.ExpirationDate ? new Date(selectedStockItem.ExpirationDate).toLocaleDateString() : 'N/A'}
                         </p>
                       </div>
                     </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className={`px-6 py-4 border-t flex justify-end gap-3 flex-wrap ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-50/50 border-gray-200'}`}>
              <button 
                onClick={() => {
                  setIsStockDetailModalOpen(false);
                  handleOpenMarkDamagedModal(selectedStockItem);
                }}
                className={`px-5 py-2.5 text-sm hover:opacity-90 font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 border ${isDarkTheme ? 'bg-red-900/30 border-red-700 text-red-400' : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'}`}
                title="Mark this item as damaged"
              >
                <AlertTriangle size={16} /> Mark Damaged
              </button>
              <button 
                onClick={() => {
                  setIsStockDetailModalOpen(false);
                  handleOpenChangeItemModal(selectedStockItem);
                }}
                className={`px-5 py-2.5 text-sm hover:opacity-90 font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 border ${isDarkTheme ? 'bg-orange-900/30 border-orange-700 text-orange-400' : 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100'}`}
                title="Exchange this item for another product"
              >
                <ArrowUp size={16} /> Change Item
              </button>
              <button onClick={() => setIsStockDetailModalOpen(false)} className="px-5 py-2.5 text-sm bg-[var(--color-primary)] text-white font-bold rounded-lg shadow-md hover:bg-[var(--color-hover)] transition-all">
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isAddStockModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`px-6 py-4 flex justify-between items-center shrink-0 ${isDarkTheme ? 'bg-blue-600' : 'bg-[var(--color-primary)]'}`}>
              <h3 className="text-white font-extrabold text-lg">Add New Stock Entry</h3>
              <button onClick={() => setIsAddStockModalOpen(false)} className="text-white hover:bg-white/20 p-1 rounded-full">&times;</button>
            </div>
            
            {/* Error Message - Always visible at top */}
            {addStockError && (
              <div className={`mx-8 mt-4 p-4 rounded-lg border ${isDarkTheme ? 'bg-red-900/20 border-red-700 text-red-300' : 'bg-red-50 border-red-200 text-red-600'}`}>
                <p className="font-semibold text-sm">{addStockError}</p>
              </div>
            )}
            
            <div className={`grid lg:grid-cols-3 gap-8 p-8 overflow-y-auto flex-1 ${isDarkTheme ? 'bg-gray-800' : 'bg-gray-50/50'}`}>
              {/* Left Column: Find Product */}
              <div className={`lg:col-span-1 flex flex-col gap-6 pb-4 lg:border-r lg:pr-8 ${isDarkTheme ? 'lg:border-gray-700' : 'lg:border-gray-200'}`}>
                <div>
                  <h4 className={`font-bold text-lg mb-4 flex items-center gap-2 ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                    <Search size={20} className="text-[var(--color-primary)]" />
                    Find Product
                  </h4>
                  <div className="relative">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`} />
                    <input type="text" placeholder="Search by product name or code..." value={productSearchTerm} onChange={(e) => setProductSearchTerm(e.target.value)} className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300'}`}/>
                    
                    {productSearchResults.length > 0 && (
                      <div className={`absolute top-full left-0 right-0 mt-2 border rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                        <ul className="space-y-1 p-2">
                          {productSearchResults.map(p => (
                            <li key={p.ProductID} onClick={() => handleSelectProduct(p)} className={`p-3 cursor-pointer rounded-md transition-colors ${isDarkTheme ? 'hover:bg-gray-600 text-white' : 'hover:bg-blue-50 text-slate-800'}`}>
                              <p className="font-bold text-sm">{p.Particulars || p.ProductName}</p>
                              <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>{p.ProductCode}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className={`rounded-lg p-6 min-h-[250px] flex flex-col justify-center ${isDarkTheme ? 'bg-gray-700' : 'bg-white border border-gray-200'}`}>
                  {selectedProduct && !addStockError && <div className="text-center flex flex-col items-center gap-4"><CheckCircle size={48} className="text-green-500"/><p className={`font-bold text-lg ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{selectedProduct.Particulars}</p><div className="w-full flex justify-center"><BarcodeDisplay value={selectedProduct.ProductCode} size="medium" /></div><button onClick={() => setSelectedProduct(null)} className={`text-sm font-semibold hover:underline transition-colors ${isDarkTheme ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-600'}`}>Clear Selection</button></div>}
                  {!selectedProduct && productSearchResults.length === 0 && !addStockError && <div className={`text-center ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}><p className="text-sm">Search for a product to begin</p></div>}
                  {addStockError && <div className={`text-center ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}><p className="text-sm">Search for a product to begin</p></div>}
                </div>
              </div>

              {/* Right Column: Fill Details */}
              <form onSubmit={handleAddNewStock} className={`lg:col-span-2 flex flex-col gap-6 ${!selectedProduct || addStockError ? 'opacity-50 pointer-events-none' : ''}`}>
                <div>
                  <h4 className={`font-bold text-lg mb-4 flex items-center gap-2 ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                    <FileText size={20} className="text-[var(--color-primary)]" />
                    Fill Stock Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className={`block text-sm font-bold mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Quantity to Add <span className="text-red-500">*</span></label>
                      <input type="number" name="quantity" required value={stockFormData.quantity} onChange={(e) => setStockFormData({...stockFormData, quantity: e.target.value})} className={`w-full border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300'}`} placeholder="e.g., 50" min="1" max="100" step="1"/>
                      <p className={`text-xs mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>Maximum: 100 units per entry</p>
                    </div>
                    <div>
                      <label className={`block text-sm font-bold mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Expiry Date <span className="text-red-500">*</span></label>
                        <input type="date" name="expirationDate" required value={stockFormData.expirationDate} onChange={(e) => setStockFormData({...stockFormData, expirationDate: e.target.value})} className={`w-full border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}/>
                    </div>
                  </div>
                </div>

                {selectedProduct && (
                  <div className={`rounded-lg p-6 space-y-4 ${isDarkTheme ? 'bg-gray-700 border border-gray-600' : 'bg-white border-2 border-gray-200'}`}>
                    <h5 className={`font-bold text-base ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Product Summary</h5>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>Product Name</p>
                        <p className={`font-bold text-sm ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{selectedProduct.Particulars || selectedProduct.ProductName || selectedProduct.Name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>Product Code</p>
                        <p className={`font-mono text-sm font-bold ${isDarkTheme ? 'text-blue-400' : 'text-blue-600'}`}>{selectedProduct.ProductCode || selectedProduct.Code || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>Brand Name</p>
                        <p className={`font-semibold text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{selectedProduct.BrandName || selectedProduct.Brand || 'N/A'}</p>
                      </div>
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>Selling Price</p>
                        <p className={`font-bold text-lg ${isDarkTheme ? 'text-green-400' : 'text-green-600'}`}>{selectedProduct.UnitPrice ? `${currencySymbol}${Number(selectedProduct.UnitPrice).toFixed(2)}` : 'N/A'}</p>
                      </div>
                    </div>

                    {selectedProduct.Description && (
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>Description</p>
                        <p className={`text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{selectedProduct.Description || selectedProduct.ProductDescription || 'N/A'}</p>
                      </div>
                    )}

                    {selectedProductStockEntries.length > 0 && (
                      <div className={`pt-4 border-t ${isDarkTheme ? 'border-gray-600' : 'border-gray-300'}`}>
                        <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>Current Stock Entries</p>
                        <div className={`text-sm p-3 rounded space-y-2 ${isDarkTheme ? 'bg-gray-600 border border-gray-500' : 'bg-gray-50 border border-gray-200'}`}>
                          {Array.from(new Map(selectedProductStockEntries.filter(entry => entry.BatchNumber && entry.BatchNumber !== 'N/A').map(entry => [entry.BatchNumber, entry])).values()).map((entry, idx) => (
                            <div key={idx} className={`flex justify-between text-xs ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>
                              <span>Batch: <span className="font-semibold">{entry.BatchNumber}</span></span>
                              <span className={`${entry.Quantity <= 15 ? (isDarkTheme ? 'text-orange-400' : 'text-orange-600') : ''}`}>Qty: <span className="font-semibold">{entry.Quantity}</span></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className={`flex justify-end gap-3 pt-6 border-t ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
                  <button type="button" onClick={() => { setIsAddStockModalOpen(false); setAddStockError(null); }} className={`px-6 py-2.5 rounded-lg font-semibold transition-colors ${isDarkTheme ? 'text-gray-300 bg-gray-700 hover:bg-gray-600' : 'text-slate-700 bg-gray-200 hover:bg-gray-300'}`}>Cancel</button>
                  <button type="submit" className={`px-8 py-2.5 text-white font-bold rounded-lg shadow-md hover:shadow-lg flex items-center gap-2 transition-all ${isDarkTheme ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900 hover:bg-slate-800'}`}><Plus size={18} /> Add Entry</button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Stock Modal */}
      {editingStock && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4 font-poppins">
          <div className={`rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`px-6 py-4 flex justify-between items-center shrink-0 border-b ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-50/50 border-gray-200'}`}>
              <h3 className={`font-extrabold text-lg flex items-center gap-3 ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                <Edit size={24} className="text-[var(--color-primary)]" />
                Edit Stock Entry
              </h3>
              <button onClick={handleCloseEditModal} className={`p-1.5 rounded-full transition-colors ${isDarkTheme ? 'text-gray-400 hover:bg-gray-600' : 'text-slate-500 hover:bg-gray-200'}`}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateStock} className={`p-6 overflow-y-auto space-y-8 custom-scrollbar ${isDarkTheme ? 'bg-gray-800' : ''}`}>
              <div className="grid md:grid-cols-2 gap-8">
                {/* Left Column: Product Info & Barcode */}
                <div className="space-y-6 flex flex-col">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Product Name</p>
                    <h2 className={`font-bold text-2xl ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{editingStock.Particulars || 'N/A'}</h2>
                  </div>
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Product Code</p>
                    <p className={`font-mono font-bold text-lg px-3 py-1 rounded-md inline-block ${isDarkTheme ? 'text-white bg-gray-700' : 'text-[var(--color-primary)] bg-gray-100'}`}>{editingStock.ProductCode || 'N/A'}</p>
                  </div>
                  <div className={`flex-grow flex items-center justify-center rounded-lg p-4 mt-auto ${isDarkTheme ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    {editingStock.ProductCode ? (
                      <BarcodeDisplay value={editingStock.ProductCode} size="large" />
                    ) : (
                      <p className={isDarkTheme ? 'text-gray-400' : 'text-slate-400'}>No barcode available</p>
                    )}
                  </div>
                </div>

                {/* Right Column: Editable Details */}
                <div className="space-y-6">
                  {/* Status Display */}
                  <div className="p-4 rounded-lg border-2">
                    {(() => {
                      const isExpired = editingStock.ExpirationDate && new Date(editingStock.ExpirationDate) < new Date();
                      const quantity = editingStock.Quantity;
                      const reorderLevel = editingStock.ReorderLevel || 10;
                      let status, Icon, colorClass;

                      if (isExpired) {
                        status = 'Expired'; Icon = AlertCircle; colorClass = isDarkTheme ? 'border-red-700 bg-red-900/30 text-red-400' : 'border-red-500 bg-red-50 text-red-700';
                      } else if (quantity === 0) {
                        status = 'Out of Stock'; Icon = XCircle; colorClass = isDarkTheme ? 'border-red-700 bg-red-900/30 text-red-400' : 'border-red-500 bg-red-50 text-red-700';
                      } else if (quantity < reorderLevel) {
                        status = 'Low Stock'; Icon = AlertTriangle; colorClass = isDarkTheme ? 'border-orange-700 bg-orange-900/30 text-orange-400' : 'border-orange-500 bg-orange-50 text-orange-700';
                      } else {
                        status = 'In Stock'; Icon = CheckCircle; colorClass = isDarkTheme ? 'border-green-700 bg-green-900/30 text-green-400' : 'border-green-500 bg-green-50 text-green-700';
                      }

                      return (
                        <div className={`flex items-center gap-3 ${colorClass}`}>
                          <Icon size={24} className="shrink-0" />
                          <div className="flex-grow">
                            <p className="font-bold text-lg">{status}</p>
                            {isExpired && <p className="text-xs font-semibold">Expired on: {new Date(editingStock.ExpirationDate).toLocaleDateString()}</p>}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Editable Fields */}
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Quantity</label>
                      <input type="number" name="quantity" required value={editFormData.quantity} onChange={handleEditFormChange} className={`w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300'}`} min="0"/>
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Expiration Date</label>
                      <input type="date" name="expirationDate" value={editFormData.expirationDate} onChange={handleEditFormChange} className={`w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`}/>
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Selling Price ({currencySymbol})</label>
                      <input type="number" step="0.01" name="unitPrice" required value={editFormData.unitPrice} onChange={handleEditFormChange} className={`w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300'}`} min="0"/>
                    </div>

                    <div className={`border rounded-lg p-4 ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-slate-50/70 border-slate-200'}`}>
                      <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Batch Number</p>
                      <p className={`font-semibold ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{editingStock.BatchNumber || 'N/A'}</p>
                    </div>

                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Date Added</p>
                      <p className={`font-semibold ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{editingStock.DateAdded ? new Date(editingStock.DateAdded).toLocaleDateString() : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </form>

            {/* Action Buttons */}
            <div className={`px-6 py-4 border-t flex justify-end gap-3 ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-50/50 border-gray-200'}`}>
              <button type="button" onClick={handleCloseEditModal} className={`px-5 py-2.5 text-sm font-bold rounded-lg shadow-sm transition-all border ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' : 'bg-white border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-light)]'}`}>
                Cancel
              </button>
              <button onClick={handleUpdateStock} className="px-5 py-2.5 text-sm bg-[var(--color-primary)] text-white font-bold rounded-lg shadow-md hover:bg-[var(--color-hover)] transition-all flex items-center gap-2">
                <Save size={16} /> Update Entry
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm Delete Modal */}
      {deleteStockId && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
          <div className={`rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200 ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
             <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto ${isDarkTheme ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-600'}`}>
                <AlertTriangle size={24} />
             </div>
             <h3 className={`text-lg font-extrabold text-center mb-2 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Confirm Deletion</h3>
             <p className={`text-center text-sm mb-6 font-medium ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
               Are you sure you want to delete this stock entry? This action cannot be undone.
             </p>
             <div className="flex gap-3">
                <button onClick={() => setDeleteStockId(null)} className={`flex-1 py-2.5 font-bold rounded-lg transition-colors ${isDarkTheme ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-slate-700 hover:bg-gray-200'}`}>
                  Cancel
                </button>
                <button onClick={() => handleConfirmDelete(deleteStockId)} className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-md">
                  Delete
                </button>
             </div>
          </div>
        </div>,
        document.body
      )}

      {/* Mark Damaged Modal */}
      {isMarkDamagedModalOpen && selectedStockItem && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4 font-poppins">
          <div className={`rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`px-6 py-4 flex justify-between items-center shrink-0 border-b ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-red-50/50 border-gray-200'}`}>
              <h3 className={`font-extrabold text-lg flex items-center gap-3 ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                <AlertTriangle size={24} className={isDarkTheme ? 'text-red-400' : 'text-red-600'} />
                Mark Item as Damaged
              </h3>
              <button onClick={() => setIsMarkDamagedModalOpen(false)} className={`p-1.5 rounded-full transition-colors ${isDarkTheme ? 'text-gray-400 hover:bg-gray-600' : 'text-slate-500 hover:bg-gray-200'}`}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleMarkItemDamaged} className={`p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1 ${isDarkTheme ? 'bg-gray-800' : ''}`}>
              {/* Product Info */}
              <div className={`border rounded-lg p-4 space-y-3 ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Product Name</p>
                  <p className={`font-bold text-lg ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{selectedStockItem.Particulars || 'N/A'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Product Code</p>
                    <p className={`font-mono font-bold ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{selectedStockItem.ProductCode || 'N/A'}</p>
                  </div>
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Current Stock</p>
                    <p className={`font-bold ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{selectedStockItem.Quantity} units</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Batch Number</p>
                    <p className={`font-semibold ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{selectedStockItem.BatchNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Expiry Date</p>
                    <p className={`font-semibold ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{selectedStockItem.ExpirationDate ? new Date(selectedStockItem.ExpirationDate).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Quantity Input */}
              <div>
                <label className={`block text-sm font-bold mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>
                  Quantity to Mark as Damaged
                  <span className="text-red-600">*</span>
                </label>
                <input 
                  type="number" 
                  required 
                  value={damageQuantity} 
                  onChange={(e) => setDamageQuantity(e.target.value)} 
                  className={`w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300'}`}
                  placeholder="Enter quantity"
                  min="1"
                  max={selectedStockItem.Quantity}
                />
                <p className={`text-xs mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Maximum: {selectedStockItem.Quantity} units</p>
              </div>

              {/* Reason Input */}
              <div>
                <label className={`block text-sm font-bold mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>
                  Reason for Damage
                  <span className="text-red-600">*</span>
                </label>
                <textarea 
                  required 
                  value={damageReason} 
                  onChange={(e) => setDamageReason(e.target.value)} 
                  className={`w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300'}`}
                  placeholder="e.g., Expired, Broken packaging, Defective product..."
                  rows={4}
                />
              </div>
            </form>

            {/* Action Buttons */}
            <div className={`px-6 py-4 border-t flex justify-end gap-3 ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-50/50 border-gray-200'}`}>
              <button 
                type="button" 
                onClick={() => setIsMarkDamagedModalOpen(false)} 
                className={`px-5 py-2.5 text-sm font-bold rounded-lg shadow-sm transition-all border ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' : 'bg-white border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-light)]'}`}
              >
                Cancel
              </button>
              <button 
                onClick={handleMarkItemDamaged}
                disabled={isDamagingItem}
                className="px-5 py-2.5 text-sm bg-red-600 text-white font-bold rounded-lg shadow-md hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDamagingItem ? (
                  <>
                    <Loader size={16} className="animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <AlertTriangle size={16} /> Mark as Damaged
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Change Item Modal (New) */}
      {isChangeItemModalOpen && selectedStockItem && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
          <div className={`rounded-xl shadow-2xl max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
            {/* Modal Header */}
            <div className={`flex justify-between items-center mb-6 pb-4 border-b ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
              <div>
                <h2 className={`text-2xl font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Process Transaction</h2>
                <p className={`text-sm mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Exchange for: {selectedStockItem.Particulars}</p>
              </div>
              <button
                onClick={resetModal}
                className={`transition-colors ${isDarkTheme ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-6">
              {/* Item to Return */}
              <div>
                <label className={`block text-sm font-semibold mb-3 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Item to Return</label>
                <div className={`border rounded-lg overflow-hidden ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className={`p-4 ${isDarkTheme ? 'bg-gray-700' : ''}`}>
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{selectedStockItem.Particulars}</p>
                        <p className={`text-xs mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
                          Code: {selectedStockItem.ProductCode || 'N/A'} | In Stock: {selectedStockItem.Quantity}
                        </p>
                        <p className={`text-xs mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Selling Price: {currencySymbol}{(selectedStockItem.SellingPrice || 0).toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        <label className={`text-xs font-semibold ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Qty:</label>
                        <input
                          type="number"
                          min="1"
                          max={selectedStockItem.Quantity}
                          value={itemQuantities[0] || 1}
                          onChange={(e) => {
                            const qty = Math.min(Math.max(1, parseInt(e.target.value) || 1), selectedStockItem.Quantity);
                            setItemQuantities({ 0: qty });
                          }}
                          className={`w-16 px-2 py-1 border rounded text-sm focus:outline-none focus:border-blue-500 ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Replacement Product Selection */}
              <div>
                <label className={`block text-sm font-semibold mb-3 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Select Replacement Product from Inventory *</label>
                <div className={`border rounded-lg p-4 ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
                  <select
                    value={selectedReplacementProduct.get(0) || ''}
                    onChange={(e) => {
                      const productCode = e.target.value ? e.target.value : '';
                      const newMap = new Map(selectedReplacementProduct);
                      newMap.set(0, productCode);
                      setSelectedReplacementProduct(newMap);
                      
                      if (!replacementQuantity.has(0)) {
                        const qtyMap = new Map(replacementQuantity);
                        qtyMap.set(0, 1);
                        setReplacementQuantity(qtyMap);
                      }
                    }}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-200'}`}
                  >
                    <option value="">-- Select replacement product --</option>
                    {stocks.map((stock) => {
                      const code = stock.ProductCode || `ENTRY-${stock.StockEntryID}`;
                      if (selectedStockItem.ProductCode === code || selectedStockItem.ProductID === stock.ProductID) {
                        return null;
                      }
                      return (
                        <option key={stock.StockEntryID} value={code}>
                          {stock.Particulars || 'Unknown'} - Code: {code} | Stock: {stock.Quantity} | Price: {currencySymbol}{((stock.SellingPrice || stock.UnitPrice) || 0).toFixed(2)}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              
              {/* Reason */}
              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Reason *</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={'e.g., Defective product, wrong item, customer preference'}
                  rows={3}
                  className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-200'}`}
                />
              </div>

              {/* Action Buttons */}
              <div className={`flex gap-3 pt-4 border-t ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
                <button
                  onClick={resetModal}
                  className={`flex-1 py-2.5 px-4 font-bold rounded-lg transition-colors ${isDarkTheme ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateChangeItem}
                  disabled={isSubmitting || !selectedReplacementProduct.get(0) || !reason.trim()}
                  className="flex-1 py-2.5 px-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Processing...' : 'Process Change'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Success Modal */}
      {successMessage && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
          <div className={`rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200 ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
             <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto ${isDarkTheme ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-600'}`}>
                <CheckCircle size={28} />
             </div>
             <h3 className={`text-lg font-extrabold text-center mb-2 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Success</h3>
             <p className={`text-center text-sm mb-6 font-medium ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
               {successMessage}
             </p>
             <button onClick={() => setSuccessMessage(null)} className={`w-full py-2.5 text-white font-bold rounded-lg transition-colors shadow-md ${isDarkTheme ? 'bg-green-700 hover:bg-green-800' : 'bg-green-600 hover:bg-green-700'}`}>
               Close
             </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Stock;