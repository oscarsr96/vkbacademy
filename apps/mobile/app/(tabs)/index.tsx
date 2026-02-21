import { View, Text, StyleSheet } from 'react-native';

export default function CoursesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Listado de cursos — Fase 2</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' },
  text: { fontSize: 16, color: '#333' },
});
