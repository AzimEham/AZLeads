import { useState } from 'react';
import toast from 'react-hot-toast';

export default function Settings() {
  const [settings, setSettings] = useState({
    retentionDays: '90',
    rateLimitTrack: '100',
    rateLimitGlobal: '500',
    hmacAlgo: 'sha256',
    timezone: 'Asia/Dhaka',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Settings updated successfully');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">System configuration and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Data Retention */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Retention</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Retention Period (Days)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={settings.retentionDays}
                onChange={(e) => setSettings(prev => ({ ...prev, retentionDays: e.target.value }))}
                className="input-field"
              />
              <p className="text-xs text-gray-500 mt-1">
                Traffic logs older than this will be purged
              </p>
            </div>
            <button type="submit" className="btn-primary">
              Update Retention
            </button>
          </form>
        </div>

        {/* Rate Limits */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Rate Limits</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Track API (per affiliate/second)
              </label>
              <input
                type="number"
                min="1"
                value={settings.rateLimitTrack}
                onChange={(e) => setSettings(prev => ({ ...prev, rateLimitTrack: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Global API (requests/second)
              </label>
              <input
                type="number"
                min="1"
                value={settings.rateLimitGlobal}
                onChange={(e) => setSettings(prev => ({ ...prev, rateLimitGlobal: e.target.value }))}
                className="input-field"
              />
            </div>
            <button type="submit" className="btn-primary">
              Update Rate Limits
            </button>
          </form>
        </div>

        {/* Security */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Security</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                HMAC Algorithm
              </label>
              <select
                value={settings.hmacAlgo}
                onChange={(e) => setSettings(prev => ({ ...prev, hmacAlgo: e.target.value }))}
                className="input-field"
              >
                <option value="sha256">SHA-256</option>
                <option value="sha512">SHA-512</option>
              </select>
            </div>
            <button type="submit" className="btn-primary">
              Update Security
            </button>
          </form>
        </div>

        {/* Timezone */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Timezone</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Timezone
              </label>
              <select
                value={settings.timezone}
                onChange={(e) => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
                className="input-field"
              >
                <option value="Asia/Dhaka">Asia/Dhaka (GMT+6)</option>
                <option value="UTC">UTC (GMT+0)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
              </select>
            </div>
            <button type="submit" className="btn-primary">
              Update Timezone
            </button>
          </form>
        </div>
      </div>

      {/* System Info */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Version</p>
            <p className="font-medium text-gray-900">AZLeads v1.0.0</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Environment</p>
            <p className="font-medium text-gray-900">Production</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Database</p>
            <p className="font-medium text-gray-900">PostgreSQL 15</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Queue</p>
            <p className="font-medium text-gray-900">BullMQ + Redis</p>
          </div>
        </div>
      </div>
    </div>
  );
}