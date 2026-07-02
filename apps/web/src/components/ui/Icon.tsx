import { ICONS } from './icons';

interface IconProps {
  name: string;
  size?: number | string;
  color?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

/** Icono SVG de línea del registro compartido. Hereda color vía currentColor. */
export default function Icon({
  name,
  size = 20,
  color = 'currentColor',
  strokeWidth = 1.85,
  style,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={style}
      dangerouslySetInnerHTML={{ __html: ICONS[name] ?? '' }}
    />
  );
}
