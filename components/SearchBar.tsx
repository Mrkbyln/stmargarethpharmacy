import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Package, AlertTriangle, AlertCircle, Pill, TrendingUp } from 'lucide-react';
import apiClient from '../lib/apiClient';
import { useNavigate } from 'react-router-dom';

interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: 'product' | 'inventory' | 'low_stock' | 'expired';
  icon: React.ReactNode;
  bgColor: string;
  onClick: () => void;
}

interface SearchBarProps {
  className?: string;
  isMobile?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ className = '', isMobile = false }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Fetch and filter results based on query
  useEffect(() => {
    if (query.trim().length === 0) {
      setResults([]);
      setShowResults(false);
      return;
    }

    const searchData = async () => {
      setIsLoading(true);
      try {
        const searchResults: SearchResult[] = [];
        const queryLower = query.toLowerCase();
        console.log('🔍 Search started for:', query);

        // Search products
        const productsResponse = await apiClient.getProducts();
        console.log('📦 Products Response:', productsResponse);
        
        if (productsResponse.success && productsResponse.data && Array.isArray(productsResponse.data)) {
          console.log(`Found ${productsResponse.data.length} products`);
          productsResponse.data.forEach((product: any) => {
            // Search through all product fields
            const productName = String(product.Particulars || '').toLowerCase();
            const productCode = String(product.ProductCode || '').toLowerCase();
            const brandName = String(product.BrandName || '').toLowerCase();
            const category = String(product.Category || '').toLowerCase();
            const description = String(product.Description || '').toLowerCase();

            const matchesSearch = 
              productName.includes(queryLower) ||
              productCode.includes(queryLower) ||
              brandName.includes(queryLower) ||
              category.includes(queryLower) ||
              description.includes(queryLower);

            if (matchesSearch) {
              console.log('✅ Match found:', product.Particulars);
              const details = [];
              
              // Add all available details
              if (product.ProductCode) details.push(`Code: ${product.ProductCode}`);
              if (product.BrandName) details.push(`Brand: ${product.BrandName}`);
              if (product.Category) details.push(`Category: ${product.Category}`);
              if (product.SellingPrice) details.push(`Price: ${product.SellingPrice}`);

              searchResults.push({
                id: `product-${product.ProductID}`,
                title: product.Particulars,
                description: details.join(' | '),
                type: 'product',
                icon: <Package size={16} />,
                bgColor: 'bg-blue-50',
                onClick: () => {
                  navigate('/products');
                  setShowResults(false);
                  setQuery('');
                }
              });
            }
          });
        } else {
          console.log('⚠️ Products response not successful or no data:', productsResponse);
        }

        // Search inventory
        const inventoryResponse = await apiClient.getInventory();
        console.log('📋 Inventory Response:', inventoryResponse);
        
        if (inventoryResponse.success && inventoryResponse.data && Array.isArray(inventoryResponse.data)) {
          console.log(`Found ${inventoryResponse.data.length} inventory items`);
          inventoryResponse.data.forEach((item: any) => {
            // Search through inventory fields
            const itemName = String(item.ProductName || '').toLowerCase();
            const itemCode = String(item.ProductCode || '').toLowerCase();
            const brandName = String(item.BrandName || '').toLowerCase();
            const category = String(item.Category || '').toLowerCase();

            const matchesSearch = 
              itemName.includes(queryLower) ||
              itemCode.includes(queryLower) ||
              brandName.includes(queryLower) ||
              category.includes(queryLower);

            // Avoid duplicates - skip if already added as product
            const isDuplicate = searchResults.some(r => r.id.includes(`${item.ProductID}`));
            if (matchesSearch && !isDuplicate) {
              console.log('✅ Inventory match found:', item.ProductName);
              const details = [];
              if (item.ProductCode) details.push(`Code: ${item.ProductCode}`);
              if (item.BrandName) details.push(`Brand: ${item.BrandName}`);
              if (item.Category) details.push(`Category: ${item.Category}`);
              if (item.UnitPrice) details.push(`Price: ${item.UnitPrice}`);
              details.push(`Stock: ${item.CurrentStock || 0}`);

              searchResults.push({
                id: `inventory-${item.ProductID}`,
                title: item.ProductName,
                description: details.join(' | '),
                type: 'inventory',
                icon: <Pill size={16} />,
                bgColor: 'bg-purple-50',
                onClick: () => {
                  navigate('/inventory');
                  setShowResults(false);
                  setQuery('');
                }
              });
            }
          });
        } else {
          console.log('⚠️ Inventory response not successful or no data:', inventoryResponse);
        }

        // Search low stock items
        const lowStockResponse = await apiClient.getLowStockItems();
        console.log('⚠️ Low Stock Response:', lowStockResponse);
        
        if (lowStockResponse.success && lowStockResponse.data && Array.isArray(lowStockResponse.data)) {
          console.log(`Found ${lowStockResponse.data.length} low stock items`);
          lowStockResponse.data.forEach((item: any) => {
            const itemName = String(item.ProductName || '').toLowerCase();
            const itemCode = String(item.ProductCode || '').toLowerCase();
            const brandName = String(item.BrandName || '').toLowerCase();

            const matchesSearch = 
              itemName.includes(queryLower) ||
              itemCode.includes(queryLower) ||
              brandName.includes(queryLower);

            if (matchesSearch && !searchResults.some(r => r.id.includes(`${item.ProductID}`))) {
              console.log('✅ Low stock match found:', item.ProductName);
              const details = [];
              if (item.ProductCode) details.push(`Code: ${item.ProductCode}`);
              if (item.BrandName) details.push(`Brand: ${item.BrandName}`);
              details.push(`⚠️ Low: ${item.CurrentStock || 0} units`);

              searchResults.push({
                id: `lowstock-${item.ProductID}`,
                title: item.ProductName,
                description: details.join(' | '),
                type: 'low_stock',
                icon: <AlertTriangle size={16} />,
                bgColor: 'bg-orange-50',
                onClick: () => {
                  navigate('/stock');
                  setShowResults(false);
                  setQuery('');
                }
              });
            }
          });
        } else {
          console.log('⚠️ Low stock response not successful or no data:', lowStockResponse);
        }

        // Search expired items
        const expiredResponse = await apiClient.getExpiredItems();
        console.log('❌ Expired Items Response:', expiredResponse);
        
        if (expiredResponse.success && expiredResponse.data && Array.isArray(expiredResponse.data)) {
          console.log(`Found ${expiredResponse.data.length} expired items`);
          expiredResponse.data.forEach((item: any) => {
            const itemName = String(item.ProductName || '').toLowerCase();
            const itemCode = String(item.ProductCode || '').toLowerCase();
            const batchNumber = String(item.BatchNumber || '').toLowerCase();
            const expiryDate = String(item.ExpirationDate || '').toLowerCase();
            const brandName = String(item.BrandName || '').toLowerCase();

            const matchesSearch = 
              itemName.includes(queryLower) ||
              itemCode.includes(queryLower) ||
              batchNumber.includes(queryLower) ||
              expiryDate.includes(queryLower) ||
              brandName.includes(queryLower);

            if (matchesSearch && !searchResults.some(r => r.id.includes(`${item.ProductID}`))) {
              console.log('✅ Expired match found:', item.ProductName);
              const details = [];
              if (item.ProductCode) details.push(`Code: ${item.ProductCode}`);
              if (item.BatchNumber) details.push(`Batch: ${item.BatchNumber}`);
              if (item.ExpirationDate) details.push(`Expired: ${item.ExpirationDate}`);
              if (item.BrandName) details.push(`Brand: ${item.BrandName}`);

              searchResults.push({
                id: `expired-${item.ProductID}`,
                title: item.ProductName,
                description: details.join(' | '),
                type: 'expired',
                icon: <AlertCircle size={16} />,
                bgColor: 'bg-red-50',
                onClick: () => {
                  navigate('/products');
                  setShowResults(false);
                  setQuery('');
                }
              });
            }
          });
        } else {
          console.log('⚠️ Expired response not successful or no data:', expiredResponse);
        }

        console.log('📊 Total search results:', searchResults.length);
        setResults(searchResults.slice(0, 15)); // Increased limit to 15 results
        setShowResults(true);
      } catch (error) {
        console.error('❌ Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchData, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, navigate]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getTypeColor = (type: SearchResult['type']) => {
    switch (type) {
      case 'low_stock':
        return 'text-orange-600';
      case 'expired':
        return 'text-red-600';
      case 'inventory':
        return 'text-purple-600';
      default:
        return 'text-blue-600';
    }
  };

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'low_stock':
        return 'Low Stock';
      case 'expired':
        return 'Expired';
      case 'inventory':
        return 'Inventory';
      default:
        return 'Product';
    }
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <div className={`relative flex items-center`}>
        <Search size={18} className="absolute left-3 text-gray-400" />
        <input
          type="text"
          placeholder="Search products, inventory..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length > 0 && setShowResults(true)}
          className={`w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all text-sm ${
            isMobile ? 'bg-white text-slate-900' : 'bg-gray-50 text-gray-900'
          }`}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setShowResults(false);
            }}
            className="absolute right-3 text-gray-400 hover:text-gray-600"
            type="button"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && (
        <div className={`absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 w-full`}>
          {isLoading ? (
            <div className="p-6 flex flex-col items-center justify-center gap-2">
              <svg className="w-5 h-5 animate-spin text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-xs text-gray-500">Searching...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center">
              <Search size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500 text-sm font-medium">No results found</p>
              <p className="text-xs text-gray-400 mt-1">Try searching for a product name or code</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={result.onClick}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-b-0 hover:${result.bgColor} transition-colors flex items-start gap-3 group`}
                  type="button"
                >
                  <div className={`mt-0.5 p-2 rounded-lg ${result.bgColor} ${getTypeColor(result.type)}`}>
                    {result.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm group-hover:text-[var(--color-primary)] transition-colors truncate">
                      {result.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{result.description}</p>
                    <span className={`inline-block text-[10px] font-bold mt-1.5 px-2 py-0.5 rounded ${getTypeColor(result.type)} bg-${result.bgColor}`}>
                      {getTypeLabel(result.type)}
                    </span>
                  </div>
                </button>
              ))}
              {results.length > 0 && (
                <div className="px-4 py-3 bg-gray-50 text-center border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Showing <span className="font-semibold">{results.length}</span> result{results.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
