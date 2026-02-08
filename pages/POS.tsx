import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePharmacy } from '../context/PharmacyContext';
import { CartItem, Discount } from '../types';
import apiClient from '../lib/apiClient';
import { formatDateTime } from '../lib/dateFormatter';
import { Search, Plus, Minus, Trash, ShoppingCart, CheckCircle, X, AlertCircle, Loader, Tag, AlertTriangle, RotateCcw, Trash2, Lock, Grid3X3, List, Printer } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import html2canvas from 'html2canvas';

const POS: React.FC = () => {
  const { currencySymbol, user, themeColor } = usePharmacy();
  const isDarkTheme = themeColor === 'black';
  const [products, setProducts] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantityInput, setQuantityInput] = useState('1');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showProductBarcode, setShowProductBarcode] = useState(false);
  const [removeItemId, setRemoveItemId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [changeGiven, setChangeGiven] = useState<number>(0);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [lastSaleData, setLastSaleData] = useState<any>(null);
  const [showPINModal, setShowPINModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ type: 'clear' | 'void' | 'void-item' | 'void-bulk', targetId?: string | null, targetIds?: string[] } | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [showBulkVoidConfirm, setShowBulkVoidConfirm] = useState(false);
  const [categories, setCategories] = useState<{CategoryCode: string; CategoryName: string}[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  // Barcode ref for JsBarcode
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const barcodeScanTimer = useRef<NodeJS.Timeout | null>(null);

  // Generate barcode value from product data
  const generateBarcodeValue = (product: any) => {
    // Priority 1: Use existing Barcode field if available
    if (product.Barcode) {
      return String(product.Barcode).trim().toUpperCase();
    }
    
    // Priority 2: Generate from ProductCode + ProductName
    if (product.ProductCode && product.ProductName) {
      const nameCode = product.ProductName.replace(/\s+/g, '').substring(0, 6).toUpperCase();
      const generated = `${product.ProductCode}${nameCode}`;
      return generated.trim().toUpperCase();
    }
    
    // Priority 3: Just use ProductCode
    if (product.ProductCode) {
      return String(product.ProductCode).trim().toUpperCase();
    }
    
    // Fallback
    return 'NOCODE';
  };




  // Fetch products and discounts from API on component mount
  useEffect(() => {
    fetchProducts();
    fetchDiscounts();
    fetchCategories();
  }, []);
  
  // Global handler for hardware barcode scanner
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events if a modal is open or an input is focused anywhere
      const activeEl = document.activeElement;
      if (
        showQuantityModal || showProductBarcode || showPINModal || showBarcodeScanner || 
        showClearConfirm || showVoidConfirm || removeItemId ||
        (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA'))
      ) {
        return;
      }

      // If 'Enter' is pressed, it signifies the end of a barcode scan
      if (e.key === 'Enter') {
        if (scannedBarcode.length > 2) { // Basic validation for barcode length
          e.preventDefault();
          
          const barcode = scannedBarcode.trim().toUpperCase();
          console.log(`Hardware scan detected: ${barcode}`);

          // Find product matching the scanned barcode (use filteredProducts to avoid expired batches)
          const product = filteredProducts.find(p => {
            const generatedBarcode = generateBarcodeValue(p);
            const storedBarcode = p.Barcode ? String(p.Barcode).trim().toUpperCase() : '';
            const productCode = p.ProductCode ? String(p.ProductCode).trim().toUpperCase() : '';
            const productID = p.ProductID?.toString() || '';
            
            return (
              generatedBarcode === barcode || 
              storedBarcode === barcode ||
              productCode === barcode ||
              productID === barcode
            );
          });

          if (product && product.CurrentStock > 0) {
            setSelectedProduct(product);
            setQuantityInput('1');
            setShowQuantityModal(true); // Show quantity modal directly
            console.log(`Product found for barcode ${barcode}:`, product);
          } else {
            setError(`Product with barcode "${barcode}" not found or is out of stock.`);
            setTimeout(() => setError(null), 4000);
            console.log(`Product not found for barcode: ${barcode}`);
          }
        }
        // Reset barcode state for the next scan
        setScannedBarcode('');
        if (barcodeScanTimer.current) clearTimeout(barcodeScanTimer.current);
        return;
      }

      // Append character to barcode string if it's a single character
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        setScannedBarcode(prev => prev + e.key);
      }
      
      // Reset scanner input if there's a pause between keystrokes (to differentiate from manual typing)
      if (barcodeScanTimer.current) {
        clearTimeout(barcodeScanTimer.current);
      }
      barcodeScanTimer.current = setTimeout(() => {
        if (scannedBarcode) {
          setScannedBarcode('');
          console.log("Barcode input timed out and was reset.");
        }
      }, 200); // A 200ms pause is usually enough to indicate end of scan or manual typing
    };

    document.addEventListener('keydown', handleKeyDown);

    // Cleanup function to remove event listener
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (barcodeScanTimer.current) {
        clearTimeout(barcodeScanTimer.current);
      }
    };
  }, [scannedBarcode, filteredProducts, showQuantityModal, showProductBarcode, showPINModal, showBarcodeScanner, showClearConfirm, showVoidConfirm, removeItemId]);


  // Focus scanner input when product barcode modal opens and render barcode
  useEffect(() => {
    if (showProductBarcode && selectedProduct && barcodeRef.current) {
      const barcodeValue = generateBarcodeValue(selectedProduct);
      try {
        JsBarcode(barcodeRef.current, barcodeValue, {
          format: 'CODE128',
          width: 2,
          height: 80,
          displayValue: true,
          fontSize: 14,
          margin: 10,
        });
      } catch (err) {
        console.error('Barcode generation error:', err);
      }

      // Focus hidden scanner input with multiple attempts
      const timer1 = setTimeout(() => {
        const scannerInput = document.getElementById('product-scanner-input') as HTMLInputElement;
        if (scannerInput) {
          scannerInput.value = '';
          scannerInput.focus();
          console.log('Scanner input focused for barcode modal');
        }
      }, 50);

      const timer2 = setTimeout(() => {
        const scannerInput = document.getElementById('product-scanner-input') as HTMLInputElement;
        if (scannerInput && document.activeElement !== scannerInput) {
          scannerInput.focus();
          console.log('Scanner input re-focused (second attempt)');
        }
      }, 200);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [showProductBarcode, selectedProduct]);

  // Auto-print receipt after sale
  useEffect(() => {
    if (lastSaleData) {
      console.log('📄 Sale completed, auto-printing receipt');
      printReceipt();
    }
  }, [lastSaleData]);

  const fetchDiscounts = async () => {
    try {
      const response = await apiClient.getDiscounts();
      console.log('Discounts API Response:', response);
      if (response.success) {
        console.log('Discounts data:', response.data);
        setDiscounts(response.data || []);
      } else {
        console.error('Failed to fetch discounts:', response.message);
      }
    } catch (err: any) {
      console.error('Discounts fetch error:', err);
    }
  };

  const fetchCategories = async () => {
    setCategoriesLoading(true);
    try {
      const response = await apiClient.getCategories();
      console.log('Categories API Response:', response);
      if (response.success) {
        const categoryList = response.data || [];
        console.log('Categories data:', categoryList);
        setCategories(categoryList);
      } else {
        console.error('Failed to fetch categories:', response.message);
      }
    } catch (err: any) {
      console.error('Categories fetch error:', err);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Use getStockEntries to get individual batch entries instead of aggregated products
      const response = await apiClient.getStockEntries();
      if (response.success) {
        console.log('✅ API Response - Total entries:', (response.data || []).length);
        console.log('📦 Raw entries:', response.data);
        
        // Map StockEntries to a format compatible with the POS display
        const formattedProducts = (response.data || []).map((entry: any) => ({
          ...entry,
          ProductID: entry.ProductID,
          ProductName: entry.Particulars || entry.ProductCode,
          ProductCode: entry.ProductCode,
          Category: entry.Category || 'Uncategorized',
          UnitPrice: entry.SellingPrice || entry.UnitPrice || 0,
          CurrentStock: entry.Quantity,
          StockEntryID: entry.StockEntryID,
          BatchNumber: entry.BatchNumber || 'N/A',
          ExpirationDate: entry.ExpirationDate,
        }));
        
        console.log('🔢 Filtered products before filtering:', formattedProducts.length);
        setProducts(formattedProducts);
      } else {
        setError(response.message || 'Failed to load products');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading products');
      console.error('Products fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter products based on search and category
  // Note: Each batch entry should appear separately based on StockEntryID
  const filteredProducts = products.filter(p => {
    const isExpired = p.ExpirationDate && new Date(p.ExpirationDate) < new Date();
    const matchesSearch = (p.ProductName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.Category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.BatchNumber && p.BatchNumber.toLowerCase().includes(searchTerm.toLowerCase())));
    const matchesCategory = (selectedCategory === '' || p.Category === selectedCategory);
    const hasStock = p.CurrentStock > 0;
    const notExpired = !isExpired;
    
    const passes = matchesSearch && matchesCategory && hasStock && notExpired;
    
    if (searchTerm && passes) {
      console.log('✅ Item passes filter:', p.ProductName, '| Qty:', p.CurrentStock, '| Batch:', p.BatchNumber, '| StockEntryID:', p.StockEntryID);
    }
    
    return passes;
  }).sort((a, b) => {
    // Sort by quantity: low stock first (ascending), then new/full stock
    return a.CurrentStock - b.CurrentStock;
  });
  
  // Log total after filter
  if (searchTerm) {
    console.log('📊 Total items matching search "' + searchTerm + '":', filteredProducts.length);
  }

  const addToCart = (product: any) => {
    setSelectedProduct(product);
    setQuantityInput('1');
    setShowProductBarcode(true);
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    
    const quantity = parseInt(quantityInput) || 1;
    if (quantity < 1 || quantity > selectedProduct.CurrentStock) {
      setError('Invalid quantity');
      return;
    }

    setCart(prev => {
      // Use StockEntryID as unique identifier to keep separate batch entries
      const stockEntryId = selectedProduct.StockEntryID || selectedProduct.ProductID;
      const existing = prev.find(item => item.StockEntryID === stockEntryId || (item.id === selectedProduct.ProductID && !item.StockEntryID));
      
      if (existing) {
        const newQuantity = existing.quantity + quantity;
        if (newQuantity > selectedProduct.CurrentStock) {
          setError(`Cannot exceed available stock (${selectedProduct.CurrentStock})`);
          return prev;
        }
        return prev.map(item => 
          (item.StockEntryID === stockEntryId || (item.id === selectedProduct.ProductID && !item.StockEntryID)) 
            ? { ...item, quantity: newQuantity } 
            : item
        );
      }
      return [...prev, {
        id: selectedProduct.ProductID,
        name: selectedProduct.ProductName,
        price: Number(selectedProduct.UnitPrice),
        stock_qty: selectedProduct.CurrentStock,
        quantity: quantity,
        category: selectedProduct.Category,
        expiry_date: '',
        StockEntryID: selectedProduct.StockEntryID,
        BatchNumber: selectedProduct.BatchNumber || 'N/A',
        ExpirationDate: selectedProduct.ExpirationDate || '',
      } as CartItem];
    });

    setShowQuantityModal(false);
    setSelectedProduct(null);
    setQuantityInput('1');
  };

  const confirmRemoveFromCart = (id: string) => {
    setRemoveItemId(id);
  };

  const executeRemoveFromCart = () => {
    if (removeItemId) {
      setCart(prev => prev.filter(item => {
        // Use StockEntryID if available, otherwise use id (ProductID)
        const itemId = item.StockEntryID ? `entry-${item.StockEntryID}` : item.id;
        return itemId !== removeItemId;
      }));
      setRemoveItemId(null);
      setSelectedItemIds([]);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      // Use StockEntryID if available, otherwise use id (ProductID)
      const itemId = item.StockEntryID ? `entry-${item.StockEntryID}` : item.id;
      if (itemId === id) {
        const newQty = item.quantity + delta;
        if (newQty > item.stock_qty) return item; // Max stock check
        if (newQty < 1) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = selectedDiscount ? (total * selectedDiscount.DiscountRate) / 100 : 0;
  const finalTotal = total - discountAmount;

  const handleBarcodeSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const barcode = barcodeInput.trim().toUpperCase();
      if (!barcode) return;

      // Find product by checking multiple barcode formats (use filteredProducts to avoid expired batches)
      const product = filteredProducts.find(p => {
        const generatedBarcode = generateBarcodeValue(p);
        const storedBarcode = p.Barcode ? String(p.Barcode).trim().toUpperCase() : '';
        const productCode = p.ProductCode ? String(p.ProductCode).trim().toUpperCase() : '';
        const productID = p.ProductID?.toString() || '';
        
        return (
          generatedBarcode === barcode || 
          storedBarcode === barcode ||
          productCode === barcode ||
          productID === barcode
        );
      });

      if (product && product.CurrentStock > 0) {
        setSelectedProduct(product);
        setQuantityInput('1');
        setShowBarcodeScanner(false);
        setShowQuantityModal(true);
        setBarcodeInput('');
      } else {
        setError(`Product not found or out of stock`);
        setBarcodeInput('');
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    // Validate cash received
    const cashAmount = parseFloat(cashReceived);
    if (!cashReceived.trim() || isNaN(cashAmount)) {
      setError('Please enter a valid cash amount');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (cashAmount < finalTotal) {
      setError('Cash received must be at least equal to the total amount');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Get Manila time directly (UTC+8)
    const now = new Date();
    const manilaFormatter = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Manila'
    });
    
    const parts = manilaFormatter.formatToParts(now);
    const partMap = new Map(parts.map(({ type, value }) => [type, value]));
    
    const year = partMap.get('year');
    const month = partMap.get('month');
    const day = partMap.get('day');
    const hours = partMap.get('hour');
    const minutes = partMap.get('minute');
    const seconds = partMap.get('second');
    
    // Send Manila time directly in 24-hour format: YYYY-MM-DD HH:MM:SS
    const manilaDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    console.log('🕐 MANILA TIME BEING SENT TO API:', manilaDateTime);

    const saleData = {
      transactionDate: manilaDateTime,
      totalAmount: total,
      discountApplied: discountAmount,
      discountType: selectedDiscount?.DiscountName || null,
      finalAmount: finalTotal,
      cashReceived: parseFloat(cashReceived) || 0,
      changeGiven: changeGiven,
      processedBy: typeof user?.UserID === 'number' ? user.UserID : 1,
      items: cart.map(item => ({
        productID: typeof item.id === 'string' ? parseInt(item.id) : item.id,
        quantity: item.quantity,
        price: item.price,
      })),
    };

    try {
      const response = await apiClient.createSale(saleData);
      console.log('🔍 Sale API Response:', response);

      if (response.success) {
        console.log('✅ Sale successful! SaleID:', response.saleID);
        setShowCheckoutModal(false);
        
        const cashierName = user?.fullName || user?.FullName || user?.username || user?.Username || 'CASHIER';
        const receiptData = {
          saleID: response.saleID || response.data?.saleID || Math.floor(Date.now() / 1000),
          ...saleData,
          cartItems: cart,
          cashierName: cashierName,
        };
        console.log('📋 Setting lastSaleData:', receiptData);
        setLastSaleData(receiptData);
        
        // Receipt will auto-print via useEffect when lastSaleData is set
        setCart([]);
        setSelectedDiscount(null);
        setCashReceived('');
        setChangeGiven(0);
        setShowSuccess(true);
        fetchProducts(); // Refresh products to show updated stock
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        console.error('❌ Sale failed:', response);
        setError(response.message || 'Failed to process sale');
      }
    } catch (err: any) {
      console.error('❌ Sale error:', err);
      setError(err.message || 'An unknown error occurred');
    }
  };

  const handleItemSelect = (id: string) => {
    setSelectedItemIds(prevIds => 
        prevIds.includes(id) 
            ? prevIds.filter(i => i !== id) 
            : [...prevIds, id]
    );
  };

  const handleVerifyPIN = async () => {
    if (!pinInput.trim()) {
      setPinError('Please enter PIN');
      return;
    }

    try {
      const response = await apiClient.verifyAdminPin(pinInput);
      if (response.success) {
        // PIN verified, execute the pending action
        if (pendingAction?.type === 'clear') {
          setCart([]);
          setSelectedDiscount(null);
          setCashReceived('');
          setChangeGiven(0);
          setShowClearConfirm(false);
        } else if (pendingAction?.type === 'void') {
          setCart([]);
          setSelectedDiscount(null);
          setCashReceived('');
          setChangeGiven(0);
          setShowVoidConfirm(false);
        } else if (pendingAction?.type === 'void-item' && pendingAction.targetId) {
          setCart(prev => prev.filter(item => item.id !== pendingAction.targetId));
          setSelectedItemIds([]); // Also reset selection
        } else if (pendingAction?.type === 'void-bulk' && pendingAction.targetIds) {
          setCart(prev => prev.filter(item => !pendingAction.targetIds.includes(item.id)));
          setSelectedItemIds([]); // Also reset selection
        }
        
        // Close PIN modal and reset
        setShowPINModal(false);
        setPinInput('');
        setPinError(null);
        setPendingAction(null);
      } else {
        setPinError(response.message || 'Invalid PIN');
      }
    } catch (err: any) {
      setPinError('PIN verification failed');
      console.error('PIN verification error:', err);
    }
  };

  const openPINModal = (action: { type: 'clear' | 'void' | 'void-item' | 'void-bulk', targetId?: string | null, targetIds?: string[] }) => {
    setPendingAction(action);
    setPinInput('');
    setPinError(null);
    setShowPINModal(true);
  };

  const executeClearCart = () => {
    setShowClearConfirm(false);
    openPINModal({ type: 'clear' });
  };

  const executeVoidTransaction = () => {
    setShowVoidConfirm(false);
    openPINModal({ type: 'void' });
  };

  const printReceipt = () => {
    if (!lastSaleData) return;

    // Format date to 12-hour format: 2026-02-06 4:58PM
    const formatReceiptDate = (dateStr: string) => {
      const [datePart, timePart] = dateStr.split(' ');
      if (!timePart) return dateStr;
      const [h, m] = timePart.split(':');
      let hour = parseInt(h);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12 || 12;
      return `${datePart} ${hour}:${m}${ampm}`;
    };

    // Text alignment helpers for monospace receipt (32 char width for 58mm)
    const W = 32;
    const dash = (n: number) => '-'.repeat(n);
    const center = (s: string) => {
      const pad = Math.max(0, Math.floor((W - s.length) / 2));
      return ' '.repeat(pad) + s;
    };
    // Auto-wrap long text into multiple centered lines
    const wrapCenter = (s: string) => {
      if (s.length <= W) return center(s);
      const words = s.split(' ');
      const result: string[] = [];
      let line = '';
      for (const word of words) {
        if (line && (line + ' ' + word).length > W) {
          result.push(center(line));
          line = word;
        } else {
          line = line ? line + ' ' + word : word;
        }
      }
      if (line) result.push(center(line));
      return result.join('\n');
    };
    const lr = (left: string, right: string) => {
      const gap = Math.max(1, W - left.length - right.length);
      return left + ' '.repeat(gap) + right;
    };
    // Truncate a left-aligned line to fit within W
    const fitLine = (s: string) => s.length > W ? s.substring(0, W) : s;

    // Get current year for invoice format
    const invoiceYear = lastSaleData.transactionDate ? lastSaleData.transactionDate.substring(0, 4) : '2026';
    const invoiceNum = `INV-${invoiceYear}-${String(lastSaleData.saleID).padStart(5, '0')}`;
    const cashierName = lastSaleData.cashierName ? lastSaleData.cashierName.toUpperCase() : 'CASHIER';
    const totalItems = lastSaleData.cartItems.reduce((sum: number, item: any) => sum + item.quantity, 0);

    // Build items lines
    const itemLines = lastSaleData.cartItems.map((item: any) => {
      const name = item.name.substring(0, W).toUpperCase();
      const qtyPrice = `${item.quantity}x ${item.price.toFixed(2)}`;
      const amount = `${currencySymbol}${(item.price * item.quantity).toFixed(2)}`;
      return `${name}\n${lr(qtyPrice, amount)}`;
    }).join('\n');

    // Build full receipt as plain text
    const lines = [
      dash(W),
      wrapCenter('SERIAL NO: 1234-1234'),
      wrapCenter('THIS SERVES AS YOUR SALES INVOICE'),
      '',
      wrapCenter('ST. MARGARETH PHARMACY'),
      wrapCenter('33 WOMEN\'S CLUB ST., MALABON, PH 1470'),
      wrapCenter('CONTACT: 0999 998 6287'),
      wrapCenter('VAT REG TIN:000-000-000-000'),
      dash(W),
      wrapCenter('SALES INVOICE'),
      fitLine(`DATE: ${formatReceiptDate(lastSaleData.transactionDate)}`),
      fitLine(`INVOICE: ${invoiceNum}`),
      fitLine(`CASHIER: ${cashierName}`),
      dash(W),
      lr('ITEM RECEIVED', 'AMOUNT'),
      dash(W),
      itemLines,
      dash(W),
      lr('TOTAL ITEMS:', String(totalItems)),
      lr('TOTAL AMT:', `${currencySymbol}${lastSaleData.finalAmount.toFixed(2)}`),
      lr('CASH RECV:', `${currencySymbol}${lastSaleData.cashReceived.toFixed(2)}`),
      lr('CHANGE AMT:', `${currencySymbol}${lastSaleData.changeGiven.toFixed(2)}`),
      ' '.repeat(W - 11) + dash(11),
      lr('VAT SALES(V):', `${currencySymbol}${(lastSaleData.finalAmount * 0.8929).toFixed(2)}`),
      lr('VAT AMT(12%):', `${currencySymbol}${(lastSaleData.finalAmount * 0.1071).toFixed(2)}`),
      lr('VAT EXEMPT(E):', `${currencySymbol}0.00`),
      lr('ZERO RATE(Z):', `${currencySymbol}0.00`),
      dash(W),
      wrapCenter('POS PROVIDER:CAPSTONE 2 PROJECT'),
      wrapCenter('ACCRED:2026-CAPSTONE-0001'),
      wrapCenter('PTU:0000-0000-0000-0000-00'),
      wrapCenter('MIN:STUDENT-PROTOTYPE-01'),
      dash(W),
      wrapCenter('THIS RECEIPT IS NOT VALID'),
      wrapCenter('FOR CLAIMING INPUT TAX'),
      wrapCenter('THANK YOU COME AGAIN!!'),
    ].map(line => line.trimEnd()).join('\n');

    const receiptContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Receipt ${invoiceNum}</title>
<style>
@page {
  size: 58mm auto;
  margin: 0 !important;
  padding: 0 !important;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html {
  width: 58mm;
  margin: 0 !important;
  padding: 0 !important;
}
body {
  width: 58mm;
  margin: 0 !important;
  padding: 0 !important;
  font-family: 'Courier New', Courier, monospace;
  font-size: 8px;
  font-weight: bold;
  line-height: 1.25;
  color: #000;
  background: #fff;
  -webkit-print-color-adjust: exact;
}
pre {
  font-family: 'Courier New', Courier, monospace;
  font-size: 8px;
  font-weight: bold;
  line-height: 1.25;
  white-space: pre;
  margin: 0 !important;
  padding: 0 !important;
  word-break: keep-all;
  overflow: hidden;
  color: #000;
  width: 58mm;
}
@media print {
  @page { margin: 0 !important; padding: 0 !important; }
  html { margin: 0 !important; padding: 0 !important; }
  body { width: 58mm; margin: 0 !important; padding: 0 !important; }
  pre { margin: 0 !important; padding: 0 !important; font-weight: bold; font-size: 8px; width: 58mm; }
}
</style>
</head>
<body>
<pre>${lines}</pre>
</body>
</html>`;

    // Create an invisible iframe to print
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    if (iframe.contentWindow) {
      iframe.contentWindow.document.write(receiptContent);
      iframe.contentWindow.document.close();
      
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 100);
      }, 500);
    }
  };

  return (
    <>
      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-300">
          <div className={`rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4 animate-in fade-in slide-in-from-bottom-5 duration-500 ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-2xl font-bold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Barcode Scanner</h2>
              <button 
                onClick={() => {
                  setShowBarcodeScanner(false);
                  setBarcodeInput('');
                }}
                className={`transition-colors ${isDarkTheme ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Barcode Display Icon */}
              <div className="flex justify-center">
                <div className={`border-2 border-dashed rounded-xl p-8 ${isDarkTheme ? 'bg-orange-900/30 border-orange-700' : 'bg-orange-50 border-orange-200'}`}>
                  <svg className={`w-16 h-16 mx-auto ${isDarkTheme ? 'text-orange-400' : 'text-orange-500'}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 4h2v16H3V4zm3 0h1v16H6V4zm2 0h1v16H8V4zm2 0h2v16h-2V4zm3 0h1v16h-1V4zm2 0h1v16h-1V4zm2 0h2v16h-2V4zm3 0h1v16h-1V4z"/>
                  </svg>
                </div>
              </div>

              {/* Input Field */}
              <div>
                <label className={`block text-sm font-bold mb-3 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Scan Barcode</label>
                <input
                  type="text"
                  placeholder="Scan or enter product barcode..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeSubmit}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 text-center text-lg font-semibold ${isDarkTheme ? 'bg-gray-700 border-orange-600 focus:border-orange-500 focus:ring-orange-500 text-white' : 'bg-orange-50 border-orange-300 focus:ring-orange-500'}`}
                  autoFocus
                />
                <p className={`text-xs mt-2 text-center ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Press ENTER to scan or submit</p>
              </div>

              {/* Info Box */}
              <div className={`border rounded-lg p-4 ${isDarkTheme ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'}`}>
                <p className={`text-sm font-medium ${isDarkTheme ? 'text-blue-300' : 'text-blue-900'}`}>💡 Tips:</p>
                <ul className={`text-xs mt-2 space-y-1 ${isDarkTheme ? 'text-blue-300' : 'text-blue-800'}`}>
                  <li>• Use any barcode scanner device</li>
                  <li>• Or enter product ID manually</li>
                  <li>• Product will be added to cart</li>
                </ul>
              </div>

              {/* Close Button */}
              <button
                onClick={() => {
                  setShowBarcodeScanner(false);
                  setBarcodeInput('');
                }}
                className={`w-full px-4 py-3 font-bold rounded-lg transition-colors ${isDarkTheme ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-300 hover:bg-gray-400 text-slate-900'}`}
              >
                Close Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Barcode Display Modal */}
      {showProductBarcode && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-300">
          <div className={`rounded-2xl shadow-xl p-8 w-full max-w-lg mx-4 animate-in fade-in slide-in-from-bottom-5 duration-500 ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-2xl font-bold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Product Details</h2>
              <button 
                onClick={() => {
                  setShowProductBarcode(false);
                  setSelectedProduct(null);
                }}
                className={`transition-colors ${isDarkTheme ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-slate-600'}`}
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Product Info */}
              <div className={`border rounded-lg p-4 ${isDarkTheme ? 'bg-blue-900/20 border-blue-700' : 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20'}`}>
                <p className={`text-sm font-medium mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Product Name</p>
                <p className={`text-lg font-bold mb-3 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{selectedProduct.ProductName}</p>
                <p className={`text-sm font-medium mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Price</p>
                <p className={`text-2xl font-extrabold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{currencySymbol}{Number(selectedProduct.UnitPrice).toFixed(2)}</p>
              </div>

              {/* Barcode Display */}
              <div className="flex justify-center w-full">
                <div className={`border-2 rounded-lg p-6 w-full flex flex-col items-center ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}>
                  {/* JsBarcode SVG */}
                  <svg ref={barcodeRef} style={{ width: '100%', maxWidth: '400px' }}></svg>
                </div>
              </div>

              {/* Hidden Scanner Input - Captures hardware barcode scanner */}
              <input
                id="product-scanner-input"
                type="text"
                style={{ 
                  position: 'fixed',
                  top: '-9999px',
                  left: '-9999px',
                  opacity: 0,
                  pointerEvents: 'none',
                  width: '1px',
                  height: '1px'
                }}
                onKeyDown={(e) => {
                  // Hardware scanner sends barcode followed by Enter key
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const scannedBarcode = (e.currentTarget as HTMLInputElement).value.trim().toUpperCase();
                    console.log('🔍 Scanned barcode:', scannedBarcode);
                    
                    if (scannedBarcode) {
                      const barcodeValue = generateBarcodeValue(selectedProduct);
                      console.log('Expected barcode value:', barcodeValue);
                      console.log('Product ID:', selectedProduct.ProductID);
                      console.log('Product Barcode field:', selectedProduct.Barcode);
                      console.log('Product Code:', selectedProduct.ProductCode);
                      
                      // Check if barcode matches - try multiple matching methods
                      const methodMatches = {
                        generatedBarcode: barcodeValue === scannedBarcode,
                        productID: selectedProduct.ProductID?.toString() === scannedBarcode,
                        storedBarcode: selectedProduct.Barcode && String(selectedProduct.Barcode).trim().toUpperCase() === scannedBarcode,
                        productCode: selectedProduct.ProductCode && String(selectedProduct.ProductCode).trim().toUpperCase() === scannedBarcode,
                      };
                      
                      console.log('Matching methods:', methodMatches);
                      const isMatch = Object.values(methodMatches).some(v => v);
                      
                      if (isMatch) {
                        // Barcode matches - proceed to quantity modal
                        console.log('✅ Barcode matched! Opening quantity modal...');
                        (e.currentTarget as HTMLInputElement).value = '';
                        setShowProductBarcode(false);
                        setShowQuantityModal(true);
                      } else {
                        // Barcode doesn't match - show detailed error
                        console.log('❌ Barcode mismatch!');
                        setError(`Barcode mismatch! Scanned: "${scannedBarcode}" | Expected: "${barcodeValue}"`);
                        (e.currentTarget as HTMLInputElement).value = '';
                        setTimeout(() => setError(null), 5000);
                      }
                    }
                  }
                }}
                tabIndex={-1}
              />



              {/* Stock Info */}
              <div className={`border rounded-lg p-4 ${isDarkTheme ? 'bg-green-900/20 border-green-700' : 'bg-[var(--color-success)]/10 border-[var(--color-success)]/20'}`}>
                <p className={`text-sm font-medium mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Available Stock</p>
                <p className={`text-xl font-bold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{selectedProduct.CurrentStock} units</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowProductBarcode(false);
                    setSelectedProduct(null);
                  }}
                  className="flex-1 px-4 py-3 bg-[var(--color-border)] hover:bg-[var(--color-border)]/80 text-[var(--color-text)] font-bold rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    setShowProductBarcode(false);
                    setShowQuantityModal(true);
                  }}
                  className={`flex-1 px-4 py-3 text-white font-bold rounded-lg transition-colors ${
                    isDarkTheme
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80'
                  }`}
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quantity Modal */}
      {showQuantityModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-300">
          <div className={`rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 animate-in fade-in slide-in-from-bottom-5 duration-500 ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-xl font-bold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Enter Quantity</h2>
              <button 
                onClick={() => {
                  setShowQuantityModal(false);
                  setSelectedProduct(null);
                  setQuantityInput('1');
                }}
                className={`transition-colors ${isDarkTheme ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-slate-600'}`}
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-bold mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Quantity</label>
                <input
                  type="number"
                  min="1"
                  max={selectedProduct.CurrentStock}
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-center text-lg font-semibold ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300 bg-white text-slate-900'}`}
                  autoFocus
                />
                <p className={`text-xs mt-2 ${isDarkTheme ? 'text-gray-400' : 'text-[var(--color-text)]/60'}`}>Available stock: {selectedProduct.CurrentStock}</p>
              </div>

              <div className={`border rounded-lg p-4 ${isDarkTheme ? 'bg-blue-900/20 border-blue-700' : 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20'}`}>
                <p className={`text-sm font-medium mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>{selectedProduct.ProductName}</p>
                <p className={`text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Price: {currencySymbol}{Number(selectedProduct.UnitPrice).toFixed(2)}</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowQuantityModal(false);
                    setSelectedProduct(null);
                    setQuantityInput('1');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-300 hover:bg-gray-400 text-slate-900 font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddToCart}
                  className={`flex-1 px-4 py-3 text-white font-bold rounded-lg transition-colors ${
                    isDarkTheme
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-[var(--color-primary)] hover:bg-[var(--color-hover)]'
                  }`}
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    
    <div className={`flex flex-col lg:flex-row gap-6 h-auto lg:h-[calc(100vh-6rem)] ${isDarkTheme ? 'bg-gray-900' : ''}`}>
      {error && (
        <div className={`absolute top-4 left-4 right-4 p-4 border rounded-lg flex items-center gap-2 z-50 ${isDarkTheme ? 'bg-red-900/30 border-red-700 text-red-400' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={fetchProducts} className="ml-auto underline font-bold">Retry</button>
        </div>
      )}

      {/* Left Column: Product Selection */}
      <div className={`flex-1 flex flex-col rounded-xl shadow-sm border overflow-hidden h-[600px] lg:h-auto ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`}>
      <div className={`p-4 border-b sticky top-0 z-10 ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-[var(--color-light)] border-gray-100'}`}>
          <div className="flex gap-3 items-center">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`} />
              <input 
                type="text"
                placeholder="Search medicines..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-10 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition-all shadow-sm ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-200'}`}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors ${isDarkTheme ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-600' : 'text-gray-400 hover:text-slate-600 hover:bg-gray-100'}`}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={`px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition-all shadow-sm text-sm font-medium whitespace-nowrap ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-slate-700'}`}
              disabled={categoriesLoading}
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.CategoryCode} value={category.CategoryName}>{category.CategoryName}</option>
              ))}
            </select>

            {/* View Toggle */}
            <div className={`flex items-center gap-2 border rounded-lg p-1 ml-auto ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-[var(--color-primary)] text-white' : isDarkTheme ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-[var(--color-text)]'}`}
                title="Grid view"
              >
                <Grid3X3 size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${viewMode === 'list' ? 'bg-[var(--color-primary)] text-white' : isDarkTheme ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-[var(--color-text)]'}`}
                title="List view"
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>
        
        <div className={`flex-1 overflow-y-auto p-4 custom-scrollbar ${isDarkTheme ? 'bg-gray-900/50' : 'bg-gray-50/30'}`}>
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader className={`animate-spin mb-4 ${isDarkTheme ? 'text-[var(--color-primary)]' : 'text-[var(--color-primary)]'}`} size={32} />
              <p className={`font-semibold ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Loading products...</p>
            </div>
          )}

          {!isLoading && (
            <>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredProducts.map(product => {
                    // Use StockEntryID if available for unique key, otherwise use ProductID
                    const uniqueKey = product.StockEntryID ? `entry-${product.StockEntryID}` : product.ProductID;
                    return (
                    <div 
                      key={uniqueKey}
                      onClick={() => {
                        setSelectedProduct(product);
                      setShowProductBarcode(true);
                    }}
                    className={`p-4 rounded-xl border shadow-sm cursor-pointer hover:shadow-md hover:ring-1 transition-all group flex flex-col ${isDarkTheme ? 'bg-gray-800 border-gray-700 hover:border-[var(--color-primary)] hover:ring-[var(--color-primary)]' : 'bg-white border-gray-100 hover:border-[var(--color-primary)] hover:ring-[var(--color-primary)]'}`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                        <div className={`h-10 w-10 min-w-[2.5rem] rounded-full flex items-center justify-center group-hover:bg-[var(--color-primary)] group-hover:text-slate-900 transition-colors font-bold border ${isDarkTheme ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-[var(--color-light)] text-[var(--color-text)] border-[var(--color-border)]'}`}>
                            <span className="text-xs">{product.ProductName.substring(0,2).toUpperCase()}</span>
                        </div>
                        <div className="overflow-hidden">
                            <h3 className={`font-bold text-sm truncate ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{product.ProductName}</h3>
                            <p className={`text-xs truncate font-medium ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>{product.Category}</p>
                            {product.BatchNumber && product.BatchNumber !== 'N/A' && (
                              <p className={`text-xs truncate font-medium ${isDarkTheme ? 'text-gray-500' : 'text-slate-400'}`}>Batch: {product.BatchNumber}</p>
                            )}
                        </div>
                    </div>
                    
                    <div className={`mt-auto flex justify-between items-center border-t pt-2 mb-3 ${isDarkTheme ? 'border-gray-700' : 'border-gray-50'}`}>
                        <span className={`font-extrabold ${isDarkTheme ? 'text-white' : 'text-slate-700'}`}>{currencySymbol}{Number(product.UnitPrice).toFixed(2)}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isDarkTheme ? 'bg-gray-700 text-gray-300' : 'bg-slate-50 text-slate-400'}`}>Qty: {product.CurrentStock}</span>
                    </div>

                    <button
                      onClick={() => addToCart(product)}
                      className={`w-full px-3 py-2 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm ${
                        isDarkTheme
                          ? 'bg-gray-700 hover:bg-gray-600'
                          : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80'
                      }`}
                    >
                      <ShoppingCart size={16} />
                      Add to Cart
                    </button>
                  </div>
                    );
                  })}
                {filteredProducts.length === 0 && !isLoading && (
                    <div className="col-span-full text-center py-10 text-gray-400 flex flex-col items-center">
                        <Search className="w-12 h-12 mb-3 opacity-20" />
                        <p className="font-medium">No medicines found</p>
                        <p className="text-xs text-gray-400 mt-1">Try adjusting your search terms</p>
                    </div>
                )}
                </div>
              ) : (
                <div className="w-full h-full flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-sm border-collapse table-fixed">
                      <colgroup>
                        <col className="w-[15%]" />
                        <col className="w-[30%]" />
                        <col className="w-[15%]" />
                        <col className="w-[15%]" />
                        <col className="w-[10%]" />
                        <col className="w-[15%]" />
                      </colgroup>
                      <thead className={`border-b-2 sticky top-0 z-10 ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <tr>
                          <th className={`px-4 py-3 text-left font-bold whitespace-nowrap ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Product Code</th>
                          <th className={`px-4 py-3 text-left font-bold ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Product Name</th>
                          <th className={`px-4 py-3 text-center font-bold ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Category</th>
                          <th className={`px-4 py-3 text-right font-bold ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Price</th>
                          <th className={`px-4 py-3 text-center font-bold ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Stock</th>
                          <th className={`px-4 py-3 text-center font-bold ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map((product, index) => {
                          // Use StockEntryID if available for unique key, otherwise use ProductID
                          const uniqueKey = product.StockEntryID ? `entry-${product.StockEntryID}` : product.ProductID;
                          return (
                          <tr 
                            key={uniqueKey}
                            className={`border-b transition-colors ${isDarkTheme ? `border-gray-700 hover:bg-gray-700/50 ${index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'}` : `border-gray-100 hover:bg-blue-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}`}
                          >
                            <td className={`px-4 py-3 font-medium truncate ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>{product.ProductCode}</td>
                            <td className={`px-4 py-3 font-medium ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                              <div className="truncate">{product.ProductName}</div>
                              {product.BatchNumber && product.BatchNumber !== 'N/A' && (
                                <div className={`text-xs truncate ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Batch: {product.BatchNumber}</div>
                              )}
                            </td>
                            <td className={`px-4 py-3 text-center ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>{product.Category}</td>
                            <td className={`px-4 py-3 text-right font-bold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{currencySymbol}{Number(product.UnitPrice).toFixed(2)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold ${
                                product.CurrentStock > 10 
                                  ? 'bg-green-100 text-green-700'
                                  : product.CurrentStock > 0
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {product.CurrentStock}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => addToCart(product)}
                                className={`inline-flex items-center justify-center gap-1 px-3 py-1.5 text-white font-bold rounded-lg transition-colors text-xs whitespace-nowrap ${
                                  isDarkTheme
                                    ? 'bg-gray-700 hover:bg-gray-600'
                                    : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80'
                                }`}
                              >
                                <ShoppingCart size={14} />
                                Add
                              </button>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredProducts.length === 0 && !isLoading && (
                      <div className="text-center py-10 text-gray-400 flex flex-col items-center">
                        <Search className="w-12 h-12 mb-3 opacity-20" />
                        <p className="font-medium">No medicines found</p>
                        <p className="text-xs text-gray-400 mt-1">Try adjusting your search terms</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Column: Cart */}
      <div className={`w-full lg:w-96 flex flex-col rounded-xl shadow-lg border overflow-hidden lg:h-auto h-[500px] ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`}>
        <div className="p-4 bg-[var(--color-primary)] flex justify-between items-center shadow-sm sticky top-0 z-10" style={{color: isDarkTheme ? 'white' : '#1e293b'}}>
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} strokeWidth={2.5} />
            <h2 className="font-extrabold text-lg">Current Order</h2>
          </div>
          <span className="bg-white/50 px-2.5 py-1 rounded-full text-xs font-bold border border-white/20">
            {cart.reduce((a, b) => a + b.quantity, 0)} Items
          </span>
        </div>

        <div className={`flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar ${isDarkTheme ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
          {cart.length === 0 ? (
            <div className={`h-full flex flex-col items-center justify-center space-y-3 ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isDarkTheme ? 'bg-gray-700' : 'bg-gray-100'}`}>
                   <ShoppingCart size={32} className="opacity-30" />
                </div>
                <p className="font-medium">Cart is empty</p>
                <p className="text-xs">Select items to start selling</p>
            </div>
          ) : (
            cart.map(item => {
              // Use StockEntryID if available for unique identification
              const itemId = item.StockEntryID ? `entry-${item.StockEntryID}` : item.id;
              return (
                <div 
                  key={itemId}
                  onClick={() => handleItemSelect(itemId)}
                  className={`p-3 rounded-lg border shadow-sm flex flex-col gap-2 relative cursor-pointer transition-all ${
                    selectedItemIds.includes(itemId)
                      ? isDarkTheme ? 'bg-blue-900/40 border-blue-500 ring-1 ring-blue-400' : 'bg-blue-50 border-blue-500 ring-1 ring-blue-400'
                      : isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className={`font-bold text-sm line-clamp-1 ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{item.name}</h4>
                      {item.BatchNumber && item.BatchNumber !== 'N/A' && (
                        <p className={`text-xs font-medium ${isDarkTheme ? 'text-gray-500' : 'text-slate-400'}`}>Batch: {item.BatchNumber}</p>
                      )}
                      <p className={`text-xs font-medium ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>{currencySymbol}{item.price.toFixed(2)} / unit</p>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); confirmRemoveFromCart(itemId); }}
                      className={`p-1 rounded transition-colors ml-2 ${isDarkTheme ? 'text-gray-400 hover:text-red-400 hover:bg-red-900/20' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
                      title="Remove item"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className={`flex justify-between items-center mt-1 pt-2 border-t ${isDarkTheme ? 'border-gray-700' : 'border-gray-50'}`}>
                    <div className={`flex items-center gap-1 rounded-lg p-0.5 ${isDarkTheme ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <button onClick={(e) => { e.stopPropagation(); updateQuantity(itemId, -1); }} className={`p-1 rounded-md transition-all shadow-sm ${isDarkTheme ? 'text-gray-400 hover:bg-gray-600' : 'text-gray-600 hover:bg-white'}`}>
                          <Minus size={14} />
                      </button>
                      <span className={`font-bold text-sm w-6 text-center ${isDarkTheme ? 'text-white' : ''}`}>{item.quantity}</span>
                      <button onClick={(e) => { e.stopPropagation(); updateQuantity(itemId, 1); }} className="p-1 hover:bg-white rounded-md text-gray-600 transition-all shadow-sm">
                          <Plus size={14} />
                      </button>
                    </div>
                    <span className={`font-bold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{currencySymbol}{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className={`p-3 border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] sticky bottom-0 z-10 space-y-2 ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`}>
          {/* Price Summary */}
          <div className={`space-y-1 border-b pb-2 ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex justify-between items-center">
              <span className={`font-semibold text-xs ${isDarkTheme ? 'text-gray-300' : 'text-slate-900'}`}>Subtotal</span>
              <span className={`font-bold text-sm ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{currencySymbol}{total.toFixed(2)}</span>
            </div>
            {selectedDiscount && (
              <div className={`flex justify-between items-center -mx-2 px-2 py-1 rounded text-xs ${isDarkTheme ? 'bg-green-900/30 text-green-300' : 'bg-green-50 text-slate-900'}`}>
                <span className="font-semibold flex items-center gap-1">
                  <Tag size={14} />
                  {selectedDiscount.DiscountName.replace(/\s*\(\d+\.?\d*%?\)\s*$/, '').trim()} ({selectedDiscount.DiscountRate}%)
                </span>
                <span className="font-bold">-{currencySymbol}{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className={`flex justify-between items-center pt-1 border-t ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
              <span className={`font-bold uppercase text-xs tracking-wider ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Total</span>
              <span className={`font-bold text-sm ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{currencySymbol}{finalTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Change Display */}
          <div className={`flex justify-between items-center pb-2 border-b ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
            <span className={`font-semibold text-xs ${isDarkTheme ? 'text-gray-300' : 'text-slate-900'}`}>Change</span>
            <span className={`font-bold text-sm ${changeGiven < 0 ? (isDarkTheme ? 'text-red-400' : 'text-red-600') : (isDarkTheme ? 'text-green-400' : 'text-green-600')}`}>
              {currencySymbol}{changeGiven.toFixed(2)}
            </span>
          </div>

          {/* Discount Selector and Cash Received on One Row */}
          <div className="grid grid-cols-2 gap-2">
            {/* Discount Selector */}
            <div>
              <label className={`text-xs font-bold uppercase tracking-wider mb-1 block ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Discount</label>
              <select
                value={selectedDiscount?.DiscountID || ''}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) {
                    setSelectedDiscount(null);
                  } else {
                    const discount = discounts.find(d => d.DiscountID === parseInt(id)) || null;
                    setSelectedDiscount(discount);
                  }
                }}
                className={`w-full px-2 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-xs ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              >
                <option value="">No Discount</option>
                {discounts && discounts.length > 0 ? (
                  discounts.map(discount => {
                    // Remove percentage from discount name if it exists
                    const cleanName = discount.DiscountName.replace(/\s*\(\d+\.?\d*%?\)\s*$/, '').trim();
                    return (
                      <option key={discount.DiscountID} value={discount.DiscountID}>
                        {cleanName} ({discount.DiscountRate}%)
                      </option>
                    );
                  })
                ) : (
                  <option disabled>No discounts available</option>
                )}
              </select>
            </div>

            {/* Cash Received Input */}
            <div>
              <label className={`text-xs font-bold uppercase tracking-wider mb-1 block ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Cash</label>
              <input
                type="number"
                value={cashReceived}
                onChange={(e) => {
                  setCashReceived(e.target.value);
                  const cash = parseFloat(e.target.value) || 0;
                  setChangeGiven(cash - finalTotal);
                }}
                placeholder="Enter amount"
                className={`w-full px-2 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-xs font-semibold ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white text-slate-900 border-gray-300'}`}
              />
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setShowBulkVoidConfirm(true)}
              disabled={selectedItemIds.length === 0}
              className={`flex-1 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition-colors ${
                selectedItemIds.length === 0
                  ? isDarkTheme ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : isDarkTheme ? 'bg-red-900/30 hover:bg-red-900/50 text-red-400' : 'bg-red-100 hover:bg-red-200 text-red-700'
              }`}
              title="Void selected items"
            >
              <RotateCcw size={14} />
              Void ({selectedItemIds.length})
            </button>
            <button 
              onClick={() => setShowClearConfirm(true)}
              disabled={cart.length === 0}
              className={`flex-1 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition-colors ${
                cart.length === 0 
                  ? isDarkTheme ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : isDarkTheme ? 'bg-orange-900/30 hover:bg-orange-900/50 text-orange-400' : 'bg-orange-100 hover:bg-orange-200 text-orange-700'
              }`}
              title="Clear all items from cart"
            >
              <Trash2 size={14} />
              Clear
            </button>
          </div>

          <button 
            onClick={handleCheckout}
            disabled={cart.length === 0 || !cashReceived.trim() || changeGiven < 0}
            className={`w-full py-2.5 px-4 rounded-lg font-bold text-sm shadow-lg transform transition-all active:scale-95 flex items-center justify-center gap-2 ${
              cart.length === 0 || !cashReceived.trim() || changeGiven < 0
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50'
                : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-xl'
            }`}
          >
            {showSuccess ? (
                <>
                    <CheckCircle className="animate-bounce" size={18} /> Recorded!
                </>
            ) : (
                `Confirm Payment`
            )}
          </button>
        </div>
      </div>
    </div>
    {/* Confirm Remove from Cart Modal - Rendered via Portal */}
      {removeItemId && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
          <div className={`rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200 ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
             <div className={`w-12 h-12 rounded-full flex items-center justify-center text-red-600 mb-4 mx-auto ${isDarkTheme ? 'bg-red-900/30' : 'bg-red-100'}`}>
                <AlertTriangle size={24} />
             </div>
             <h3 className={`text-lg font-extrabold text-center mb-2 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Remove Item?</h3>
             <p className={`text-center text-sm mb-6 font-medium ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
               Are you sure you want to remove this item from the cart?
             </p>
             <div className="flex gap-3">
                <button 
                  onClick={() => setRemoveItemId(null)}
                  className={`flex-1 py-2.5 font-bold rounded-lg transition-colors ${isDarkTheme ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-slate-700 hover:bg-gray-200'}`}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (removeItemId) {
                      openPINModal({ type: 'void-item', targetId: removeItemId });
                      setRemoveItemId(null);
                    }
                  }}
                  className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-md"
                >
                  Remove
                </button>
             </div>
          </div>
        </div>,
        document.getElementById('modal-root') as HTMLElement
      )}

      {/* Confirm Bulk Void Modal - Rendered via Portal */}
      {showBulkVoidConfirm && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
          <div className={`rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200 ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
             <div className={`w-12 h-12 rounded-full flex items-center justify-center text-red-600 mb-4 mx-auto ${isDarkTheme ? 'bg-red-900/30' : 'bg-red-100'}`}>
                <Trash2 size={24} />
             </div>
             <h3 className={`text-lg font-extrabold text-center mb-2 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Void Selected Items?</h3>
             <p className={`text-center text-sm mb-6 font-medium ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
                Are you sure you want to void the {selectedItemIds.length} selected items? This will require an admin PIN.
             </p>
             <div className="flex gap-3">
                <button 
                  onClick={() => setShowBulkVoidConfirm(false)}
                  className={`flex-1 py-2.5 font-bold rounded-lg transition-colors ${isDarkTheme ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-slate-700 hover:bg-gray-200'}`}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    openPINModal({ type: 'void-bulk', targetIds: selectedItemIds });
                    setShowBulkVoidConfirm(false);
                  }}
                  className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-md"
                >
                  Void Items
                </button>
             </div>
          </div>
        </div>,
        document.getElementById('modal-root') as HTMLElement
      )}

      {/* Confirm Clear Cart Modal - Rendered via Portal */}
      {showClearConfirm && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
          <div className={`rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200 ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
             <div className={`w-12 h-12 rounded-full flex items-center justify-center text-orange-600 mb-4 mx-auto ${isDarkTheme ? 'bg-orange-900/30' : 'bg-orange-100'}`}>
                <Trash2 size={24} />
             </div>
             <h3 className={`text-lg font-extrabold text-center mb-2 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Clear Cart?</h3>
             <p className={`text-center text-sm mb-6 font-medium ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
               Are you sure you want to clear all items from the cart? This action cannot be undone.
             </p>
             <div className="flex gap-3">
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className={`flex-1 py-2.5 font-bold rounded-lg transition-colors ${isDarkTheme ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-slate-700 hover:bg-gray-200'}`}
                >
                  Cancel
                </button>
                <button 
                  onClick={executeClearCart}
                  className="flex-1 py-2.5 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors shadow-md"
                >
                  Clear
                </button>
             </div>
          </div>
        </div>,
        document.getElementById('modal-root') as HTMLElement
      )}

      {/* Confirm Void Transaction Modal - Rendered via Portal */}
      {showVoidConfirm && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
          <div className={`rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200 ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
             <div className={`w-12 h-12 rounded-full flex items-center justify-center text-red-600 mb-4 mx-auto ${isDarkTheme ? 'bg-red-900/30' : 'bg-red-100'}`}>
                <RotateCcw size={24} />
             </div>
             <h3 className={`text-lg font-extrabold text-center mb-2 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Void Transaction?</h3>
             <p className={`text-center text-sm mb-6 font-medium ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
               Are you sure you want to void this entire transaction? This will clear all items and discount settings.
             </p>
             <div className="flex gap-3">
                <button 
                  onClick={() => setShowVoidConfirm(false)}
                  className={`flex-1 py-2.5 font-bold rounded-lg transition-colors ${isDarkTheme ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-slate-700 hover:bg-gray-200'}`}
                >
                  Cancel
                </button>
                <button 
                  onClick={executeVoidTransaction}
                  className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-md"
                >
                  Void
                </button>
             </div>
          </div>
        </div>,
        document.getElementById('modal-root') as HTMLElement
      )}

      {/* Admin PIN Verification Modal */}
      {showPINModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
          <div className={`rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200 ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
             <div className={`w-12 h-12 rounded-full flex items-center justify-center text-blue-600 mb-4 mx-auto ${isDarkTheme ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
                <Lock size={24} />
             </div>
             <h3 className={`text-lg font-extrabold text-center mb-2 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Admin PIN Required</h3>
             <p className={`text-center text-sm mb-6 font-medium ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
               Enter your admin PIN to {pendingAction?.type === 'clear' ? 'clear' : 'void'} this order
             </p>
             
             <div className="mb-4">
               <input
                 type="password"
                 placeholder="Enter PIN"
                 value={pinInput}
                 onChange={(e) => {
                   setPinInput(e.target.value);
                   setPinError(null);
                 }}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter') {
                     handleVerifyPIN();
                   }
                 }}
                 className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg font-bold tracking-widest ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300'}`}
                 maxLength={6}
                 autoFocus
               />
               {pinError && (
                 <p className={`text-xs mt-2 font-semibold ${isDarkTheme ? 'text-red-400' : 'text-red-600'}`}>{pinError}</p>
               )}
             </div>

             <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setShowPINModal(false);
                    setPinInput('');
                    setPinError(null);
                    setPendingAction(null);
                  }}
                  className={`flex-1 py-2.5 font-bold rounded-lg transition-colors ${isDarkTheme ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-slate-700 hover:bg-gray-200'}`}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleVerifyPIN}
                  className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-md"
                >
                  Verify
                </button>
             </div>
          </div>
        </div>,
        document.getElementById('modal-root') as HTMLElement
      )}

      {showCheckoutModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
          <div className={`rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200 ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className={`text-lg font-extrabold text-center mb-2 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Complete Sale</h3>
            <p className={`text-center text-sm mb-6 font-medium ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>
              Enter cash received to finalize the transaction.
            </p>
            <div className="mb-4">
              <label className={`block text-sm font-bold mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Total Amount</label>
              <input
                type="text"
                readOnly
                value={`${currencySymbol}${finalTotal.toFixed(2)}`}
                className={`w-full px-4 py-3 border rounded-lg text-center text-lg font-semibold ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-100 border-gray-300 text-slate-900'}`}
              />
            </div>
            <div className="mb-4">
              <label className={`block text-sm font-bold mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Cash Received</label>
              <input
                type="number"
                value={cashReceived}
                onChange={(e) => {
                  setCashReceived(e.target.value);
                  const cash = parseFloat(e.target.value) || 0;
                  setChangeGiven(cash - finalTotal);
                }}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-center text-lg font-semibold ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-slate-900'}`}
                autoFocus
              />
            </div>
            <div className="mb-6">
              <label className={`block text-sm font-bold mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>Change</label>
              <input
                type="text"
                readOnly
                value={`${currencySymbol}${changeGiven.toFixed(2)}`}
                className={`w-full px-4 py-3 border rounded-lg text-center text-lg font-semibold ${changeGiven < 0 ? isDarkTheme ? 'bg-red-900/30 border-red-700 text-red-400' : 'bg-red-100 text-red-700 border-red-200' : isDarkTheme ? 'bg-green-900/30 border-green-700 text-green-400' : 'bg-green-100 text-green-700 border-green-200'}`}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCheckoutModal(false)}
                className={`flex-1 py-2.5 font-bold rounded-lg transition-colors ${isDarkTheme ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-300 text-slate-900 hover:bg-gray-400'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleCheckout}
                disabled={!cashReceived.trim() || changeGiven < 0}
                className={`flex-1 py-2.5 bg-[var(--color-primary)] text-white font-bold rounded-lg hover:bg-[var(--color-hover)] transition-colors shadow-md ${!cashReceived.trim() || changeGiven < 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Confirm Sale
              </button>
            </div>
          </div>
        </div>,
        document.getElementById('modal-root') as HTMLElement
      )}



    </>
  );
};

export default POS;
