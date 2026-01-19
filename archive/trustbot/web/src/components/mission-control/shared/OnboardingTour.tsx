/**
 * OnboardingTour Component
 *
 * Epic 8: Onboarding & Education
 * Story 8.1: Guided Tooltip Tour (FR46)
 * Story 8.2: First Denial Learning Popup (FR47)
 * Story 8.3: First Approval Request Learning (FR48)
 * Story 8.4: Tier Change Learning (FR49)
 */

import { memo, useState, useEffect, useCallback } from 'react';
import type {
    TourStep,
    TourConfig,
    LearningPopup,
} from '../../../types';

// ============================================================================
// Helper Functions
// ============================================================================

export function getPlacementStyle(placement: TourStep['placement'], targetRect: DOMRect): React.CSSProperties {
    const offset = 12;
    const styles: Record<TourStep['placement'], React.CSSProperties> = {
        top: { bottom: `${window.innerHeight - targetRect.top + offset}px`, left: `${targetRect.left + targetRect.width / 2}px`, transform: 'translateX(-50%)' },
        bottom: { top: `${targetRect.bottom + offset}px`, left: `${targetRect.left + targetRect.width / 2}px`, transform: 'translateX(-50%)' },
        left: { top: `${targetRect.top + targetRect.height / 2}px`, right: `${window.innerWidth - targetRect.left + offset}px`, transform: 'translateY(-50%)' },
        right: { top: `${targetRect.top + targetRect.height / 2}px`, left: `${targetRect.right + offset}px`, transform: 'translateY(-50%)' },
    };
    return styles[placement];
}

// ============================================================================
// Sub-Components
// ============================================================================

interface TooltipProps {
    step: TourStep;
    currentStep: number;
    totalSteps: number;
    onNext: () => void;
    onPrev: () => void;
    onSkip: () => void;
    onComplete: () => void;
}

export const Tooltip = memo(function Tooltip({
    step,
    currentStep,
    totalSteps,
    onNext,
    onPrev,
    onSkip,
    onComplete,
}: TooltipProps) {
    const [position, setPosition] = useState<React.CSSProperties>({});
    const isLast = currentStep === totalSteps - 1;

    useEffect(() => {
        const target = document.querySelector(step.target);
        if (target) {
            const rect = target.getBoundingClientRect();
            setPosition(getPlacementStyle(step.placement, rect));
        }
    }, [step.target, step.placement]);

    return (
        <div
            className="tour__tooltip"
            style={position}
            role="dialog"
            aria-label={`Tour step ${currentStep + 1} of ${totalSteps}`}
        >
            <div className="tour__tooltip-header">
                <h4 className="tour__tooltip-title">{step.title}</h4>
                <button
                    className="tour__tooltip-close"
                    onClick={onSkip}
                    aria-label="Skip tour"
                >
                    &times;
                </button>
            </div>
            <p className="tour__tooltip-content">{step.content}</p>
            <div className="tour__tooltip-footer">
                <span className="tour__tooltip-progress">
                    {currentStep + 1} / {totalSteps}
                </span>
                <div className="tour__tooltip-actions">
                    {currentStep > 0 && (
                        <button className="tour__btn tour__btn--secondary" onClick={onPrev}>
                            Back
                        </button>
                    )}
                    {isLast ? (
                        <button className="tour__btn tour__btn--primary" onClick={onComplete}>
                            Finish
                        </button>
                    ) : (
                        <button className="tour__btn tour__btn--primary" onClick={onNext}>
                            Next
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});

interface SpotlightProps {
    target: string;
    padding?: number;
}

export const Spotlight = memo(function Spotlight({ target, padding = 8 }: SpotlightProps) {
    const [rect, setRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        const element = document.querySelector(target);
        if (element) {
            setRect(element.getBoundingClientRect());
        }
    }, [target]);

    if (!rect) return null;

    return (
        <div className="tour__spotlight-container">
            <svg className="tour__spotlight-overlay">
                <defs>
                    <mask id="spotlight-mask">
                        <rect width="100%" height="100%" fill="white" />
                        <rect
                            x={rect.left - padding}
                            y={rect.top - padding}
                            width={rect.width + padding * 2}
                            height={rect.height + padding * 2}
                            rx="8"
                            fill="black"
                        />
                    </mask>
                </defs>
                <rect
                    width="100%"
                    height="100%"
                    fill="rgba(0, 0, 0, 0.7)"
                    mask="url(#spotlight-mask)"
                />
            </svg>
        </div>
    );
});

interface LearningPopupCardProps {
    popup: LearningPopup;
    onDismiss: () => void;
    onLearnMore?: () => void;
}

export const LearningPopupCard = memo(function LearningPopupCard({
    popup,
    onDismiss,
    onLearnMore,
}: LearningPopupCardProps) {
    return (
        <div className="learning__popup" role="alertdialog" aria-label={popup.title}>
            <div className="learning__popup-header">
                <span className="learning__popup-icon">💡</span>
                <h3 className="learning__popup-title">{popup.title}</h3>
                {popup.dismissable && (
                    <button className="learning__popup-close" onClick={onDismiss} aria-label="Dismiss">
                        &times;
                    </button>
                )}
            </div>
            <p className="learning__popup-content">{popup.content}</p>
            {popup.tips.length > 0 && (
                <ul className="learning__popup-tips">
                    {popup.tips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                    ))}
                </ul>
            )}
            <div className="learning__popup-footer">
                {popup.learnMoreUrl && onLearnMore && (
                    <button className="learning__btn learning__btn--secondary" onClick={onLearnMore}>
                        Learn More
                    </button>
                )}
                <button className="learning__btn learning__btn--primary" onClick={onDismiss}>
                    Got it
                </button>
            </div>
        </div>
    );
});

