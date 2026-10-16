import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { strictValidationPipe } from '../common/validation';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

type AuthedRequest = Request & { user: { id: string } };

/** The signed-in user's saved shipping addresses. Never takes a user id from the client. */
@Controller('addresses')
@UseGuards(AuthGuard)
@UsePipes(strictValidationPipe)
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Req() req: AuthedRequest) {
    return this.addresses.list(req.user.id);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  get(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.addresses.get(req.user.id, id);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() body: CreateAddressDto) {
    return this.addresses.create(req.user.id, body);
  }

  @Patch(':id')
  update(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: UpdateAddressDto) {
    return this.addresses.update(req.user.id, id, body);
  }

  @Post(':id/default')
  @HttpCode(200)
  setDefault(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.addresses.setDefault(req.user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.addresses.remove(req.user.id, id);
  }
}
