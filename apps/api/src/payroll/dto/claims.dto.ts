import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { ExpenseClaimCategory } from "@prisma/client";

export class ClaimReceiptDto {
  @ApiProperty()
  @IsString()
  name!: string;

  // Storage key only (never a presigned URL); format matches POST expenses/:id/receipt.
  @ApiProperty()
  @IsString()
  @Matches(/^tenants\/[^/]+\/claims\/[^/]+\/[^/]+$/)
  fileKey!: string;
}

export class SubmitExpenseClaimDto {
  @ApiProperty({ example: "Inter-city Train to Field Unit" })
  @IsString()
  title!: string;

  @ApiProperty({ enum: ExpenseClaimCategory, default: ExpenseClaimCategory.TRAVEL })
  @IsEnum(ExpenseClaimCategory)
  category!: ExpenseClaimCategory;

  @ApiProperty({ example: 1250.5 })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty({ example: "2026-09-24" })
  @IsDateString()
  expenseDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [ClaimReceiptDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ClaimReceiptDto)
  receiptUrls?: ClaimReceiptDto[];
}

export class DecideExpenseClaimDto {
  @ApiProperty({ example: "APPROVED", enum: ["APPROVED", "REJECTED"] })
  @IsIn(["APPROVED", "REJECTED"])
  status!: "APPROVED" | "REJECTED";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  decisionNotes?: string;
}

export class SettleExpenseClaimDto {
  @ApiProperty({ example: "BANK-TRF-102948" })
  @IsString()
  settlementReference!: string;
}

export class RequestSalaryAdvanceDto {
  @ApiProperty({ example: 15000 })
  @IsNumber()
  @Min(500)
  amountRequested!: number;

  @ApiProperty({ example: "Medical emergency in family" })
  @IsString()
  reason!: string;

  @ApiProperty({ example: 3, description: "Repayment tenure in months (1-12)" })
  @IsInt()
  @Min(1)
  tenureMonths!: number;
}

export class DecideSalaryAdvanceDto {
  @ApiProperty({ example: "APPROVED", enum: ["APPROVED", "REJECTED"] })
  @IsIn(["APPROVED", "REJECTED"])
  status!: "APPROVED" | "REJECTED";

  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountApproved?: number;

  @ApiPropertyOptional({ example: 0, description: "Annual interest % on the reducing balance (0 = interest-free)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  interestRate?: number;

  @ApiPropertyOptional({ example: 6, description: "Override the requested repayment tenure (1-60 months)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  tenureMonths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  decisionNotes?: string;
}
