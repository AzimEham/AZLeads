import { useState, useEffect } from 'react';
import { api } from '../contexts/AuthContext';
import { Plus, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Offer {
  id: string;
  name: string;
  advertiser_id: string;
  advertiser: { name: string };
  payout_amount: number;
  created_at: string;
}

interface Advertiser {
  id: string;
  name: string;
}

export default function Offers() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    advertiser_id: '',
    payout_amount: '',
  });

  useEffect(() => {
    Promise.all([fetchOffers(), fetchAdvertisers()]);
  }, []);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/offers');
      setOffers(response.data.items);
    } catch (error) {
      console.error('Error fetching offers:', error);
      toast.error('Failed to fetch offers');
    } finally {
      setLoading(false);
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
      const payload = {
        ...formData,
        payout_amount: parseFloat(formData.payout_amount),
      };

      if (selectedOffer) {
        await api.put(`/api/offers/${selectedOffer.id}`, payload);
        toast.success('Offer updated successfully');
      } else {
        await api.post('/api/offers', payload);
        toast.success('Offer created successfully');
      }
      
      fetchOffers();
      closeModal();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to save offer');
    }
  };

  const handleDelete = async (offer: Offer) => {
    if (!confirm(`Are you sure you want to delete ${offer.name}?`)) return;
    
    try {
      await api.delete(`/api/offers/${offer.id}`);
      toast.success('Offer deleted successfully');
      fetchOffers();
    } catch (error) {
      toast.error('Failed to delete offer');
    }
  };

  const openModal = (offer?: Offer) => {
    if (offer) {
      setSelectedOffer(offer);
      setFormData({
        name: offer.name,
        advertiser_id: offer.advertiser_id,
        payout_amount: offer.payout_amount.toString(),
      });
    } else {
      setSelectedOffer(null);
      setFormData({ name: '', advertiser_id: '', payout_amount: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedOffer(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Offers</h1>
          <p className="text-gray-600 mt-1">Manage advertiser offers and payouts</p>
        </div>
        <button
          onClick={() => openModal()}
          className="mt-4 sm:mt-0 btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Offer</span>
        </button>
      </div>

      {/* Offers Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Advertiser
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Payout
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
                    {[...Array(5)].map((_, j) => (
                      <td key={j} className="table-cell">
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : offers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-cell text-center text-gray-500">
                    No offers found
                  </td>
                </tr>
              ) : (
                offers.map((offer) => (
                  <tr key={offer.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <span className="font-medium text-gray-900">{offer.name}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">{offer.advertiser.name}</span>
                    </td>
                    <td className="table-cell">
                      <span className="font-medium text-green-600">
                        ${offer.payout_amount.toFixed(2)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">
                        {new Date(offer.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openModal(offer)}
                          className="text-primary-600 hover:text-primary-700"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(offer)}
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
                  {selectedOffer ? 'Edit Offer' : 'Add New Offer'}
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
                    Payout Amount *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.payout_amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, payout_amount: e.target.value }))}
                      className="input-field pl-8"
                      required
                    />
                  </div>
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
                    {selectedOffer ? 'Update' : 'Create'}
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