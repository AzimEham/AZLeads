import { useState, useEffect } from 'react';
import { api } from '../contexts/AuthContext';
import { Plus, Edit, Eye, EyeOff, Copy, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Affiliate {
  id: string;
  name: string;
  email: string;
  api_key_hash: string;
  ip_whitelist: string[];
  active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export default function Affiliates() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);
  const [generatedApiKey, setGeneratedApiKey] = useState<string>('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    ip_whitelist: '',
    active: true,
  });

  useEffect(() => {
    fetchAffiliates();
  }, []);

  const fetchAffiliates = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/affiliates');
      setAffiliates(response.data.items);
    } catch (error) {
      console.error('Error fetching affiliates:', error);
      toast.error('Failed to fetch affiliates');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        ip_whitelist: formData.ip_whitelist.split('\n').filter(ip => ip.trim()),
      };

      if (selectedAffiliate) {
        await api.put(`/api/affiliates/${selectedAffiliate.id}`, payload);
        toast.success('Affiliate updated successfully');
      } else {
        const response = await api.post('/api/affiliates', payload);
        setGeneratedApiKey(response.data.api_key);
        toast.success('Affiliate created successfully');
      }
      
      fetchAffiliates();
      if (!selectedAffiliate) {
        // Don't close modal for new affiliate to show API key
        setFormData({ name: '', email: '', ip_whitelist: '', active: true });
      } else {
        closeModal();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to save affiliate');
    }
  };

  const handleDelete = async (affiliate: Affiliate) => {
    if (!confirm(`Are you sure you want to delete ${affiliate.name}?`)) return;
    
    try {
      await api.delete(`/api/affiliates/${affiliate.id}`);
      toast.success('Affiliate deleted successfully');
      fetchAffiliates();
    } catch (error) {
      toast.error('Failed to delete affiliate');
    }
  };

  const openModal = (affiliate?: Affiliate) => {
    if (affiliate) {
      setSelectedAffiliate(affiliate);
      setFormData({
        name: affiliate.name,
        email: affiliate.email,
        ip_whitelist: affiliate.ip_whitelist.join('\n'),
        active: affiliate.active,
      });
    } else {
      setSelectedAffiliate(null);
      setFormData({ name: '', email: '', ip_whitelist: '', active: true });
    }
    setGeneratedApiKey('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedAffiliate(null);
    setGeneratedApiKey('');
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(generatedApiKey);
    toast.success('API key copied to clipboard');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Affiliates</h1>
          <p className="text-gray-600 mt-1">Manage your affiliate partners</p>
        </div>
        <button
          onClick={() => openModal()}
          className="mt-4 sm:mt-0 btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Affiliate</span>
        </button>
      </div>

      {/* Affiliates Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Last Used
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  IP Whitelist
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="table-cell">
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : affiliates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-cell text-center text-gray-500">
                    No affiliates found
                  </td>
                </tr>
              ) : (
                affiliates.map((affiliate) => (
                  <tr key={affiliate.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <span className="font-medium text-gray-900">{affiliate.name}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">{affiliate.email}</span>
                    </td>
                    <td className="table-cell">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        affiliate.active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {affiliate.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="table-cell">
                      {affiliate.last_used_at ? (
                        <span className="text-gray-900">
                          {new Date(affiliate.last_used_at).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-gray-500">Never</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className="text-sm text-gray-600">
                        {affiliate.ip_whitelist.length} IP(s)
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">
                        {new Date(affiliate.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openModal(affiliate)}
                          className="text-primary-600 hover:text-primary-700"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(affiliate)}
                          className="text-red-600 hover:text-red-700"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-black bg-opacity-50" onClick={closeModal}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedAffiliate ? 'Edit Affiliate' : 'Add New Affiliate'}
                </h3>
              </div>

              {generatedApiKey && !selectedAffiliate && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="text-sm font-medium text-green-800 mb-2">
                    Affiliate Created! Here's the API Key:
                  </h4>
                  <div className="flex items-center space-x-2">
                    <code className="text-sm bg-white px-2 py-1 rounded border text-green-700 flex-1">
                      {generatedApiKey}
                    </code>
                    <button
                      onClick={copyApiKey}
                      className="text-green-600 hover:text-green-700"
                      title="Copy API Key"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-green-600 mt-2">
                    Save this API key now - it won't be shown again!
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    IP Whitelist (one per line)
                  </label>
                  <textarea
                    value={formData.ip_whitelist}
                    onChange={(e) => setFormData(prev => ({ ...prev, ip_whitelist: e.target.value }))}
                    className="input-field"
                    rows={4}
                    placeholder="192.168.1.1&#10;10.0.0.0/24&#10;203.0.113.0/24"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Supports individual IPs and CIDR ranges
                  </p>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
                    Active
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                  >
                    {selectedAffiliate ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}