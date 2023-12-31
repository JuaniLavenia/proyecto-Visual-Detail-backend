import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsController } from './products/products.controller';
import { ProductService } from './products/products.service';
import { ProductSchema } from './products/product.model';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { UserSchema } from './users/user.model';

const envConfig = dotenv.parse(fs.readFileSync('.env'));

@Module({
  imports: [
    MongooseModule.forRoot(envConfig.MONGODB_URI, {
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
      },
    }),
    MongooseModule.forFeature([
      { name: 'Product', schema: ProductSchema },
      { name: 'User', schema: UserSchema },
    ]),
  ],
  controllers: [AppController, ProductsController, UsersController],
  providers: [AppService, ProductService, UsersService],
})
export class AppModule {}
