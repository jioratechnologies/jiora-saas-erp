import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Matches, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { LeaveApplicability } from "@prisma/client";

export class CreateLeaveTypeDto {
  @ApiProperty({ example: "Casual Leave" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: "CL" })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 12 })
  @IsInt()
  @IsPositive()
  annualQuota!: number;

  @ApiPropertyOptional({ enum: LeaveApplicability, default: LeaveApplicability.ALL })
  @IsOptional()
  @IsEnum(LeaveApplicability)
  applicableTo?: LeaveApplicability;
}

export class UpdateLeaveTypeDto {
  @ApiPropertyOptional({ example: "Casual Leave" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: "CL" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  code?: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  annualQuota?: number;

  @ApiPropertyOptional({ enum: LeaveApplicability })
  @IsOptional()
  @IsEnum(LeaveApplicability)
  applicableTo?: LeaveApplicability;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class LeaveSupportingDocumentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  // Must match the key format produced by POST requests/upload-document.
  @ApiProperty()
  @IsString()
  @Matches(/^tenants\/[^/]+\/leave-docs\/[^/]+$/)
  fileKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sizeBytes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class SubmitLeaveRequestDto {
  @ApiProperty({ example: "uuid-leave-type" })
  @IsString()
  @IsNotEmpty()
  leaveTypeId!: string;

  @ApiProperty({ example: "2026-10-15" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: "2026-10-16" })
  @IsDateString()
  endDate!: string;

  @ApiProperty({ example: "Family function" })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional({
    description: "Array of supporting document attachments with name, fileKey, sizeBytes, mimeType",
    example: [{ name: "medical-certificate.pdf", fileKey: "...", sizeBytes: 102400, mimeType: "application/pdf" }],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => LeaveSupportingDocumentDto)
  supportingDocuments?: LeaveSupportingDocumentDto[];
}

export class DecideLeaveRequestDto {
  @ApiPropertyOptional({ example: "Approved for the specified dates" })
  @IsOptional()
  @IsString()
  decisionNotes?: string;
}
