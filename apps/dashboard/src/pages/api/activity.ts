import type { NextApiRequest, NextApiResponse } from 'next'
import * as fs from 'fs';
import * as path from 'path';

const MEMORY_FILE = path.resolve(process.env.INIT_CWD || process.cwd(), '../../.vorion/memory.json');

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  let activity: any[] = [];
  try {
      if (fs.existsSync(MEMORY_FILE)) {
          const content = fs.readFileSync(MEMORY_FILE, 'utf-8');
          activity = JSON.parse(content);
          // Sort desc
          activity.sort((a, b) => b.timestamp - a.timestamp);
      }
  } catch (e) {}

  res.status(200).json(activity.slice(0, 20)); // Return recent 20
}
