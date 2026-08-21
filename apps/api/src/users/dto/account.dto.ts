import { Transform } from "class-transformer";
import { IsString, MaxLength, MinLength, ValidateIf } from "class-validator";

export class UpdateOwnAccountDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  name!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;

  @ValidateIf((body: ChangePasswordDto) => body.confirmPassword !== undefined)
  @IsString()
  confirmPassword?: string;
}
