/**
 * EvidencePackageCard Component
 *
 * Story 5.2: Evidence Package Generator
 * FRs: FR27
 */

import { memo, useState } from 'react';
import type {
    EvidencePackage,
    EvidencePackageRequest,
    EvidencePackageStatus,
    EvidencePackageFormat,
    HashIntegrityReport,
} from '../../../types';

// ============================================================================
// Helper Functions
// ============================================================================

export function getStatusColor(status: EvidencePackageStatus): string {
    const colors: Record<EvidencePackageStatus, string> = {
        generating: '#3b82f6',
        ready: '#10b981',
        expired: '#6b7280',
        failed: '#ef4444',
    };
    return colors[status];
}

export function getStatusIcon(status: EvidencePackageStatus): string {
    const icons: Record<EvidencePackageStatus, string> = {
        generating: '⏳',
        ready: '✅',
        expired: '⏰',
        failed: '❌',
    };
    return icons[status];
}

export function getFormatIcon(format: EvidencePackageFormat): string {
    const icons: Record<EvidencePackageFormat, string> = {
        pdf: '📄',
        json: '📋',
        csv: '📊',
    };
    return icons[format];
}

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface HashIntegrityBadgeProps {
    report: HashIntegrityReport;
}

export const HashIntegrityBadge = memo(function HashIntegrityBadge({
    report,
}: HashIntegrityBadgeProps) {
    const isFullyVerified = report.verifiedCount === report.totalEntries && report.chainIntact;
    const hasIssues = report.invalidCount > 0 || !report.chainIntact;

    return (
        <div
            className={`evidence-hash-badge ${hasIssues ? 'evidence-hash-badge--warning' : isFullyVerified ? 'evidence-hash-badge--verified' : ''}`}
            aria-label="Hash integrity report"
        >
            <div className="evidence-hash-badge__icon">
                {hasIssues ? '⚠️' : isFullyVerified ? '🔒' : '🔓'}
            </div>
            <div className="evidence-hash-badge__details">
                <span className="evidence-hash-badge__label">Hash Integrity</span>
                <span className="evidence-hash-badge__stats">
                    {report.verifiedCount}/{report.totalEntries} verified
                    {report.invalidCount > 0 && ` • ${report.invalidCount} invalid`}
                </span>
                <span className="evidence-hash-badge__chain">
                    Chain: {report.chainIntact ? 'Intact ✓' : 'Broken ⚠'}
                </span>
            </div>
        </div>
    );
});

interface PackageRequestFormProps {
    customerId?: string;
    onSubmit: (request: EvidencePackageRequest) => void;
    isSubmitting?: boolean;
}

export const PackageRequestForm = memo(function PackageRequestForm({
    customerId: initialCustomerId = '',
    onSubmit,
    isSubmitting = false,
}: PackageRequestFormProps) {
    const [customerId, setCustomerId] = useState(initialCustomerId);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [format, setFormat] = useState<EvidencePackageFormat>('pdf');
    const [includeRawData, setIncludeRawData] = useState(false);
    const [reason, setReason] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerId || !startDate || !endDate || !reason) return;

        onSubmit({
            customerId,
            startDate,
            endDate,
            format,
            includeRawData,
            reason,
            requestedBy: 'current-user',
        });
    };

    return (
        <form className="evidence-request-form" onSubmit={handleSubmit}>
            <h3 className="evidence-request-form__title">Request Evidence Package</h3>

            <div className="evidence-request-form__field">
                <label htmlFor="pkg-customerId">Customer ID *</label>
                <input
                    id="pkg-customerId"
                    type="text"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    placeholder="e.g., CUST-001234"
                    required
                />
            </div>

            <div className="evidence-request-form__row">
                <div className="evidence-request-form__field">
                    <label htmlFor="pkg-startDate">Start Date *</label>
                    <input
                        id="pkg-startDate"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                    />
                </div>
                <div className="evidence-request-form__field">
                    <label htmlFor="pkg-endDate">End Date *</label>
                    <input
                        id="pkg-endDate"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                    />
                </div>
            </div>

            <div className="evidence-request-form__row">
                <div className="evidence-request-form__field">
                    <label htmlFor="pkg-format">Format</label>
                    <select
                        id="pkg-format"
                        value={format}
                        onChange={(e) => setFormat(e.target.value as EvidencePackageFormat)}
                    >
                        <option value="pdf">PDF Document</option>
                        <option value="json">JSON Data</option>
                        <option value="csv">CSV Export</option>
                    </select>
                </div>
                <div className="evidence-request-form__field evidence-request-form__field--checkbox">
                    <label>
                        <input
                            type="checkbox"
                            checked={includeRawData}
                            onChange={(e) => setIncludeRawData(e.target.checked)}
                        />
                        Include raw data records
                    </label>
                </div>
            </div>

            <div className="evidence-request-form__field">
                <label htmlFor="pkg-reason">Reason for Request *</label>
                <textarea
                    id="pkg-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Regulatory inquiry, GDPR request, Internal audit..."
                    rows={3}
                    required
                />
            </div>

            <button
                type="submit"
                className="evidence-request-form__submit"
                disabled={isSubmitting || !customerId || !startDate || !endDate || !reason}
            >
                {isSubmitting ? 'Requesting...' : 'Request Package'}
            </button>
        </form>
    );
});

