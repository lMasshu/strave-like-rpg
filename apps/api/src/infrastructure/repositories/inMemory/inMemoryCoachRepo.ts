import { randomUUID } from 'node:crypto';
import type {
  CoachMessage,
  CoachWeeklyReport,
  NewCoachMessage,
  NewCoachWeeklyReport,
} from '../../../core/entities/coach.js';
import type { ICoachRepository } from '../../../core/ports/coachRepository.js';

interface StoredMessage extends CoachMessage {
  seq: number;
}

export class InMemoryCoachRepository implements ICoachRepository {
  private readonly reports = new Map<string, CoachWeeklyReport>();
  private readonly messages: StoredMessage[] = [];
  private seqCounter = 0;

  private reportKey(playerId: string, year: number, weekNumber: number): string {
    return `${playerId}:${year}:${weekNumber}`;
  }

  async getWeeklyReport(
    playerId: string,
    year: number,
    weekNumber: number,
  ): Promise<CoachWeeklyReport | null> {
    const report = this.reports.get(this.reportKey(playerId, year, weekNumber));
    return report ? { ...report, summary: { ...report.summary } } : null;
  }

  async saveWeeklyReport(report: NewCoachWeeklyReport): Promise<CoachWeeklyReport> {
    const key = this.reportKey(report.playerId, report.year, report.weekNumber);
    const existing = this.reports.get(key);
    const saved: CoachWeeklyReport = {
      ...report,
      id: existing ? existing.id : randomUUID(),
      summary: { ...report.summary },
      createdAt: new Date(),
    };
    this.reports.set(key, saved);
    return { ...saved, summary: { ...saved.summary } };
  }

  async getRecentMessages(playerId: string, limit = 30): Promise<CoachMessage[]> {
    return this.messages
      .filter((m) => m.playerId === playerId)
      .sort((a, b) => {
        const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
        return timeDiff !== 0 ? timeDiff : b.seq - a.seq;
      })
      .slice(0, limit)
      .map(({ seq: _seq, ...m }) => ({ ...m }));
  }

  async saveMessage(message: NewCoachMessage): Promise<CoachMessage> {
    this.seqCounter += 1;
    const saved: StoredMessage = {
      ...message,
      id: randomUUID(),
      seq: this.seqCounter,
      createdAt: new Date(),
    };
    this.messages.push(saved);
    const { seq: _seq, ...result } = saved;
    return { ...result };
  }

  async purgeOldMessages(playerId: string, keepCount = 30): Promise<void> {
    const playerIndices: number[] = [];
    for (let i = 0; i < this.messages.length; i++) {
      if (this.messages[i]!.playerId === playerId) {
        playerIndices.push(i);
      }
    }
    // Plus récents en premier
    playerIndices.sort(
      (a, b) =>
        this.messages[b]!.createdAt.getTime() - this.messages[a]!.createdAt.getTime(),
    );

    if (playerIndices.length > keepCount) {
      const toDelete = new Set(playerIndices.slice(keepCount));
      const kept = this.messages.filter((_, idx) => !toDelete.has(idx));
      this.messages.length = 0;
      this.messages.push(...kept);
    }
  }
}
