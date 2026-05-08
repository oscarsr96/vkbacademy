export type CertificateType =
  | 'MODULE_COMPLETION'
  | 'COURSE_COMPLETION'
  | 'MODULE_EXAM'
  | 'COURSE_EXAM';

export interface Certificate {
  id: string;
  type: CertificateType;
  verifyCode: string;
  examScore: number | null;
  issuedAt: string;
  recipientName: string; // user.name
  scopeTitle: string; // título del módulo o curso
  scopeId: string; // courseId o moduleId
  courseId?: string; // id del curso (propio o padre del módulo) para agrupar
  courseTitle?: string; // curso padre (solo si el certificado es de módulo)
}

export interface CertificateVerification {
  valid: boolean;
  certificate?: Omit<Certificate, 'recipientName'>;
}
