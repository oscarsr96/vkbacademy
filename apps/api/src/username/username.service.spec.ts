import { Test, TestingModule } from '@nestjs/testing';
import { UsernameService } from './username.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsernameService', () => {
  let service: UsernameService;
  let mockPrisma: { user: { findUnique: jest.Mock } };

  beforeEach(async () => {
    mockPrisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsernameService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(UsernameService);
  });

  it('slugifica nombres con tildes y ñ a ASCII en minúsculas', () => {
    expect(service.slugify('María Pérez Ñoño')).toBe('maria-perez-nono');
  });

  it('asigna un username por nombre cuando no hay colisiones', async () => {
    const result = await service.allocate(['Juan García']);
    expect(result).toEqual(['juan-garcia']);
  });

  it('añade sufijo numérico cuando el username ya existe en BD', async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'x' }) // juan-garcia ocupado
      .mockResolvedValueOnce(null); // juan-garcia-2 libre
    const result = await service.allocate(['Juan García']);
    expect(result).toEqual(['juan-garcia-2']);
  });

  it('desambigua dos nombres iguales en la misma tanda', async () => {
    const result = await service.allocate(['Juan García', 'Juan García']);
    expect(result).toEqual(['juan-garcia', 'juan-garcia-2']);
  });

  it('usa "alumno" como base cuando el nombre no produce slug', async () => {
    const result = await service.allocate(['***']);
    expect(result).toEqual(['alumno']);
  });
});
