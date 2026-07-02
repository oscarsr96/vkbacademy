import { isLight, lighten, darken, withAlpha } from './color';

/** Color oficial de Vallekas Basket — default cuando no hay academia */
const VKB_ORANGE = '#f5911e';

/**
 * Inyecta el color de marca de la academia en las CSS variables del
 * documento. Todo el design system deriva de `--brand`, así que con esta
 * llamada la app entera (sidebar, botones, glows, gradientes) queda
 * tematizada sin tocar ningún componente.
 *
 * El ámbar LED y el cyan NO se tocan: son identidad "estadio", no marca.
 */
export function applyBrand(hex?: string | null): void {
  const brand = hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : VKB_ORANGE;
  const light = lighten(brand);
  const deep = darken(brand);
  const root = document.documentElement.style;

  root.setProperty('--brand', brand);
  root.setProperty('--brand-light', light);
  root.setProperty('--brand-deep', deep);
  root.setProperty('--brand-contrast', isLight(brand) ? '#0a1628' : '#ffffff');
  root.setProperty('--brand-soft', withAlpha(brand, 0.12));
  root.setProperty('--brand-faint', withAlpha(brand, 0.06));
  root.setProperty('--brand-glow', withAlpha(brand, 0.4));
  root.setProperty('--gradient-orange', `linear-gradient(135deg, ${brand} 0%, ${light} 100%)`);
  root.setProperty(
    '--gradient-signature',
    `linear-gradient(135deg, ${brand} 0%, ${light} 55%, #13aff0 100%)`,
  );
  root.setProperty('--shadow-orange', `0 8px 32px ${withAlpha(brand, 0.3)}`);
  root.setProperty('--shadow-card-hover', `0 16px 48px ${withAlpha(brand, 0.18)}`);
}
