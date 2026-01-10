
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePharmacy } from '../context/PharmacyContext';
import apiClient from '../lib/apiClient';
import { User, Shield, Plus, Trash2, X, AlertTriangle, Edit, Mail, Lock, AlertCircle, Loader, Camera } from 'lucide-react';
import { User as UserType } from '../types';

const Account: React.FC = () => {
  const { user, updateCurrentUser, refreshUserProfile, themeColor } = usePharmacy();
  
  // Theme color mapping for badges - matches Settings.tsx color options
  const badgeThemeClass = {
    'amber': 'bg-amber-400 border-amber-400 text-white',
    'teal': 'bg-teal-400 border-teal-400 text-white',
    'blue': 'bg-blue-400 border-blue-400 text-white',
    'rose': 'bg-rose-400 border-rose-400 text-white',
    'emerald': 'bg-emerald-400 border-emerald-400 text-white'
  }[themeColor] || 'bg-amber-400 border-amber-400 text-white';
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<number | null>(1); // Filter: 1 = active, 0 = inactive, null = all
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  // Edit Profile State (Self)
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);

  // Sync email when edit profile modal opens or registered users change
  useEffect(() => {
    if (isEditProfileOpen && user && registeredUsers.length > 0) {
      const userFullData = registeredUsers.find(u => 
        u.Username?.toLowerCase() === user.username?.toLowerCase()
      );
      
      if (userFullData?.Email) {
        setEditEmail(userFullData.Email);
      }
      
      // Load profile image from localStorage
      const savedImage = localStorage.getItem(`profileImage_${user.id}`);
      if (savedImage) {
        setProfileImage(savedImage);
      }
    }
  }, [isEditProfileOpen, user, registeredUsers]);
  
  // Fetch users from API on component mount
  useEffect(() => {
    fetchUsers();
    
    // Load profile image from localStorage as fallback (for offline use)
    if (user?.id) {
      const savedImage = localStorage.getItem(`profileImage_${user.id}`);
      if (savedImage) {
        setProfileImage(savedImage);
      }
    }
  }, [user?.id]);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.getUsers();
      if (response.success) {
        setRegisteredUsers(response.data || []);
        
        // Load current user's profile image from database
        if (user?.id && response.data) {
          const currentUser = response.data.find((u: any) => u.UserID === user.id);
          if (currentUser?.ProfileImage) {
            setProfileImage(currentUser.ProfileImage);
          }
        }
        
        // Extract unique roles from users
        const roles = Array.from(new Set(response.data?.map((u: any) => u.Role) || [])) as string[];
        setAvailableRoles(roles);
      } else {
        setError(response.message || 'Failed to load users');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading users');
      console.error('Users fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Staff Management State
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'staff' as 'staff' | 'admin',
    email: '',
    fullName: ''
  });

  const isAdmin = user?.role === 'admin';

  const handleOpenCreate = () => {
    setEditingUserId(null);
    setFormData({ username: '', password: '', role: 'staff', email: '', fullName: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (targetUser: any) => {
    setEditingUserId(targetUser.UserID.toString());
    setFormData({
      username: targetUser.Username,
      password: '', // Leave blank to keep current
      role: targetUser.Role,
      email: targetUser.Email || '',
      fullName: targetUser.FullName || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    
    try {
      const currentUserId = typeof user?.id === 'string' ? parseInt(user.id) : user?.id;
      
      if (editingUserId) {
        // Update user
        await apiClient.updateUser(parseInt(editingUserId), {
          username: formData.username,
          email: formData.email,
          fullName: formData.fullName,
          role: formData.role,
          password: formData.password || undefined,
          currentUserId: currentUserId
        });
        setSuccess('User updated successfully');
        
        // Close modal immediately after update
        setIsModalOpen(false);
        setFormData({ username: '', password: '', role: 'staff', email: '', fullName: '' });
        setEditingUserId(null);
        
        // Auto-clear success message after 5 seconds
        setTimeout(() => setSuccess(null), 5000);
      } else {
        // Create user
        if (formData.username && formData.password) {
          const response = await apiClient.createUser({
            username: formData.username,
            password: formData.password,
            email: formData.email,
            fullName: formData.fullName,
            role: formData.role,
            currentUserId: currentUserId
          });
          
          // Close modal immediately after creation
          setIsModalOpen(false);
          setFormData({ username: '', password: '', role: 'staff', email: '', fullName: '' });
          setEditingUserId(null);
          
          // Check if email was sent and show status
          if (response?.data?.emailStatus) {
            if (response.data.emailStatus.sent) {
              setSuccess(`User created! Welcome email sent to ${formData.email}`);
            } else {
              setSuccess(`User created but email not sent: ${response.data.emailStatus.message}`);
            }
          } else {
            setSuccess('User created successfully');
          }
          
          // Auto-clear success message after 5 seconds
          setTimeout(() => setSuccess(null), 5000);
        }
      }
      
      await fetchUsers(); // Refresh users list
    } catch (err: any) {
      setError(err.message || 'Failed to save user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditProfile = () => {
    if (user) {
      setEditUsername(user.username);
      
      // Try to find user by username (most reliable method)
      const userFullData = registeredUsers.find(u => 
        u.Username?.toLowerCase() === user.username?.toLowerCase()
      );
      
      // Set email - prioritize database email over context
      const emailToSet = userFullData?.Email || user.email || '';
      setEditEmail(emailToSet);
      
      setEditPassword('');
      setConfirmPassword('');
      setEditError('');
      setEditSuccess('');
      
      // Load profile image from database
      if (userFullData?.ProfileImage) {
        setProfileImage(userFullData.ProfileImage);
      } else {
        setProfileImage(null);
      }
      
      setProfileImageFile(null);
      setIsEditProfileOpen(true);
    }
  };

  const handleProfileImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setEditError('Image file is too large. Maximum size is 5MB.');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        console.log('Image loaded, size:', result.length, 'bytes');
        
        // Optionally compress/resize image using canvas
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Set max dimensions
          const maxWidth = 200;
          const maxHeight = 200;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedImage = canvas.toDataURL('image/jpeg', 0.8); // 80% quality
            console.log('Compressed image size:', compressedImage.length, 'bytes');
            setProfileImage(compressedImage);
          }
        };
        img.onerror = () => {
          setEditError('Failed to load image');
        };
        img.src = result;
        
        setProfileImageFile(file);
      };
      reader.onerror = () => {
        setEditError('Failed to read image file');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    setEditSuccess('');

    if (editPassword && editPassword !== confirmPassword) {
      setEditError("Passwords do not match");
      return;
    }

    try {
      if (user && editUsername.trim()) {
        // Find user by username to get correct UserID
        const userFullData = registeredUsers.find(u => 
          u.Username?.toLowerCase() === user.username?.toLowerCase()
        );
        
        const userId = userFullData?.UserID || user.id;
        console.log('handleUpdateProfile - userId:', userId, 'user.id:', user.id, 'userFullData:', userFullData);
        
        // Call API to update profile with userId
        const apiResponse = await apiClient.updateProfile({
          userId: userId.toString(),
          username: editUsername,
          email: editEmail,
          password: editPassword || undefined
        });
        
        console.log('Profile update response:', apiResponse);
        
        if (apiResponse.success) {
          // Update current user in context
          updateCurrentUser({
            username: editUsername,
            email: editEmail
          });
          
          // Save profile image to database - ALWAYS save if image exists
          if (profileImage) {
            try {
              console.log('Saving profile image with userId:', userId, 'image length:', profileImage.length);
              // Save to database
              const imageResponse = await apiClient.updateProfileImage({
                userId: userId.toString(),
                image: profileImage
              });
              
              console.log('Image update response:', imageResponse);
              
              if (imageResponse.success) {
                console.log('Profile image saved successfully to database');
              } else {
                console.error('Failed to save profile image - response:', imageResponse);
                setEditError('Profile updated but image save failed: ' + imageResponse.message);
                return;
              }
            } catch (imageError: any) {
              console.error('Profile image save error:', imageError);
              setEditError('Profile updated but image save failed: ' + imageError.message);
              return;
            }
          }
          
          // Refresh users to get updated data from database
          await fetchUsers();
          
          // Refresh the user profile in context (for Layout component to pick up changes)
          await refreshUserProfile();
          
          setEditSuccess('Profile updated successfully!');
          setEditPassword('');
          setConfirmPassword('');
          setTimeout(() => {
            setIsEditProfileOpen(false);
            setEditSuccess('');
          }, 2000);
        } else {
          throw new Error(apiResponse.message || 'Update failed');
        }
      }
    } catch (err: any) {
      setEditError(err.message || 'Failed to update profile');
    }
  };

  const handleToggleUserActive = async (targetUser: any) => {
    // Optimistically update UI to feel responsive
    setRegisteredUsers(prevUsers =>
      prevUsers.map(u =>
        u.UserID === targetUser.UserID
          ? { ...u, IsActive: u.IsActive == 1 ? 0 : 1 }
          : u
      )
    );
  
    try {
      const currentUserId = typeof user?.id === 'string' ? parseInt(user.id) : user?.id;
      // Make API call to update the user's status
      await apiClient.updateUser(targetUser.UserID, {
        IsActive: targetUser.IsActive == 1 ? 0 : 1,
        currentUserId: currentUserId,
      });
      setSuccess('User status updated.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update user status.');
      // Revert the optimistic update on error
      setRegisteredUsers(prevUsers =>
        prevUsers.map(u =>
          u.UserID === targetUser.UserID
            ? { ...u, IsActive: targetUser.IsActive } // Revert to original state
            : u
        )
      );
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteUserId(id);
  };

  const executeDelete = async () => {
    try {
      if (deleteUserId) {
        // Call API to delete user
        const currentUserId = typeof user?.id === 'string' ? parseInt(user.id) : user?.id;
        await apiClient.deleteUser(parseInt(deleteUserId), currentUserId);
        setDeleteUserId(null);
        await fetchUsers(); // Refresh users list
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    }
  };

  return (
    <div className="space-y-8 max-w-6xl lg:max-w-5xl mx-auto px-4">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={fetchUsers} className="ml-auto underline font-bold text-sm">Retry</button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-2">
          <span>✓</span>
          <span>{success}</span>
        </div>
      )}

      <div className="md:hidden">
        <h2 className="text-2xl font-extrabold text-slate-800">Account Management</h2>
        <p className="text-slate-500 font-medium">Manage your account and user details</p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden w-full lg:max-w-5xl">
        <div className="h-32 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-hover)]"></div>
        <div className="px-8 pb-8">
            <div className="relative flex justify-between items-end -mt-12 mb-6">
                <div className="relative">
                  <div className="w-24 h-24 bg-white rounded-full p-1 shadow-lg">
                      {profileImage ? (
                        <img src={profileImage} alt={user?.username} className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center text-3xl font-bold text-slate-400 uppercase">
                            {user?.username.charAt(0)}
                        </div>
                      )}
                  </div>
                  <button
                    onClick={() => document.getElementById('profileImageInput')?.click()}
                    className="absolute bottom-0 right-0 bg-[var(--color-primary)] hover:bg-[var(--color-hover)] text-slate-900 rounded-full p-2 shadow-lg transition-colors"
                    title="Upload profile picture"
                  >
                    <Camera size={16} />
                  </button>
                </div>
                <input
                  id="profileImageInput"
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImageUpload}
                  className="hidden"
                />
                <button 
                  onClick={handleOpenEditProfile}
                  className="bg-white border border-gray-300 text-slate-700 font-bold px-4 py-2 rounded-lg text-sm hover:bg-gray-50 shadow-sm flex items-center gap-2"
                >
                    <Edit size={16} /> Edit Profile
                </button>
            </div>

            <div className="space-y-6">
                <div>
                    <h3 className="text-xl font-bold text-slate-800">{user?.username}</h3>
                    <span className={`inline-flex items-center px-1.5 py-1 rounded-full text-xs font-semibold mt-1 ${badgeThemeClass}`}>
                        {user?.role}
                    </span>
                    {user?.email && (
                      <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mt-1">
                        <Mail size={14} /> {user.email}
                      </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Username</label>
                        <div className="flex items-center gap-3 text-slate-700 font-bold bg-gray-50 p-3 rounded-lg">
                            <User size={18} className="text-slate-400" />
                            {user?.username}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Role Access</label>
                        <div className="flex items-center gap-3 text-slate-700 font-bold bg-gray-50 p-3 rounded-lg">
                            <Shield size={18} className="text-slate-400" />
                            {user?.role === 'admin' ? 'Administrator' : user?.role === 'pharmacy_assistant' ? 'Pharmacy Assistant' : 'Staff Member'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Staff Management Section (Admin Only) */}
      {isAdmin && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 lg:max-w-5xl">
           <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pt-4 border-t border-gray-200">
             <div>
               <h3 className="text-xl font-extrabold text-slate-800">Staff Management</h3>
               <p className="text-slate-500 font-medium text-sm">Create and manage accounts for your team</p>
             </div>
             <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
               {/* Active Status Filter */}
               <div className="relative">
                 <button
                   onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                   className="px-3 py-1.5 text-sm font-semibold text-white bg-[var(--color-primary)] hover:opacity-90 rounded-lg transition-opacity flex items-center gap-1 whitespace-nowrap"
                 >
                   Filter by Status
                   <span className={`text-xs transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`}>▼</span>
                 </button>
                 
                 {showFilterDropdown && (
                   <div className="absolute right-0 mt-2 bg-white border border-[var(--color-border)] rounded-lg shadow-lg z-40 min-w-[180px]">
                     <button
                       onClick={() => {
                         setActiveFilter(1);
                         setShowFilterDropdown(false);
                       }}
                       className="block w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 border-b border-[var(--color-border)] transition-colors first:rounded-t-lg"
                     >
                       Active Users
                     </button>
                     <button
                       onClick={() => {
                         setActiveFilter(0);
                         setShowFilterDropdown(false);
                       }}
                       className="block w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 border-b border-[var(--color-border)] transition-colors"
                     >
                       Inactive Users
                     </button>
                     <button
                       onClick={() => {
                         setActiveFilter(null);
                         setShowFilterDropdown(false);
                       }}
                       className="block w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors last:rounded-b-lg"
                     >
                       All Users
                     </button>
                   </div>
                 )}
               </div>
               <button 
                 onClick={handleOpenCreate}
                 className="bg-slate-900 text-[var(--color-primary)] font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-md hover:bg-slate-800 transition-colors whitespace-nowrap w-full sm:w-auto justify-center sm:justify-start"
               >
                 <Plus size={18} /> Create Account
               </button>
             </div>
           </div>

           <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
              {isLoading && (
                <div className="p-12 text-center flex flex-col items-center justify-center">
                  <Loader className="animate-spin text-[var(--color-primary)] mb-4" size={32} />
                  <p className="text-slate-500 font-semibold">Loading staff members...</p>
                </div>
              )}

              {!isLoading && (
                <div className="flex flex-col overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left table-fixed">
                      <colgroup>
                        <col className="w-1/2 md:w-1/5" />
                        <col className="w-1/2 md:w-1/6" />
                        <col className="hidden md:table-column md:w-1/4" />
                        <col className="hidden lg:table-column lg:w-1/4" />
                        <col className="hidden sm:table-column sm:w-1/5 md:w-1/6" />
                      </colgroup>
                      <thead className="bg-[var(--color-light)] text-slate-700 font-bold text-[0.65rem] uppercase sticky top-0">
                        <tr>
                          <th className="px-1.5 sm:px-2 py-1.5 text-left">Username</th>
                          <th className="px-1.5 sm:px-2 py-1.5 text-left">Role</th>
                          <th className="hidden md:table-cell px-2 py-1.5 text-left">Full Name</th>
                          <th className="hidden lg:table-cell px-2 py-1.5 text-left">Email</th>
                          <th className="hidden sm:table-cell px-1.5 sm:px-2 py-1.5 text-right">Actions</th>
                        </tr>
                      </thead>
                    </table>
                  </div>
                  <div className="overflow-y-auto max-h-96 overflow-x-auto">
                    <table className="w-full text-left table-fixed">
                      <colgroup>
                        <col className="w-1/2 md:w-1/5" />
                        <col className="w-1/2 md:w-1/6" />
                        <col className="hidden md:table-column md:w-1/4" />
                        <col className="hidden lg:table-column lg:w-1/4" />
                        <col className="hidden sm:table-column sm:w-1/5 md:w-1/6" />
                      </colgroup>
                      <tbody className="divide-y divide-gray-100">
                      {registeredUsers.filter(u => {
                        const isNotAdmin = u.Role?.toLowerCase() !== 'admin';
                        const matchesFilter = activeFilter === null ? true : parseInt(u.IsActive) === activeFilter;
                        return isNotAdmin && matchesFilter;
                      }).map((u) => (
                      <tr key={u.UserID} className="hover:bg-gray-50 cursor-pointer sm:cursor-default text-[0.65rem]" onClick={() => window.innerWidth < 640 && setSelectedUserDetail(u)}>
                        <td className="px-1.5 sm:px-2 py-1.5 truncate">
                          <div className="flex items-center gap-1.5 min-w-0">
                             <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-[0.5rem] shrink-0">
                               {u.Username.charAt(0).toUpperCase()}
                             </div>
                             <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-slate-800 truncate text-[0.65rem]">{u.Username}</span>
                                <span className="md:hidden text-[0.6rem] text-slate-400 truncate">{u.FullName}</span>
                             </div>
                          </div>
                        </td>
                        <td className="px-1.5 sm:px-2 py-1.5">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.6rem] font-semibold whitespace-nowrap ${badgeThemeClass}`}>
                             {u.Role.toUpperCase()}
                          </span>
                        </td>
                        <td className="hidden md:table-cell px-2 py-1.5 text-slate-500 font-medium text-[0.65rem]">
                          {u.FullName || '-'}
                        </td>
                        <td className="hidden lg:table-cell px-2 py-1.5 text-slate-500 font-medium text-[0.65rem]">
                          <span title={u.Email || '-'} className="truncate">
                            {u.Email || '-'}
                          </span>
                        </td>
                        <td className="hidden sm:table-cell px-1.5 sm:px-2 py-1.5">
                          <div className="flex justify-end gap-1 flex-nowrap">
                            {/* Deactivate/Activate Toggle */}
                            {activeFilter !== 1 && u.UserID !== user?.id && u.Username !== 'admin' && (
                              <div
                                title={`Click to ${u.IsActive == 1 ? 'deactivate' : 'activate'}`}
                                onClick={(e) => { e.stopPropagation(); handleToggleUserActive(u); }}
                                className="flex items-center"
                              >
                                <div className={`w-8 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${u.IsActive == 1 ? 'bg-green-500' : 'bg-gray-300'}`}>
                                  <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${u.IsActive == 1 ? 'translate-x-3' : ''}`}></div>
                                </div>
                              </div>
                            )}

                            {/* Edit Button: Hidden for inactive users view */}
                            {activeFilter !== 0 && u.UserID !== user?.id && (
                              <button 
                                onClick={(e) => {e.stopPropagation(); handleOpenEdit(u);}}
                                className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors shrink-0"
                                title="Edit User"
                              >
                                <Edit size={14} />
                              </button>
                            )}
                            
                            {/* Delete Button: Hidden for inactive users view */}
                            {activeFilter !== 0 && u.UserID !== user?.id && u.Username !== 'admin' && (
                               <button 
                                 onClick={(e) => {e.stopPropagation(); confirmDelete(u.UserID.toString());}}
                                 className="p-0.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0"
                                 title="Remove User"
                               >
                                 <Trash2 size={14} />
                               </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      ))}
                      {registeredUsers.length === 0 && !isLoading && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                            No staff members found
                          </td>
                        </tr>
                      )}
                    </tbody>
                    </table>
                  </div>
                </div>
              )}
           </div>
        </div>
      )}

      {/* Add / Edit User Modal - Rendered via Portal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-300 overflow-hidden">
             <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
                <h3 className="font-bold text-lg">{editingUserId ? 'Edit Account' : 'Create New Account'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={18} /></button>
             </div>
             <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                   <label className="block text-sm font-bold text-slate-700 mb-1">Username</label>
                   <input 
                     type="text" 
                     required
                     value={formData.username}
                     onChange={(e) => setFormData({...formData, username: e.target.value})}
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none bg-white"
                   />
                </div>
                <div>
                   <label className="block text-sm font-bold text-slate-700 mb-1">Full Name</label>
                   <input 
                     type="text" 
                     value={formData.fullName}
                     onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none bg-white"
                   />
                </div>
                <div>
                   <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                   <input 
                     type="email" 
                     value={formData.email}
                     onChange={(e) => setFormData({...formData, email: e.target.value})}
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none bg-white"
                   />
                </div>
                <div>
                   <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
                   <input 
                     type="text" 
                     required={!editingUserId} // Required only when creating new
                     value={formData.password}
                     onChange={(e) => setFormData({...formData, password: e.target.value})}
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none bg-white"
                     placeholder={editingUserId ? "Leave blank to keep current" : ""}
                   />
                </div>
                <div>
                   <label className="block text-sm font-bold text-slate-700 mb-1">Role</label>
                   <select 
                     value={formData.role}
                     onChange={(e) => setFormData({...formData, role: e.target.value as 'admin' | 'staff'})}
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none bg-white"
                   >
                     {availableRoles.map(role => (
                       <option key={role} value={role}>{role}</option>
                     ))}
                   </select>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                   <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-gray-100 rounded-lg font-bold text-sm" disabled={isSubmitting}>Cancel</button>
                   <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-hover)] text-slate-900 rounded-lg font-bold shadow-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                      {isSubmitting && <Loader size={16} className="animate-spin" />}
                      {editingUserId ? 'Update User' : 'Create User'}
                   </button>
                </div>
             </form>
           </div>
        </div>,
        document.getElementById('modal-root') as HTMLElement
      )}

      {/* Edit Profile Modal (Self) - Rendered via Portal */}
      {isEditProfileOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4 animate-in fade-in duration-300">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in slide-in-from-bottom-5 duration-500 overflow-hidden">
             <div className="bg-[var(--color-primary)] px-6 py-4 flex justify-between items-center text-slate-900">
                <h3 className="font-bold text-lg">Edit Profile</h3>
                <button onClick={() => setIsEditProfileOpen(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={18} /></button>
             </div>
             <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
                {editError && (
                  <div className="bg-red-50 text-red-600 text-sm font-medium p-3 rounded-lg flex items-center gap-2">
                    <AlertTriangle size={16} /> {editError}
                  </div>
                )}
                {editSuccess && (
                  <div className="bg-green-50 text-green-600 text-sm font-medium p-3 rounded-lg flex items-center gap-2">
                    ✓ {editSuccess}
                  </div>
                )}
                
                {/* Profile Image Section */}
                <div className="flex flex-col items-center mb-6 pb-4 border-b border-gray-100">
                  <div className="relative mb-4">
                    <div className="w-20 h-20 bg-white rounded-full p-1 shadow-lg">
                      {profileImage ? (
                        <img src={profileImage} alt={editUsername} className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center text-2xl font-bold text-slate-400 uppercase">
                          {editUsername.charAt(0)}
                        </div>
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 bg-[var(--color-primary)] hover:bg-[var(--color-hover)] text-slate-900 rounded-full p-2 shadow-lg cursor-pointer transition-colors">
                      <Camera size={14} />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfileImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Click camera icon to change profile picture</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1">Username</label>
                     <div className="relative">
                       <User size={18} className="absolute left-3 top-2.5 text-slate-400" />
                       <input 
                         type="text" 
                         required
                         value={editUsername}
                         onChange={(e) => setEditUsername(e.target.value)}
                         className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none bg-white font-medium"
                       />
                     </div>
                  </div>
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
                     <div className="relative">
                       <Mail size={18} className="absolute left-3 top-2.5 text-slate-400" />
                       <input 
                         type="email" 
                         value={editEmail}
                         onChange={(e) => setEditEmail(e.target.value)}
                         className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none bg-white font-medium"
                         placeholder="Enter email address"
                       />
                     </div>
                  </div>
                  
                  <div className="border-t border-gray-100 pt-4 mt-2">
                    <h4 className="text-sm font-bold text-slate-800 mb-3">Change Password (Optional)</h4>
                    <div className="space-y-4">
                      <div>
                         <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">New Password</label>
                         <div className="relative">
                           <Lock size={18} className="absolute left-3 top-2.5 text-slate-400" />
                           <input 
                             type="password" 
                             value={editPassword}
                             onChange={(e) => setEditPassword(e.target.value)}
                             className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none bg-white font-medium"
                             placeholder="Leave blank to keep current"
                           />
                         </div>
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Confirm Password</label>
                         <div className="relative">
                           <Lock size={18} className="absolute left-3 top-2.5 text-slate-400" />
                           <input 
                             type="password" 
                             value={confirmPassword}
                             onChange={(e) => setConfirmPassword(e.target.value)}
                             className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none bg-white font-medium"
                             placeholder="Re-enter new password"
                           />
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                   <button type="button" onClick={() => setIsEditProfileOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-gray-100 rounded-lg font-bold text-sm">Cancel</button>
                   <button type="submit" className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-sm text-sm">Save Changes</button>
                </div>
             </form>
           </div>
        </div>,
        document.getElementById('modal-root') as HTMLElement
      )}

      {/* Confirm Delete User Modal - Rendered via Portal */}
      {deleteUserId && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[110] backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in slide-in-from-bottom-5 duration-500">
             <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 mx-auto">
                <AlertTriangle size={24} />
             </div>
             <h3 className="text-lg font-extrabold text-slate-900 text-center mb-2">Remove User?</h3>
             <p className="text-slate-500 text-center text-sm mb-6 font-medium">
               Are you sure you want to remove this account?
             </p>
             <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteUserId(null)}
                  className="flex-1 py-2.5 bg-gray-100 text-slate-700 font-bold rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={executeDelete}
                  className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-md"
                >
                  Remove
                </button>
             </div>
          </div>
        </div>,
        document.getElementById('modal-root') as HTMLElement
      )}

      {/* User Detail Modal (Mobile View) - Rendered via Portal */}
      {selectedUserDetail && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[110] backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in slide-in-from-bottom-5 duration-500 overflow-hidden">
             <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
                <h3 className="font-bold text-lg">User Details</h3>
                <button onClick={() => setSelectedUserDetail(null)} className="hover:bg-white/20 p-1 rounded-full"><X size={18} /></button>
             </div>

             <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xl">
                    {selectedUserDetail.Username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{selectedUserDetail.Username}</h3>
                    <span className={`inline-flex items-center px-1.5 py-1 rounded-full text-xs font-semibold ${badgeThemeClass}`}>
                      {selectedUserDetail.Role.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                   <div>
                     <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Full Name</label>
                     <p className="text-slate-700 font-medium bg-gray-50 p-3 rounded-lg">{selectedUserDetail.FullName || '-'}</p>
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Email</label>
                     <p className="text-slate-700 font-medium bg-gray-50 p-3 rounded-lg break-all">{selectedUserDetail.Email || '-'}</p>
                   </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                   {selectedUserDetail.UserID !== user?.id && selectedUserDetail.Username !== 'admin' && (
                     <button 
                       onClick={() => {
                         setSelectedUserDetail(null);
                         confirmDelete(selectedUserDetail.UserID.toString());
                       }}
                       className="px-4 py-2 text-slate-600 hover:bg-gray-100 rounded-lg font-bold text-sm"
                     >
                       Delete
                     </button>
                   )}
                   {selectedUserDetail.UserID !== user?.id && (
                     <button 
                       onClick={() => {
                         setSelectedUserDetail(null);
                         handleOpenEdit(selectedUserDetail);
                       }}
                       className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-hover)] text-slate-900 rounded-lg font-bold shadow-sm text-sm"
                     >
                       Edit
                     </button>
                   )}
                </div>
             </div>
          </div>
        </div>,
        document.getElementById('modal-root') as HTMLElement
      )}
    </div>
  );
};

export default Account;

