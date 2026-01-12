/**
 * ISO 27001 Compliance API
 * POST /api/compliance/iso27001 - ISO 27001-specific operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { iso27001Service } from '@/lib/compliance';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'controls';

    switch (type) {
      case 'controls': {
        const controls = iso27001Service.getISO27001Controls();
        return NextResponse.json({
          success: true,
          data: {
            controls,
            count: controls.length,
            categories: {
              organizational: controls.filter(c => c.annexA === 'organizational').length,
              people: controls.filter(c => c.annexA === 'people').length,
              physical: controls.filter(c => c.annexA === 'physical').length,
              technological: controls.filter(c => c.annexA === 'technological').length,
            },
          },
        });
      }

      case 'soa': {
        const soa = iso27001Service.getStatementOfApplicability();
        return NextResponse.json({
          success: true,
          data: {
            soa,
            count: soa.length,
            included: soa.filter(s => s.included).length,
            excluded: soa.filter(s => !s.included).length,
          },
        });
      }

      case 'risks': {
        const risks = iso27001Service.getRiskRegister();
        return NextResponse.json({
          success: true,
          data: {
            risks,
            count: risks.length,
            byCategory: {
              security: risks.filter(r => r.category === 'security').length,
              operational: risks.filter(r => r.category === 'operational').length,
              compliance: risks.filter(r => r.category === 'compliance').length,
              reputational: risks.filter(r => r.category === 'reputational').length,
              financial: risks.filter(r => r.category === 'financial').length,
            },
            byTreatment: {
              mitigate: risks.filter(r => r.treatment === 'mitigate').length,
              accept: risks.filter(r => r.treatment === 'accept').length,
              transfer: risks.filter(r => r.treatment === 'transfer').length,
              avoid: risks.filter(r => r.treatment === 'avoid').length,
            },
          },
        });
      }

      case 'management_review': {
        const input = iso27001Service.generateManagementReviewInput();
        return NextResponse.json({
          success: true,
          data: input,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid type. Valid types: controls, soa, risks, management_review' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[ISO27001 API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ISO 27001 data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'risk_assessment': {
        if (!params.assessorId || !params.scope || !params.assets || !params.threats || !params.vulnerabilities) {
          return NextResponse.json(
            { success: false, error: 'Missing required fields: assessorId, scope, assets, threats, vulnerabilities' },
            { status: 400 }
          );
        }

        const results = await iso27001Service.performRiskAssessment({
          assessorId: params.assessorId,
          scope: params.scope,
          assets: params.assets,
          threats: params.threats,
          vulnerabilities: params.vulnerabilities,
        });

        return NextResponse.json({
          success: true,
          data: {
            results,
            summary: {
              total: results.length,
              highRisk: results.filter(r => r.residualRisk.score >= 15).length,
              mediumRisk: results.filter(r => r.residualRisk.score >= 8 && r.residualRisk.score < 15).length,
              lowRisk: results.filter(r => r.residualRisk.score < 8).length,
            },
          },
        });
      }

      case 'update_risk_treatment': {
        if (!params.riskId || !params.treatment || !params.controls || !params.justification || !params.updatedBy) {
          return NextResponse.json(
            { success: false, error: 'Missing required fields: riskId, treatment, controls, justification, updatedBy' },
            { status: 400 }
          );
        }

        await iso27001Service.updateRiskTreatment(params.riskId, {
          treatment: params.treatment,
          controls: params.controls,
          justification: params.justification,
          updatedBy: params.updatedBy,
        });

        return NextResponse.json({
          success: true,
          message: 'Risk treatment updated successfully',
        });
      }

      case 'update_soa': {
        if (!params.controlId || params.included === undefined || !params.justification || !params.implementationStatus || !params.updatedBy) {
          return NextResponse.json(
            { success: false, error: 'Missing required fields: controlId, included, justification, implementationStatus, updatedBy' },
            { status: 400 }
          );
        }

        await iso27001Service.updateControlApplicability(params.controlId, {
          included: params.included,
          justification: params.justification,
          implementationStatus: params.implementationStatus,
          updatedBy: params.updatedBy,
        });

        return NextResponse.json({
          success: true,
          message: 'Statement of Applicability updated successfully',
        });
      }

      case 'plan_audit': {
        if (!params.auditId || !params.scope || !params.auditor || !params.scheduledDate || !params.criteria) {
          return NextResponse.json(
            { success: false, error: 'Missing required fields: auditId, scope, auditor, scheduledDate, criteria' },
            { status: 400 }
          );
        }

        const auditPlan = await iso27001Service.planInternalAudit({
          auditId: params.auditId,
          scope: params.scope,
          auditor: params.auditor,
          scheduledDate: new Date(params.scheduledDate),
          criteria: params.criteria,
        });

        return NextResponse.json({
          success: true,
          data: auditPlan,
        });
      }

      case 'record_finding': {
        if (!params.auditId || !params.controlId || !params.findingType || !params.severity || !params.description || !params.evidence || !params.auditor) {
          return NextResponse.json(
            { success: false, error: 'Missing required fields: auditId, controlId, findingType, severity, description, evidence, auditor' },
            { status: 400 }
          );
        }

        const findingId = await iso27001Service.recordAuditFinding({
          auditId: params.auditId,
          controlId: params.controlId,
          findingType: params.findingType,
          severity: params.severity,
          description: params.description,
          evidence: params.evidence,
          auditor: params.auditor,
        });

        return NextResponse.json({
          success: true,
          data: { findingId },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Valid actions: risk_assessment, update_risk_treatment, update_soa, plan_audit, record_finding' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[ISO27001 API] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process ISO 27001 request';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