// ============================================================================
// Main Components
// ============================================================================

export interface OnboardingTourProps {
    config: TourConfig;
    onComplete: (tourId: string) => void;
    onSkip: (tourId: string) => void;
    onStepChange?: (step: number, stepId: string) => void;
    initialStep?: number;
    className?: string;
}

export const OnboardingTour = memo(function OnboardingTour({
    config,
    onComplete,
    onSkip,
    onStepChange,
    initialStep = 0,
    className = '',
}: OnboardingTourProps) {
    const [currentStep, setCurrentStep] = useState(initialStep);
    const [isActive, setIsActive] = useState(true);

    const sortedSteps = [...config.steps].sort((a, b) => a.order - b.order);
    const currentStepData = sortedSteps[currentStep];

    const handleNext = useCallback(() => {
        if (currentStep < sortedSteps.length - 1) {
            const nextStep = currentStep + 1;
            setCurrentStep(nextStep);
            onStepChange?.(nextStep, sortedSteps[nextStep].id);
        }
    }, [currentStep, sortedSteps, onStepChange]);

    const handlePrev = useCallback(() => {
        if (currentStep > 0) {
            const prevStep = currentStep - 1;
            setCurrentStep(prevStep);
            onStepChange?.(prevStep, sortedSteps[prevStep].id);
        }
    }, [currentStep, sortedSteps, onStepChange]);

    const handleSkip = useCallback(() => {
        setIsActive(false);
        onSkip(config.id);
    }, [config.id, onSkip]);

    const handleComplete = useCallback(() => {
        setIsActive(false);
        onComplete(config.id);
    }, [config.id, onComplete]);

    if (!isActive || !currentStepData) return null;

    return (
        <div className={`tour ${className}`} aria-label="Guided Tour">
            <Spotlight
                target={currentStepData.target}
                padding={currentStepData.spotlightPadding}
            />
            <Tooltip
                step={currentStepData}
                currentStep={currentStep}
                totalSteps={sortedSteps.length}
                onNext={handleNext}
                onPrev={handlePrev}
                onSkip={handleSkip}
                onComplete={handleComplete}
            />
        </div>
    );
});

export interface LearningPopupProviderProps {
    popup: LearningPopup | null;
    onDismiss: (popupId: string) => void;
    onLearnMore?: (url: string) => void;
    children: React.ReactNode;
}

export const LearningPopupProvider = memo(function LearningPopupProvider({
    popup,
    onDismiss,
    onLearnMore,
    children,
}: LearningPopupProviderProps) {
    if (!popup) return <>{children}</>;

    return (
        <>
            {children}
            <div className="learning__overlay">
                <LearningPopupCard
                    popup={popup}
                    onDismiss={() => onDismiss(popup.id)}
                    onLearnMore={popup.learnMoreUrl ? () => onLearnMore?.(popup.learnMoreUrl!) : undefined}
                />
            </div>
        </>
    );
});

// ============================================================================
// Styles
// ============================================================================

const styles = `
.tour__spotlight-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9998;
}

.tour__spotlight-overlay {
    width: 100%;
    height: 100%;
}

.tour__tooltip {
    position: fixed;
    z-index: 9999;
    max-width: 320px;
    padding: 16px;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #3b82f6;
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    color: #e2e8f0;
}

.tour__tooltip-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.tour__tooltip-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #f8fafc;
}

.tour__tooltip-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #64748b;
    cursor: pointer;
    padding: 0;
    line-height: 1;
}

.tour__tooltip-close:hover {
    color: #94a3b8;
}

.tour__tooltip-content {
    margin: 0 0 16px;
    font-size: 0.875rem;
    color: #94a3b8;
    line-height: 1.5;
}

.tour__tooltip-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.tour__tooltip-progress {
    font-size: 0.75rem;
    color: #64748b;
}

.tour__tooltip-actions {
    display: flex;
    gap: 8px;
}

.tour__btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.tour__btn--primary {
    background: #3b82f6;
    border: none;
    color: white;
}

.tour__btn--primary:hover {
    background: #2563eb;
}

.tour__btn--secondary {
    background: transparent;
    border: 1px solid #334155;
    color: #94a3b8;
}

.tour__btn--secondary:hover {
    border-color: #475569;
    color: #e2e8f0;
}

/* Learning Popup Styles */
.learning__overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}

.learning__popup {
    max-width: 400px;
    padding: 24px;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #334155;
    border-radius: 16px;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
    color: #e2e8f0;
}

.learning__popup-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
}

.learning__popup-icon {
    font-size: 1.5rem;
}

.learning__popup-title {
    margin: 0;
    flex: 1;
    font-size: 1.125rem;
    font-weight: 600;
    color: #f8fafc;
}

.learning__popup-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #64748b;
    cursor: pointer;
    padding: 0;
    line-height: 1;
}

.learning__popup-content {
    margin: 0 0 16px;
    font-size: 0.9375rem;
    color: #94a3b8;
    line-height: 1.6;
}

.learning__popup-tips {
    margin: 0 0 20px;
    padding-left: 20px;
}

.learning__popup-tips li {
    margin-bottom: 8px;
    font-size: 0.875rem;
    color: #64748b;
}

.learning__popup-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
}

.learning__btn {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.learning__btn--primary {
    background: #3b82f6;
    border: none;
    color: white;
}

.learning__btn--primary:hover {
    background: #2563eb;
}

.learning__btn--secondary {
    background: transparent;
    border: 1px solid #334155;
    color: #94a3b8;
}

.learning__btn--secondary:hover {
    border-color: #475569;
    color: #e2e8f0;
}
`;

if (typeof document !== 'undefined') {
    const styleId = 'onboarding-tour-styles';
    if (!document.getElementById(styleId)) {
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
}

export default OnboardingTour;
