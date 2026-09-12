import '@testing-library/jest-dom/vitest';

// jsdom no implementa matchMedia y varios componentes lo consultan al montar
// (useCountUp mira prefers-reduced-motion). Sin este stub cualquier test que
// renderice esos componentes revienta en el efecto, no en el assert.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom tampoco implementa scrollIntoView (TutorChat lo llama en cada
// mensaje para auto-scroll). Mismo motivo que el stub de matchMedia: sin
// esto el efecto revienta al montar, no el assert del test.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}
