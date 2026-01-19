/**
 * ErrorBanner Component
 *
 * Displays API connection errors with detailed diagnostics,
 * step-by-step fix instructions, and quick action buttons.
 */

import { useState, useRef } from 'react';
import './ErrorBanner.css';

interface ConnectionEndpoint {
    name: string;
    url: string;
    status: 'unknown' | 'checking' | 'connected' | 'failed';
    lastChecked?: Date;
    error?: string;
    responseTime?: number;
}

interface ErrorBannerProps {
    error: string;
    onRetry?: () => void;
    onDismiss?: () => void;
    onOpenSettings?: () => void;
}

// Comprehensive error definitions
interface ErrorDefinition {
    type: 'network' | 'server' | 'auth' | 'timeout' | 'cors' | 'unknown';
    title: string;
    icon: string;
    statusCode?: number;
    cause: string;
    steps: string[];
    quickActions?: { label: string; action: string }[];
}

// Error lookup table with all possible errors
const ERROR_DEFINITIONS: Record<string, ErrorDefinition> = {
    // Network Errors
    'failed to fetch': {
        type: 'network',
        title: 'Connection Failed',
        icon: '🌐',
        cause: 'Cannot reach the API server. The server may not be running.',
        steps: [
            'Open a terminal in the project root folder',
            'Run: npm run dev',
            'Wait for "Aurais System - ONLINE" message',
            'Click Retry below'
        ],
        quickActions: [
            { label: '📋 Copy Start Command', action: 'copy:npm run dev' }
        ]
    },
    'network error': {
        type: 'network',
        title: 'Network Error',
        icon: '📡',
        cause: 'Your device cannot connect to the network.',
        steps: [
            'Check your internet connection',
            'Verify WiFi/Ethernet is connected',
            'Try opening another website to test',
            'Restart your router if needed'
        ]
    },
    'err_connection_refused': {
        type: 'network',
        title: 'Connection Refused',
        icon: '🚫',
        cause: 'The API server is not accepting connections on port 3003.',
        steps: [
            'Ensure the API server is running',
            'Check if port 3003 is blocked by firewall',
            'Verify no other app is using port 3003',
            'Run: npm run dev in the project root'
        ]
    },
    'cors': {
        type: 'cors',
        title: 'CORS Blocked',
        icon: '🔒',
        cause: 'The API server is blocking requests from this origin.',
        steps: [
            'This is a server configuration issue',
            'The API needs to allow requests from localhost:3000',
            'Check the server CORS settings',
            'Contact the developer if this persists'
        ]
    },
    // Auth Errors
    '401': {
        type: 'auth',
        title: 'Session Expired',
        icon: '🔐',
        statusCode: 401,
        cause: 'Your login session has expired or is invalid.',
        steps: [
            'Click the Sign Out button',
            'Sign in again with your credentials',
            'If using API keys, verify they are correct'
        ],
        quickActions: [
            { label: '🚪 Sign Out', action: 'signout' }
        ]
    },
    '403': {
        type: 'auth',
        title: 'Access Denied',
        icon: '⛔',
        statusCode: 403,
        cause: 'You don\'t have permission to access this resource.',
        steps: [
            'Verify you have the required permissions',
            'Contact an administrator for access',
            'Check if your account is active'
        ]
    },
    '404': {
        type: 'server',
        title: 'Not Found',
        icon: '🔍',
        statusCode: 404,
        cause: 'The requested resource or endpoint doesn\'t exist.',
        steps: [
            'The API endpoint may have changed',
            'Check if you\'re using the correct API version',
            'Verify the URL is correct'
        ]
    },
    // Server Errors
    '500': {
        type: 'server',
        title: 'Server Error',
        icon: '💥',
        statusCode: 500,
        cause: 'The server encountered an internal error.',
        steps: [
            'This is usually temporary - try again in a moment',
            'Check the server logs for details',
            'Restart the server if the issue persists',
            'Report this error if it continues'
        ]
    },
    '502': {
        type: 'server',
        title: 'Bad Gateway',
        icon: '🌉',
        statusCode: 502,
        cause: 'A proxy or gateway received an invalid response.',
        steps: [
            'The API server may be starting up',
            'Wait 10-30 seconds and retry',
            'Check if the server crashed'
        ]
    },
    '503': {
        type: 'server',
        title: 'Service Unavailable',
        icon: '🔧',
        statusCode: 503,
        cause: 'The server is temporarily overloaded or under maintenance.',
        steps: [
            'Wait a few minutes and try again',
            'The server may be restarting',
            'Check for scheduled maintenance'
        ]
    },
    '504': {
        type: 'server',
        title: 'Gateway Timeout',
        icon: '⏱️',
        statusCode: 504,
        cause: 'The server took too long to respond.',
        steps: [
            'The request may be too complex',
            'Check your connection speed',
            'Try with a simpler request'
        ]
    },
    // Timeout
    'timeout': {
        type: 'timeout',
        title: 'Request Timeout',
        icon: '⏳',
        cause: 'The request took too long to complete.',
        steps: [
            'Check your internet connection speed',
            'The server may be under heavy load',
            'Try again in a few moments'
        ]
    },
    'aborted': {
        type: 'timeout',
        title: 'Request Cancelled',
        icon: '🛑',
        cause: 'The request was cancelled before completing.',
        steps: [
            'This can happen if you navigate away quickly',
            'Simply retry the action'
        ]
    }
};

