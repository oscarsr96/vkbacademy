import api from '../lib/axios';

export type ChallengeType =
  | 'STUDY_PLAN_CREATED'
  | 'TOPICS_STUDIED'
  | 'SUBJECT_VARIETY'
  | 'THEORY_COMPLETED'
  | 'EXERCISES_SOLVED'
  | 'HARD_EXERCISES_SOLVED'
  | 'EXERCISES_CORRECT_STREAK'
  | 'EXAM_COMPLETED'
  | 'EXAM_SCORE'
  | 'EXAM_PERFECT'
  | 'EXAM_HARD_SCORE'
  | 'TUTOR_QUESTIONS'
  | 'STREAK_DAILY'
  | 'STREAK_WEEKLY';

export type ChallengeCadence = 'PERMANENT' | 'WEEKLY';

export interface ChallengeWithProgress {
  id: string;
  title: string;
  description: string;
  type: ChallengeType;
  cadence: ChallengeCadence;
  target: number;
  points: number;
  badgeIcon: string;
  badgeColor: string;
  isActive: boolean;
  createdAt: string;
  // progreso del usuario (0 si no tiene UserChallenge)
  progress: number;
  completed: boolean;
  completedAt: string | null;
  awardedPoints: number;
}

export interface ChallengesProgressResponse {
  meta: {
    totalPoints: number;
    currentStreak: number;
    longestStreak: number;
    currentDailyStreak: number;
    longestDailyStreak: number;
  };
  challenges: ChallengeWithProgress[];
}

export interface ChallengeSummary {
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  currentDailyStreak: number;
  longestDailyStreak: number;
  /** Si la actividad de hoy ya cuenta para la racha diaria. */
  activeToday: boolean;
  completedCount: number;
  recentBadges: {
    title: string;
    badgeIcon: string;
    badgeColor: string;
    completedAt: string | null;
  }[];
}

export interface RedeemResult {
  message: string;
  pointsSpent: number;
  remainingPoints: number;
}

export const challengesApi = {
  getMyProgress: () => api.get<ChallengesProgressResponse>('/challenges').then((r) => r.data),

  getSummary: () => api.get<ChallengeSummary>('/challenges/summary').then((r) => r.data),

  redeemItem: (itemName: string, cost: number) =>
    api.post<RedeemResult>('/challenges/redeem', { itemName, cost }).then((r) => r.data),
};
