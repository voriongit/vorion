import type { NextApiRequest, NextApiResponse } from 'next'
import * as fs from 'fs';
import * as path from 'path';

// Duplicate logic from Council package for quick proto
// Ideal: import { ProposalManager } from '@vorion/council';
// But importing workspace packages in Next.js requires transpile configuration. 
// For speed, I'll direct-read the JSON.

const PROPOSALS_FILE = path.resolve(process.env.INIT_CWD || process.cwd(), '../../.vorion/proposals.json');

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  let proposals: any[] = [];
  try {
      if (fs.existsSync(PROPOSALS_FILE)) {
          const content = fs.readFileSync(PROPOSALS_FILE, 'utf-8');
          proposals = JSON.parse(content);
      }
  } catch (e) {}

  if (req.method === 'GET') {
      // List pending
      res.status(200).json(proposals.filter((p: any) => p.status === 'PENDING'));
  } else if (req.method === 'POST') {
      const { id, decision, justification } = req.body;
      const index = proposals.findIndex((p: any) => p.id === id);
      if (index > -1) {
          proposals[index].status = decision === 'approve' ? 'APPROVED' : 'REJECTED';
          proposals[index].justification = justification || '';
          proposals[index].decidedAt = new Date().toISOString();
          proposals[index].decidedBy = 'admin'; // Could be from session in real impl
          fs.writeFileSync(PROPOSALS_FILE, JSON.stringify(proposals, null, 2));
      }
      res.status(200).json({ success: true });
  }
}
