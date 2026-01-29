'use client';

import {
  Activity,
  Cpu,
  HardDrive,
  Wifi,
  Clock,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Server,
  Database,
  Globe,
  Zap,
} from 'lucide-react';

const services = [
  { name: 'API Gateway', status: 'healthy', latency: '12ms', uptime: '99.99%', icon: Globe },
  { name: 'Cognigate Core', status: 'healthy', latency: '8ms', uptime: '99.98%', icon: Zap },
  { name: 'Trust Engine', status: 'healthy', latency: '15ms', uptime: '99.97%', icon: Activity },
  { name: 'Governance Service', status: 'healthy', latency: '11ms', uptime: '99.99%', icon: Server },
  { name: 'Proof Chain', status: 'degraded', latency: '45ms', uptime: '99.85%', icon: Database },
  { name: 'Auth Service', status: 'healthy', latency: '9ms', uptime: '100%', icon: Wifi },
];

const alerts = [
  {
    id: '1',
    severity: 'warning',
    message: 'Proof Chain latency elevated',
    service: 'Proof Chain',
    time: '5 minutes ago',
  },
  {
    id: '2',
    severity: 'info',
    message: 'Scheduled maintenance in 2 hours',
    service: 'All Services',
    time: '1 hour ago',
  },
  {
    id: '3',
    severity: 'resolved',
    message: 'API rate limiting incident resolved',
    service: 'API Gateway',
    time: '3 hours ago',
  },
];

const metrics = [
  { name: 'API Requests/sec', value: '8,423', change: '+12%', icon: Activity },
  { name: 'Avg Response Time', value: '23ms', change: '-5%', icon: Clock },
  { name: 'Error Rate', value: '0.02%', change: '-0.01%', icon: AlertTriangle },
  { name: 'Active Connections', value: '12,847', change: '+8%', icon: Wifi },
];

export default function MonitoringPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Monitoring</h1>
          <p className="text-gray-500">Real-time platform health and performance</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="flex items-center gap-2 text-green-400">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            All Systems Operational
          </span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div key={metric.name} className="stat-card">
            <div className="flex items-center justify-between">
              <metric.icon className="w-5 h-5 text-admin-primary" />
              <span className={`text-sm ${
                metric.change.startsWith('+') && metric.name !== 'Error Rate' ? 'text-green-400' :
                metric.change.startsWith('-') && metric.name === 'Error Rate' ? 'text-green-400' :
                metric.change.startsWith('-') ? 'text-green-400' : 'text-amber-400'
              }`}>
                {metric.change}
              </span>
            </div>
            <p className="text-2xl font-bold mt-2">{metric.value}</p>
            <p className="text-sm text-gray-500">{metric.name}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service Status */}
        <div className="lg:col-span-2 glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Service Status</h2>
          <div className="space-y-3">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-4 rounded-lg bg-gray-800/30"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    service.status === 'healthy' ? 'bg-green-500/20' : 'bg-amber-500/20'
                  }`}>
                    <service.icon className={`w-5 h-5 ${
                      service.status === 'healthy' ? 'text-green-400' : 'text-amber-400'
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium">{service.name}</p>
                    <p className={`text-sm ${
                      service.status === 'healthy' ? 'text-green-400' : 'text-amber-400'
                    }`}>
                      {service.status === 'healthy' ? 'Healthy' : 'Degraded'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right">
                    <p className="text-gray-500">Latency</p>
                    <p className="font-medium">{service.latency}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500">Uptime</p>
                    <p className="font-medium text-green-400">{service.uptime}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Alerts</h2>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="p-3 rounded-lg bg-gray-800/30">
                <div className="flex items-start gap-3">
                  {alert.severity === 'warning' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  ) : alert.severity === 'resolved' ? (
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Activity className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-sm">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span>{alert.service}</span>
                      <span>•</span>
                      <span>{alert.time}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Infrastructure */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Infrastructure</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* CPU */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-blue-400" />
                <span>CPU Usage</span>
              </div>
              <span className="font-medium">42%</span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: '42%' }} />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>16 cores</span>
              <span>Peak: 78%</span>
            </div>
          </div>

          {/* Memory */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-violet-400" />
                <span>Memory</span>
              </div>
              <span className="font-medium">67%</span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full" style={{ width: '67%' }} />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>43 GB / 64 GB</span>
              <span>Peak: 89%</span>
            </div>
          </div>

          {/* Storage */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-green-400" />
                <span>Storage</span>
              </div>
              <span className="font-medium">34%</span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: '34%' }} />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>3.4 TB / 10 TB</span>
              <span>+12 GB/day</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
