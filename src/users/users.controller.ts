import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Delete,
  Param,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './user.model';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getAllUsers(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Post()
  async createUser(@Body() userData: User): Promise<User> {
    return this.usersService.create(userData);
  }

  @Put(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() userData: User,
  ): Promise<User> {
    return this.usersService.update(id, userData);
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string): Promise<void> {
    return this.usersService.delete(id);
  }
}
