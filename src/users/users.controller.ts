import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Delete,
  Param,
  Res,
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

  @Post('login')
  async login(@Body() body, @Res() res) {
    try {
      const { email, password } = body;
      const result = await this.usersService.login(email, password);
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: 'Server error' });
    }
  }

  @Post('register')
  async register(@Body() body, @Res() res) {
    try {
      const { email, password } = body;
      const result = await this.usersService.register(email, password);
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error });
    }
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body, @Res() res) {
    try {
      const { email } = body;
      const result = await this.usersService.forgotPassword(email);
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: 'Server error' });
    }
  }

  @Post('reset-password/:id/:token')
  async resetPassword(@Body() body, @Res() res) {
    try {
      const { id, token } = body;
      const { password } = body;
      const result = await this.usersService.resetPassword(id, token, password);
      return res.json(result);
    } catch (error) {
      if (error.message == 'jwt expired') {
        return res.status(500).json({ error: 'Token expirado' });
      }
      if (error.message == 'invalid token') {
        return res.status(500).json({ error: 'Token inválido' });
      }
      return res.status(500).json({ error: 'Server error' });
    }
  }
}