// ============================================================================
// Main Component
// ============================================================================

export interface EvidencePackageCardProps {
    package: EvidencePackage;
    onDownload?: (packageId: string) => void;
    onRefresh?: (packageId: string) => void;
    isDownloading?: boolean;
    className?: string;
}

export const EvidencePackageCard = memo(function EvidencePackageCard({
    package: pkg,
    onDownload,
    onRefresh,
    isDownloading = false,
    className = '',
}: EvidencePackageCardProps) {
    return (
        <article
            className={`evidence-package ${className}`}
            aria-label={`Evidence package for ${pkg.customerId}`}
        >
            <div className="evidence-package__header">
                <div className="evidence-package__status">
                    <span
                        className="evidence-package__status-badge"
                        style={{ backgroundColor: getStatusColor(pkg.status) }}
                    >
                        {getStatusIcon(pkg.status)} {pkg.status.toUpperCase()}
                    </span>
                    <span className="evidence-package__format">
                        {getFormatIcon(pkg.format)} {pkg.format.toUpperCase()}
                    </span>
                </div>
                <span className="evidence-package__id">ID: {pkg.id}</span>
            </div>

            <div className="evidence-package__content">
                <div className="evidence-package__customer">
                    <span className="evidence-package__label">Customer</span>
                    <span className="evidence-package__value">{pkg.customerId}</span>
                </div>

                <div className="evidence-package__period">
                    <span className="evidence-package__label">Period</span>
                    <span className="evidence-package__value">
                        {new Date(pkg.period.startDate).toLocaleDateString()} –{' '}
                        {new Date(pkg.period.endDate).toLocaleDateString()}
                    </span>
                </div>

                <div className="evidence-package__reason">
                    <span className="evidence-package__label">Reason</span>
                    <span className="evidence-package__value">{pkg.reason}</span>
                </div>
            </div>

            {pkg.status === 'ready' && (
                <>
                    <div className="evidence-package__summary">
                        <div className="evidence-package__stat">
                            <span className="evidence-package__stat-value">
                                {pkg.summary.totalActions}
                            </span>
                            <span className="evidence-package__stat-label">Actions</span>
                        </div>
                        <div className="evidence-package__stat">
                            <span className="evidence-package__stat-value">
                                {pkg.summary.agentsInvolved}
                            </span>
                            <span className="evidence-package__stat-label">Agents</span>
                        </div>
                        <div className="evidence-package__stat">
                            <span className="evidence-package__stat-value">
                                {pkg.summary.hitlDecisions}
                            </span>
                            <span className="evidence-package__stat-label">HITL Decisions</span>
                        </div>
                        <div className="evidence-package__stat">
                            <span className="evidence-package__stat-value">
                                {pkg.summary.dataCategories.length}
                            </span>
                            <span className="evidence-package__stat-label">Categories</span>
                        </div>
                    </div>

                    <HashIntegrityBadge report={pkg.hashIntegrity} />
                </>
            )}

            {pkg.status === 'generating' && (
                <div className="evidence-package__generating">
                    <div className="evidence-package__spinner" />
                    <span>Generating package...</span>
                    {onRefresh && (
                        <button
                            className="evidence-package__refresh"
                            onClick={() => onRefresh(pkg.id)}
                        >
                            Check Status
                        </button>
                    )}
                </div>
            )}

            {pkg.status === 'failed' && pkg.error && (
                <div className="evidence-package__error">
                    <span className="evidence-package__error-icon">⚠️</span>
                    <span className="evidence-package__error-text">{pkg.error}</span>
                </div>
            )}

            <div className="evidence-package__footer">
                <span className="evidence-package__timestamp">
                    Requested: {new Date(pkg.requestedAt).toLocaleString()}
                </span>
                {pkg.status === 'ready' && onDownload && (
                    <button
                        className="evidence-package__download"
                        onClick={() => onDownload(pkg.id)}
                        disabled={isDownloading}
                    >
                        {isDownloading ? 'Downloading...' : 'Download'}
                    </button>
                )}
            </div>
        </article>
    );
});

// ============================================================================
// List Component
// ============================================================================

export interface EvidencePackageListProps {
    packages: EvidencePackage[];
    onDownload?: (packageId: string) => void;
    onRefresh?: (packageId: string) => void;
    downloadingId?: string;
    className?: string;
}

