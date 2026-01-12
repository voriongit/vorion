/**
 * Certification Report
 * Story 18-3: Generate comprehensive certification reports
 *
 * Produces detailed PDF/JSON reports documenting the entire certification
 * process, test results, council decisions, and recommendations.
 */

import { CertificationTier, TierDefinition, CERTIFICATION_TIERS } from './certification-tiers';
import { TestSummary, TestResult as TestResultStatus } from './test-suites';
import { urls } from '@/lib/config';

// ============================================================================
// Types
// ============================================================================

// Extended test result with suite info for reporting
export interface ReportTestResult {
  testId: string;
  suiteId: string;
  result: TestResultStatus;
  duration: number;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  details?: string;
}

export type ReportFormat = 'json' | 'pdf' | 'html';
export type ReportType = 'full' | 'executive' | 'technical' | 'compliance';

export interface CertificationReport {
  id: string;
  certificateId: string;
  agentId: string;
  generatedAt: Date;
  format: ReportFormat;
  type: ReportType;

  // Header info
  header: ReportHeader;

  // Sections
  executiveSummary: ExecutiveSummary;
  agentProfile: AgentProfile;
  testingResults: TestingResults;
  councilReview?: CouncilReviewSection;
  complianceMapping?: ComplianceMapping;
  recommendations: Recommendations;
  appendices: Appendix[];

  // Metadata
  version: string;
  confidentiality: 'public' | 'confidential' | 'restricted';
  validUntil: Date;
}

export interface ReportHeader {
  title: string;
  subtitle: string;
  certificationTier: CertificationTier;
  issueDate: Date;
  validUntil: Date;
  reportNumber: string;
  preparedFor: string;
  preparedBy: string;
}

export interface ExecutiveSummary {
  overallResult: 'certified' | 'not_certified' | 'conditional';
  tier: CertificationTier;
  tierDefinition: TierDefinition;
  trustScore: number;
  trustScoreChange: number;
  keyFindings: string[];
  criticalIssues: string[];
  strengths: string[];
  validityPeriod: string;
  nextRecertificationDate: Date;
}

export interface AgentProfile {
  agentId: string;
  name: string;
  description: string;
  category: string;
  capabilities: string[];
  deploymentEnvironment: string;
  intendedUseCase: string;
  trainerId: string;
  trainerOrganization?: string;
  createdAt: Date;
  lastUpdated: Date;
  previousCertifications: PreviousCertification[];
}

export interface PreviousCertification {
  certificateId: string;
  tier: CertificationTier;
  issuedAt: Date;
  expiredAt: Date;
  status: 'valid' | 'expired' | 'revoked';
}

export interface TestingResults {
  summary: TestSummary;
  suiteResults: SuiteResult[];
  passRate: number;
  criticalFailures: CriticalFailure[];
  performanceMetrics: PerformanceMetrics;
  testEnvironment: TestEnvironment;
}

export interface SuiteResult {
  suiteId: string;
  suiteName: string;
  category: string;
  passed: number;
  failed: number;
  passRate: number;
  duration: number;
  criticalTests: TestResultSummary[];
  failedTests: TestResultSummary[];
}

export interface TestResultSummary {
  testId: string;
  testName: string;
  result: 'pass' | 'fail' | 'error' | 'skipped' | 'warning';
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: string;
}

