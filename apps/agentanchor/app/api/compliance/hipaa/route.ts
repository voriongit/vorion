/**
 * HIPAA Compliance API
 * POST /api/compliance/hipaa - HIPAA-specific operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { hipaaService } from '@/lib/compliance';

export async function GET(request: NextRequest) {
  try {
    // Return HIPAA control requirements
    const controls = hipaaService.getHIPAAControls();

    return NextResponse.json({
      success: true,
      data: {
        controls,
        count: controls.length,
        categories: {
          administrative: controls.filter(c => c.safeguard === 'administrative').length,
          technical: controls.filter(c => c.safeguard === 'technical').length,
          physical: controls.filter(c => c.safeguard === 'physical').length,
        },
      },
    });
  } catch (error) {
    console.error('[HIPAA API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch HIPAA controls' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'validate_phi_access': {
        if (!params.userId || !params.agentId || !params.phiType || !params.purpose || !params.requestedFields) {
          return NextResponse.json(
            { success: false, error: 'Missing required fields: userId, agentId, phiType, purpose, requestedFields' },
            { status: 400 }
          );
        }

        const result = await hipaaService.validatePHIAccess({
          userId: params.userId,
          agentId: params.agentId,
          phiType: params.phiType,
          purpose: params.purpose,
          requestedFields: params.requestedFields,
        });

        return NextResponse.json({
          success: true,
          data: result,
        });
      }

      case 'deidentify': {
        if (!params.data) {
          return NextResponse.json(
            { success: false, error: 'Missing required field: data' },
            { status: 400 }
          );
        }

        const deidentified = hipaaService.deidentifyPHI(params.data);
        const verification = hipaaService.isDeidentified(deidentified);

        return NextResponse.json({
          success: true,
          data: {
            deidentified,
            verification,
          },
        });
      }

      case 'check_deidentified': {
        if (!params.data) {
          return NextResponse.json(
            { success: false, error: 'Missing required field: data' },
            { status: 400 }
          );
        }

        const result = hipaaService.isDeidentified(params.data);

        return NextResponse.json({
          success: true,
          data: result,
        });
      }

      case 'report_breach': {
        if (!params.reportedBy || !params.description || !params.discoveredAt) {
          return NextResponse.json(
            { success: false, error: 'Missing required fields: reportedBy, description, discoveredAt' },
            { status: 400 }
          );
        }

        const breach = await hipaaService.reportPotentialBreach({
          reportedBy: params.reportedBy,
          description: params.description,
          discoveredAt: new Date(params.discoveredAt),
          affectedRecords: params.affectedRecords,
          phiTypes: params.phiTypes,
          systemsInvolved: params.systemsInvolved,
        });

        return NextResponse.json({
          success: true,
          data: breach,
        });
      }

      case 'assess_breach': {
        if (!params.breachId || !params.assessedBy || !params.natureAndExtent || !params.unauthorizedPerson) {
          return NextResponse.json(
            { success: false, error: 'Missing required fields: breachId, assessedBy, natureAndExtent, unauthorizedPerson' },
            { status: 400 }
          );
        }

        const assessment = await hipaaService.assessBreachRisk(params.breachId, {
          assessedBy: params.assessedBy,
          natureAndExtent: params.natureAndExtent,
          unauthorizedPerson: params.unauthorizedPerson,
          wasAcquiredOrViewed: params.wasAcquiredOrViewed || false,
          riskMitigated: params.riskMitigated || false,
          mitigationDetails: params.mitigationDetails,
        });

        return NextResponse.json({
          success: true,
          data: assessment,
        });
      }

      case 'create_notification': {
        if (!params.breachId || !params.notificationType || !params.recipientCount || !params.notifyBy) {
          return NextResponse.json(
            { success: false, error: 'Missing required fields: breachId, notificationType, recipientCount, notifyBy' },
            { status: 400 }
          );
        }

        const notification = await hipaaService.createBreachNotification({
          breachId: params.breachId,
          notificationType: params.notificationType,
          recipientCount: params.recipientCount,
          notifyBy: params.notifyBy,
        });

        return NextResponse.json({
          success: true,
          data: notification,
        });
      }

      case 'validate_baa': {
        if (!params.baa) {
          return NextResponse.json(
            { success: false, error: 'Missing required field: baa' },
            { status: 400 }
          );
        }

        const validation = hipaaService.validateBAA(params.baa);

        return NextResponse.json({
          success: true,
          data: validation,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Valid actions: validate_phi_access, deidentify, check_deidentified, report_breach, assess_breach, create_notification, validate_baa' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[HIPAA API] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process HIPAA request';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
