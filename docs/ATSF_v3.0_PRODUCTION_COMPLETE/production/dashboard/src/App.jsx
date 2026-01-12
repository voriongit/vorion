// ATSF v3.0 - Admin Dashboard
// ============================
// React-based admin dashboard for ATSF monitoring and management

import React, { useState, useEffect, useCallback } from 'react';

// =============================================================================
// API CLIENT
// =============================================================================

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class ATSFClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    return response.json();
  }

  // Health & Stats
  async getHealth() {
    return this.request('/health');
  }

  async getStats() {
    return this.request('/stats');
  }

  // Agents
  async getAgents(status = null) {
    const params = status ? `?status=${status}` : '';
    return this.request(`/agents${params}`);
  }

  async getAgent(agentId) {
    return this.request(`/agents/${agentId}`);
  }

  async createAgent(data) {
    return this.request('/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async activateAgent(agentId) {
    return this.request(`/agents/${agentId}/activate`, { method: 'POST' });
  }

  async suspendAgent(agentId, reason) {
    return this.request(`/agents/${agentId}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async quarantineAgent(agentId, reason) {
    return this.request(`/agents/${agentId}/quarantine`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Trust
  async getTrust(agentId) {
    return this.request(`/agents/${agentId}/trust`);
  }

  async getTrustHistory(agentId) {
    return this.request(`/agents/${agentId}/trust/history`);
  }

  // Assessments
  async getAssessment(agentId) {
    return this.request(`/agents/${agentId}/assessment`);
  }

  // Admin
  async getActionLog(limit = 100) {
    return this.request(`/admin/action-log?limit=${limit}`);
  }

  async getAssessmentLog(limit = 100) {
    return this.request(`/admin/assessment-log?limit=${limit}`);
  }
}

// =============================================================================
// COMPONENTS
// =============================================================================

// Status Badge Component
const StatusBadge = ({ status }) => {
  const colors = {
    active: 'bg-green-500',
    registered: 'bg-blue-500',
    suspended: 'bg-yellow-500',
    quarantined: 'bg-red-500',
    terminated: 'bg-gray-500',
  };

  return (
    <span className={`px-2 py-1 rounded text-white text-xs font-semibold ${colors[status] || 'bg-gray-400'}`}>
      {status?.toUpperCase()}
    </span>
  );
};

// Threat Level Badge
const ThreatBadge = ({ level }) => {
  const colors = {
    none: 'bg-green-500',
    low: 'bg-blue-500',
    moderate: 'bg-yellow-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500',
    catastrophic: 'bg-purple-500',
  };

  return (
    <span className={`px-2 py-1 rounded text-white text-xs font-semibold ${colors[level] || 'bg-gray-400'}`}>
      {level?.toUpperCase()}
    </span>
  );
};

// Stats Card Component
const StatsCard = ({ title, value, subtitle, icon }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-3xl font-bold text-gray-800">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <div className="text-4xl text-gray-300">{icon}</div>
    </div>
  </div>
);

// Agent Card Component
const AgentCard = ({ agent, onSelect, onAction }) => (
  <div 
    className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-lg transition-shadow"
    onClick={() => onSelect(agent)}
  >
    <div className="flex justify-between items-start mb-3">
      <div>
        <h3 className="font-semibold text-gray-800">{agent.agent_id}</h3>
        <p className="text-xs text-gray-500">{agent.transparency_tier}</p>
      </div>
      <StatusBadge status={agent.status} />
    </div>
    
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-500">Trust Score</span>
        <span className="font-medium">{(agent.trust_score * 100).toFixed(1)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-500 rounded-full h-2" 
          style={{ width: `${Math.min(agent.trust_score * 100, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>0%</span>
        <span>Ceiling: {(agent.trust_ceiling * 100).toFixed(0)}%</span>
      </div>
    </div>

    <div className="flex gap-2 mt-3">
      {agent.status === 'registered' && (
        <button 
          onClick={(e) => { e.stopPropagation(); onAction('activate', agent); }}
          className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
        >
          Activate
        </button>
      )}
      {agent.status === 'active' && (
        <button 
          onClick={(e) => { e.stopPropagation(); onAction('suspend', agent); }}
          className="px-3 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600"
        >
          Suspend
        </button>
      )}
      <button 
        onClick={(e) => { e.stopPropagation(); onAction('assess', agent); }}
        className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
      >
        Assess
      </button>
    </div>
  </div>
);

// Assessment Panel Component
const AssessmentPanel = ({ assessment }) => {
  if (!assessment) return null;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold">Threat Assessment</h3>
        <ThreatBadge level={assessment.threat_level} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-500">Risk Score</p>
          <p className="text-2xl font-bold">{(assessment.risk_score * 100).toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Total Signals</p>
          <p className="text-2xl font-bold">{assessment.total_signals}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Trust Velocity</p>
          <p className="text-2xl font-bold">{(assessment.trust_velocity * 100).toFixed(2)}%/hr</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Trust Score</p>
          <p className="text-2xl font-bold">{(assessment.trust_score * 100).toFixed(1)}%</p>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="font-medium mb-2">Recommended Action</h4>
        <p className="text-sm bg-gray-100 p-3 rounded">{assessment.recommended_action}</p>
      </div>

      {assessment.findings?.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Findings</h4>
          <ul className="text-sm space-y-1">
            {assessment.findings.map((finding, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-yellow-500">⚠</span>
                {finding}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// MAIN APP
// =============================================================================

const App = () => {
  const [apiKey, setApiKey] = useState(localStorage.getItem('atsf_api_key') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [client, setClient] = useState(null);
  
  // Data state
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [actionLog, setActionLog] = useState([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Initialize client
  useEffect(() => {
    if (apiKey) {
      const c = new ATSFClient(apiKey);
      setClient(c);
      localStorage.setItem('atsf_api_key', apiKey);
    }
  }, [apiKey]);

  // Verify authentication
  const verifyAuth = useCallback(async () => {
    if (!client) return;
    
    try {
      setLoading(true);
      await client.getHealth();
      setIsAuthenticated(true);
      setError(null);
    } catch (err) {
      setError('Invalid API key');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (client) {
      verifyAuth();
    }
  }, [client, verifyAuth]);

  // Load data
  const loadData = useCallback(async () => {
    if (!client || !isAuthenticated) return;
    
    try {
      setLoading(true);
      const [statsData, agentsData] = await Promise.all([
        client.getStats(),
        client.getAgents(),
      ]);
      setStats(statsData);
      setAgents(agentsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [client, isAuthenticated]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [loadData]);

  // Handle agent actions
  const handleAgentAction = async (action, agent) => {
    try {
      setLoading(true);
      
      switch (action) {
        case 'activate':
          await client.activateAgent(agent.agent_id);
          break;
        case 'suspend':
          await client.suspendAgent(agent.agent_id, 'Admin action');
          break;
        case 'assess':
          const assessmentData = await client.getAssessment(agent.agent_id);
          setAssessment(assessmentData);
          setSelectedAgent(agent);
          break;
        default:
          break;
      }
      
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Login form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg w-96">
          <h1 className="text-2xl font-bold mb-6 text-center">ATSF Admin</h1>
          
          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
              {error}
            </div>
          )}
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your API key"
            />
          </div>
          
          <button
            onClick={verifyAuth}
            disabled={loading || !apiKey}
            className="w-full bg-blue-500 text-white p-3 rounded font-medium hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Login'}
          </button>
        </div>
      </div>
    );
  }

  // Main dashboard
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">ATSF v3.0 Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {stats?.active_agents || 0} active agents
            </span>
            <button
              onClick={() => { setApiKey(''); setIsAuthenticated(false); }}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-6">
            {['dashboard', 'agents', 'logs'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading && (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded mb-6">
            {error}
            <button onClick={() => setError(null)} className="ml-4 underline">Dismiss</button>
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && stats && (
          <div>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <StatsCard 
                title="Total Agents" 
                value={stats.agents_registered} 
                subtitle="Registered"
                icon="👤"
              />
              <StatsCard 
                title="Active Agents" 
                value={stats.active_agents} 
                subtitle="Currently active"
                icon="✓"
              />
              <StatsCard 
                title="Quarantined" 
                value={stats.quarantined_agents} 
                subtitle="In isolation"
                icon="⚠"
              />
              <StatsCard 
                title="Threats Detected" 
                value={stats.threats_detected} 
                subtitle="Total alerts"
                icon="🔴"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard 
                title="Actions Processed" 
                value={stats.actions_processed} 
                icon="📋"
              />
              <StatsCard 
                title="Actions Blocked" 
                value={stats.actions_blocked} 
                icon="🛑"
              />
              <StatsCard 
                title="Assessments" 
                value={stats.assessments_performed} 
                icon="📊"
              />
              <StatsCard 
                title="Block Rate" 
                value={stats.actions_processed > 0 
                  ? `${((stats.actions_blocked / stats.actions_processed) * 100).toFixed(1)}%`
                  : '0%'
                } 
                icon="📈"
              />
            </div>
          </div>
        )}

        {/* Agents Tab */}
        {activeTab === 'agents' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Agents ({agents.length})</h2>
                <button 
                  onClick={loadData}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Refresh
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.agent_id}
                    agent={agent}
                    onSelect={setSelectedAgent}
                    onAction={handleAgentAction}
                  />
                ))}
              </div>
              
              {agents.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No agents registered
                </div>
              )}
            </div>

            <div>
              {assessment && <AssessmentPanel assessment={assessment} />}
              
              {selectedAgent && !assessment && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="font-semibold mb-4">Agent Details</h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">ID:</dt>
                      <dd className="font-medium">{selectedAgent.agent_id}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Status:</dt>
                      <dd><StatusBadge status={selectedAgent.status} /></dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Trust:</dt>
                      <dd className="font-medium">{(selectedAgent.trust_score * 100).toFixed(1)}%</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Containment:</dt>
                      <dd className="font-medium">{selectedAgent.containment_level}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Activity Log</h2>
            </div>
            <div className="p-4">
              <p className="text-gray-500 text-center py-8">
                Action logs will appear here
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
