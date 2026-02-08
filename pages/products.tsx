
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePharmacy } from '../context/PharmacyContext';
import apiClient from '../lib/apiClient';
import { Plus, Search, Trash2, AlertCircle, Edit, X, Eye, AlertTriangle, Save, Loader, FileText, Download, Grid3X3, List, CheckCircle } from 'lucide-react';
import { Medicine } from '../types';
import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';

// Barcode display component
const BarcodeDisplay: React.FC<{ productCode?: string; particulars?: string; barcode?: string | number; size?: 'small' | 'medium' | 'large' }> = ({ productCode, particulars, barcode, size = 'small' }) => {
  const { themeColor } = usePharmacy();
  const isDarkTheme = themeColor === 'black';
  const barcodeRef = useRef<SVGSVGElement>(null);

  // Generate barcode value from productCode and first few letters of particulars
  const generateBarcodeValue = () => {
    if (barcode !== undefined && barcode !== null && barcode !== '') return String(barcode);
    
    if (productCode && particulars) {
      // Combine product code with first 6 chars of particulars (remove spaces)
      const particularsCode = particulars.replace(/\s+/g, '').substring(0, 6).toUpperCase();
      return `${productCode}${particularsCode}`;
    }
    
    return productCode || 'NOCODE';
  };

  const barcodeValue = generateBarcodeValue();

  useEffect(() => {
    if (barcodeRef.current && barcodeValue) {
      try {
        JsBarcode(barcodeRef.current, barcodeValue, {
          format: 'CODE128',
          width: size === 'small' ? 1 : size === 'medium' ? 1.5 : 2,
          height: size === 'small' ? 30 : size === 'medium' ? 50 : 80,
          displayValue: true,
          fontSize: size === 'small' ? 10 : size === 'medium' ? 12 : 14,
          margin: 5,
        });
        
        // Apply dark mode text color to SVG if theme is dark
        if (isDarkTheme && barcodeRef.current) {
          const textElements = barcodeRef.current.querySelectorAll('text');
          textElements.forEach(el => {
            el.setAttribute('fill', 'white');
          });
        }
      } catch (err) {
        console.error('Barcode generation error:', err);
      }
    }
  }, [barcodeValue, size, isDarkTheme]);

  if (!barcodeValue || barcodeValue === 'NOCODE') return <span className="text-gray-400 text-xs">No barcode</span>;

  return <svg ref={barcodeRef}></svg>;
};

