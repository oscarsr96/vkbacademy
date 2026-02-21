import { useQuery } from '@tanstack/react-query';
import { certificatesApi } from '../api/certificates.api';

export function useMyCertificates() {
  return useQuery({
    queryKey: ['certificates', 'my'],
    queryFn: () => certificatesApi.getMyCertificates(),
  });
}

export function useCertificate(id: string) {
  return useQuery({
    queryKey: ['certificates', id],
    queryFn: () => certificatesApi.getCertificate(id),
    enabled: !!id,
  });
}