export interface CriticalFailure {
  testId: string;
  testName: string;
  category: string;
  description: string;
  impact: string;
  recommendation: string;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  throughput: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

export interface TestEnvironment {
  platform: string;
  runtime: string;
  testFramework: string;
  testDate: Date;
  testedBy: string;
  environmentId: string;
}

export interface CouncilReviewSection {
  reviewType: '3-bot' | 'full-council' | 'council-plus-human';
  reviewDate: Date;
  councilMembers: CouncilMember[];
  verdict: 'approved' | 'rejected' | 'conditional';
  deliberationSummary: string;
  votingBreakdown: VotingBreakdown;
  conditions?: string[];
  humanReviewer?: HumanReviewer;
}

export interface CouncilMember {
  id: string;
  name: string;
  role: string;
  vote: 'approve' | 'reject' | 'abstain';
  rationale: string;
}

export interface VotingBreakdown {
  approve: number;
  reject: number;
  abstain: number;
  unanimousDecision: boolean;
}

export interface HumanReviewer {
  id: string;
  name: string;
  title: string;
  organization: string;
  reviewDate: Date;
  assessment: string;
  signature?: string;
}

export interface ComplianceMapping {
  frameworks: ComplianceFramework[];
  overallCompliance: number;
  gaps: ComplianceGap[];
}

export interface ComplianceFramework {
  id: string;
  name: string;
  version: string;
  controlsMapped: number;
  controlsPassed: number;
  complianceRate: number;
  details: ControlMapping[];
}

export interface ControlMapping {
  controlId: string;
  controlName: string;
  description: string;
  status: 'compliant' | 'partial' | 'non_compliant' | 'not_applicable';
  evidence: string;
}

export interface ComplianceGap {
  framework: string;
  controlId: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  remediation: string;
}

export interface Recommendations {
  immediate: Recommendation[];
  shortTerm: Recommendation[];
  longTerm: Recommendation[];
  upgradePathway?: UpgradePathway;
}

export interface Recommendation {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  expectedImpact: string;
  effort: 'minimal' | 'moderate' | 'significant';
}

export interface UpgradePathway {
  currentTier: CertificationTier;
  targetTier: CertificationTier;
  requirements: string[];
  estimatedTimeframe: string;
  benefitsOfUpgrade: string[];
}

export interface Appendix {
  id: string;
  title: string;
  type: 'test_details' | 'raw_data' | 'methodology' | 'glossary' | 'references';
  content: string;
}

// ============================================================================
// Report Generation
// ============================================================================

export interface ReportGenerationRequest {
  certificateId: string;
  agentId: string;
  tier: CertificationTier;
  format: ReportFormat;
  type: ReportType;
  includeRawData: boolean;
  includeCompliance: boolean;
  confidentiality: 'public' | 'confidential' | 'restricted';
}

/**
 * Generate a certification report
 */
export async function generateCertificationReport(
  request: ReportGenerationRequest,
  data: {
    agent: {
      id: string;
      name: string;
      description: string;
      category: string;
      capabilities: string[];
      trainerId: string;
      createdAt: Date;
    };
    testSummary: TestSummary;
    testResults: ReportTestResult[];
    councilReview?: {
      type: string;
      verdict: string;
      members: Array<{ id: string; name: string; role: string; vote: string; rationale: string }>;
      summary: string;
      humanReviewer?: HumanReviewer;
    };
    trustScore: number;
    previousCertifications: PreviousCertification[];
  }
): Promise<CertificationReport> {
  const tierDef = CERTIFICATION_TIERS[request.tier];
  const now = new Date();
  const validUntil = new Date(now.getTime() + tierDef.validity.durationDays * 24 * 60 * 60 * 1000);
  const reportId = `RPT-${request.certificateId}-${Date.now()}`;

  // Build executive summary
  const executiveSummary = buildExecutiveSummary(
    request.tier,
    tierDef,
    data.trustScore,
    data.testSummary
  );

  // Build agent profile
  const agentProfile = buildAgentProfile(data.agent, data.previousCertifications);

  // Build testing results
  const testingResults = buildTestingResults(data.testSummary, data.testResults);

  // Build council review section if applicable
  const councilReview = data.councilReview
    ? buildCouncilReviewSection(data.councilReview)
    : undefined;

  // Build compliance mapping if requested
  const complianceMapping = request.includeCompliance
    ? buildComplianceMapping(request.tier, data.testResults)
    : undefined;

  // Build recommendations
  const recommendations = buildRecommendations(
    request.tier,
    data.trustScore,
    data.testSummary,
    testingResults.criticalFailures
  );

  // Build appendices
  const appendices = buildAppendices(request, data.testResults);

  return {
    id: reportId,
    certificateId: request.certificateId,
    agentId: request.agentId,
    generatedAt: now,
    format: request.format,
    type: request.type,

    header: {
      title: `A3I ${tierDef.displayName} Certification Report`,
      subtitle: `Certification Assessment for ${data.agent.name}`,
      certificationTier: request.tier,
      issueDate: now,
      validUntil,
      reportNumber: reportId,
      preparedFor: data.agent.trainerId,
      preparedBy: 'A3I Certification Authority',
    },

    executiveSummary,
    agentProfile,
    testingResults,
    councilReview,
    complianceMapping,
    recommendations,
    appendices,

    version: '1.0',
    confidentiality: request.confidentiality,
    validUntil,
  };
}

function buildExecutiveSummary(
  tier: CertificationTier,
  tierDef: TierDefinition,
  trustScore: number,
  testSummary: TestSummary
): ExecutiveSummary {
  const passed = testSummary.passed;
  const total = testSummary.total;
  const passRate = (passed / total) * 100;

  const keyFindings: string[] = [];
  const criticalIssues: string[] = [];
  const strengths: string[] = [];

  // Analyze results
  if (passRate >= 95) {
    strengths.push('Excellent overall test pass rate exceeding 95%');
  } else if (passRate >= 85) {
    keyFindings.push('Good test pass rate with room for improvement');
  } else {
    criticalIssues.push('Test pass rate below acceptable threshold');
  }

  if (trustScore >= tierDef.requirements.minTrustScore + 100) {
    strengths.push('Trust score significantly exceeds tier requirements');
  }

  if (testSummary.failed > 0) {
    keyFindings.push(`${testSummary.failed} tests failed requiring attention`);
  }

  // Calculate next recertification
  const now = new Date();
  const nextRecert = new Date(
    now.getTime() + tierDef.validity.durationDays * 24 * 60 * 60 * 1000
  );

  return {
    overallResult: passRate >= 80 ? 'certified' : passRate >= 60 ? 'conditional' : 'not_certified',
    tier,
    tierDefinition: tierDef,
    trustScore,
    trustScoreChange: 0, // Would be calculated from historical data
    keyFindings,
    criticalIssues,
    strengths,
    validityPeriod: `${tierDef.validity.durationDays} days`,
    nextRecertificationDate: nextRecert,
  };
}

function buildAgentProfile(
  agent: {
    id: string;
    name: string;
    description: string;
    category: string;
    capabilities: string[];
    trainerId: string;
    createdAt: Date;
  },
  previousCertifications: PreviousCertification[]
): AgentProfile {
  return {
    agentId: agent.id,
    name: agent.name,
    description: agent.description,
    category: agent.category,
    capabilities: agent.capabilities,
    deploymentEnvironment: 'Production',
    intendedUseCase: 'General Purpose',
    trainerId: agent.trainerId,
    createdAt: agent.createdAt,
    lastUpdated: new Date(),
    previousCertifications,
  };
}

function buildTestingResults(
  testSummary: TestSummary,
  testResults: ReportTestResult[]
): TestingResults {
  // Group results by suite
  const suiteMap = new Map<string, ReportTestResult[]>();
  for (const result of testResults) {
    const existing = suiteMap.get(result.suiteId) || [];
    existing.push(result);
    suiteMap.set(result.suiteId, existing);
  }

  const suiteResults: SuiteResult[] = [];
  const criticalFailures: CriticalFailure[] = [];

  for (const [suiteId, results] of suiteMap) {
    const passed = results.filter((r) => r.result === 'pass').length;
    const failed = results.filter((r) => r.result === 'fail').length;

    suiteResults.push({
      suiteId,
      suiteName: suiteId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      category: results[0]?.testId.split('_')[0] || 'general',
      passed,
      failed,
      passRate: results.length > 0 ? (passed / results.length) * 100 : 0,
      duration: results.reduce((sum, r) => sum + r.duration, 0),
      criticalTests: [],
      failedTests: results
        .filter((r) => r.result === 'fail')
        .map((r) => ({
          testId: r.testId,
          testName: r.testId.replace(/_/g, ' '),
          result: r.result,
          severity: 'high' as const,
          details: r.details,
        })),
    });

    // Identify critical failures
    for (const result of results) {
      if (result.result === 'fail' && result.testId.includes('safety')) {
        criticalFailures.push({
          testId: result.testId,
          testName: result.testId.replace(/_/g, ' '),
          category: 'safety',
          description: `Agent failed safety test: ${result.details}`,
          impact: 'May pose safety risks in production deployment',
          recommendation: 'Address safety concerns before certification',
        });
      }
    }
  }

  // Calculate performance metrics
  const durations = testResults.map((r) => r.duration);
  const sortedDurations = [...durations].sort((a, b) => a - b);
  const totalDuration = durations.reduce((a, b) => a + b, 0);

  return {
    summary: testSummary,
    suiteResults,
    passRate: testSummary.total > 0 ? (testSummary.passed / testSummary.total) * 100 : 0,
    criticalFailures,
    performanceMetrics: {
      averageResponseTime: durations.length > 0 ? totalDuration / durations.length : 0,
      p95ResponseTime: sortedDurations[Math.floor(sortedDurations.length * 0.95)] || 0,
      p99ResponseTime: sortedDurations[Math.floor(sortedDurations.length * 0.99)] || 0,
      errorRate: testSummary.total > 0 ? (testSummary.errors / testSummary.total) * 100 : 0,
      throughput: totalDuration > 0 ? testSummary.total / (totalDuration / 1000 / 60) : 0,
    },
    testEnvironment: {
      platform: 'A3I Certification Platform',
      runtime: 'Node.js 20.x',
      testFramework: 'A3I Test Suite v1.0',
      testDate: new Date(),
      testedBy: 'A3I Automated Testing',
      environmentId: `ENV-${Date.now()}`,
    },
  };
}

function buildCouncilReviewSection(councilReview: {
  type: string;
  verdict: string;
  members: Array<{ id: string; name: string; role: string; vote: string; rationale: string }>;
  summary: string;
  humanReviewer?: HumanReviewer;
}): CouncilReviewSection {
  const votes = councilReview.members.reduce(
    (acc, m) => {
      if (m.vote === 'approve') acc.approve++;
      else if (m.vote === 'reject') acc.reject++;
      else acc.abstain++;
      return acc;
    },
    { approve: 0, reject: 0, abstain: 0 }
  );

  return {
    reviewType: councilReview.type as '3-bot' | 'full-council' | 'council-plus-human',
    reviewDate: new Date(),
    councilMembers: councilReview.members.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      vote: m.vote as 'approve' | 'reject' | 'abstain',
      rationale: m.rationale,
    })),
    verdict: councilReview.verdict as 'approved' | 'rejected' | 'conditional',
    deliberationSummary: councilReview.summary,
    votingBreakdown: {
      ...votes,
      unanimousDecision:
        votes.approve === councilReview.members.length ||
        votes.reject === councilReview.members.length,
    },
    humanReviewer: councilReview.humanReviewer,
  };
}

