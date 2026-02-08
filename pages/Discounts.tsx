import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import apiClient from '../lib/apiClient';
import { Discount } from '../types';
import { Plus, Edit, Trash, Check, X, Loader, AlertCircle, Search, AlertTriangle } from 'lucide-react';
import { saveDiscountToSupabase, deleteDiscountFromSupabase } from '../lib/supabaseOperations';

const Discounts: React.FC = () => {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    DiscountName: '',
    DiscountRate: '',
    IsActive: 1,
  });

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const fetchDiscounts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.getAllDiscounts();
      if (response.success) {
        setDiscounts(response.data || []);
      } else {
        setError(response.message || 'Failed to load discounts');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading discounts');
      console.error('Discounts fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDiscounts = discounts.filter(d =>
    d.DiscountName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'IsActive' ? parseInt(value) : (name === 'DiscountRate' ? parseFloat(value) : value)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.DiscountName.trim() || !formData.DiscountRate) {
      setError('Please fill in all fields');
      return;
    }

    try {
      if (editingId) {
        const response = await apiClient.updateDiscount(editingId, {
          DiscountName: formData.DiscountName,
          DiscountRate: parseFloat(String(formData.DiscountRate)),
          IsActive: formData.IsActive,
        });
        if (response.success) {
          // Also save to Supabase
          await saveDiscountToSupabase({
            discount_id: editingId,
            discount_name: formData.DiscountName,
            discount_rate: parseFloat(String(formData.DiscountRate)),
            is_active: formData.IsActive === 1
          });
          
          setDiscounts(prev => prev.map(d =>
            d.DiscountID === editingId
              ? { ...d, DiscountName: formData.DiscountName, DiscountRate: parseFloat(String(formData.DiscountRate)), IsActive: formData.IsActive }
              : d
          ));
          setShowForm(false);
          setEditingId(null);
          setFormData({ DiscountName: '', DiscountRate: '', IsActive: 1 });
        } else {
          setError(response.message || 'Failed to update discount');
        }
      } else {
        const response = await apiClient.createDiscount({
          DiscountName: formData.DiscountName,
          DiscountRate: parseFloat(String(formData.DiscountRate)),
          IsActive: formData.IsActive,
        });
        if (response.success) {
          // Also save to Supabase
          await saveDiscountToSupabase({
            discount_id: response.data?.DiscountID,
            discount_name: formData.DiscountName,
            discount_rate: parseFloat(String(formData.DiscountRate)),
            is_active: formData.IsActive === 1
          });
          
          setDiscounts(prev => [...prev, response.data]);
          setShowForm(false);
          setFormData({ DiscountName: '', DiscountRate: '', IsActive: 1 });
        } else {
          setError(response.message || 'Failed to create discount');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error saving discount');
    }
  };

  const handleEdit = (discount: Discount) => {
    setFormData({
      DiscountName: discount.DiscountName,
      DiscountRate: String(discount.DiscountRate),
      IsActive: typeof discount.IsActive === 'number' ? discount.IsActive : (discount.IsActive ? 1 : 0),
    });
    setEditingId(discount.DiscountID!);
    setShowForm(true);
  };

  const confirmDelete = (id: number) => {
    setDeleteId(id);
  };

  const executeDelete = async () => {
    if (!deleteId) return;

    try {
      const response = await apiClient.deleteDiscount(deleteId);
      if (response.success) {
        // Also delete from Supabase
        await deleteDiscountFromSupabase(deleteId);
        
        setDiscounts(prev => prev.filter(d => d.DiscountID !== deleteId));
        setDeleteId(null);
      } else {
        setError(response.message || 'Failed to delete discount');
      }
    } catch (err: any) {
      setError(err.message || 'Error deleting discount');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ DiscountName: '', DiscountRate: '', IsActive: 1 });
    setError(null);
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Discount Management</h1>
          <p className="text-slate-500 mt-1">Manage pharmacy discounts and promotional rates</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-lg transition-colors shadow-lg"
          >
            <Plus size={20} />
            Add Discount
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-700 hover:text-red-900">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            {editingId ? 'Edit Discount' : 'Add New Discount'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Discount Name</label>
              <input
                type="text"
                name="DiscountName"
                value={formData.DiscountName}
                onChange={handleFormChange}
                placeholder="e.g., Senior Citizen"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Discount Rate (%)</label>
              <input
                type="number"
                name="DiscountRate"
                value={formData.DiscountRate}
                onChange={handleFormChange}
                placeholder="e.g., 10"
                step="0.01"
                min="0"
                max="100"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Status</label>
              <select
                name="IsActive"
                value={formData.IsActive}
                onChange={handleFormChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </div>

            <div className="md:col-span-3 flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-slate-900 font-bold py-2 px-4 rounded-lg transition-colors"
              >
                <X size={18} />
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                <Check size={18} />
                {editingId ? 'Update' : 'Save'} Discount
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search Bar */}
      {!showForm && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search discounts by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12">
            <Loader className="animate-spin text-slate-900 mb-4" size={32} />
            <p className="text-slate-500 font-semibold">Loading discounts...</p>
          </div>
        ) : filteredDiscounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-500">
            <AlertCircle size={32} className="mb-3 opacity-50" />
            <p className="font-medium">No discounts found</p>
            <p className="text-sm mt-1">
              {searchTerm ? 'Try adjusting your search terms' : 'Create your first discount to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Discount Name</th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Rate</th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Status</th>
                  <th className="px-6 py-3 text-right text-sm font-bold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDiscounts.map((discount, idx) => (
                  <tr
                    key={discount.DiscountID}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}
                  >
                    <td className="px-6 py-4 font-semibold text-slate-900">{discount.DiscountName}</td>
                    <td className="px-6 py-4 text-slate-700">
                      <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">
                        {discount.DiscountRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-bold ${
                          discount.IsActive
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {discount.IsActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(discount)}
                        className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-2 px-3 rounded-lg transition-colors"
                      >
                        <Edit size={16} />
                        Edit
                      </button>
                      <button
                        onClick={() => confirmDelete(discount.DiscountID!)}
                        className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 font-semibold py-2 px-3 rounded-lg transition-colors"
                      >
                        <Trash size={16} />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm Delete Modal - Rendered via Portal */}
      {deleteId && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[110] backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in slide-in-from-bottom-5 duration-500">
             <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 mx-auto">
                <AlertTriangle size={24} />
             </div>
             <h3 className="text-lg font-extrabold text-slate-900 text-center mb-2">Delete Discount?</h3>
             <p className="text-slate-500 text-center text-sm mb-6 font-medium">
               Are you sure you want to delete this discount? This action cannot be undone.
             </p>
             <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteId(null)}
                  className="flex-1 py-2.5 bg-gray-100 text-slate-700 font-bold rounded-lg hover:bg-gray-200 transition-colors"
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
        document.getElementById('modal-root') as HTMLElement
      )}
    </div>
  );
};

export default Discounts;

