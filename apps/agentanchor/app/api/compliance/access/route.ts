/**
 * Compliance Access Control API
 * POST /api/compliance/access/check - Check access permission
 * POST /api/compliance/access/grant - Grant access
 * POST /api/compliance/access/revoke - Revoke access
 */

import { NextRequest, NextResponse } from 'next/server';
import { complianceAccessControl } from '@/lib/compliance';
import type { ResourceType } from '@/lib/compliance/access-control';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'check': {
        // Validate required fields
        if (!params.userId || !params.resourceType || !params.resourceId || !params.accessAction) {
          return NextResponse.json(
            { success: false, error: 'Missing required fields: userId, resourceType, resourceId, accessAction' },
            { status: 400 }
          );
        }

        const decision = await complianceAccessControl.checkAccess({
          userId: params.userId,
          agentId: params.agentId,
          resourceType: params.resourceType as ResourceType,
          resourceId: params.resourceId,
          action: params.accessAction,
          purpose: params.purpose,
          ipAddress: params.ipAddress,
        });

        return NextResponse.json({
          success: true,
          data: decision,
        });
      }

      case 'grant': {
        // Validate required fields
        if (!params.userId || !params.resourceType || !params.resourceId || !params.level || !params.grantedBy) {
          return NextResponse.json(
            { success: false, error: 'Missing required fields: userId, resourceType, resourceId, level, grantedBy' },
            { status: 400 }
          );
        }

        await complianceAccessControl.grantAccess({
          userId: params.userId,
          resourceType: params.resourceType as ResourceType,
          resourceId: params.resourceId,
          level: params.level,
          grantedBy: params.grantedBy,
          expiresAt: params.expiresAt ? new Date(params.expiresAt) : undefined,
          reason: params.reason,
        });

        return NextResponse.json({
          success: true,
          message: 'Access granted successfully',
        });
      }

      case 'revoke': {
        // Validate required fields
        if (!params.userId || !params.resourceType || !params.resourceId || !params.revokedBy || !params.reason) {
          return NextResponse.json(
            { success: false, error: 'Missing required fields: userId, resourceType, resourceId, revokedBy, reason' },
            { status: 400 }
          );
        }

        await complianceAccessControl.revokeAccess({
          userId: params.userId,
          resourceType: params.resourceType as ResourceType,
          resourceId: params.resourceId,
          revokedBy: params.revokedBy,
          reason: params.reason,
        });

        return NextResponse.json({
          success: true,
          message: 'Access revoked successfully',
        });
      }

      case 'review': {
        // Validate required fields
        if (!params.reviewerId || !params.scope) {
          return NextResponse.json(
            { success: false, error: 'Missing required fields: reviewerId, scope' },
            { status: 400 }
          );
        }

        const result = await complianceAccessControl.performAccessReview({
          reviewerId: params.reviewerId,
          scope: params.scope,
          startDate: new Date(params.startDate || Date.now() - 90 * 24 * 60 * 60 * 1000),
          endDate: new Date(params.endDate || Date.now()),
        });

        return NextResponse.json({
          success: true,
          data: result,
        });
      }

      case 'get_context': {
        if (!params.agentId) {
          return NextResponse.json(
            { success: false, error: 'Missing required field: agentId' },
            { status: 400 }
          );
        }

        const context = await complianceAccessControl.getAgentComplianceContext(params.agentId);

        return NextResponse.json({
          success: true,
          data: context,
        });
      }

      case 'enable_healthcare': {
        if (!params.agentId || !params.enabledBy || !params.purposes) {
          return NextResponse.json(
            { success: false, error: 'Missing required fields: agentId, enabledBy, purposes' },
            { status: 400 }
          );
        }

        const context = await complianceAccessControl.enableHealthcareAccess(params.agentId, {
          enabledBy: params.enabledBy,
          purposes: params.purposes,
          trainingCompleted: params.trainingCompleted || false,
          baaInPlace: params.baaInPlace || false,
        });

        return NextResponse.json({
          success: true,
          data: context,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Valid actions: check, grant, revoke, review, get_context, enable_healthcare' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Access API] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process access request';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
