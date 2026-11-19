import type {
  CoachMessage,
  CoachWeeklyReport,
  CoachWeeklySummary,
} from '../entities/coach.js';
import type { CoachGoal, Player } from '../entities/player.js';
import type { IActivityRepository } from '../ports/activityRepository.js';
import type { ICoachRepository } from '../ports/coachRepository.js';
import type { IPlayerRepository } from '../ports/playerRepository.js';
import {
  type IOllamaClient,
  type OllamaChatMessage,
  OllamaUnavailableError,
} from './ollamaClient.js';

export function getIsoWeekAndYear(date: Date = new Date()): {
  year: number;
  weekNumber: number;
} {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const year = new Date(firstThursday).getUTCFullYear();
  return { year, weekNumber };
}

export function getWeekBounds(
  year: number,
  weekNumber: number,
): { from: Date; to: Date } {
  // 4 janvier est toujours dans la semaine 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - dayOfWeek);
  week1Monday.setUTCHours(0, 0, 0, 0);

  const targetMonday = new Date(week1Monday);
  targetMonday.setUTCDate(week1Monday.getUTCDate() + (weekNumber - 1) * 7);

  const targetSunday = new Date(targetMonday);
  targetSunday.setUTCDate(targetMonday.getUTCDate() + 7);

  return { from: targetMonday, to: targetSunday };
}

const GOAL_LABELS: Record<CoachGoal, string> = {
  casual: 'Détente et exploration libre (marche, sorties plaisir sans chrono)',
  active: 'Aventurier actif (remise en forme, 2 à 3 sorties régulières par semaine)',
  '5k': 'Objectif 5 km en continu (régularité, aisance respiratoire)',
  '10k': 'Objectif 10 km (endurance fondamentale, allures variées)',
  'half-marathon': 'Objectif Semi-marathon 21,1 km (volume progressif, sorties longues)',
  marathon: 'Objectif Marathon 42,195 km (planification sur plusieurs mois, endurance de base, gestion de l’effort)',
};

export class CoachService {
  constructor(
    private readonly coachRepo: ICoachRepository,
    private readonly playerRepo: IPlayerRepository,
    private readonly activityRepo: IActivityRepository,
    private readonly llmClient: IOllamaClient,
  ) {}

  async getSettings(playerId: string): Promise<{ coachEnabled: boolean; coachGoal: CoachGoal }> {
    const player = await this.requirePlayer(playerId);
    return {
      coachEnabled: player.coachEnabled,
      coachGoal: player.coachGoal,
    };
  }

  async updateSettings(
    playerId: string,
    settings: { coachEnabled?: boolean; coachGoal?: CoachGoal },
  ): Promise<{ coachEnabled: boolean; coachGoal: CoachGoal }> {
    const updated = await this.playerRepo.updateCoachSettings(playerId, settings);
    return {
      coachEnabled: updated.coachEnabled,
      coachGoal: updated.coachGoal,
    };
  }

