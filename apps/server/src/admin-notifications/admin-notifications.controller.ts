import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { AdminNotificationsService } from './admin-notifications.service';

@Controller('admin/notifications')
@UseGuards(AuthGuard)
@Roles('ADMIN')
export class AdminNotificationsController {
  constructor(private readonly notifications: AdminNotificationsService) {}

  /** Badge counts for the admin shell (polled every minute). */
  @Get('counts')
  @Header('Cache-Control', 'no-store')
  counts() {
    return this.notifications.counts();
  }
}
