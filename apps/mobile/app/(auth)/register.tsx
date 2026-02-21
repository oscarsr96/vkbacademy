import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Link } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../../src/api/auth.api';
import { useAuthStore } from '../../src/store/auth.store';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { setSession } = useAuthStore();

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => authApi.register(name, email, password),
    onSuccess: async (data) => {
      await setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken }, data.user);
    },
    onError: () => {
      // El error de validación local se muestra en el campo
    },
  });

  function handleSubmit() {
    if (password.length < 8) {
      Alert.alert('Contraseña corta', 'La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    mutate();
  }

  const apiError =
    (error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>🏀</Text>
          <Text style={styles.title}>VKB Academy</Text>
          <Text style={styles.subtitle}>Crea tu cuenta</Text>
        </View>

        {apiError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{apiError}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Nombre completo</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Juan García"
              placeholderTextColor="#9ca3af"
              autoComplete="name"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 8 caracteres"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              autoComplete="new-password"
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, isPending && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={isPending}
            activeOpacity={0.8}
          >
            {isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Crear cuenta</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={styles.link}>Inicia sesión</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#1a1a2e' },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 24 },
  header: { alignItems: 'center', gap: 6 },
  logo: { fontSize: 56 },
  title: { fontSize: 28, fontWeight: '700', color: '#ffffff' },
  subtitle: { fontSize: 15, color: '#9ca3af' },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorText: { color: '#dc2626', fontSize: 14 },
  form: { gap: 16 },
  field: { gap: 6 },
  label: { color: '#e5e7eb', fontSize: 14, fontWeight: '500' },
  input: {
    backgroundColor: '#16213e',
    borderWidth: 1.5,
    borderColor: '#374151',
    borderRadius: 8,
    padding: 13,
    fontSize: 15,
    color: '#ffffff',
  },
  btn: {
    backgroundColor: '#e85d04',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { color: '#9ca3af', fontSize: 14 },
  link: { color: '#e85d04', fontWeight: '700', fontSize: 14 },
});
