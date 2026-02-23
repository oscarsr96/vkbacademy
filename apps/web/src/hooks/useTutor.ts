import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clearTutorHistory, getTutorHistory } from '../api/tutor.api';

const HISTORY_KEY = ['tutor', 'history'] as const;

export function useTutorHistory() {
  return useQuery({
    queryKey: HISTORY_KEY,
    queryFn: getTutorHistory,
    staleTime: Infinity, // el widget gestiona el estado local; solo cargamos al montar
  });
}

export function useClearHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearTutorHistory,
    onSuccess: () => {
      queryClient.setQueryData(HISTORY_KEY, []);
    },
  });
}
