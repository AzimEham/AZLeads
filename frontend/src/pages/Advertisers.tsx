import { useState, useEffect } from 'react';
import { api } from '../contexts/AuthContext';
import { Plus, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Advertiser {
  id: string;
  name: string;
  endpoint_url: string;
  endpoint_secret: string;
  platform: string;
  created_at: string;
}

export default function Advertisers() {
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<Advertiser | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    endpoint_url: '',
    endpoint_secret: '',
    platform: '',
  });

  useEffect(() => {
    fetchAdvertisers();
  }, []);

  const fetchAdvertisers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/advertisers');
      setAdvertisers(response.data.items);
    } catch (error) {
      console.error('Error fetching advertisers:', error);
      toast.error('Failed to fetch advertisers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedAdvertiser) {
        await api.put(`/api/advertisers/${selectedAdvertiser.id}`, formData);
        toast.success('Advertiser updated successfully');
      } else {
        await api.post('/api/advertisers', formData);
        toast.success('Advertiser created successfully');
      }
      
      fetchAdvertisers();
      closeModal();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to save advertiser');
    }
  };

  const handleDelete = async (advertiser: Advertiser) => {
    if (!confirm(`Are you sure you want to delete ${advertiser.name}?`)) return;
    
    try {
      await api.delete(`/api/advertisers/${advertiser.id}`);
      toast.success('Advertiser deleted successfully');
      fetchAdvertisers();
    } catch (error) {
      toast.error('Failed to delete advertiser');
    }
  };

  const openModal = (advertiser?: Advertiser) => {
    if (advertiser) {
      setSelectedAdvertiser(advertiser);
      setFormData({
        name: advertiser.name,
        endpoint_url: advertiser.endpoint_url,
        endpoint_secret: advertiser.endpoint_secret,
        platform: advertiser.platform,
      });
    } else {
      setSelectedAdvertiser(null);
      setFormData({ name: '', endpoint_url: '', endpoint_secret: '', platform: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedAdvertiser(null);
  };

  const platforms = [
    'Generic',
    'Salesforce',
    'HubSpot',
    'Marketo',
    'Pardot',
    'Eloqua',
    'Custom',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Advertisers</h1>
          <p className="text-gray-600 mt-1">Manage your advertiser partners</p>
        </div>
        <button
          onClick={() => openModal()}
          className="mt-4 sm:mt-0 btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Advertiser</span>
        </button>
      </div>

      {/* Advertisers Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Platform
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Endpoint URL
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Has Secret
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
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="table-cell">
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : advertisers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-cell text-center text-gray-500">
                    No advertisers found
                  </td>
                </tr>
              ) : (
                advertisers.map((advertiser) => (
                  <tr key={advertiser.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <span className="font-medium text-gray-900">{advertiser.name}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">{advertiser.platform}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-600 text-sm font-mono truncate max-w-xs">
                        {advertiser.endpoint_url}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        advertiser.endpoint_secret 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {advertiser.endpoint_secret ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">
                        {new Date(advertiser.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openModal(advertiser)}
                          className="text-primary-600 hover:text-primary-700"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(advertiser)}
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
                  {selectedAdvertiser ? 'Edit Advertiser' : 'Add New Advertiser'}
                </h3>
              </div>

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
                    Platform
                  </label>
                  <select
                    value={formData.platform}
                    onChange={(e) => setFormData(prev => ({ ...prev, platform: e.target.value }))}
                    className="input-field"
                  >
                    <option value="">Select Platform</option>
                    {platforms.map(platform => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Endpoint URL *
                  </label>
                  <input
                    type="url"
                    value={formData.endpoint_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, endpoint_url: e.target.value }))}
                    className="input-field"
                    placeholder="https://api.example.com/leads"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Endpoint Secret
                  </label>
                  <input
                    type="password"
                    value={formData.endpoint_secret}
                    onChange={(e) => setFormData(prev => ({ ...prev, endpoint_secret: e.target.value }))}
                    className="input-field"
                    placeholder="Optional HMAC secret for signing"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Used for HMAC signature verification
                  </p>
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
                    {selectedAdvertiser ? 'Update' : 'Create'}
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