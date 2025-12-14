import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  birthday: string;

  @Prop({ required: true, select: false })
  birthdayMd: string;

  @Prop({ required: true })
  timezone: string;

  @Prop({ default: false, select: false })
  emailVerified: boolean;

  @Prop({ select: false })
  otpHash?: string;

  @Prop({ select: false })
  otpSalt?: string;

  @Prop({ type: Date, select: false })
  otpExpiresAt?: Date;

  @Prop({ select: false })
  lastBirthdayMessageDate?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ birthdayMd: 1 });

UserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as any;
    delete r.birthdayMd;
    delete r.lastBirthdayMessageDate;
    return r;
  },
});
