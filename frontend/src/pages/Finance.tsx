import { useState, useEffect } from 'react';
import { api } from '../contexts/AuthContext';
import { Plus, Download } from 'lucide-react';
import toast from 'react-hot-toast';

interface Commission {
  id: string;
  lead: {
    id: string;
    az_tx_id: string;
  };
  advertiser: { name: string };
  affiliate: { name: string };
  amount: number;
  description: string;
  created_at: string;
}

export default function Finance() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [summary, setSummary] = useState({
    totalCommissions: 0,
    pendingPayouts: 0,
    thisMonth: 0,
  });

  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    affiliate_id: '',
    advertiser_id: '',
  });

  const [formData, setFormData] = useState({
    lead_id: '',
    amount: '',
    description: '',
  });

  useEffect(() => {
    fetchCommissions();
    fetchSummary();
  }, [filters]);

  const fetchCommissions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams(filters);
      const response = await api.get(`/api/commissions?${params}`);
      setCommissions(response.data.items);
    } catch (error) {
      console.error('Error fetching commissions:', error);
      toast.error('Failed to fetch commissions');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await api.get('/api/finance/summary');
      setSummary(response.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
      };

      await api.post('/api/commissions', payload);
      toast.success('Manual adjustment created');
      fetchCommissions();
      fetchSummary();
      closeModal();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to create adjustment');
    }
  };

  const exportCSV = async () => {
    try {
      const params = new URLSearchParams(filters);
      const response = await api.get(`/api/exports/commissions.csv?${params}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `commissions_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('CSV export downloaded');
    } catch (error) {
      toast.error('Failed to export CSV');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setFormData({ lead_id: '', amount: '', description: '' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
          <p className="text-gray-600 mt-1">Commission tracking and financial overview</p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button
            onClick={exportCSV}
            className="btn-secondary flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Manual Adjustment</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Commissions</p>
              <p className="text-2xl font-bold text-gray-900">
                ${summary.totalCommissions.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="w-6 h-6 bg-green-500 rounded"></div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Payouts</p>
              <p className="text-2xl font-bold text-gray-900">
                ${summary.pendingPayouts.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <div className="w-6 h-6 bg-yellow-500 rounded"></div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-gray-900">
                ${summary.thisMonth.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="w-6 h-6 bg-blue-500 rounded"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
            className="input-field"
            placeholder="From Date"
          />
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
            className="input-field"
            placeholder="To Date"
          />
          <input
            type="text"
            value={filters.affiliate_id}
            onChange={(e) => setFilters(prev => ({ ...prev, affiliate_id: e.target.value }))}
            className="input-field"
            placeholder="Affiliate"
          />
          <input
            type="text"
            value={filters.advertiser_id}
            onChange={(e) => setFilters(prev => ({ ...prev, advertiser_id: e.target.value }))}
            className="input-field"
            placeholder="Advertiser"
          />
        </div>
      </div>

      {/* Commissions Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Lead
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Affiliate
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Advertiser
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="table-cell">
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : commissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-cell text-center text-gray-500">
                    No commissions found
                  </td>
                </tr>
              ) : (
                commissions.map((commission) => (
                  <tr key={commission.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <span className="font-mono text-sm text-primary-600">
                        {commission.lead?.az_tx_id || 'Manual'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">{commission.affiliate.name}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">{commission.advertiser.name}</span>
                    </td>
                    <td className="table-cell">
                      <span className={`font-medium ${
                        commission.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ${commission.amount.toFixed(2)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">{commission.description}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">
                        {new Date(commission.created_at).toLocaleDateString()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Adjustment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-black bg-opacity-50" onClick={closeModal}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900">Manual Adjustment</h3>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lead ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.lead_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, lead_id: e.target.value }))}
                    className="input-field"
                    placeholder="Leave empty for manual adjustment"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      className="input-field pl-8"
                      required
                      placeholder="Use negative for deductions"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="input-field"
                    rows={3}
                    required
                    placeholder="Reason for adjustment"
                  />
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
                    Create Adjustment
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