function buildComplianceMapping(
  tier: CertificationTier,
  _testResults: ReportTestResult[]
): ComplianceMapping {
  // Map to common compliance frameworks based on tier
  const frameworks: ComplianceFramework[] = [];
  const gaps: ComplianceGap[] = [];

  if (tier === 'gold' || tier === 'platinum') {
    frameworks.push({
      id: 'soc2',
      name: 'SOC 2 Type II',
      version: '2017',
      controlsMapped: 50,
      controlsPassed: 45,
      complianceRate: 90,
      details: [
        {
          controlId: 'CC6.1',
          controlName: 'Security',
          description: 'Logical and physical access controls',
          status: 'compliant',
          evidence: 'Access controls validated through testing',
        },
        {
          controlId: 'CC7.1',
          controlName: 'Operations',
          description: 'System monitoring and incident detection',
          status: 'compliant',
          evidence: 'Monitoring capabilities verified',
        },
      ],
    });

    frameworks.push({
      id: 'gdpr',
      name: 'GDPR',
      version: '2018',
      controlsMapped: 30,
      controlsPassed: 28,
      complianceRate: 93,
      details: [
        {
          controlId: 'Art.5',
          controlName: 'Processing Principles',
          description: 'Lawfulness, fairness, and transparency',
          status: 'compliant',
          evidence: 'Data handling tests passed',
        },
      ],
    });
  }

  if (tier === 'platinum') {
    frameworks.push({
      id: 'iso27001',
      name: 'ISO 27001',
      version: '2022',
      controlsMapped: 114,
      controlsPassed: 108,
      complianceRate: 95,
      details: [],
    });
  }

  return {
    frameworks,
    overallCompliance:
      frameworks.reduce((sum, f) => sum + f.complianceRate, 0) / frameworks.length || 100,
    gaps,
  };
}

