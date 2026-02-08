import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import Sidebar from './Sidebar';
import SearchBar from './SearchBar';
import { Menu, Bell, AlertTriangle, AlertCircle, X, ChevronDown, Package, Check, RefreshCw, LogOut, User as UserIcon, ShoppingCart } from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import apiClient from '../lib/apiClient';
import { useInactivityTimer } from '../lib/useInactivityTimer';
import InactivityModal from './InactivityModal';
import AutoBackupScheduler from './AutoBackupScheduler';
import ConnectivityIndicator from './ConnectivityIndicator';

interface NotificationDropdownProps {
  positionClass?: string;
  onClose: () => void;
  isDarkTheme?: boolean;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ positionClass = "right-0", onClose, isDarkTheme = false }) => {
  const { notifications, markAllAsRead, markAllAsUnread, markNotificationAsRead } = usePharmacy();
  const navigate = useNavigate();
  
  // Use ref to cache formatted times - only update when notification ID/CreatedAt actually changes
  const formattedTimesCacheRef = useRef<Record<number, string>>({});
  const notificationKeysRef = useRef<string>('');

  const totalAlerts = notifications.length;
  // Ensure IsRead comparison is always numeric to handle both string and number types
  const unreadCount = notifications.filter(n => parseInt(n.IsRead, 10) === 0).length;

  // Helper to determine notification type icon and color
  const getNotificationStyle = (type: string) => {
    switch (type) {
      case 'expired':
        return { bgColor: 'bg-red-100', iconColor: 'text-red-600', badgeBg: 'bg-red-500', icon: AlertCircle };
      case 'low_stock':
        return { bgColor: 'bg-orange-100', iconColor: 'text-orange-600', badgeBg: 'bg-orange-500', icon: AlertTriangle };
      case 'no_stock':
        return { bgColor: 'bg-red-100', iconColor: 'text-red-600', badgeBg: 'bg-red-500', icon: AlertCircle };
      default:
        return { bgColor: 'bg-blue-100', iconColor: 'text-blue-600', badgeBg: 'bg-blue-500', icon: AlertCircle };
    }
  };

  // Helper to extract details from message
  const parseNotificationMessage = (message: string, type: string) => {
    // Format: "⚠️ TYPE: ItemName (CODE) - Details"
    const match = message.match(/([^:]+):\s*(.+?)\s*\((.+?)\)\s*-\s*(.+)/);
    if (match) {
      return {
        itemName: match[2],
        code: match[3],
        details: match[4]
      };
    }
    return { itemName: '', code: '', details: message };
  };

  // Create stable formatted times - only update when ID/CreatedAt actually changes, not IsRead
  const formatNotificationTime = React.useMemo(() => {
    // Create a key based only on IDs and CreatedAt (not IsRead)
    const newKey = notifications
      .map(n => `${n.NotificationID}:${n.CreatedAt}`)
      .join('|');
    
    // Only recalculate if the key has changed
    if (notificationKeysRef.current !== newKey) {
      notificationKeysRef.current = newKey;
      formattedTimesCacheRef.current = {};
      
      notifications.forEach(notif => {
        formattedTimesCacheRef.current[notif.NotificationID] = new Date(notif.CreatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      });
    }
    
    return formattedTimesCacheRef.current;
  }, [notifications.map(n => `${n.NotificationID}:${n.CreatedAt}`).join('|')]);

  return (
    <div className={`absolute ${positionClass} top-full mt-2 w-80 md:w-96 rounded-xl shadow-2xl border z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
      <div className={`p-4 border-b flex flex-col gap-3 ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
        <div className="flex justify-between items-center">
          <h3 className={`font-bold flex items-center gap-2 ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>
            Notifications
            {unreadCount > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{unreadCount} new</span>}
          </h3>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className={`${isDarkTheme ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
        {totalAlerts > 0 && (
          <div className="flex gap-2 text-xs">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                markAllAsRead();
              }}
              className={`flex items-center gap-1 font-semibold transition-colors ${isDarkTheme ? 'text-gray-300 hover:text-white' : 'text-slate-600 hover:text-[var(--color-text)]'}`}
              type="button"
            >
              <Check size={12} /> Mark all read
            </button>
            <span className={isDarkTheme ? 'text-gray-600' : 'text-gray-300'}>|</span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                markAllAsUnread();
              }}
              className={`flex items-center gap-1 font-semibold transition-colors ${isDarkTheme ? 'text-gray-300 hover:text-white' : 'text-slate-600 hover:text-[var(--color-text)]'}`}
              type="button"
            >
              <RefreshCw size={12} /> Mark all unread
            </button>
          </div>
        )}
      </div>
      
      <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
        {totalAlerts === 0 ? (
          <div className={`p-8 text-center flex flex-col items-center ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
            <Bell size={32} className="mb-2 opacity-20" />
            <p>No new notifications</p>
            <p className="text-xs">You're all caught up!</p>
          </div>
        ) : (
          <div className={`divide-y ${isDarkTheme ? 'divide-gray-700' : 'divide-gray-50'}`}>
            {notifications.map(notif => {
              const isRead = notif.IsRead === 1;
              const style = getNotificationStyle(notif.NotificationType);
              const parsed = parseNotificationMessage(notif.Message, notif.NotificationType);
              const Icon = style.icon;
              const navPath = notif.NotificationType === 'low_stock' ? '/stock' : '/products';
              
              return (
                <div 
                  key={notif.NotificationID} 
                  onClick={() => {
                    navigate(navPath);
                    onClose();
                  }}
                  className={`p-4 transition-colors flex gap-3 group cursor-pointer ${isDarkTheme ? (isRead ? 'bg-gray-700 hover:bg-gray-600 opacity-70' : 'bg-gray-800 hover:bg-gray-750') : (isRead ? 'bg-gray-50 hover:bg-gray-100 opacity-70' : 'bg-white hover:bg-gray-50')}`}
                >
                  <div className={`mt-1 p-2 rounded-full h-fit shrink-0 ${isDarkTheme ? (isRead ? 'bg-gray-600' : style.bgColor) : (isRead ? 'bg-gray-200' : style.bgColor)}`}>
                    <Icon size={16} className={`${isDarkTheme ? (isRead ? 'text-gray-400' : style.iconColor) : (isRead ? 'text-gray-500' : style.iconColor)}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <p className={`text-sm font-bold transition-colors ${isDarkTheme ? (isRead ? 'text-gray-400' : 'text-white') : (isRead ? 'text-gray-600' : 'text-gray-800')}`}>
                          {parsed.itemName}
                        </p>
                        {parsed.code && (
                          <p className={`text-xs font-mono ${isDarkTheme ? 'text-gray-500' : 'text-gray-500'}`}>{parsed.code}</p>
                        )}
                      </div>
                      {!isRead && <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{backgroundColor: style.badgeBg.replace('bg-', '')}}></span>}
                    </div>
                    <p className={`text-xs font-medium mt-1 ${isDarkTheme ? (isRead ? 'text-gray-400' : style.iconColor) : (isRead ? 'text-gray-500' : style.iconColor)}`}>
                      {parsed.details}
                    </p>
                    <p className={`text-[10px] mt-1 ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`}>
                      {formatNotificationTime[notif.NotificationID]}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      <div className={`p-3 border-t ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            navigate('/products');
            onClose();
          }}
          type="button"
          className={`w-full py-2.5 font-bold rounded-lg shadow-sm transition-colors text-xs uppercase tracking-wide flex items-center justify-center gap-2 ${isDarkTheme ? 'bg-[var(--color-primary)] hover:bg-[var(--color-hover)] text-white' : 'bg-[var(--color-primary)] hover:bg-[var(--color-hover)] text-slate-900'}`}
        >
          <Package size={16} /> View All
        </button>
      </div>
    </div>
  );
};

const MemoizedNotificationDropdown = React.memo(NotificationDropdown);

const Layout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  
  // Admin PIN Verification States
  const [showPinVerification, setShowPinVerification] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinVerified, setPinVerified] = useState<boolean>(() => {
    // Check if PIN was already verified in this session
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('admin_pin_verified');
      const timestamp = localStorage.getItem('admin_pin_verified_time');
      
      // PIN verification expires after 30 minutes of inactivity
      if (stored === 'true' && timestamp) {
        const elapsed = Date.now() - parseInt(timestamp);
        if (elapsed < 30 * 60 * 1000) { // 30 minutes
          return true;
        } else {
          // Clear expired verification
          localStorage.removeItem('admin_pin_verified');
          localStorage.removeItem('admin_pin_verified_time');
          return false;
        }
      }
    }
    return false;
  });
  const [pinAttempts, setPinAttempts] = useState(0);
  
  const { 
    notifications,
    user, 
    pharmacyName, 
    logout,
    isSidebarCollapsed,
    setSidebarCollapsed,
    fetchNotifications // <-- Import fetchNotifications
  } = usePharmacy();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Use separate refs for containers
  const mobileDropdownRef = useRef<HTMLDivElement>(null);
  const desktopDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === 'admin';
  // Ensure IsRead comparison is always numeric to handle both string and number types
  const unreadCount = notifications.filter(n => parseInt(n.IsRead, 10) === 0).length;
  
  // Periodically refresh notifications
  useEffect(() => {
    if (fetchNotifications) {
      // Don't call fetchNotifications here - it's already called on mount in PharmacyContext
      // Just set up periodic refresh every 10 minutes
      const interval = setInterval(() => {
        fetchNotifications();
      }, 10 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, []);

  // Show PIN verification on mount for admin users
  useEffect(() => {
    if (isAdmin && !pinVerified) {
      setShowPinVerification(true);
    }
  }, [isAdmin, pinVerified]);

  // Handle PIN verification
  const handleVerifyAdminPin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminPin || adminPin.length !== 6) {
      setPinError('PIN must be 6 digits');
      return;
    }

    setPinLoading(true);
    setPinError('');

    fetch('http://localhost/stmargareth/api/auth/verify-admin-pin.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: user?.username,
        pin: adminPin
      })
    })
      .then(response => {
        if (!response.ok) {
          console.error('HTTP Error:', response.status, response.statusText);
        }
        return response.json();
      })
      .then(data => {
        console.log('PIN verification response:', data);
        if (data.success) {
          // Save PIN verification to localStorage with timestamp
          localStorage.setItem('admin_pin_verified', 'true');
          localStorage.setItem('admin_pin_verified_time', Date.now().toString());
          
          setPinVerified(true);
          setShowPinVerification(false);
          setAdminPin('');
          setPinError('');
          setPinAttempts(0);
        } else {
          const newAttempts = pinAttempts + 1;
          setPinAttempts(newAttempts);
          
          if (newAttempts >= 3) {
            setPinError('Maximum attempts exceeded. Logging out...');
            setTimeout(() => {
              logout();
              navigate('/login');
            }, 1500);
          } else {
            const remainingAttempts = 3 - newAttempts;
            setPinError(`Invalid PIN. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`);
          }
        }
        setPinLoading(false);
      })
      .catch((err: any) => {
        console.error('PIN verification error:', err);
        setPinError('Error connecting to server: ' + (err.message || 'Unknown error'));
        setPinLoading(false);
      });
  };

  // Handle logout if PIN verification is cancelled
  const handleCancelPinVerification = () => {
    navigate('/login');
  };

  // Load user's profile image
  useEffect(() => {
    const loadProfileImage = async () => {
      if (user?.id) {
        try {
          console.log('Loading profile image for user ID:', user.id);
          const response = await apiClient.getUsers();
          console.log('Users response:', response);
          
          if (response.success && response.data) {
            const currentUser = response.data.find((u: any) => u.UserID === user.id);
            console.log('Found user:', currentUser);
            
            if (currentUser?.ProfileImage) {
              console.log('Setting profile image, length:', currentUser.ProfileImage.length);
              setProfileImage(currentUser.ProfileImage);
            } else {
              console.log('No profile image found for user');
              setProfileImage(null);
            }
          }
        } catch (error) {
          console.error('Failed to load profile image:', error);
        }
      }
    };
    loadProfileImage();
  }, [user?.id]);

  // Refetch profile image when navigating away from account page
  useEffect(() => {
    if (location.pathname !== '/account') {
      const loadProfileImage = async () => {
        if (user?.id) {
          try {
            const response = await apiClient.getUsers();
            if (response.success && response.data) {
              const currentUser = response.data.find((u: any) => u.UserID === user.id);
              if (currentUser?.ProfileImage) {
                setProfileImage(currentUser.ProfileImage);
              }
            }
          } catch (error) {
            console.error('Failed to reload profile image:', error);
          }
        }
      };
      loadProfileImage();
    }
  }, [location.pathname, user?.id]);

  // Helper to determine page title
  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case '/dashboard': return 'Dashboard';
      case '/products': return 'Product Management';
      case '/pos': return 'Point of Sale';
      case '/stock': return 'Stock Management';
      case '/stock/change-item': return 'Item Exchange';
      case '/stock/damaged-items': return 'Damaged Items';
      case '/inventory': return 'Inventory Monitoring';
      case '/reports': return 'Reports & Analytics';
      case '/audit': return 'Audit & Logs';
      case '/settings': return 'System Settings';
      case '/account': return 'Account Management';
      default: return 'St. Margareth Pharmacy';
    }
  };

  const pageTitle = getPageTitle(location.pathname);

  const handleLogout = useCallback(() => {
    // Clear PIN verification on logout
    localStorage.removeItem('admin_pin_verified');
    localStorage.removeItem('admin_pin_verified_time');
    
    logout();
    navigate('/login');
  }, [logout, navigate]);

  const { showPrompt, countdown, resetTimer } = useInactivityTimer(handleLogout, 120000, 10000); // 2 minutes, 10s prompt

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Notifications check
      const isMobileClick = mobileDropdownRef.current && mobileDropdownRef.current.contains(target);
      const isDesktopClick = desktopDropdownRef.current && desktopDropdownRef.current.contains(target);

      // User Menu check
      const isUserMenuClick = userMenuRef.current && userMenuRef.current.contains(target);

      // If click is outside notification dropdowns
      if (showNotifications && !isMobileClick && !isDesktopClick) {
        setShowNotifications(false);
      }

      // If click is outside user menu
      if (showUserMenu && !isUserMenuClick) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications, showUserMenu]);

  const { themeColor } = usePharmacy();
  const isDarkTheme = themeColor === 'black';

  return (
    <div className={`min-h-screen flex flex-col md:flex-row ${isDarkTheme ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Connectivity Indicator - Shows on all pages */}
      <ConnectivityIndicator />
      
      {/* PIN Verification Overlay - Shows for all admin pages */}
      {showPinVerification && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40 rounded-lg" />
      )}
      
      {/* Mobile Menu Overlay - Closes sidebar on click */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <Sidebar 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />

      {/* Main Content Wrapper */}
      <div className={`flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300 ease-in-out ${showPinVerification && isAdmin ? 'pointer-events-none opacity-50' : ''}`}>
        {/* Mobile Header */}
        <div className={`md:hidden flex flex-col gap-3 p-4 sticky top-0 z-30 shadow-sm ${isDarkTheme ? 'bg-gray-800 text-white' : 'bg-[var(--color-primary)] text-slate-900'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className={`p-2 -ml-2 rounded-lg transition-colors ${isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-white/20'}`}
              aria-label="Menu"
            >
              <Menu size={24} />
            </button>
            <span className="font-extrabold text-lg line-clamp-1">{pharmacyName}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <NavLink 
              to="/pos"
              className={`px-3 py-1.5 font-bold rounded-lg hover:opacity-90 transition-colors flex items-center gap-1 text-xs ${isDarkTheme ? 'bg-white text-slate-900' : 'bg-slate-900 text-[var(--color-primary)]'}`}
            >
              <ShoppingCart size={16} />
              POS
            </NavLink>

            <div className="relative" ref={mobileDropdownRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Notifications"
              >
                <Bell size={24} />
                {unreadCount > 0 && (
                  <span className={`absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white/30`}>
                    {unreadCount}
                  </span>
                )}
              </button>
              {/* Mobile Dropdown */}
              {showNotifications && <MemoizedNotificationDropdown positionClass="-right-14" onClose={() => setShowNotifications(false)} isDarkTheme={isDarkTheme} />}
            </div>
          </div>
        </div>
        
        {/* Mobile Search Bar */}
        <SearchBar isMobile className="w-full" isDarkTheme={isDarkTheme} />
      </div>


        
        {/* Desktop Header */}
        <header className={`hidden md:flex items-center justify-between px-8 py-5 backdrop-blur-sm sticky top-0 z-20 shadow-sm ${isDarkTheme ? 'bg-gray-800/80 border-b border-gray-700' : 'bg-white/80'}`}>
           <div className="flex items-center gap-4 flex-1">
              {isSidebarCollapsed && (
                <button
                  onClick={() => setSidebarCollapsed(false)}
                  className={`p-2 rounded-lg ${isDarkTheme ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}
                  aria-label="Open sidebar"
                >
                  <Menu size={24} />
                </button>
              )}
              <h1 className={`text-3xl font-extrabold tracking-tight ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{pageTitle}</h1>
           </div>

           <div className="flex items-center gap-4">
             {/* Desktop Search Bar */}
             <SearchBar className="w-64 flex-shrink-0" isDarkTheme={isDarkTheme} />

             <NavLink 
               to="/pos"
               className={`px-4 py-2 font-bold rounded-lg hover:opacity-90 transition-colors flex items-center gap-2 text-sm whitespace-nowrap ${isDarkTheme ? 'bg-white text-slate-900' : 'bg-slate-900 text-[var(--color-primary)]'}`}
             >
               <ShoppingCart size={18} />
               Point of Sale
             </NavLink>

             <div className="relative" ref={desktopDropdownRef}>
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`relative p-2 rounded-xl transition-all ${isDarkTheme ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-500 hover:bg-[var(--color-light)] hover:text-[var(--color-text)]'}`}
                >
                  <Bell size={22} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">
                        {unreadCount > 9 ? '!' : unreadCount}
                    </span>
                  )}
                </button>
                {/* Desktop Dropdown */}
                {showNotifications && <MemoizedNotificationDropdown positionClass="right-0" onClose={() => setShowNotifications(false)} isDarkTheme={isDarkTheme} />}
             </div>
             
             {/* User Profile Dropdown */}
             <div className="relative" ref={userMenuRef}>
               <button 
                 onClick={() => setShowUserMenu(!showUserMenu)}
                 className={`flex items-center gap-3 pl-6 p-2 rounded-xl transition-colors cursor-pointer ${isDarkTheme ? 'border-l border-gray-700 hover:bg-gray-700' : 'border-l border-gray-200 hover:bg-gray-50'}`}
               >
                  <div className="text-right hidden lg:block">
                     <p className={`text-sm font-bold leading-none ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>{user?.username || 'Admin User'}</p>
                     <p className={`text-xs mt-1 uppercase font-semibold tracking-wider ${isDarkTheme ? 'text-gray-400' : 'text-gray-400'}`}>{user?.role === 'admin' ? 'Administrator' : 'Staff Member'}</p>
                  </div>
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold border-2 border-[var(--color-light)] overflow-hidden`}>
                     {profileImage ? (
                       <img src={profileImage} alt={user?.username} className="w-full h-full object-cover" />
                     ) : (
                       <div className="w-full h-full bg-[var(--color-border)] text-[var(--color-text)] flex items-center justify-center">
                         {user?.username?.charAt(0).toUpperCase() || 'A'}
                       </div>
                     )}
                  </div>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
               </button>

               {/* User Menu Dropdown */}
               {showUserMenu && (
                 <div className={`absolute right-0 top-full mt-2 w-48 rounded-xl shadow-xl border overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right z-50 ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                    <div className="p-2">
                       <button 
                         onClick={() => {
                           navigate('/account');
                           setShowUserMenu(false);
                         }}
                         className={`w-full text-left px-4 py-2.5 text-sm font-bold rounded-lg flex items-center gap-2 transition-colors ${isDarkTheme ? 'text-gray-200 hover:bg-gray-700' : 'text-slate-700 hover:bg-gray-50'}`}
                       >
                         <UserIcon size={16} className={isDarkTheme ? 'text-gray-400' : 'text-slate-400'} /> My Account
                       </button>
                       <div className={`my-1 border-t ${isDarkTheme ? 'border-gray-700' : 'border-gray-100'}`}></div>
                       <button 
                         onClick={handleLogout}
                         className={`w-full text-left px-4 py-2.5 text-sm font-bold rounded-lg flex items-center gap-2 transition-colors ${isDarkTheme ? 'text-red-400 hover:bg-gray-700' : 'text-red-600 hover:bg-red-50'}`}
                       >
                         <LogOut size={16} /> Log Out
                       </button>
                    </div>
                 </div>
               )}
             </div>
           </div>
        </header>

        <main className={`flex-1 px-3 md:px-4 lg:px-6 py-3 md:py-4 overflow-y-auto ${isDarkTheme ? 'bg-gray-900' : 'bg-gray-50'}`}>
          <Outlet />
        </main>
      </div>

      {/* Admin PIN Verification Modal - Shows for all admin pages */}
      {showPinVerification && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className={`rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200 overflow-hidden border ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-hover)] px-6 py-4 text-white">
              <h3 className="font-extrabold text-lg">Admin PIN Verification Required</h3>
              <p className="text-sm opacity-90 mt-1">Verify your identity to access the system</p>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleVerifyAdminPin} className="space-y-4">
                <div className={`border p-4 rounded-lg text-sm font-medium flex items-start gap-3 ${isDarkTheme ? 'bg-amber-900/20 border-amber-700 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                  <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>For security, admin access requires PIN verification</span>
                </div>

                <div>
                  <label className={`block text-sm font-bold mb-2 ${isDarkTheme ? 'text-gray-200' : 'text-slate-700'}`}>Enter 6-Digit PIN</label>
                  <input 
                    type="password" 
                    required
                    disabled={pinAttempts >= 3}
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value.slice(0, 6))}
                    className={`w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none text-center text-3xl tracking-widest font-mono ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 disabled:bg-gray-600 disabled:cursor-not-allowed' : 'bg-white border-gray-300 text-slate-900 placeholder-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed'}`}
                    placeholder="●●●●●●"
                    maxLength={6}
                    inputMode="numeric"
                    autoFocus
                  />
                </div>

                {pinError && (
                  <div className={`px-4 py-3 rounded-lg text-sm border font-medium ${
                    pinAttempts >= 3 
                      ? isDarkTheme ? 'bg-red-900/30 text-red-300 border-red-700' : 'bg-red-100 text-red-700 border-red-300'
                      : isDarkTheme ? 'bg-red-900/20 text-red-300 border-red-700' : 'bg-red-50 text-red-600 border-red-200'
                  }`}>
                    {pinError}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={pinLoading || adminPin.length !== 6 || pinAttempts >= 3}
                  className={`w-full py-3 font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isDarkTheme ? 'bg-blue-900 text-white hover:bg-blue-800' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                >
                  {pinLoading ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Verifying...
                    </>
                  ) : (
                    'Verify PIN'
                  )}
                </button>

                <button 
                  type="button"
                  onClick={handleCancelPinVerification}
                  className={`w-full text-sm font-bold py-2 rounded transition-colors ${isDarkTheme ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                  Logout
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <InactivityModal 
        isOpen={showPrompt}
        countdown={countdown}
        onStay={resetTimer}
        onLogout={handleLogout}
      />
      
      <AutoBackupScheduler />
    </div>
  );
};

export default Layout;

