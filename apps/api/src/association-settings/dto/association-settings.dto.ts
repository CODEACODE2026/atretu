import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class UpdateAssociationSettingsDto {
  @IsString()
  @MaxLength(180)
  legalName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsString()
  @MaxLength(18)
  cnpj!: string;

  @IsString()
  @MaxLength(180)
  street!: string;

  @IsString()
  @MaxLength(30)
  number!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  complement?: string;

  @IsString()
  @MaxLength(120)
  district!: string;

  @IsString()
  @MaxLength(120)
  city!: string;

  @IsString()
  @MaxLength(2)
  @Matches(/^[A-Za-z]{2}$/)
  state!: string;

  @IsString()
  @MaxLength(10)
  postalCode!: string;

  @IsString()
  @MaxLength(30)
  primaryPhone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  secondaryPhone?: string;

  @IsEmail()
  @MaxLength(180)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  website?: string;
}
