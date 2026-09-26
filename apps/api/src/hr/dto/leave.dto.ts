import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString } from "class-validator";
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
  supportingDocuments?: any[];
}

export class DecideLeaveRequestDto {
  @ApiPropertyOptional({ example: "Approved for the specified dates" })
  @IsOptional()
  @IsString()
  decisionNotes?: string;
}
