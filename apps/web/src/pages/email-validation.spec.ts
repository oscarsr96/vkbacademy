import * as fs from 'fs';
import * as path from 'path';

/**
 * Guardia de regresión: el RegisterPage debe validar formato de email
 * antes de permitir el envío. Formato requerido: x@y.z
 * Todo lo que no cumpla debe marcarse en rojo e impedir el registro.
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

  it('muestra error visual cuando el email es inválido (estado emailError)', () => {
    // Debe existir un estado de error para emails inválidos
    expect(src).toMatch(/emailError|tutorEmailError|Email.*inválido|formato.*email/i);
  });

  it('valida el email del tutor antes de pasar al paso 2', () => {
    // En handleStep1 debe comprobar el email antes de setStep(2)
    expect(src).toMatch(/email.*valid|validateEmail|isValidEmail/i);
  });

  it('valida el email de cada alumno antes de enviar', () => {
    // En handleStep2 debe comprobar los emails de students
    expect(src).toMatch(/student.*email.*valid|every.*email/i);
  });
});
