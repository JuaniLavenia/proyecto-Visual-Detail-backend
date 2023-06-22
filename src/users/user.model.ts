import mongoose, { Schema, Document } from 'mongoose';

export interface User extends Document {
  email: {
    type: String;
  };
  password: {
    type: String;
  };
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

export const UserModel = mongoose.model<User>('User', UserSchema);
