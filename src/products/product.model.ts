import mongoose, { Schema, Document } from 'mongoose';

export interface Product extends Document {
  name: string;
  description: string;
  image: string;
  price: number;
  stock: number;
  capacity: string;
  category: string;
  brand: string;
}

export const ProductSchema = new Schema({
  id: String,
  name: {
    type: String,
    required: true,
  },
  description: String,
  image: String,
  price: {
    type: Number,
    required: true,
  },
  stock: {
    type: Number,
    required: true,
  },
  capacity: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  brand: String,
});

export const ProductModel = mongoose.model<Product>('Product', ProductSchema);
