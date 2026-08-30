import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { challengesApi } from '../api/challenges.api';
import { adminApi, type CreateChallengePayload, type UpdateChallengePayload } from '../api/admin.api';

export function useRedeemItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemName, cost }: { itemName: string; cost: number }) =>
      challengesApi.redeemItem(itemName, cost),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['challenges', 'summary'] });
      void queryClient.invalidateQueries({ queryKey: ['challenges', 'my-progress'] });
      // El canje recién hecho tiene que aparecer en el histórico sin recargar
      void queryClient.invalidateQueries({ queryKey: ['challenges', 'redemptions'] });
    },
  });
}

export function useChallengeSummary() {
  return useQuery({
    queryKey: ['challenges', 'summary'],
    queryFn: () => challengesApi.getSummary(),
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ['challenges', 'leaderboard'],
    queryFn: () => challengesApi.getLeaderboard(),
  });
}

export function useMyRedemptions() {
  return useQuery({
    queryKey: ['challenges', 'redemptions'],
    queryFn: () => challengesApi.getMyRedemptions(),
  });
}

export function useMyChallenges() {
  return useQuery({
    queryKey: ['challenges', 'my-progress'],
    queryFn: () => challengesApi.getMyProgress(),
  });
}

// ─── Admin hooks ─────────────────────────────────────────────────────────────

export function useAdminChallenges(selectedAcademyId?: string | null) {
  return useQuery({
    queryKey: ['admin', 'challenges', selectedAcademyId],
    // Límite alto: la página muestra el listado completo, no pagina en la UI
    queryFn: () => adminApi.listChallenges({ limit: 500 }),
  });
}

export function useCreateChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateChallengePayload) => adminApi.createChallenge(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'challenges'] });
    },
  });
}

export function useUpdateChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateChallengePayload }) =>
      adminApi.updateChallenge(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'challenges'] });
    },
  });
}

export function useDeleteChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteChallenge(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'challenges'] });
    },
  });
}

export function useToggleChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.toggleChallenge(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'challenges'] });
    },
  });
}
