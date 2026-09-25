import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { DocumentCategory, PersonStatus, PersonType } from "@prisma/client";

export class CreatePersonDto {
  @ApiProperty({ enum: PersonType, default: PersonType.EMPLOYEE })
  @IsEnum(PersonType)
  personType!: PersonType;

  @ApiProperty({ example: "Ramesh" })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: "Kumar" })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: "ramesh@sachhisaheli.org" })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: "+91 9876543210" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: "Male" })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ example: "1995-05-15" })
  @IsOptional()
  @IsDateString()
  dob?: string;

  @ApiPropertyOptional({ example: "New Delhi, India" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: "+91 9876543211 (Brother)" })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiPropertyOptional({ example: "uuid-dept" })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ example: "uuid-desig" })
  @IsOptional()
  @IsString()
  designationId?: string;

  @ApiPropertyOptional({ example: "uuid-manager" })
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiPropertyOptional({ example: "2026-01-01" })
  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @ApiPropertyOptional({ example: "uuid-user-if-linked" })
  @IsOptional()
  @IsString()
  userId?: string;
}

export class UpdatePersonDto {
  @ApiPropertyOptional({ enum: PersonType })
  @IsOptional()
  @IsEnum(PersonType)
  personType?: PersonType;

  @ApiPropertyOptional({ enum: PersonStatus })
  @IsOptional()
  @IsEnum(PersonStatus)
  status?: PersonStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dob?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  designationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerId?: string;
}

export class ExitPersonDto {
  @ApiProperty({ example: "2026-10-31" })
  @IsDateString()
  exitDate!: string;

  @ApiProperty({ example: "Relocation to another city" })
  @IsString()
  @IsNotEmpty()
  exitReason!: string;
}

export class UploadDocumentDto {
  @ApiProperty({ example: "Aadhaar Card" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: DocumentCategory, default: DocumentCategory.KYC })
  @IsEnum(DocumentCategory)
  category!: DocumentCategory;
}
