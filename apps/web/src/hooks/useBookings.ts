import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingsApi, type CreateBookingPayload, type CreateSlotPayload } from '../api/bookings.api';
import { coursesApi } from '../api/courses.api';

export function useMyBookings() {
  return useQuery({
    queryKey: ['bookings', 'mine'],
    queryFn: () => bookingsApi.getMyBookings(),
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBookingPayload) => bookingsApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings', 'mine'] });
    },
  });
}

export function useConfirmBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bookingsApi.confirm(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings', 'mine'] });
      void queryClient.invalidateQueries({ queryKey: ['challenges', 'summary'] });
      void queryClient.invalidateQueries({ queryKey: ['challenges', 'my-progress'] });
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bookingsApi.cancel(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings', 'mine'] });
    },
  });
}

export function useTeachers() {
  return useQuery({
    queryKey: ['teachers'],
    queryFn: () => bookingsApi.getTeachers(),
  });
}

export function useFreeSlots(teacherId: string | null, weekStart: string) {
  return useQuery({
    queryKey: ['teachers', teacherId, 'slots', weekStart],
    queryFn: () => {
      const from = new Date(weekStart);
      const to = new Date(weekStart);
      to.setDate(to.getDate() + 6);
      return bookingsApi.getFreeSlots(
        teacherId!,
        from.toISOString(),
        to.toISOString(),
      );
    },
    enabled: !!teacherId,
  });
}

export function useMyAvailability() {
  return useQuery({
    queryKey: ['availability', 'mine'],
    queryFn: () => bookingsApi.getMySlots(),
  });
}

export function useAddSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSlotPayload) => bookingsApi.addSlot(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['availability', 'mine'] });
    },
  });
}

export function useDeleteSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bookingsApi.deleteSlot(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['availability', 'mine'] });
    },
  });
}

export function useCoursesForBooking(schoolYearId?: string) {
  return useQuery({
    queryKey: ['courses', 'booking', schoolYearId ?? 'all'],
    queryFn: () => coursesApi.list({ limit: 100, ...(schoolYearId ? { schoolYearId } : {}) }),
  });
}
