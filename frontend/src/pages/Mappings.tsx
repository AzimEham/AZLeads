import { useState, useEffect } from 'react';
import { api } from '../contexts/AuthContext';
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface Mapping {
  id: string;
  affiliate: { name: string };
  offer: { name: string };
  advertiser: { name: string };
  forward_url: string;
  enabled: boolean;
  created_at: string;
}

interface SelectOption {
  id: string;
  name: string;
}

export default function Mappings() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [affiliates, setAffiliates] = useState<SelectOption[]>([]);
  const [offers, setOffers] = useState<SelectOption[]>([]);
  const [advertisers, setAdvertisers] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<Mapping | null>(null);

  const [formData, setFormData] = useState({
    affiliate_id: '',
    offer_id: '',
    advertiser_id: '',
    forward_url: '',
    enabled: true,
  });

  useEffect(() => {
    Promise.all([
      fetchMappings(),
      fetchAffiliates(),
      fetchOffers(),
      fetchAdvertisers()
    ]);
  }, []);

  const fetchMappings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/mappings');
      setMappings(response.data.items);
    } catch (error) {
      console.error('Error fetching mappings:', error);
      toast.error('Failed to fetch mappings');
    } finally {
      setLoading(false);
    }
  };

  const fetchAffiliates = async () => {
    try {
      const response = await api.get('/api/affiliates');
      setAffiliates(response.data.items);
    } catch (error) {
      console.error('Error fetching affiliates:', error);
    }
  };

  const fetchOffers = async () => {
    try {
      const response = await api.get('/api/offers');
      setOffers(response.data.items);
    } catch (error) {
      console.error('Error fetching offers:', error);
    }
  };

  const fetchAdvertisers = async () => {
    try {
      const response = await api.get('/api/advertisers');
      setAdvertisers(response.data.items);
    } catch (error) {
      console.error('Error fetching advertisers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedMapping) {
        await api.put(`/api/mappings/${selectedMapping.id}`, formData);
        toast.success('Mapping updated successfully');
      } else {
        await api.post('/api/mappings', formData);
        toast.success('Mapping created successfully');
      }
      
      fetchMappings();
      closeModal();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to save mapping');
    }
  };

  const handleToggleEnabled = async (mapping: Mapping) => {
    try {
      await api.put(`/api/mappings/${mapping.id}`, {
        ...mapping,
        enabled: !mapping.enabled,
      });
      toast.success(`Mapping ${!mapping.enabled ? 'enabled' : 'disabled'}`);
      fetchMappings();
    } catch (error) {
      toast.error('Failed to update mapping');
    }
  };

  const handleDelete = async (mapping: Mapping) => {
    if (!confirm('Are you sure you want to delete this mapping?')) return;
    
    try {
      await api.delete(`/api/mappings/${mapping.id}`);
      toast.success('Mapping deleted successfully');
      fetchMappings();
    } catch (error) {
      toast.error('Failed to delete mapping');
    }
  };

  const openModal = (mapping?: Mapping) => {
    if (mapping) {
      setSelectedMapping(mapping);
      setFormData({
        affiliate_id: '', // Will be set from mapping data
        offer_id: '',
        advertiser_id: '',
        forward_url: mapping.forward_url,
        enabled: mapping.enabled,
      });
    } else {
      setSelectedMapping(null);
      setFormData({ 
        affiliate_id: '', 
        offer_id: '', 
        advertiser_id: '', 
        forward_url: '', 
        enabled: true 
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedMapping(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mappings</h1>
          <p className="text-gray-600 mt-1">Configure affiliate to advertiser routing</p>
        </div>
        <button
          onClick={() => openModal()}
          className="mt-4 sm:mt-0 btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Mapping</span>
        </button>
      </div>

      {/* Mappings Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Affiliate
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Offer
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Advertiser
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Forward URL
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Status
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
              ) : mappings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-cell text-center text-gray-500">
                    No mappings found
                  </td>
                </tr>
              ) : (
                mappings.map((mapping) => (
                  <tr key={mapping.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <span className="font-medium text-gray-900">{mapping.affiliate.name}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">{mapping.offer.name}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">{mapping.advertiser.name}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-600 text-sm font-mono truncate max-w-xs">
                        {mapping.forward_url || 'Default'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <button
                        onClick={() => handleToggleEnabled(mapping)}
                        className={`flex items-center space-x-1 ${
                          mapping.enabled ? 'text-green-600' : 'text-gray-400'
                        }`}
                      >
                        {mapping.enabled ? (
                          <ToggleRight className="h-5 w-5" />
                        ) : (
                          <ToggleLeft className="h-5 w-5" />
                        )}
                        <span className="text-sm">
                          {mapping.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </button>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">
                        {new Date(mapping.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openModal(mapping)}
                          className="text-primary-600 hover:text-primary-700"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(mapping)}
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
                  {selectedMapping ? 'Edit Mapping' : 'Add New Mapping'}
                </h3>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Affiliate *
                  </label>
                  <select
                    value={formData.affiliate_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, affiliate_id: e.target.value }))}
                    className="input-field"
                    required
                  >
                    <option value="">Select Affiliate</option>
                    {affiliates.map(affiliate => (
                      <option key={affiliate.id} value={affiliate.id}>
                        {affiliate.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Offer *
                  </label>
                  <select
                    value={formData.offer_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, offer_id: e.target.value }))}
                    className="input-field"
                    required
                  >
                    <option value="">Select Offer</option>
                    {offers.map(offer => (
                      <option key={offer.id} value={offer.id}>
                        {offer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Advertiser *
                  </label>
                  <select
                    value={formData.advertiser_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, advertiser_id: e.target.value }))}
                    className="input-field"
                    required
                  >
                    <option value="">Select Advertiser</option>
                    {advertisers.map(advertiser => (
                      <option key={advertiser.id} value={advertiser.id}>
                        {advertiser.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Forward URL Override
                  </label>
                  <input
                    type="url"
                    value={formData.forward_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, forward_url: e.target.value }))}
                    className="input-field"
                    placeholder="Leave empty to use advertiser's default endpoint"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Optional: Override the advertiser's default endpoint URL for this mapping
                  </p>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enabled"
                    checked={formData.enabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="enabled" className="ml-2 block text-sm text-gray-900">
                    Enabled
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
                    {selectedMapping ? 'Update' : 'Create'}
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