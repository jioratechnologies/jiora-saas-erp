import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { ExpenseClaimCategory } from "@prisma/client";

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

  @ApiPropertyOptional({ type: [Object], example: [{ name: "ticket.pdf", fileKey: "receipts/...", url: "..." }] })
  @IsOptional()
  @IsArray()
  receiptUrls?: any[];
}

export class DecideExpenseClaimDto {
  @ApiProperty({ example: "APPROVED", enum: ["APPROVED", "REJECTED"] })
  @IsString()
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
  @IsString()
  status!: "APPROVED" | "REJECTED";

  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountApproved?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  decisionNotes?: string;
}
