import { RoleCode } from "@prisma/client";
import { IsEmail, IsEnum, IsString, MinLength } from "class-validator";

export class CreateAdminUserDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(10)
  password!: string;

  @IsEnum(RoleCode)
  role!: RoleCode;
}
