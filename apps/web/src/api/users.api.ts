import api from '../lib/axios';

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  password?: string;
}

export const usersApi = {
  updateProfile: (payload: UpdateProfilePayload) =>
    api.patch('/users/me', payload).then((r) => r.data),
};
