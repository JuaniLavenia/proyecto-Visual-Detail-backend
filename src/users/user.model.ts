import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';

export interface User extends Document {
  email: string;
  password: string;
}

export const UserSchema = new Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    lowercase: true,
    index: { unique: true },
  },
  password: {
    type: String,
    required: true,
  },
});

UserSchema.pre('save', async function () {
  const user = this as User;
  try {
    user.password = await bcrypt.hash(user.password, 12);
  } catch (error) {
    console.log(error);
  }
});

UserSchema.methods.comparePassword = async function (
  password: string,
): Promise<boolean> {
  const user = this as User;
  return bcrypt.compare(password, user.password);
};

export const UserModel = mongoose.model<User>('User', UserSchema);
