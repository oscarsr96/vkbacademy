export enum Role {
  STUDENT = 'STUDENT',
  TUTOR   = 'TUTOR',
  TEACHER = 'TEACHER',
  ADMIN   = 'ADMIN',
}

export interface User {
  id: string;
  email: string;
  role: Role;
  name: string;
  avatarUrl?: string | null;
  createdAt: Date;
  schoolYearId?: string | null;
  schoolYear?: import('./course.types').SchoolYear | null;
  tutorId?: string | null;
  tutor?: { id: string; name: string } | null;
}

/** Versión pública sin datos sensibles */
export interface PublicUser {
  id: string;
  name: string;
  avatarUrl?: string | null;
  role: Role;
}

export interface TeacherProfile {
  id: string;
  userId: string;
  bio?: string | null;
  user: PublicUser;
}

/** Payload del JWT — role como string porque el JWT es JSON puro */
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

/** Tokens devueltos tras login/refresh */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
