/**
 * BottomNav - Mobile-first bottom tab navigation
 * 
 * Touch-friendly navigation bar for mobile devices.
 * Hides on desktop where sidebar/top nav takes over.
 */

import { useNavigate, useLocation } from 'react-router-dom';
import './BottomNav.css';

interface NavItem {
    path: string;
    icon: string;
    label: string;
}

const NAV_ITEMS: NavItem[] = [
    { path: '/console', icon: '🏠', label: 'Home' },
    { path: '/agents', icon: '🤖', label: 'Agents' },
    { path: '/tasks', icon: '📋', label: 'Tasks' },
    { path: '/artifacts', icon: '📦', label: 'Artifacts' },
    { path: '/settings', icon: '⚙️', label: 'Settings' },
];

interface BottomNavProps {
    pendingCount?: number;
}

export function BottomNav({ pendingCount = 0 }: BottomNavProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;

    return (
        <nav className="bottom-nav glass" role="navigation" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => {
                const isActive = currentPath.startsWith(item.path);
                return (
                    <button
                        key={item.path}
                        className={`bottom-nav-item touch-target ${isActive ? 'active' : ''}`}
                        onClick={() => navigate(item.path)}
                        aria-current={isActive ? 'page' : undefined}
                    >
                        <span className="bottom-nav-icon">
                            {item.icon}
                            {item.path === '/tasks' && pendingCount > 0 && (
                                <span className="bottom-nav-badge">{pendingCount}</span>
                            )}
                        </span>
                        <span className="bottom-nav-label">{item.label}</span>
                        {isActive && <span className="bottom-nav-indicator" />}
                    </button>
                );
            })}
        </nav>
    );
}
