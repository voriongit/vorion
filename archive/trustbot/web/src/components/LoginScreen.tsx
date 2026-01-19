import { useState, useCallback, memo } from 'react';
import { Tooltip } from './Tooltip';

interface LoginScreenProps {
    onLogin: (user?: { email: string; name: string; picture?: string }) => void;
}

// Static data - defined outside component to avoid recreation
const features = [
    {
        icon: '🛡️',
        title: '6-Tier Trust',
        desc: 'Graduated autonomy levels',
        tooltip: 'Agents earn autonomy through verified performance. From Tier 0 (observe-only) to Tier 5 (full sovereignty), each level unlocks more capabilities.'
    },
    {
        icon: '👁️',
        title: 'Real-Time',
        desc: 'Live agent monitoring',
        tooltip: 'Watch your AI agents work in real-time. See status changes, task progress, and trust score updates as they happen.'
    },
    {
        icon: '📋',
        title: 'Audit Trail',
        desc: 'Complete action history',
        tooltip: 'Every agent action is logged with cryptographic verification. Full transparency for compliance and debugging.'
    },
] as const;

const DEMO_USER = {
    email: 'demo@aurais.ai',
    name: 'Demo User',
    picture: undefined,
} as const;

export const LoginScreen = memo(function LoginScreen({ onLogin }: LoginScreenProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleEnter = useCallback(() => {
        setIsLoading(true);
        sessionStorage.setItem('aurais_user', JSON.stringify(DEMO_USER));
        sessionStorage.setItem('aurais_demo', 'true');
        onLogin(DEMO_USER);
    }, [onLogin]);

    return (
        <div className="login-screen">
            {/* Centered video container with content overlay */}
            <div className="login-video-frame">
                <video
                    className="login-video"
                    autoPlay
                    loop
                    muted
                    playsInline
                >
                    <source src="/aurais-intro.mp4" type="video/mp4" />
                </video>

                {/* Content overlaid on video */}
                <div className="login-video-content">
                    {/* Spacer to push content down */}
                    <div className="login-spacer" />

                    {/* Bottom content */}
                    <div className="login-bottom-content">
                        <p className="login-tagline">Sleep soundly while your agents work</p>

                        <div className="login-auth-section">
                            {isLoading ? (
                                <div className="login-loading">
                                    <div className="login-spinner" />
                                    <span>Authenticating...</span>
                                </div>
                            ) : (
                                <button
                                    onClick={handleEnter}
                                    className="login-demo-btn"
                                >
                                    Enter Aurais
                                </button>
                            )}
                        </div>

                        <div className="login-features">
                            {features.map((f, i) => (
                                <Tooltip
                                    key={i}
                                    content={f.tooltip}
                                    title={f.title}
                                    position="top"
                                >
                                    <div className="login-feature">
                                        <span className="login-feature-icon">{f.icon}</span>
                                        <div className="login-feature-text">
                                            <strong>{f.title}</strong>
                                            <span>{f.desc}</span>
                                        </div>
                                    </div>
                                </Tooltip>
                            ))}
                        </div>

                        <p className="login-footer">
                            AI Agent Governance Platform
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
});
