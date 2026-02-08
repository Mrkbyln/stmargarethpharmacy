import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { usePharmacy } from '../context/PharmacyContext';
import apiClient from '../lib/apiClient';
import { formatDateTime } from '../lib/dateFormatter';
import { AlertTriangle, Check, Search, X, CheckCircle, Plus, Loader, ArrowRight, ChevronDown, Download, FileText } from 'lucide-react';
import { createPortal } from 'react-dom';
import html2pdf from 'html2pdf.js';

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

// Clean quantity input component - allows free quantity editing
interface QuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
}

const QuantityInput = memo<QuantityInputProps>(({ value, onChange, placeholder = '1' }) => {
  const { themeColor } = usePharmacy();
  const isDarkTheme = themeColor === 'black';
  const [inputValue, setInputValue] = React.useState(String(value || ''));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setInputValue(input);

    // Allow empty input while typing
    if (input === '') {
      onChange(0);
      return;
    }

    const num = parseInt(input, 10);
    if (!isNaN(num) && num > 0) {
      // Allow any positive number freely
      onChange(num);
    }
  };

  const handleBlur = () => {
    // On blur, ensure we have a valid positive number
    const num = parseInt(inputValue, 10);
    if (isNaN(num) || num < 1) {
      setInputValue('1');
      onChange(1);
    } else {
      setInputValue(String(num));
      onChange(num);
    }
  };

  const handleFocus = () => {
    setInputValue(String(value || ''));
  };

  return (
    <input
      type="number"
      min="1"
      value={inputValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      placeholder={placeholder}
      className={`w-20 px-2 py-1 border rounded text-sm focus:outline-none transition-colors ${
        isDarkTheme
          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-blue-400 focus:ring-1 focus:ring-blue-400'
          : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
      }`}
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
  const { themeColor } = usePharmacy();
  const isDarkTheme = themeColor === 'black';
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
      className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 text-sm ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-amber-400 focus:ring-amber-400' : 'border-amber-200 focus:border-amber-500 focus:ring-amber-500'}`}
    />
  );
});

PriceInput.displayName = 'PriceInput';

// Simple reason input component - uncontrolled for real-time responsiveness
interface ReasonInputProps {
  value?: string;
  actionType: ActionType;
  onChange: (value: string) => void;
}

