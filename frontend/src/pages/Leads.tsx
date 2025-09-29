import { useState, useEffect } from 'react';
import { api } from '../contexts/AuthContext';
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Eye,
  Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Lead {
  id: string;
  az_tx_id: string;
  affiliate: { name: string };
  advertiser: { name: string };
  offer: { name: string };
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  country: string;
  status: string;
  advertiser_status: string;
  ftd_at: string | null;
  payout: number;
  created_at: string;
}

interface Filters {
  search: string;
  status: string;
  affiliate_id: string;
  advertiser_id: string;
  country: string;
  date_from: string;
  date_to: string;
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: '',
    affiliate_id: '',
    advertiser_id: '',
    country: '',
    date_from: '',
    date_to: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
  });

  const [affiliates, setAffiliates] = useState([]);
  const [advertisers, setAdvertisers] = useState([]);

  useEffect(() => {
    fetchLeads();
    fetchFilterOptions();
  }, [filters, pagination.page]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        page_size: pagination.pageSize.toString(),
        ...filters,
      });

      const response = await api.get(`/api/leads?${params}`);
      setLeads(response.data.items);
      setPagination(prev => ({ 
        ...prev, 
        total: response.data.total 
      }));
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast.error('Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const [affiliatesResponse, advertisersResponse] = await Promise.all([
        api.get('/api/affiliates?page_size=100'),
        api.get('/api/advertisers?page_size=100')
      ]);
      setAffiliates(affiliatesResponse.data.items);
      setAdvertisers(advertisersResponse.data.items);
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const handleRetryLead = async (leadId: string) => {
    try {
      await api.post(`/api/leads/${leadId}/retry`);
      toast.success('Lead retry initiated');
      fetchLeads();
    } catch (error) {
      toast.error('Failed to retry lead');
    }
  };

  const exportCSV = async () => {
    try {
      const params = new URLSearchParams(filters);
      const response = await api.get(`/api/exports/leads.csv?${params}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leads_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('CSV export downloaded');
    } catch (error) {
      toast.error('Failed to export CSV');
    }
  };

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    forwarded: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    no_mapping: 'bg-gray-100 text-gray-800',
    forward_failed: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-600 mt-1">Manage and track all your leads</p>
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
            onClick={fetchLeads}
            className="btn-primary flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search email, phone..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="input-field pl-10"
            />
          </div>

          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="input-field"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="forwarded">Forwarded</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="no_mapping">No Mapping</option>
            <option value="forward_failed">Forward Failed</option>
          </select>

          <select
            value={filters.affiliate_id}
            onChange={(e) => setFilters(prev => ({ ...prev, affiliate_id: e.target.value }))}
            className="input-field"
          >
            <option value="">All Affiliates</option>
            {affiliates.map((affiliate: any) => (
              <option key={affiliate.id} value={affiliate.id}>
                {affiliate.name}
              </option>
            ))}
          </select>

          <select
            value={filters.advertiser_id}
            onChange={(e) => setFilters(prev => ({ ...prev, advertiser_id: e.target.value }))}
            className="input-field"
          >
            <option value="">All Advertisers</option>
            {advertisers.map((advertiser: any) => (
              <option key={advertiser.id} value={advertiser.id}>
                {advertiser.name}
              </option>
            ))}
          </select>

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
        </div>
      </div>

      {/* Leads Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  AZ Transaction ID
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Contact Info
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Affiliate
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Advertiser
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Payout
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="table-cell">
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-cell text-center text-gray-500">
                    No leads found
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <span className="font-mono text-sm text-primary-600">
                        {lead.az_tx_id}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div>
                        <p className="font-medium text-gray-900">
                          {lead.first_name} {lead.last_name}
                        </p>
                        <p className="text-sm text-gray-500">{lead.email}</p>
                        <p className="text-sm text-gray-500">{lead.phone}</p>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">{lead.affiliate?.name}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">{lead.advertiser?.name}</span>
                    </td>
                    <td className="table-cell">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        statusColors[lead.status as keyof typeof statusColors] || statusColors.pending
                      }`}>
                        {lead.status}
                      </span>
                      {lead.advertiser_status && (
                        <div className="mt-1">
                          <span className="text-xs text-gray-500">
                            Adv: {lead.advertiser_status}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className="font-medium text-gray-900">
                        ${lead.payout?.toFixed(2) || '0.00'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </span>
                      <p className="text-sm text-gray-500">
                        {new Date(lead.created_at).toLocaleTimeString()}
                      </p>
                    </td>
                    <td className="table-cell">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="text-primary-600 hover:text-primary-700"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRetryLead(lead.id)}
                          className="text-gray-600 hover:text-gray-700"
                          title="Retry"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
            {pagination.total} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page * pagination.pageSize >= pagination.total}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-black bg-opacity-50" onClick={() => setSelectedLead(null)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Lead Details - {selectedLead.az_tx_id}
                </h3>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <p className="text-sm text-gray-900">
                      {selectedLead.first_name} {selectedLead.last_name}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="text-sm text-gray-900">{selectedLead.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <p className="text-sm text-gray-900">{selectedLead.phone}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Country</label>
                    <p className="text-sm text-gray-900">{selectedLead.country}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      statusColors[selectedLead.status as keyof typeof statusColors]
                    }`}>
                      {selectedLead.status}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Payout</label>
                    <p className="text-sm text-gray-900">${selectedLead.payout?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => handleRetryLead(selectedLead.id)}
                  className="btn-secondary"
                >
                  Retry Forward
                </button>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="btn-primary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}