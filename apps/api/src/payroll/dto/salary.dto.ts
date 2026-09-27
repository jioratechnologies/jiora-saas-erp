import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { SalaryComponentType } from "@prisma/client";

export class CreateSalaryComponentDto {
  @ApiProperty({ example: "Basic Salary" })
  @IsString()
  name!: string;

  @ApiProperty({ example: "BASIC" })
  @IsString()
  code!: string;

  @ApiProperty({ enum: SalaryComponentType, default: SalaryComponentType.EARNING })
  @IsEnum(SalaryComponentType)
  type!: SalaryComponentType;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isStatutory?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateSalaryComponentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: SalaryComponentType })
  @IsOptional()
  @IsEnum(SalaryComponentType)
  type?: SalaryComponentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isStatutory?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class SalaryStructureItemDto {
  @ApiProperty({ example: "BASIC" })
  @IsString()
  componentCode!: string;

  @ApiProperty({ example: "PERCENTAGE_OF_BASIC", enum: ["PERCENTAGE_OF_BASIC", "FIXED"] })
  @IsString()
  calculationType!: "PERCENTAGE_OF_BASIC" | "FIXED";

  @ApiProperty({ example: 50 })
  @IsNumber()
  value!: number;
}

export class CreateSalaryStructureDto {
  @ApiProperty({ example: "Standard Staff Structure" })
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [SalaryStructureItemDto] })
  @IsOptional()
  @IsArray()
  items?: SalaryStructureItemDto[];
}

export class AssignSalaryDto {
  @ApiProperty()
  @IsString()
  personId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  salaryStructureId?: string;

  @ApiProperty({ example: 45000 })
  @IsNumber()
  @Min(0)
  baseGross!: number;

  @ApiPropertyOptional({ example: 540000 })
  @IsOptional()
  @IsNumber()
  ctc?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  customItems?: any[];

  @ApiPropertyOptional({ example: "2026-09-01" })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ example: "BANK_TRANSFER", default: "BANK_TRANSFER" })
  @IsOptional()
  @IsString()
  paymentMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankIfsc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  panNumber?: string;
}

export class RecordSalaryRevisionDto {
  @ApiProperty()
  @IsString()
  personId!: string;

  @ApiProperty({ example: 55000 })
  @IsNumber()
  @Min(0)
  newGross!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  newDesignationId?: string;

  @ApiProperty({ example: "2026-10-01" })
  @IsDateString()
  effectiveDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}