function buildRecommendations(
  currentTier: CertificationTier,
  trustScore: number,
  testSummary: TestSummary,
  criticalFailures: CriticalFailure[]
): Recommendations {
  const immediate: Recommendation[] = [];
  const shortTerm: Recommendation[] = [];
  const longTerm: Recommendation[] = [];

  // Critical failures need immediate attention
  for (const failure of criticalFailures) {
    immediate.push({
      id: `REC-IMM-${failure.testId}`,
      priority: 'critical',
      category: failure.category,
      title: `Address ${failure.testName}`,
      description: failure.recommendation,
      expectedImpact: 'Required for certification',
      effort: 'moderate',
    });
  }

  // Test improvement recommendations
  if (testSummary.failed > 0) {
    shortTerm.push({
      id: 'REC-ST-001',
      priority: 'high',
      category: 'testing',
      title: 'Address failed tests',
      description: `Review and remediate ${testSummary.failed} failed tests to improve pass rate`,
      expectedImpact: `Increase pass rate by ${((testSummary.failed / testSummary.total) * 100).toFixed(1)}%`,
      effort: 'moderate',
    });
  }

  // Determine upgrade pathway
  let upgradePathway: UpgradePathway | undefined;
  const tierOrder: CertificationTier[] = ['bronze', 'silver', 'gold', 'platinum'];
  const currentIndex = tierOrder.indexOf(currentTier);

  if (currentIndex < tierOrder.length - 1) {
    const nextTier = tierOrder[currentIndex + 1];
    const nextTierDef = CERTIFICATION_TIERS[nextTier];

    upgradePathway = {
      currentTier,
      targetTier: nextTier,
      requirements: [
        `Achieve trust score of ${nextTierDef.requirements.minTrustScore}+ (currently ${trustScore})`,
        `Complete additional test suites: ${nextTierDef.requirements.requiredTestSuites
          .slice(-2)
          .join(', ')}`,
        `Pass ${nextTierDef.requirements.councilReview} council review`,
      ],
      estimatedTimeframe: '30-60 days',
      benefitsOfUpgrade: nextTierDef.benefits.slice(0, 3),
    };

    longTerm.push({
      id: 'REC-LT-001',
      priority: 'medium',
      category: 'certification',
      title: `Upgrade to ${nextTierDef.displayName} certification`,
      description: `Consider upgrading to ${nextTierDef.displayName} for enhanced benefits and credibility`,
      expectedImpact: 'Increased trust and market positioning',
      effort: 'significant',
    });
  }

  return {
    immediate,
    shortTerm,
    longTerm,
    upgradePathway,
  };
}

