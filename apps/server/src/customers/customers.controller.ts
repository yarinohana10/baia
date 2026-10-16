import { Controller, Get, Header, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { clampInt, MAX_PAGE } from '../products/pagination';
import { CustomersService } from './customers.service';

export const CUSTOMERS_PAGE_LIMIT = { default: 20, max: 100 };

@Controller('admin/customers')
@UseGuards(AuthGuard)
@Roles('ADMIN')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  findAll(@Query('search') search?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.customers.findAll({
      search: typeof search === 'string' ? search.slice(0, 100) : undefined,
      page: clampInt(page, 1, 1, MAX_PAGE),
      limit: clampInt(limit, CUSTOMERS_PAGE_LIMIT.default, 1, CUSTOMERS_PAGE_LIMIT.max),
    });
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  findById(@Param('id') id: string) {
    return this.customers.findById(id);
  }
}
