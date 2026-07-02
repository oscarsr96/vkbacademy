import { useLayoutEffect } from 'react';

/**
 * Activa el "modo estadio" (zona oscura) en el contenedor scrollable del
 * AppLayout para la página actual. Las páginas light no llaman a nada:
 * light es el default. Al desmontar la página se restaura.
 */
export function usePageZone(zone: 'dark' | 'light'): void {
  useLayoutEffect(() => {
    if (zone !== 'dark') return;
    const main = document.querySelector('.app-main');
    if (!main) return;
    main.classList.add('zone-dark');
    return () => main.classList.remove('zone-dark');
  }, [zone]);
}
