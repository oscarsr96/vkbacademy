import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi, type LoginPayload, type RegisterPayload } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';

export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['me'],
    queryFn: authApi.getMe,
    enabled: !!accessToken,
    staleTime: Infinity,
  });
}

export function useLogin() {
  const { setTokens, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: ({ accessToken, refreshToken, user }) => {
      setTokens({ accessToken, refreshToken });
      setUser(user);
      queryClient.setQueryData(['me'], user);
      navigate('/dashboard', { replace: true });
    },
  });
}

export function useRegister() {
  const { setTokens, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
    onSuccess: ({ accessToken, refreshToken, user }) => {
      setTokens({ accessToken, refreshToken });
      setUser(user);
      queryClient.setQueryData(['me'], user);
      navigate('/dashboard', { replace: true });
    },
  });
}

export function useLogout() {
  const { refreshToken, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => authApi.logout(refreshToken ?? ''),
    onSettled: () => {
      logout();
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });
}
