import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { AdminUsersService } from './admin-users.service';
import { MAX_ADMIN_PASSWORD_LENGTH, MIN_ADMIN_PASSWORD_LENGTH } from './ensure-admin';

export const createAdminSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(100).optional(),
  password: z.string().min(MIN_ADMIN_PASSWORD_LENGTH).max(MAX_ADMIN_PASSWORD_LENGTH).optional(),
});

@Controller('admin/users')
@UseGuards(AuthGuard)
@Roles('ADMIN')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  /** List all admins. */
  @Get()
  list() {
    return this.adminUsers.listAdmins();
  }

  /** Create a new admin, or promote an existing user by email. */
  @Post()
  create(@Body() body: unknown) {
    const parsed = createAdminSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`));
    }
    return this.adminUsers.createOrPromote(parsed.data);
  }

  /** Remove admin access from a user (keeps the account). Never removes the last admin. */
  @Delete(':id')
  @HttpCode(200)
  revoke(@Param('id') id: string) {
    return this.adminUsers.revokeAdmin(id);
  }
}
