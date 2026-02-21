import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../src/store/auth.store';
import { authApi } from '../../src/api/auth.api';

const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Estudiante',
  TEACHER: 'Profesor',
  ADMIN: 'Administrador',
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  STUDENT: { bg: '#dcfce7', text: '#166534' },
  TEACHER: { bg: '#dbeafe', text: '#1e40af' },
  ADMIN:   { bg: '#fef3c7', text: '#92400e' },
};

export default function ProfileScreen() {
  const { user, refreshToken, clearSession } = useAuthStore();

  const { mutate: logout, isPending } = useMutation({
    mutationFn: () => authApi.logout(refreshToken ?? ''),
    onSettled: () => clearSession(),
  });

  function confirmLogout() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => logout() },
    ]);
  }

  if (!user) return null;

  const roleColor = ROLE_COLORS[user.role] ?? ROLE_COLORS.STUDENT;

  return (
    <View style={styles.container}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>{user.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <View style={[styles.roleBadge, { backgroundColor: roleColor.bg }]}>
          <Text style={[styles.roleText, { color: roleColor.text }]}>
            {ROLE_LABELS[user.role] ?? user.role}
          </Text>
        </View>
      </View>

      {/* Info de cuenta */}
      <View style={styles.card}>
        <InfoRow label="Email" value={user.email} />
        <InfoRow label="Rol" value={ROLE_LABELS[user.role] ?? user.role} last />
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={[styles.logoutBtn, isPending && styles.btnDisabled]}
        onPress={confirmLogout}
        disabled={isPending}
        activeOpacity={0.8}
      >
        {isPending ? (
          <ActivityIndicator color="#dc2626" />
        ) : (
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5', padding: 24, gap: 20 },
  avatarSection: { alignItems: 'center', gap: 10, paddingVertical: 12 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e85d04',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: '#fff', fontSize: 32, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', color: '#1a1a2e' },
  roleBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  roleText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f2f5' },
  rowLabel: { color: '#6b7280', fontSize: 14 },
  rowValue: { color: '#1a1a2e', fontSize: 14, fontWeight: '500' },
  logoutBtn: {
    borderWidth: 1.5,
    borderColor: '#dc2626',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.55 },
  logoutText: { color: '#dc2626', fontWeight: '700', fontSize: 15 },
});
