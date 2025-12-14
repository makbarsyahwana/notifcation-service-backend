import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    try {
      return await this.userModel.create(dto);
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException('Email already exists');
      }
      throw err;
    }
  }

  async findById(id: string): Promise<User> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    try {
      const user = await this.userModel
        .findByIdAndUpdate(id, dto, {
          new: true,
          runValidators: true,
        })
        .exec();

      if (!user) throw new NotFoundException('User not found');
      return user;
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException('Email already exists');
      }
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    const res = await this.userModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('User not found');
  }
}
