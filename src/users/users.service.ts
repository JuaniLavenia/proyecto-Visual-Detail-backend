import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.model';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

const envConfig = dotenv.parse(fs.readFileSync('.env'));

@Injectable()
export class UsersService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<User>,
    private readonly jwtService: JwtService,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async create(userData: User): Promise<User> {
    const newUser = new this.userModel(userData);
    return newUser.save();
  }
  async update(id: string, userData: User): Promise<User> {
    return this.userModel.findByIdAndUpdate(id, userData, { new: true });
  }

  async delete(id: string): Promise<void> {
    await this.userModel.findByIdAndDelete(id);
  }

  async comparePassword(userId: string, password: string): Promise<boolean> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      return false;
    }
    return bcrypt.compare(password, user.password);
  }

  async login(email: string, password: string) {
    let user = await this.userModel.findOne({ email });
    if (!user) {
      return { error: 'El correo y/o la contraseña son incorrectos' };
    }

    const passwordCorrecto = await this.comparePassword(user.id, password);
    if (!passwordCorrecto) {
      return { error: 'El correo y/o la contraseña son incorrectos' };
    }

    const token = this.jwtService.sign({ uid: user.id }, { expiresIn: '1h' });

    return { login: true, userId: user.id, token };
  }

  async register(email: string, password: string) {
    try {
      const user = new this.userModel({
        email,
        password,
      });

      await user.save();

      return { register: true, userId: user.id };
    } catch (error) {
      return { error };
    }
  }

  async forgotPassword(email: string) {
    try {
      const user = await this.userModel.findOne({ email });
      if (!user) {
        return { error: 'No existe el usuario' };
      }

      const secret = envConfig.JWT_SECRET + user.password;

      const token = this.jwtService.sign(
        { uid: user.id },
        { expiresIn: '15m' },
      );

      const link = `https://rolling-detail-pf.vercel.app/reset/${user.id}?token=${token}`;

      // await this.mailerService.sendMail({
      //   to: user.email,
      //   subject: 'Restablecer Contraseña - Visual-Detailing',
      //   html: `
      //     <h1>¿Olvidaste tu contraseña?</h1>
      //     <p>¡No te preocupes! Te enviamos un link para que puedas acceder a tu cuenta; el mismo será válido por sólo 15 minutos.</p>
      //     <a data-bs-toggle="modal" data-bs-target="#olvideContrasenaForm" href="${link}">Haz clic aquí para restablecer tu contraseña.</a>
      //     <p>¡Gracias por utilizar nuestros servicios!</p>
      //     <p>Saludos,</p>
      //     <p>El equipo de Visual-Detailing.</p>
      //   `,
      // });

      return { userId: user.id, send: true };
    } catch (error) {
      return { error: 'Server error' };
    }
  }

  async resetPassword(id: string, token: string, password: string) {
    try {
      const user = await this.userModel.findById(id);
      if (!user) {
        return { error: 'El usuario no existe' };
      }
      const secret = envConfig.JWT_SECRET + user.password;
      const verified = this.jwtService.verify(token, { secret });
      if (verified) {
        user.password = password;
        await user.save();
      }

      return { userId: user.id, verified };
    } catch (error) {
      if (error.message == 'jwt expired') {
        return { error: 'Token expirado' };
      }
      if (error.message == 'invalid token') {
        return { error: 'Token inválido' };
      }
      return { error: 'Server error' };
    }
  }
}
