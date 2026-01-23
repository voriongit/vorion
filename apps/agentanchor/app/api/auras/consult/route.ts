/**
 * Auras Consultation API
 * POST /api/auras/consult - Consult auras on a query
 * POST /api/auras/consult?council={id} - Use a specific council
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuraService, getCouncil, getAllCouncils } from '@/lib/auras';
import logger from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { query, auras, maxAuras, context, synthesize } = body;

        if (!query) {
            return NextResponse.json(
                { error: 'query is required' },
                { status: 400 }
            );
        }

        // Check for council mode
        const councilId = request.nextUrl.searchParams.get('council');

        const service = getAuraService();

        if (councilId) {
            // Council deliberation
            const council = getCouncil(councilId);
            if (!council) {
                return NextResponse.json(
                    { error: `Council not found: ${councilId}`, availableCouncils: getAllCouncils().map(c => c.id) },
                    { status: 404 }
                );
            }

            const deliberation = await service.deliberate(councilId, query, context);

            return NextResponse.json({
                success: true,
                mode: 'council',
                ...deliberation,
            });
        }

        // Regular consultation
        const result = await service.consult({
            query,
            auras,
            maxAuras: maxAuras || 3,
            context,
            synthesize: synthesize !== false,
        });

        return NextResponse.json({
            success: true,
            mode: 'consultation',
            ...result,
        });
    } catch (error) {
        logger.error('auras_consult_error', { error });

        const message = error instanceof Error ? error.message : 'Failed to consult auras';

        // Check for missing API keys
        if (message.includes('provider must be configured')) {
            return NextResponse.json(
                {
                    error: 'No AI providers configured',
                    hint: 'Set ANTHROPIC_API_KEY, GEMINI_API_KEY, or GROK_API_KEY environment variables',
                },
                { status: 503 }
            );
        }

        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}

export async function GET() {
    // Return available auras and councils
    const { AURA_REGISTRY, STANDARD_COUNCILS, getAllAuras, getAllCouncils } = await import('@/lib/auras');

    return NextResponse.json({
        auras: getAllAuras().map(a => ({
            id: a.id,
            name: a.name,
            icon: a.icon,
            tagline: a.tagline,
            expertise: a.expertise,
        })),
        councils: getAllCouncils().map(c => ({
            id: c.id,
            name: c.name,
            description: c.description,
            auras: c.auraIds,
            useCases: c.useCases,
        })),
    });
}
