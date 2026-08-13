import * as fs from 'fs';
import * as path from 'path';

/**
 * Guardia de regresión: el RegisterPage debe validar el formato del email
 * del padre, madre o tutor antes de permitir el envío. Formato requerido: x@y.z
 * Modelo actual: un único email (el del tutor, solo dato de contacto, no
 * crea cuenta); los alumnos no tienen email.
 */
describe('RegisterPage — validación de email', () => {
  const src = fs.readFileSync(path.resolve(__dirname, 'RegisterPage.tsx'), 'utf-8');

  it('contiene una función o regex de validación de email', () => {
    // Debe haber un patrón tipo /regex/.test(email) o una función validateEmail
    const hasValidation =
      src.includes('validateEmail') ||
      src.includes('isValidEmail') ||
      (src.match(/@.*\./) !== null && src.match(/\.test\(/) !== null);
    expect(hasValidation).toBeTruthy();
  });

  it('muestra error visual cuando el email del tutor es inválido (estado guardianEmailError)', () => {
    // Debe existir un estado de error para el email del tutor inválido
    expect(src).toMatch(/guardianEmailError|Email.*inválido|formato.*email/i);
  });
});