export const EvidencePackageList = memo(function EvidencePackageList({
    packages,
    onDownload,
    onRefresh,
    downloadingId,
    className = '',
}: EvidencePackageListProps) {
    return (
        <section
            className={`evidence-package-list ${className}`}
            aria-label="Evidence packages"
        >
            <h3 className="evidence-package-list__title">Evidence Packages</h3>

            {packages.length === 0 ? (
                <div className="evidence-package-list__empty">
                    <span className="evidence-package-list__empty-icon">📦</span>
                    <p>No evidence packages generated yet</p>
                </div>
            ) : (
                <div className="evidence-package-list__items">
                    {packages.map((pkg) => (
                        <EvidencePackageCard
                            key={pkg.id}
                            package={pkg}
                            onDownload={onDownload}
                            onRefresh={onRefresh}
                            isDownloading={downloadingId === pkg.id}
                        />
                    ))}
                </div>
            )}
        </section>
    );
});

// ============================================================================
// Styles
// ============================================================================

const styles = `
.evidence-package {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 16px;
    color: #e2e8f0;
}

.evidence-package__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.evidence-package__status {
    display: flex;
    align-items: center;
    gap: 12px;
}

.evidence-package__status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
}

.evidence-package__format {
    font-size: 0.8125rem;
    color: #94a3b8;
}

.evidence-package__id {
    font-size: 0.75rem;
    color: #64748b;
    font-family: monospace;
}

.evidence-package__content {
    display: grid;
    gap: 12px;
    margin-bottom: 16px;
}

.evidence-package__label {
    display: block;
    font-size: 0.75rem;
    color: #64748b;
    margin-bottom: 2px;
}

.evidence-package__value {
    font-size: 0.9375rem;
    color: #e2e8f0;
}

.evidence-package__summary {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    padding: 16px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 6px;
    margin-bottom: 16px;
}

.evidence-package__stat {
    text-align: center;
}

.evidence-package__stat-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 700;
    color: #f8fafc;
}

.evidence-package__stat-label {
    font-size: 0.75rem;
    color: #64748b;
}

.evidence-hash-badge {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 6px;
    margin-bottom: 16px;
}

.evidence-hash-badge--verified {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
}

.evidence-hash-badge--warning {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
}

.evidence-hash-badge__icon {
    font-size: 1.5rem;
}

.evidence-hash-badge__details {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.evidence-hash-badge__label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #f8fafc;
}

.evidence-hash-badge__stats,
.evidence-hash-badge__chain {
    font-size: 0.75rem;
    color: #94a3b8;
}

.evidence-package__generating {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 6px;
    margin-bottom: 16px;
    color: #94a3b8;
}

.evidence-package__spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #334155;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.evidence-package__refresh {
    margin-left: auto;
    padding: 6px 12px;
    background: #334155;
    border: none;
    border-radius: 4px;
    color: #e2e8f0;
    font-size: 0.8125rem;
    cursor: pointer;
}

.evidence-package__error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px;
    margin-bottom: 16px;
    color: #fca5a5;
}

.evidence-package__footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 12px;
    border-top: 1px solid #334155;
}

.evidence-package__timestamp {
    font-size: 0.75rem;
    color: #64748b;
}

.evidence-package__download {
    padding: 8px 16px;
    background: #10b981;
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
}

.evidence-package__download:hover:not(:disabled) {
    background: #059669;
}

.evidence-package__download:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

/* Request Form */
.evidence-request-form {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 20px;
}

.evidence-request-form__title {
    margin: 0 0 16px;
    font-size: 1rem;
    font-weight: 600;
    color: #f8fafc;
}

.evidence-request-form__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

.evidence-request-form__field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
}

.evidence-request-form__field--checkbox {
    flex-direction: row;
    align-items: center;
}

.evidence-request-form__field--checkbox label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
}

.evidence-request-form__field label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #94a3b8;
}

.evidence-request-form__field input,
.evidence-request-form__field select,
.evidence-request-form__field textarea {
    padding: 10px 12px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    color: #e2e8f0;
    font-size: 0.9375rem;
    font-family: inherit;
}

.evidence-request-form__field input[type="checkbox"] {
    width: 18px;
    height: 18px;
    padding: 0;
}

.evidence-request-form__field textarea {
    resize: vertical;
    min-height: 80px;
}

.evidence-request-form__submit {
    width: 100%;
    padding: 12px 24px;
    background: #3b82f6;
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
}

.evidence-request-form__submit:hover:not(:disabled) {
    background: #2563eb;
}

.evidence-request-form__submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

/* List */
.evidence-package-list {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 20px;
    color: #e2e8f0;
}

.evidence-package-list__title {
    margin: 0 0 16px;
    font-size: 1.125rem;
    font-weight: 600;
    color: #f8fafc;
}

.evidence-package-list__items {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.evidence-package-list__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px;
    text-align: center;
}

.evidence-package-list__empty-icon {
    font-size: 3rem;
    margin-bottom: 12px;
}

.evidence-package-list__empty p {
    margin: 0;
    color: #64748b;
}
`;

if (typeof document !== 'undefined') {
    const styleId = 'evidence-package-styles';
    if (!document.getElementById(styleId)) {
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
}

export default EvidencePackageCard;
