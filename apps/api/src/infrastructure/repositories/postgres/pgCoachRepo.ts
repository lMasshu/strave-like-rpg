import type { Pool } from 'pg';
import type {
  CoachMessage,
  CoachWeeklyReport,
  CoachWeeklySummary,
  NewCoachMessage,
  NewCoachWeeklyReport,
} from '../../../core/entities/coach.js';
import type { ICoachRepository } from '../../../core/ports/coachRepository.js';
import { isUuid } from './pgErrors.js';

interface WeeklyReportRow {
  id: string;
  player_id: string;
  year: number;
  week_number: number;
  summary: CoachWeeklySummary;
  report_text: string;
  created_at: Date;
}

interface CoachMessageRow {
  id: string;
  player_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: Date;
}

function toWeeklyReport(row: WeeklyReportRow): CoachWeeklyReport {
  return {
    id: row.id,
    playerId: row.player_id,
    year: row.year,
    weekNumber: row.week_number,
    summary: row.summary,
    reportText: row.report_text,
    createdAt: row.created_at,
  };
}

function toCoachMessage(row: CoachMessageRow): CoachMessage {
  return {
    id: row.id,
    playerId: row.player_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

export class PgCoachRepository implements ICoachRepository {
  constructor(private readonly pool: Pool) {}

  async getWeeklyReport(
    playerId: string,
    year: number,
    weekNumber: number,
  ): Promise<CoachWeeklyReport | null> {
    if (!isUuid(playerId)) return null;

    const { rows } = await this.pool.query<WeeklyReportRow>(
      `SELECT id, player_id, year, week_number, summary, report_text, created_at
         FROM coach_weekly_reports
        WHERE player_id = $1 AND year = $2 AND week_number = $3`,
      [playerId, year, weekNumber],
    );

    return rows[0] ? toWeeklyReport(rows[0]) : null;
  }

  async saveWeeklyReport(report: NewCoachWeeklyReport): Promise<CoachWeeklyReport> {
    const { rows } = await this.pool.query<WeeklyReportRow>(
      `INSERT INTO coach_weekly_reports (player_id, year, week_number, summary, report_text)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (player_id, year, week_number)
       DO UPDATE SET
         summary = EXCLUDED.summary,
         report_text = EXCLUDED.report_text,
         created_at = now()
       RETURNING id, player_id, year, week_number, summary, report_text, created_at`,
      [
        report.playerId,
        report.year,
        report.weekNumber,
        JSON.stringify(report.summary),
        report.reportText,
      ],
    );

    return toWeeklyReport(rows[0]!);
  }

  async getRecentMessages(playerId: string, limit = 30): Promise<CoachMessage[]> {
    if (!isUuid(playerId)) return [];

    const safeLimit = Math.max(1, Math.min(100, limit));
    const { rows } = await this.pool.query<CoachMessageRow>(
      `SELECT id, player_id, role, content, created_at
         FROM coach_messages
        WHERE player_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [playerId, safeLimit],
    );

    return rows.map(toCoachMessage);
  }

  async saveMessage(message: NewCoachMessage): Promise<CoachMessage> {
    const { rows } = await this.pool.query<CoachMessageRow>(
      `INSERT INTO coach_messages (player_id, role, content)
       VALUES ($1, $2, $3)
       RETURNING id, player_id, role, content, created_at`,
      [message.playerId, message.role, message.content],
    );

    return toCoachMessage(rows[0]!);
  }

  async purgeOldMessages(playerId: string, keepCount = 30): Promise<void> {
    if (!isUuid(playerId)) return;

    const safeKeep = Math.max(1, keepCount);
    await this.pool.query(
      `DELETE FROM coach_messages
        WHERE player_id = $1
          AND id NOT IN (
            SELECT id FROM coach_messages
             WHERE player_id = $1
             ORDER BY created_at DESC
             LIMIT $2
          )`,
      [playerId, safeKeep],
    );
  }
}
