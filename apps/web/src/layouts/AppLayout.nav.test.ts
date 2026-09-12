import { describe, expect, it } from 'vitest';
import { Role } from '@vkbacademy/shared';
import { buildNavLinks } from './AppLayout';

describe('buildNavLinks', () => {
  it('el alumno tiene «Dudas» justo debajo de «Estudiar»', () => {
    const labels = buildNavLinks(Role.STUDENT).map((l) => l.label);
    const study = labels.indexOf('Estudiar');

    expect(study).toBeGreaterThan(-1);
    expect(labels[study + 1]).toBe('Dudas');
    expect(buildNavLinks(Role.STUDENT).find((l) => l.label === 'Dudas')?.to).toBe('/tutor');
  });

  it.each([Role.ADMIN, Role.SUPER_ADMIN])('%s no tiene «Dudas»', (role) => {
    expect(buildNavLinks(role).some((l) => l.label === 'Dudas')).toBe(false);
  });
});
