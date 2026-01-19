/**
 * OnboardingTour Component Tests
 *
 * Epic 8: Onboarding & Education
 * Stories 8.1-8.4: Tour and Learning Popup tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
    OnboardingTour,
    Tooltip,
    LearningPopupCard,
    LearningPopupProvider,
    getPlacementStyle,
} from './OnboardingTour';
import type { TourConfig, TourStep, LearningPopup } from '../../../types';

// ============================================================================
// Test Data
// ============================================================================

const mockStep: TourStep = {
    id: 'step-1',
    target: '.test-target',
    title: 'Test Step',
    content: 'This is a test step content.',
    placement: 'bottom',
    order: 1,
};

const mockTourConfig: TourConfig = {
    id: 'test-tour',
    name: 'Test Tour',
    steps: [
        mockStep,
        { ...mockStep, id: 'step-2', title: 'Step 2', order: 2 },
        { ...mockStep, id: 'step-3', title: 'Step 3', order: 3 },
    ],
    autoStart: true,
};

const mockPopup: LearningPopup = {
    id: 'popup-test',
    eventType: 'first_denial',
    title: 'Understanding Denials',
    content: 'When you deny a request, the agent learns.',
    tips: [
        'Provide a clear reason',
        'Consider alternatives',
        'Denials are logged',
    ],
    learnMoreUrl: 'https://example.com/learn',
    dismissable: true,
    showOnce: true,
};

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('getPlacementStyle', () => {
    const mockRect: DOMRect = {
        top: 100,
        bottom: 150,
        left: 200,
        right: 300,
        width: 100,
        height: 50,
        x: 200,
        y: 100,
        toJSON: () => ({}),
    };

    it('returns correct style for bottom placement', () => {
        const style = getPlacementStyle('bottom', mockRect);
        expect(style.top).toBe('162px'); // bottom + offset
        expect(style.transform).toBe('translateX(-50%)');
    });

    it('returns correct style for top placement', () => {
        const style = getPlacementStyle('top', mockRect);
        expect(style.transform).toBe('translateX(-50%)');
    });

    it('returns correct style for left placement', () => {
        const style = getPlacementStyle('left', mockRect);
        expect(style.transform).toBe('translateY(-50%)');
    });

    it('returns correct style for right placement', () => {
        const style = getPlacementStyle('right', mockRect);
        expect(style.left).toBe('312px'); // right + offset
        expect(style.transform).toBe('translateY(-50%)');
    });
});

// ============================================================================
// Tooltip Component Tests
// ============================================================================

describe('Tooltip', () => {
    const defaultProps = {
        step: mockStep,
        currentStep: 0,
        totalSteps: 3,
        onNext: vi.fn(),
        onPrev: vi.fn(),
        onSkip: vi.fn(),
        onComplete: vi.fn(),
    };

    it('renders step title', () => {
        render(<Tooltip {...defaultProps} />);
        expect(screen.getByText('Test Step')).toBeInTheDocument();
    });

    it('renders step content', () => {
        render(<Tooltip {...defaultProps} />);
        expect(screen.getByText('This is a test step content.')).toBeInTheDocument();
    });

    it('shows progress indicator', () => {
        render(<Tooltip {...defaultProps} />);
        expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });

    it('shows Next button when not on last step', () => {
        render(<Tooltip {...defaultProps} />);
        expect(screen.getByText('Next')).toBeInTheDocument();
        expect(screen.queryByText('Finish')).not.toBeInTheDocument();
    });

    it('shows Finish button on last step', () => {
        render(<Tooltip {...defaultProps} currentStep={2} />);
        expect(screen.getByText('Finish')).toBeInTheDocument();
        expect(screen.queryByText('Next')).not.toBeInTheDocument();
    });

    it('hides Back button on first step', () => {
        render(<Tooltip {...defaultProps} currentStep={0} />);
        expect(screen.queryByText('Back')).not.toBeInTheDocument();
    });

    it('shows Back button on subsequent steps', () => {
        render(<Tooltip {...defaultProps} currentStep={1} />);
        expect(screen.getByText('Back')).toBeInTheDocument();
    });

    it('calls onNext when Next clicked', () => {
        const onNext = vi.fn();
        render(<Tooltip {...defaultProps} onNext={onNext} />);
        fireEvent.click(screen.getByText('Next'));
        expect(onNext).toHaveBeenCalled();
    });

    it('calls onPrev when Back clicked', () => {
        const onPrev = vi.fn();
        render(<Tooltip {...defaultProps} currentStep={1} onPrev={onPrev} />);
        fireEvent.click(screen.getByText('Back'));
        expect(onPrev).toHaveBeenCalled();
    });

    it('calls onSkip when close clicked', () => {
        const onSkip = vi.fn();
        render(<Tooltip {...defaultProps} onSkip={onSkip} />);
        fireEvent.click(screen.getByLabelText('Skip tour'));
        expect(onSkip).toHaveBeenCalled();
    });

    it('calls onComplete when Finish clicked', () => {
        const onComplete = vi.fn();
        render(<Tooltip {...defaultProps} currentStep={2} onComplete={onComplete} />);
        fireEvent.click(screen.getByText('Finish'));
        expect(onComplete).toHaveBeenCalled();
    });

    it('has correct aria-label', () => {
        render(<Tooltip {...defaultProps} />);
        expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Tour step 1 of 3');
    });
});

// ============================================================================
// LearningPopupCard Tests
// ============================================================================

describe('LearningPopupCard', () => {
    it('renders popup title', () => {
        render(<LearningPopupCard popup={mockPopup} onDismiss={vi.fn()} />);
        expect(screen.getByText('Understanding Denials')).toBeInTheDocument();
    });

    it('renders popup content', () => {
        render(<LearningPopupCard popup={mockPopup} onDismiss={vi.fn()} />);
        expect(screen.getByText('When you deny a request, the agent learns.')).toBeInTheDocument();
    });

    it('renders all tips', () => {
        render(<LearningPopupCard popup={mockPopup} onDismiss={vi.fn()} />);
        expect(screen.getByText('Provide a clear reason')).toBeInTheDocument();
        expect(screen.getByText('Consider alternatives')).toBeInTheDocument();
        expect(screen.getByText('Denials are logged')).toBeInTheDocument();
    });

    it('shows close button when dismissable', () => {
        render(<LearningPopupCard popup={mockPopup} onDismiss={vi.fn()} />);
        expect(screen.getByLabelText('Dismiss')).toBeInTheDocument();
    });

    it('hides close button when not dismissable', () => {
        const nonDismissable = { ...mockPopup, dismissable: false };
        render(<LearningPopupCard popup={nonDismissable} onDismiss={vi.fn()} />);
        expect(screen.queryByLabelText('Dismiss')).not.toBeInTheDocument();
    });

    it('shows Learn More button when url provided', () => {
        const onLearnMore = vi.fn();
        render(<LearningPopupCard popup={mockPopup} onDismiss={vi.fn()} onLearnMore={onLearnMore} />);
        expect(screen.getByText('Learn More')).toBeInTheDocument();
    });

    it('hides Learn More button when no url', () => {
        const noUrl = { ...mockPopup, learnMoreUrl: undefined };
        render(<LearningPopupCard popup={noUrl} onDismiss={vi.fn()} />);
        expect(screen.queryByText('Learn More')).not.toBeInTheDocument();
    });

    it('calls onDismiss when Got it clicked', () => {
        const onDismiss = vi.fn();
        render(<LearningPopupCard popup={mockPopup} onDismiss={onDismiss} />);
        fireEvent.click(screen.getByText('Got it'));
        expect(onDismiss).toHaveBeenCalled();
    });

    it('calls onDismiss when close button clicked', () => {
        const onDismiss = vi.fn();
        render(<LearningPopupCard popup={mockPopup} onDismiss={onDismiss} />);
        fireEvent.click(screen.getByLabelText('Dismiss'));
        expect(onDismiss).toHaveBeenCalled();
    });

    it('calls onLearnMore when Learn More clicked', () => {
        const onLearnMore = vi.fn();
        render(<LearningPopupCard popup={mockPopup} onDismiss={vi.fn()} onLearnMore={onLearnMore} />);
        fireEvent.click(screen.getByText('Learn More'));
        expect(onLearnMore).toHaveBeenCalled();
    });

    it('has correct aria-label', () => {
        render(<LearningPopupCard popup={mockPopup} onDismiss={vi.fn()} />);
        expect(screen.getByRole('alertdialog')).toHaveAttribute('aria-label', mockPopup.title);
    });
});

// ============================================================================
// LearningPopupProvider Tests
// ============================================================================

describe('LearningPopupProvider', () => {
    it('renders children when no popup', () => {
        render(
            <LearningPopupProvider popup={null} onDismiss={vi.fn()}>
                <div>Child Content</div>
            </LearningPopupProvider>
        );
        expect(screen.getByText('Child Content')).toBeInTheDocument();
    });

    it('renders popup overlay when popup provided', () => {
        render(
            <LearningPopupProvider popup={mockPopup} onDismiss={vi.fn()}>
                <div>Child Content</div>
            </LearningPopupProvider>
        );
        expect(screen.getByText('Understanding Denials')).toBeInTheDocument();
        expect(screen.getByText('Child Content')).toBeInTheDocument();
    });

    it('calls onDismiss with popup id', () => {
        const onDismiss = vi.fn();
        render(
            <LearningPopupProvider popup={mockPopup} onDismiss={onDismiss}>
                <div>Child</div>
            </LearningPopupProvider>
        );
        fireEvent.click(screen.getByText('Got it'));
        expect(onDismiss).toHaveBeenCalledWith('popup-test');
    });
});

// ============================================================================
// OnboardingTour Tests
// ============================================================================

describe('OnboardingTour', () => {
    // Mock document.querySelector for spotlight/tooltip positioning
    beforeEach(() => {
        const mockElement = {
            getBoundingClientRect: () => ({
                top: 100,
                bottom: 150,
                left: 200,
                right: 300,
                width: 100,
                height: 50,
            }),
        };
        vi.spyOn(document, 'querySelector').mockReturnValue(mockElement as Element);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders tour when active', () => {
        render(
            <OnboardingTour
                config={mockTourConfig}
                onComplete={vi.fn()}
                onSkip={vi.fn()}
            />
        );
        expect(screen.getByLabelText('Guided Tour')).toBeInTheDocument();
    });

    it('shows first step initially', () => {
        render(
            <OnboardingTour
                config={mockTourConfig}
                onComplete={vi.fn()}
                onSkip={vi.fn()}
            />
        );
        expect(screen.getByText('Test Step')).toBeInTheDocument();
    });

    it('advances to next step when Next clicked', () => {
        render(
            <OnboardingTour
                config={mockTourConfig}
                onComplete={vi.fn()}
                onSkip={vi.fn()}
            />
        );
        fireEvent.click(screen.getByText('Next'));
        expect(screen.getByText('Step 2')).toBeInTheDocument();
    });

    it('goes back when Back clicked', () => {
        render(
            <OnboardingTour
                config={mockTourConfig}
                onComplete={vi.fn()}
                onSkip={vi.fn()}
                initialStep={1}
            />
        );
        fireEvent.click(screen.getByText('Back'));
        expect(screen.getByText('Test Step')).toBeInTheDocument();
    });

    it('calls onComplete when tour finished', () => {
        const onComplete = vi.fn();
        render(
            <OnboardingTour
                config={mockTourConfig}
                onComplete={onComplete}
                onSkip={vi.fn()}
                initialStep={2}
            />
        );
        fireEvent.click(screen.getByText('Finish'));
        expect(onComplete).toHaveBeenCalledWith('test-tour');
    });

    it('calls onSkip when tour skipped', () => {
        const onSkip = vi.fn();
        render(
            <OnboardingTour
                config={mockTourConfig}
                onComplete={vi.fn()}
                onSkip={onSkip}
            />
        );
        fireEvent.click(screen.getByLabelText('Skip tour'));
        expect(onSkip).toHaveBeenCalledWith('test-tour');
    });

    it('calls onStepChange when step changes', () => {
        const onStepChange = vi.fn();
        render(
            <OnboardingTour
                config={mockTourConfig}
                onComplete={vi.fn()}
                onSkip={vi.fn()}
                onStepChange={onStepChange}
            />
        );
        fireEvent.click(screen.getByText('Next'));
        expect(onStepChange).toHaveBeenCalledWith(1, 'step-2');
    });

    it('applies custom className', () => {
        const { container } = render(
            <OnboardingTour
                config={mockTourConfig}
                onComplete={vi.fn()}
                onSkip={vi.fn()}
                className="custom-tour"
            />
        );
        expect(container.querySelector('.tour.custom-tour')).toBeInTheDocument();
    });

    it('hides after skip', () => {
        render(
            <OnboardingTour
                config={mockTourConfig}
                onComplete={vi.fn()}
                onSkip={vi.fn()}
            />
        );
        fireEvent.click(screen.getByLabelText('Skip tour'));
        expect(screen.queryByLabelText('Guided Tour')).not.toBeInTheDocument();
    });

    it('hides after complete', () => {
        render(
            <OnboardingTour
                config={mockTourConfig}
                onComplete={vi.fn()}
                onSkip={vi.fn()}
                initialStep={2}
            />
        );
        fireEvent.click(screen.getByText('Finish'));
        expect(screen.queryByLabelText('Guided Tour')).not.toBeInTheDocument();
    });
});
