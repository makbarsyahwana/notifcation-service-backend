import {
  Body,
  Controller,
  Delete,
  Get,
  ForbiddenException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import { ObjectIdPipe } from '../common/pipes/objectid.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id', ObjectIdPipe) id: string, @Req() req: Request) {
    const userId = (req as any).user?.userId as string | undefined;
    if (!userId || userId !== id) throw new ForbiddenException();
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ObjectIdPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.userId as string | undefined;
    if (!userId || userId !== id) throw new ForbiddenException();
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id', ObjectIdPipe) id: string, @Req() req: Request) {
    const userId = (req as any).user?.userId as string | undefined;
    if (!userId || userId !== id) throw new ForbiddenException();
    return this.usersService.remove(id);
  }
}
