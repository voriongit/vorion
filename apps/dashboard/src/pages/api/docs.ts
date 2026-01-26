import type { NextApiRequest, NextApiResponse } from 'next'
import * as fs from 'fs';
import * as path from 'path';

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  const rootDir = path.resolve(process.cwd(), '../../');
  const indexPath = path.join(rootDir, 'knowledge-index.json');

  try {
      if (fs.existsSync(indexPath)) {
          const content = fs.readFileSync(indexPath, 'utf-8');
          res.status(200).json(JSON.parse(content));
      } else {
          res.status(200).json([]);
      }
  } catch (e) {
      res.status(500).json({ error: 'Failed to read index' });
  }
}
