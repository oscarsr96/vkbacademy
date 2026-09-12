import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../components/tutor/TutorChat', () => ({
  default: () => <div data-testid="tutor-chat" />,
}));

import TutorPage from './TutorPage';

describe('TutorPage', () => {
  it('muestra el título Dudas, la ayuda y el chat', () => {
    render(<TutorPage />);

    expect(screen.getByRole('heading', { name: /dudas/i })).toBeInTheDocument();
    expect(screen.getByText(/sube la foto de un ejercicio/i)).toBeInTheDocument();
    expect(screen.getByTestId('tutor-chat')).toBeInTheDocument();
  });
});