// Parse error to get definition
function parseError(error: string): ErrorDefinition {
    const lowerError = error.toLowerCase();
    
    // Check for specific patterns
    for (const [pattern, definition] of Object.entries(ERROR_DEFINITIONS)) {
        if (lowerError.includes(pattern)) {
            return definition;
        }
    }
    
    // Check for HTTP status codes
    const statusMatch = error.match(/(\d{3})/);
    if (statusMatch) {
        const code = statusMatch[1];
        if (ERROR_DEFINITIONS[code]) {
            return ERROR_DEFINITIONS[code];
        }
    }
    
    // Default unknown error
    return {
        type: 'unknown',
        title: 'Unexpected Error',
        icon: '❓',
        cause: 'An unexpected error occurred.',
        steps: [
            'Try refreshing the page',
            'Check the browser console for details',
            'Clear your browser cache',
            'Contact support if this persists'
        ]
    };
}

// Default endpoints to check
const DEFAULT_ENDPOINTS: ConnectionEndpoint[] = [
    { name: 'API Server', url: 'http://127.0.0.1:3003/health', status: 'unknown' },
    { name: 'State API', url: 'http://127.0.0.1:3003/api/state', status: 'unknown' },
];

export function ErrorBanner({ error, onRetry, onDismiss, onOpenSettings }: ErrorBannerProps) {
    const [showDiagnostics, setShowDiagnostics] = useState(false);
    const [showSteps, setShowSteps] = useState(true);
    const [endpoints, setEndpoints] = useState<ConnectionEndpoint[]>(DEFAULT_ENDPOINTS);
    const [isChecking, setIsChecking] = useState(false);
    const [copied, setCopied] = useState(false);
    const diagnosticsRef = useRef<HTMLDivElement>(null);

    const errorDef = parseError(error);

    // Copy error to clipboard
    const copyError = async () => {
        const errorReport = `
Error: ${errorDef.title}
Type: ${errorDef.type}
${errorDef.statusCode ? `Status Code: ${errorDef.statusCode}` : ''}
Cause: ${errorDef.cause}
Raw Error: ${error}
Timestamp: ${new Date().toISOString()}
        `.trim();
        
        await navigator.clipboard.writeText(errorReport);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Handle quick actions
    const handleQuickAction = (action: string) => {
        if (action.startsWith('copy:')) {
            navigator.clipboard.writeText(action.replace('copy:', ''));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } else if (action === 'signout') {
            sessionStorage.clear();
            window.location.reload();
        }
    };

    // Run connection diagnostics
    const runDiagnostics = async () => {
        setIsChecking(true);
        setShowDiagnostics(true);

        const updatedEndpoints = await Promise.all(
            endpoints.map(async (endpoint) => {
                const start = Date.now();
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000);

                    const res = await fetch(endpoint.url, {
                        method: 'GET',
                        signal: controller.signal,
                    });

                    clearTimeout(timeoutId);
                    const responseTime = Date.now() - start;

                    return {
                        ...endpoint,
                        status: res.ok ? 'connected' : 'failed',
                        lastChecked: new Date(),
                        responseTime,
                        error: res.ok ? undefined : `HTTP ${res.status}`,
                    } as ConnectionEndpoint;
                } catch (e) {
                    return {
                        ...endpoint,
                        status: 'failed',
                        lastChecked: new Date(),
                        error: e instanceof Error ? e.message : 'Unknown error',
                    } as ConnectionEndpoint;
                }
            })
        );

        setEndpoints(updatedEndpoints);
        setIsChecking(false);
        
        // Scroll to diagnostics panel
        setTimeout(() => {
            diagnosticsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    };

    return (
        <div className="error-banner" role="alert" aria-live="assertive">
            {/* Header */}
            <div className="error-header-row">
                <span className="error-icon-large">{errorDef.icon}</span>
                <div className="error-title-section">
                    <h3 className="error-title">{errorDef.title}</h3>
                    {errorDef.statusCode && (
                        <span className="error-status-code">HTTP {errorDef.statusCode}</span>
                    )}
                </div>
                <div className="error-header-actions">
                    {onRetry && (
                        <button className="btn btn-small btn-primary" onClick={onRetry}>
                            🔄 Retry
                        </button>
                    )}
                    {onDismiss && (
                        <button className="btn btn-small btn-ghost" onClick={onDismiss} aria-label="Dismiss">
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Cause */}
            <p className="error-cause">{errorDef.cause}</p>

            {/* Step-by-step fix instructions */}
            <div className="error-steps-section">
                <button 
                    className="steps-toggle"
                    onClick={() => setShowSteps(!showSteps)}
                >
                    {showSteps ? '▼' : '▶'} How to fix this
                </button>
                {showSteps && (
                    <ol className="error-steps">
                        {errorDef.steps.map((step, i) => (
                            <li key={i}>{step}</li>
                        ))}
                    </ol>
                )}
            </div>

            {/* Quick Actions */}
            <div className="error-actions">
                {errorDef.quickActions?.map((qa, i) => (
                    <button
                        key={i}
                        className="btn btn-small"
                        onClick={() => handleQuickAction(qa.action)}
                    >
                        {qa.label}
                    </button>
                ))}
                <button
                    className="btn btn-small"
                    onClick={runDiagnostics}
                    disabled={isChecking}
                >
                    {isChecking ? '⏳' : '🔍'} Diagnose
                </button>
                {onOpenSettings && (
                    <button className="btn btn-small" onClick={onOpenSettings}>
                        ⚙️ Settings
                    </button>
                )}
                <button
                    className="btn btn-small"
                    onClick={copyError}
                >
                    {copied ? '✅ Copied!' : '📋 Copy Error'}
                </button>
            </div>

            {/* Diagnostics Panel */}
            {showDiagnostics && (
                <div ref={diagnosticsRef} className="error-diagnostics">
                    <div className="diagnostics-header">
                        <span>🔬 Connection Diagnostics</span>
                        <button
                            className="btn btn-ghost btn-tiny"
                            onClick={() => setShowDiagnostics(false)}
                        >
                            ✕
                        </button>
                    </div>
                    <div className="diagnostics-grid">
                        {endpoints.map((endpoint, idx) => (
                            <div key={idx} className={`endpoint-card endpoint-${endpoint.status}`}>
                                <div className="endpoint-header">
                                    <span className="endpoint-status-icon">
                                        {endpoint.status === 'connected' ? '✅' :
                                         endpoint.status === 'failed' ? '❌' :
                                         endpoint.status === 'checking' ? '⏳' : '⚪'}
                                    </span>
                                    <span className="endpoint-name">{endpoint.name}</span>
                                </div>
                                <div className="endpoint-url">{endpoint.url}</div>
                                {endpoint.status === 'connected' && endpoint.responseTime && (
                                    <div className="endpoint-timing">⚡ {endpoint.responseTime}ms</div>
                                )}
                                {endpoint.status === 'failed' && endpoint.error && (
                                    <div className="endpoint-error">⚠️ {endpoint.error}</div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="diagnostics-actions">
                        <button
                            className="btn btn-small"
                            onClick={runDiagnostics}
                            disabled={isChecking}
                        >
                            🔄 Re-check All
                        </button>
                    </div>
                </div>
            )}

            <p className="error-hint">🔌 Using offline data. Some features may be unavailable.</p>
        </div>
    );
}
