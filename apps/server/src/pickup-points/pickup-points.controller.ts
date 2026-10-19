import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { strictValidationPipe } from '../common/validation';
import { PickupPointsService } from './pickup-points.service';
import { CreatePickupPointDto, PickupPointsQueryDto, UpdatePickupPointDto } from './dto/pickup-point.dto';

@Controller()
@UseGuards(RateLimitGuard)
@UsePipes(strictValidationPipe)
export class PickupPointsController {
  constructor(private readonly pickupPoints: PickupPointsService) {}

  /** Active pickup points, sorted; `?city=` filters by city/name/address text. */
  @Get('pickup-points')
  @RateLimit({ limit: 60, windowMs: 60_000 })
  list(@Query() query: PickupPointsQueryDto) {
    return this.pickupPoints.listActive(query.city);
  }

  @Get('admin/pickup-points')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  listAll() {
    return this.pickupPoints.listAll();
  }

  @Post('admin/pickup-points')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  create(@Body() body: CreatePickupPointDto) {
    return this.pickupPoints.create(body);
  }

  @Put('admin/pickup-points/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() body: UpdatePickupPointDto) {
    return this.pickupPoints.update(id, body);
  }

  @Delete('admin/pickup-points/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.pickupPoints.remove(id);
  }
}
