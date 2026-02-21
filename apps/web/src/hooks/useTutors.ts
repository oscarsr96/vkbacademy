import { useQuery } from '@tanstack/react-query';
import { tutorsApi } from '../api/tutors.api';

export function useMyStudents() {
  return useQuery({
    queryKey: ['tutors', 'my-students'],
    queryFn: () => tutorsApi.getMyStudents(),
  });
}

export function useStudentCourses(studentId: string | null) {
  return useQuery({
    queryKey: ['tutors', 'student-courses', studentId],
    queryFn: () => tutorsApi.getStudentCourses(studentId!),
    enabled: !!studentId,
  });
}
