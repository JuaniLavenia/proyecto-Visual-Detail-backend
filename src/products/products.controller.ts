import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ProductService } from './products.service';
import { Product } from './product.model';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

const storage = diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/img/productos');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

@Controller('productos')
export class ProductsController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  async getAllProducts(): Promise<Product[]> {
    try {
      const productos = await this.productService.findAll();
      return productos;
    } catch (err) {
      console.log(err);
      throw new Error(err.message);
    }
  }

  @Get(':id')
  async getProductById(@Param('id') id: string): Promise<Product> {
    try {
      const producto = await this.productService.findById(id);
      console.log(producto);
      return producto;
    } catch (err) {
      console.log(err);
    }
  }

  @Post()
  @UseInterceptors(FileInterceptor('image', { storage }))
  async createProduct(
    @Body() productData: any,
    @UploadedFile() image,
  ): Promise<Product> {
    console.log(productData, image);

    try {
      const newProduct = new this.productService.productModelGetter({
        name: productData.name,
        description: productData.description,
        image: productData.image,
        category: productData.category,
        price: productData.price,
        stock: productData.stock,
        capacity: productData.capacity,
        brand: productData.brand,
      });
      const result = await newProduct.save();
      return result;
    } catch (err) {
      console.log(err);
    }
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('image', { storage }))
  async updateProduct(
    @Param('id') id: string,
    @Body() productData: any,
    @UploadedFile() image,
  ): Promise<Product> {
    try {
      const result =
        await this.productService.productModelGetter.findByIdAndUpdate(
          id,
          {
            name: productData.name,
            description: productData.description,
            image: image.filename,
            price: productData.price,
            stock: productData.stock,
            capacity: productData.capacity,
            category: productData.category,
            brand: productData.brand,
          },
          { new: true },
        );
      return result;
    } catch (err) {
      console.log(err);
    }
  }

  @Delete(':id')
  async deleteProduct(@Param('id') id: string): Promise<{ msg: string }> {
    try {
      const result = await this.productService.delete(id);
      const msg = result ? 'Registro borrado' : 'No se encontró el registro';
      return { msg };
    } catch (err) {
      console.log(err);
    }
  }

  @Get('search/:filter')
  async searchProducts(@Param('filter') filter: string): Promise<Product[]> {
    try {
      let productos;
      if (!filter) {
        productos = await this.productService.findAll();
      } else {
        productos = await this.productService.findByNameFilter(filter);
      }
      return productos;
    } catch (error) {
      console.log(error);
    }
  }

  @Get('category/:filter')
  async getProductsByCategory(
    @Param('filter') filter: string,
  ): Promise<Product[]> {
    try {
      const productos = await this.productService.findByCategoryFilter(filter);
      return productos;
    } catch (error) {
      console.log(error);
    }
  }

  @Get('brand/:filter')
  async getProductsByBrand(
    @Param('filter') filter: string,
  ): Promise<Product[]> {
    try {
      const productos = await this.productService.findByBrandFilter(filter);
      return productos;
    } catch (error) {
      console.log(error);
    }
  }
}
