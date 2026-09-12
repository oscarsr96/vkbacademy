/** Tema elegido en el formulario de Estudiar (oficial del temario o propio). */
export interface SelectedTopic {
  key: string;
  kind: 'OFFICIAL' | 'CUSTOM';
  moduleId?: string;
  title: string;
  subject?: string;
  label: string;
}

/** Igual que el mínimo del DTO (`title` ≥ 3). */
const MIN_TITLE = 3;

/**
 * Tema que llega en la URL desde Dudas (#141): `?topic=…&moduleId=…`.
 * Si el `moduleId` está en el temario del curso, tema oficial con su numeral;
 * si no (o no viene), tema propio con el título. Sin `topic`, nada.
 */
export function topicFromSearchParams(
  params: URLSearchParams,
  modules: { id: string; title: string }[],
): SelectedTopic | null {
  const title = params.get('topic')?.trim() ?? '';
  if (title.length < MIN_TITLE) return null;

  const moduleId = params.get('moduleId');
  const index = moduleId ? modules.findIndex((m) => m.id === moduleId) : -1;
  if (index >= 0) {
    const module = modules[index];
    return {
      key: `official-${module.id}`,
      kind: 'OFFICIAL',
      moduleId: module.id,
      title: module.title,
      label: `Tema ${index + 1} — ${module.title}`,
    };
  }

  return { key: `custom-preselect-${title}`, kind: 'CUSTOM', title, label: title };
}
