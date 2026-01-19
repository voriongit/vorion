/**
 * App Layout - Wrapper for all pages
 * Contains NavBar and provides shared context
 */
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { NavBar, type NavView } from './NavBar';
import { useAurais } from '../hooks';
import { api } from '../api';
import { LoadingOverlay } from './LoadingOverlay';
import { ErrorBanner } from './ErrorBanner';
import { BottomNav } from './BottomNav';

// Agent detail modal imports (keep as popup)
import { AgentProfilePage } from './AgentProfilePage';

export function AppLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    
    const {
        agents,
        blackboardEntries,
        approvals,
        hitlLevel,
        loading,
        error,
        refresh,
    } = useAurais();

    // Current view derived from route
    const currentView = (location.pathname.split('/')[1] || 'console') as NavView;

    // Auth state
    const [_authenticated, setAuthenticated] = useState(() => {
        return sessionStorage.getItem('aurais_auth') === 'true';
    });
    const [currentUser, setCurrentUser] = useState<{ email: string; name: string; picture?: string } | null>(() => {
        const stored = sessionStorage.getItem('aurais_user');
        return stored ? JSON.parse(stored) : null;
    });

    // Modal state (for agent details popup)
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    
    // Error dismissal state
    const [errorDismissed, setErrorDismissed] = useState(false);

    // Auto-tick
    const [autoTickEnabled, setAutoTickEnabled] = useState(false);
    const autoTickInterval = 5000;

    useEffect(() => {
        if (!autoTickEnabled) return;
        const intervalId = setInterval(async () => {
            try {
                await api.tick();
                await refresh();
            } catch (e) {
                console.error('Auto-tick failed:', e);
            }
        }, autoTickInterval);
        return () => clearInterval(intervalId);
    }, [autoTickEnabled, refresh]);

    const handleLogout = () => {
        setAuthenticated(false);
        setCurrentUser(null);
        sessionStorage.removeItem('aurais_auth');
        sessionStorage.removeItem('aurais_user');
    };

    // Navigation handler - uses real routing
    const handleNavigation = (view: NavView) => {
        navigate(`/${view}`);
    };

    const handleQuickAction = async (action: 'spawn' | 'tick' | 'task') => {
        switch (action) {
            case 'tick':
                await api.tick();
                await refresh();
                break;
            case 'spawn':
                navigate('/agents?spawn=true');
                break;
            case 'task':
                navigate('/tasks?create=true');
                break;
        }
    };

    const selectedAgent = agents.find(a => a.id === selectedAgentId);
    const showInitialLoading = loading && agents.length === 0;

    return (
        <div className="app-container app-container--with-nav">
            {showInitialLoading && <LoadingOverlay />}
            
            {error && !errorDismissed && (
                <ErrorBanner
                    error={error}
                    onRetry={() => { setErrorDismissed(false); refresh(); }}
                    onDismiss={() => setErrorDismissed(true)}
                    onOpenSettings={() => navigate('/settings?tab=connections')}
                />
            )}

            <NavBar
                currentView={currentView}
                onNavigate={handleNavigation}
                user={currentUser}
                userAuthority={9}
                pendingCount={approvals.length}
                onLogout={handleLogout}
                onQuickAction={handleQuickAction}
            />

            {/* Page content rendered by router */}
            <Outlet context={{
                agents,
                blackboardEntries,
                approvals,
                hitlLevel,
                currentUser,
                refresh,
                openAgentDetail: (id: string) => setSelectedAgentId(id),
                autoTickEnabled,
                setAutoTickEnabled,
            }} />

            {/* Agent Detail Popup (modal overlay) */}
            {selectedAgent && (
                <AgentProfilePage
                    agent={selectedAgent}
                    allAgents={agents}
                    blackboardEntries={blackboardEntries}
                    onClose={() => setSelectedAgentId(null)}
                    onViewAgent={(id) => setSelectedAgentId(id)}
                    onSendCommand={async () => null}
                    onEvaluateAutonomy={() => {}}
                    onPauseAgent={async () => {}}
                    onResumeAgent={async () => {}}
                    onDeleteAgent={async () => {}}
                    onReassignAgent={() => {}}
                    onEditPermissions={() => {}}
                    onOpenTaskQueue={() => {}}
                />
            )}

            {/* Mobile Bottom Navigation */}
            <BottomNav pendingCount={approvals.length} />
        </div>
    );
}