const Inventory: React.FC = () => {
  const { currencySymbol, user, themeColor } = usePharmacy();
  const isDarkTheme = themeColor === 'black';
  const [inventory, setInventory] = useState<any[]>([]);
  const [stockEntries, setStockEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Role-based access control
  const isAdmin = user?.role === 'admin';
  const isPharmacyAssistant = user?.role === 'pharmacy_assistant';
  
  // View Details State
  const [viewMedicine, setViewMedicine] = useState<any | null>(null);

  // Barcode Modal State
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [selectedBarcode, setSelectedBarcode] = useState<any>(null);

  // Barcode Scanning State
  const [isBarcodeAddStockModalOpen, setIsBarcodeAddStockModalOpen] = useState(false);
  const [scannedProductForStock, setScannedProductForStock] = useState<any | null>(null);
  const [barcodeStockFormData, setBarcodeStockFormData] = useState({
    quantity: '',
    expirationDate: ''
  });
  const [currentStockQuantity, setCurrentStockQuantity] = useState(''); // For displaying current quantity at top
  const barcodeScanInputRef = useRef<HTMLInputElement>(null);

  // Success Modal State
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Error Modal State
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Categories State
  const [categories, setCategories] = useState<{ CategoryCode: string; CategoryName: string; }[]>([]);

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);

  // Confirmation States
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Expired Products Notification State
  const [expiredProducts, setExpiredProducts] = useState<any[]>([]);
  const [showExpiredNotification, setShowExpiredNotification] = useState(false);

  // View Mode State - Persist to localStorage
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('productViewMode');
      return (saved as 'table' | 'grid') || 'table';
    }
    return 'table';
  });

  // Save view mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('productViewMode', viewMode);
  }, [viewMode]);

  // Filter and Sort States
  const [filters, setFilters] = useState({
    category: '',
    date: '',
  });
  const [sorting, setSorting] = useState({
    sortBy: 'ProductName',
    sortOrder: 'ASC',
  });

  const [formData, setFormData] = useState({
    productCode: '',
    particulars: '',
    brandName: '',
    categoryName: '',
    description: '',
    sellingPrice: '',
    reorderLevel: '',
    barcode: '',
    expiryDate: ''
  });

  const [originalBarcode, setOriginalBarcode] = useState('');

  // Fetch categories from API on component mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await apiClient.getCategories();
        if (response.success && response.data) {
          setCategories(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch categories", error);
      }
    };
    fetchCategories();
  }, []);

  // Fetch inventory from API on component mount or when filters/sorting change
  useEffect(() => {
    fetchInventory();
  }, [filters, sorting]);

  // Fetch stock entries on mount and when inventory changes
  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const response = await apiClient.getStockEntries();
        if (response.success) {
          setStockEntries(response.data || []);
        }
      } catch (err) {
        console.error('Error fetching stock entries:', err);
      }
    };
    fetchStocks();
  }, []);

  // Set up global barcode scan listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.tagName === 'TEXTAREA'
      );

      // If user is already typing in an input, don't hijack focus
      if (isTyping) {
        return;
      }
      
      // Focus barcode input on any key press when modal is open
      if (barcodeScanInputRef.current) {
        barcodeScanInputRef.current.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchInventory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [inventoryResponse, stockEntriesResponse] = await Promise.all([
        apiClient.getInventory({
          category: filters.category,
          date: filters.date,
          sortBy: sorting.sortBy,
          sortOrder: sorting.sortOrder,
        }),
        apiClient.getStockEntries()
      ]);
      
      if (inventoryResponse.success) {
        setInventory(inventoryResponse.data || []);
      } else {
        setError(inventoryResponse.message || 'Failed to load inventory');
      }
      
      if (stockEntriesResponse.success) {
        setStockEntries(stockEntriesResponse.data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading inventory');
      console.error('Inventory fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'ProductNameDesc') {
      setSorting({ sortBy: 'ProductName', sortOrder: 'DESC' });
    } else if (value === 'UnitPriceDesc') {
      setSorting({ sortBy: 'UnitPrice', sortOrder: 'DESC' });
    } else if (value === 'DateAddedDesc') {
      setSorting({ sortBy: 'DateAdded', sortOrder: 'DESC' });
    } else if (value) {
      setSorting({ sortBy: value, sortOrder: 'ASC' });
    }
  };

  const toggleSortOrder = () => {
    setSorting(prev => ({ ...prev, sortOrder: prev.sortOrder === 'ASC' ? 'DESC' : 'ASC' }));
  };

  const clearFilters = () => {
    setFilters({ category: '', date: '' });
    setSorting({ sortBy: 'ProductName', sortOrder: 'ASC' });
  };


  const filteredMedicines = inventory.filter((m: any) => {
    // Search filter
    const matchesSearch = (m.ProductName || m.Particulars)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.ProductCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.BrandName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.Category || m.CategoryName)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.Description?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Category filter
    if (filters.category && (m.Category || m.CategoryName) !== filters.category) {
      return false;
    }

    // Date filter
    if (filters.date) {
      const filterDate = new Date(filters.date).toLocaleDateString();
      const itemDate = new Date(m.DateAdded).toLocaleDateString();
      if (itemDate !== filterDate) {
        return false;
      }
    }

    return true;
  }).sort((a: any, b: any) => {
    let aValue = a[sorting.sortBy];
    let bValue = b[sorting.sortBy];

    // Handle null/undefined values
    if (aValue === null || aValue === undefined) aValue = '';
    if (bValue === null || bValue === undefined) bValue = '';

    // Convert to numbers for numeric fields
    if (sorting.sortBy === 'UnitPrice' || sorting.sortBy === 'CurrentStock') {
      aValue = Number(aValue) || 0;
      bValue = Number(bValue) || 0;
      return sorting.sortOrder === 'ASC' ? aValue - bValue : bValue - aValue;
    }

    // String comparison
    const comparison = String(aValue).localeCompare(String(bValue));
    return sorting.sortOrder === 'ASC' ? comparison : -comparison;
  });

  const isExpired = (expiryDate: string) => {
    if (!expiryDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const itemDate = new Date(expiryDate);
    itemDate.setHours(0, 0, 0, 0);
    // Product is expired if expiry date is today or earlier
    const expired = itemDate <= today;
    return expired;
  };

  // Check if a product has any expired stock
  const hasExpiredStock = (productId: number) => {
    return stockEntries.some(entry => 
      entry.ProductID === productId && entry.ExpirationDate && isExpired(entry.ExpirationDate)
    );
  };

  // Get all expired products with their details
  const getExpiredProductsList = () => {
    const expired: any[] = [];
    inventory.forEach(product => {
      if (hasExpiredStock(product.ProductID)) {
        const expiredStockEntries = stockEntries.filter(entry =>
          entry.ProductID === product.ProductID && entry.ExpirationDate && isExpired(entry.ExpirationDate)
        );
        
        if (expiredStockEntries.length > 0) {
          expired.push({
            ...product,
            expiredStockEntries: expiredStockEntries,
            expiredCount: expiredStockEntries.length
          });
        }
      }
    });
    return expired;
  };

  // Update expired products list in real-time
  useEffect(() => {
    const expiredList = getExpiredProductsList();
    setExpiredProducts(expiredList);
    setShowExpiredNotification(expiredList.length > 0);
  }, [stockEntries, inventory]);

  // Auto-refresh stock entries every 30 seconds to detect new expirations
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await apiClient.getStockEntries();
        if (response.success && response.data) {
          setStockEntries(response.data);
        }
      } catch (error) {
        console.error('Error refreshing stock entries:', error);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Barcode scanning handler
  const handleBarcodeScan = async (scannedCode: string) => {
    if (!scannedCode || scannedCode.trim() === '') return;
    
    try {
      // The scanned barcode can be in two formats:
      // 1. Just the product code: "ANTI001"
      // 2. Product code + product name chars: "ANTI001AMOXIC"
      
      // First, try exact match with full scanned code
      let foundProduct = inventory.find(p => 
        (p.ProductCode || '').toLowerCase() === scannedCode.toLowerCase()
      );

      // If not found, try to extract product code from combined barcode
      if (!foundProduct) {
        // Get all unique category codes from inventory
        const categoryCodes = [...new Set(inventory.map(p => p.ProductCode?.replace(/\d+$/, '')))].filter(Boolean);
        
        // Find which category code matches the beginning of the scanned code
        for (const categoryCode of categoryCodes) {
          if (scannedCode.toLowerCase().startsWith(categoryCode.toLowerCase())) {
            // Extract the product code (category code + numbers)
            const numberPart = scannedCode.substring(categoryCode.length);
            const productCodeMatch = numberPart.match(/^\d+/);
            
            if (productCodeMatch) {
              const extractedProductCode = categoryCode + productCodeMatch[0];
              foundProduct = inventory.find(p => 
                (p.ProductCode || '').toLowerCase() === extractedProductCode.toLowerCase()
              );
              break;
            }
          }
        }
      }

      if (foundProduct) {
        // Fetch stock entries to get the latest expiry date and quantity for this product
        let latestExpiryDate = '';
        let latestQuantity = '';
        try {
          const stockEntriesResponse = await apiClient.getStockEntries();
          if (stockEntriesResponse.success && stockEntriesResponse.data) {
            // Find stock entries for this product and get the latest (most recent) expiry date
            const productStockEntries = stockEntriesResponse.data.filter(entry => 
              entry.ProductID === foundProduct.ProductID
            );
            
            if (productStockEntries.length > 0) {
              // Sort by expiry date and get the latest one
              const sortedByExpiry = productStockEntries.sort((a, b) => {
                const dateA = new Date(a.ExpirationDate).getTime();
                const dateB = new Date(b.ExpirationDate).getTime();
                return dateB - dateA; // Latest first
              });
              
              if (sortedByExpiry[0].ExpirationDate) {
                // Format date as YYYY-MM-DD for the date input
                const expiryDate = new Date(sortedByExpiry[0].ExpirationDate);
                latestExpiryDate = expiryDate.toISOString().split('T')[0];
              }
              
              // Get quantity from the latest stock entry
              if (sortedByExpiry[0].Quantity) {
                latestQuantity = sortedByExpiry[0].Quantity.toString();
              }
            }
          }
        } catch (error) {
          console.error('Error fetching stock entries:', error);
          // Continue without expiry date and quantity if fetch fails
        }

        // Set the scanned product and open the stock entry modal
        setScannedProductForStock(foundProduct);
        setCurrentStockQuantity(latestQuantity); // Store actual quantity for display
        setBarcodeStockFormData({
          quantity: '', // Keep empty - user will enter the amount to add
          expirationDate: latestExpiryDate
        });
        // Close the barcode viewer modal if it's open
        setIsBarcodeModalOpen(false);
        setIsBarcodeAddStockModalOpen(true);
      } else {
        // Show error if product not found
        alert(`No product found with code: ${scannedCode}`);
      }
    } catch (error) {
      console.error('Barcode scan error:', error);
      alert('Error scanning barcode');
    }
  };

  // Barcode scan input change handler
  const handleBarcodeScanInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const scannedCode = e.target.value.trim();
    
    // Trigger scan when barcode is entered (would be detected via onKeyPress instead)
  };

  // Focus barcode input when component mounts or modal opens
  useEffect(() => {
    if (barcodeScanInputRef.current && isBarcodeAddStockModalOpen) {
      setTimeout(() => barcodeScanInputRef.current?.focus(), 100);
    }
  }, [isBarcodeAddStockModalOpen]);

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormData({
      productCode: '',
      particulars: '',
      brandName: '',
      categoryName: '',
      description: '',
      sellingPrice: '',
      reorderLevel: '',
      barcode: '',
      expiryDate: ''
    });
    setIsModalOpen(true);
    setModalFormError('');
  };

  const handleOpenEditModal = (med: any) => {
    setEditingId(med.ProductID?.toString() || null);
    const barcodeValue = med.Barcode || '';
    setOriginalBarcode(barcodeValue);
    setFormData({
      productCode: med.ProductCode || '',
      particulars: med.ProductName || med.Particulars || '',
      brandName: med.BrandName || '',
      categoryName: med.Category || med.CategoryName || '',
      description: med.Description || '',
      sellingPrice: (med.UnitPrice || med.SellingPrice || '') !== '' ? String(Number(med.UnitPrice || med.SellingPrice).toFixed(2)) : '',
      reorderLevel: med.ReorderLevel || '',
      barcode: barcodeValue,
      expiryDate: med.ExpirationDate || med.ExpiryDate || ''
    });
    setIsModalOpen(true);
    setModalFormError('');
  };

  const handleViewProduct = (med: any) => {
    setViewMedicine(med);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalFormError, setModalFormError] = useState<string>('');

  // ... (other state)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Note: Expiration dates are stored on stock entries (stockentries table).
    // Don't require expiry on the product record itself; stock entries will carry expiry information.

    try {
      const isCreating = !editingId;
      const actionType = isCreating ? 'Created' : 'Updated';
      const productName = formData.particulars || formData.productCode;

      const currentUserId = user?.id ? Number(user.id) : undefined;

      // When updating, preserve the original barcode value
      let submitData: any = isCreating ? { ...formData } : { ...formData, barcode: originalBarcode };

      // Remove expiryDate from product payload — expiry is stored per stock entry in `stockentries` table
      if (submitData && Object.prototype.hasOwnProperty.call(submitData, 'expiryDate')) {
        delete submitData.expiryDate;
      }

      // Normalize sellingPrice to a numeric value with two decimal places
      if (submitData && Object.prototype.hasOwnProperty.call(submitData, 'sellingPrice')) {
        const raw = submitData.sellingPrice;
        const num = Number(raw);
        submitData.sellingPrice = isNaN(num) ? 0 : Number(num.toFixed(2));
      }

      let response;
      if (isCreating) {
        const maxAttempts = 5;
        let attempt = 0;
        let created = false;

        // helper to regenerate a new product code based on category and latest inventory
        // `offset` allows producing a different candidate on each retry (helps with concurrent inserts)
        const regenerateCode = async (offset: number = 0) => {
          const selectedCategory = categories.find(c => c.CategoryName === formData.categoryName);
          const prefix = selectedCategory?.CategoryCode || (formData.productCode ? String(formData.productCode).replace(/\d+$/, '') : '');
          if (!prefix) return null;

          // refresh inventory to get the latest codes
          let latestInventory: any[] = inventory;
          try {
            const latestInvResp = await apiClient.getInventory({ category: '', date: '', sortBy: sorting.sortBy, sortOrder: sorting.sortOrder });
            if (latestInvResp && latestInvResp.success && latestInvResp.data) {
              latestInventory = latestInvResp.data;
            }
          } catch (invErr) {
            console.error('Failed to refresh inventory when regenerating code:', invErr);
          }

          const existingCodes = latestInventory
            .map((p: any) => p.ProductCode)
            .filter((code: any) => code && String(code).startsWith(prefix));

          let nextNumber = 1;
          if (existingCodes.length > 0) {
            const highestNumber = existingCodes.reduce((max: number, code: string) => {
              const num = parseInt(String(code).slice(prefix.length), 10);
              return isNaN(num) ? max : Math.max(max, num);
            }, 0);
            nextNumber = highestNumber + 1;
          }

          // apply offset so each retry produces a different candidate (useful under concurrency)
          const finalNumber = nextNumber + Math.max(0, offset);
          const newProductCode = `${prefix}${String(finalNumber).padStart(3, '0')}`;
          submitData.productCode = newProductCode;
          setFormData(prev => ({ ...prev, productCode: newProductCode }));
          return newProductCode;
        };

        while (attempt < maxAttempts && !created) {
          attempt += 1;
          try {
            response = await apiClient.createProduct(submitData, currentUserId);

            // If API returned a structured response, check success
            if (response && response.success) {
              created = true;
              break;
            }

            // If API returned non-success with a message indicating duplicate, regenerate and retry
            const msg = response && response.message ? String(response.message) : '';
            // If server indicates duplicate product name, show field error and stop
            if (/same name|same product name|already exists/i.test(msg)) {
              setModalFormError(msg || 'A product with the same name already exists.');
              response = { success: false, message: msg } as any;
              break;
            }
            if (/duplicate entry|productcode|duplicate/i.test(msg)) {
              console.warn(`Duplicate detected on attempt ${attempt}: ${msg} — regenerating code and retrying`);
              const newCode = await regenerateCode(Math.max(0, attempt - 1));
              if (!newCode) break; // cannot regenerate - stop
              continue; // retry loop
            }

            // Non-duplicate failure: surface message and stop retrying
            setError(msg || `Server error (attempt ${attempt})`);
            break;
          } catch (err: any) {
            const errMsg = (err && err.message) ? err.message : String(err);

            // If server returned duplicate-name as an error, show field error and stop retrying
            if (/same name|same product name|already exists/i.test(errMsg)) {
              setModalFormError(errMsg);
              response = { success: false, message: errMsg } as any;
              break;
            }

            if (/duplicate entry|productcode|duplicate/i.test(errMsg)) {
              console.warn(`Duplicate exception on attempt ${attempt}: ${errMsg} — regenerating code and retrying`);
              const newCode = await regenerateCode(Math.max(0, attempt - 1));
              if (!newCode) {
                setError('Failed to generate a new product code.');
                break;
              }
              continue; // retry
            }

            // Non-duplicate exception (e.g., HTTP 500): surface error and stop
            console.error('Create product error:', err);
            setError(errMsg || 'Error creating product');
            break;
          }
        }

        if (!created && !response) {
          // If we exited loop without a response, ensure response is set to indicate failure
          response = { success: false, message: 'Failed to create product' } as any;
        }
      } else {
        try {
          response = await apiClient.updateProduct(Number(editingId), submitData, currentUserId);
        } catch (err: any) {
          const errMsg = (err && err.message) ? err.message : String(err);
          if (/same name|same product name|already exists/i.test(errMsg)) {
            setModalFormError(errMsg);
            // stop processing so modal stays open
            setIsSubmitting(false);
            return;
          }
          throw err; // rethrow for outer catch
        }
      }

      if (response.success) {
        // Log the action
        const userId = user?.id ? Number(user.id) : undefined;
        apiClient.logAction(`${actionType} product: ${productName} (Code: ${formData.productCode}, Category: ${formData.categoryName})`, userId).catch(err => console.error('Audit log failed:', err));

        setIsModalOpen(false);
        setFormData({
          productCode: '',
          particulars: '',
          brandName: '',
          categoryName: '',
          description: '',
          sellingPrice: '',
          reorderLevel: '',
          barcode: '',
          expiryDate: ''
        });
        setOriginalBarcode('');
        setEditingId(null);
        fetchInventory(); // Refresh after changes
        
        setSuccessMessage(`Product successfully ${actionType.toLowerCase()}!`);
        setIsSuccessModalOpen(true);

      } else {
        setError(response.message || `Failed to ${isCreating ? 'create' : 'update'} product.`);
      }
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
  
    if (name === 'categoryName' && !editingId) {
      const selectedCategory = categories.find(c => c.CategoryName === value);
      if (!selectedCategory) return;
  
      const prefix = selectedCategory.CategoryCode;
      
      const existingCodes = inventory
        .map(p => p.ProductCode)
        .filter(code => code && code.startsWith(prefix));
  
      let nextNumber = 1;
      if (existingCodes.length > 0) {
        const highestNumber = existingCodes.reduce((max, code) => {
          const num = parseInt(code.slice(prefix.length), 10);
          return isNaN(num) ? max : Math.max(max, num);
        }, 0);
        nextNumber = highestNumber + 1;
      }
  
      const newProductCode = `${prefix}${String(nextNumber).padStart(3, '0')}`;
  
      setFormData(prev => ({
        ...prev,
        categoryName: value,
        productCode: newProductCode,
        reorderLevel: '1',
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
      if (name === 'particulars') {
        setModalFormError('');
      }
    }
  };

  // Delete Handlers
  const confirmDelete = (id: string) => {
    setDeleteId(id);
  };

  const executeDelete = () => {
    if (deleteId) {
      // Find the product being deleted for logging
      const productToDelete = inventory.find(p => p.ProductID === Number(deleteId));
      const productInfo = productToDelete ? `${productToDelete.ProductName || productToDelete.Particulars} (Code: ${productToDelete.ProductCode})` : deleteId;
      
      // Check total stock quantity for this product
      const filteredStock = stockEntries.filter(s => s.ProductID === Number(deleteId));
      const totalStock = filteredStock.reduce((sum, s) => sum + (Number(s.Quantity) || 0), 0);
      
      console.log('🗑️ DELETE CHECK - Product ID:', deleteId, 'Product Name:', productInfo);
      console.log('   Total Stock Entries:', stockEntries.length);
      console.log('   Matching Stock Entries:', filteredStock);
      console.log('   Total Quantity:', totalStock);
      
      if (totalStock > 0) {
        setErrorMessage(`Cannot delete product with remaining stock (${totalStock} units).`);
        setIsErrorModalOpen(true);
        setDeleteId(null);
        return;
      }
      
      // Log the delete action
      const userId = user?.id ? Number(user.id) : undefined;
      apiClient.logAction(`Deleted product: ${productInfo}`, userId).catch(err => console.error('Audit log failed:', err));
      
      // Call API to soft delete product
      apiClient.deleteProduct(Number(deleteId)).then(response => {
        if (response.success) {
          setDeleteId(null);
          // If the deleted item was being viewed, close the view modal
          if (viewMedicine?.ProductID === Number(deleteId)) {
            setViewMedicine(null);
          }
          fetchInventory(); // Refresh after deletion
          setSuccessMessage('Product deleted successfully!');
          setIsSuccessModalOpen(true);
        } else {
          setErrorMessage(response.message || 'Failed to delete product');
          setIsErrorModalOpen(true);
        }
      }).catch(err => {
        console.error('Delete product error:', err);
        setErrorMessage('Error deleting product: ' + err.message);
        setIsErrorModalOpen(true);
      });
    }
  };

  // Export functions
  const exportToCSV = () => {
    // Log action to audit trail
    const userId = user?.id ? Number(user.id) : undefined;
    apiClient.logAction('Exported Products Report CSV', userId).catch(err => console.error('Audit log failed:', err));
    
    if (filteredMedicines.length === 0) {
      alert('No products to export');
      return;
    }

    const headers = ['Product Code', 'Particulars', 'Brand', 'Category', 'Price', 'Description', 'Date Added'];
    const rows = filteredMedicines.map(m => [
      m.ProductCode || 'N/A',
      m.ProductName || m.Particulars || 'N/A',
      m.BrandName || 'N/A',
      m.Category || m.CategoryName || 'N/A',
      Number(m.UnitPrice || m.SellingPrice || 0).toFixed(2),
      m.Description || 'N/A',
      m.DateAdded ? new Date(m.DateAdded).toLocaleDateString() : 'N/A'
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
    link.setAttribute('download', `products_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up URL object after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const exportToPDF = async () => {
    // Log action to audit trail
    const userId = user?.id ? Number(user.id) : undefined;
    apiClient.logAction('Exported Products Report PDF', userId).catch(err => console.error('Audit log failed:', err));
    
    if (filteredMedicines.length === 0) {
      alert('No products to export');
      return;
    }

    const element = document.createElement('div');
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    element.style.top = '-9999px';
    element.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif; background: white; width: 1200px;">
        <h1 style="text-align: center; color: #333; margin-bottom: 10px; font-size: 24px;">Products Report</h1>
        <p style="text-align: center; color: #666; margin-bottom: 20px; font-size: 12px;">Generated on: ${new Date().toLocaleString()}</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Product Code</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Particulars</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Brand</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Category</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Selling Price</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Description</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Date Added</th>
            </tr>
          </thead>
          <tbody>
            ${filteredMedicines.map(m => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${m.ProductCode || 'N/A'}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${m.ProductName || m.Particulars || 'N/A'}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${m.BrandName || 'N/A'}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${m.Category || m.CategoryName || 'N/A'}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${currencySymbol}${Number(m.UnitPrice || m.SellingPrice || 0).toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${m.Description || 'N/A'}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${m.DateAdded ? new Date(m.DateAdded).toLocaleDateString() : 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.body.appendChild(element);

    try {
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for DOM to render

      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 297; // A4 landscape width in mm
      const pageHeight = 210; // A4 landscape height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        break; // Exit after adding one more page to prevent duplication
      }

      const pdfBlob = pdf.output('blob');
      const fileName = `products_${new Date().toISOString().split('T')[0]}.pdf`;
      saveAs(pdfBlob, fileName);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      if (document.body.contains(element)) {
        document.body.removeChild(element);
      }
    }
  };

  // Add CSS for pulse animation
  const pulseStyle = `
    @keyframes pulse-highlight {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
      }
      50% {
        box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
      }
    }
    .pulse {
      animation: pulse-highlight 2s infinite;
    }
  `;

  return (
    <div className="space-y-6">
      <style>{pulseStyle}</style>
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={fetchInventory} className="ml-auto underline font-bold">Retry</button>
        </div>
      )}

      

      <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4">
        <div className="md:hidden mr-auto">
          <h2 className={`text-2xl font-extrabold md:hidden ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Product Management</h2>
          <p className="text-slate-500 font-medium md:hidden">Manage Your Product Inventory and Details</p>
        </div>                
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative group">
            <button 
              className={`font-bold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors ${isDarkTheme ? 'bg-white text-slate-900 hover:bg-gray-100' : 'bg-[var(--color-primary)] hover:bg-[var(--color-hover)] text-white'}`}
            >
              <Download size={18} strokeWidth={3} />
              Generate Report
            </button>
            <div className={`absolute right-0 mt-2 w-40 border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <button 
                onClick={exportToCSV}
                className={`w-full text-left px-4 py-2.5 hover:opacity-90 flex items-center gap-2 font-semibold text-sm ${isDarkTheme ? 'text-gray-200 hover:bg-gray-700' : 'text-[var(--color-text)] hover:bg-[var(--color-light)]'}`}
              >
                <FileText size={16} />
                Export to CSV
              </button>
              <button 
                onClick={exportToPDF}
                className={`w-full text-left px-4 py-2.5 hover:opacity-90 flex items-center gap-2 font-semibold text-sm border-t ${isDarkTheme ? 'text-gray-200 hover:bg-gray-700 border-gray-700' : 'text-[var(--color-text)] hover:bg-[var(--color-light)] border-gray-100'}`}
              >
                <FileText size={16} />
                Export to PDF
              </button>
            </div>
          </div>
          <button 
            onClick={handleOpenAddModal}
            className={`bg-[var(--color-primary)] hover:bg-[var(--color-hover)] text-white font-bold px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors ${isPharmacyAssistant ? 'hidden' : ''}`}
          >
            <Plus size={20} strokeWidth={3} />
            Add Product
          </button>
        </div>
      </div>

      <div className={`rounded-xl shadow-sm border flex flex-col h-screen md:h-[700px] ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`}>
        {/* Toolbar */}
        <div className={`p-4 border-b flex-shrink-0 ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'border-gray-100 bg-gray-50/50'}`}>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
              <input 
                type="text"
                placeholder="Search by code, particulars, brand, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-200 text-slate-900'}`}
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                name="category"
                value={filters.category}
                onChange={handleFilterChange}
                className={`w-full sm:w-auto pl-3 pr-8 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-slate-900'}`}
              >
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.CategoryCode} value={c.CategoryName}>{c.CategoryName}</option>)}
              </select>
              <input
                type="date"
                name="date"
                value={filters.date}
                onChange={handleFilterChange}
                className={`w-full sm:w-auto px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-slate-900'}`}
              />
              <select
                name="sortBy"
                value={sorting.sortBy}
                onChange={handleSortChange}
                className={`w-full sm:w-auto pl-3 pr-8 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-slate-900'}`}
              >
                <option value="">Sort By</option>
                <option value="ProductName">Name (A-Z)</option>
                <option value="ProductNameDesc">Name (Z-A)</option>
                <option value="UnitPrice"> Selling Price (Low-High)</option>
                <option value="UnitPriceDesc">Selling Price (High-Low)</option>
                <option value="DateAdded">Date (Oldest)</option>
                <option value="DateAddedDesc">Date (Newest)</option>
              </select>
              <button 
                onClick={clearFilters} 
                title="Clear all filters"
                className={`px-4 py-2.5 text-sm font-semibold border rounded-lg transition-all flex items-center gap-2 ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600' : 'bg-white border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-light)]'}`}
              >
                <X size={16} />
                Clear Filters
              </button>
              <div className={`flex items-center gap-2 border rounded-lg p-1 ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded transition-colors ${viewMode === 'table' ? 'bg-[var(--color-primary)] text-white' : 'text-gray-400 hover:text-[var(--color-text)]'}`}
                  title="Table view"
                >
                  <List size={18} />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-[var(--color-primary)] text-white' : 'text-gray-400 hover:text-[var(--color-text)]'}`}
                  title="Grid view"
                >
                  <Grid3X3 size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="p-12 text-center flex flex-col items-center justify-center flex-1">
            <Loader className="animate-spin text-[var(--color-primary)] mb-4" size={32} />
            <p className={`font-semibold ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Loading products...</p>
          </div>
        )}

        {/* Table View (Responsive) */}
        {!isLoading && viewMode === 'table' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
                <thead className={`font-bold text-xs sm:text-sm uppercase tracking-wider sticky top-0 z-10 ${isDarkTheme ? 'bg-gray-700 text-gray-200' : 'bg-[var(--color-light)] text-slate-700'}`}>
                  <tr>
                    <th className="px-3 sm:px-4 py-2 sm:py-4 rounded-tl-lg whitespace-nowrap min-w-[80px] sm:min-w-[100px] text-xs sm:text-sm">Product Code</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-4 whitespace-nowrap min-w-[100px] sm:min-w-[150px] text-xs sm:text-sm">Particulars</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-4 whitespace-nowrap min-w-[80px] sm:min-w-[110px] text-xs sm:text-sm">Category</th>
                    <th className="hidden sm:table-cell px-1 sm:px-4 py-2 sm:py-4 whitespace-nowrap min-w-[80px] sm:min-w-[110px] text-xs sm:text-sm">Brand</th>
                    <th className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap min-w-[100px] sm:min-w-[120px] text-xs sm:text-sm text-center">Selling Price</th>
                    {isPharmacyAssistant ? (
                      <th className="hidden sm:table-cell px-1 sm:px-4 py-2 sm:py-4 whitespace-nowrap min-w-[150px] sm:min-w-[200px] text-xs sm:text-sm rounded-tr-lg">Description</th>
                    ) : (
                      <>
                        <th className="hidden sm:table-cell px-1 sm:px-4 py-2 sm:py-4 text-center whitespace-nowrap min-w-[70px] sm:min-w-[90px] text-xs sm:text-sm">Barcode</th>
                        <th className="px-1 sm:px-4 py-2 sm:py-4 text-right rounded-tr-lg whitespace-nowrap min-w-[60px] sm:min-w-[90px] text-xs sm:text-sm">Actions</th>
                      </>
                    )}
                  </tr>
                </thead>
              </table>
            </div>
            <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
                <tbody className={`divide-y ${isDarkTheme ? 'divide-gray-700' : 'divide-gray-100'}`}>
                {filteredMedicines.map((med: any) => {
                  const dateAdded = med.DateAdded ? new Date(med.DateAdded).toLocaleDateString() : 'N/A';
                  const expired = hasExpiredStock(med.ProductID);
                  
                  return (
                    <tr key={med.ProductID} id={`product-${med.ProductID}`} className={`transition-colors cursor-pointer ${isDarkTheme ? (expired ? 'bg-red-900/30 hover:bg-red-900/40' : 'hover:bg-gray-700') : (expired ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-[var(--color-light)]')}`} onClick={() => handleViewProduct(med)}>
                      <td className="px-3 sm:px-4 py-2 sm:py-4 whitespace-nowrap min-w-[80px] sm:min-w-[100px]">
                        <div className={`font-bold text-xs sm:text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-800'}`}>{med.ProductCode || 'N/A'}</div>
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-4 min-w-[100px] sm:min-w-[150px]">
                        <div className="flex items-center gap-2">
                          <div className={`font-bold truncate text-xs sm:text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-800'}`}>{med.ProductName || med.Particulars || 'N/A'}</div>
                          {expired && <span className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap flex-shrink-0 ${isDarkTheme ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700'}`}>EXPIRED</span>}
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-4 whitespace-nowrap min-w-[80px] sm:min-w-[110px]">
                        <span className={`px-2 py-1 border rounded-full text-xs font-bold ${isDarkTheme ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                          {med.Category || med.CategoryName || 'N/A'}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell px-1 sm:px-4 py-2 sm:py-4 whitespace-nowrap min-w-[80px] sm:min-w-[110px]">
                        <span className={`px-1 sm:px-2.5 py-0.5 sm:py-1 border rounded-full text-xs font-bold ${isDarkTheme ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                          {med.BrandName || 'N/A'}
                        </span>
                      </td>
                      <td className={`hidden md:table-cell px-2 sm:px-4 py-2 sm:py-4 font-bold whitespace-nowrap min-w-[100px] sm:min-w-[120px] text-xs sm:text-sm text-center ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>
                        {currencySymbol}{Number(med.UnitPrice || med.SellingPrice || 0).toFixed(2)}
                      </td>
                      {isPharmacyAssistant ? (
                        <td className={`hidden sm:table-cell px-1 sm:px-4 py-2 sm:py-4 whitespace-nowrap min-w-[150px] sm:min-w-[200px] text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>
                          <span className="line-clamp-2">{med.Description || 'No description'}</span>
                        </td>
                      ) : (
                        <>
                          <td className="hidden sm:table-cell px-1 sm:px-4 py-2 sm:py-4 text-center whitespace-nowrap min-w-[70px] sm:min-w-[90px]">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBarcode(med);
                                setIsBarcodeModalOpen(true);
                              }}
                              className="text-slate-400 hover:text-[var(--color-text)] transition-colors p-1 sm:p-2 hover:bg-[var(--color-light)] rounded-lg inline-flex items-center justify-center"
                              title="View Barcode"
                            >
                              <Eye size={16} className="sm:w-[18px] sm:h-[18px]" />
                            </button>
                          </td>
                        </>
                      )}
                      {!isPharmacyAssistant && (
                        <td className="px-1 sm:px-4 py-2 sm:py-4 text-right whitespace-nowrap min-w-[60px] sm:min-w-[90px]">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewProduct(med);
                              }}
                              className="text-slate-400 hover:text-[var(--color-text)] transition-colors p-1 sm:p-2 hover:bg-[var(--color-light)] rounded-lg lg:hidden"
                              title="View Details"
                            >
                              <FileText size={16} className="sm:w-[18px] sm:h-[18px]" />
                            </button>
                            {isAdmin && (
                              <>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditModal(med);
                                  }}
                                  className="text-slate-400 hover:text-blue-600 transition-colors p-1 sm:p-2 hover:bg-blue-50 rounded-lg hidden lg:block"
                                  title="Edit Product"
                                >
                                  <Edit size={16} className="sm:w-[18px] sm:h-[18px]" />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    confirmDelete(med.ProductID.toString());
                                  }}
                                  className="text-slate-400 hover:text-red-600 transition-colors p-1 sm:p-2 hover:bg-red-50 rounded-lg hidden lg:block"
                                  title="Delete Product"
                                >
                                  <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredMedicines.length === 0 && !isLoading && (
                   <tr>
                       <td colSpan={8} className={`px-6 py-12 text-center ${isDarkTheme ? 'text-gray-400' : 'text-slate-400'}`}>
                           No products found matching your search or filter criteria.
                       </td>
                   </tr>
                )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Grid View */}
        {!isLoading && viewMode === 'grid' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-6">
              {filteredMedicines.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredMedicines.map((med: any) => {
                  const expired = hasExpiredStock(med.ProductID);
                  return (
                  <div key={med.ProductID} id={`product-${med.ProductID}`} className={`border rounded-xl shadow-sm hover:shadow-md transition-all group overflow-hidden ${expired ? (isDarkTheme ? 'border-red-800 bg-red-900/20' : 'border-red-300 bg-red-50') : (isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}`}>
                    <div className="p-4 space-y-4">
                      {/* Header with code and price */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <div className={`font-mono font-bold text-xs px-2 py-1 rounded inline-block ${isDarkTheme ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-slate-700'}`}>
                            {med.ProductCode || 'N/A'}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-lg ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                            {currencySymbol}{Number(med.UnitPrice || med.SellingPrice || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Product name */}
                      <div className="flex items-center justify-between gap-2">
                        <h3 className={`font-bold line-clamp-2 flex-1 ${isDarkTheme ? 'text-gray-300' : 'text-slate-800'}`}>
                          {med.ProductName || med.Particulars || 'N/A'}
                        </h3>
                        {expired && <span className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap flex-shrink-0 ${isDarkTheme ? 'bg-red-900/50 text-red-300' : 'bg-red-200 text-red-700'}`}>EXPIRED</span>}
                      </div>

                      {/* Brand and Category badges */}
                      <div className="space-y-2">
                        {med.BrandName && (
                          <div>
                            <span className={`px-2.5 py-1 border rounded-full text-xs font-bold ${isDarkTheme ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                              {med.BrandName}
                            </span>
                          </div>
                        )}
                        {med.Category || med.CategoryName ? (
                          <div>
                            <span className={`px-2.5 py-1 border rounded-full text-xs font-bold ${isDarkTheme ? 'bg-green-900/30 text-green-300 border-green-700' : 'bg-green-50 text-green-600 border-green-200'}`}>
                              {med.Category || med.CategoryName}
                            </span>
                          </div>
                        ) : null}
                      </div>

                      {/* Description */}
                      {med.Description && (
                        <div className={`pt-2 border-t ${isDarkTheme ? 'border-gray-700' : 'border-gray-100'}`}>
                          <p className={`text-xs font-semibold uppercase ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Description</p>
                          <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'} line-clamp-2`}>{med.Description}</p>
                        </div>
                      )}

                      {/* Barcode preview */}
                      {!isPharmacyAssistant && (
                        <div className={`pt-2 border-t ${isDarkTheme ? 'border-gray-700' : 'border-gray-100'}`}>
                          <button
                            onClick={() => {
                              setSelectedBarcode(med);
                              setIsBarcodeModalOpen(true);
                            }}
                            className={`w-full text-center p-2 rounded-lg transition-colors text-sm font-semibold ${isDarkTheme ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700' : 'text-slate-400 hover:text-[var(--color-text)] hover:bg-[var(--color-light)]'}`}
                          >
                            <Eye size={16} className="mx-auto mb-1" />
                            View Barcode
                          </button>
                        </div>
                      )}

                      {/* Actions */}
                      {!isPharmacyAssistant && (
                        <div className={`pt-2 border-t flex gap-2 ${isDarkTheme ? 'border-gray-700' : 'border-gray-100'}`}>
                          <button
                            onClick={() => handleViewProduct(med)}
                            className={`flex-1 p-2 rounded-lg transition-colors text-xs font-semibold flex items-center justify-center gap-1 ${isDarkTheme ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:text-[var(--color-text)] hover:bg-[var(--color-light)]'}`}
                            title="View Details"
                          >
                            <FileText size={14} /> Details
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(med)}
                                className={`flex-1 p-2 rounded-lg transition-colors text-xs font-semibold flex items-center justify-center gap-1 ${isDarkTheme ? 'text-blue-400 hover:bg-blue-900/30' : 'text-blue-600 hover:bg-blue-50'}`}
                                title="Edit Product"
                              >
                                <Edit size={14} /> Edit
                              </button>
                              <button
                                onClick={() => confirmDelete(med.ProductID.toString())}
                                className={`flex-1 p-2 rounded-lg transition-colors text-xs font-semibold flex items-center justify-center gap-1 ${isDarkTheme ? 'text-red-400 hover:bg-red-900/30' : 'text-red-600 hover:bg-red-50'}`}
                                title="Delete Product"
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {isPharmacyAssistant && (
                        <div className="pt-2 border-t border-gray-100 flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedBarcode(med);
                              setIsBarcodeModalOpen(true);
                            }}
                            className="flex-1 p-2 text-slate-400 hover:text-[var(--color-text)] hover:bg-[var(--color-light)] rounded-lg transition-colors text-xs font-semibold flex items-center justify-center gap-1"
                            title="View Barcode"
                          >
                            <Eye size={14} /> Barcode
                          </button>
                          <button
                            onClick={() => handleViewProduct(med)}
                            className="flex-1 p-2 text-slate-700 hover:text-[var(--color-text)] hover:bg-[var(--color-light)] rounded-lg transition-colors text-xs font-semibold flex items-center justify-center gap-1"
                            title="View Details"
                          >
                            <FileText size={14} /> Details
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
                  <p>No products found matching your search or filter criteria.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal - Rendered via Portal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 font-poppins ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`bg-[var(--color-primary)] px-6 py-4 flex justify-between items-center shrink-0`}>
              <h3 className="text-white font-extrabold text-lg">{editingId ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white hover:bg-white/20 p-1 rounded-full transition-colors">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className={`p-6 overflow-y-auto ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {/* Column 1: Product Details */}
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-bold mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Product Code</label>
                    <input
                      type="text"
                      name="productCode"
                      required
                      value={formData.productCode}
                      onChange={handleChange}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white cursor-not-allowed disabled:bg-gray-600' : 'bg-gray-100 border-gray-300 cursor-not-allowed'}`}
                      placeholder="Auto-generated"
                      disabled
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-bold mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Category</label>
                    <select
                      name="categoryName"
                      value={formData.categoryName}
                      onChange={handleChange}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                      required
                    >
                      <option value="" disabled>Select Category</option>
                      {categories.map(c => <option key={c.CategoryCode} value={c.CategoryName}>{c.CategoryName}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className={`block text-sm font-bold mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Particulars</label>
                    <input
                      type="text"
                      name="particulars"
                      required
                      value={formData.particulars}
                      onChange={handleChange}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                    />
                    {modalFormError && (
                      <p className="text-sm text-red-600 mt-1">{modalFormError}</p>
                    )}
                  </div>

                  <div>
                    <label className={`block text-sm font-bold mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Brand Name</label>
                    <input
                      type="text"
                      name="brandName"
                      value={formData.brandName}
                      onChange={handleChange}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-bold mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Description</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={4}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                      placeholder="Product description..."
                    />
                  </div>
                </div>

                {/* Column 2: Pricing, Inventory, Barcode */}
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-bold mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Selling Price ({currencySymbol})</label>
                    <input
                      type="number"
                      step="0.01"
                      name="sellingPrice"
                      required
                      value={formData.sellingPrice}
                      onChange={handleChange}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-bold mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Expiry Date</label>
                    <input
                      type="date"
                      name="expiryDate"
                      required
                      value={formData.expiryDate}
                      onChange={handleChange}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                    />
                  </div>



                  <div className="pt-2">
                    <label className={`block text-sm font-bold mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Barcode</label>
                    <div className={`p-4 rounded-lg border flex items-center justify-center ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                      <BarcodeDisplay 
                        productCode={formData.productCode}
                        particulars={formData.particulars}
                        barcode={formData.barcode}
                        size="medium" 
                      />
                    </div>
                    <p className={`text-xs mt-2 text-center ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                      {formData.barcode || (formData.productCode && formData.particulars && `${formData.productCode}${formData.particulars.replace(/\s+/g, '').substring(0, 6).toUpperCase()}`)}
                    </p>
                  </div>
                </div>
              </div>

              <div className={`flex justify-end gap-3 mt-6 pt-4 border-t ${isDarkTheme ? 'border-gray-700' : 'border-gray-100'}`}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`px-4 py-2 rounded-lg transition-colors font-semibold ${isDarkTheme ? 'text-gray-400 hover:bg-gray-700' : 'text-slate-600 hover:bg-gray-100'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-6 py-2 text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 ${isDarkTheme ? 'bg-blue-900 hover:bg-blue-800' : 'bg-slate-900 hover:bg-slate-800'}`}
                >
                  {editingId ? <Save size={18} /> : <Plus size={18} />}
                  {editingId ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* View Details Modal - Rendered via Portal */}
      {viewMedicine && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] flex flex-col font-poppins ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
             <div className={`bg-[var(--color-primary)] px-6 py-4 flex justify-between items-center text-white shrink-0`}>
                <h3 className="font-extrabold text-lg">Product Details</h3>
                <button onClick={() => setViewMedicine(null)} className="hover:bg-white/20 p-1 rounded-full"><X size={18} /></button>
             </div>
             <div className={`p-6 space-y-6 overflow-y-auto flex-1 ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
                
                {isPharmacyAssistant ? (
                  <>
                    {/* Pharmacy Assistant View - Optimized Layout */}
                    
                    {/* Product Title */}
                    <div className="space-y-2 pb-4 border-b" style={{ borderColor: isDarkTheme ? '#374151' : '#e5e7eb' }}>
                      <p className={`text-xs font-bold uppercase tracking-widest ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>Product Name</p>
                      <h2 className={`text-2xl font-extrabold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{viewMedicine.ProductName || viewMedicine.Particulars || 'N/A'}</h2>
                    </div>

                    {/* Key Information Grid */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>Product Code</p>
                        <p className={`text-lg font-bold px-3 py-2 rounded-lg w-fit ${isDarkTheme ? 'bg-gray-700 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>{viewMedicine.ProductCode}</p>
                      </div>
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>Product ID</p>
                        <p className={`text-lg font-bold ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{viewMedicine.ProductID}</p>
                      </div>
                    </div>

                    {/* Specifications */}
                    <div className={`rounded-xl p-4 space-y-4 border ${isDarkTheme ? 'bg-gray-700/50 border-gray-600' : 'bg-slate-50 border-gray-200'}`}>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>Brand</p>
                          <p className={`text-sm font-semibold px-2 py-1 rounded w-fit ${isDarkTheme ? 'bg-blue-900/40 text-blue-300 border border-blue-700' : 'bg-blue-100 text-blue-700 border border-blue-300'}`}>{viewMedicine.BrandName || 'N/A'}</p>
                        </div>
                        <div>
                          <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>Category</p>
                          <p className={`text-sm font-semibold px-2 py-1 rounded w-fit ${isDarkTheme ? 'bg-green-900/40 text-green-300 border border-green-700' : 'bg-green-100 text-green-700 border border-green-300'}`}>{viewMedicine.Category || viewMedicine.CategoryName || 'N/A'}</p>
                        </div>
                        <div>
                          <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>Date Added</p>
                          <p className={`text-sm font-semibold ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{viewMedicine.DateAdded ? new Date(viewMedicine.DateAdded).toLocaleDateString() : 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className={`rounded-xl p-5 border-2 ${isDarkTheme ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-300'}`}>
                      <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${isDarkTheme ? 'text-blue-300' : 'text-blue-700'}`}>Selling Price</p>
                      <p className={`text-3xl font-extrabold ${isDarkTheme ? 'text-blue-300' : 'text-blue-700'}`}>{currencySymbol}{Number(viewMedicine.UnitPrice || viewMedicine.SellingPrice || 0).toFixed(2)}</p>
                    </div>

                    {/* Description */}
                    {viewMedicine.Description && (
                      <div className={`rounded-xl p-4 border ${isDarkTheme ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-100 border-gray-300'}`}>
                        <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDarkTheme ? 'text-gray-400' : 'text-gray-700'}`}>Description</p>
                        <p className={`text-sm leading-relaxed ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>{viewMedicine.Description}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Admin View - Original Layout */}
                    
                    {/* Product Identification */}
                    <div className={`border-b pb-4 ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
                      <h4 className={`text-sm font-bold uppercase tracking-wider mb-4 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Product Identification</h4>
                      <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                        <div className="space-y-4">
                          <div>
                            <label className={`text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'text-gray-400' : 'text-slate-400'}`}>Product ID</label>
                            <p className={`font-semibold mt-1 ${isDarkTheme ? 'text-white' : 'text-slate-700'}`}>{viewMedicine.ProductID}</p>
                          </div>
                          <div>
                            <label className={`text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'text-gray-400' : 'text-slate-400'}`}>Product Code</label>
                            <p className={`font-mono font-bold mt-1 px-2 py-1 rounded text-sm ${isDarkTheme ? 'bg-gray-700 text-white' : 'bg-gray-100 text-slate-700'}`}>{viewMedicine.ProductCode || 'N/A'}</p>
                          </div>
                        </div>
                        <div>
                          <label className={`text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'text-gray-400' : 'text-slate-400'}`}>Barcode</label>
                          <div className={`mt-2 p-3 rounded-lg border flex justify-center ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                            <BarcodeDisplay 
                              productCode={viewMedicine.ProductCode}
                              particulars={viewMedicine.ProductName || viewMedicine.Particulars}
                              barcode={viewMedicine.Barcode}
                              size="medium" 
                            />
                          </div>
                          <p className={`text-xs mt-2 text-center ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                            {viewMedicine.ProductCode}{(viewMedicine.ProductName || viewMedicine.Particulars)?.replace(/\s+/g, '').substring(0, 6).toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Product Information */}
                    <div className={`border-b pb-4 ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
                      <h4 className={`text-sm font-bold uppercase tracking-wider mb-4 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Product Information</h4>
                      <div className="space-y-4">
                        <div>
                          <label className={`text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'text-gray-400' : 'text-slate-400'}`}>Particulars</label>
                          <p className={`text-lg font-bold mt-1 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{viewMedicine.ProductName || viewMedicine.Particulars || 'N/A'}</p>
                        </div>
                        <div>
                          <label className={`text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'text-gray-400' : 'text-slate-400'}`}>Description</label>
                          <p className={`mt-1 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{viewMedicine.Description || 'No description available'}</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div>
                            <label className={`text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'text-gray-400' : 'text-slate-400'}`}>Brand</label>
                            <p className={`font-semibold px-2 py-1 rounded inline-block mt-1 text-sm ${isDarkTheme ? 'bg-blue-900/30 text-blue-300 border border-blue-700' : 'bg-blue-50 text-blue-600 border border-blue-200'}`}>{viewMedicine.BrandName || 'N/A'}</p>
                          </div>
                          <div>
                            <label className={`text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'text-gray-400' : 'text-slate-400'}`}>Category</label>
                            <p className={`font-semibold px-2 py-1 rounded inline-block mt-1 text-sm ${isDarkTheme ? 'bg-green-900/30 text-green-300 border border-green-700' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>{viewMedicine.Category || viewMedicine.CategoryName || 'N/A'}</p>
                          </div>
                          <div>
                            <label className={`text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'text-gray-400' : 'text-slate-400'}`}>Date Added</label>
                            <p className={`font-semibold mt-1 text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{viewMedicine.DateAdded ? new Date(viewMedicine.DateAdded).toLocaleDateString() : 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pricing & Inventory */}
                    <div className="pb-4">
                      <h4 className={`text-sm font-bold uppercase tracking-wider mb-4 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Pricing & Inventory</h4>
                      <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                        <div>
                          <label className={`text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'text-gray-400' : 'text-slate-400'}`}>Selling Price</label>
                          <p className={`font-bold text-lg mt-1 ${isDarkTheme ? 'text-white' : 'text-slate-700'}`}>{currencySymbol}{Number(viewMedicine.UnitPrice || viewMedicine.SellingPrice || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {viewMedicine.Description && (
                      <div className="pb-4">
                        <h4 className={`text-sm font-bold uppercase tracking-wider mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Description</h4>
                        <p className={`text-sm ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>{viewMedicine.Description}</p>
                      </div>
                    )}
                  </>
                )}

                {!isPharmacyAssistant && (
                  <div className={`pt-4 mt-2 border-t flex justify-end gap-2 ${isDarkTheme ? 'border-gray-700' : 'border-gray-100'}`}>
                     <button 
                       onClick={() => {
                          setViewMedicine(null);
                          handleOpenEditModal(viewMedicine);
                       }}
                       className={`px-4 py-2 font-bold rounded-lg text-sm flex items-center gap-2 ${isDarkTheme ? 'bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 border border-blue-700' : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200'}`}
                     >
                       <Edit size={16} /> Edit
                     </button>
                     <button 
                       onClick={() => confirmDelete(viewMedicine.ProductID.toString())}
                       className={`px-4 py-2 font-bold rounded-lg text-sm flex items-center gap-2 ${isDarkTheme ? 'bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-700' : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'}`}
                     >
                       <Trash2 size={16} /> Delete
                     </button>
                  </div>
                )}
             </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Barcode Viewer Modal */}
      {isBarcodeModalOpen && selectedBarcode && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col items-center p-6 relative ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
            <button 
              onClick={() => setIsBarcodeModalOpen(false)} 
              className={`absolute top-3 right-3 p-1 rounded-full transition-colors ${isDarkTheme ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'}`}
            >
              <X size={18} />
            </button>
            <h3 className={`text-lg font-extrabold text-center mb-2 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Product Barcode</h3>
            <p className={`text-center font-bold mb-4 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>{selectedBarcode.ProductName || selectedBarcode.Particulars}</p>
            <div className={`p-4 rounded-lg border flex justify-center ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
              <BarcodeDisplay
                productCode={selectedBarcode.ProductCode}
                particulars={selectedBarcode.ProductName || selectedBarcode.Particulars}
                barcode={selectedBarcode.Barcode}
                size="large"
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Barcode Scan Input - Hidden but active for scanning */}
      <input
        ref={barcodeScanInputRef}
        type="text"
        autoComplete="off"
        style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }}
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            const value = (e.target as HTMLInputElement).value.trim();
            if (value) {
              handleBarcodeScan(value);
              (e.target as HTMLInputElement).value = '';
            }
          }
        }}
      />

      {/* Add Stock Entry Modal - Opened by Barcode Scan */}
      {isBarcodeAddStockModalOpen && scannedProductForStock && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 font-poppins">
            <div className="bg-[var(--color-primary)] px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="text-slate-900 font-extrabold text-lg">Add New Stock Entry</h3>
              <button 
                onClick={() => {
                  setIsBarcodeAddStockModalOpen(false);
                  setScannedProductForStock(null);
                }}
                className="text-slate-800 hover:bg-white/20 p-1 rounded-full transition-colors"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Product Information Section */}
              <div className="border-b border-gray-200 pb-4">
                
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-center mb-4">
                      <div className="w-20 h-20 bg-white rounded-lg border-2 border-green-500 flex items-center justify-center p-2">
                        <CheckCircle size={32} className="text-green-500" />
                      </div>
                    </div>
                    <div className="text-center mb-4">
                      <p className="text-slate-500 text-sm uppercase tracking-wider mb-1">PRODUCT NAME</p>
                      <p className="text-slate-900 font-extrabold text-lg">{scannedProductForStock.ProductName || scannedProductForStock.Particulars}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-slate-500 text-sm uppercase tracking-wider mb-1">BRAND NAME</p>
                        <p className="text-slate-900 font-bold">{scannedProductForStock.BrandName || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-sm uppercase tracking-wider mb-1">PRODUCT CODE</p>
                        <p className="text-slate-900 font-bold">{scannedProductForStock.ProductCode}</p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-slate-500 text-sm uppercase tracking-wider mb-1">SELLING PRICE</p>
                        <p className="text-slate-900 font-extrabold text-lg text-green-600">{currencySymbol}{Number(scannedProductForStock.UnitPrice || scannedProductForStock.SellingPrice || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-sm uppercase tracking-wider mb-1">CURRENT QTY</p>
                        <p className="text-slate-900 font-extrabold text-lg text-blue-600">{currentStockQuantity || '0'} units</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stock Entry Form Section */}
              <div className="pb-4">
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">2. Fill Details</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-600 font-semibold text-sm mb-2">Quantity to Add</label>
                      <input
                        type="number"
                        placeholder="e.g., 100"
                        value={barcodeStockFormData.quantity}
                        onChange={(e) => setBarcodeStockFormData(prev => ({ ...prev, quantity: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold text-sm mb-2">Expiry Date</label>
                      <input
                        type="date"
                        value={barcodeStockFormData.expirationDate}
                        onChange={(e) => setBarcodeStockFormData(prev => ({ ...prev, expirationDate: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-100 bg-[var(--color-light)] shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsBarcodeAddStockModalOpen(false);
                  setScannedProductForStock(null);
                }}
                className="px-4 py-2 text-[var(--color-text)] hover:bg-[var(--color-border)] rounded-lg transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!barcodeStockFormData.quantity || !barcodeStockFormData.expirationDate) {
                    alert('Please fill in all required fields');
                    return;
                  }

                  if (Number(barcodeStockFormData.quantity) <= 0) {
                    alert('Please enter a valid quantity.');
                    return;
                  }

                  try {
                    // Auto-generate batch number based on product category
                    const year = new Date().getFullYear();
                    
                    // Extract category code from product code (e.g., "ADD001" → "ADD")
                    let categoryCode = scannedProductForStock.CategoryCode;
                    
                    if (!categoryCode && scannedProductForStock.ProductCode) {
                      // Extract letters from product code
                      const match = scannedProductForStock.ProductCode.match(/^[A-Z]+/);
                      categoryCode = match ? match[0] : null;
                    }
                    
                    if (!categoryCode) {
                      alert('Could not determine product category');
                      return;
                    }
                    
                    // Get the highest batch number from existing stock entries for this category
                    const stockEntriesResponse = await apiClient.getStockEntries();
                    let maxBatchNumber = 0;
                    
                    if (stockEntriesResponse.success && stockEntriesResponse.data) {
                      const batchNumbers = stockEntriesResponse.data
                        .filter((entry: any) => 
                          entry.BatchNumber && 
                          entry.BatchNumber.startsWith(`BATCH-${categoryCode}-`)
                        )
                        .map((entry: any) => {
                          const match = entry.BatchNumber.match(/BATCH-\w+-(\d+)-/);
                          return match ? parseInt(match[1], 10) : 0;
                        });
                      
                      maxBatchNumber = batchNumbers.length > 0 ? Math.max(...batchNumbers) : 0;
                    }
                    
                    const nextBatchNumber = maxBatchNumber + 1;
                    const batchNumber = `BATCH-${categoryCode}-${String(nextBatchNumber).padStart(3, '0')}-${year}`;

                    const newStockData = {
                      product_id: scannedProductForStock.ProductID,
                      quantity: Number(barcodeStockFormData.quantity),
                      batchNumber: batchNumber,
                      expirationDate: barcodeStockFormData.expirationDate || null
                    };

                    const response = await apiClient.addStockEntry(newStockData);
                    console.log('Add Stock Response:', response);

                    if (response.success) {
                      const userId = user?.id ? Number(user.id) : undefined;
                      apiClient.logAction(`Added new stock entry for product: ${scannedProductForStock.Particulars || scannedProductForStock.ProductCode} - Qty: ${barcodeStockFormData.quantity}, Batch: ${batchNumber}`, userId).catch(err => console.error('Audit log failed:', err));
                      
                      // Close modal and reset form
                      setIsBarcodeAddStockModalOpen(false);
                      setScannedProductForStock(null);
                      setBarcodeStockFormData({ quantity: '', expirationDate: '' });
                      setCurrentStockQuantity('');
                      
                      // Show success modal
                      setSuccessMessage('Stock entry added successfully!');
                      setIsSuccessModalOpen(true);
                      
                      // Refresh inventory if needed
                      fetchInventory();
                    } else {
                      alert(response.message || 'Failed to add stock');
                    }
                  } catch (err: any) {
                    console.error("Failed to add new stock", err);
                    alert(`Error: ${err.message || 'An error occurred while adding the stock entry.'}`);
                  }
                }}
                className="px-6 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-hover)] text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                <Plus size={18} /> Add Entry
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm Delete Modal (Single) - Rendered via Portal */}
      {deleteId && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
          <div className={`rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200 font-poppins ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
             <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto ${isDarkTheme ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-600'}`}>
                <AlertTriangle size={24} />
             </div>
             <h3 className={`text-lg font-extrabold text-center mb-2 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Confirm Deletion</h3>
             <p className={`text-center text-sm mb-6 font-medium ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
               Are you sure you want to delete this medicine? This action cannot be undone.
             </p>
             <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteId(null)}
                  className={`flex-1 py-2.5 font-bold rounded-lg transition-colors ${isDarkTheme ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-slate-700 hover:bg-gray-200'}`}
                >
                  Cancel
                </button>
                <button 
                  onClick={executeDelete}
                  className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-md"
                >
                  Delete
                </button>
             </div>
          </div>
        </div>,
        document.body
      )}

      {/* Success Modal - Rendered via Portal */}
      {isSuccessModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
          <div className={`rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200 font-poppins ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
             <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto ${isDarkTheme ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-600'}`}>
                <CheckCircle size={24} />
             </div>
             <h3 className={`text-lg font-extrabold text-center mb-2 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Success</h3>
             <p className={`text-center text-sm mb-6 font-medium ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
               {successMessage}
             </p>
             <div className="flex">
                <button 
                  onClick={() => setIsSuccessModalOpen(false)}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors shadow-md"
                >
                  Done
                </button>
             </div>
          </div>
        </div>,
        document.body
      )}

      {/* Error Modal */}
      {isErrorModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
          <div className={`rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200 font-poppins ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
             <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto ${isDarkTheme ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-600'}`}>
                <AlertCircle size={24} />
             </div>
             <h3 className={`text-lg font-extrabold text-center mb-2 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Error</h3>
             <p className={`text-center text-sm mb-6 font-medium ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
               {errorMessage}
             </p>
             <div className="flex">
                <button 
                  onClick={() => setIsErrorModalOpen(false)}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors shadow-md"
                >
                  Dismiss
                </button>
             </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Inventory;
