
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  LogOut, 
  X,
  TrendingUp,
  Warehouse,
  BarChart2,
  FileText,
  Settings,
  User,
  ChevronDown
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { logout, pharmacyName, user, isSidebarCollapsed, setSidebarCollapsed, themeColor } = usePharmacy();
  const navigate = useNavigate();
  const [isStockDropdownOpen, setIsStockDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = user?.role === 'admin';
  const isPharmacyAssistant = user?.role === 'pharmacy_assistant';
  const isDarkTheme = themeColor === 'black';

  const navClasses = ({ isActive }: { isActive: boolean }) => 
    `flex items-center gap-4 px-6 py-3.5 mx-4 rounded-xl transition-all duration-200 font-bold ${
      isActive 
        ? isDarkTheme ? 'bg-gray-100 text-gray-900 shadow-sm' : 'bg-white text-slate-900 shadow-sm' 
        : isDarkTheme ? 'text-gray-200 hover:bg-gray-700/40' : 'text-slate-800 hover:bg-white/40'
    }`;

  // Close sidebar when clicking a link on mobile
  const handleNavClick = () => {
    if (onClose && window.innerWidth < 768) {
      onClose();
    }
  };

  return (
    <>
      {/* Sidebar Container */}
      <div className={`
        fixed md:relative top-0 left-0 h-screen z-50 flex-shrink-0 flex flex-col
        transition-all duration-300 ease-in-out
        bg-[var(--color-primary)] shadow-2xl
        ${isOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72'}
        md:translate-x-0 
        ${isSidebarCollapsed ? 'md:w-0' : 'md:w-72'}
        overflow-hidden
      `}>
       <div className={`w-72 h-full flex flex-col transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}>
         {/* Header / Logo Section */}
          <div className="pt-8 pb-6 px-6 flex flex-col items-center text-center">
            <div className="relative mb-3">
               <div className="w-20 h-20 rounded-full border-4 border-white/30 overflow-hidden bg-white shadow-lg">
                  <img 
                    src="assets/img/main.png"
                    alt={pharmacyName}
                    className="w-full h-full object-cover"
                  />
               </div>
            </div>
            
            <h1 className={`${isDarkTheme ? 'text-white' : 'text-slate-900'} font-extrabold text-xl leading-tight px-2`}>{pharmacyName}</h1>
            
            {/* Mobile close button */}
            <button onClick={onClose} className={`absolute top-4 right-4 md:hidden ${isDarkTheme ? 'text-gray-300 hover:bg-gray-600/50' : 'text-slate-800 hover:bg-black/10'} p-1 rounded-full`}>
              <X size={24} />
            </button>
            {/* Desktop close button */}
            <button 
              onClick={() => setSidebarCollapsed(true)} 
              className={`absolute top-4 right-4 hidden md:block ${isDarkTheme ? 'text-gray-300 hover:bg-gray-600/50' : 'text-slate-800 hover:bg-black/10'} p-1 rounded-full`}
            >
              <X size={24} />
            </button>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto space-y-1 py-4 custom-scrollbar scrollbar-hide">
            <NavLink to="/dashboard" className={navClasses} onClick={handleNavClick}>
              <LayoutDashboard size={22} strokeWidth={2} />
              <span className="flex-1">Dashboard</span>
            </NavLink>
            
            {/* Products, POS, Stock - Admin and Pharmacy Assistant */}
            {(isAdmin || isPharmacyAssistant) && (
              <>
                <NavLink to="/products" className={navClasses} onClick={handleNavClick}>
                  <Package size={22} strokeWidth={2} />
                  <span>Products</span>
                </NavLink>

                {/* Stock with Dropdown */}
                <div>
                  <button
                    onClick={() => setIsStockDropdownOpen(!isStockDropdownOpen)}
                    className={`w-full flex items-center gap-4 px-6 py-3.5 mx-4 rounded-xl transition-all duration-200 font-bold ${isDarkTheme ? 'text-gray-200 hover:bg-gray-700/40' : 'text-slate-800 hover:bg-white/40'}`}
                  >
                    <TrendingUp size={22} strokeWidth={2} />
                    <span className="flex-1 text-left">Stock</span>
                    <ChevronDown 
                      size={20} 
                      strokeWidth={2}
                      className={`transition-transform duration-200 ${isStockDropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Dropdown Items */}
                  {isStockDropdownOpen && (
                    <div className="pl-8 space-y-1">
                      <NavLink 
                        to="/stock" 
                        end
                        className={({ isActive }) => 
                          `flex items-center gap-4 px-6 py-3 mx-4 rounded-xl transition-all duration-200 font-semibold text-sm ${
                            isActive 
                              ? isDarkTheme ? 'bg-gray-100 text-gray-900 shadow-sm' : 'bg-white text-slate-900 shadow-sm' 
                              : isDarkTheme ? 'text-gray-300 hover:bg-gray-700/40' : 'text-slate-700 hover:bg-white/40'
                          }`
                        } 
                        onClick={handleNavClick}
                      >
                        <span>Stock Overview</span>
                      </NavLink>
                      
                      {(isAdmin || isPharmacyAssistant) && (
                        <>
                          <NavLink 
                            to="/stock/change-item" 
                            className={({ isActive }) => 
                              `flex items-center gap-4 px-6 py-3 mx-4 rounded-xl transition-all duration-200 font-semibold text-sm ${
                                isActive 
                                  ? 'bg-white text-slate-900 shadow-sm' 
                                  : 'text-slate-700 hover:bg-white/40'
                              }`
                            } 
                            onClick={handleNavClick}
                          >
                            <span>Change Item</span>
                          </NavLink>

                          <NavLink 
                            to="/stock/damaged-items" 
                            className={({ isActive }) => 
                              `flex items-center gap-4 px-6 py-3 mx-4 rounded-xl transition-all duration-200 font-semibold text-sm ${
                                isActive 
                                  ? 'bg-white text-slate-900 shadow-sm' 
                                  : 'text-slate-700 hover:bg-white/40'
                              }`
                            } 
                            onClick={handleNavClick}
                          >
                            <span>Damaged Items</span>
                          </NavLink>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            <NavLink to="/inventory" className={navClasses} onClick={handleNavClick}>
              <Warehouse size={22} strokeWidth={2} />
              <span>Inventory</span>
            </NavLink>

            <NavLink to="/reports" className={navClasses} onClick={handleNavClick}>
              <BarChart2 size={22} strokeWidth={2} />
              <span>Reports & Analytics</span>
            </NavLink>

            {isAdmin && (
              <>
                <NavLink to="/audit" className={navClasses} onClick={handleNavClick}>
                  <FileText size={22} strokeWidth={2} />
                  <span>Audit & Logs</span>
                </NavLink>

                

                <NavLink to="/settings" className={navClasses} onClick={handleNavClick}>
                  <Settings size={22} strokeWidth={2} />
                  <span>Settings</span>
                </NavLink>
              </>
            )}

             <NavLink to="/account" className={navClasses} onClick={handleNavClick}>
              <User size={22} strokeWidth={2} />
              <span>Account</span>
            </NavLink>
          </div>

          {/* User / Logout */}
          <div className="p-6">
            <button 
              onClick={handleLogout}
              className={`flex items-center gap-3 ${isDarkTheme ? 'text-gray-300 hover:text-red-400' : 'text-slate-800 hover:text-red-600'} transition-colors font-bold text-sm px-2`}
            >
              <LogOut size={20} />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