  /**
   * Bilan hebdomadaire (évaluation paresseuse / lazy evaluation) :
   * - Si un rapport existe déjà en base pour la semaine courante, on le renvoie instantanément.
   * - Sinon, on agrège les activités réelles de la semaine, on sollicite l'IA et on met en cache en base.
   */
  async getWeeklyReport(
    playerId: string,
    referenceDate: Date = new Date(),
  ): Promise<{ report: CoachWeeklyReport | null; enabled: boolean }> {
    const player = await this.requirePlayer(playerId);
    if (!player.coachEnabled) {
      return { report: null, enabled: false };
    }

    const { year, weekNumber } = getIsoWeekAndYear(referenceDate);
    const existing = await this.coachRepo.getWeeklyReport(playerId, year, weekNumber);
    if (existing) {
      return { report: existing, enabled: true };
    }

    // Récupérer les activités de la semaine
    const { from, to } = getWeekBounds(year, weekNumber);
    const summaries = await this.activityRepo.findSummariesBetween(
      playerId,
      from,
      to,
      100,
    );

    const summary: CoachWeeklySummary = {
      totalDistanceMeters: summaries.reduce((acc, a) => acc + a.distanceMeters, 0),
      totalDurationSeconds: summaries.reduce((acc, a) => acc + a.durationSeconds, 0),
      activityCount: summaries.length,
      elevationGainMeters: summaries.reduce((acc, a) => acc + (a.elevationGainMeters || 0), 0),
    };

    const promptMessages = this.buildWeeklyReportPrompt(player, year, weekNumber, summary);
    let reportText: string;
    try {
      reportText = await this.llmClient.chat(promptMessages);
    } catch (err: unknown) {
      if (err instanceof OllamaUnavailableError) {
        reportText = this.generateFallbackReport(player, year, weekNumber, summary);
      } else {
        throw err;
      }
    }

    const saved = await this.coachRepo.saveWeeklyReport({
      playerId,
      year,
      weekNumber,
      summary,
      reportText,
    });

    return { report: saved, enabled: true };
  }

  async getRecentMessages(playerId: string, limit = 30): Promise<CoachMessage[]> {
    await this.requirePlayer(playerId);
    return this.coachRepo.getRecentMessages(playerId, limit);
  }

  async handleChatMessage(playerId: string, userText: string): Promise<CoachMessage> {
    const player = await this.requirePlayer(playerId);
    const trimmed = userText.trim();
    if (!trimmed) {
      throw new Error('Le message ne peut pas être vide');
    }

    // 1. Enregistrer le message de l'utilisateur
    await this.coachRepo.saveMessage({
      playerId,
      role: 'user',
      content: trimmed,
    });

    // 2. Assembler les messages pour l'IA
    const llmMessages = await this.prepareLlmChatMessages(player, trimmed);

    // 3. Générer la réponse (avec fallback si Ollama est hors ligne)
    let assistantContent: string;
    try {
      assistantContent = await this.llmClient.chat(llmMessages);
    } catch (err: unknown) {
      if (err instanceof OllamaUnavailableError) {
        assistantContent = this.generateFallbackChatReply(player, trimmed);
      } else {
        throw err;
      }
    }

    // 4. Sauvegarder la réponse du coach
    const assistantMsg = await this.coachRepo.saveMessage({
      playerId,
      role: 'assistant',
      content: assistantContent,
    });

    // 5. Purger les anciens messages au-delà de 30 pour maîtriser le stockage
    await this.coachRepo.purgeOldMessages(playerId, 30);

    return assistantMsg;
  }

  async handleChatMessageStream(
    playerId: string,
    userText: string,
    onChunk: (chunk: string) => void,
  ): Promise<CoachMessage> {
    const player = await this.requirePlayer(playerId);
    const trimmed = userText.trim();
    if (!trimmed) {
      throw new Error('Le message ne peut pas être vide');
    }

    // 1. Enregistrer le message de l'utilisateur
    await this.coachRepo.saveMessage({
      playerId,
      role: 'user',
      content: trimmed,
    });

    // 2. Assembler les messages pour l'IA
    const llmMessages = await this.prepareLlmChatMessages(player, trimmed);

    // 3. Streamer la réponse (avec fallback si Ollama est hors ligne)
    let assistantContent: string;
    try {
      assistantContent = await this.llmClient.chatStream(llmMessages, onChunk);
    } catch (err: unknown) {
      if (err instanceof OllamaUnavailableError) {
        assistantContent = this.generateFallbackChatReply(player, trimmed);
        onChunk(assistantContent);
      } else {
        throw err;
      }
    }

    // 4. Sauvegarder la réponse du coach
    const assistantMsg = await this.coachRepo.saveMessage({
      playerId,
      role: 'assistant',
      content: assistantContent,
    });

    // 5. Purger les anciens messages au-delà de 30 pour maîtriser le stockage
    await this.coachRepo.purgeOldMessages(playerId, 30);

    return assistantMsg;
  }

