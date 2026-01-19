/**
 * AGENT SKILLS LIBRARY - PART 2
 * Business, Finance, Services, and Professional Skills
 */

import { Skill, SKILL_CATEGORIES } from './skills-part1.js';

const ts = () => new Date().toISOString();
const createSkill = (p: Partial<Skill> & Pick<Skill, 'id' | 'name' | 'tier' | 'category' | 'subcategory' | 'description' | 'systemPrompt'>): Skill => ({
  version: '1.0.0', tags: [], trustLevelRequired: 1, riskCategory: 'none', requiresHumanApproval: false, auditLevel: 'summary',
  prerequisites: [], composedOf: [], conflicts: [], inputs: [], outputs: [], defaultParameters: {}, overrideRules: [],
  executionSteps: [], toolsRequired: [], exampleUsage: [], edgeCases: [], successCriteria: [], failureHandling: [],
  testFixtures: [], auditEvents: [], metricsTracked: [], createdAt: ts(), updatedAt: ts(), ...p,
});

export const SKILLS_PART2: Skill[] = [

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ BUSINESS OPERATIONS                                                       ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'business.create_invoice', name: 'Create Invoice', tier: 'atomic', category: SKILL_CATEGORIES.BUSINESS_OPERATIONS, subcategory: 'billing', tags: ['invoice', 'billing', 'accounting'], trustLevelRequired: 3, riskCategory: 'medium', description: 'Generate professional invoices.', systemPrompt: 'Create professional invoice. Include all required fields. Calculate totals, taxes. Apply payment terms. Format for readability.',
    inputs: [{ name: 'vendor', type: 'object', required: true, description: 'Vendor info' }, { name: 'client', type: 'object', required: true, description: 'Client info' }, { name: 'lineItems', type: 'array', required: true, description: 'Invoice line items' }, { name: 'taxRate', type: 'number', required: false, description: 'Tax rate' }],
    outputs: [{ name: 'invoice', type: 'object', description: 'Complete invoice', nullable: false }, { name: 'total', type: 'currency', description: 'Total amount', nullable: false }],
    auditEvents: [{ event: 'invoice_created', trigger: 'success', data: ['invoice_number', 'client_id', 'total'] }],
  }),

  createSkill({ id: 'business.create_proposal', name: 'Create Proposal', tier: 'atomic', category: SKILL_CATEGORIES.BUSINESS_OPERATIONS, subcategory: 'sales', tags: ['proposal', 'rfp', 'bid'], trustLevelRequired: 2, riskCategory: 'low', description: 'Create business proposals and RFP responses.', systemPrompt: 'Create compelling proposal. Address client needs specifically. Highlight value proposition. Include clear pricing and terms. Make action steps obvious.',
    inputs: [{ name: 'clientInfo', type: 'object', required: true, description: 'Client information and needs' }, { name: 'offering', type: 'object', required: true, description: 'What you are proposing' }, { name: 'pricing', type: 'object', required: true, description: 'Pricing structure' }],
    outputs: [{ name: 'proposal', type: 'object', description: 'Complete proposal', nullable: false }, { name: 'executiveSummary', type: 'string', description: 'Executive summary', nullable: false }],
  }),

  createSkill({ id: 'business.contract_review', name: 'Review Contract', tier: 'atomic', category: SKILL_CATEGORIES.BUSINESS_OPERATIONS, subcategory: 'legal', tags: ['contract', 'legal', 'review'], trustLevelRequired: 2, riskCategory: 'low', description: 'Review contracts for key terms and risks.', systemPrompt: 'Review contract thoroughly. Identify key terms, obligations, risks, unusual clauses. Flag items needing attention. NOT legal advice.',
    inputs: [{ name: 'contract', type: 'string', required: true, description: 'Contract text' }, { name: 'reviewPerspective', type: 'string', required: false, description: 'vendor|buyer', defaultValue: 'vendor' }],
    outputs: [{ name: 'summary', type: 'string', description: 'Contract summary', nullable: false }, { name: 'keyTerms', type: 'array', description: 'Key terms', nullable: false }, { name: 'risks', type: 'array', description: 'Identified risks', nullable: false }],
    governanceNotes: 'Not legal advice. Flag for attorney review on significant contracts.',
  }),

  createSkill({ id: 'business.meeting_notes', name: 'Process Meeting Notes', tier: 'atomic', category: SKILL_CATEGORIES.BUSINESS_OPERATIONS, subcategory: 'productivity', tags: ['meeting', 'notes', 'action-items'], description: 'Process meeting notes into structured outputs.', systemPrompt: 'Process meeting notes. Extract key decisions, action items with owners and dates, discussion points. Create clear summary.',
    inputs: [{ name: 'rawNotes', type: 'string', required: true, description: 'Raw meeting notes' }, { name: 'attendees', type: 'array', required: false, description: 'Meeting attendees' }],
    outputs: [{ name: 'summary', type: 'string', description: 'Meeting summary', nullable: false }, { name: 'decisions', type: 'array', description: 'Decisions made', nullable: false }, { name: 'actionItems', type: 'array', description: 'Action items with owners', nullable: false }],
  }),

  createSkill({ id: 'business.process_expense', name: 'Process Expense', tier: 'atomic', category: SKILL_CATEGORIES.BUSINESS_OPERATIONS, subcategory: 'finance', tags: ['expense', 'reimbursement', 'accounting'], trustLevelRequired: 3, riskCategory: 'medium', description: 'Process expense reports and receipts.', systemPrompt: 'Process expense. Extract amount, date, category, description. Validate against policy. Flag for approval as needed.',
    inputs: [{ name: 'receipt', type: 'any', required: true, description: 'Receipt data or image' }, { name: 'submitter', type: 'string', required: true, description: 'Who is submitting' }, { name: 'purpose', type: 'string', required: true, description: 'Business purpose' }],
    outputs: [{ name: 'expense', type: 'object', description: 'Processed expense', nullable: false }, { name: 'requiresApproval', type: 'boolean', description: 'Needs approval', nullable: false }],
    auditEvents: [{ event: 'expense_processed', trigger: 'success', data: ['amount', 'category', 'submitter'] }],
  }),

  createSkill({ id: 'business.schedule_meeting', name: 'Schedule Meeting', tier: 'atomic', category: SKILL_CATEGORIES.BUSINESS_OPERATIONS, subcategory: 'scheduling', tags: ['calendar', 'meeting', 'scheduling'], trustLevelRequired: 2, riskCategory: 'low', description: 'Find optimal meeting times and schedule.', systemPrompt: 'Find optimal meeting time for all participants. Consider timezones, preferences, existing commitments. Create calendar event.',
    inputs: [{ name: 'participants', type: 'array', required: true, description: 'Required attendees' }, { name: 'duration', type: 'number', required: true, description: 'Duration minutes' }, { name: 'purpose', type: 'string', required: true, description: 'Meeting purpose' }],
    outputs: [{ name: 'suggestedTimes', type: 'array', description: 'Available slots', nullable: false }, { name: 'calendarEvent', type: 'object', description: 'Event to create', nullable: false }],
    toolsRequired: ['calendar'],
  }),

  createSkill({ id: 'business.swot_analysis', name: 'SWOT Analysis', tier: 'atomic', category: SKILL_CATEGORIES.BUSINESS_OPERATIONS, subcategory: 'strategy', tags: ['swot', 'strategy', 'analysis'], description: 'Conduct SWOT analysis for business planning.', systemPrompt: 'Conduct thorough SWOT. Be specific and actionable. Prioritize by impact. Connect insights to strategic recommendations.',
    inputs: [{ name: 'subject', type: 'object', required: true, description: 'Business/project to analyze' }, { name: 'context', type: 'string', required: false, description: 'Market/competitive context' }],
    outputs: [{ name: 'strengths', type: 'array', description: 'Internal strengths', nullable: false }, { name: 'weaknesses', type: 'array', description: 'Internal weaknesses', nullable: false }, { name: 'opportunities', type: 'array', description: 'External opportunities', nullable: false }, { name: 'threats', type: 'array', description: 'External threats', nullable: false }, { name: 'recommendations', type: 'array', description: 'Strategic recommendations', nullable: true }],
  }),

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ FINANCE                                                                   ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'finance.analyze_statement', name: 'Analyze Financial Statement', tier: 'atomic', category: SKILL_CATEGORIES.FINANCE, subcategory: 'analysis', tags: ['financial', 'analysis', 'statement'], trustLevelRequired: 2, riskCategory: 'low', description: 'Analyze financial statements for insights.', systemPrompt: 'Analyze financial statement. Calculate key ratios. Identify trends. Compare to benchmarks. Not investment advice.',
    inputs: [{ name: 'statement', type: 'object', required: true, description: 'Financial statement data' }, { name: 'statementType', type: 'string', required: true, description: 'income|balance|cashflow' }],
    outputs: [{ name: 'analysis', type: 'object', description: 'Financial analysis', nullable: false }, { name: 'ratios', type: 'object', description: 'Key ratios', nullable: false }, { name: 'trends', type: 'array', description: 'Identified trends', nullable: false }],
  }),

  createSkill({ id: 'finance.forecast', name: 'Financial Forecast', tier: 'composite', category: SKILL_CATEGORIES.FINANCE, subcategory: 'planning', tags: ['forecast', 'projection', 'budget'], trustLevelRequired: 2, riskCategory: 'low', composedOf: ['math.regression', 'math.statistics'], description: 'Create financial forecasts and projections.', systemPrompt: 'Create financial forecast. Base on historical data. Model multiple scenarios. State assumptions clearly. Not investment advice.',
    inputs: [{ name: 'historicalData', type: 'array', required: true, description: 'Historical data' }, { name: 'forecastPeriod', type: 'string', required: true, description: 'How far to forecast' }, { name: 'assumptions', type: 'object', required: true, description: 'Key assumptions' }],
    outputs: [{ name: 'forecast', type: 'object', description: 'Financial forecast', nullable: false }, { name: 'scenarios', type: 'object', description: 'Scenario results', nullable: false }],
  }),

  createSkill({ id: 'finance.categorize_transaction', name: 'Categorize Transaction', tier: 'atomic', category: SKILL_CATEGORIES.FINANCE, subcategory: 'accounting', tags: ['transaction', 'categorization', 'bookkeeping'], trustLevelRequired: 2, riskCategory: 'low', description: 'Categorize financial transactions.', systemPrompt: 'Categorize transaction based on description, amount, merchant. Map to chart of accounts. Flag unusual transactions.',
    inputs: [{ name: 'transaction', type: 'object', required: true, description: 'Transaction to categorize' }, { name: 'chartOfAccounts', type: 'array', required: false, description: 'Available categories' }],
    outputs: [{ name: 'category', type: 'string', description: 'Assigned category', nullable: false }, { name: 'confidence', type: 'number', description: 'Confidence 0-1', nullable: false }],
  }),

  createSkill({ id: 'finance.reconcile', name: 'Reconcile Accounts', tier: 'composite', category: SKILL_CATEGORIES.FINANCE, subcategory: 'accounting', tags: ['reconciliation', 'accounting', 'matching'], trustLevelRequired: 3, riskCategory: 'medium', auditLevel: 'detailed', composedOf: ['data.join', 'data.filter'], description: 'Reconcile financial accounts.', systemPrompt: 'Reconcile accounts. Match transactions between sources. Identify discrepancies. Report unmatched items. Calculate balances.',
    inputs: [{ name: 'sourceA', type: 'array', required: true, description: 'First source (bank)' }, { name: 'sourceB', type: 'array', required: true, description: 'Second source (books)' }],
    outputs: [{ name: 'matched', type: 'array', description: 'Matched transactions', nullable: false }, { name: 'discrepancies', type: 'array', description: 'Discrepancies found', nullable: false }, { name: 'balanceCheck', type: 'object', description: 'Balance reconciliation', nullable: false }],
    auditEvents: [{ event: 'reconciliation_complete', trigger: 'success', data: ['matched_count', 'discrepancy_count'] }],
  }),

  createSkill({ id: 'finance.budget_variance', name: 'Budget Variance Analysis', tier: 'atomic', category: SKILL_CATEGORIES.FINANCE, subcategory: 'analysis', tags: ['budget', 'variance', 'analysis'], trustLevelRequired: 2, riskCategory: 'low', description: 'Analyze budget vs actual variance.', systemPrompt: 'Analyze variance between budget and actual. Calculate absolute and percentage variances. Identify significant deviations. Provide explanations.',
    inputs: [{ name: 'budget', type: 'object', required: true, description: 'Budgeted amounts' }, { name: 'actual', type: 'object', required: true, description: 'Actual amounts' }],
    outputs: [{ name: 'variances', type: 'object', description: 'Variance by line item', nullable: false }, { name: 'significantDeviations', type: 'array', description: 'Major variances', nullable: false }],
  }),

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ CUSTOMER SERVICE                                                          ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'cs.respond_inquiry', name: 'Respond to Inquiry', tier: 'atomic', category: SKILL_CATEGORIES.CUSTOMER_SERVICE, subcategory: 'support', tags: ['support', 'inquiry', 'response'], trustLevelRequired: 2, riskCategory: 'low', description: 'Respond to customer inquiries helpfully.', systemPrompt: 'Respond to customer inquiry. Be helpful and empathetic. Answer fully. Provide next steps. Maintain brand voice. De-escalate frustration.',
    inputs: [{ name: 'inquiry', type: 'string', required: true, description: 'Customer message' }, { name: 'customerContext', type: 'object', required: false, description: 'Customer history' }],
    outputs: [{ name: 'response', type: 'string', description: 'Response to send', nullable: false }, { name: 'category', type: 'string', description: 'Inquiry category', nullable: false }, { name: 'escalationNeeded', type: 'boolean', description: 'Needs human', nullable: false }],
  }),

  createSkill({ id: 'cs.handle_complaint', name: 'Handle Complaint', tier: 'atomic', category: SKILL_CATEGORIES.CUSTOMER_SERVICE, subcategory: 'resolution', tags: ['complaint', 'resolution', 'escalation'], trustLevelRequired: 3, riskCategory: 'medium', description: 'Handle customer complaints and resolve.', systemPrompt: 'Handle complaint with empathy. Acknowledge issue. Apologize appropriately. Investigate cause. Propose resolution. Document fully.',
    inputs: [{ name: 'complaint', type: 'string', required: true, description: 'Complaint details' }, { name: 'customerInfo', type: 'object', required: true, description: 'Customer information' }],
    outputs: [{ name: 'response', type: 'string', description: 'Initial response', nullable: false }, { name: 'proposedResolution', type: 'object', description: 'Resolution proposal', nullable: false }, { name: 'escalated', type: 'boolean', description: 'Was escalated', nullable: false }],
  }),

  createSkill({ id: 'cs.triage_ticket', name: 'Triage Support Ticket', tier: 'atomic', category: SKILL_CATEGORIES.CUSTOMER_SERVICE, subcategory: 'operations', tags: ['triage', 'ticket', 'priority'], trustLevelRequired: 2, riskCategory: 'low', description: 'Triage incoming support tickets.', systemPrompt: 'Triage ticket. Assess urgency and complexity. Categorize issue. Route to appropriate queue. Identify if auto-resolvable.',
    inputs: [{ name: 'ticket', type: 'object', required: true, description: 'Ticket content' }, { name: 'queues', type: 'array', required: true, description: 'Available queues' }],
    outputs: [{ name: 'priority', type: 'string', description: 'low|medium|high|critical', nullable: false }, { name: 'category', type: 'string', description: 'Issue category', nullable: false }, { name: 'queue', type: 'string', description: 'Assigned queue', nullable: false }],
  }),

  createSkill({ id: 'cs.sentiment_analysis', name: 'Customer Sentiment Analysis', tier: 'atomic', category: SKILL_CATEGORIES.CUSTOMER_SERVICE, subcategory: 'analysis', tags: ['sentiment', 'analysis', 'satisfaction'], description: 'Analyze customer sentiment from interactions.', systemPrompt: 'Analyze customer sentiment. Detect frustration, satisfaction, urgency. Identify at-risk customers. Recommend intervention if needed.',
    inputs: [{ name: 'interactions', type: 'array', required: true, description: 'Customer interactions' }],
    outputs: [{ name: 'overallSentiment', type: 'string', description: 'positive|neutral|negative', nullable: false }, { name: 'sentimentScore', type: 'number', description: 'Score -1 to 1', nullable: false }, { name: 'churnRisk', type: 'string', description: 'low|medium|high', nullable: true }],
  }),

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ PROJECT MANAGEMENT                                                        ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'pm.create_project_plan', name: 'Create Project Plan', tier: 'composite', category: SKILL_CATEGORIES.PROJECT_MANAGEMENT, subcategory: 'planning', tags: ['project', 'plan', 'timeline'], trustLevelRequired: 2, riskCategory: 'low', composedOf: ['cognition.decompose_problem', 'cognition.strategic_planning'], description: 'Create comprehensive project plans.', systemPrompt: 'Create project plan. Define scope and deliverables. Break into phases and tasks. Estimate effort. Assign resources. Identify dependencies. Create timeline.',
    inputs: [{ name: 'projectGoal', type: 'string', required: true, description: 'Project objective' }, { name: 'scope', type: 'object', required: true, description: 'Project scope' }, { name: 'constraints', type: 'object', required: false, description: 'Time, budget, resources' }],
    outputs: [{ name: 'projectPlan', type: 'object', description: 'Complete plan', nullable: false }, { name: 'tasks', type: 'array', description: 'Task breakdown', nullable: false }, { name: 'timeline', type: 'object', description: 'Project timeline', nullable: false }, { name: 'milestones', type: 'array', description: 'Key milestones', nullable: false }],
  }),

  createSkill({ id: 'pm.status_report', name: 'Generate Status Report', tier: 'atomic', category: SKILL_CATEGORIES.PROJECT_MANAGEMENT, subcategory: 'reporting', tags: ['status', 'report', 'progress'], description: 'Generate project status reports.', systemPrompt: 'Generate status report. Summarize progress against plan. Highlight accomplishments. Flag blockers and risks. Provide next steps.',
    inputs: [{ name: 'projectData', type: 'object', required: true, description: 'Current project data' }, { name: 'audience', type: 'string', required: false, description: 'executive|team|stakeholder', defaultValue: 'stakeholder' }],
    outputs: [{ name: 'report', type: 'object', description: 'Status report', nullable: false }, { name: 'healthStatus', type: 'string', description: 'green|yellow|red', nullable: false }, { name: 'blockers', type: 'array', description: 'Current blockers', nullable: true }],
  }),

  createSkill({ id: 'pm.estimate_effort', name: 'Estimate Effort', tier: 'atomic', category: SKILL_CATEGORIES.PROJECT_MANAGEMENT, subcategory: 'estimation', tags: ['estimation', 'effort', 'sizing'], description: 'Estimate effort for tasks.', systemPrompt: 'Estimate effort accurately. Consider complexity, unknowns, dependencies. Use three-point estimation. Provide range, not point estimate. Note assumptions.',
    inputs: [{ name: 'workItem', type: 'object', required: true, description: 'Work to estimate' }, { name: 'historicalData', type: 'array', required: false, description: 'Similar past work' }],
    outputs: [{ name: 'estimate', type: 'object', description: 'Optimistic, likely, pessimistic', nullable: false }, { name: 'confidence', type: 'number', description: 'Confidence level', nullable: false }, { name: 'assumptions', type: 'array', description: 'Assumptions made', nullable: false }],
  }),

  createSkill({ id: 'pm.risk_assessment', name: 'Assess Project Risks', tier: 'atomic', category: SKILL_CATEGORIES.PROJECT_MANAGEMENT, subcategory: 'risk', tags: ['risk', 'assessment', 'mitigation'], trustLevelRequired: 2, riskCategory: 'low', description: 'Identify and assess project risks.', systemPrompt: 'Identify risks. Assess probability and impact. Prioritize by risk score. Propose mitigation strategies. Create risk register.',
    inputs: [{ name: 'projectInfo', type: 'object', required: true, description: 'Project details' }],
    outputs: [{ name: 'risks', type: 'array', description: 'Identified risks with scores', nullable: false }, { name: 'riskMatrix', type: 'object', description: 'Probability/impact matrix', nullable: false }, { name: 'mitigations', type: 'array', description: 'Mitigation strategies', nullable: false }],
  }),

  createSkill({ id: 'pm.resource_allocation', name: 'Allocate Resources', tier: 'atomic', category: SKILL_CATEGORIES.PROJECT_MANAGEMENT, subcategory: 'resources', tags: ['resources', 'allocation', 'scheduling'], trustLevelRequired: 2, riskCategory: 'low', description: 'Allocate resources across projects.', systemPrompt: 'Allocate resources optimally. Balance workloads. Consider skills match. Identify conflicts. Recommend adjustments.',
    inputs: [{ name: 'resources', type: 'array', required: true, description: 'Available resources' }, { name: 'tasks', type: 'array', required: true, description: 'Tasks needing resources' }, { name: 'constraints', type: 'object', required: false, description: 'Allocation constraints' }],
    outputs: [{ name: 'allocations', type: 'array', description: 'Resource assignments', nullable: false }, { name: 'conflicts', type: 'array', description: 'Identified conflicts', nullable: true }, { name: 'utilization', type: 'object', description: 'Resource utilization', nullable: false }],
  }),

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ MARKETING                                                                 ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'marketing.write_copy', name: 'Write Marketing Copy', tier: 'atomic', category: SKILL_CATEGORIES.MARKETING, subcategory: 'content', tags: ['copywriting', 'marketing', 'advertising'], description: 'Write compelling marketing copy.', systemPrompt: 'Write persuasive copy. Know the audience. Lead with benefit. Use clear CTA. Match brand voice. A/B test variations.',
    inputs: [{ name: 'product', type: 'object', required: true, description: 'Product/service info' }, { name: 'audience', type: 'object', required: true, description: 'Target audience' }, { name: 'channel', type: 'string', required: true, description: 'email|social|landing_page|ad' }],
    outputs: [{ name: 'copy', type: 'string', description: 'Marketing copy', nullable: false }, { name: 'headline', type: 'string', description: 'Headline', nullable: false }, { name: 'cta', type: 'string', description: 'Call to action', nullable: false }],
  }),

  createSkill({ id: 'marketing.seo_optimize', name: 'SEO Optimization', tier: 'atomic', category: SKILL_CATEGORIES.MARKETING, subcategory: 'seo', tags: ['seo', 'optimization', 'keywords'], description: 'Optimize content for search engines.', systemPrompt: 'Optimize for SEO. Research keywords. Optimize title, meta, headers. Improve readability. Keep it natural.',
    inputs: [{ name: 'content', type: 'string', required: true, description: 'Content to optimize' }, { name: 'targetKeywords', type: 'array', required: false, description: 'Target keywords' }],
    outputs: [{ name: 'optimizedContent', type: 'string', description: 'SEO-optimized content', nullable: false }, { name: 'metaTitle', type: 'string', description: 'Optimized title', nullable: false }, { name: 'metaDescription', type: 'string', description: 'Meta description', nullable: false }],
  }),

  createSkill({ id: 'marketing.social_post', name: 'Create Social Post', tier: 'atomic', category: SKILL_CATEGORIES.MARKETING, subcategory: 'social', tags: ['social', 'post', 'engagement'], description: 'Create engaging social media posts.', systemPrompt: 'Create engaging social post. Match platform best practices. Use appropriate hashtags. Include visual direction. Optimize for engagement.',
    inputs: [{ name: 'topic', type: 'string', required: true, description: 'Post topic' }, { name: 'platform', type: 'string', required: true, description: 'twitter|linkedin|instagram|facebook' }],
    outputs: [{ name: 'post', type: 'string', description: 'Post content', nullable: false }, { name: 'hashtags', type: 'array', description: 'Recommended hashtags', nullable: true }],
  }),

  createSkill({ id: 'marketing.competitor_analysis', name: 'Competitor Analysis', tier: 'composite', category: SKILL_CATEGORIES.MARKETING, subcategory: 'research', tags: ['competitor', 'analysis', 'strategy'], trustLevelRequired: 2, riskCategory: 'low', composedOf: ['web.search', 'cognition.compare_contrast'], description: 'Analyze competitors for strategy.', systemPrompt: 'Analyze competitors. Research products, pricing, positioning, strengths, weaknesses. Compare objectively. Identify opportunities and threats.',
    inputs: [{ name: 'competitors', type: 'array', required: true, description: 'Competitors to analyze' }],
    outputs: [{ name: 'analysis', type: 'object', description: 'Competitor analysis', nullable: false }, { name: 'comparisonMatrix', type: 'object', description: 'Feature comparison', nullable: false }, { name: 'opportunities', type: 'array', description: 'Market opportunities', nullable: false }],
    toolsRequired: ['web_search'],
  }),

  createSkill({ id: 'marketing.email_campaign', name: 'Design Email Campaign', tier: 'atomic', category: SKILL_CATEGORIES.MARKETING, subcategory: 'email', tags: ['email', 'campaign', 'automation'], description: 'Design email marketing campaigns.', systemPrompt: 'Design email campaign. Define segments. Create email sequence. Write compelling subject lines. Include clear CTAs. Plan timing.',
    inputs: [{ name: 'objective', type: 'string', required: true, description: 'Campaign goal' }, { name: 'audience', type: 'object', required: true, description: 'Target audience' }, { name: 'emailCount', type: 'number', required: false, description: 'Number of emails in sequence', defaultValue: 5 }],
    outputs: [{ name: 'campaign', type: 'object', description: 'Campaign structure', nullable: false }, { name: 'emails', type: 'array', description: 'Email content', nullable: false }, { name: 'schedule', type: 'array', description: 'Send schedule', nullable: false }],
  }),

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ SALES                                                                     ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'sales.qualify_lead', name: 'Qualify Lead', tier: 'atomic', category: SKILL_CATEGORIES.SALES, subcategory: 'pipeline', tags: ['lead', 'qualification', 'sales'], trustLevelRequired: 2, riskCategory: 'low', description: 'Qualify leads based on criteria.', systemPrompt: 'Qualify lead against criteria. Assess BANT (Budget, Authority, Need, Timeline). Score lead. Recommend next action. Flag disqualifiers.',
    inputs: [{ name: 'leadInfo', type: 'object', required: true, description: 'Lead information' }, { name: 'qualificationCriteria', type: 'object', required: false, description: 'Qualification criteria' }],
    outputs: [{ name: 'qualified', type: 'boolean', description: 'Is qualified', nullable: false }, { name: 'score', type: 'number', description: 'Lead score 0-100', nullable: false }, { name: 'nextAction', type: 'string', description: 'Recommended next step', nullable: false }],
  }),

  createSkill({ id: 'sales.write_outreach', name: 'Write Sales Outreach', tier: 'atomic', category: SKILL_CATEGORIES.SALES, subcategory: 'outreach', tags: ['outreach', 'email', 'prospecting'], description: 'Write personalized sales outreach.', systemPrompt: 'Write personalized outreach. Research prospect. Lead with their pain/goal. Be concise. Include specific value. Clear CTA. Avoid spam patterns.',
    inputs: [{ name: 'prospect', type: 'object', required: true, description: 'Prospect information' }, { name: 'product', type: 'object', required: true, description: 'Product being sold' }, { name: 'channel', type: 'string', required: false, description: 'email|linkedin|phone_script', defaultValue: 'email' }],
    outputs: [{ name: 'message', type: 'string', description: 'Outreach message', nullable: false }, { name: 'subject', type: 'string', description: 'Subject line', nullable: true }],
  }),

  createSkill({ id: 'sales.handle_objection', name: 'Handle Objection', tier: 'atomic', category: SKILL_CATEGORIES.SALES, subcategory: 'closing', tags: ['objection', 'handling', 'closing'], trustLevelRequired: 2, riskCategory: 'low', description: 'Handle sales objections effectively.', systemPrompt: 'Handle objection professionally. Acknowledge concern. Clarify understanding. Respond with evidence/story. Check if resolved. Dont be pushy.',
    inputs: [{ name: 'objection', type: 'string', required: true, description: 'The objection' }, { name: 'product', type: 'object', required: true, description: 'Product info' }],
    outputs: [{ name: 'response', type: 'string', description: 'Objection response', nullable: false }, { name: 'objectionType', type: 'string', description: 'price|timing|authority|need|trust', nullable: false }],
  }),

  createSkill({ id: 'sales.forecast_pipeline', name: 'Forecast Sales Pipeline', tier: 'atomic', category: SKILL_CATEGORIES.SALES, subcategory: 'forecasting', tags: ['forecast', 'pipeline', 'revenue'], trustLevelRequired: 2, riskCategory: 'low', description: 'Forecast sales from pipeline data.', systemPrompt: 'Forecast pipeline accurately. Weight by stage probability. Consider historical conversion. Identify at-risk deals. Provide range.',
    inputs: [{ name: 'pipeline', type: 'array', required: true, description: 'Current pipeline deals' }, { name: 'historicalRates', type: 'object', required: false, description: 'Historical conversion rates' }],
    outputs: [{ name: 'forecast', type: 'object', description: 'Revenue forecast', nullable: false }, { name: 'atRiskDeals', type: 'array', description: 'Deals at risk', nullable: true }],
  }),

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ HR / PEOPLE                                                               ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'hr.screen_resume', name: 'Screen Resume', tier: 'atomic', category: SKILL_CATEGORIES.HR_PEOPLE, subcategory: 'recruiting', tags: ['resume', 'screening', 'hiring'], trustLevelRequired: 2, riskCategory: 'low', description: 'Screen resumes against job requirements.', systemPrompt: 'Screen resume objectively. Match against requirements. Score qualifications. Identify strengths and gaps. Flag concerns. Recommend action.',
    inputs: [{ name: 'resume', type: 'string', required: true, description: 'Resume content' }, { name: 'jobDescription', type: 'object', required: true, description: 'Job requirements' }],
    outputs: [{ name: 'score', type: 'number', description: 'Match score 0-100', nullable: false }, { name: 'recommendation', type: 'string', description: 'advance|hold|reject', nullable: false }, { name: 'matchedRequirements', type: 'array', description: 'Requirements met', nullable: false }],
  }),

  createSkill({ id: 'hr.write_job_description', name: 'Write Job Description', tier: 'atomic', category: SKILL_CATEGORIES.HR_PEOPLE, subcategory: 'recruiting', tags: ['job', 'description', 'hiring'], description: 'Create compelling job descriptions.', systemPrompt: 'Write engaging job description. Sell the opportunity. Be clear about requirements. Include salary range if possible. Avoid biased language.',
    inputs: [{ name: 'role', type: 'object', required: true, description: 'Role details' }, { name: 'requirements', type: 'array', required: true, description: 'Job requirements' }, { name: 'company', type: 'object', required: true, description: 'Company info' }],
    outputs: [{ name: 'jobDescription', type: 'string', description: 'Complete job description', nullable: false }, { name: 'title', type: 'string', description: 'Job title', nullable: false }],
  }),

  createSkill({ id: 'hr.performance_review', name: 'Draft Performance Review', tier: 'atomic', category: SKILL_CATEGORIES.HR_PEOPLE, subcategory: 'performance', tags: ['performance', 'review', 'feedback'], trustLevelRequired: 3, riskCategory: 'medium', description: 'Draft performance review from notes.', systemPrompt: 'Draft balanced performance review. Use specific examples. Be constructive. Include achievements and growth areas. Set clear expectations.',
    inputs: [{ name: 'employee', type: 'object', required: true, description: 'Employee info' }, { name: 'goals', type: 'array', required: true, description: 'Goals and outcomes' }, { name: 'feedback', type: 'array', required: false, description: 'Collected feedback' }],
    outputs: [{ name: 'review', type: 'object', description: 'Performance review draft', nullable: false }, { name: 'rating', type: 'string', description: 'Overall rating', nullable: false }, { name: 'developmentAreas', type: 'array', description: 'Areas to develop', nullable: false }],
    governanceNotes: 'HR review required before delivery. Contains sensitive information.',
  }),

  createSkill({ id: 'hr.onboarding_plan', name: 'Create Onboarding Plan', tier: 'atomic', category: SKILL_CATEGORIES.HR_PEOPLE, subcategory: 'onboarding', tags: ['onboarding', 'new-hire', 'training'], description: 'Create new hire onboarding plan.', systemPrompt: 'Create comprehensive onboarding plan. Cover first 90 days. Include training, introductions, milestones. Assign buddy/mentor. Schedule check-ins.',
    inputs: [{ name: 'role', type: 'object', required: true, description: 'Role details' }, { name: 'startDate', type: 'date', required: true, description: 'Start date' }, { name: 'team', type: 'object', required: false, description: 'Team context' }],
    outputs: [{ name: 'plan', type: 'object', description: 'Onboarding plan', nullable: false }, { name: 'milestones', type: 'array', description: '30/60/90 day milestones', nullable: false }, { name: 'schedule', type: 'array', description: 'First week schedule', nullable: false }],
  }),

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ SECURITY                                                                  ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'security.analyze_threat', name: 'Analyze Threat', tier: 'atomic', category: SKILL_CATEGORIES.SECURITY, subcategory: 'analysis', tags: ['threat', 'security', 'risk'], trustLevelRequired: 3, riskCategory: 'medium', description: 'Analyze potential security threats.', systemPrompt: 'Analyze threat comprehensively. Assess attack vectors, probability, impact. Identify affected assets. Recommend mitigations. Prioritize by risk.',
    inputs: [{ name: 'threat', type: 'object', required: true, description: 'Threat information' }, { name: 'assets', type: 'array', required: false, description: 'Assets to assess' }],
    outputs: [{ name: 'analysis', type: 'object', description: 'Threat analysis', nullable: false }, { name: 'riskLevel', type: 'string', description: 'low|medium|high|critical', nullable: false }, { name: 'recommendations', type: 'array', description: 'Security recommendations', nullable: false }],
  }),

  createSkill({ id: 'security.review_code', name: 'Security Code Review', tier: 'atomic', category: SKILL_CATEGORIES.SECURITY, subcategory: 'appsec', tags: ['security', 'code', 'vulnerabilities'], trustLevelRequired: 2, riskCategory: 'low', description: 'Review code for security vulnerabilities.', systemPrompt: 'Review for security issues. Check OWASP top 10. Look for injection, auth issues, data exposure. Assess severity. Provide fixes.',
    inputs: [{ name: 'code', type: 'string', required: true, description: 'Code to review' }, { name: 'language', type: 'string', required: true, description: 'Programming language' }],
    outputs: [{ name: 'vulnerabilities', type: 'array', description: 'Found vulnerabilities', nullable: false }, { name: 'severity', type: 'string', description: 'Overall severity', nullable: false }, { name: 'recommendations', type: 'array', description: 'Fix recommendations', nullable: false }],
  }),

  createSkill({ id: 'security.detect_phishing', name: 'Detect Phishing', tier: 'atomic', category: SKILL_CATEGORIES.SECURITY, subcategory: 'detection', tags: ['phishing', 'detection', 'email'], trustLevelRequired: 2, riskCategory: 'low', description: 'Analyze content for phishing indicators.', systemPrompt: 'Analyze for phishing. Check sender, links, urgency tactics, grammar, requests. Score likelihood. Explain red flags.',
    inputs: [{ name: 'content', type: 'string', required: true, description: 'Content to analyze' }, { name: 'sender', type: 'string', required: false, description: 'Sender information' }],
    outputs: [{ name: 'isPhishing', type: 'boolean', description: 'Phishing detected', nullable: false }, { name: 'confidence', type: 'number', description: 'Confidence 0-1', nullable: false }, { name: 'indicators', type: 'array', description: 'Red flags found', nullable: false }],
  }),

  createSkill({ id: 'security.incident_response', name: 'Incident Response', tier: 'composite', category: SKILL_CATEGORIES.SECURITY, subcategory: 'response', tags: ['incident', 'response', 'breach'], trustLevelRequired: 4, riskCategory: 'high', auditLevel: 'forensic', composedOf: ['security.analyze_threat', 'communication.crisis_communication'], description: 'Guide security incident response.', systemPrompt: 'Guide incident response. Contain threat. Preserve evidence. Assess impact. Coordinate remediation. Prepare communications. Document timeline.',
    inputs: [{ name: 'incident', type: 'object', required: true, description: 'Incident details' }, { name: 'affectedSystems', type: 'array', required: true, description: 'Affected systems' }],
    outputs: [{ name: 'responseSteps', type: 'array', description: 'Immediate actions', nullable: false }, { name: 'containmentPlan', type: 'object', description: 'Containment strategy', nullable: false }, { name: 'communicationPlan', type: 'object', description: 'Stakeholder communications', nullable: false }],
    governanceNotes: 'All incident responses logged. Legal may need notification.',
  }),

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ CREATIVE                                                                  ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'creative.write_story', name: 'Write Story', tier: 'atomic', category: SKILL_CATEGORIES.CREATIVE, subcategory: 'writing', tags: ['story', 'fiction', 'narrative'], description: 'Write creative fiction and stories.', systemPrompt: 'Write engaging story. Develop characters. Create conflict and tension. Use vivid descriptions. Show don\'t tell. Match genre conventions.',
    inputs: [{ name: 'premise', type: 'string', required: true, description: 'Story premise' }, { name: 'genre', type: 'string', required: false, description: 'Story genre' }, { name: 'length', type: 'string', required: false, description: 'flash|short|long', defaultValue: 'short' }],
    outputs: [{ name: 'story', type: 'string', description: 'The story', nullable: false }, { name: 'title', type: 'string', description: 'Story title', nullable: false }],
  }),

  createSkill({ id: 'creative.brainstorm', name: 'Creative Brainstorm', tier: 'atomic', category: SKILL_CATEGORIES.CREATIVE, subcategory: 'ideation', tags: ['brainstorm', 'ideas', 'creativity'], description: 'Generate creative ideas.', systemPrompt: 'Generate diverse creative ideas. Use lateral thinking. Combine unexpected elements. Avoid self-censoring. Build on ideas. Challenge assumptions.',
    inputs: [{ name: 'challenge', type: 'string', required: true, description: 'Creative challenge' }, { name: 'quantity', type: 'number', required: false, description: 'Number of ideas', defaultValue: 10 }],
    outputs: [{ name: 'ideas', type: 'array', description: 'Generated ideas', nullable: false }, { name: 'topPicks', type: 'array', description: 'Most promising', nullable: true }],
  }),

  createSkill({ id: 'creative.write_script', name: 'Write Script', tier: 'atomic', category: SKILL_CATEGORIES.CREATIVE, subcategory: 'writing', tags: ['script', 'dialogue', 'video'], description: 'Write scripts for video or audio.', systemPrompt: 'Write engaging script. Create natural dialogue. Include directions. Time appropriately. Match medium conventions.',
    inputs: [{ name: 'concept', type: 'string', required: true, description: 'Script concept' }, { name: 'medium', type: 'string', required: true, description: 'video|audio|presentation' }, { name: 'duration', type: 'number', required: false, description: 'Target duration seconds' }],
    outputs: [{ name: 'script', type: 'string', description: 'Complete script', nullable: false }, { name: 'estimatedDuration', type: 'number', description: 'Estimated duration', nullable: false }],
  }),

  createSkill({ id: 'creative.image_prompt', name: 'Create Image Prompt', tier: 'atomic', category: SKILL_CATEGORIES.CREATIVE, subcategory: 'visual', tags: ['image', 'prompt', 'ai'], description: 'Create prompts for AI image generation.', systemPrompt: 'Create detailed image prompt. Specify subject, style, composition, lighting, mood. Use effective prompt techniques for target model.',
    inputs: [{ name: 'concept', type: 'string', required: true, description: 'Image concept' }, { name: 'style', type: 'string', required: false, description: 'Visual style' }, { name: 'model', type: 'string', required: false, description: 'dalle|midjourney|stable_diffusion', defaultValue: 'midjourney' }],
    outputs: [{ name: 'prompt', type: 'string', description: 'Image prompt', nullable: false }, { name: 'negativePrompt', type: 'string', description: 'Negative prompt', nullable: true }],
  }),

  createSkill({ id: 'creative.brand_naming', name: 'Brand Naming', tier: 'atomic', category: SKILL_CATEGORIES.CREATIVE, subcategory: 'branding', tags: ['naming', 'brand', 'identity'], description: 'Generate brand and product names.', systemPrompt: 'Generate brand names. Consider: memorability, pronunciation, meaning, available domains, cultural implications, competitor names. Provide multiple options.',
    inputs: [{ name: 'brief', type: 'object', required: true, description: 'Brand/product brief' }, { name: 'style', type: 'string', required: false, description: 'descriptive|abstract|coined|portmanteau' }],
    outputs: [{ name: 'names', type: 'array', description: 'Name suggestions', nullable: false }, { name: 'rationale', type: 'object', description: 'Reasoning per name', nullable: false }],
  }),

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ PERSONAL PRODUCTIVITY                                                     ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'productivity.prioritize_tasks', name: 'Prioritize Tasks', tier: 'atomic', category: SKILL_CATEGORIES.PERSONAL_PRODUCTIVITY, subcategory: 'planning', tags: ['prioritization', 'tasks', 'productivity'], description: 'Prioritize tasks using frameworks.', systemPrompt: 'Prioritize tasks effectively. Use appropriate framework (Eisenhower, MoSCoW, ICE). Consider urgency, importance, effort, impact. Create actionable list.',
    inputs: [{ name: 'tasks', type: 'array', required: true, description: 'Tasks to prioritize' }, { name: 'framework', type: 'string', required: false, description: 'eisenhower|moscow|ice|rice', defaultValue: 'eisenhower' }],
    outputs: [{ name: 'prioritizedTasks', type: 'array', description: 'Tasks in priority order', nullable: false }, { name: 'todayFocus', type: 'array', description: 'Today top tasks', nullable: true }],
  }),

  createSkill({ id: 'productivity.time_block', name: 'Create Time Blocks', tier: 'atomic', category: SKILL_CATEGORIES.PERSONAL_PRODUCTIVITY, subcategory: 'planning', tags: ['timeblocking', 'schedule', 'calendar'], description: 'Create time-blocked schedules.', systemPrompt: 'Create time-blocked schedule. Batch similar tasks. Include breaks. Respect energy patterns. Leave buffer. Be realistic.',
    inputs: [{ name: 'tasks', type: 'array', required: true, description: 'Tasks to schedule' }, { name: 'availableTime', type: 'object', required: true, description: 'Available time slots' }],
    outputs: [{ name: 'schedule', type: 'array', description: 'Time-blocked schedule', nullable: false }, { name: 'unscheduled', type: 'array', description: 'Tasks that didnt fit', nullable: true }],
  }),

  createSkill({ id: 'productivity.goal_breakdown', name: 'Break Down Goal', tier: 'atomic', category: SKILL_CATEGORIES.PERSONAL_PRODUCTIVITY, subcategory: 'goals', tags: ['goals', 'planning', 'breakdown'], description: 'Break large goals into actionable steps.', systemPrompt: 'Break goal into actionable steps. Work backwards from outcome. Create milestones. Identify first action. Make steps small enough to start immediately.',
    inputs: [{ name: 'goal', type: 'string', required: true, description: 'Goal to break down' }, { name: 'deadline', type: 'date', required: false, description: 'Target date' }],
    outputs: [{ name: 'milestones', type: 'array', description: 'Key milestones', nullable: false }, { name: 'actionSteps', type: 'array', description: 'Specific actions', nullable: false }, { name: 'firstAction', type: 'string', description: 'Immediate first action', nullable: false }],
  }),

  createSkill({ id: 'productivity.habit_design', name: 'Design Habit', tier: 'atomic', category: SKILL_CATEGORIES.PERSONAL_PRODUCTIVITY, subcategory: 'habits', tags: ['habits', 'behavior', 'change'], description: 'Design effective habit-building systems.', systemPrompt: 'Design habit system. Define cue, routine, reward. Make it obvious, attractive, easy, satisfying. Plan for obstacles. Create tracking mechanism.',
    inputs: [{ name: 'desiredHabit', type: 'string', required: true, description: 'Habit to build' }, { name: 'currentRoutine', type: 'string', required: false, description: 'Existing routine to anchor to' }],
    outputs: [{ name: 'habitPlan', type: 'object', description: 'Habit design', nullable: false }, { name: 'implementation', type: 'string', description: 'Implementation intention', nullable: false }, { name: 'trackingMethod', type: 'string', description: 'How to track', nullable: false }],
  }),

];

export default SKILLS_PART2;
