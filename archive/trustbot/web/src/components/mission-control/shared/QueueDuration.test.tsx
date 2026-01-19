/**
 * QueueDuration Component Tests
 *
 * Story 2.1: Task Pipeline Module - Pending Decisions View
 * FR: FR12 (Time-in-queue duration)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
    QueueDuration,
    formatDuration,
    parseDurationToMinutes,
    getDurationUrgency,
} from './QueueDuration';

describe('QueueDuration', () => {
    // ========================================================================
    // Helper Function Tests
    // ========================================================================

    describe('formatDuration', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2025-12-23T12:00:00Z'));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('formats minutes only for short durations', () => {
            const createdAt = new Date('2025-12-23T11:45:00Z').toISOString(); // 15 mins ago
            expect(formatDuration(createdAt)).toBe('15m');
        });

        it('formats hours and minutes', () => {
            const createdAt = new Date('2025-12-23T09:45:00Z').toISOString(); // 2h 15m ago
            expect(formatDuration(createdAt)).toBe('2h 15m');
        });

        it('formats full hours without trailing minutes', () => {
            const createdAt = new Date('2025-12-23T10:00:00Z').toISOString(); // 2h ago
            expect(formatDuration(createdAt)).toBe('2h 0m');
        });

        it('formats days for very long durations', () => {
            const createdAt = new Date('2025-12-21T12:00:00Z').toISOString(); // 2 days ago
            expect(formatDuration(createdAt)).toBe('2d');
        });

        it('formats days and hours', () => {
            const createdAt = new Date('2025-12-21T07:00:00Z').toISOString(); // 2d 5h ago
            expect(formatDuration(createdAt)).toBe('2d 5h');
        });

        it('returns "0m" for just created', () => {
            const createdAt = new Date('2025-12-23T12:00:00Z').toISOString();
            expect(formatDuration(createdAt)).toBe('0m');
        });
    });

    describe('parseDurationToMinutes', () => {
        it('parses minutes only', () => {
            expect(parseDurationToMinutes('30m')).toBe(30);
        });

        it('parses hours only', () => {
            expect(parseDurationToMinutes('2h')).toBe(120);
        });

        it('parses hours and minutes', () => {
            expect(parseDurationToMinutes('2h 30m')).toBe(150);
        });

        it('parses days only', () => {
            expect(parseDurationToMinutes('1d')).toBe(1440);
        });

        it('parses days and hours', () => {
            expect(parseDurationToMinutes('1d 5h')).toBe(1740);
        });

        it('parses complex duration', () => {
            expect(parseDurationToMinutes('2d 3h 15m')).toBe(2880 + 180 + 15);
        });

        it('returns 0 for empty string', () => {
            expect(parseDurationToMinutes('')).toBe(0);
        });

        it('returns 0 for invalid format', () => {
            expect(parseDurationToMinutes('invalid')).toBe(0);
        });
    });

    describe('getDurationUrgency', () => {
        it('returns "normal" for under 2 hours', () => {
            expect(getDurationUrgency(0)).toBe('normal');
            expect(getDurationUrgency(60)).toBe('normal');
            expect(getDurationUrgency(119)).toBe('normal');
        });

        it('returns "warning" for 2-8 hours', () => {
            expect(getDurationUrgency(120)).toBe('warning');
            expect(getDurationUrgency(240)).toBe('warning');
            expect(getDurationUrgency(479)).toBe('warning');
        });

        it('returns "critical" for 8+ hours', () => {
            expect(getDurationUrgency(480)).toBe('critical');
            expect(getDurationUrgency(600)).toBe('critical');
            expect(getDurationUrgency(1440)).toBe('critical');
        });
    });

    // ========================================================================
    // Rendering Tests
    // ========================================================================

    describe('Rendering', () => {
        it('renders with duration prop', () => {
            render(<QueueDuration duration="2h 15m" />);
            expect(screen.getByText('2h 15m')).toBeInTheDocument();
        });

        it('renders with createdAt prop', () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2025-12-23T12:00:00Z'));

            render(<QueueDuration createdAt="2025-12-23T09:45:00Z" />);
            expect(screen.getByText('2h 15m')).toBeInTheDocument();

            vi.useRealTimers();
        });

        it('prefers duration over createdAt', () => {
            render(<QueueDuration duration="5h" createdAt="2025-12-23T09:45:00Z" />);
            expect(screen.getByText('5h')).toBeInTheDocument();
        });

        it('renders "0m" when no duration or createdAt provided', () => {
            render(<QueueDuration />);
            expect(screen.getByText('0m')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Size Variants Tests
    // ========================================================================

    describe('Size Variants', () => {
        it('applies sm class for small size', () => {
            render(<QueueDuration duration="30m" size="sm" />);
            const element = screen.getByRole('timer');
            expect(element).toHaveClass('queue-duration--sm');
        });

        it('applies md class for medium size (default)', () => {
            render(<QueueDuration duration="30m" />);
            const element = screen.getByRole('timer');
            expect(element).toHaveClass('queue-duration--md');
        });

        it('applies lg class for large size', () => {
            render(<QueueDuration duration="30m" size="lg" />);
            const element = screen.getByRole('timer');
            expect(element).toHaveClass('queue-duration--lg');
        });
    });

    // ========================================================================
    // Urgency Level Tests
    // ========================================================================

    describe('Urgency Level Styling', () => {
        it('applies normal class for short durations', () => {
            render(<QueueDuration duration="30m" />);
            const element = screen.getByRole('timer');
            expect(element).toHaveClass('queue-duration--normal');
        });

        it('applies warning class for 2+ hour durations', () => {
            render(<QueueDuration duration="3h" />);
            const element = screen.getByRole('timer');
            expect(element).toHaveClass('queue-duration--warning');
        });

        it('applies critical class for 8+ hour durations', () => {
            render(<QueueDuration duration="10h" />);
            const element = screen.getByRole('timer');
            expect(element).toHaveClass('queue-duration--critical');
        });

        it('applies critical class for multi-day durations', () => {
            render(<QueueDuration duration="2d" />);
            const element = screen.getByRole('timer');
            expect(element).toHaveClass('queue-duration--critical');
        });
    });

    // ========================================================================
    // Icon Display Tests
    // ========================================================================

    describe('Icon Display', () => {
        it('shows icon by default', () => {
            render(<QueueDuration duration="30m" />);
            const icon = document.querySelector('.queue-duration__icon');
            expect(icon).toBeInTheDocument();
        });

        it('hides icon when showIcon is false', () => {
            render(<QueueDuration duration="30m" showIcon={false} />);
            const icon = document.querySelector('.queue-duration__icon');
            expect(icon).not.toBeInTheDocument();
        });

        it('still shows duration when icon is hidden', () => {
            render(<QueueDuration duration="30m" showIcon={false} />);
            expect(screen.getByText('30m')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Accessibility Tests
    // ========================================================================

    describe('Accessibility', () => {
        it('has role="timer"', () => {
            render(<QueueDuration duration="2h 15m" />);
            expect(screen.getByRole('timer')).toBeInTheDocument();
        });

        it('has correct aria-label', () => {
            render(<QueueDuration duration="2h 15m" />);
            expect(screen.getByRole('timer')).toHaveAttribute(
                'aria-label',
                'Time in queue: 2h 15m'
            );
        });

        it('icon svg has no accessibility issues', () => {
            render(<QueueDuration duration="30m" />);
            const svg = document.querySelector('.queue-duration__svg');
            expect(svg).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Custom Class Name Tests
    // ========================================================================

    describe('Custom Class Name', () => {
        it('applies custom className', () => {
            render(<QueueDuration duration="30m" className="custom-class" />);
            const element = screen.getByRole('timer');
            expect(element).toHaveClass('custom-class');
            expect(element).toHaveClass('queue-duration');
        });
    });
});
