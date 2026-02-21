import api from '../lib/axios';
import type { Certificate, CertificateVerification } from '@vkbacademy/shared';

export const certificatesApi = {
  getMyCertificates: () =>
    api.get<Certificate[]>('/certificates').then((r) => r.data),

  getCertificate: (id: string) =>
    api.get<Certificate>(`/certificates/${id}`).then((r) => r.data),

  verifyCertificate: (code: string) =>
    api.get<CertificateVerification>(`/certificates/verify/${code}`).then((r) => r.data),
};
