/**
 * UrgencyBadge Component Tests
 *
 * Story 2.1: Task Pipeline Module - Pending Decisions View
 * FR: FR11 (Urgency indicators)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UrgencyBadge, URGENCY_CONFIG } from './UrgencyBadge';

describe('UrgencyBadge', () => {
    // ========================================================================
    // Rendering Tests
    // ========================================================================

    describe('Rendering', () => {
        it('renders immediate urgency with correct styling', () => {
            render(<UrgencyBadge urgency="immediate" />);

            const badge = screen.getByRole('status');
            expect(badge).toBeInTheDocument();
            expect(badge).toHaveStyle({ backgroundColor: '#dc2626' }); // Red
            expect(badge).toHaveTextContent('IMMEDIATE');
        });

        it('renders queued urgency with correct styling', () => {
            render(<UrgencyBadge urgency="queued" />);

            const badge = screen.getByRole('status');
            expect(badge).toBeInTheDocument();
            expect(badge).toHaveStyle({ backgroundColor: '#fbbf24' }); // Yellow
            expect(badge).toHaveTextContent('QUEUED');
        });

        it('shows short label in small size', () => {
            render(<UrgencyBadge urgency="immediate" size="sm" />);

            const badge = screen.getByRole('status');
            expect(badge).toHaveTextContent('IMM');
            expect(badge).not.toHaveTextContent('IMMEDIATE');
        });

        it('shows full label in medium size', () => {
            render(<UrgencyBadge urgency="immediate" size="md" />);

            const badge = screen.getByRole('status');
            expect(badge).toHaveTextContent('IMMEDIATE');
        });

        it('shows full label in large size', () => {
            render(<UrgencyBadge urgency="queued" size="lg" />);

            const badge = screen.getByRole('status');
            expect(badge).toHaveTextContent('QUEUED');
        });
    });

    // ========================================================================
    // Size Variants Tests
    // ========================================================================

    describe('Size Variants', () => {
        it('applies sm class for small size', () => {
            render(<UrgencyBadge urgency="immediate" size="sm" />);
            const badge = screen.getByRole('status');
            expect(badge).toHaveClass('urgency-badge--sm');
        });

        it('applies md class for medium size (default)', () => {
            render(<UrgencyBadge urgency="immediate" />);
            const badge = screen.getByRole('status');
            expect(badge).toHaveClass('urgency-badge--md');
        });

        it('applies lg class for large size', () => {
            render(<UrgencyBadge urgency="immediate" size="lg" />);
            const badge = screen.getByRole('status');
            expect(badge).toHaveClass('urgency-badge--lg');
        });
    });

    // ========================================================================
    // Label Display Tests
    // ========================================================================

    describe('Label Display', () => {
        it('shows label when showLabel is true (default)', () => {
            render(<UrgencyBadge urgency="immediate" />);
            expect(screen.getByText('IMMEDIATE')).toBeInTheDocument();
        });

        it('hides label when showLabel is false', () => {
            render(<UrgencyBadge urgency="immediate" showLabel={false} />);
            expect(screen.queryByText('IMMEDIATE')).not.toBeInTheDocument();
            expect(screen.queryByText('IMM')).not.toBeInTheDocument();
        });

        it('shows icon even when label is hidden', () => {
            render(<UrgencyBadge urgency="immediate" showLabel={false} />);
            // Icon is "!" for immediate
            expect(screen.getByText('!')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Accessibility Tests
    // ========================================================================

    describe('Accessibility', () => {
        it('has role="status"', () => {
            render(<UrgencyBadge urgency="immediate" />);
            expect(screen.getByRole('status')).toBeInTheDocument();
        });

        it('has correct aria-label for immediate', () => {
            render(<UrgencyBadge urgency="immediate" />);
            expect(screen.getByRole('status')).toHaveAttribute(
                'aria-label',
                URGENCY_CONFIG.immediate.ariaLabel
            );
        });

        it('has correct aria-label for queued', () => {
            render(<UrgencyBadge urgency="queued" />);
            expect(screen.getByRole('status')).toHaveAttribute(
                'aria-label',
                URGENCY_CONFIG.queued.ariaLabel
            );
        });

        it('icon has aria-hidden="true"', () => {
            render(<UrgencyBadge urgency="immediate" />);
            const icon = screen.getByText('!');
            expect(icon).toHaveAttribute('aria-hidden', 'true');
        });
    });

    // ========================================================================
    // Custom Class Name Tests
    // ========================================================================

    describe('Custom Class Name', () => {
        it('applies custom className', () => {
            render(<UrgencyBadge urgency="immediate" className="custom-class" />);
            const badge = screen.getByRole('status');
            expect(badge).toHaveClass('custom-class');
            expect(badge).toHaveClass('urgency-badge');
        });
    });

    // ========================================================================
    // Configuration Tests
    // ========================================================================

    describe('URGENCY_CONFIG', () => {
        it('has configuration for immediate urgency', () => {
            expect(URGENCY_CONFIG.immediate).toBeDefined();
            expect(URGENCY_CONFIG.immediate.label).toBe('IMMEDIATE');
            expect(URGENCY_CONFIG.immediate.backgroundColor).toBe('#dc2626');
        });

        it('has configuration for queued urgency', () => {
            expect(URGENCY_CONFIG.queued).toBeDefined();
            expect(URGENCY_CONFIG.queued.label).toBe('QUEUED');
            expect(URGENCY_CONFIG.queued.backgroundColor).toBe('#fbbf24');
        });

        it('all configs have required properties', () => {
            const requiredProps = ['label', 'shortLabel', 'color', 'backgroundColor', 'icon', 'ariaLabel'];

            Object.values(URGENCY_CONFIG).forEach((config) => {
                requiredProps.forEach((prop) => {
                    expect(config).toHaveProperty(prop);
                });
            });
        });
    });
});
