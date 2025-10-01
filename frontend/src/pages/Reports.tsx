import { useState, useEffect } from 'react';
import { api } from '../contexts/AuthContext';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface ReportData {
  performance: Array<{
    date: string;
    leads: number;
    conversions: number;
    revenue: number;
  }>;
  affiliatePerformance: Array<{
    affiliate: string;
    leads: number;
    conversions: number;
    revenue: number;
    conversionRate: number;
  }>;
  advertiserPerformance: Array<{
    advertiser: string;
    leads: number;
    conversions: number;
    payout: number;
  }>;
  conversionFunnel: Array<{
    stage: string;
    count: number;
    percentage: number;
  }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function Reports() {
  const [reportData, setReportData] = useState<ReportData>({
    performance: [],
    affiliatePerformance: [],
    advertiserPerformance: [],
    conversionFunnel: [],
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');
  const [activeTab, setActiveTab] = useState('performance');

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/reports?range=${dateRange}`);
      setReportData(response.data);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const dateRangeOptions = [
    { value: '7d', label: 'Last 7 Days' },
    { value: '14d', label: 'Last 14 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
  ];

  const tabs = [
    { id: 'performance', label: 'Performance Overview' },
    { id: 'affiliates', label: 'Affiliate Performance' },
    { id: 'advertisers', label: 'Advertiser Performance' },
    { id: 'funnel', label: 'Conversion Funnel' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-64 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">Analytics and performance insights</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="input-field w-full sm:w-auto"
          >
            {dateRangeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'performance' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Leads & Conversions Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={reportData.performance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="leads" stroke="#3b82f6" name="Leads" />
                <Line type="monotone" dataKey="conversions" stroke="#10b981" name="Conversions" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={reportData.performance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'affiliates' && (
        <div className="card overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Affiliate Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                    Affiliate
                  </th>
                  <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                    Leads
                  </th>
                  <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                    Conversions
                  </th>
                  <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                    Conversion Rate
                  </th>
                  <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.affiliatePerformance.map((affiliate, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <span className="font-medium text-gray-900">{affiliate.affiliate}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">{affiliate.leads.toLocaleString()}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">{affiliate.conversions.toLocaleString()}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">{affiliate.conversionRate.toFixed(1)}%</span>
                    </td>
                    <td className="table-cell">
                      <span className="font-medium text-green-600">
                        ${affiliate.revenue.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'advertisers' && (
        <div className="card overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Advertiser Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                    Advertiser
                  </th>
                  <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                    Leads
                  </th>
                  <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                    Conversions
                  </th>
                  <th className="table-cell text-left font-medium text-gray-500 uppercase tracking-wider">
                    Total Payout
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.advertiserPerformance.map((advertiser, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <span className="font-medium text-gray-900">{advertiser.advertiser}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">{advertiser.leads.toLocaleString()}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">{advertiser.conversions.toLocaleString()}</span>
                    </td>
                    <td className="table-cell">
                      <span className="font-medium text-blue-600">
                        ${advertiser.payout.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'funnel' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={reportData.conversionFunnel}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ stage, percentage }) => `${stage} (${percentage}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {reportData.conversionFunnel.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Funnel Breakdown</h3>
            <div className="space-y-4">
              {reportData.conversionFunnel.map((stage, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    ></div>
                    <span className="text-sm font-medium text-gray-900">{stage.stage}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {stage.count.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {stage.percentage}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}