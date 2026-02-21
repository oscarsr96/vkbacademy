import api from '../lib/axios';

export type ChallengeType =
  | 'LESSON_COMPLETED'
  | 'MODULE_COMPLETED'
  | 'COURSE_COMPLETED'
  | 'QUIZ_SCORE'
  | 'BOOKING_ATTENDED'
  | 'STREAK_WEEKLY'
  | 'TOTAL_HOURS';

export interface ChallengeWithProgress {
  id: string;
  title: string;
  description: string;
  type: ChallengeType;
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
  };
  challenges: ChallengeWithProgress[];
}

export interface ChallengeSummary {
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
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
  getMyProgress: () =>
    api.get<ChallengesProgressResponse>('/challenges').then((r) => r.data),

  getSummary: () =>
    api.get<ChallengeSummary>('/challenges/summary').then((r) => r.data),

  redeemItem: (itemName: string, cost: number) =>
    api.post<RedeemResult>('/challenges/redeem', { itemName, cost }).then((r) => r.data),
};
