import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DateTime } from 'luxon';
import { Model } from 'mongoose';
import { BirthdayQueueService } from '../birthday-worker/birthday-queue.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly birthdayQueueService: BirthdayQueueService,
  ) {}

  private toBirthdayMd(birthdayIsoDate: string): string {
    const dt = DateTime.fromISO(birthdayIsoDate, { zone: 'utc' });
    const mm = String(dt.month).padStart(2, '0');
    const dd = String(dt.day).padStart(2, '0');
    return `${mm}-${dd}`;
  }

  async create(dto: CreateUserDto): Promise<User> {
    try {
      const created = await this.userModel.create({
        ...dto,
        birthdayMd: this.toBirthdayMd(dto.birthday),
      });

      await this.birthdayQueueService.scheduleUser(created as unknown as any);
      return created;
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
    const setDoc: Record<string, unknown> = { ...dto };
    const unsetDoc: Record<string, unknown> = {};
    if (dto.birthday) {
      setDoc.birthdayMd = this.toBirthdayMd(dto.birthday);
      unsetDoc.lastBirthdayMessageDate = 1;
    }

    const updateDoc = Object.keys(unsetDoc).length
      ? { $set: setDoc, $unset: unsetDoc }
      : setDoc;

    try {
      const user = await this.userModel
        .findByIdAndUpdate(id, updateDoc, {
          new: true,
          runValidators: true,
        })
        .select('+emailVerified')
        .exec();

      if (!user) throw new NotFoundException('User not found');

      await this.birthdayQueueService.scheduleUser(user as unknown as any);
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

    await this.birthdayQueueService.removeUser(id);
  }
}
