/**
 * IDs de canal (snippet.channelId) de YouTube cuya producción educativa
 * consideramos de alta calidad para el curriculum español. Su presencia
 * aporta un boost al score en YoutubeService.
 *
 * IDs verificados manualmente en Abril 2026. Si un canal cambia de ID
 * (raro pero posible al eliminar cuenta), se ignora silenciosamente —
 * YoutubeService hace `includes(channelId)` sin validar que existan.
 */
export const YOUTUBE_WHITELIST_CHANNELS: string[] = [
  'UCR9zNNl1_T3dcmuCnBpOoNg', // Unicoos
  'UCGc8ZVCsrR3dAuhvUbkbToQ', // Matemáticas Profe Alex
  'UCdRjp5DiJZvKOJsxQcCh4GA', // Derivando
  'UCbdSYaPD-lr1kW27UJuk8Pw', // QuantumFracture
  'UCwuG9HKUf-Xa1-XAQQtOSCA', // Academia Internet
  'UCqWR5kqa2MPNhfM5Tm2Txbg', // Date un Vlog / Voltio
];
