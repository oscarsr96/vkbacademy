export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

export enum BookingMode {
  IN_PERSON = 'IN_PERSON',
  ONLINE = 'ONLINE',
}

export interface AvailabilitySlot {
  id: string;
  teacherId: string;
  dayOfWeek: number; // 0=Dom, 1=Lun, ..., 6=Sáb
  startTime: string; // "09:00"
  endTime: string;   // "10:00"
  isRecurring: boolean;
}

export interface Booking {
  id: string;
  studentId: string;
  teacherId: string;
  startAt: Date;
  endAt: Date;
  status: BookingStatus;
  mode: BookingMode;
  notes?: string | null;
  courseId?: string | null;
  course?: { id: string; title: string } | null;
  /** URL de sala Daily.co — solo presente cuando mode=ONLINE y status=CONFIRMED */
  meetingUrl?: string | null;
  createdAt: Date;
}

/** Slot libre calculado para un rango de fechas */
export interface FreeSlot {
  teacherId: string;
  startAt: Date;
  endAt: Date;
}

/** Datos públicos de un profesor (devueltos por GET /teachers) */
export interface TeacherPublic {
  id: string;           // teacherProfile.id
  bio: string | null;
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  availability: AvailabilitySlot[];
}