const ReasonInput = React.forwardRef<HTMLTextAreaElement, ReasonInputProps>(
  ({ value, actionType, onChange }, ref) => {
    const { themeColor } = usePharmacy();
    const isDarkTheme = themeColor === 'black';
    const internalRef = React.useRef<HTMLTextAreaElement>(null);
    const textareaRef = ref || internalRef;
    const [localValue, setLocalValue] = React.useState(value || '');

    // Sync when parent value changes (modal open/reset)
    React.useEffect(() => {
      setLocalValue(value || '');
    }, [value]);

    // Debounce updates to parent to avoid frequent parent re-renders
    React.useEffect(() => {
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
      <div>
        <label className={`block text-sm font-semibold mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Reason *</label>
        <textarea
          ref={textareaRef}
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={actionType === 'change' ? 'e.g., Defective product, wrong item, customer preference' : 'e.g., Package damaged, expiration date passed, broke during handling'}
          rows={3}
          className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-1 resize-none transition-none ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-400 focus:ring-blue-400' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500'}`}
        />
      </div>
    );
  }
);

ReasonInput.displayName = 'ReasonInput';

// Memoized validation error display component
interface ValidationErrorProps {
  error: string | null;
}

const ValidationError = memo<ValidationErrorProps>(({ error }) => {
  const { themeColor } = usePharmacy();
  const isDarkTheme = themeColor === 'black';
  if (!error) return null;
  return (
    <div className={`border p-3 rounded-lg ${isDarkTheme ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-200'}`}>
      <p className={`text-sm font-semibold ${isDarkTheme ? 'text-red-400' : 'text-red-700'}`}>⚠️ {error}</p>
    </div>
  );
});

ValidationError.displayName = 'ValidationError';

// Memoized action buttons component with optimized disabled state
interface ActionButtonsProps {
  isSubmitting: boolean;
  selectedStockItemsSize: number;
  reasonTrimmed: boolean;
  actionType: ActionType;
  hasReplacementItems: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

const ActionButtons = memo<ActionButtonsProps>(({ 
  isSubmitting, 
  selectedStockItemsSize, 
  reasonTrimmed,
  actionType, 
  hasReplacementItems,
  onCancel, 
  onSubmit 
}) => {
  const { themeColor } = usePharmacy();
  const isDarkTheme = themeColor === 'black';
  
  // Disable button if:
  // 1. Currently submitting
  // 2. No items selected to return
  // 3. For 'change' action: no replacement items selected
  // 4. No reason provided
  const isDisabled = isSubmitting || 
    selectedStockItemsSize === 0 || 
    (actionType === 'change' && !hasReplacementItems) ||
    !reasonTrimmed;
  
  return (
    <div className={`flex gap-3 pt-4 border-t ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
      <button
        onClick={onCancel}
        className={`flex-1 py-2.5 px-4 font-bold rounded-lg transition-colors ${isDarkTheme ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
      >
        Cancel
      </button>
      <button
        onClick={onSubmit}
        disabled={isDisabled}
        className="flex-1 py-2.5 px-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Processing...' : actionType === 'change' ? 'Process Change' : 'Mark as Damaged'}
      </button>
    </div>
  );
});

ActionButtons.displayName = 'ActionButtons';

// Memoized modal body component - isolates expensive calculations
interface ModalBodyProps {
  selectedSale: Sale | null;
  actionType: ActionType;
  saleItems: SoldItem[];
  selectedStockItems: Set<number>;
  itemQuantities: Record<number, number>;
  selectedReplacementProduct: Map<number, string>;
  replacementQuantity: Map<number, number>;
  multipleReplacements: Map<number, Map<number, {code: string; qty: number}>>;
  stocks: StockItem[];
  reason: string;
  priceValidationError: string | null;
  isSubmitting: boolean;
  currencySymbol: string;
  onSelectStock: (idx: number) => void;
  onQuantityChange: (idx: number, qty: number) => void;
  onReasonChange: (value: string) => void;
  onReplacementProductChange: (itemIdx: number, productCode: string) => void;
  onProcessTransaction: () => void;
}

const ModalBody = ({
  selectedSale,
  actionType,
  saleItems,
  selectedStockItems,
  itemQuantities,
  selectedReplacementProduct,
  replacementQuantity,
  multipleReplacements,
  stocks,
  reason,
  priceValidationError,
  isSubmitting,
  currencySymbol,
  onSelectStock,
  onQuantityChange,
  onReasonChange,
  onReplacementProductChange,
  onProcessTransaction
}: ModalBodyProps) => {
  const { themeColor } = usePharmacy();
  const isDarkTheme = themeColor === 'black';
  return (
    <div className="space-y-6">
      {/* Sale Info */}
      <div className={`border p-4 rounded-lg ${isDarkTheme ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'}`}>
        <p className={`text-xs font-semibold mb-2 ${isDarkTheme ? 'text-blue-300' : 'text-slate-600'}`}>SALE DETAILS</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Date</p>
            <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{selectedSale?.SaleDate || selectedSale?.TransactionDate || 'N/A'}</p>
          </div>
          <div>
            <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Amount</p>
            <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{currencySymbol}{(selectedSale?.FinalAmount || selectedSale?.TotalAmount || 0)}</p>
          </div>
          <div>
            <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Items</p>
            <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{selectedSale?.ItemCount || saleItems.length}</p>
          </div>
        </div>
      </div>

      {/* Stock Selection */}
      <div>
        <label className={`block text-sm font-semibold mb-3 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Items to {actionType === 'change' ? 'Return' : 'Mark as Damaged'} *</label>
        <div className={`border rounded-lg overflow-hidden ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className={`max-h-[300px] overflow-y-auto divide-y ${isDarkTheme ? 'divide-gray-700' : 'divide-gray-100'}`}>
            {saleItems.length > 0 ? (
              saleItems.map((item, idx) => {
                const itemKey = `sale-item-${item.ProductID}-${idx}`;
                const isSelected = selectedStockItems.has(idx);
                const selectedQty = itemQuantities[idx] || 0;
                const remainingQty = item.QuantitySold - selectedQty;
                
                return (
                  <div key={itemKey} className={`p-4 transition-colors ${!isSelected ? (isDarkTheme ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50') : (isDarkTheme ? 'bg-blue-900/30' : 'bg-blue-50')}`}>
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        id={itemKey}
                        checked={isSelected}
                        onChange={() => onSelectStock(idx)}
                        className="mt-1 w-4 h-4 cursor-pointer"
                      />
                      <div className="flex-1">
                        <label htmlFor={itemKey} className="block cursor-pointer">
                          <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{item.ProductName}</p>
                          <p className={`text-xs mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Code: {item.ProductCode || 'N/A'} | Qty: {remainingQty}</p>
                          {(item.SellingPrice || item.UnitPrice) && (
                            <p className={`text-xs mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Price: {currencySymbol}{(item.SellingPrice || item.UnitPrice).toFixed(2)}</p>
                          )}
                        </label>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-2 ml-auto">
                          <label className={`text-xs font-semibold whitespace-nowrap ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Qty:</label>
                          <QuantityInput
                            value={itemQuantities[idx] || 1}
                            onChange={(qty) => onQuantityChange(idx, qty)}
                            placeholder="1"
                          />
                          <span className={`text-xs ml-1 whitespace-nowrap ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>/ {item.QuantitySold}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={`p-8 text-center ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>No items found</div>
            )}
          </div>
        </div>
        {selectedStockItems.size > 0 && (
          <div className={`mt-2 text-sm ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>
            <strong>{selectedStockItems.size}</strong> item(s) selected
          </div>
        )}
      </div>

      {/* Replacement Product Selection */}
      {selectedStockItems.size > 0 && actionType === 'change' && (
        <div>
          <label className="block text-sm font-semibold text-slate-600 mb-3">Select Replacement ({selectedStockItems.size} item{selectedStockItems.size > 1 ? 's' : ''}) *</label>
          <div className="space-y-3 border border-gray-200 rounded-lg p-4 max-h-[300px] overflow-y-auto">
            {Array.from(selectedStockItems).map((itemIdx) => {
              const saleItem = saleItems[itemIdx];
              const selectedCode = selectedReplacementProduct.get(itemIdx) || '';
              
              return (
                <div key={itemIdx} className="border-b border-gray-100 pb-3 last:border-0">
                  <p className="text-xs text-slate-600 font-semibold mb-2">{saleItem?.ProductName}</p>
                  <select
                    value={selectedCode}
                    onChange={(e) => onReplacementProductChange(itemIdx, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- Select replacement --</option>
                    {stocks.map((stock) => {
                      const code = stock.ProductCode || `ENTRY-${stock.StockEntryID}`;
                      if (saleItem?.ProductID === stock.ProductID) return null;
                      return (
                        <option key={stock.StockEntryID} value={code}>
                          {stock.Particulars || 'Unknown'} | {currencySymbol}{(stock.SellingPrice || stock.UnitPrice || 0).toFixed(2)}
                        </option>
                      );
                    })}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reason */}
      <ReasonInput 
        value={reason}
        actionType={actionType}
        onChange={onReasonChange}
      />

      {/* Validation Errors */}
      <ValidationError error={priceValidationError} />

      {/* Action Buttons */}
      <ActionButtons
        isSubmitting={isSubmitting}
        selectedStockItemsSize={selectedStockItems.size}
        reasonTrimmed={reason.trim().length > 0}
        actionType={actionType}
        hasReplacementItems={selectedReplacementProduct.size > 0 || multipleReplacements.size > 0}
        onCancel={() => {}}
        onSubmit={onProcessTransaction}
      />
    </div>
  );
};

ModalBody.displayName = 'ModalBody';

// Memoized process modal component to prevent re-renders on state changes
interface ProcessModalProps {
  selectedSale: Sale | null;
  actionType: ActionType;
  saleItems: SoldItem[];
  selectedStockItems: Set<number>;
  itemQuantities: Record<number, number>;
  selectedReplacementProduct: Map<number, string>;
  replacementQuantity: Map<number, number>;
  multipleReplacements: Map<number, Map<number, {code: string; qty: number}>>;
  stocks: StockItem[];
  reason: string;
  replacementProductSearch: string;
  priceValidationError: string | null;
  isSubmitting: boolean;
  currencySymbol: string;
  modalError: string | null;
  additionalPayment: number;
  manualAdditionalPayment: string;
  modalState: { reasonTrimmed: boolean; selectedStockItemsSize: number; isButtonDisabled: boolean };
  onSelectStock: (idx: number) => void;
  onQuantityChange: (idx: number, qty: number) => void;
  onReasonChange: (value: string) => void;
  onReplacementProductChange: (itemIdx: number, productCode: string) => void;
  onReplacementProductSearch: (value: string) => void;
  onProcessTransaction: () => void;
  onReset: () => void;
  onItemQuantitiesChange: (quantities: Record<number, number>) => void;
  onManualAdditionalPaymentChange: (value: string) => void;
  onShowAddProductModal: (show: boolean) => void;
  onSetAddProductItemIdx: (idx: number | null) => void;
  onSetAddProductSearch: (search: string) => void;
  onSetAddProductQty: (qty: string) => void;
  onSetMultipleReplacements: (replacements: Map<number, Map<number, {code: string; qty: number}>>) => void;
  onEditAdditionalProductQty: (itemIdx: number, productIdx: number, newQty: number) => void;
  onReplacementQuantityChange: (itemIdx: number, qty: number) => void;
}

const ProcessModal = ({
  selectedSale,
  actionType,
  saleItems,
  selectedStockItems,
  itemQuantities,
  selectedReplacementProduct,
  replacementQuantity,
  multipleReplacements,
  stocks,
  reason,
  replacementProductSearch,
  priceValidationError,
  isSubmitting,
  currencySymbol,
  modalError,
  additionalPayment,
  manualAdditionalPayment,
  modalState,
  onSelectStock,
  onQuantityChange,
  onReasonChange,
  onReplacementProductChange,
  onReplacementProductSearch,
  onProcessTransaction,
  onReset,
  onManualAdditionalPaymentChange,
  onShowAddProductModal,
  onSetAddProductItemIdx,
  onSetAddProductSearch,
  onSetAddProductQty,
  onSetMultipleReplacements,
  onReplacementQuantityChange,
  onEditAdditionalProductQty
}: ProcessModalProps) => {
  const { themeColor } = usePharmacy();
  const isDarkTheme = themeColor === 'black';
  const reasonInputRef = React.useRef<HTMLTextAreaElement>(null);

  if (!selectedSale) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
      <div className={`rounded-xl shadow-2xl max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
        {/* Modal Header */}
        <div className={`flex justify-between items-center mb-6 pb-4 border-b ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
          <div>
            <h2 className={`text-2xl font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Process Transaction</h2>
            <p className={`text-sm mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Sale #INV-{String(selectedSale.SaleID).padStart(6, '0')}</p>
          </div>
          <button
            onClick={onReset}
            className={`transition-colors ${isDarkTheme ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <X size={24} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="space-y-6">
          {/* Modal Error Alert */}
          {modalError && (
            <div className={`border p-4 rounded-lg flex items-start gap-3 ${isDarkTheme ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-200'}`}>
              <AlertTriangle size={20} className={`mt-0.5 flex-shrink-0 ${isDarkTheme ? 'text-red-400' : 'text-red-600'}`} />
              <div>
                <h3 className={`font-bold ${isDarkTheme ? 'text-red-400' : 'text-red-800'}`}>Error</h3>
                <p className={`text-sm ${isDarkTheme ? 'text-red-300' : 'text-red-700'}`}>{modalError}</p>
              </div>
            </div>
          )}

          {/* Sale Info */}
          <div className={`border p-4 rounded-lg ${isDarkTheme ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'}`}>
            <p className={`text-xs font-semibold mb-2 ${isDarkTheme ? 'text-blue-300' : 'text-slate-600'}`}>SALE DETAILS</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Date</p>
                <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{formatDateTime(selectedSale.SaleDate || selectedSale.TransactionDate)}</p>
              </div>
              <div>
                <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Amount</p>
                <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>₱{(selectedSale.FinalAmount || selectedSale.TotalAmount ? parseFloat(String(selectedSale.FinalAmount || selectedSale.TotalAmount)).toFixed(2) : '0.00')}</p>
              </div>
              <div>
                <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Items</p>
                <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{selectedSale.ItemCount || 0}</p>
              </div>
            </div>
          </div>

          {/* Stock Selection */}
          <div>
            <label className={`block text-sm font-semibold mb-3 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Items to {actionType === 'change' ? 'Return' : 'Mark as Damaged'} *</label>
            <div className={`border rounded-lg overflow-hidden ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className={`max-h-[300px] overflow-y-auto divide-y ${isDarkTheme ? 'divide-gray-700' : 'divide-gray-100'}`}>
                {saleItems.length > 0 ? (
                  saleItems.map((item, idx) => {
                    const itemKey = `sale-item-${item.ProductID}-${idx}`;
                    const hasReplacement = actionType === 'change' && selectedReplacementProduct.has(idx);
                    const isDisabled = hasReplacement && !selectedStockItems.has(idx);
                    const selectedQty = itemQuantities[idx] || 0;
                    const remainingQty = item.QuantitySold - selectedQty;
                    
                    return (
                      <div key={itemKey} className={`p-4 transition-colors ${isDisabled ? (isDarkTheme ? 'bg-gray-700/50 opacity-60' : 'bg-gray-100 opacity-60') : (isDarkTheme ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50')}`}>
                        <div className="flex items-start gap-4">
                          <input
                            type="checkbox"
                            id={itemKey}
                            checked={selectedStockItems.has(idx)}
                            onChange={() => onSelectStock(idx)}
                            disabled={isDisabled}
                            className="mt-1 w-4 h-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                          />
                          <div className="flex-1">
                            <label htmlFor={itemKey} className={`block ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                              <p className={`font-semibold ${isDisabled ? (isDarkTheme ? 'text-gray-500' : 'text-gray-500') : (isDarkTheme ? 'text-white' : 'text-slate-800')}`}>{item.ProductName}</p>
                              <p className={`text-xs mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
                                Code: {item.ProductCode || 'N/A'} | Sold: {remainingQty} {selectedQty > 0 && <span className="text-orange-400 font-semibold">(returning {selectedQty})</span>}
                              </p>
                              {(item.SellingPrice || item.UnitPrice) && (
                                <p className={`text-xs mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Selling Price: {currencySymbol}{(item.SellingPrice || item.UnitPrice).toFixed(2)}</p>
                              )}
                              {hasReplacement && (
                                <p className="text-xs text-green-400 mt-2 font-semibold">✓ Replacement already selected</p>
                              )}
                            </label>
                          </div>
                          {selectedStockItems.has(idx) && (
                            <div className="w-20">
                              <label className={`text-xs font-semibold ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Qty</label>
                              <input
                                type="number"
                                min="1"
                                value={itemQuantities[idx] || 1}
                                onChange={(e) => {
                                  const qty = parseInt(e.target.value) || 1;
                                  onQuantityChange(idx, qty);
                                }}
                                onBlur={(e) => {
                                  const qty = parseInt(e.target.value) || 1;
                                  if (qty < 1) onQuantityChange(idx, 1);
                                }}
                                className={`w-full px-2 py-1 border rounded text-sm focus:outline-none ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-gray-200 focus:border-blue-500'}`}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={`p-8 text-center ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
                    No items found in this sale
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

          {/* Replacement Product Selection */}
          {selectedStockItems.size > 0 && actionType === 'change' && (
            <div>
              <label className={`block text-sm font-semibold mb-3 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Select Replacement ({selectedStockItems.size} item{selectedStockItems.size > 1 ? 's' : ''}) *</label>
              
              {/* Search Bar for Replacement Products */}
              <div className="relative mb-4">
                <Search className={`absolute left-3 top-2.5 w-4 h-4 ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type="text"
                  placeholder="Search replacement products..."
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 text-sm ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-200'}`}
                  value={replacementProductSearch}
                  onChange={(e) => onReplacementProductSearch(e.target.value)}
                />
              </div>

              <div className={`space-y-3 border rounded-lg p-4 max-h-[350px] overflow-y-auto ${isDarkTheme ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200'}`}>
                {Array.from(selectedStockItems).map((itemIdx) => {
                  const saleItem = saleItems[itemIdx];
                  const selectedCode = selectedReplacementProduct.get(itemIdx) || '';
                  const replacementQty = replacementQuantity.get(itemIdx) || 1;
                  
                  // Find the selected replacement product
                  let selectedProduct = stocks.find(s => s.ProductCode === selectedCode);
                  if (!selectedProduct && selectedCode.startsWith('ENTRY-')) {
                    const entryId = parseInt(selectedCode.replace('ENTRY-', ''));
                    selectedProduct = stocks.find(s => s.StockEntryID === entryId);
                  }
                  
                  // Filter products based on search and exclude expired items
                  const filteredStocks = stocks.filter(stock => {
                    const code = stock.ProductCode || `ENTRY-${stock.StockEntryID}`;
                    // Don't show the same product as the returned item
                    if (saleItem?.ProductID === stock.ProductID) return false;
                    // Don't show expired items (check if expiration date has passed)
                    if (stock.ExpirationDate) {
                      const expirationDate = new Date(stock.ExpirationDate);
                      expirationDate.setHours(23, 59, 59, 999); // End of day
                      if (expirationDate < new Date()) return false; // Item is expired
                    }
                    // Filter by search term
                    const searchLower = replacementProductSearch.toLowerCase();
                    return (
                      (stock.Particulars || '').toLowerCase().includes(searchLower) ||
                      (stock.ProductCode || '').toLowerCase().includes(searchLower)
                    );
                  }).sort((a, b) => {
                    // Sort by quantity: low stock first (ascending), then new/full stock
                    return a.Quantity - b.Quantity;
                  });
                  
                  return (
                    <div key={itemIdx} className={`border rounded-lg p-3 ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                      <p className={`text-xs font-semibold mb-2 ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Returning: <span className={isDarkTheme ? 'text-white' : 'text-slate-800'}>{saleItem?.ProductName}</span> (Qty: {itemQuantities[itemIdx] || 1})</p>
                      
                      {/* Custom Dropdown List */}
                      <div className={`relative mb-2 border rounded-lg overflow-hidden ${isDarkTheme ? 'border-gray-600' : 'border-gray-200'}`}>
                        {selectedCode && !replacementProductSearch ? (
                          <div className={`p-2 ${isDarkTheme ? 'bg-gray-600' : 'bg-gray-100'}`}>
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1">
                                <p className={`text-sm font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-700'}`}>
                                  {stocks.find(s => (s.ProductCode || `ENTRY-${s.StockEntryID}`) === selectedCode)?.Particulars || 'Unknown'}
                                </p>
                                <p className={`text-xs ${isDarkTheme ? 'text-gray-300' : 'text-slate-500'}`}>
                                  ₱{(stocks.find(s => (s.ProductCode || `ENTRY-${s.StockEntryID}`) === selectedCode)?.SellingPrice || 0).toFixed(2)}
                                </p>
                              </div>
                              <button
                                onClick={() => onReplacementProductChange(itemIdx, '')}
                                className={`text-xs px-2 py-1 rounded font-semibold transition-colors ${isDarkTheme ? 'text-blue-300 hover:bg-gray-500' : 'text-blue-600 hover:bg-gray-200'}`}
                                title="Click to change product"
                              >
                                Change
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className={`max-h-[200px] overflow-y-auto ${isDarkTheme ? 'bg-gray-600' : 'bg-gray-50'}`}>
                            {filteredStocks.length > 0 ? (
                              filteredStocks.map((stock) => {
                                const code = stock.ProductCode || `ENTRY-${stock.StockEntryID}`;
                                return (
                                  <button
                                    key={stock.StockEntryID}
                                    onClick={() => onReplacementProductChange(itemIdx, code)}
                                    className={`w-full text-left px-3 py-2 transition-colors border-b last:border-0 ${
                                      isDarkTheme
                                        ? 'hover:bg-gray-500 border-gray-500'
                                        : 'hover:bg-gray-200 border-gray-100'
                                    }`}
                                  >
                                    <p className={`text-sm font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-700'}`}>
                                      {stock.Particulars || 'Unknown'}
                                    </p>
                                    <p className={`text-xs ${isDarkTheme ? 'text-gray-300' : 'text-slate-500'}`}>
                                      ₱{(stock.SellingPrice || stock.UnitPrice || 0).toFixed(2)}
                                    </p>
                                  </button>
                                );
                              })
                            ) : replacementProductSearch ? (
                              <div className={`p-3 text-center text-xs ${isDarkTheme ? 'text-gray-300' : 'text-slate-500'}`}>
                                No products found matching "{replacementProductSearch}"
                              </div>
                            ) : (
                              <div className={`p-3 text-center text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-400'}`}>
                                Start typing to search products...
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {selectedProduct && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Qty:</span>
                            <input
                              type="number"
                              min="1"
                              value={replacementQty}
                              onChange={(e) => {
                                const qty = parseInt(e.target.value, 10) || 1;
                                onReplacementQuantityChange(itemIdx, qty);
                              }}
                              onBlur={(e) => {
                                const qty = Math.max(1, parseInt(e.target.value, 10) || 1);
                                onReplacementQuantityChange(itemIdx, qty);
                              }}
                              className={`w-16 px-2 py-1 border rounded text-sm focus:outline-none focus:border-blue-500 ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-200'}`}
                            />
                            <span className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>@ ₱{(selectedProduct.SellingPrice || selectedProduct.UnitPrice || 0).toFixed(2)}</span>
                          </div>

                          {/* Additional Products Section */}
                          {multipleReplacements.get(itemIdx)?.size > 0 && (
                            <div className={`border-t pt-2 space-y-2 ${isDarkTheme ? 'border-gray-600' : 'border-gray-200'}`}>
                              <p className={`text-xs font-semibold ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Additional Products:</p>
                              {Array.from(multipleReplacements.get(itemIdx)?.entries() || []).map(([productIdx, { code, qty }]) => {
                                const additionalProduct = stocks.find(s => s.ProductCode === code || `ENTRY-${s.StockEntryID}` === code);
                                return (
                                  <div key={`${itemIdx}-${productIdx}`} className={`flex items-center justify-between gap-2 p-2 rounded ${isDarkTheme ? 'bg-gray-600/50' : 'bg-gray-100'}`}>
                                    <div className="flex-1">
                                      <p className={`text-xs font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-700'}`}>
                                        {additionalProduct?.Particulars || 'Unknown'}
                                      </p>
                                      <div className="flex items-center gap-1 mt-1">
                                        <input
                                          type="number"
                                          min="0"
                                          value={qty === 0 ? '' : qty}
                                          onChange={(e) => {
                                            const input = e.target.value;
                                            // Allow empty input or any number
                                            if (input === '') {
                                              onEditAdditionalProductQty(itemIdx, productIdx, 0);
                                              return;
                                            }
                                            const newQty = parseInt(input, 10);
                                            if (!isNaN(newQty) && newQty >= 0) {
                                              onEditAdditionalProductQty(itemIdx, productIdx, newQty);
                                            }
                                          }}
                                          className={`w-12 px-1.5 py-0.5 border rounded text-xs focus:outline-none ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'border-gray-300 focus:border-blue-500'}`}
                                        />
                                        <span className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>x ₱{(additionalProduct?.SellingPrice || additionalProduct?.UnitPrice || 0).toFixed(2)} = ₱{(qty && qty > 0 ? (qty * (additionalProduct?.SellingPrice || additionalProduct?.UnitPrice || 0)) : 0).toFixed(2)}</span>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => {
                                        const updated = new Map(multipleReplacements);
                                        const itemReplacements = new Map(updated.get(itemIdx));
                                        itemReplacements.delete(productIdx);
                                        if (itemReplacements.size === 0) {
                                          updated.delete(itemIdx);
                                        } else {
                                          updated.set(itemIdx, itemReplacements);
                                        }
                                        onSetMultipleReplacements(updated);
                                      }}
                                      className={`text-xs px-2 py-1 rounded font-semibold transition-colors whitespace-nowrap ${isDarkTheme ? 'text-red-300 hover:bg-gray-500' : 'text-red-600 hover:bg-gray-200'}`}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Add Product Button */}
                          <button
                            onClick={() => {
                              onSetAddProductItemIdx(itemIdx);
                              onSetAddProductSearch('');
                              onSetAddProductQty('1');
                              onShowAddProductModal(true);
                            }}
                            className={`w-full text-xs px-3 py-2 rounded font-semibold transition-colors flex items-center justify-center gap-1 ${isDarkTheme ? 'bg-blue-900/30 text-blue-300 hover:bg-blue-900/50 border border-blue-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'}`}
                            title="Add additional replacement products"
                          >
                            <Plus size={14} />
                            Add Product
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Price Summary - Show when replacement is selected */}
          {actionType === 'change' && selectedReplacementProduct.size > 0 && (
            <div className="space-y-3">
              <label className={`block text-sm font-semibold mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Price Summary</label>
              <div className={`border rounded-lg p-4 space-y-2 ${
                additionalPayment > 0 
                  ? isDarkTheme ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'
                  : isDarkTheme ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-200'
              }`}>
                <div className="flex justify-between items-center">
                  <span className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Returned Item Value:</span>
                  <span className={`font-semibold ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{currencySymbol}{selectedReplacementProduct.size > 0 ? Array.from(selectedStockItems).reduce((sum, idx) => {
                    const item = saleItems[idx];
                    const qty = itemQuantities[idx] || 1;
                    return sum + ((item?.SellingPrice || item?.UnitPrice || 0) * qty);
                  }, 0).toFixed(2) : '0.00'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>Replacement Value:</span>
                  <span className={`font-semibold ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{currencySymbol}{selectedReplacementProduct.size > 0 ? (() => {
                    // Calculate primary replacement value
                    let primaryTotal = Array.from(selectedReplacementProduct.values()).reduce((sum, code) => {
                      const product = stocks.find(s => s.ProductCode === code || `ENTRY-${s.StockEntryID}` === code);
                      const qty = replacementQuantity.get(Array.from(selectedReplacementProduct.keys()).find(k => selectedReplacementProduct.get(k) === code) || 0) || 1;
                      return sum + ((product?.SellingPrice || product?.UnitPrice || 0) * qty);
                    }, 0);
                    
                    // Add additional products value
                    let additionalTotal = 0;
                    multipleReplacements.forEach((itemReplacements) => {
                      itemReplacements.forEach(({ code, qty }) => {
                        const product = stocks.find(s => s.ProductCode === code || `ENTRY-${s.StockEntryID}` === code);
                        additionalTotal += ((product?.SellingPrice || product?.UnitPrice || 0) * qty);
                      });
                    });
                    
                    return (primaryTotal + additionalTotal).toFixed(2);
                  })() : '0.00'}</span>
                </div>
                <div className={`border-t pt-2 flex justify-between items-center ${isDarkTheme ? 'border-gray-600' : 'border-gray-200'}`}>
                  <span className={`text-sm font-bold ${additionalPayment > 0 ? isDarkTheme ? 'text-blue-300' : 'text-blue-600' : isDarkTheme ? 'text-green-300' : 'text-green-600'}`}>
                    {additionalPayment > 0 ? 'Additional Payment:' : 'Additional Payment:'}
                  </span>
                  <span className={`text-xl font-bold ${additionalPayment > 0 ? isDarkTheme ? 'text-blue-400' : 'text-blue-600' : isDarkTheme ? 'text-green-400' : 'text-green-600'}`}>
                    {currencySymbol}{(() => {
                      // Calculate primary replacement value
                      let primaryTotal = Array.from(selectedReplacementProduct.values()).reduce((sum, code) => {
                        const product = stocks.find(s => s.ProductCode === code || `ENTRY-${s.StockEntryID}` === code);
                        const qty = replacementQuantity.get(Array.from(selectedReplacementProduct.keys()).find(k => selectedReplacementProduct.get(k) === code) || 0) || 1;
                        return sum + ((product?.SellingPrice || product?.UnitPrice || 0) * qty);
                      }, 0);
                      
                      // Add additional products value
                      let additionalTotal = 0;
                      multipleReplacements.forEach((itemReplacements) => {
                        itemReplacements.forEach(({ code, qty }) => {
                          const product = stocks.find(s => s.ProductCode === code || `ENTRY-${s.StockEntryID}` === code);
                          additionalTotal += ((product?.SellingPrice || product?.UnitPrice || 0) * qty);
                        });
                      });
                      
                      // Calculate returned item value
                      const returnedTotal = Array.from(selectedStockItems).reduce((sum, idx) => {
                        const item = saleItems[idx];
                        const qty = itemQuantities[idx] || 1;
                        return sum + ((item?.SellingPrice || item?.UnitPrice || 0) * qty);
                      }, 0);
                      
                      const totalReplacement = primaryTotal + additionalTotal;
                      const difference = totalReplacement - returnedTotal;
                      return Math.abs(difference).toFixed(2);
                    })()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Reason */}
          <ReasonInput 
            ref={reasonInputRef}
            value={reason}
            actionType={actionType}
            onChange={onReasonChange}
          />\n\n          {/* Validation Errors */}
          <ValidationError error={priceValidationError} />

          {/* Action Buttons */}
          <ActionButtons
            isSubmitting={isSubmitting}
            selectedStockItemsSize={modalState.selectedStockItemsSize}
            reasonTrimmed={modalState.reasonTrimmed}
            actionType={actionType}
            hasReplacementItems={selectedReplacementProduct.size > 0 || multipleReplacements.size > 0}
            onCancel={onReset}
            onSubmit={onProcessTransaction}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

ProcessModal.displayName = 'ProcessModal';

const ChangeItem: React.FC = () => {
  const { user, currencySymbol, themeColor } = usePharmacy();
  const isDarkTheme = themeColor === 'black';
  const [sales, setSales] = useState<Sale[]>([]);
  // Cache raw sales rows so we can filter items for a sale locally
  const [salesRaw, setSalesRaw] = useState<any[]>([]);
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
  const reasonRef = React.useRef('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<ChangeItemRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState({
    startDate: '',
    endDate: ''
  });
  const [additionalPayment, setAdditionalPayment] = useState<number>(0);
  const [manualAdditionalPayment, setManualAdditionalPayment] = useState<string>('');
  const [replacementProductSearch, setReplacementProductSearch] = useState('');
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addProductItemIdx, setAddProductItemIdx] = useState<number | null>(null);
  const [addProductSearch, setAddProductSearch] = useState('');
  const [addProductQty, setAddProductQty] = useState('1');

  // Pagination for sales list to avoid heavy DOM rendering
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Pagination for exchange history table
  const [historyCurrentPage, setHistoryCurrentPage] = useState<number>(1);
  const [historyPageSize, setHistoryPageSize] = useState<number>(10);

  // Validation errors
  const [priceValidationError, setPriceValidationError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const clearFilters = () => {
    setSearchTerm('');
    setHistoryFilter({ startDate: '', endDate: '' });
    setReplacementProductSearch('');
  };

  const handleAddAdditionalProduct = (itemIdx: number, productCode: string) => {
    if (!productCode) return;

    const qty = parseInt(addProductQty) || 1;
    const updated = new Map(multipleReplacements);
    
    // Get or create the replacements map for this item
    const itemReplacements = new Map(updated.get(itemIdx) || new Map());
    
    // Use a unique index for this additional product (next available)
    const nextIdx = Math.max(...Array.from(itemReplacements.keys()), -1) + 1;
    itemReplacements.set(nextIdx, { code: productCode, qty });
    
    updated.set(itemIdx, itemReplacements);
    setMultipleReplacements(updated);
    
    // Reset and close modal
    setShowAddProductModal(false);
    setAddProductItemIdx(null);
    setAddProductSearch('');
    setAddProductQty('1');
  };

  const handleEditAdditionalProductQty = (itemIdx: number, productIdx: number, newQty: number) => {
    // Allow any value including 0 (empty)
    const updated = new Map(multipleReplacements);
    const itemReplacements = new Map(updated.get(itemIdx));
    const product = itemReplacements.get(productIdx);
    
    if (product) {
      itemReplacements.set(productIdx, { ...product, qty: newQty });
      updated.set(itemIdx, itemReplacements);
      setMultipleReplacements(updated);
    }
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

  // Memoized calculated values to prevent unnecessary re-computations
  const modalState = useMemo(() => {
    const hasReplacementItems = actionType === 'change' && (selectedReplacementProduct.size > 0 || multipleReplacements.size > 0);
    const isButtonDisabled = isSubmitting || 
      selectedStockItems.size === 0 || 
      (actionType === 'change' && !hasReplacementItems) ||
      !reasonRef.current.trim();
    
    return {
      reasonTrimmed: reasonRef.current.trim().length > 0,
      selectedStockItemsSize: selectedStockItems.size,
      isButtonDisabled
    };
  }, [selectedStockItems.size, selectedReplacementProduct.size, multipleReplacements.size, isSubmitting, reason, actionType]);

  // Fetch items for a specific sale
  const fetchSaleItems = async (saleID: number) => {
    // If we already have the raw sales data cached from initial load, use it to avoid a network call
    if (salesRaw && salesRaw.length > 0) {
      const items = salesRaw.filter((item: any) => item.SaleID === saleID) || [];
      setSaleItems(items);
      return;
    }

    try {
      const response = await apiClient.getSalesForReturn();
      if (response.success) {
        const raw = response.data || [];
        // cache full rows for subsequent quick filtering
        setSalesRaw(raw);
        const items = raw.filter((item: any) => item.SaleID === saleID) || [];
        setSaleItems(items);
      }
    } catch (err) {
      setSaleItems([]);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sync reason state when modal opens - force update when modal reopens
  useEffect(() => {
    if (!showProcessModal) {
      // Modal closed, no action needed
      return;
    }
    // Modal opened, sync ref value to state if state is empty
    // This ensures button state recalculates properly
    if (!reason) {
      setReason(reasonRef.current);
    }
  }, [showProcessModal]);

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
        // Cache the raw sales rows so we can derive sale items instantly when user selects a sale
        setSalesRaw(salesData);
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

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / pageSize));

  useEffect(() => {
    // reset to first page whenever search or page size changes
    setCurrentPage(1);
  }, [searchTerm, pageSize, filteredSales.length]);

  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSales.slice(start, start + pageSize);
  }, [filteredSales, currentPage, pageSize]);

  const filteredHistory = changeHistory.filter(ch =>
    ch.ChangeID.toString().includes(searchTerm) ||
    ch.OriginalSaleID.toString().includes(searchTerm) ||
    (ch.ItemReturnedName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
    ch.ItemGiven.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Apply date filters and paginate the history list so pagination reflects visible rows
  const historyFilteredByDate = useMemo(() => {
    return filteredHistory.filter(item => {
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
    });
  }, [filteredHistory, historyFilter.startDate, historyFilter.endDate]);

  const historyTotalPages = Math.max(1, Math.ceil(historyFilteredByDate.length / historyPageSize));

  useEffect(() => {
    // Reset history page when filters/search/page size change
    setHistoryCurrentPage(1);
  }, [searchTerm, historyFilter.startDate, historyFilter.endDate, historyPageSize, historyFilteredByDate.length]);

  const historyPaginated = useMemo(() => {
    const start = (historyCurrentPage - 1) * historyPageSize;
    return historyFilteredByDate.slice(start, start + historyPageSize);
  }, [historyFilteredByDate, historyCurrentPage, historyPageSize]);

  const handleSelectStock = useCallback((itemIdx: number) => {
    setSelectedStockItems(prev => {
      const newSelection = new Set(prev);
      
      if (newSelection.has(itemIdx)) {
        // Deselect: remove item and its quantity
        newSelection.delete(itemIdx);
        setItemQuantities(prevQties => {
          const updated = { ...prevQties };
          delete updated[itemIdx];
          return updated;
        });
      } else {
        // Select: add item with default quantity of 1
        newSelection.add(itemIdx);
        setItemQuantities(prevQties => ({ ...prevQties, [itemIdx]: 1 }));
      }
      
      return newSelection;
    });
    
    setPriceValidationError(null);
  }, []);

  const handleQuantityChange = useCallback((itemIdx: number, value: number) => {
    setItemQuantities(prev => ({ ...prev, [itemIdx]: value || 1 }));
  }, []);

  const handleReasonChange = useCallback((value: string) => {
    // Update ref immediately for instant feedback
    reasonRef.current = value;
    // Also update state so modalState and buttons re-evaluate immediately
    setReason(value);
  }, []);

  const handleReplacementProductChange = useCallback((itemIdx: number, productCode: string) => {
    if (!productCode) {
      // Clearing selection
      const newMap = new Map(selectedReplacementProduct);
      newMap.delete(itemIdx);
      setSelectedReplacementProduct(newMap);
      return;
    }

    // Set the selected replacement product
    const newMap = new Map(selectedReplacementProduct);
    newMap.set(itemIdx, productCode);
    setSelectedReplacementProduct(newMap);

    // Initialize replacement quantity to 1 if not already set
    if (!replacementQuantity.has(itemIdx)) {
      const newQtyMap = new Map(replacementQuantity);
      newQtyMap.set(itemIdx, 1);
      setReplacementQuantity(newQtyMap);
    }

    // Initialize item quantity to 1 if not already set
    if (!itemQuantities[itemIdx]) {
      setItemQuantities(prev => ({ ...prev, [itemIdx]: 1 }));
    }

    // Auto-calculate additional payment based on price difference
    calculateAdditionalPayment(itemIdx, productCode);
  }, [selectedReplacementProduct, replacementQuantity, itemQuantities, saleItems, stocks]);

  const calculateAdditionalPayment = useCallback((itemIdx: number, productCode: string) => {
    const returnedItem = saleItems[itemIdx];
    if (!returnedItem) return;

    const returnedQty = itemQuantities[itemIdx] || 1;
    const returnedPrice = returnedItem.SellingPrice || returnedItem.UnitPrice || 0;
    const returnedTotal = returnedQty * returnedPrice;

    // Find replacement product
    let replacementProduct = stocks.find(s => s.ProductCode === productCode);
    if (!replacementProduct && productCode.startsWith('ENTRY-')) {
      const entryId = parseInt(productCode.replace('ENTRY-', ''), 10);
      replacementProduct = stocks.find(s => s.StockEntryID === entryId);
    }

    if (!replacementProduct) return;

    const replacementQty = replacementQuantity.get(itemIdx) || 1;
    const replacementPrice = replacementProduct.SellingPrice || replacementProduct.UnitPrice || 0;
    const replacementTotal = replacementQty * replacementPrice;

    // Calculate additional payment only if replacement is more expensive
    const difference = replacementTotal - returnedTotal;
    setAdditionalPayment(Math.max(0, difference));
  }, [itemQuantities, saleItems, stocks, replacementQuantity]);

  const validateItemGivenPrice = (): boolean => {
    setPriceValidationError(null);

    // Check basic requirements
    if (!selectedSale) {
      setPriceValidationError('Please select a sale first');
      return false;
    }

    if (selectedStockItems.size === 0) {
      setPriceValidationError('Please select at least one item to return');
      return false;
    }

    // For change action, ensure replacement products are selected
    if (actionType === 'change') {
      if (selectedReplacementProduct.size === 0) {
        setPriceValidationError('Please select a replacement product for each returned item');
        return false;
      }

      // Validate that replacement products exist in inventory
      for (const [itemIdx, productCode] of Array.from(selectedReplacementProduct.entries())) {
        const replacementProduct = findProductByCode(productCode);
        if (!replacementProduct) {
          setPriceValidationError(`Replacement product not found (code: ${productCode})`);
          return false;
        }
      }

      // Validate that replacement prices are equal or higher than returned prices
      for (const [itemIdx, productCode] of Array.from(selectedReplacementProduct.entries())) {
        const returnedItem = saleItems[itemIdx];
        if (!returnedItem) continue;

        const returnedQty = itemQuantities[itemIdx] || 1;
        const returnedPrice = returnedItem.SellingPrice || returnedItem.UnitPrice || 0;
        const returnedTotal = returnedQty * returnedPrice;

        const replacementProduct = findProductByCode(productCode);
        const replacementQty = replacementQuantity.get(itemIdx) || 1;
        const replacementPrice = replacementProduct?.SellingPrice || replacementProduct?.UnitPrice || 0;
        const replacementTotal = replacementQty * replacementPrice;

        // Calculate total replacement including additional items
        let additionalReplacementTotal = 0;
        multipleReplacements.get(itemIdx)?.forEach(({ code, qty }) => {
          const product = findProductByCode(code);
          const price = product?.SellingPrice || product?.UnitPrice || 0;
          additionalReplacementTotal += qty * price;
        });

        const totalReplacementPrice = replacementTotal + additionalReplacementTotal;
        const priceDifference = totalReplacementPrice - returnedTotal;

        if (priceDifference < -0.01) {
          setPriceValidationError(
            `Item #${itemIdx + 1}: Replacement price (₱${totalReplacementPrice.toFixed(2)}) cannot be less than returned item price (₱${returnedTotal.toFixed(2)})`
          );
          return false;
        }
      }
    }

    return true;
  };

  const findProductByCode = (productCode: string): StockItem | undefined => {
    const now = new Date();

    // Helper: determine if stock entry is expired
    const isExpired = (s: StockItem) => {
      if (!s.ExpirationDate) return false;
      const expiration = new Date(s.ExpirationDate);
      expiration.setHours(23, 59, 59, 999);
      return expiration < now;
    };

    // Collect candidate entries matching code or entry id
    let candidates: StockItem[] = [];
    if (productCode.startsWith('ENTRY-')) {
      const entryId = parseInt(productCode.replace('ENTRY-', ''), 10);
      candidates = stocks.filter(s => s.StockEntryID === entryId);
    } else {
      candidates = stocks.filter(s => s.ProductCode === productCode);
    }

    // Prefer non-expired candidates with available quantity
    const nonExpired = candidates.filter(s => !isExpired(s) && (Number(s.Quantity) || 0) > 0);
    if (nonExpired.length > 0) {
      // Choose the newest stock (prefer later expiration date, fallback to higher StockEntryID)
      nonExpired.sort((a, b) => {
        const aExp = a.ExpirationDate ? new Date(a.ExpirationDate).getTime() : 0;
        const bExp = b.ExpirationDate ? new Date(b.ExpirationDate).getTime() : 0;
        if (aExp !== bExp) return bExp - aExp;
        return (b.StockEntryID || 0) - (a.StockEntryID || 0);
      });
      return nonExpired[0];
    }

    // If no non-expired candidate, do not return expired entries (we avoid deducting expired stock)
    return undefined;
  };

  const buildSelectedItemsData = () => {
    return Array.from(selectedStockItems).map(itemIdx => {
      const item = saleItems[itemIdx];
      const qty = itemQuantities[itemIdx] || 1;
      return {
        itemIndex: itemIdx,
        particulars: item?.ProductName || '',
        quantity: qty,
        sellingPrice: item?.SellingPrice || item?.UnitPrice || 0,
        totalPrice: qty * (item?.SellingPrice || item?.UnitPrice || 0)
      };
    });
  };

  const handleProcessTransaction = async () => {
    // Validate reason from ref
    const latestReason = reasonRef.current.trim();
    
    if (!selectedSale || selectedStockItems.size === 0 || !latestReason) {
      setModalError('Please select a sale, items to return, and input a reason');
      return;
    }

    if (!validateItemGivenPrice()) {
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    setError(null);
    setSuccessMessage(null);

    try {
      const selectedItems = buildSelectedItemsData();

      if (actionType === 'change') {
        // Build replacement details including all items
        const { itemGivenDetails, totalGivenPrice, totalQtyGiven, replacementStockEntryId, replacementItems } = buildReplacementDetails();

        if (!itemGivenDetails.trim()) {
          setError('Replacement product details are missing. Please ensure all replacement products are properly selected.');
          setIsSubmitting(false);
          return;
        }

        // Calculate returned items total
        const returnedItemsPrice = selectedItems.reduce((sum, item) => sum + item.totalPrice, 0);
        const qtyReturnedTotal = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
        const itemReturnedId = saleItems[selectedItems[0]?.itemIndex || 0]?.ProductID || 0;

        // Calculate price difference
        const priceDifference = totalGivenPrice - returnedItemsPrice;
        const additionalPaymentAmount = Math.max(0, priceDifference);

        // Get stock entry IDs
        const returnedStockEntryId = getFirstReturnedStockEntryId();

        // Submit change transaction
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
          reason: latestReason,
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
        // Process as damaged items
        const damageRequests = selectedItems.map(item => 
          apiClient.markItemsDamaged({
            stockEntryId: 0, // Will be set by backend if needed
            quantity: item.quantity,
            reason: latestReason,
            currentUserId: Number(user?.UserID || user?.id || 0)
          })
        );

        const damageResults = await Promise.all(damageRequests);

        if (damageResults.every(r => r.success)) {
          setSuccessMessage('Damaged items recorded successfully');
          resetModal();
          fetchData();
          setTimeout(() => setSuccessMessage(null), 3000);
        } else {
          setError('Failed to record some damaged items');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error processing transaction');
      console.error('Transaction error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const buildReplacementDetails = () => {
    let itemGivenDetails = '';
    let totalGivenPrice = 0;
    let totalQtyGiven = 0;
    let replacementStockEntryId: number | undefined;
    const replacementItems: Array<{ name: string; code: string; qty: number; price: number; stockEntryId: number }> = [];

    // Process primary replacement products
    Array.from(selectedReplacementProduct.entries()).forEach(([itemIdx, productCode]) => {
      const product = findProductByCode(productCode);
      if (!product) return;

      const qty = replacementQuantity.get(itemIdx) || 1;
      const price = product.SellingPrice || product.UnitPrice || 0;

      if (itemGivenDetails) itemGivenDetails += ', ';
      const itemName = product.Particulars || product.ProductCode || 'Unknown';
      itemGivenDetails += `${itemName} x${qty}`;
      
      replacementItems.push({
        name: itemName,
        code: productCode,
        qty: qty,
        price: price,
        stockEntryId: product.StockEntryID
      });

      totalGivenPrice += price * qty;
      totalQtyGiven += qty;

      if (!replacementStockEntryId) {
        replacementStockEntryId = product.StockEntryID;
      }
    });

    // Process additional replacement products
    multipleReplacements.forEach((itemReplacements) => {
      itemReplacements.forEach(({ code, qty }) => {
        const product = findProductByCode(code);
        if (!product) return;

        const price = product.SellingPrice || product.UnitPrice || 0;
        if (itemGivenDetails) itemGivenDetails += ', ';
        const itemName = product.Particulars || product.ProductCode || 'Unknown';
        itemGivenDetails += `${itemName} x${qty}`;

        replacementItems.push({
          name: itemName,
          code: code,
          qty: qty,
          price: price,
          stockEntryId: product.StockEntryID
        });

        totalGivenPrice += price * qty;
        totalQtyGiven += qty;

        if (!replacementStockEntryId) {
          replacementStockEntryId = product.StockEntryID;
        }
      });
    });

    return { itemGivenDetails, totalGivenPrice, totalQtyGiven, replacementStockEntryId, replacementItems };
  };

  const getFirstReturnedStockEntryId = (): number | undefined => {
    const firstReturnedItemIdx = Array.from(selectedStockItems)[0];
    if (firstReturnedItemIdx === undefined) return undefined;

    const returnedSaleItem = saleItems[firstReturnedItemIdx];
    if (returnedSaleItem?.StockEntryID) {
      return returnedSaleItem.StockEntryID;
    }

    // Fallback: find stock entry by product ID
    const matchingStock = stocks.find(
      s => s.ProductID === returnedSaleItem?.ProductID || s.ProductCode === returnedSaleItem?.ProductCode
    );
    return matchingStock?.StockEntryID;
  };

  const exportExchangeHistoryToCSV = () => {
    // Log action to audit trail
    const userId = user?.id ? Number(user.id) : undefined;
    apiClient.logAction('Exported Exchange History CSV Report', userId).catch(err => console.error('Audit log failed:', err));
    
    // Get filtered data
    const dataToExport = changeHistory.filter(item => {
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
    });

    if (dataToExport.length === 0) {
      alert('No exchange records to export');
      return;
    }

    const headers = ['Change ID', 'Original Sale ID', 'Item Returned', 'Qty Returned', 'Item Given', 'Qty Given', 'Returned Price', 'Given Price', 'Additional Payment', 'Reason', 'Processed By', 'Date Processed'];
    const rows = dataToExport.map(item => [
      item.ChangeID,
      item.OriginalSaleID,
      item.ItemReturnedName || 'N/A',
      item.QtyReturned,
      item.ItemGiven,
      item.QtyGiven,
      Number(item.ReturnedItemPrice || 0).toFixed(2),
      Number(item.ItemGivenPrice || 0).toFixed(2),
      Number(item.AdditionalPayment || 0).toFixed(2),
      item.Reason,
      item.ProcessedByName || 'N/A',
      new Date(item.DateProcessed).toLocaleString()
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
    link.setAttribute('download', `exchange_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const exportExchangeHistoryToPDF = async () => {
    // Log action to audit trail
    const userId = user?.id ? Number(user.id) : undefined;
    apiClient.logAction('Exported Exchange History PDF Report', userId).catch(err => console.error('Audit log failed:', err));
    
    // Get filtered data
    const dataToExport = changeHistory.filter(item => {
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
    });

    if (dataToExport.length === 0) {
      alert('No exchange records to export');
      return;
    }

    const element = document.createElement('div');
    element.style.padding = '20px';
    element.style.fontFamily = 'Arial, sans-serif';
    element.style.backgroundColor = 'white';
    element.style.color = '#000';
    
    // Build HTML content
    const htmlContent = `
      <h1 style="text-align: center; color: #333; margin-bottom: 10px; font-size: 24px; margin-top: 0;">Exchange History Report</h1>
      <p style="text-align: center; color: #666; margin-bottom: 20px; font-size: 12px;">Generated on: ${new Date().toLocaleString()}</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="border: 1px solid #999; padding: 8px; text-align: left; font-weight: bold;">Change ID</th>
            <th style="border: 1px solid #999; padding: 8px; text-align: left; font-weight: bold;">Sale ID</th>
            <th style="border: 1px solid #999; padding: 8px; text-align: left; font-weight: bold;">Item Returned</th>
            <th style="border: 1px solid #999; padding: 8px; text-align: center; font-weight: bold;">Qty</th>
            <th style="border: 1px solid #999; padding: 8px; text-align: left; font-weight: bold;">Item Given</th>
            <th style="border: 1px solid #999; padding: 8px; text-align: center; font-weight: bold;">Qty</th>
            <th style="border: 1px solid #999; padding: 8px; text-align: right; font-weight: bold;">Price Diff</th>
            <th style="border: 1px solid #999; padding: 8px; text-align: left; font-weight: bold;">Processed By</th>
            <th style="border: 1px solid #999; padding: 8px; text-align: left; font-weight: bold;">Date</th>
          </tr>
        </thead>
        <tbody>
          ${dataToExport.map(item => `
            <tr>
              <td style="border: 1px solid #999; padding: 8px;">${item.ChangeID}</td>
              <td style="border: 1px solid #999; padding: 8px;">#${String(item.OriginalSaleID).padStart(6, '0')}</td>
              <td style="border: 1px solid #999; padding: 8px;">${item.ItemReturnedName || 'N/A'}</td>
              <td style="border: 1px solid #999; padding: 8px; text-align: center;">${item.QtyReturned}</td>
              <td style="border: 1px solid #999; padding: 8px;">${item.ItemGiven}</td>
              <td style="border: 1px solid #999; padding: 8px; text-align: center;">${item.QtyGiven}</td>
              <td style="border: 1px solid #999; padding: 8px; text-align: right;">${currencySymbol}${Number(item.PriceDifference || 0).toFixed(2)}</td>
              <td style="border: 1px solid #999; padding: 8px;">${item.ProcessedByName || 'N/A'}</td>
              <td style="border: 1px solid #999; padding: 8px;">${new Date(item.DateProcessed).toLocaleString()}</td>
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
        filename: `exchange_history_${new Date().toISOString().split('T')[0]}.pdf`,
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
    reasonRef.current = '';
    setReason('');
    setAdditionalPayment(0);
    setManualAdditionalPayment('');
    setReplacementProductSearch('');
    setPriceValidationError(null);
    setModalError(null);
    setShowAddProductModal(false);
    setAddProductItemIdx(null);
    setAddProductSearch('');
    setAddProductQty('1');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center md:hidden">
        <div>
          <h2 className={`text-2xl font-extrabold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Item Exchange</h2>
          <p className={`font-medium ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Process customer item returns and exchanges</p>
        </div>
      </div>

      {error && (
        <div className={`border p-4 rounded-xl flex items-start gap-3 ${isDarkTheme ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-200'}`}>
          <AlertTriangle size={20} className={`mt-0.5 ${isDarkTheme ? 'text-red-400' : 'text-red-600'}`} />
          <div>
            <h3 className={`font-bold ${isDarkTheme ? 'text-red-400' : 'text-red-800'}`}>Error</h3>
            <p className={`text-sm ${isDarkTheme ? 'text-red-300' : 'text-red-700'}`}>{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className={`border p-4 rounded-xl flex items-start gap-3 ${isDarkTheme ? 'bg-green-900/30 border-green-700' : 'bg-green-50 border-green-200'}`}>
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
          onClick={() => setActiveTab('process')}
          className={`px-4 py-3 font-semibold text-sm transition-colors ${
            activeTab === 'process'
              ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] -mb-0.5'
              : isDarkTheme ? 'text-gray-400 hover:text-gray-300' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Process Exchange
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-3 font-semibold text-sm transition-colors ${
            activeTab === 'history'
              ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] -mb-0.5'
              : isDarkTheme ? 'text-gray-400 hover:text-gray-300' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Exchange History ({changeHistory.length})
        </button>
      </div>

      {activeTab === 'process' && (
        <>
          {/* Sales List */}
          <div className={`rounded-xl shadow-sm border overflow-hidden ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`}>
            <div className={`p-4 border-b ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'border-gray-100 bg-gray-50'}`}>
              <div className="relative">
                <Search className={`absolute left-3 top-2.5 w-5 h-5 ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type="text"
                  placeholder="Search by Sale ID or date..."
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-[var(--color-primary)] ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-200'}`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {isLoading ? (
              <div className={`p-8 text-center ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>
                <Loader size={24} className={`animate-spin mx-auto mb-2 ${isDarkTheme ? 'text-gray-400' : 'text-slate-400'}`} />
                <p>Loading sales...</p>
              </div>
            ) : filteredSales.length > 0 ? (
              <>
                <div className={`p-3 flex items-center justify-between gap-3 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>
                  <div className="text-sm">Showing <strong>{filteredSales.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> to <strong>{Math.min(currentPage * pageSize, filteredSales.length)}</strong> of <strong>{filteredSales.length}</strong> sales</div>

                  <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full border shadow-sm ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className={`px-3 py-1 rounded-full text-sm font-medium disabled:opacity-40 transition-colors ${isDarkTheme ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-gray-50'}`}
                        title="First page"
                      >First</button>

                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className={`px-3 py-1 rounded-full text-sm font-medium disabled:opacity-40 transition-colors ${isDarkTheme ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-gray-50'}`}
                        title="Previous page"
                      >Prev</button>

                      <div className={`px-3 text-sm font-medium ${isDarkTheme ? 'text-gray-200' : 'text-slate-700'}`} aria-hidden>{currentPage} of {totalPages}</div>

                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className={`px-3 py-1 rounded-full text-sm font-medium disabled:opacity-40 transition-colors ${isDarkTheme ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-gray-50'}`}
                        title="Next page"
                      >Next</button>

                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className={`px-3 py-1 rounded-full text-sm font-medium disabled:opacity-40 transition-colors ${isDarkTheme ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-gray-50'}`}
                        title="Last page"
                      >Last</button>
                    </div>

                    <div className={`flex items-center gap-2 px-3 py-1 rounded border ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                      <label className={`text-xs ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Rows</label>
                      <div className="relative">
                        <select
                          value={pageSize}
                          onChange={(e) => setPageSize(parseInt(e.target.value, 10) || 10)}
                          className={`appearance-none pr-6 pl-2 py-0.5 text-sm bg-transparent focus:outline-none ${isDarkTheme ? 'text-white' : 'text-slate-700'}`}
                          title="Rows per page"
                        >
                          <option value={10} className={isDarkTheme ? 'bg-gray-800 text-white' : ''}>10</option>
                          <option value={20} className={isDarkTheme ? 'bg-gray-800 text-white' : ''}>20</option>
                          <option value={50} className={isDarkTheme ? 'bg-gray-800 text-white' : ''}>50</option>
                          <option value={100} className={isDarkTheme ? 'bg-gray-800 text-white' : ''}>100</option>
                        </select>
                        <svg className={`absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
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
                            <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Sale ID</th>
                            <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Date</th>
                            <th className={`px-4 py-3 text-right text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Amount</th>
                            <th className={`px-4 py-3 text-center text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Items</th>
                            <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Action</th>
                          </tr>
                        </thead>
                      </table>
                    </div>
                    <div className={`flex-1 overflow-y-auto overflow-x-auto custom-scrollbar ${isDarkTheme ? 'divide-gray-700' : ''}`}>
                      <table className="w-full" style={{ tableLayout: 'fixed' }}>
                        <tbody className={`divide-y ${isDarkTheme ? 'divide-gray-700' : 'divide-gray-100'}`}>
                          {paginatedSales.map((sale, _idx) => (
                            <tr key={`${sale.SaleID}-${(currentPage-1)*pageSize+_idx}`} className={`${isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                              <td className={`px-4 py-3 font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>#INV-{String(sale.SaleID).padStart(6, '0')}</td>
                              <td className={`px-4 py-3 text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>
                                {formatDateTime(getSaleDate(sale))}
                              </td>
                              <td className={`px-4 py-3 text-right font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                                ₱{(sale.FinalAmount || sale.TotalAmount ? parseFloat(String(sale.FinalAmount || sale.TotalAmount)).toFixed(2) : '0.00')}
                              </td>
                              <td className={`px-4 py-3 text-center text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{sale.ItemCount || 0}</td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => {
                                    setSelectedSale(sale);
                                    setShowProcessModal(true);
                                    fetchSaleItems(sale.SaleID);
                                  }}
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 font-semibold text-xs rounded-lg transition-colors ${isDarkTheme ? 'bg-blue-900/30 text-blue-300 border border-blue-700 hover:bg-blue-900/50' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
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
                    {paginatedSales.map((sale, _idx) => (
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
                              <p className={`text-xs font-semibold ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Items</p>
                              <p className={`text-lg font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{sale.ItemCount || 0}</p>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedSale(sale);
                            setShowProcessModal(true);
                            fetchSaleItems(sale.SaleID);
                          }}
                          className={`w-full py-2.5 font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 ${isDarkTheme ? 'bg-blue-900/30 text-blue-300 hover:bg-blue-900/50' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                        >
                          <Plus size={16} /> Select
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className={`p-8 text-center ${isDarkTheme ? 'text-gray-300' : ''}`}>
                <p className={`font-semibold ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>No sales found</p>
                <p className={`text-sm mt-2 ${isDarkTheme ? 'text-gray-400' : 'text-slate-400'}`}>Process a sale first to enable exchanges</p>
              </div>
            )}
          </div>

          {/* Use memoized ProcessModal component to prevent unnecessary re-renders */}
          {showProcessModal && (
            <ProcessModal
              selectedSale={selectedSale}
              actionType={actionType}
              saleItems={saleItems}
              selectedStockItems={selectedStockItems}
              itemQuantities={itemQuantities}
              selectedReplacementProduct={selectedReplacementProduct}
              replacementQuantity={replacementQuantity}
              multipleReplacements={multipleReplacements}
              stocks={stocks}
              reason={reasonRef.current}
              replacementProductSearch={replacementProductSearch}
              priceValidationError={priceValidationError}
              isSubmitting={isSubmitting}
              currencySymbol={currencySymbol}
              modalError={modalError}
              additionalPayment={additionalPayment}
              manualAdditionalPayment={manualAdditionalPayment}
              modalState={modalState}
              onSelectStock={handleSelectStock}
              onQuantityChange={handleQuantityChange}
              onReasonChange={handleReasonChange}
              onReplacementProductChange={handleReplacementProductChange}
              onReplacementProductSearch={setReplacementProductSearch}
              onProcessTransaction={handleProcessTransaction}
              onReset={resetModal}
              onItemQuantitiesChange={setItemQuantities}
              onManualAdditionalPaymentChange={setManualAdditionalPayment}
              onShowAddProductModal={setShowAddProductModal}
              onSetAddProductItemIdx={setAddProductItemIdx}
              onSetAddProductSearch={setAddProductSearch}
              onSetAddProductQty={setAddProductQty}
              onSetMultipleReplacements={setMultipleReplacements}
              onEditAdditionalProductQty={handleEditAdditionalProductQty}
              onReplacementQuantityChange={(itemIdx, qty) => {
                const m = new Map(replacementQuantity);
                m.set(itemIdx, qty);
                setReplacementQuantity(m);
              }}
            />
          )}
        </>
      )}

      {activeTab === 'history' && (
        <div className={`rounded-xl shadow-sm border overflow-hidden ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`}>
          <div className={`p-4 border-b space-y-4 ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'border-gray-100 bg-gray-50'}`}>
            {/* Search and Date Filter Row */}
            <div className="flex flex-col md:flex-row gap-3 md:items-end">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className={`absolute left-3 top-2.5 w-5 h-5 ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type="text"
                  placeholder="Search exchanges..."
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-[var(--color-primary)] ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-200'}`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Date Filters - Desktop */}
              <div className="hidden md:flex gap-2 items-end">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>From Date</label>
                  <input
                    type="date"
                    className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-200'}`}
                    value={historyFilter.startDate}
                    onChange={(e) => setHistoryFilter({ ...historyFilter, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>To Date</label>
                  <input
                    type="date"
                    className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-200'}`}
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
                      onClick={exportExchangeHistoryToCSV}
                      className={`w-full text-left px-4 py-2.5 hover:opacity-90 flex items-center gap-2 font-semibold text-sm ${isDarkTheme ? 'text-gray-200 hover:bg-gray-700' : 'text-[var(--color-text)] hover:bg-[var(--color-light)]'}`}
                    >
                      <FileText size={16} />
                      Export to CSV
                    </button>
                    <button 
                      onClick={exportExchangeHistoryToPDF}
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
                    className={`px-4 py-2.5 text-sm font-semibold rounded-lg hover:shadow-sm transition-all flex items-center gap-2 border ${isDarkTheme ? 'text-gray-300 bg-gray-700 border-gray-600 hover:bg-gray-600' : 'text-[var(--color-text)] bg-white border-[var(--color-border)] hover:bg-[var(--color-light)]'}`}
                  >
                    <X size={16} />
                    Clear Filters
                  </button>
              </div>
            </div>

            {/* Date Filters - Mobile */}
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
                    onClick={exportExchangeHistoryToCSV}
                    className={`w-full text-left px-4 py-2.5 hover:opacity-90 flex items-center gap-2 font-semibold text-sm ${isDarkTheme ? 'text-gray-200 hover:bg-gray-700' : 'text-[var(--color-text)] hover:bg-[var(--color-light)]'}`}
                  >
                    <FileText size={16} />
                    Export to CSV
                  </button>
                  <button 
                    onClick={exportExchangeHistoryToPDF}
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
                className={`px-4 py-2.5 text-sm font-semibold rounded-lg hover:shadow-sm transition-all flex items-center gap-2 border ${isDarkTheme ? 'text-gray-300 bg-gray-700 border-gray-600 hover:bg-gray-600' : 'text-[var(--color-text)] bg-white border-[var(--color-border)] hover:bg-[var(--color-light)]'}`}
              >
                <X size={16} />
                Clear Filters
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className={`p-8 text-center ${isDarkTheme ? 'text-gray-400' : ''}`}>
              <Loader size={24} className={`animate-spin mx-auto mb-2 ${isDarkTheme ? 'text-gray-400' : 'text-slate-400'}`} />
              <p className={isDarkTheme ? 'text-gray-400' : 'text-slate-600'}>Loading exchange history...</p>
            </div>
          ) : filteredHistory.length > 0 ? (
            <>
              {/* Desktop View */}
              <div className="hidden md:block">
                <div className={`p-3 flex items-center justify-between gap-3 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>
                  <div className="text-sm">Showing <strong>{historyFilteredByDate.length === 0 ? 0 : (historyCurrentPage - 1) * historyPageSize + 1}</strong> to <strong>{Math.min(historyCurrentPage * historyPageSize, historyFilteredByDate.length)}</strong> of <strong>{historyFilteredByDate.length}</strong> exchanges</div>

                  <div className="flex items-center gap-3">
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
                          <option value={50} className={isDarkTheme ? 'bg-gray-800 text-white' : ''}>50</option>
                        </select>
                        <svg className={`absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    </div>
                  </div>
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ tableLayout: 'fixed' }}>
                    <thead className={`border-b sticky top-0 ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-100'}`}>
                      <tr>
                        <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Change ID</th>
                        <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Sale ID</th>
                        <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Returned Item</th>
                        <th className={`px-4 py-3 text-center text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Qty</th>
                        <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Given Item</th>
                        <th className={`px-4 py-3 text-center text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Qty</th>
                        <th className={`px-4 py-3 text-right text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Returned Value</th>
                        <th className={`px-4 py-3 text-right text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Given Value</th>
                        <th className={`px-4 py-3 text-right text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Payment</th>
                        <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {historyPaginated.map((item) => (
                            <tr key={item.ChangeID} className={isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                              <td className={`px-4 py-3 font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>#{item.ChangeID}</td>
                              <td className={`px-4 py-3 text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>#{item.OriginalSaleID}</td>
                              <td className={`px-4 py-3 text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{item.ItemReturnedName || 'N/A'}</td>
                              <td className={`px-4 py-3 text-center text-sm font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{item.QtyReturned}</td>
                              <td className={`px-4 py-3 text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{item.ItemGiven}</td>
                              <td className={`px-4 py-3 text-center text-sm font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{item.QtyGiven}</td>
                              <td className={`px-4 py-3 text-right text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{currencySymbol}{formatPrice(item.ReturnedItemPrice)}</td>
                              <td className={`px-4 py-3 text-right text-sm ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>{currencySymbol}{formatPrice(item.ItemGivenPrice)}</td>
                              <td className={`px-4 py-3 text-right text-sm font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>{item.AdditionalPayment && parseFloat(String(item.AdditionalPayment)) > 0 ? `+${currencySymbol}${formatPrice(item.AdditionalPayment)}` : '-'}</td>
                              <td className={`px-4 py-3 text-sm ${isDarkTheme ? 'text-gray-400' : 'text-slate-600'}`}>
                                {formatDateTime(item.DateProcessed)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              {/* Mobile View */}
              <div className="md:hidden">
                <div className="max-h-[600px] overflow-y-auto custom-scrollbar divide-y divide-gray-100">
                  {historyPaginated.map((item) => (
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

      {/* Add Additional Product Modal */}
      {showAddProductModal && addProductItemIdx !== null && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[120] backdrop-blur-sm p-4">
          <div className={`rounded-xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-200 ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className={`text-lg font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Add Additional Product</h3>
              <button
                onClick={() => setShowAddProductModal(false)}
                className={`transition-colors ${isDarkTheme ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className={`absolute left-3 top-2.5 w-4 h-4 ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type="text"
                  placeholder="Search products..."
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 text-sm ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-200'}`}
                  value={addProductSearch}
                  onChange={(e) => setAddProductSearch(e.target.value)}
                />
              </div>

              {/* Products List */}
              <div className={`max-h-[300px] overflow-y-auto border rounded-lg ${isDarkTheme ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200'}`}>
                {stocks
                  .filter(stock => {
                    // Don't show expired items
                    if (stock.ExpirationDate) {
                      const expirationDate = new Date(stock.ExpirationDate);
                      expirationDate.setHours(23, 59, 59, 999);
                      if (expirationDate < new Date()) return false;
                    }
                    // Filter by search
                    const searchLower = addProductSearch.toLowerCase();
                    return (
                      (stock.Particulars || '').toLowerCase().includes(searchLower) ||
                      (stock.ProductCode || '').toLowerCase().includes(searchLower)
                    );
                  })
                  .map((stock) => (
                    <button
                      key={stock.StockEntryID}
                      onClick={() => handleAddAdditionalProduct(addProductItemIdx, stock.ProductCode || `ENTRY-${stock.StockEntryID}`)}
                      className={`w-full text-left px-4 py-3 border-b transition-colors last:border-0 ${isDarkTheme ? 'hover:bg-gray-600 border-gray-600' : 'hover:bg-gray-100 border-gray-100'}`}
                    >
                      <p className={`text-sm font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-700'}`}>
                        {stock.Particulars || 'Unknown'}
                      </p>
                      <p className={`text-xs ${isDarkTheme ? 'text-gray-300' : 'text-slate-500'}`}>
                        ₱{(stock.SellingPrice || stock.UnitPrice || 0).toFixed(2)} | Stock: {stock.Quantity}
                      </p>
                    </button>
                  ))}
                {stocks.filter(stock => {
                  if (stock.ExpirationDate) {
                    const expirationDate = new Date(stock.ExpirationDate);
                    expirationDate.setHours(23, 59, 59, 999);
                    if (expirationDate < new Date()) return false;
                  }
                  const searchLower = addProductSearch.toLowerCase();
                  return (
                    (stock.Particulars || '').toLowerCase().includes(searchLower) ||
                    (stock.ProductCode || '').toLowerCase().includes(searchLower)
                  );
                }).length === 0 && (
                  <div className={`p-6 text-center text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
                    {addProductSearch ? `No products found matching "${addProductSearch}"` : 'Start typing to search...'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ChangeItem;