  private async prepareLlmChatMessages(
    player: Player,
    trimmed: string,
  ): Promise<OllamaChatMessage[]> {
    const recent = await this.coachRepo.getRecentMessages(player.id, 4);
    const history = [...recent].reverse();

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentActivities = await this.activityRepo.findSummariesBetween(
      player.id,
      sevenDaysAgo,
      now,
      20,
    );
    const kmLast7Days = Math.round(
      recentActivities.reduce((acc, a) => acc + a.distanceMeters, 0) / 1000,
    );

    const systemPrompt = this.buildChatSystemPrompt(
      player,
      trimmed,
      kmLast7Days,
      recentActivities.length,
      now,
    );
    const llmMessages: OllamaChatMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    for (const msg of history) {
      const content =
        msg.role === 'assistant' && msg.content.length > 250
          ? `${msg.content.slice(0, 250)}...`
          : msg.content;
      llmMessages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content,
      });
    }

    return llmMessages;
  }

  private async requirePlayer(playerId: string): Promise<Player> {
    const player = await this.playerRepo.findById(playerId);
    if (!player) {
      throw new Error(`Joueur introuvable : ${playerId}`);
    }
    return player;
  }

  private buildWeeklyReportPrompt(
    player: Player,
    year: number,
    weekNumber: number,
    summary: CoachWeeklySummary,
  ): OllamaChatMessage[] {
    const distKm = (summary.totalDistanceMeters / 1000).toFixed(1);
    const durationHours = (summary.totalDurationSeconds / 3600).toFixed(1);
    const goalDesc = GOAL_LABELS[player.coachGoal] || player.coachGoal;

    const systemPrompt = `Tu es le Maître de Guilde de Stride Quest, un mentor bienveillant et chaleureux guidant les marcheurs et coureurs dans leurs quêtes quotidiennes.
Tu t'adresses directement à l'aventurier(ère) avec enthousiasme et respect.
Tu mêles l'ambiance des jeux de rôle médiéval-fantastiques (quêtes, XP, raids de boss, endurance d'explorateur) avec une réelle expertise en entraînement sportif d'endurance (récupération active, allures modérées, hydratation, régularité, prévention des blessures).
Ton style est concis, motivant et structuré en 2 à 3 courts paragraphes (150 à 250 mots au total). N'utilise pas de jargon incompréhensible ni de bavardage superflu. Réponds toujours en français.`;

    const userPrompt = `Voici les données de la semaine ${weekNumber} de l'année ${year} pour l'aventurier ${player.username} :
- Niveau actuel : Niveau ${player.level} (${player.experience} XP au total)
- Style d'aventure / Objectif déclaré : ${goalDesc}
- Nombre de sorties cette semaine : ${summary.activityCount}
- Distance totale parcourue : ${distKm} km
- Durée cumulée d'effort : ${durationHours} heures
- Dénivelé positif franchi : ${summary.elevationGainMeters} m

Rédige le bilan hebdomadaire personnalisé pour ${player.username} :
1. Salue chaleureusement l'aventurier et commente ses efforts réels de la semaine (ou encourage-le gentiment s'il n'a pas pu sortir).
2. Fais le lien avec son objectif (${goalDesc}) et valorise l'expérience accumulée.
3. Donne un conseil concret et réaliste pour la semaine qui arrive (ex: hydratation, séance d'aisance respiratoire, étirements ou repos salvateur).`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
  }

  buildChatSystemPrompt(
    player: Player,
    userText: string,
    kmLast7Days: number,
    workoutsLast7Days: number,
    referenceDate: Date = new Date(),
  ): string {
    const textLower = userText.toLowerCase().trim();
    const isMath = /^[\d\s+\-*/xX^=().,]+$/.test(textLower);

    // 0. Calcul arithmétique pur (ex: "4*4", "2+2") -> réponse isolée sans historique sportif
    if (isMath) {
      return `Tu es le Maître de Guilde de Stride Quest.
L'aventurier te demande un calcul arithmétique.
Donne uniquement l'opération et son résultat numérique en une phrase courte (ex: "4 × 4 = 16."). Ignore totalement les conversations ou objectifs sportifs précédents.`;
    }

    const isTrainingPlan =
      /(programme|plan|préparer|preparer|preparation|préparation|planif|calendrier)/i.test(
        textLower,
      );
    const isSportsRelated =
      /(course|courir|marathon|semi|10\s*km|5\s*km|footing|entrainement|entraînement|séance|seance|allure|cardio|vma|blessure|douleur|mollet|genou|tibia|tendon|chaussure|récupération|recuperation|fractionné|fractionne|jogging|km|sport|raid|dénivelé|denivele)/i.test(
        textLower,
      );

    const goalDesc = GOAL_LABELS[player.coachGoal] || player.coachGoal;
    const dateFormatted = referenceDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // 1. Demande explicite de plan / programme d'entraînement
    if (isTrainingPlan) {
      return `Tu es le Maître de Guilde de Stride Quest, coach sportif d'endurance bienveillant.
Athlète : ${player.username} (Niveau ${player.level}, objectif déclaré : ${goalDesc}, 7 derniers jours : ${workoutsLast7Days} sortie(s), ${kmLast7Days} km au total).
Date actuelle : ${dateFormatted}.

Consignes impératives pour ce programme :
1. Tutoie SYSTÉMATIQUEMENT l'athlète ("tu", "ton", "tes"). N'utilise JAMAIS le vouvoiement ("vous", "votre").
2. L'échéance de course demandée est la date limite absolue : la durée totale du plan doit correspondre au délai réel entre aujourd'hui et la course (ex: de fin novembre à début janvier = 6 semaines, pas 12 semaines).
3. Vocabulaire athlétique rigoureux :
   - Écris les allures au format "min/km" (ex: 4:30/km). N'écris JAMAIS de "h" pour une allure (bannir absolument "4h30/km") et ne fais pas de confusion hasardeuse avec les km/h.
   - Utilise les termes "Échauffement (10 min)" et "Retour au calme (5 min)". Ne dis JAMAIS "allongement".
4. Propose une semaine-type réaliste de 3 séances distinctes :
   - Mardi : Footing en endurance fondamentale (40-45 min, aisance respiratoire totale).
   - Jeudi : Séances d'allure cible (ex: 5 à 6 répétitions de 1 000 m à l'allure visée avec 1 min 30 de récupération trottinée).
   - Dimanche : Sortie longue progressive (sans jamais dépasser la distance de la course préparée).
5. Termine par 1 courte phrase motivante dans le ton d'aventure RPG. Ne recopie jamais les consignes ou parenthèses de ce prompt.`;
    }

    // 2. Question ou conseil running / santé / équipement / récupération
    if (isSportsRelated) {
      return `Tu es le Maître de Guilde de Stride Quest, coach sportif protecteur et bienveillant de l'aventurier(ère) ${player.username} (Niveau ${player.level}, objectif : ${goalDesc}).
Date actuelle : ${dateFormatted}.

Consignes :
1. Tutoie SYSTÉMATIQUEMENT l'athlète ("tu", "ton", "tes"). N'utilise JAMAIS le vouvoiement.
2. Réponds directement et précisément au sujet abordé (douleur, récupération, séance, équipement ou allure).
3. Donne 2 ou 3 conseils pratiques, bienveillants et immédiatement applicables.
4. Ne propose AUCUN programme ni plan d'entraînement : concentre-toi à 100% sur le conseil demandé.
5. Termine par une phrase d'encouragement chaleureuse. Sois concis (70 à 100 mots max).`;
    }

    // 3. Question générale, salutation ou calcul simple (hors running)
    return `Tu es le Maître de Guilde de Stride Quest, mentor d'aventure.
Tutoie l'aventurier. Réponds de manière concise, polie et directe à la demande de l'aventurier en une seule phrase (15 mots maximum). Ne mentionne aucun entraînement, sport ou course à pied s'il n'en est pas expressément question.`;
  }

  private generateFallbackReport(
    player: Player,
    year: number,
    weekNumber: number,
    summary: CoachWeeklySummary,
  ): string {
    const distKm = (summary.totalDistanceMeters / 1000).toFixed(1);
    const durationMins = Math.round(summary.totalDurationSeconds / 60);
    const goalDesc = GOAL_LABELS[player.coachGoal] || player.coachGoal;

    if (summary.activityCount === 0) {
      return `Salutations ${player.username} !

Pour cette semaine ${weekNumber}, vos bottes d'explorateur sont restées au repos au campement. Aucun kilomètre n'a été enregistré.

Pas d'inquiétude : en aventure comme en préparation sportive (${goalDesc}), le repos fait partie du voyage. Je vous invite à planifier une courte sortie d'échauffement ou une marche active de 20 minutes cette semaine pour relancer votre souffle et faire grimper votre jauge d'XP.

*(Bilan dressé par le Conseil de Guilde en mode autonome).*`;
    }

    return `Salutations valeureux(se) ${player.username} !

Félicitations pour vos efforts de la semaine ${weekNumber} : vous avez accompli ${summary.activityCount} sortie(s) sur les sentiers pour un total de ${distKm} km et ${durationMins} minutes d'effort, avec +${summary.elevationGainMeters} m de dénivelé franchi !

Votre style d'aventure actuel est orienté vers : ${goalDesc}. Chaque kilomètre consolidé développe votre endurance fondamentale et renforce votre résistance pour les futurs raids de guilde.

Pour la semaine à venir, je vous conseille de maintenir cette belle régularité. Veillez à bien vous hydrater, accordez-vous un sommeil réparateur et gardez au moins une sortie à allure très confortable où vous pouvez parler sans essoufflement.

*(Bilan dressé par le Conseil de Guilde en mode autonome).*`;
  }

  private generateFallbackChatReply(player: Player, userText: string): string {
    const textLower = userText.toLowerCase();
    const goalDesc = GOAL_LABELS[player.coachGoal] || player.coachGoal;

    if (textLower.includes('marathon') || textLower.includes('semi')) {
      return `Excellente ambition, ${player.username} ! Pour préparer une telle épreuve avec votre profil (${goalDesc}) :

1. **La règle d'or des 80/20** : consacrez au moins 80 % de votre volume d'entraînement à l'endurance fondamentale (footing lent où vous pouvez discuter sans essoufflement).
2. **Sortie longue progressive** : augmentez la distance de votre sortie la plus longue de 1 à 2 km par semaine maximum, puis intégrez une semaine allégée toutes les 3 ou 4 semaines.
3. **Prévention des blessures** : si une douleur aiguë apparaît au tibia, au genou ou au tendon d'Achille, reposez-vous immédiatement et consultez un spécialiste.`;
    }

    if (
      textLower.includes('recup') ||
      textLower.includes('courbature') ||
      textLower.includes('mal') ||
      textLower.includes('douleur')
    ) {
      return `La récupération est le secret des plus grands explorateurs, ${player.username} !

Pour régénérer vos muscles après vos sorties :
- **Hydratation & Minéraux** : buvez régulièrement après l'effort pour reconstituer les réserves en eau et électrolytes.
- **Récupération active** : une marche tranquille de 15 minutes ou quelques étirements doux favoriseront la circulation sanguine sans agresser les fibres musculaires.
- **Sommeil réparateur** : c'est durant la nuit que vos tissus se réparent et que votre corps assimile l'effort.`;
    }

    return `Bien reçu, aventurier ${player.username} ! 

En tant que Maître de Guilde, je veille sur votre progression vers : ${goalDesc}. Gardez la régularité, écoutez votre corps et célébrez chaque kilomètre franchi sur Stride Quest !`;
  }
}
