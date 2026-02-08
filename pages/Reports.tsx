
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Download, Calendar, AlertCircle, Loader } from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import apiClient from '../lib/apiClient';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';

const Reports: React.FC = () => {
  const { currencySymbol, themeColor, fontFamily, user, getRoleBadgeColor } = usePharmacy();
  const isDarkTheme = themeColor === 'black';
  const [activeTab, setActiveTab] = useState('sales');
  const [salesData, setSalesData] = useState<any[]>([]);
  const [totals, setTotals] = useState({ totalGross: 0, totalDiscount: 0, totalNet: 0, transactionCount: 0 });
  const [lastMonthTotals, setLastMonthTotals] = useState({ totalGross: 0, totalDiscount: 0, totalNet: 0, transactionCount: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => {
    // Initialize with current month's first day for monthly reports
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const lastDay = new Date(year, month, 0).getDate();
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(lastDay).padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  });
  const [reportType, setReportType] = useState('monthly');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [currentMonthTotal, setCurrentMonthTotal] = useState(0);
  const [currentMonthTransactions, setCurrentMonthTransactions] = useState(0);
  const [currentMonthNet, setCurrentMonthNet] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [lastMonthInventoryValue, setLastMonthInventoryValue] = useState(0);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Theme color mapping - matches Settings.tsx color options
  const themeColorClass = {
    'amber': 'bg-amber-400 border-amber-400',
    'teal': 'bg-teal-400 border-teal-400',
    'blue': 'bg-blue-400 border-blue-400',
    'rose': 'bg-rose-400 border-rose-400',
    'emerald': 'bg-emerald-400 border-emerald-400',
    'black': 'bg-gray-800 border-gray-800'
  }[themeColor] || 'bg-amber-400 border-amber-400';

  // Theme color mapping for badges - matches Settings.tsx color options
  const badgeThemeClass = {
    'amber': 'bg-amber-400 border-amber-400 text-white',
    'teal': 'bg-teal-400 border-teal-400 text-white',
    'blue': 'bg-blue-400 border-blue-400 text-white',
    'rose': 'bg-rose-400 border-rose-400 text-white',
    'emerald': 'bg-emerald-400 border-emerald-400 text-white',
    'black': 'bg-gray-800 border-gray-800 text-white'
  }[themeColor] || 'bg-amber-400 border-amber-400 text-white';

  // Theme color hex mapping for charts - matches Settings.tsx color options
  const themeColorHex = {
    'amber': '#fbbf24',
    'teal': '#2dd4bf',
    'blue': '#60a5fa',
    'rose': '#fb7185',
    'emerald': '#34d399',
    'black': '#1f2937'
  }[themeColor] || '#fbbf24';

  function getToday() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getLast7Days() {
    const today = new Date();
    const last7 = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const year = last7.getFullYear();
    const month = String(last7.getMonth() + 1).padStart(2, '0');
    const day = String(last7.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  useEffect(() => {
    const today = new Date();
    console.log('Effect running - today:', today.toISOString());
    
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    console.log('Setting currentMonth to:', currentMonthStr);
    setCurrentMonth(currentMonthStr);
    
    const sevenDaysAgo = getLast7Days();
    const todayStr = getToday();
    
    // Determine which dates to use based on reportType
    let startDt: string;
    let endDt: string;
    
    if (reportType === 'monthly') {
      // Set to current month (1st to last day of month)
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
      startDt = firstDay;
      endDt = lastDay;
      console.log('Monthly report - fetching from', startDt, 'to', endDt);
    } else if (reportType === 'weekly') {
      // Set to last 7 days
      startDt = sevenDaysAgo;
      endDt = todayStr;
      console.log('Weekly report - fetching from', startDt, 'to', endDt);
    } else {
      // Default to last 7 days
      startDt = sevenDaysAgo;
      endDt = todayStr;
    }
    
    setStartDate(startDt);
    setEndDate(endDt);
    console.log('About to call fetchSalesData with:', startDt, endDt);
    fetchSalesData(startDt, endDt);
    
    // Fetch inventory value first, then use it to calculate last month
    fetchInventoryValue();
    
    // Fetch last month data for comparison (full previous month)
    const lastMonthDate = new Date();
    lastMonthDate.setDate(1); // Go to the first of the current month
    lastMonthDate.setDate(0); // Go to the last day of the previous month
    const prevMonthLastDay = lastMonthDate.toISOString().split('T')[0];
    const prevMonthFirstDay = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1).toISOString().split('T')[0];
    fetchLastMonthData(prevMonthFirstDay, prevMonthLastDay);
    
    // Fetch current month data for reports
    fetchCurrentMonthData();
    
    // Fetch audit logs only if user is Admin
    if (user?.role === 'admin') {
      fetchAuditLogs();
    }
  }, [user?.role, reportType]);

  // Fetch last month's inventory value when current inventory is calculated
  useEffect(() => {
    if (inventoryValue > 0) {
      fetchLastMonthInventoryValue();
    }
  }, [inventoryValue]);

  const fetchSalesData = async (start?: string, end?: string) => {
    const actualStart = start || startDate;
    const actualEnd = end || endDate;
    console.log('fetchSalesData called with - start param:', start, 'end param:', end);
    console.log('fetchSalesData using - actualStart:', actualStart, 'actualEnd:', actualEnd);
    console.log('fetchSalesData state - startDate:', startDate, 'endDate:', endDate);
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.getSalesSummary(actualStart, actualEnd);
      console.log('API response for dates', actualStart, 'to', actualEnd, ':', response);
      if (response.success) {
        setSalesData(response.data || []);
        setTotals(response.totals || { totalGross: 0, totalDiscount: 0, totalNet: 0, transactionCount: 0 });
      } else {
        setError(response.message || 'Failed to load sales data');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading sales data');
      console.error('Sales data fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLastMonthData = async (start: string, end: string) => {
    try {
      const response = await apiClient.getSalesSummary(start, end);
      if (response.success) {
        setLastMonthTotals(response.totals || { totalGross: 0, totalDiscount: 0, totalNet: 0, transactionCount: 0 });
      }
    } catch (err: any) {
      console.error('Last month data fetch error:', err);
    }
  };

  const fetchCurrentMonthData = async () => {
    try {
      // Get first day of current month through last day of month (not just today)
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
      
      console.log('fetchCurrentMonthData - fetching from', firstDay, 'to', lastDay);
      const response = await apiClient.getSalesSummary(firstDay, lastDay);
      if (response.success) {
        const total = response.totals?.totalGross || 0;
        const net = response.totals?.totalNet || 0;
        const transactions = response.totals?.transactionCount || 0;
        console.log('fetchCurrentMonthData response:', { total, net, transactions });
        setCurrentMonthTotal(total);
        setCurrentMonthNet(net);
        setCurrentMonthTransactions(transactions);
      }
    } catch (err: any) {
      console.error('Current month data fetch error:', err);
    }
  };

  const fetchAuditLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const response = await apiClient.getAuditLogs();
      if (response.success && response.data) {
        setAuditLogs(response.data);
      } else {
        setAuditLogs([]);
      }
    } catch (err: any) {
      console.error('Audit logs fetch error:', err);
      setAuditLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const fetchInventoryValue = async () => {
    try {
      const response = await apiClient.getStockEntries();
      if (response.success && response.data) {
        const totalValue = response.data.reduce((sum: number, stock: any) => {
          const quantity = stock.Quantity || 0;
          const price = stock.SellingPrice || 0;
          return sum + (quantity * price);
        }, 0);
        setInventoryValue(totalValue);
      }
    } catch (err: any) {
      console.error('Inventory value fetch error:', err);
    }
  };

  const fetchLastMonthInventoryValue = async () => {
    try {
      // Since we don't have historical inventory snapshots, we'll use last month's sales to estimate
      // inventory movement. We calculate: current inventory + last month sales = approx last month inventory
      const lastMonthDate = new Date();
      lastMonthDate.setDate(1);
      lastMonthDate.setDate(0);
      const prevMonthLastDay = lastMonthDate.toISOString().split('T')[0];
      const prevMonthFirstDay = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1).toISOString().split('T')[0];
      
      // Get last month's sales value
      const lastMonthSalesResponse = await apiClient.getSalesSummary(prevMonthFirstDay, prevMonthLastDay);
      if (lastMonthSalesResponse.success) {
        // Estimate last month's inventory = current inventory + last month sales
        // (This assumes no restocking, which is a simplification)
        const estimatedLastMonthValue = inventoryValue + (lastMonthSalesResponse.totals?.totalGross || 0);
        setLastMonthInventoryValue(estimatedLastMonthValue);
      }
    } catch (err: any) {
      console.error('Last month inventory value fetch error:', err);
    }
  };

  const handleDateFilter = async () => {
    await fetchSalesData(startDate, endDate);
  };

  // Format number with thousand separators
  const formatNumberWithCommas = (num: number): string => {
    return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Calculate percentage change
  const calculatePercentageChange = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const inventoryChange = calculatePercentageChange(inventoryValue, lastMonthInventoryValue);
  const grossSalesChange = calculatePercentageChange(totals.totalGross, lastMonthTotals.totalGross);
  const netSalesChange = calculatePercentageChange(totals.totalNet, lastMonthTotals.totalNet);
  const currentMonthSalesChange = calculatePercentageChange(currentMonthTotal, lastMonthTotals.totalGross);
  const currentMonthNetChange = calculatePercentageChange(currentMonthNet, lastMonthTotals.totalNet);

  // Export functions
  const exportReportToPDF = async (reportTitle: string, fileName: string, reportData?: any) => {
    if (!reportData) {
      alert('No data to export');
      return;
    }

    const element = document.createElement('div');
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    element.style.top = '-9999px';
    element.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif; background: white; width: 1200px;">
        <h1 style="text-align: center; color: #333; margin-bottom: 10px; font-size: 24px;">${reportTitle}</h1>
        <p style="text-align: center; color: #666; margin-bottom: 20px; font-size: 12px;">Generated on: ${new Date().toLocaleString()}</p>
        <div>${reportData || ''}</div>
      </div>
    `;

    document.body.appendChild(element);

    try {
      await new Promise(resolve => setTimeout(resolve, 100));

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

      const imgWidth = 297;
      const pageHeight = 210;
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
      }

      const pdfBlob = pdf.output('blob');
      const finalFileName = `${fileName}_${new Date().toISOString().split('T')[0]}.pdf`;
      saveAs(pdfBlob, finalFileName);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      if (document.body.contains(element)) {
        document.body.removeChild(element);
      }
    }
  };

  const exportSalesReport = async () => {
    // Log action to audit trail
    console.log('Attempting to log: Exported Sales Report PDF');
    const userId = user?.id ? Number(user.id) : undefined;
    apiClient.logAction('Exported Sales Report PDF', userId)
      .then(response => {
        console.log('Export audit log response:', response);
      })
      .catch(err => {
        console.error('Audit log failed:', err);
      });
    
    // Fetch fresh data for the current date range
    try {
      setIsLoading(true);
      const response = await apiClient.getSalesSummary(startDate, endDate);
      
      if (!response.success || !response.totals) {
        alert('Unable to fetch fresh data for PDF export');
        return;
      }

      const freshTotals = response.totals;
      const symbol = currencySymbol;
      const reportData = `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
          <tr style="background-color: #f5f5f5;">
            <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">Total Gross Sales</td>
            <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${symbol}${formatNumberWithCommas(freshTotals.totalGross)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">Total Discount</td>
            <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${symbol}${formatNumberWithCommas(freshTotals.totalDiscount)}</td>
          </tr>
          <tr style="background-color: #f5f5f5;">
            <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">Total Net Sales</td>
            <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${symbol}${formatNumberWithCommas(freshTotals.totalNet)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">Transaction Count</td>
            <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${freshTotals.transactionCount}</td>
          </tr>
          <tr style="background-color: #e8f5e9;">
            <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">Average Transaction Value</td>
            <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${symbol}${formatNumberWithCommas(freshTotals.totalGross / (freshTotals.transactionCount || 1))}</td>
          </tr>
        </table>
        <p style="color: #666; font-size: 11px;">Period: ${startDate} to ${endDate}</p>
      `;
      await exportReportToPDF('Sales Report', 'sales_report', reportData);
    } catch (error) {
      console.error('Error fetching data for PDF export:', error);
      alert('Error fetching data for PDF export');
    } finally {
      setIsLoading(false);
    }
  };

  const exportInventoryStockReport = async () => {
    // Log action to audit trail
    const userId = user?.id ? Number(user.id) : undefined;
    apiClient.logAction('Exported Inventory Stock Report PDF', userId).catch(err => console.error('Audit log failed:', err));
    
    try {
      setIsLoading(true);
      const response = await apiClient.getStockEntries();
      
      if (!response.success || !response.data) {
        alert('Unable to fetch inventory data for PDF export');
        return;
      }

      // Calculate inventory metrics
      const totalValue = response.data.reduce((sum: number, stock: any) => {
        const quantity = stock.Quantity || 0;
        const price = stock.SellingPrice || 0;
        return sum + (quantity * price);
      }, 0);

      const symbol = currencySymbol;
      const reportData = `
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Metric</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">Total Inventory Value</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${symbol}${formatNumberWithCommas(totalValue)}</td>
            </tr>
            <tr style="background-color: #fef2f2;">
              <td style="border: 1px solid #ddd; padding: 8px;">Total Stock Items</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${response.data.length}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">Report Generated</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${new Date().toLocaleDateString()}</td>
            </tr>
          </tbody>
        </table>
      `;
      await exportReportToPDF('Stock Level Report', 'stock_level_report', reportData);
    } catch (error) {
      console.error('Error fetching inventory data for PDF export:', error);
      alert('Error fetching inventory data for PDF export');
    } finally {
      setIsLoading(false);
    }
  };

  const exportExpiryReport = async () => {
    // Log action to audit trail
    const userId = user?.id ? Number(user.id) : undefined;
    apiClient.logAction('Exported Expiry Date Report PDF', userId).catch(err => console.error('Audit log failed:', err));
    
    try {
      setIsLoading(true);
      
      // Fetch expired products from notifications API
      const expiredResponse = await apiClient.getExpiredProducts();
      const expiredProducts = (expiredResponse.data || []);

      // Fetch all stock to get expiring soon items (within 12 days)
      const stockResponse = await apiClient.getStockEntries();
      const allStock = stockResponse.data || [];
      
      const today = new Date();
      const twelveAhead = new Date(today.getTime() + 12 * 24 * 60 * 60 * 1000);
      
      const expiringProducts = allStock.filter((stock: any) => {
        if (!stock.ExpirationDate) return false;
        const expDate = new Date(stock.ExpirationDate);
        return expDate > today && expDate <= twelveAhead && stock.Quantity > 0;
      });

      // Combine and deduplicate
      const allExpiringItems = [...expiredProducts, ...expiringProducts];

      const reportData = `
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Product Name</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">Product Code</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">Expiration Date</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">Quantity</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${allExpiringItems.length > 0 ? allExpiringItems.slice(0, 30).map((item: any) => {
              const expDate = new Date(item.ExpirationDate || item.expiredDate);
              const isExpired = expDate < today;
              const status = isExpired ? 'EXPIRED' : 'EXPIRING SOON';
              return `
              <tr style="${isExpired ? 'background-color: #fef2f2;' : 'background-color: #fff3cd;'}">
                <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${item.Particulars || item.ProductName || 'N/A'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-family: monospace;">${item.ProductCode || 'N/A'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${expDate.toLocaleDateString()}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">${item.Quantity || 0}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: ${isExpired ? '#d32f2f' : '#ff9800'}; font-weight: bold;">${status}</td>
              </tr>
            `}).join('') : '<tr><td colspan="5" style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #999;">No expiring products found</td></tr>'}
          </tbody>
        </table>
        <p style="color: #666; font-size: 11px; margin-top: 10px;">Report generated on: ${new Date().toLocaleDateString()}</p>
      `;
      await exportReportToPDF('Expiry Date Report', 'expiry_report', reportData);
    } catch (error) {
      console.error('Error fetching expiry data for PDF export:', error);
      alert('Error fetching expiry data for PDF export');
    } finally {
      setIsLoading(false);
    }
  };

  const exportLowStockReport = async () => {
    // Log action to audit trail
    const userId = user?.id ? Number(user.id) : undefined;
    apiClient.logAction('Exported Low Stock Alert Report PDF', userId).catch(err => console.error('Audit log failed:', err));
    
    try {
      setIsLoading(true);
      const response = await apiClient.getStockEntries();
      
      if (!response.success || !response.data) {
        alert('Unable to fetch inventory data for PDF export');
        return;
      }

      // Filter products with low stock (1-10 units, matching notification logic)
      const lowStockThreshold = 10;
      const lowStockProducts = response.data.filter((stock: any) => {
        const qty = stock.Quantity || 0;
        return qty >= 1 && qty <= lowStockThreshold;
      });

      const reportData = `
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Product Name</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">Product Code</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">Current Stock</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">Reorder Level</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">Unit Price</th>
            </tr>
          </thead>
          <tbody>
            ${lowStockProducts.length > 0 ? lowStockProducts.slice(0, 30).map((stock: any) => `
              <tr style="background-color: #fff3cd;">
                <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${stock.Particulars || 'N/A'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-family: monospace;">${stock.ProductCode || 'N/A'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #ff9800; font-weight: bold;">${stock.Quantity || 0}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${stock.ReorderLevel || 'N/A'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${stock.SellingPrice ? formatNumberWithCommas(stock.SellingPrice) : 'N/A'}</td>
              </tr>
            `).join('') : '<tr><td colspan="5" style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #999;">No low stock items found</td></tr>'}
          </tbody>
        </table>
        <p style="color: #666; font-size: 11px; margin-top: 10px;">Report generated on: ${new Date().toLocaleDateString()}</p>
      `;
      await exportReportToPDF('Low Stock Alert Report', 'low_stock_report', reportData);
    } catch (error) {
      console.error('Error fetching low stock data for PDF export:', error);
      alert('Error fetching low stock data for PDF export');
    } finally {
      setIsLoading(false);
    }
  };

  const exportFinancialReport = async (reportType: string) => {
    // Log action to audit trail
    const userId = user?.id ? Number(user.id) : undefined;
    apiClient.logAction(`Exported Financial Report PDF: ${reportType}`, userId).catch(err => console.error('Audit log failed:', err));
    
    try {
      setIsLoading(true);
      // Fetch fresh data for the current date range
      const response = await apiClient.getSalesSummary(startDate, endDate);
      
      if (!response.success || !response.totals) {
        alert('Unable to fetch financial data for PDF export');
        return;
      }

      const freshTotals = response.totals;
      const symbol = currencySymbol;
      let fileName = '';
      if (reportType === 'Revenue Analysis') {
        fileName = 'revenue_analysis';
      } else if (reportType === 'Profit & Loss Statement') {
        fileName = 'profit_loss_statement';
      } else if (reportType === 'Cash Flow Report') {
        fileName = 'cash_flow_report';
      } else {
        fileName = reportType.toLowerCase().replace(/\s+/g, '_');
      }
      
      let reportData = '';
      
      if (reportType === 'Revenue Analysis') {
        reportData = `
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
            <tr style="background-color: #f5f5f5;">
              <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">Gross Revenue</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${symbol}${formatNumberWithCommas(freshTotals.totalGross)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">Total Discounts</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${symbol}${formatNumberWithCommas(freshTotals.totalDiscount)}</td>
            </tr>
            <tr style="background-color: #e8f5e9;">
              <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">Net Revenue</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${symbol}${formatNumberWithCommas(freshTotals.totalNet)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">Transaction Count</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${freshTotals.transactionCount}</td>
            </tr>
            <tr style="background-color: #f5f5f5;">
              <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">Average Transaction Value</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${symbol}${formatNumberWithCommas(freshTotals.totalGross / (freshTotals.transactionCount || 1))}</td>
            </tr>
          </table>
          <p style="color: #666; font-size: 11px;">Period: ${startDate} to ${endDate}</p>
        `;
      } else if (reportType === 'Profit & Loss Statement') {
        reportData = `
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
            <tr style="background-color: #f5f5f5;">
              <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">Gross Sales</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${symbol}${formatNumberWithCommas(freshTotals.totalGross)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">Less: Discounts Given</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">-${symbol}${formatNumberWithCommas(freshTotals.totalDiscount)}</td>
            </tr>
            <tr style="background-color: #e8f5e9;">
              <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold; font-size: 13px;">Profit (Net Sales)</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right; font-weight: bold; font-size: 13px;">${symbol}${formatNumberWithCommas(freshTotals.totalNet)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">Profit Margin (%)</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${((freshTotals.totalNet / freshTotals.totalGross) * 100 || 0).toFixed(2)}%</td>
            </tr>
          </table>
          <p style="color: #666; font-size: 11px;">Period: ${startDate} to ${endDate}</p>
        `;
      } else if (reportType === 'Cash Flow Report') {
        reportData = `
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
            <tr style="background-color: #f5f5f5;">
              <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">Cash Inflows (Sales)</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${symbol}${formatNumberWithCommas(freshTotals.totalGross)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">Discounts (Cash Outflows)</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">-${symbol}${formatNumberWithCommas(freshTotals.totalDiscount)}</td>
            </tr>
            <tr style="background-color: #e8f5e9;">
              <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold; font-size: 13px;">Net Cash Flow</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right; font-weight: bold; font-size: 13px;">${symbol}${formatNumberWithCommas(freshTotals.totalNet)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">Total Transactions</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${freshTotals.transactionCount}</td>
            </tr>
          </table>
          <p style="color: #666; font-size: 11px;">Period: ${startDate} to ${endDate}</p>
        `;
      } else {
        reportData = `
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
            <tr style="background-color: #f5f5f5;">
              <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">Revenue</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${symbol}${formatNumberWithCommas(freshTotals.totalGross)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">Discounts</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${symbol}${formatNumberWithCommas(freshTotals.totalDiscount)}</td>
            </tr>
            <tr style="background-color: #f5f5f5;">
              <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">Net Income</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${symbol}${formatNumberWithCommas(freshTotals.totalNet)}</td>
            </tr>
          </table>
          <p style="color: #666; font-size: 11px;">Report Type: ${reportType} | Period: ${startDate} to ${endDate}</p>
        `;
      }
      
      await exportReportToPDF(reportType, fileName, reportData);
    } catch (error) {
      console.error('Error fetching financial data for PDF export:', error);
      alert('Error fetching financial data for PDF export');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`space-y-6 min-h-screen p-4 ${isDarkTheme ? 'bg-gray-900' : 'bg-gray-50'} ${fontFamily}`}>
      {/* Mobile Header */}
      <div className="md:hidden -mt-4 mb-4">
        <h2 className={`text-2xl font-extrabold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Reports & Analytics</h2>
        <p className={`font-medium ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Comprehensive Reporting and Business Insights</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={handleDateFilter} className="ml-auto underline font-bold text-sm">Retry</button>
        </div>
      )}

      {/* Tabs */}
      <div className={`flex gap-1 p-2 rounded-t-lg ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
        <button
          onClick={() => {
            setActiveTab('sales');
            setReportType('monthly');
          }}
          className={`px-4 py-2 font-bold uppercase text-sm transition-colors ${
            activeTab === 'sales'
              ? `${themeColorClass} text-white rounded-lg`
              : 'text-gray-700 hover:text-gray-900'
          }`}
        >
          Sales
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 font-bold uppercase text-sm transition-colors ${
            activeTab === 'reports'
              ? `${themeColorClass} text-white rounded-lg`
              : 'text-gray-700 hover:text-gray-900'
          }`}
        >
          Reports
        </button>
        {user?.role === 'admin' && (
          <button
            onClick={() => setActiveTab('activities')}
            className={`px-4 py-2 font-bold uppercase text-sm transition-colors ${
              activeTab === 'activities'
                ? `${themeColorClass} text-white rounded-lg`
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            Activities
          </button>
        )}
      </div>

      {/* Sales Tab Content */}
      {activeTab === 'sales' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Inventory Valuation Card */}
          <div className={`p-4 rounded-lg shadow-sm ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className={`font-bold text-lg mb-1 ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>INVENTORY VALUATION OVERVIEW THIS MONTH</h3>
            <div className={`border-b-4 ${themeColorClass.split(' ')[1]} mb-4 pb-2`}></div>
            
            {isLoading ? (
              <div className="h-72 flex items-center justify-center">
                <Loader className="animate-spin text-[var(--color-primary)]" size={32} />
              </div>
            ) : (
              <div className="h-72 w-full" style={{minWidth: 0}}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkTheme ? '#374151' : 'var(--color-border)'} />
                    <XAxis 
                      dataKey="SaleDate" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: isDarkTheme ? '#e5e7eb' : '#64748b', fontSize: 9}} 
                      interval={0}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: isDarkTheme ? '#e5e7eb' : '#64748b'}} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: isDarkTheme ? '#1f2937' : '#ffffff', color: isDarkTheme ? '#ffffff' : '#000000' }}
                      cursor={{ stroke: 'var(--color-primary)', strokeWidth: 2, strokeDasharray: '3 3' }}
                      formatter={(value: number) => [`${currencySymbol}${value.toFixed(2)}`, 'Inventory Value']}
                    />
                    <Line type="monotone" dataKey="GrossSales" stroke={isDarkTheme ? '#ffffff' : 'var(--color-primary)'} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Inventory Summary Cards */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <p className={`text-sm font-bold uppercase tracking-wide ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Total Inventory Value</p>
                <p className={`text-2xl font-extrabold mt-2 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{currencySymbol}{formatNumberWithCommas(inventoryValue)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-red-500 uppercase tracking-wide">Total Loss</p>
                <p className="text-2xl font-extrabold text-red-600 mt-2">{currencySymbol}{formatNumberWithCommas(totals.totalDiscount)}</p>
              </div>
            </div>
            <p className={`text-xs mt-4 ${inventoryChange >= 0 ? 'text-teal-600' : 'text-red-600'}`}>{inventoryChange >= 0 ? '↑' : '↓'} {Math.abs(inventoryChange).toFixed(1)}% vs last month</p>
          </div>

          {/* Sales Valuation Card */}
          <div className={`p-4 rounded-lg shadow-sm ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className={`font-bold text-lg mb-1 ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>SALES VALUATION OVERVIEW THIS MONTH</h3>
            <div className={`border-b-4 ${themeColorClass.split(' ')[1]} mb-4 pb-2`}></div>
            
            {isLoading ? (
              <div className="h-72 flex items-center justify-center">
                <Loader className="animate-spin text-[var(--color-primary)]" size={32} />
              </div>
            ) : (
              <div className="h-72 w-full" style={{minWidth: 0}}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkTheme ? '#374151' : 'var(--color-border)'} />
                    <XAxis 
                      dataKey="SaleDate" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: isDarkTheme ? '#e5e7eb' : '#64748b', fontSize: 9}} 
                      interval={0}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: isDarkTheme ? '#e5e7eb' : '#64748b'}} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: isDarkTheme ? '#1f2937' : '#ffffff', color: isDarkTheme ? '#ffffff' : '#000000' }}
                      cursor={{ stroke: 'var(--color-primary)', strokeWidth: 2, strokeDasharray: '3 3' }}
                      formatter={(value: number) => [`${currencySymbol}${value.toFixed(2)}`, 'Sales']}
                    />
                    <Line type="monotone" dataKey="NetSales" stroke={isDarkTheme ? '#ffffff' : 'var(--color-primary)'} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Sales Summary Cards */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <p className={`text-sm font-bold uppercase tracking-wide ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Total Sales</p>
                <p className={`text-2xl font-extrabold mt-2 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{currencySymbol}{formatNumberWithCommas(currentMonthTotal)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-green-500 uppercase tracking-wide">Total Profit</p>
                <p className="text-2xl font-extrabold text-green-600 mt-2">{currencySymbol}{formatNumberWithCommas(currentMonthNet)}</p>
              </div>
            </div>
            <p className={`text-xs mt-4 ${currentMonthNetChange >= 0 ? 'text-teal-600' : 'text-red-600'}`}>{currentMonthNetChange >= 0 ? '↑' : '↓'} {Math.abs(currentMonthNetChange).toFixed(1)}% vs last month</p>
          </div>
        </div>
      )}

      {/* Reports Tab Content */}
      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Sales Reports */}
          <div className={`p-4 rounded-lg shadow-sm ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className={`font-bold text-lg mb-1 ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Sales Reports</h3>
            <div className={`border-b-4 ${themeColorClass.split(' ')[1]} mb-4 pb-2`}></div>
            
            <div className="space-y-4">
              <div className={`border ${themeColorClass.split(' ')[1]} rounded-lg p-2`}>
                <select 
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className={`w-full px-3 py-2 border ${themeColorClass.split(' ')[1]} rounded-lg font-medium focus:outline-none ${isDarkTheme ? 'bg-gray-700 text-white' : 'bg-white text-gray-700'}`}>
                  <option value="monthly">Monthly Sales Reports</option>
                  <option value="weekly">Weekly Sales Reports</option>
                </select>
              </div>

              {reportType === 'weekly' && (
                <div className={`flex gap-3 p-3 rounded-lg ${isDarkTheme ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="flex-1">
                    <label className={`text-xs font-semibold uppercase mb-2 block ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Select Week</label>
                    <select 
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        const newEndDate = new Date(new Date(e.target.value).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                        setEndDate(newEndDate);
                        fetchSalesData(e.target.value, newEndDate);
                      }}
                      className={`w-full px-2 py-1 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkTheme ? 'bg-gray-600 text-white border-gray-500' : 'bg-white text-gray-900 border-gray-300'}`}
                    >
                      {(() => {
                        const weeks = [];
                        const currentYear = new Date().getFullYear();
                        
                        // Get selected month from startDate
                        const selectedMonthDate = new Date(startDate);
                        const selectedMonth = selectedMonthDate.getMonth();
                        const selectedYear = selectedMonthDate.getFullYear();
                        
                        const firstDay = new Date(selectedYear, selectedMonth, 1);
                        const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
                        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

                        const calculatedWeeks = new Map<number, { revenue: number; mondayDate: Date }>();
      
                        // Iterate through all days of the month to find all weeks (Dashboard Logic)
                        for (let day = 1; day <= daysInMonth; day++) {
                          const dateObj = new Date(selectedYear, selectedMonth, day);
                          const dayOfWeek = dateObj.getDay();
                          const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                          const mondayOfWeek = new Date(dateObj);
                          mondayOfWeek.setDate(day + mondayOffset);
                          const weekKey = mondayOfWeek.getTime();
                          
                          if (!calculatedWeeks.has(weekKey)) {
                            calculatedWeeks.set(weekKey, { revenue: 0, mondayDate: new Date(mondayOfWeek) });
                          }
                        }

                        const sortedWeeks = Array.from(calculatedWeeks.entries()).sort((a, b) => a[0] - b[0]);

                        sortedWeeks.forEach((entry, index) => {
                          const weekData = entry[1];
                          const weekStartDate = new Date(weekData.mondayDate);
                          const weekEndDate = new Date(weekStartDate);
                          weekEndDate.setDate(weekEndDate.getDate() + 6);
                          
                          // For display, only show days that are in the current month
                          const displayStart = weekStartDate.getMonth() === selectedMonth ? weekStartDate.getDate() : 1;
                          const displayEnd = weekEndDate.getMonth() === selectedMonth ? weekEndDate.getDate() : daysInMonth;
                          
                          // Actual API date range should be full week or clamped to month? 
                          // The original logic used full weeks. Dashboard chart logic groups by week key.
                          // Let's keep the API request using the Monday start date as the value, 
                          // but consistent display label.
                          
                          // NOTE: The previous logic passed the specific start date of the week as the value.
                          // We'll continue to do that, but user wants DASHBOARD style labels.
                          
                          const startStr = weekStartDate.toISOString().split('T')[0];
                          // const endStr = weekEndDate.toISOString().split('T')[0];
                          
                          const isPartialWeek = weekEndDate.getMonth() !== selectedMonth;
                          const weekLabel = isPartialWeek 
                            ? `Week ${index + 1}: ${monthNames[selectedMonth]} ${displayStart}-${displayEnd} (partial week)`
                            : `Week ${index + 1}: ${monthNames[selectedMonth]} ${displayStart}-${displayEnd}`;

                          weeks.push(
                            <option key={startStr} value={startStr}>
                              {weekLabel}
                            </option>
                          );
                        });
                        
                        return weeks;
                      })()}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className={`text-xs font-semibold uppercase mb-2 block ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Select Month</label>
                    <input 
                      type="month"
                      value={`${startDate.slice(0, 7)}`}
                      onChange={(e) => {
                        const [year, month] = e.target.value.split('-');
                        const firstDay = `${year}-${month}-01`;
                        setStartDate(firstDay);
                        const newEndDate = new Date(new Date(firstDay).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                        setEndDate(newEndDate);
                        fetchSalesData(firstDay, newEndDate);
                      }}
                      className={`w-full px-2 py-1 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkTheme ? 'bg-gray-600 text-white border-gray-500' : 'bg-white text-gray-900 border-gray-300'}`}
                    />
                  </div>
                </div>
              )}

              {reportType === 'monthly' && (
                <div className={`space-y-3 p-3 rounded-lg ${isDarkTheme ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div>
                    <label className={`text-xs font-semibold uppercase ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Select Month</label>
                    <input 
                      type="month"
                      value={currentMonth}
                      onChange={(e) => {
                        const [year, month] = e.target.value.split('-');
                        const firstDay = `${year}-${month}-01`;
                        const lastDay = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
                        setCurrentMonth(e.target.value);
                        setStartDate(firstDay);
                        setEndDate(lastDay);
                        fetchSalesData(firstDay, lastDay);
                      }}
                      className={`w-full px-2 py-1 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkTheme ? 'bg-gray-600 text-white border-gray-500' : 'bg-white text-gray-900 border-gray-300'}`}
                    />
                  </div>
                </div>
              )}
              
              <div className="pt-4">
                <p className={`text-sm mb-2 ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
                  {reportType === 'weekly' 
                    ? `Week of ${startDate} to ${endDate}`
                    : `${new Date(startDate.replace(/-/g, '/')).toLocaleString('default', { month: 'long', year: 'numeric' })}`
                  }
                </p>
                <p className={`text-xs mb-2 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>{totals.transactionCount} transactions</p>
                <div className="flex justify-between items-center">
                  <p className={`text-2xl font-extrabold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{currencySymbol}{formatNumberWithCommas(totals.totalGross)}</p>
                  <button onClick={() => exportSalesReport()} className={`font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                    isDarkTheme
                      ? 'bg-white text-slate-900 hover:bg-gray-100'
                      : `${themeColorClass.split(' ')[0]} text-white hover:opacity-90`
                  }`}>
                    <Download size={16} /> PDF
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Inventory Reports */}
          <div className={`p-4 rounded-lg shadow-sm ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className={`font-bold text-lg mb-1 ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Inventory Reports</h3>
            <div className={`border-b-4 ${themeColorClass.split(' ')[1]} mb-4 pb-2`}></div>
            
            <div className="space-y-4">
              <div className={`flex justify-between items-center gap-2 py-3 border-b ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
                <p className={`font-medium min-w-0 break-words ${isDarkTheme ? 'text-gray-200' : 'text-gray-800'}`}>Stock Level Report</p>
                <button onClick={() => exportInventoryStockReport()} className={`font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors flex-shrink-0 whitespace-nowrap ${
                  isDarkTheme
                    ? 'bg-white text-slate-900 hover:bg-gray-100'
                    : `${themeColorClass.split(' ')[0]} text-white hover:opacity-90`
                }`}>
                  <Download size={16} /> PDF
                </button>
              </div>

              <div className={`flex justify-between items-center gap-2 py-3 border-b ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
                <p className={`font-medium min-w-0 break-words ${isDarkTheme ? 'text-gray-200' : 'text-gray-800'}`}>Expiry Date Report</p>
                <button onClick={() => exportExpiryReport()} className={`font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors flex-shrink-0 whitespace-nowrap ${
                  isDarkTheme
                    ? 'bg-white text-slate-900 hover:bg-gray-100'
                    : `${themeColorClass.split(' ')[0]} text-white hover:opacity-90`
                }`}>
                  <Download size={16} /> PDF
                </button>
              </div>

              <div className="flex justify-between items-center gap-2 py-3">
                <p className={`font-medium min-w-0 break-words ${isDarkTheme ? 'text-gray-200' : 'text-gray-800'}`}>Low Stock Alert Report</p>
                <button onClick={() => exportLowStockReport()} className={`font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors flex-shrink-0 whitespace-nowrap ${
                  isDarkTheme
                    ? 'bg-white text-slate-900 hover:bg-gray-100'
                    : `${themeColorClass.split(' ')[0]} text-white hover:opacity-90`
                }`}>
                  <Download size={16} /> PDF
                </button>
              </div>
            </div>
          </div>

          {/* Financial Reports */}
          <div className={`p-4 rounded-lg shadow-sm ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className={`font-bold text-lg mb-1 ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Financial Reports</h3>
            <div className={`border-b-4 ${themeColorClass.split(' ')[1]} mb-4 pb-2`}></div>
            
            <div className="space-y-4">
              <div className={`flex justify-between items-center gap-2 py-3 border-b ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
                <p className={`font-medium min-w-0 break-words ${isDarkTheme ? 'text-gray-200' : 'text-gray-800'}`}>Revenue Analysis</p>
                <button onClick={() => exportFinancialReport('Revenue Analysis')} className={`font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors flex-shrink-0 whitespace-nowrap ${
                  isDarkTheme
                    ? 'bg-white text-slate-900 hover:bg-gray-100'
                    : `${themeColorClass.split(' ')[0]} text-white hover:opacity-90`
                }`}>
                  <Download size={16} /> PDF
                </button>
              </div>

              <div className={`flex justify-between items-center gap-2 py-3 border-b ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
                <p className={`font-medium min-w-0 break-words ${isDarkTheme ? 'text-gray-200' : 'text-gray-800'}`}>Profit & Loss Statement</p>
                <button onClick={() => exportFinancialReport('Profit & Loss Statement')} className={`font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors flex-shrink-0 whitespace-nowrap ${
                  isDarkTheme
                    ? 'bg-white text-slate-900 hover:bg-gray-100'
                    : `${themeColorClass.split(' ')[0]} text-white hover:opacity-90`
                }`}>
                  <Download size={16} /> PDF
                </button>
              </div>

              <div className="flex justify-between items-center gap-2 py-3">
                <p className={`font-medium min-w-0 break-words ${isDarkTheme ? 'text-gray-200' : 'text-gray-800'}`}>Cash Flow Report</p>
                <button onClick={() => exportFinancialReport('Cash Flow Report')} className={`font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors flex-shrink-0 whitespace-nowrap ${
                  isDarkTheme
                    ? 'bg-white text-slate-900 hover:bg-gray-100'
                    : `${themeColorClass.split(' ')[0]} text-white hover:opacity-90`
                }`}>
                  <Download size={16} /> PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activities Tab Content */}
      {activeTab === 'activities' && user?.role === 'admin' && (
        <div className={`p-4 md:p-8 rounded-lg shadow-sm ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
          <h2 className={`text-2xl font-bold mb-2 ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Admin Audit & Logs</h2>
          <div className={`border-b-4 ${themeColorClass.split(' ')[1]} mb-6 pb-2`}></div>
          
          {isLoadingLogs ? (
            <div className="h-96 flex items-center justify-center">
              <Loader className="animate-spin text-[var(--color-primary)]" size={32} />
            </div>
          ) : auditLogs.filter(log => log.username === user?.username).length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">No activities recorded yet</p>
            </div>
          ) : (
            <>
              {/* Mobile View - Cards */}
              <div className="md:hidden" style={{ maxHeight: 600, overflowY: 'auto' }}>
                <div className="space-y-4">
                  {auditLogs.filter(log => log.username === user?.username).map((log, index) => (
                    <div key={index} className={`p-4 rounded-lg border ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold break-words ${
                            log.action.toLowerCase().includes('create') || log.action.toLowerCase().includes('add') 
                              ? isDarkTheme ? 'text-green-400' : 'text-green-700'
                              : log.action.toLowerCase().includes('update') || log.action.toLowerCase().includes('edit')
                              ? isDarkTheme ? 'text-blue-400' : 'text-blue-700'
                              : log.action.toLowerCase().includes('delete') || log.action.toLowerCase().includes('remove')
                              ? isDarkTheme ? 'text-red-400' : 'text-red-700'
                              : log.action.toLowerCase().includes('login') || log.action.toLowerCase().includes('logout')
                              ? isDarkTheme ? 'text-purple-400' : 'text-purple-700'
                              : isDarkTheme ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            {log.action}
                          </p>
                          <p className={`text-xs mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>{new Date(log.timestamp).toLocaleString()}</p>
                        </div>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 bg-white text-slate-800`}>
                          {log.role}
                        </span>
                      </div>
                      <div className={`mt-3 pt-3 border-t ${isDarkTheme ? 'border-gray-600' : 'border-gray-200'}`}>
                        <p className={`text-sm ${isDarkTheme ? 'text-gray-300' : 'text-gray-800'}`}><span className="font-medium">User:</span> {log.username} ({log.fullName})</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Desktop View - Table */}
              <div className={`hidden md:block rounded-lg border shadow-md overflow-hidden ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="overflow-auto" style={{ maxHeight: 600 }}>
                  <table className={`w-full divide-y text-sm table-fixed ${isDarkTheme ? 'divide-gray-700' : 'divide-gray-200'}`}>
                    <thead className={`sticky top-0 z-10 border-b-2 ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'}`}>
                      <tr>
                        <th style={{ width: '20%' }} className={`px-6 py-4 text-left font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Timestamp</th>
                        <th style={{ width: '12%' }} className={`px-6 py-4 text-left font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>User</th>
                        <th style={{ width: '25%' }} className={`px-6 py-4 text-left font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Full Name</th>
                        <th style={{ width: '10%' }} className={`px-6 py-4 text-left font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Role</th>
                        <th style={{ width: '33%' }} className={`px-6 py-4 text-left font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Action</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkTheme ? 'divide-gray-700' : 'divide-gray-100'}`}>
                      {auditLogs.filter(log => log.username === user?.username).map((log, index) => (
                        <tr key={index} className={`transition-colors duration-150 ${isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-blue-50'}`}>
                          <td className={`px-6 py-3 truncate text-xs ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>{new Date(log.timestamp).toLocaleString()}</td>
                          <td className={`px-6 py-3 font-medium truncate ${isDarkTheme ? 'text-gray-200' : 'text-gray-900'}`}>{log.username}</td>
                          <td className={`px-6 py-3 truncate ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>{log.fullName}</td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${isDarkTheme ? 'bg-white text-slate-800' : badgeThemeClass}`}>
                              {log.role}
                            </span>
                          </td>
                          <td className="px-6 py-3 truncate">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold whitespace-normal break-words ${
                              log.action.toLowerCase().includes('create') || log.action.toLowerCase().includes('add') 
                                ? isDarkTheme ? 'text-green-400' : 'text-green-700'
                                : log.action.toLowerCase().includes('update') || log.action.toLowerCase().includes('edit')
                                ? isDarkTheme ? 'text-blue-400' : 'text-blue-700'
                                : log.action.toLowerCase().includes('delete') || log.action.toLowerCase().includes('remove')
                                ? isDarkTheme ? 'text-red-400' : 'text-red-700'
                                : log.action.toLowerCase().includes('login') || log.action.toLowerCase().includes('logout')
                                ? isDarkTheme ? 'text-purple-400' : 'text-purple-700'
                                : isDarkTheme ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Reports;
