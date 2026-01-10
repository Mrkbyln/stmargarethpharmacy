import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePharmacy } from '../context/PharmacyContext';
import { CartItem, Discount } from '../types';
import apiClient from '../lib/apiClient';
import { formatDateTime } from '../lib/dateFormatter';
import { Search, Plus, Minus, Trash, ShoppingCart, CheckCircle, X, AlertCircle, Loader, Tag, AlertTriangle, RotateCcw, Trash2, Lock, Grid3X3, List } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import html2canvas from 'html2canvas';

const POS: React.FC = () => {
  const { currencySymbol, user } = usePharmacy();
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

          // Find product matching the scanned barcode
          const product = products.find(p => {
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
  }, [scannedBarcode, products, showQuantityModal, showProductBarcode, showPINModal, showBarcodeScanner, showClearConfirm, showVoidConfirm, removeItemId]);


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

  // Auto-print receipt immediately after sale
  useEffect(() => {
    if (lastSaleData) {
      const printReceipt = async () => {
        try {
          // Create a new window for printing
          const printWindow = window.open('', '', 'width=300,height=600');
          if (printWindow) {
              // Write the receipt HTML to the print window
                printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="UTF-8">
                  <title>Receipt #INV-${String(lastSaleData.saleID).padStart(6, '0')}</title>
                  <style>
                  @page {
                    width: 58mm;
                    height: auto;
                    margin: 0;
                    padding: 0;
                  }
                  
                  body {
                    width: 58mm;
                    margin: 0;
                    padding: 3mm 2mm;
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 9px;
                    line-height: 1.4;
                    background-color: white;
                    color: #000;
                    overflow-x: hidden;
                  }
                  
                    * {
                      box-sizing: border-box;
                    }
                    
                  
                  
                    h1 {
                      margin: 2px 0 0 0;
                      font-size: 11px;
                      font-weight: bold;
                      margin-bottom:5px;
                      letter-spacing: 0.5px;
                      line-height: 1.1;
                    }
                    
                  
                    
                    .info {
                      margin-bottom: 6px;
                      padding-bottom: 6px;
                      border-bottom: 1px dashed #333;
                      font-size: 11px;
                      line-height: 1.3;
                    }
                    
                    .info-row {
                      display: flex;
                      justify-content: space-between;
                      margin-bottom: 2px;
                    }
                    
                    .info-row:last-child {
                      margin-bottom: 0;
                    }
                    
                    .label {
                      font-weight: bold;
                      color: #000;
                      white-space: nowrap;
                      margin-right: 8px;
                    }
                    
                    .value {
                      text-align: left;
                      word-break: break-word;
                      flex: 1;
                      font-weight: bold;
                      color: #000;
                    }
                    
                    .items {
                      margin-bottom: 6px;
                      padding-bottom: 6px;
                      border-bottom: 1px dashed #333;
                    }
                    
                    .items-header {
                      font-size: 8px;
                      font-weight: bold;
                      color: #000;
                     
                      padding-bottom: 2px;
                    
                      display: grid;
                      grid-template-columns: 1fr 35px 45px;
                     
                     
                    }
                    
                    .items-header span:first-child {
                      text-align: left;
                    }
                    
                    .item {
                      font-size: 10px;
                      margin-bottom: 4px;
                      display: grid;
                      grid-template-columns: 1fr 35px 45px;
                      gap: 4px;
                      align-items: flex-start;
                    }
                    
                    .item-name {
                      text-align: left;
                      word-break: break-word;
                      font-weight: bold;
                      color: #000;
                      grid-column: 1 / 4;
                      margin-bottom: 2px;
                    }
                    
                    .item-detail {
                      display: contents;
                    }
                    
                    .item-price {
                      text-align: left;
                      font-size: 9px;
                      font-weight: bold;
                      color: #000;
                    }
                    
                    .item-qty {
                      text-align: center;
                      font-size: 9px;
                      font-weight: bold;
                      color: #000;
                    }
                    
                    .item-total {
                      text-align: right;
                      font-size: 9px;
                      font-weight: bold;
                      color: #000;
                    }
                    
                    .totals {
                      margin-bottom: 6px;
                      padding-bottom: 6px;
                      border-bottom: 1px dashed #333;
                    }
                    
                    .total-row {
                      display: flex;
                      justify-content: space-between;
                      font-size: 11px;
                      margin-bottom: 3px;
                      line-height: 1.3;
                      align-items: center;
                    }
                    
                    .total-row span:first-child {
                      font-weight: bold;
                      color: #000;
                      white-space: nowrap;
                      margin-right: 8px;
                    }
                    
                    .total-row span:last-child {
                      text-align: left;
                      flex: 1;
                      font-weight: bold;
                      color: #000;
                    }
                    
                    .total-row.grand-total {
                      font-size: 13px;
                      font-weight: bold;
                      color: #000;
                      padding-top: 3px;
                      border-top: 1px solid #333;
                      margin-bottom: 0;
                    }
                    
                    .payment {
                      margin-bottom: 6px;
                      padding-bottom: 6px;
                      border-bottom: 1px dashed #333;
                      font-size: 11px;
                    }
                    
                    .payment-row {
                      display: flex;
                      justify-content: space-between;
                      margin-bottom: 2px;
                      line-height: 1.3;
                      align-items: center;
                    }
                    
                    .payment-row span:first-child {
                      font-weight: bold;
                      color: #000;
                      white-space: nowrap;
                      margin-right: 8px;
                    }
                    
                    .payment-row span:last-child {
                      text-align: left;
                      flex: 1;
                      font-weight: bold;
                      color: #000;
                    }
                    
                    .payment-row.change-row {
                      font-weight: bold;
                      font-size: 12px;
                    }
                    
                    .footer {
                      text-align: center;
                      font-size: 11px;
                      font-weight: bold;
                      color: #000;
                      margin-top: 4px;
                      padding-top: 4px;
                      margin-left: 0;
                      margin-right: 0;
                    }
                    
                    .footer p {
                      margin: 2px 0;
                      line-height: 1.3;
                      font-weight: bold;
                      color: #000;
                       margin-right:40px;
                    }
                    
                    .footer p.thanks {
                      font-size: 12px;
                      font-weight: bold;
                      color: #000;
                      margin-right:40px;
                    }
                    
                    @media print {
                      body {
                        margin: 0;
                        padding: 3mm 2mm;
                        width: 58mm;
                      }
                      .no-print {
                        display: none;
                      }
                    }
                  </style>
                </head>
                <body>
                  <div class="header">
                    <h1>ST. MARGARETH PHARMACY</h1>
                  
                  </div>
                  <div class="info">
                  <div style="margin-top: -15px; padding-top: 6px; font-size: 8px; line-height: 1; text-align: center;">
                      <p style="margin-right:55px;font-weight: bold; color: #000;">📍 33 Women's Club St. Malabon</p>
                      <p style="margin-right:50px;margin-top:-6px;font-weight: bold; color: #000;">Philippines</p>
                      <p style="margin-right:50px; margin-top:-6px;font-weight: bold; color: #000;">📞 0965 246 0554</p>
                    </div>
                    
                    <div class="info-row">
                      <span class="label">Invoice:</span>
                      <span class="value">#INV-${String(lastSaleData.saleID).padStart(6, '0')}</span>
                    </div>
                    <div class="info-row">
                      <span class="label">Date:</span>
                      <span class="value">${formatDateTime(lastSaleData.transactionDate)}</span>
                    </div>
                  </div>
                  
                  <div class="items">
                    <div class="items-header">
                      <span>Item</span>
                      <span>Qty</span>
                      <span>Amount</span>
                    </div>
                    ${lastSaleData.cartItems.map((item: any) => `
                      <div class="item">
                        <div class="item-name">${item.name.substring(0, 30)}</div>
                        <div class="item-detail">
                          <div class="item-price">${currencySymbol}${item.price.toFixed(2)}</div>
                          <div class="item-qty">x${item.quantity}</div>
                          <div class="item-total">${currencySymbol}${(item.price * item.quantity).toFixed(2)}</div>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                  
                  <div class="totals">
                    <div class="total-row">
                      <span>Subtotal:</span>
                      <span>${currencySymbol}${lastSaleData.totalAmount.toFixed(2)}</span>
                    </div>
                    ${lastSaleData.discountApplied > 0 ? `
                      <div class="total-row">
                        <span>Discount (${lastSaleData.discountType}):</span>
                        <span>-${currencySymbol}${lastSaleData.discountApplied.toFixed(2)}</span>
                      </div>
                    ` : ''}
                    <div class="total-row grand-total">
                      <span>TOTAL:</span>
                      <span>${currencySymbol}${lastSaleData.finalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div class="payment">
                    <div class="payment-row">
                      <span>Cash:</span>
                      <span>${currencySymbol}${lastSaleData.cashReceived.toFixed(2)}</span>
                    </div>
                    <div class="payment-row change-row">
                      <span>Change:</span>
                      <span>${currencySymbol}${lastSaleData.changeGiven.toFixed(2)}</span>
                    </div>
                  </div>
                  <div class="info-row" style="margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid #333;">
                      <span style=" margin-left:12px;font-weight: bold; color: #000; font-size: 10px; width: 100%;">ACKNOWLEDGEMENT RECEIPT</span>
                    </div>
                  <div class="footer">
                    <p class="thanks">Thank You!</p>
                    <p>Keep receipt for</p>
                    <p>warranty & returns</p>
                    
                  </div>
                </body>
                </html>
              `);
              
              printWindow.document.close();
              
              // Wait for images to load before printing
              printWindow.onload = () => {
                setTimeout(() => {
                  printWindow.focus();
                  printWindow.print();
                  
                  // Close window after print dialog closes
                  setTimeout(() => {
                    printWindow.close();
                    setLastSaleData(null);
                  }, 500);
                }, 500);
              };
              
              // Fallback if onload doesn't fire
              setTimeout(() => {
                if (printWindow && !printWindow.closed) {
                  printWindow.focus();
                  printWindow.print();
                  setTimeout(() => {
                    printWindow.close();
                    setLastSaleData(null);
                  }, 500);
                }
              }, 1500);
            }
        } catch (error) {
          console.error('Print error:', error);
          setLastSaleData(null);
        }
      };

      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        printReceipt();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [lastSaleData, currencySymbol]);

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
      // Use inventory endpoint instead of products to get current stock
      const response = await apiClient.getInventory();
      if (response.success) {
        setProducts(response.data || []);
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
  const filteredProducts = products.filter(p => 
    (p.ProductName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.Category.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (selectedCategory === '' || p.Category === selectedCategory) &&
    p.CurrentStock > 0
  );

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
      const existing = prev.find(item => item.id === selectedProduct.ProductID);
      if (existing) {
        const newQuantity = existing.quantity + quantity;
        if (newQuantity > selectedProduct.CurrentStock) {
          setError(`Cannot exceed available stock (${selectedProduct.CurrentStock})`);
          return prev;
        }
        return prev.map(item => 
          item.id === selectedProduct.ProductID ? { ...item, quantity: newQuantity } : item
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
      setCart(prev => prev.filter(item => item.id !== removeItemId));
      setRemoveItemId(null);
      setSelectedItemIds([]);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
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

      // Find product by checking multiple barcode formats
      const product = products.find(p => {
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

      if (response.success) {
        setShowCheckoutModal(false);
        setLastSaleData({
          saleID: response.saleID,
          ...saleData,
          cartItems: cart,
        });
        // Receipt will auto-print via useEffect when lastSaleData is set
        setCart([]);
        setSelectedDiscount(null);
        setCashReceived('');
        setChangeGiven(0);
        setShowSuccess(true);
        fetchProducts(); // Refresh products to show updated stock
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        setError(response.message || 'Failed to process sale');
      }
    } catch (err: any) {
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

  return (
    <>
      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4 animate-in fade-in slide-in-from-bottom-5 duration-500">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Barcode Scanner</h2>
              <button 
                onClick={() => {
                  setShowBarcodeScanner(false);
                  setBarcodeInput('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Barcode Display Icon */}
              <div className="flex justify-center">
                <div className="bg-orange-50 border-2 border-dashed border-orange-200 rounded-xl p-8">
                  <svg className="w-16 h-16 text-orange-500 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 4h2v16H3V4zm3 0h1v16H6V4zm2 0h1v16H8V4zm2 0h2v16h-2V4zm3 0h1v16h-1V4zm2 0h1v16h-1V4zm2 0h2v16h-2V4zm3 0h1v16h-1V4z"/>
                  </svg>
                </div>
              </div>

              {/* Input Field */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3">Scan Barcode</label>
                <input
                  type="text"
                  placeholder="Scan or enter product barcode..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeSubmit}
                  className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-center text-lg font-semibold bg-orange-50"
                  autoFocus
                />
                <p className="text-xs text-slate-500 mt-2 text-center">Press ENTER to scan or submit</p>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 font-medium">💡 Tips:</p>
                <ul className="text-xs text-blue-800 mt-2 space-y-1">
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
                className="w-full px-4 py-3 bg-gray-300 hover:bg-gray-400 text-slate-900 font-bold rounded-lg transition-colors"
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
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg mx-4 animate-in fade-in slide-in-from-bottom-5 duration-500">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Product Details</h2>
              <button 
                onClick={() => {
                  setShowProductBarcode(false);
                  setSelectedProduct(null);
                }}
                className="text-gray-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Product Info */}
              <div className="bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-lg p-4">
                <p className="text-sm text-slate-600 font-medium mb-1">Product Name</p>
                <p className="text-lg font-bold text-slate-900 mb-3">{selectedProduct.ProductName}</p>
                <p className="text-sm text-slate-600 font-medium mb-1">Price</p>
                <p className="text-2xl font-extrabold text-slate-900">{currencySymbol}{Number(selectedProduct.UnitPrice).toFixed(2)}</p>
              </div>

              {/* Barcode Display */}
              <div className="flex justify-center w-full">
                <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-6 w-full flex flex-col items-center">
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
              <div className="bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 rounded-lg p-4">
                <p className="text-sm text-slate-600 font-medium mb-1">Available Stock</p>
                <p className="text-xl font-bold text-slate-900">{selectedProduct.CurrentStock} units</p>
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
                  className="flex-1 px-4 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80 text-white font-bold rounded-lg transition-colors"
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
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 animate-in fade-in slide-in-from-bottom-5 duration-500">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">Enter Quantity</h2>
              <button 
                onClick={() => {
                  setShowQuantityModal(false);
                  setSelectedProduct(null);
                  setQuantityInput('1');
                }}
                className="text-gray-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Quantity</label>
                <input
                  type="number"
                  min="1"
                  max={selectedProduct.CurrentStock}
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-center text-lg font-semibold bg-white text-slate-900"
                  autoFocus
                />
                <p className="text-xs text-[var(--color-text)]/60 mt-2">Available stock: {selectedProduct.CurrentStock}</p>
              </div>

              <div className="bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-lg p-4">
                <p className="text-sm text-slate-600 font-medium mb-1">{selectedProduct.ProductName}</p>
                <p className="text-sm text-slate-700">Price: {currencySymbol}{Number(selectedProduct.UnitPrice).toFixed(2)}</p>
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
                  className="flex-1 px-4 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-hover)] text-white font-bold rounded-lg transition-colors"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    
    <div className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[calc(100vh-6rem)]">
      {error && (
        <div className="absolute top-4 left-4 right-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2 z-50">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={fetchProducts} className="ml-auto underline font-bold">Retry</button>
        </div>
      )}

      {/* Left Column: Product Selection */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden h-[600px] lg:h-auto">
      <div className="p-4 border-b border-gray-100 bg-[var(--color-light)] sticky top-0 z-10">
          <div className="flex gap-3 items-center">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text"
                placeholder="Search medicines..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition-all shadow-sm bg-white"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition-all shadow-sm bg-white text-sm font-medium text-slate-700 whitespace-nowrap"
              disabled={categoriesLoading}
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.CategoryCode} value={category.CategoryName}>{category.CategoryName}</option>
              ))}
            </select>

            {/* View Toggle */}
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg p-1 bg-white ml-auto">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-[var(--color-primary)] text-white' : 'text-gray-400 hover:text-[var(--color-text)]'}`}
                title="Grid view"
              >
                <Grid3X3 size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${viewMode === 'list' ? 'bg-[var(--color-primary)] text-white' : 'text-gray-400 hover:text-[var(--color-text)]'}`}
                title="List view"
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30 custom-scrollbar">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader className="animate-spin text-[var(--color-primary)] mb-4" size={32} />
              <p className="text-slate-500 font-semibold">Loading products...</p>
            </div>
          )}

          {!isLoading && (
            <>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredProducts.map(product => (
                  <div 
                    key={product.ProductID}
                    className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm cursor-pointer hover:shadow-md hover:border-[var(--color-primary)] hover:ring-1 hover:ring-[var(--color-primary)] transition-all group flex flex-col"
                  >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 min-w-[2.5rem] bg-[var(--color-light)] text-[var(--color-text)] rounded-full flex items-center justify-center group-hover:bg-[var(--color-primary)] group-hover:text-slate-900 transition-colors font-bold border border-[var(--color-border)]">
                            <span className="text-xs">{product.ProductName.substring(0,2).toUpperCase()}</span>
                        </div>
                        <div className="overflow-hidden">
                            <h3 className="font-bold text-slate-800 text-sm truncate">{product.ProductName}</h3>
                            <p className="text-xs text-slate-500 truncate font-medium">{product.Category}</p>
                        </div>
                    </div>
                    
                    <div className="mt-auto flex justify-between items-center border-t border-gray-50 pt-2 mb-3">
                        <span className="font-extrabold text-slate-700">{currencySymbol}{Number(product.UnitPrice).toFixed(2)}</span>
                        <span className="text-xs text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-full">Qty: {product.CurrentStock}</span>
                    </div>

                    <button
                      onClick={() => addToCart(product)}
                      className="w-full px-3 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <ShoppingCart size={16} />
                      Add to Cart
                    </button>
                  </div>
                ))}
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
                      <thead className="bg-white border-b-2 border-gray-200 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 text-left font-bold text-slate-700 whitespace-nowrap">Product Code</th>
                          <th className="px-4 py-3 text-left font-bold text-slate-700">Product Name</th>
                          <th className="px-4 py-3 text-center font-bold text-slate-700">Category</th>
                          <th className="px-4 py-3 text-right font-bold text-slate-700">Price</th>
                          <th className="px-4 py-3 text-center font-bold text-slate-700">Stock</th>
                          <th className="px-4 py-3 text-center font-bold text-slate-700">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map((product, index) => (
                          <tr 
                            key={product.ProductID}
                            className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                              index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                            }`}
                          >
                            <td className="px-4 py-3 font-medium text-slate-600 truncate">{product.ProductCode}</td>
                            <td className="px-4 py-3 font-medium text-slate-800 truncate">{product.ProductName}</td>
                            <td className="px-4 py-3 text-slate-600 text-center">{product.Category}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">{currencySymbol}{Number(product.UnitPrice).toFixed(2)}</td>
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
                                className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80 text-white font-bold rounded-lg transition-colors text-xs whitespace-nowrap"
                              >
                                <ShoppingCart size={14} />
                                Add
                              </button>
                            </td>
                          </tr>
                        ))}
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
      <div className="w-full lg:w-96 flex flex-col bg-white rounded-xl shadow-lg border border-[var(--color-border)] overflow-hidden lg:h-auto h-[500px]">
        <div className="p-4 bg-[var(--color-primary)] text-slate-900 flex justify-between items-center shadow-sm sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} strokeWidth={2.5} />
            <h2 className="font-extrabold text-lg">Current Order</h2>
          </div>
          <span className="bg-white/50 px-2.5 py-1 rounded-full text-xs font-bold border border-white/20">
            {cart.reduce((a, b) => a + b.quantity, 0)} Items
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                   <ShoppingCart size={32} className="opacity-30" />
                </div>
                <p className="font-medium">Cart is empty</p>
                <p className="text-xs text-gray-400">Select items to start selling</p>
            </div>
          ) : (
            cart.map(item => (
              <div 
                key={item.id}
                onClick={() => handleItemSelect(item.id)}
                className={`p-3 rounded-lg border shadow-sm flex flex-col gap-2 relative cursor-pointer transition-all ${
                  selectedItemIds.includes(item.id)
                    ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-400'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm line-clamp-1">{item.name}</h4>
                    <p className="text-xs text-slate-500 font-medium">{currencySymbol}{item.price.toFixed(2)} / unit</p>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-1 pt-2 border-t border-gray-50">
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                    <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, -1); }} className="p-1 hover:bg-white rounded-md text-gray-600 transition-all shadow-sm">
                        <Minus size={14} />
                    </button>
                    <span className="font-bold text-sm w-6 text-center">{item.quantity}</span>
                    <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, 1); }} className="p-1 hover:bg-white rounded-md text-gray-600 transition-all shadow-sm">
                        <Plus size={14} />
                    </button>
                  </div>
                  <span className="font-bold text-slate-900">{currencySymbol}{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 bg-white border-t border-[var(--color-border)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] sticky bottom-0 z-10 space-y-2">
          {/* Price Summary */}
          <div className="space-y-1 border-b border-gray-200 pb-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-900 font-semibold text-xs">Subtotal</span>
              <span className="font-bold text-slate-900 text-sm">{currencySymbol}{total.toFixed(2)}</span>
            </div>
            {selectedDiscount && (
              <div className="flex justify-between items-center text-slate-900 bg-green-50 -mx-2 px-2 py-1 rounded text-xs">
                <span className="font-semibold flex items-center gap-1">
                  <Tag size={14} />
                  {selectedDiscount.DiscountName.replace(/\s*\(\d+\.?\d*%?\)\s*$/, '').trim()} ({selectedDiscount.DiscountRate}%)
                </span>
                <span className="font-bold">-{currencySymbol}{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1 border-t border-gray-200">
              <span className="text-slate-500 font-bold uppercase text-xs tracking-wider">Total</span>
              <span className="font-bold text-slate-900 text-sm">{currencySymbol}{finalTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Change Display */}
          <div className="flex justify-between items-center pb-2 border-b border-gray-200">
            <span className="text-slate-900 font-semibold text-xs">Change</span>
            <span className={`font-bold text-sm ${changeGiven < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {currencySymbol}{changeGiven.toFixed(2)}
            </span>
          </div>

          {/* Discount Selector and Cash Received on One Row */}
          <div className="grid grid-cols-2 gap-2">
            {/* Discount Selector */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Discount</label>
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
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-xs bg-white"
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
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Cash</label>
              <input
                type="number"
                value={cashReceived}
                onChange={(e) => {
                  setCashReceived(e.target.value);
                  const cash = parseFloat(e.target.value) || 0;
                  setChangeGiven(cash - finalTotal);
                }}
                placeholder="Enter amount"
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-xs bg-white text-slate-900 font-semibold"
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
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-red-100 hover:bg-red-200 text-red-700'
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
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-orange-100 hover:bg-orange-200 text-orange-700'
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
            className={`w-full py-2 rounded-xl font-bold text-sm shadow-lg transform transition-all active:scale-95 flex items-center justify-center gap-2 ${
              cart.length === 0 || !cashReceived.trim() || changeGiven < 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-slate-900 hover:bg-slate-800 text-[var(--color-primary)] hover:shadow-xl'
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
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
             <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 mx-auto">
                <AlertTriangle size={24} />
             </div>
             <h3 className="text-lg font-extrabold text-slate-900 text-center mb-2">Remove Item?</h3>
             <p className="text-slate-500 text-center text-sm mb-6 font-medium">
               Are you sure you want to remove this item from the cart?
             </p>
             <div className="flex gap-3">
                <button 
                  onClick={() => setRemoveItemId(null)}
                  className="flex-1 py-2.5 bg-gray-100 text-slate-700 font-bold rounded-lg hover:bg-gray-200 transition-colors"
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
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
             <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 mx-auto">
                <Trash2 size={24} />
             </div>
             <h3 className="text-lg font-extrabold text-slate-900 text-center mb-2">Void Selected Items?</h3>
             <p className="text-slate-500 text-center text-sm mb-6 font-medium">
                Are you sure you want to void the {selectedItemIds.length} selected items? This will require an admin PIN.
             </p>
             <div className="flex gap-3">
                <button 
                  onClick={() => setShowBulkVoidConfirm(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-slate-700 font-bold rounded-lg hover:bg-gray-200 transition-colors"
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
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
             <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 mb-4 mx-auto">
                <Trash2 size={24} />
             </div>
             <h3 className="text-lg font-extrabold text-slate-900 text-center mb-2">Clear Cart?</h3>
             <p className="text-slate-500 text-center text-sm mb-6 font-medium">
               Are you sure you want to clear all items from the cart? This action cannot be undone.
             </p>
             <div className="flex gap-3">
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-slate-700 font-bold rounded-lg hover:bg-gray-200 transition-colors"
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
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
             <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 mx-auto">
                <RotateCcw size={24} />
             </div>
             <h3 className="text-lg font-extrabold text-slate-900 text-center mb-2">Void Transaction?</h3>
             <p className="text-slate-500 text-center text-sm mb-6 font-medium">
               Are you sure you want to void this entire transaction? This will clear all items and discount settings.
             </p>
             <div className="flex gap-3">
                <button 
                  onClick={() => setShowVoidConfirm(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-slate-700 font-bold rounded-lg hover:bg-gray-200 transition-colors"
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
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
             <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4 mx-auto">
                <Lock size={24} />
             </div>
             <h3 className="text-lg font-extrabold text-slate-900 text-center mb-2">Admin PIN Required</h3>
             <p className="text-slate-500 text-center text-sm mb-6 font-medium">
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
                 className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg font-bold tracking-widest"
                 maxLength={6}
                 autoFocus
               />
               {pinError && (
                 <p className="text-xs text-red-600 mt-2 font-semibold">{pinError}</p>
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
                  className="flex-1 py-2.5 bg-gray-100 text-slate-700 font-bold rounded-lg hover:bg-gray-200 transition-colors"
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
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-extrabold text-slate-900 text-center mb-2">Complete Sale</h3>
            <p className="text-slate-600 text-center text-sm mb-6 font-medium">
              Enter cash received to finalize the transaction.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-bold text-slate-700 mb-2">Total Amount</label>
              <input
                type="text"
                readOnly
                value={`${currencySymbol}${finalTotal.toFixed(2)}`}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-center text-lg font-semibold text-slate-900"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold text-slate-700 mb-2">Cash Received</label>
              <input
                type="number"
                value={cashReceived}
                onChange={(e) => {
                  setCashReceived(e.target.value);
                  const cash = parseFloat(e.target.value) || 0;
                  setChangeGiven(cash - finalTotal);
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-center text-lg font-semibold bg-white text-slate-900"
                autoFocus
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">Change</label>
              <input
                type="text"
                readOnly
                value={`${currencySymbol}${changeGiven.toFixed(2)}`}
                className={`w-full px-4 py-3 border rounded-lg text-center text-lg font-semibold ${changeGiven < 0 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-green-100 text-green-700 border-green-200'}`}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="flex-1 py-2.5 bg-gray-300 text-slate-900 font-bold rounded-lg hover:bg-gray-400 transition-colors"
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
