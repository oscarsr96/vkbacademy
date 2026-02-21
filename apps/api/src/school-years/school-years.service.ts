import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SchoolYearsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.schoolYear.findMany({ orderBy: { name: 'asc' } });
  }
}
