import type { NextApiRequest, NextApiResponse } from 'next'
import * as fs from 'fs';
import * as path from 'path';

const SCHEDULES_FILE = path.resolve(process.env.INIT_CWD || process.cwd(), '../../.vorion/schedules.json');
const OBJECTIVE_FILE = path.resolve(process.env.INIT_CWD || process.cwd(), '../../docs/daily-mission.md');

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  if (_req.method === 'GET') {
      let schedules = [];
      let objective = '';

      try {
          if (fs.existsSync(SCHEDULES_FILE)) schedules = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf-8'));
          if (fs.existsSync(OBJECTIVE_FILE)) objective = fs.readFileSync(OBJECTIVE_FILE, 'utf-8');
      } catch (e) {}

      res.status(200).json({ schedules, objective });
  } else if (_req.method === 'POST') {
      const { schedules, objective } = _req.body;
      
      // Save Schedules
      if (schedules) {
          fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2));
      }

      // Save Objective (Create docs dir if missing)
      if (objective !== undefined) {
          const docDir = path.dirname(OBJECTIVE_FILE);
          if (!fs.existsSync(docDir)) fs.mkdirSync(docDir, { recursive: true });
          fs.writeFileSync(OBJECTIVE_FILE, objective);
          
          // Optional: Trigger Librarian to re-index immediately?
          // For now, let the schedule handle it.
      }

      res.status(200).json({ success: true });
  }
}