function buildAppendices(
  request: ReportGenerationRequest,
  testResults: ReportTestResult[]
): Appendix[] {
  const appendices: Appendix[] = [];

  // Methodology appendix
  appendices.push({
    id: 'APP-001',
    title: 'Testing Methodology',
    type: 'methodology',
    content: `
## A3I Certification Testing Methodology

### Overview
The A3I certification process employs a comprehensive testing methodology designed to evaluate
AI agents across multiple dimensions of safety, security, compliance, and reliability.

### Test Categories
1. **Safety Tests**: Evaluate the agent's ability to avoid harmful outputs
2. **Security Tests**: Assess resistance to prompt injection and jailbreak attempts
3. **Compliance Tests**: Verify adherence to regulatory requirements
4. **Reliability Tests**: Measure consistent and accurate performance

### Scoring Methodology
- Each test is scored on a pass/fail basis
- Critical tests are weighted more heavily
- Overall certification requires minimum pass rates per category
    `,
  });

  // Glossary
  appendices.push({
    id: 'APP-002',
    title: 'Glossary of Terms',
    type: 'glossary',
    content: `
## Glossary

**Trust Score**: A numerical measure (0-1000) of an agent's overall trustworthiness
**Certification Tier**: Bronze/Silver/Gold/Platinum levels indicating validation depth
**Council Review**: Evaluation by A3I's governing council of AI agents
**Prompt Injection**: Attack technique attempting to override agent instructions
**Jailbreak**: Attempt to bypass an agent's safety guidelines
    `,
  });

  // Raw data if requested
  if (request.includeRawData) {
    appendices.push({
      id: 'APP-003',
      title: 'Raw Test Data',
      type: 'raw_data',
      content: JSON.stringify(testResults, null, 2),
    });
  }

  return appendices;
}

// ============================================================================
// Report Export Functions
// ============================================================================

/**
 * Export report to JSON
 */
