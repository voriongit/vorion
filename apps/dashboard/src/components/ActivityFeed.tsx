import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';

interface ActivityEntry {
  agent: string;
  action: string;
  input?: string;
  result?: string;
  timestamp: number;
  success?: boolean;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const agentColors: Record<string, string> = {
  sentinel: 'bg-blue-500',
  scribe: 'bg-purple-500',
  envoy: 'bg-pink-500',
  curator: 'bg-cyan-500',
  watchman: 'bg-emerald-500',
  librarian: 'bg-amber-500',
  herald: 'bg-indigo-500',
  'ts-fixer': 'bg-yellow-500',
};

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function ActivityFeed() {
  const { data: activity, error } = useSWR<ActivityEntry[]>('/api/activity', fetcher, {
    refreshInterval: 5000,
  });

  if (error) {
    return (
      <div className="text-center py-8 text-slate-500">
        Failed to load activity
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-white/5 rounded-lg">
            <div className="w-8 h-8 bg-white/10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-white/10 rounded w-1/3" />
              <div className="h-2 bg-white/5 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activity.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <div className="text-3xl mb-2">🔇</div>
        <div>No recent activity</div>
        <div className="text-xs mt-1">Run an agent to see activity here</div>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
      <AnimatePresence mode="popLayout">
        {activity.map((entry, index) => {
          const agentColor = agentColors[entry.agent?.toLowerCase()] || 'bg-slate-500';
          const isSuccess = entry.success !== false;

          return (
            <motion.div
              key={`${entry.timestamp}-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
              className="group flex items-start gap-3 p-3 bg-white/[0.02] hover:bg-white/[0.05] rounded-lg border border-white/5 transition-colors"
            >
              {/* Agent Avatar */}
              <div className={`w-8 h-8 rounded-full ${agentColor} flex items-center justify-center text-white text-xs font-bold uppercase flex-shrink-0`}>
                {entry.agent?.[0] || '?'}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-200 text-sm capitalize">
                    {entry.agent || 'Unknown'}
                  </span>
                  <span className="text-slate-500 text-xs">
                    {entry.action}
                  </span>
                  {!isSuccess && (
                    <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded font-medium">
                      FAILED
                    </span>
                  )}
                </div>
                {entry.input && (
                  <p className="text-slate-500 text-xs mt-1 truncate">
                    {entry.input}
                  </p>
                )}
              </div>

              {/* Timestamp */}
              <div className="text-[10px] text-slate-600 font-mono flex-shrink-0">
                {formatTimeAgo(entry.timestamp)}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function ActivityFeedCompact() {
  const { data: activity } = useSWR<ActivityEntry[]>('/api/activity', fetcher, {
    refreshInterval: 5000,
  });

  const recentActivity = activity?.slice(0, 5) || [];

  return (
    <div className="space-y-1">
      {recentActivity.map((entry, index) => {
        const agentColor = agentColors[entry.agent?.toLowerCase()] || 'bg-slate-500';
        return (
          <div
            key={`${entry.timestamp}-${index}`}
            className="flex items-center gap-2 text-xs"
          >
            <div className={`w-2 h-2 rounded-full ${agentColor}`} />
            <span className="text-slate-400 capitalize">{entry.agent}</span>
            <span className="text-slate-600">{entry.action}</span>
            <span className="text-slate-700 ml-auto font-mono">{formatTimeAgo(entry.timestamp)}</span>
          </div>
        );
      })}
      {recentActivity.length === 0 && (
        <div className="text-xs text-slate-600 italic">No recent activity</div>
      )}
    </div>
  );
}
