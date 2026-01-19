/**
 * NavBar - Unified Navigation Component
 * Mobile-first design with bottom nav (mobile) and top header (desktop)
 */
import { useState, useEffect } from 'react';

// Navigation view types
export type NavView = 'console' | 'agents' | 'tasks' | 'artifacts' | 'council' | 'settings' | 'metrics' | 'help' | 'glossary';

interface NavBarProps {
    currentView: NavView;
    onNavigate: (view: NavView) => void;
    user?: { name: string; email: string; picture?: string } | null;
    userAuthority?: number; // T4+ (>=4) can see Council
    pendingCount?: number;
    onLogout?: () => void;
    onQuickAction?: (action: 'spawn' | 'tick' | 'task') => void;
}

// Navigation items configuration
const NAV_ITEMS: Array<{
    id: NavView;
    label: string;
    icon: string;
    minAuthority?: number;
    primary?: boolean;
}> = [
    { id: 'console', label: 'Console', icon: '🏠', primary: true },
    { id: 'agents', label: 'Agents', icon: '👥', primary: true },
    { id: 'tasks', label: 'Tasks', icon: '📋', primary: true },
    { id: 'artifacts', label: 'Artifacts', icon: '📦', primary: true },
    { id: 'council', label: 'Council', icon: '⚖️', minAuthority: 4 },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'metrics', label: 'Metrics', icon: '📊' },
    { id: 'help', label: 'Help', icon: '❓' },
    { id: 'glossary', label: 'Glossary', icon: '📖' },
];

