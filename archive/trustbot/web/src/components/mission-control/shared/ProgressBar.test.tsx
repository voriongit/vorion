/**
 * ProgressBar Component Tests
 *
 * Story 2.7: Task Execution Progress View
 * FRs: FR8, FR9
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
    ProgressBar,
    getStatusColor,
    getSizeConfig,
} from './ProgressBar';

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('getStatusColor', () => {
    it('returns primary color for executing status', () => {
        const color = getStatusColor('executing');
        expect(color).toContain('3b82f6'); // Blue
    });

    it('returns success color for completed status', () => {
        const color = getStatusColor('completed');
        expect(color).toContain('10b981'); // Green
    });

    it('returns error color for failed status', () => {
        const color = getStatusColor('failed');
        expect(color).toContain('ef4444'); // Red
    });

    it('returns muted color for cancelled status', () => {
        const color = getStatusColor('cancelled');
        expect(color).toContain('6b7280'); // Gray
    });
});

describe('getSizeConfig', () => {
    it('returns small config for sm size', () => {
        const config = getSizeConfig('sm');
        expect(config.height).toBe(4);
        expect(config.fontSize).toBe(10);
    });

    it('returns medium config for md size', () => {
        const config = getSizeConfig('md');
        expect(config.height).toBe(8);
        expect(config.fontSize).toBe(12);
    });

    it('returns large config for lg size', () => {
        const config = getSizeConfig('lg');
        expect(config.height).toBe(12);
        expect(config.fontSize).toBe(14);
    });
});

// ============================================================================
// Component Tests
// ============================================================================

describe('ProgressBar', () => {
    // ========================================================================
    // Basic Rendering
    // ========================================================================

    describe('Basic Rendering', () => {
        it('renders with progress value', () => {
            render(<ProgressBar progress={50} />);

            const progressbar = screen.getByRole('progressbar');
            expect(progressbar).toBeInTheDocument();
            expect(progressbar).toHaveAttribute('aria-valuenow', '50');
        });

        it('displays percentage by default', () => {
            render(<ProgressBar progress={75} />);

            expect(screen.getByText('75%')).toBeInTheDocument();
        });

        it('renders with custom className', () => {
            const { container } = render(
                <ProgressBar progress={50} className="custom-class" />
            );

            expect(container.querySelector('.progress-bar')).toHaveClass('custom-class');
        });
    });

    // ========================================================================
    // Progress Values
    // ========================================================================

    describe('Progress Values', () => {
        it('normalizes progress above 100', () => {
            render(<ProgressBar progress={150} />);

            expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
            expect(screen.getByText('100%')).toBeInTheDocument();
        });

        it('normalizes negative progress to 0', () => {
            render(<ProgressBar progress={-10} />);

            expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
            expect(screen.getByText('0%')).toBeInTheDocument();
        });

        it('handles 0% progress', () => {
            render(<ProgressBar progress={0} />);

            expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
            expect(screen.getByText('0%')).toBeInTheDocument();
        });

        it('handles 100% progress', () => {
            render(<ProgressBar progress={100} />);

            expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
            expect(screen.getByText('100%')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Status Variations
    // ========================================================================

    describe('Status Variations', () => {
        it('applies executing status styling', () => {
            const { container } = render(<ProgressBar progress={50} status="executing" />);

            const fill = container.querySelector('.progress-bar__fill');
            expect(fill).toHaveStyle({ backgroundColor: getStatusColor('executing') });
        });

        it('applies completed status styling', () => {
            const { container } = render(<ProgressBar progress={100} status="completed" />);

            const fill = container.querySelector('.progress-bar__fill');
            expect(fill).toHaveStyle({ backgroundColor: getStatusColor('completed') });
        });

        it('applies failed status styling', () => {
            const { container } = render(<ProgressBar progress={30} status="failed" />);

            const fill = container.querySelector('.progress-bar__fill');
            expect(fill).toHaveStyle({ backgroundColor: getStatusColor('failed') });
        });

        it('applies cancelled status styling', () => {
            const { container } = render(<ProgressBar progress={60} status="cancelled" />);

            const fill = container.querySelector('.progress-bar__fill');
            expect(fill).toHaveStyle({ backgroundColor: getStatusColor('cancelled') });
        });
    });

    // ========================================================================
    // Size Variations
    // ========================================================================

    describe('Size Variations', () => {
        it('renders small size', () => {
            const { container } = render(<ProgressBar progress={50} size="sm" />);

            const track = container.querySelector('.progress-bar__track');
            expect(track).toHaveStyle({ height: '4px' });
        });

        it('renders medium size by default', () => {
            const { container } = render(<ProgressBar progress={50} />);

            const track = container.querySelector('.progress-bar__track');
            expect(track).toHaveStyle({ height: '8px' });
        });

        it('renders large size', () => {
            const { container } = render(<ProgressBar progress={50} size="lg" />);

            const track = container.querySelector('.progress-bar__track');
            expect(track).toHaveStyle({ height: '12px' });
        });
    });

    // ========================================================================
    // Display Options
    // ========================================================================

    describe('Display Options', () => {
        it('hides percentage when showPercentage is false', () => {
            render(<ProgressBar progress={50} showPercentage={false} />);

            expect(screen.queryByText('50%')).not.toBeInTheDocument();
        });

        it('shows label when showLabel is true and label provided', () => {
            render(<ProgressBar progress={50} showLabel={true} label="Processing..." />);

            expect(screen.getByText('Processing...')).toBeInTheDocument();
        });

        it('does not show label when showLabel is false', () => {
            render(<ProgressBar progress={50} showLabel={false} label="Processing..." />);

            expect(screen.queryByText('Processing...')).not.toBeInTheDocument();
        });
    });

    // ========================================================================
    // Animation
    // ========================================================================

    describe('Animation', () => {
        it('adds animated class when executing and animated', () => {
            const { container } = render(
                <ProgressBar progress={50} status="executing" animated={true} />
            );

            const fill = container.querySelector('.progress-bar__fill');
            expect(fill).toHaveClass('progress-bar__fill--animated');
        });

        it('does not animate when completed', () => {
            const { container } = render(
                <ProgressBar progress={100} status="completed" animated={true} />
            );

            const fill = container.querySelector('.progress-bar__fill');
            expect(fill).not.toHaveClass('progress-bar__fill--animated');
        });

        it('does not animate when progress is 100', () => {
            const { container } = render(
                <ProgressBar progress={100} status="executing" animated={true} />
            );

            const fill = container.querySelector('.progress-bar__fill');
            expect(fill).not.toHaveClass('progress-bar__fill--animated');
        });

        it('does not animate when animated is false', () => {
            const { container } = render(
                <ProgressBar progress={50} status="executing" animated={false} />
            );

            const fill = container.querySelector('.progress-bar__fill');
            expect(fill).not.toHaveClass('progress-bar__fill--animated');
        });
    });

    // ========================================================================
    // Accessibility
    // ========================================================================

    describe('Accessibility', () => {
        it('has role progressbar', () => {
            render(<ProgressBar progress={50} />);

            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('has aria-valuenow', () => {
            render(<ProgressBar progress={65} />);

            expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '65');
        });

        it('has aria-valuemin and aria-valuemax', () => {
            render(<ProgressBar progress={50} />);

            const progressbar = screen.getByRole('progressbar');
            expect(progressbar).toHaveAttribute('aria-valuemin', '0');
            expect(progressbar).toHaveAttribute('aria-valuemax', '100');
        });

        it('has default aria-label', () => {
            render(<ProgressBar progress={50} />);

            expect(screen.getByRole('progressbar')).toHaveAttribute(
                'aria-label',
                'Progress: 50%'
            );
        });

        it('uses custom label for aria-label', () => {
            render(<ProgressBar progress={50} label="Uploading files" />);

            expect(screen.getByRole('progressbar')).toHaveAttribute(
                'aria-label',
                'Uploading files'
            );
        });
    });
});
