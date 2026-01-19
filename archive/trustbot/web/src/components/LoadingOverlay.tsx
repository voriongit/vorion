/**
 * LoadingOverlay Component
 *
 * Displays a full-screen loading indicator during initial data fetch.
 */

interface LoadingOverlayProps {
    message?: string;
}

export function LoadingOverlay({ message = 'Connecting to Aurais HQ...' }: LoadingOverlayProps) {
    return (
        <div
            className="loading-overlay"
            role="status"
            aria-live="polite"
            aria-label="Loading"
        >
            <div className="loading-content">
                <div className="loading-spinner" aria-hidden="true">
                    <div className="spinner-ring"></div>
                    <div className="spinner-core"></div>
                </div>
                <p className="loading-message">{message}</p>
                <p className="loading-hint">Establishing secure connection...</p>
            </div>
        </div>
    );
}