export function NavBar({
    currentView,
    onNavigate,
    user,
    userAuthority = 0,
    pendingCount = 0,
    onLogout,
    onQuickAction,
}: NavBarProps) {
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    const [quickActionsOpen, setQuickActionsOpen] = useState(false);

    // Close menus on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.nav-more-menu') && !target.closest('.nav-more-btn')) {
                setMoreMenuOpen(false);
            }
            if (!target.closest('.nav-quick-menu') && !target.closest('.nav-fab') && !target.closest('.nav-action-btn')) {
                setQuickActionsOpen(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    // Filter items by authority
    const visibleItems = NAV_ITEMS.filter(
        item => !item.minAuthority || userAuthority >= item.minAuthority
    );
    const primaryItems = visibleItems.filter(item => item.primary);
    const moreItems = visibleItems.filter(item => !item.primary);

    const handleNavClick = (view: NavView) => {
        onNavigate(view);
        setMoreMenuOpen(false);
    };

    const handleQuickAction = (action: 'spawn' | 'tick' | 'task') => {
        onQuickAction?.(action);
        setQuickActionsOpen(false);
    };

    // Render both navs - CSS handles visibility based on screen size
    // This is more reliable than JS-based conditional rendering
    return (
        <>
            {/* Mobile bottom nav */}
            <nav className="nav-bar nav-bar--mobile" role="navigation" aria-label="Mobile navigation">
                {/* Primary nav items */}
                {primaryItems.map(item => (
                    <button
                        key={item.id}
                        className={`nav-item ${currentView === item.id ? 'nav-item--active' : ''}`}
                        onClick={() => handleNavClick(item.id)}
                        aria-current={currentView === item.id ? 'page' : undefined}
                    >
                        <span className="nav-item__icon">{item.icon}</span>
                        <span className="nav-item__label">{item.label}</span>
                    </button>
                ))}

                {/* Center FAB for quick actions */}
                <div className="nav-fab-container">
                    <button
                        className={`nav-fab ${quickActionsOpen ? 'nav-fab--active' : ''}`}
                        onClick={() => setQuickActionsOpen(!quickActionsOpen)}
                        aria-expanded={quickActionsOpen}
                        aria-label="Quick actions"
                    >
                        <span className="nav-fab__icon">✚</span>
                    </button>
                    {quickActionsOpen && (
                        <div className="nav-quick-menu" role="menu">
                            <button className="nav-quick-item" onClick={() => handleQuickAction('spawn')} role="menuitem">
                                <span>🤖</span> Spawn Agent
                            </button>
                            <button className="nav-quick-item" onClick={() => handleQuickAction('tick')} role="menuitem">
                                <span>⚡</span> System Tick
                            </button>
                            <button className="nav-quick-item" onClick={() => handleQuickAction('task')} role="menuitem">
                                <span>➕</span> New Task
                            </button>
                        </div>
                    )}
                </div>

                {/* More menu */}
                <div className="nav-more-container">
                    <button
                        className={`nav-item nav-more-btn ${moreMenuOpen ? 'nav-item--active' : ''}`}
                        onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                        aria-expanded={moreMenuOpen}
                        aria-label="More options"
                    >
                        <span className="nav-item__icon">⋯</span>
                        <span className="nav-item__label">More</span>
                        {pendingCount > 0 && (
                            <span className="nav-badge">{pendingCount > 9 ? '9+' : pendingCount}</span>
                        )}
                    </button>
                    {moreMenuOpen && (
                        <div className="nav-more-menu" role="menu">
                            {moreItems.map(item => (
                                <button
                                    key={item.id}
                                    className={`nav-more-item ${currentView === item.id ? 'nav-more-item--active' : ''}`}
                                    onClick={() => handleNavClick(item.id)}
                                    role="menuitem"
                                >
                                    <span className="nav-more-item__icon">{item.icon}</span>
                                    <span className="nav-more-item__label">{item.label}</span>
                                </button>
                            ))}
                            {user && (
                                <>
                                    <div className="nav-more-divider" />
                                    <div className="nav-more-user">
                                        {user.picture && (
                                            <img src={user.picture} alt="" className="nav-more-user__avatar" />
                                        )}
                                        <span className="nav-more-user__name">{user.name}</span>
                                    </div>
                                    <button className="nav-more-item nav-more-item--logout" onClick={onLogout} role="menuitem">
                                        <span className="nav-more-item__icon">🚪</span>
                                        <span className="nav-more-item__label">Sign Out</span>
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </nav>

            {/* Desktop header */}
            <header className="nav-bar nav-bar--desktop" role="navigation" aria-label="Desktop navigation">
            <div className="nav-brand">
                <span className="nav-brand__icon">🤖</span>
                <span className="nav-brand__title">Aurais HQ</span>
            </div>

            <div className="nav-links">
                {visibleItems.slice(0, 5).map(item => (
                    <button
                        key={item.id}
                        className={`nav-link ${currentView === item.id ? 'nav-link--active' : ''}`}
                        onClick={() => handleNavClick(item.id)}
                        aria-current={currentView === item.id ? 'page' : undefined}
                    >
                        <span className="nav-link__icon">{item.icon}</span>
                        <span className="nav-link__label">{item.label}</span>
                        {item.id === 'council' && pendingCount > 0 && (
                            <span className="nav-badge" style={{ background: 'var(--accent-gold)', color: '#000' }}>
                                {pendingCount}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <div className="nav-actions">
                {/* Quick actions dropdown */}
                <div className="nav-dropdown">
                    <button
                        className="nav-action-btn"
                        onClick={() => setQuickActionsOpen(!quickActionsOpen)}
                        aria-expanded={quickActionsOpen}
                    >
                        <span>✚</span> Actions
                    </button>
                    {quickActionsOpen && (
                        <div className="nav-dropdown-menu nav-quick-menu">
                            <button className="nav-dropdown-item" onClick={() => handleQuickAction('spawn')}>
                                <span>🤖</span> Spawn Agent
                            </button>
                            <button className="nav-dropdown-item" onClick={() => handleQuickAction('tick')}>
                                <span>⚡</span> System Tick
                            </button>
                            <button className="nav-dropdown-item" onClick={() => handleQuickAction('task')}>
                                <span>➕</span> New Task
                            </button>
                        </div>
                    )}
                </div>

                {/* User profile */}
                {user && (
                    <div className="nav-user">
                        {user.picture ? (
                            <img src={user.picture} alt="" className="nav-user__avatar" />
                        ) : (
                            <span className="nav-user__avatar nav-user__avatar--placeholder">
                                {user.name.charAt(0).toUpperCase()}
                            </span>
                        )}
                        <button className="nav-user__logout" onClick={onLogout} title="Sign out">
                            🚪
                        </button>
                    </div>
                )}
            </div>
        </header>
        </>
    );
}

export default NavBar;
