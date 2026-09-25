import { IsEmail, IsHexColor, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: "slug must be lowercase letters, numbers and hyphens only" })
  @MinLength(2)
  @MaxLength(63)
  slug!: string;
}

export class InviteOwnerDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  displayName!: string;
}

export class UpdateTenantThemeDto {
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  showPoweredBy?: boolean;
}
