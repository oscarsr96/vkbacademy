import api from '../lib/axios';
import type { Booking, TeacherPublic, AvailabilitySlot } from '@vkbacademy/shared';

export interface BookingWithRelations extends Omit<Booking, 'startAt' | 'endAt' | 'createdAt'> {
  startAt: string;
  endAt: string;
  createdAt: string;
  teacher?: { user: { name: string; avatarUrl: string | null } };
  student?: { name: string; avatarUrl: string | null };
  course?: { id: string; title: string } | null;
}

export interface CreateBookingPayload {
  studentId: string;
  teacherId: string;
  startAt: string; // ISO
  endAt: string;   // ISO
  mode?: 'IN_PERSON' | 'ONLINE';
  notes?: string;
  courseId?: string;
}

export interface CreateSlotPayload {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface FreeSlotRaw {
  teacherId: string;
  startAt: string;
  endAt: string;
}

export const bookingsApi = {
  getMyBookings: () =>
    api.get<BookingWithRelations[]>('/bookings/mine').then((r) => r.data),
  create: (payload: CreateBookingPayload) =>
    api.post<Booking>('/bookings', payload).then((r) => r.data),
  confirm: (id: string) =>
    api.patch<Booking>(`/bookings/${id}/confirm`).then((r) => r.data),
  cancel: (id: string) =>
    api.patch<Booking>(`/bookings/${id}/cancel`).then((r) => r.data),

  getTeachers: () =>
    api.get<TeacherPublic[]>('/teachers').then((r) => r.data),
  getFreeSlots: (teacherId: string, from: string, to: string) =>
    api.get<FreeSlotRaw[]>(`/teachers/${teacherId}/slots`, { params: { from, to } }).then((r) => r.data),

  getMySlots: () =>
    api.get<AvailabilitySlot[]>('/availability/mine').then((r) => r.data),
  addSlot: (payload: CreateSlotPayload) =>
    api.post<AvailabilitySlot>('/availability', payload).then((r) => r.data),
  deleteSlot: (id: string) =>
    api.delete(`/availability/${id}`).then((r) => r.data),
};
