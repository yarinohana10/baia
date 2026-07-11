import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.category.findMany({
      where: { parentId: null },
      include: {
        children: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        children: { orderBy: { sortOrder: 'asc' } },
        parent: true,
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async findById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        children: { orderBy: { sortOrder: 'asc' } },
        parent: true,
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(data: {
    nameHe: string;
    nameEn: string;
    slug: string;
    parentId?: string;
    image?: string;
    sortOrder?: number;
  }) {
    return this.prisma.category.create({ data });
  }

  async update(
    id: string,
    data: {
      nameHe?: string;
      nameEn?: string;
      slug?: string;
      parentId?: string | null;
      image?: string;
      sortOrder?: number;
    },
  ) {
    await this.findById(id);
    return this.prisma.category.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.findById(id);
    await this.prisma.category.delete({ where: { id } });
    return { deleted: true };
  }
}
