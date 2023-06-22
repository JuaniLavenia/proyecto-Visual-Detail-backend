import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from './product.model';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel('Product')
    private readonly productModel: Model<Product>,
  ) {}

  get productModelGetter(): Model<Product> {
    return this.productModel;
  }

  async findAll(): Promise<Product[]> {
    try {
      const productos = await this.productModel.find().exec();
      return productos;
    } catch (err) {
      console.log(err);
      throw new Error(err.message);
    }
  }

  async findById(id: string): Promise<Product> {
    try {
      const producto = await this.productModel.findById(id).exec();
      return producto;
    } catch (err) {
      console.log(err);
    }
  }

  async create(producto: Product): Promise<Product> {
    try {
      const newProduct = new this.productModel(producto);
      const result = await newProduct.save();
      return result;
    } catch (err) {
      console.log(err);
    }
  }

  async update(id: string, producto: Product): Promise<Product> {
    try {
      const result = await this.productModel
        .findByIdAndUpdate(id, producto, { new: true })
        .exec();
      return result;
    } catch (err) {
      console.log(err);
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.productModel.findByIdAndDelete(id).exec();
      return !!result;
    } catch (err) {
      console.log(err);
    }
  }

  async findByNameFilter(filter: string): Promise<Product[]> {
    try {
      const productos = await this.productModel
        .find({ name: { $regex: filter, $options: 'i' } })
        .exec();
      return productos;
    } catch (error) {
      console.log(error);
    }
  }

  async findByCategoryFilter(filter: string): Promise<Product[]> {
    try {
      const productos = await this.productModel
        .find({ category: { $regex: filter } })
        .exec();
      return productos;
    } catch (error) {
      console.log(error);
    }
  }

  async findByBrandFilter(filter: string): Promise<Product[]> {
    try {
      const productos = await this.productModel
        .find({ brand: { $regex: filter } })
        .exec();
      return productos;
    } catch (error) {
      console.log(error);
    }
  }
}
