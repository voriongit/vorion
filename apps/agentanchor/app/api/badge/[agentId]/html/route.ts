/**
 * Badge HTML Embed - Returns embeddable HTML snippet
 * GET /api/badge/:agentId/html
 *
 * Returns HTML that can be copy-pasted into websites
 */

import { NextRequest, NextResponse } from 'next/server'
import { urls } from '@/lib/config'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  const { searchParams } = new URL(request.url)
  const variant = searchParams.get('variant') || 'compact'
  const theme = searchParams.get('theme') || 'light'

  const baseUrl = urls.app
  const badgeUrl = `${baseUrl}/api/badge/${agentId}?variant=${variant}&theme=${theme}`
  const verifyUrl = `${baseUrl}/verify/agent/${agentId}`

  const html = `<!-- BAI AgentAnchor Trust Badge -->
<a href="${verifyUrl}" target="_blank" rel="noopener noreferrer" title="Verify on AgentAnchor">
  <img src="${badgeUrl}" alt="BAI Trust Badge" style="border: none;" />
</a>
<!-- End BAI Badge -->`

  const markdown = `[![BAI Trust Badge](${badgeUrl})](${verifyUrl})`

  const response = {
    html,
    markdown,
    imageUrl: badgeUrl,
    verifyUrl,
    variants: ['inline', 'compact', 'full'],
    themes: ['light', 'dark'],
  }

  return NextResponse.json(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  })
}
