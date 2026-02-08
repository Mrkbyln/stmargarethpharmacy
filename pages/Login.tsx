
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { usePharmacy } from '../context/PharmacyContext';
import apiClient from '../lib/apiClient';
import ErrorModal from '../components/ErrorModal';
import { Activity, Lock, User, Loader2, X, Mail, ArrowRight, CheckCircle, Eye, EyeOff, AlertTriangle, Clock } from 'lucide-react';

const Login: React.FC = () => {
  const MAX_ATTEMPTS = 3;
  const LOCKOUT_DURATION_SECONDS = 30;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'pharmacy_assistant' | ''>('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Error Modal States
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalCode, setErrorModalCode] = useState('');
  const [errorModalTitle, setErrorModalTitle] = useState('');
  const [errorModalMessage, setErrorModalMessage] = useState('');
  
  // Login Lockout States
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimeRemaining, setLockTimeRemaining] = useState(0);
  const [isLocalLock, setIsLocalLock] = useState(false);
  
  // Forgot Password States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'code' | 'success'>('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  const { login, fontFamily, pharmacyName, themeColor } = usePharmacy();
  const isDarkTheme = themeColor === 'black';
  const navigate = useNavigate();

  // Initialize lockout state from localStorage on mount
  useEffect(() => {
    const storedLockData = localStorage.getItem('loginLockout');
    if (storedLockData) {
      try {
        const lockData = JSON.parse(storedLockData);
        const now = Date.now();
        const timeElapsed = now - lockData.lockedAt;
        const timeRemaining = Math.max(0, 30000 - timeElapsed); // 30 seconds in milliseconds

        if (timeRemaining > 0) {
          setIsLocked(true);
          setFailedAttempts(lockData.failedAttempts);
          setLockTimeRemaining(Math.ceil(timeRemaining / 1000));
          setError('Too many failed attempts. System locked for 30 seconds.');
        } else {
          // Lockout has expired
          localStorage.removeItem('loginLockout');
          setIsLocked(false);
          setFailedAttempts(0);
        }
      } catch (e) {
        console.error('Error parsing lockout data:', e);
        localStorage.removeItem('loginLockout');
      }
    }
  }, []);

  // AJAX polling to check lockout status from server (syncs across browsers)
  useEffect(() => {
    if (!username) return; // Only poll if username is entered
    
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/auth/check-lockout.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username })
        });
        
        const data = await response.json();
        
        if (data.isLocked) {
          // Account is locked on server
          setIsLocked(true);
          setLockTimeRemaining(data.timeRemaining || 30);
          setError(`Account locked. Please try again in ${data.timeRemaining} second${data.timeRemaining !== 1 ? 's' : ''}.`);
        } else if (isLocked && !isLocalLock) {
          // Lockout has expired on server
          setIsLocked(false);
          setFailedAttempts(0);
          setError('');
          localStorage.removeItem('loginLockout');
        }
      } catch (err) {
        console.error('Error checking lockout status:', err);
      }
    }, 2000); // Poll every 2 seconds
    
    return () => clearInterval(pollInterval);
  }, [username, isLocked]);

  // Lockout timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLocked && lockTimeRemaining > 0) {
      interval = setInterval(() => {
        setLockTimeRemaining(prev => {
          if (prev <= 1) {
            setIsLocked(false);
            setIsLocalLock(false); // Reset local lock flag
            setFailedAttempts(0);
            setError('');
            localStorage.removeItem('loginLockout');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isLocked, lockTimeRemaining]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check if account is locked
    if (isLocked) {
      setErrorModalCode('auth001');
      setErrorModalTitle('Account Locked');
      setErrorModalMessage(`Too many failed attempts. Please try again in ${lockTimeRemaining} second${lockTimeRemaining !== 1 ? 's' : ''}.`);
      setShowErrorModal(true);
      return;
    }

    setIsLoading(true);
    setError('');

    if (!username || !password) {
      setErrorModalCode('auth002');
      setErrorModalTitle('Incomplete Information');
      setErrorModalMessage('Please enter both username and password.');
      setShowErrorModal(true);
      setIsLoading(false);
      return;
    }

    if (!role) {
      setErrorModalCode('auth003');
      setErrorModalTitle('Role Required');
      setErrorModalMessage('Please select a role to continue.');
      setShowErrorModal(true);
      setIsLoading(false);
      return;
    }

    // Call the backend API to authenticate without role
    // The backend will determine the role from the database
    apiClient.login(username, password, role)
      .then(response => {
        if (response.success && response.user) {
          // Reset failed attempts on successful login
          setFailedAttempts(0);
          setIsLocked(false);
          setLockTimeRemaining(0);
          localStorage.removeItem('loginLockout');
          
          // Create user object for the context using database response
          const loginUser = {
            id: String(response.user.id),
            username: response.user.username,
            role: response.user.role as 'admin' | 'pharmacy_assistant',
            email: response.user.email || '',
            fullName: response.user.fullName || '',
            canModifyPassword: response.user.canModifyPassword
          };
          
          // For both admin and staff, proceed directly to dashboard
          // PIN verification for admin will happen on the Dashboard
          login(loginUser);
          navigate('/dashboard');
        } else if (response.isDeactivated) {
          // Account is deactivated
          setErrorModalCode('auth006');
          setErrorModalTitle('Account Deactivated');
          setErrorModalMessage('Your account has been deactivated. Please contact the administrator for assistance.');
          setShowErrorModal(true);
          setIsLoading(false);
        } else if (response.isLocked) {
          // Server-side lockout - account is locked
          setIsLocked(true);
          setLockTimeRemaining(response.timeRemaining || 30);
          setErrorModalCode('auth001');
          setErrorModalTitle('Account Locked');
          setErrorModalMessage(`Your account has been locked. Please try again in ${response.timeRemaining || 30} seconds.`);
          setShowErrorModal(true);
          setIsLoading(false);
        } else {
          // Handle failed login attempt
          const newFailedAttempts = failedAttempts + 1;
          setFailedAttempts(newFailedAttempts);

          if (newFailedAttempts >= MAX_ATTEMPTS) {
            setIsLocked(true);
            setIsLocalLock(true); // Mark lock as local
            setLockTimeRemaining(LOCKOUT_DURATION_SECONDS);
            setErrorModalCode('auth001');
            setErrorModalTitle('Account Locked');
            setErrorModalMessage(`Too many failed attempts. Your account is locked for ${LOCKOUT_DURATION_SECONDS} seconds.`);
            setShowErrorModal(true);
            
            // Persist to localStorage
            try {
              localStorage.setItem('loginLockout', JSON.stringify({
                failedAttempts: newFailedAttempts,
                lockedAt: Date.now()
              }));
            } catch (e) {
              console.error('Could not write to localStorage:', e);
            }

          } else {
            const attemptsRemaining = MAX_ATTEMPTS - newFailedAttempts;
            setErrorModalCode('auth004');
            setErrorModalTitle('Invalid Credentials');
            setErrorModalMessage(`Invalid username or password. ${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining.`);
            setShowErrorModal(true);
          }
          setIsLoading(false);
        }
      }).catch((err: any) => {
        console.error('Login error:', err);
        setErrorModalCode('auth005');
        setErrorModalTitle('Login Failed');
        setErrorModalMessage(err.message || 'An error occurred during login. Please try again.');
        setShowErrorModal(true);
        setIsLoading(false);
      });
  };

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      setResetError('Please enter your email address.');
      return;
    }
    
    setResetLoading(true);
    setResetError('');
    apiClient.sendVerificationCode(resetEmail)
      .then(response => {
        if (response.success) {
          setForgotStep('code');
        } else {
          setResetError(response.message || 'Failed to send verification code.');
        }
        setResetLoading(false);
      })
      .catch((err: any) => {
        console.error('Error sending code:', err);
        setResetError('Error sending verification code. Please try again.');
        setResetLoading(false);
      });
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCode) {
      setResetError('Please enter the verification code.');
      return;
    }

    setResetLoading(true);
    setResetError('');
    apiClient.verifyResetCode(resetEmail, resetCode)
      .then(response => {
        if (response.success) {
          setForgotStep('success');
        } else {
          setResetError(response.message || 'Failed to verify code.');
        }
        setResetLoading(false);
      })
      .catch((err: any) => {
        console.error('Error verifying code:', err);
        setResetError('Error verifying code. Please try again.');
        setResetLoading(false);
      });
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotStep('email');
    setResetEmail('');
    setResetCode('');
    setResetError('');
  };

 return (
    <div className={`min-h-screen bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-hover)] flex items-center justify-center p-4 relative ${fontFamily}`}>
      
      <div className={`rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-[var(--color-border)]'}`}>
        <div className={`p-8 text-center border-b ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-[var(--color-light)] border-[var(--color-border)]'}`}>
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg ring-4 ${isDarkTheme ? 'bg-gray-600 ring-gray-700' : 'bg-white ring-[var(--color-border)]'} overflow-hidden`}>
            <img 
                  src="assets/img/main.png"
                  alt={pharmacyName}
                  className="w-full h-full object-cover"
                />
          </div>
          <h1 className={`text-2xl font-extrabold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{pharmacyName}</h1>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          
          <div className="space-y-2">
            <label className={`text-sm font-bold ${isDarkTheme ? 'text-gray-200' : 'text-slate-700'}`}>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'pharmacy_assistant' | '')}
              className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none font-medium ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-slate-300 text-slate-700'} ${role ? (isDarkTheme ? 'text-gray-200' : 'text-slate-700') : (isDarkTheme ? 'text-gray-500' : 'text-slate-400')}`}
              disabled={isLoading || isLocked}
            >
              <option value="" disabled>Select your role...</option>
              <option value="pharmacy_assistant">Pharmacy Assistant</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className={`text-sm font-bold ${isDarkTheme ? 'text-gray-200' : 'text-slate-700'}`}>Username</label>
            <div className="relative">
              <User className={`absolute left-3 top-3 w-5 h-5 ${isDarkTheme ? 'text-gray-500' : 'text-slate-400'}`} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-slate-300 text-slate-900 placeholder-gray-400'}`}
                placeholder="Enter username"
                required
                disabled={isLoading || isLocked}
              />
            </div>
          </div>

         
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className={`text-sm font-bold ${isDarkTheme ? 'text-gray-200' : 'text-slate-700'}`}>Password</label>
              <button 
                type="button"
                onClick={() => setShowForgotModal(true)}
                className={`text-xs font-bold hover:underline disabled:opacity-50 disabled:cursor-not-allowed ${isDarkTheme ? 'text-blue-400' : 'text-[var(--color-text)]'}`}
                disabled={isLocked}
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className={`absolute left-3 top-3 w-5 h-5 ${isDarkTheme ? 'text-gray-500' : 'text-slate-400'}`} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full pl-10 pr-10 py-2.5 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-slate-300 text-slate-900 placeholder-gray-400'}`}
                placeholder="Enter password"
                required
                disabled={isLoading || isLocked}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-3 top-3 p-0.5 rounded-md transition-colors disabled:opacity-50 ${isDarkTheme ? 'text-gray-500 hover:text-gray-400 hover:bg-gray-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                disabled={isLocked}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || isLocked}
            className={`w-full font-bold py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed mt-2 ${isDarkTheme ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-slate-900 text-[var(--color-primary)] hover:bg-slate-800'}`}
          >
            {isLocked ? (
              <>
                <Clock size={18} />
                Locked ({lockTimeRemaining}s)
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>

      {/* Error Modal - Rendered via Portal */}
      <ErrorModal
        isOpen={showErrorModal}
        errorCode={errorModalCode}
        title={errorModalTitle}
        message={errorModalMessage}
        onClose={() => setShowErrorModal(false)}
      />

      {/* Loading Modal - Rendered via Portal */}
      {isLoading && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className={`p-8 shadow-2xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-200 w-full max-w-sm mx-auto rounded-xl border-none ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
            <Loader2 className={`w-12 h-12 text-[var(--color-hover)] animate-spin mb-4`} />
            <h3 className={`text-xl font-extrabold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Signing In</h3>
            <p className={`font-medium mt-1 text-center ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>Verifying credentials, please wait...</p>
          </div>
        </div>,
        document.body
      )}

      {/* Forgot Password Modal - Rendered via Portal */}
      {showForgotModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200 overflow-hidden ${isDarkTheme ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`bg-[var(--color-primary)] px-6 py-4 flex justify-between items-center ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
               <h3 className="font-extrabold text-lg">
                 {forgotStep === 'email' && 'Forgot Password'}
                 {forgotStep === 'code' && 'Verify Code'}
                 {forgotStep === 'success' && 'Reset Successful'}
               </h3>
               <button onClick={closeForgotModal} className="hover:bg-white/20 p-1 rounded-full"><X size={18} /></button>
            </div>
            
            <div className="p-6">
              {forgotStep === 'email' && (
                <form onSubmit={handleSendCode} className="space-y-4">
                  <p className={`text-sm font-medium ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Enter your email address to receive a verification code.</p>
                  
                  {resetError && (
                    <div className={`px-4 py-3 rounded-lg text-sm border font-medium flex items-start gap-2 ${isDarkTheme ? 'bg-red-900/30 text-red-300 border-red-700' : 'bg-red-50 text-red-600 border-red-200'}`}>
                      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                      <span>{resetError}</span>
                    </div>
                  )}
                  
                  <div>
                    <label className={`block text-sm font-bold mb-1 ${isDarkTheme ? 'text-gray-200' : 'text-slate-700'}`}>Email Address</label>
                    <div className="relative">
                      <Mail className={`absolute left-3 top-2.5 w-5 h-5 ${isDarkTheme ? 'text-gray-500' : 'text-slate-400'}`} />
                      <input 
                        type="email" 
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] outline-none ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-slate-900 placeholder-gray-400'}`}
                        placeholder="name@example.com"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={resetLoading}
                    className={`w-full py-2.5 font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2 mt-2 ${isDarkTheme ? 'bg-blue-900 text-white hover:bg-blue-800 disabled:opacity-50' : 'bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50'}`}
                  >
                    {resetLoading ? <Loader2 size={18} className="animate-spin" /> : <>Send Code <ArrowRight size={16} /></>}
                  </button>
                </form>
              )}

              {forgotStep === 'code' && (
                <form onSubmit={handleVerifyCode} className="space-y-4">
                   <div className={`p-3 rounded-lg text-sm mb-2 ${isDarkTheme ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-800'}`}>
                     Code sent to <span className="font-bold">{resetEmail}</span>
                   </div>
                  <p className={`text-sm font-medium ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>Please enter the 6-digit code sent to your email.</p>
                  
                  {resetError && (
                    <div className={`px-4 py-3 rounded-lg text-sm border font-medium flex items-start gap-2 ${isDarkTheme ? 'bg-red-900/30 text-red-300 border-red-700' : 'bg-red-50 text-red-600 border-red-200'}`}>
                      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                      <span>{resetError}</span>
                    </div>
                  )}
                  
                  <div>
                    <label className={`block text-sm font-bold mb-1 ${isDarkTheme ? 'text-gray-200' : 'text-slate-700'}`}>Verification Code</label>
                    <input 
                      type="text" 
                      required
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none text-center text-2xl tracking-widest font-mono ${isDarkTheme ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-slate-900 placeholder-gray-400'}`}
                      placeholder="000000"
                      maxLength={6}
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={resetLoading}
                    className={`w-full py-2.5 font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2 mt-2 ${isDarkTheme ? 'bg-blue-900 text-white hover:bg-blue-800 disabled:opacity-50' : 'bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50'}`}
                  >
                    {resetLoading ? <Loader2 size={18} className="animate-spin" /> : 'Verify Code'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setForgotStep('email')}
                    className={`w-full text-sm font-bold ${isDarkTheme ? 'text-gray-400 hover:text-gray-200' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Back
                  </button>
                </form>
              )}

              {forgotStep === 'success' && (
                <div className="text-center py-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isDarkTheme ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-600'}`}>
                    <CheckCircle size={32} />
                  </div>
                  <h4 className={`font-bold text-xl ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Password Reset Successfully!</h4>
                  <p className={`text-sm mt-2 mb-6 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>A temporary password has been sent to your email address. Please check your inbox (and spam folder) and log in with the temporary password. You can change it after logging in.</p>
                  
                  <button 
                    onClick={closeForgotModal}
                    className={`w-full py-2.5 font-bold rounded-lg shadow-md transition-all ${isDarkTheme ? 'bg-blue-900 text-white hover:bg-blue-800' : 'bg-[var(--color-primary)] hover:bg-[var(--color-hover)] text-slate-900'}`}
                  >
                    Back to Login
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Login;

