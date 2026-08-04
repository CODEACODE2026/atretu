import { ArrayUnique, IsArray, IsUUID } from "class-validator";

export class UpdateUserInstitutionsDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  institutionIds!: string[];
}
