import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.model';

@Injectable()
export class UsersService {
  constructor(@InjectModel('User') private readonly userModel: Model<User>) {}

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
}