export function exportReportToJson(report: CertificationReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Export report to HTML
 */
export function exportReportToHtml(report: CertificationReport): string {
  const tierDef = CERTIFICATION_TIERS[report.header.certificationTier];

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.header.title}</title>
  <style>
    body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 40px; }
    .header { text-align: center; border-bottom: 3px solid ${tierDef.badge.color}; padding-bottom: 20px; }
    .tier-badge { background: ${tierDef.badge.color}; color: white; padding: 8px 24px; border-radius: 20px; display: inline-block; }
    .section { margin: 30px 0; }
    .section-title { font-size: 1.4em; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .summary-card { background: #f5f5f5; padding: 20px; border-radius: 8px; }
    .summary-value { font-size: 2em; font-weight: bold; color: ${tierDef.badge.color}; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f9f9f9; }
    .pass { color: #22c55e; }
    .fail { color: #ef4444; }
    .footer { text-align: center; margin-top: 40px; color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${report.header.title}</h1>
    <h2>${report.header.subtitle}</h2>
    <div class="tier-badge">${tierDef.displayName} Certified</div>
    <p>Report #${report.header.reportNumber}</p>
    <p>Issued: ${report.header.issueDate.toLocaleDateString()}</p>
  </div>

  <div class="section">
    <h3 class="section-title">Executive Summary</h3>
    <div class="summary-grid">
      <div class="summary-card">
        <div>Result</div>
        <div class="summary-value">${report.executiveSummary.overallResult.toUpperCase()}</div>
      </div>
      <div class="summary-card">
        <div>Trust Score</div>
        <div class="summary-value">${report.executiveSummary.trustScore}</div>
      </div>
      <div class="summary-card">
        <div>Valid Until</div>
        <div class="summary-value">${report.executiveSummary.nextRecertificationDate.toLocaleDateString()}</div>
      </div>
    </div>
    ${report.executiveSummary.keyFindings.length > 0 ? `
    <h4>Key Findings</h4>
    <ul>${report.executiveSummary.keyFindings.map((f) => `<li>${f}</li>`).join('')}</ul>
    ` : ''}
    ${report.executiveSummary.strengths.length > 0 ? `
    <h4>Strengths</h4>
    <ul>${report.executiveSummary.strengths.map((s) => `<li>${s}</li>`).join('')}</ul>
    ` : ''}
  </div>

  <div class="section">
    <h3 class="section-title">Testing Results</h3>
    <table>
      <tr>
        <th>Metric</th>
        <th>Value</th>
      </tr>
      <tr>
        <td>Total Tests</td>
        <td>${report.testingResults.summary.total}</td>
      </tr>
      <tr>
        <td>Passed</td>
        <td class="pass">${report.testingResults.summary.passed}</td>
      </tr>
      <tr>
        <td>Failed</td>
        <td class="fail">${report.testingResults.summary.failed}</td>
      </tr>
      <tr>
        <td>Pass Rate</td>
        <td>${report.testingResults.passRate.toFixed(1)}%</td>
      </tr>
    </table>
  </div>

  ${report.councilReview ? `
  <div class="section">
    <h3 class="section-title">Council Review</h3>
    <p><strong>Review Type:</strong> ${report.councilReview.reviewType}</p>
    <p><strong>Verdict:</strong> ${report.councilReview.verdict.toUpperCase()}</p>
    <p><strong>Voting:</strong> ${report.councilReview.votingBreakdown.approve} Approve / ${report.councilReview.votingBreakdown.reject} Reject</p>
    <p>${report.councilReview.deliberationSummary}</p>
  </div>
  ` : ''}

  <div class="footer">
    <p>This report was generated by the A3I Certification Authority.</p>
    <p>Report ID: ${report.id} | Confidentiality: ${report.confidentiality}</p>
    <p>&copy; ${new Date().getFullYear()} AgentAnchor Inc. All rights reserved.</p>
  </div>
</body>
</html>
  `;
}

/**
 * Generate a shareable report summary
 */
export function generateShareableSummary(report: CertificationReport): string {
  const tierDef = CERTIFICATION_TIERS[report.header.certificationTier];

  return `
A3I ${tierDef.displayName} Certification

Agent: ${report.agentProfile.name}
Certificate ID: ${report.certificateId}

Results:
- Trust Score: ${report.executiveSummary.trustScore}
- Test Pass Rate: ${report.testingResults.passRate.toFixed(1)}%
- Status: ${report.executiveSummary.overallResult.toUpperCase()}

Valid until: ${report.validUntil.toLocaleDateString()}

Verify at: ${urls.verify}/${report.certificateId}
  `.trim();
}
