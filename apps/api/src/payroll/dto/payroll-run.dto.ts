import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { PayrollRunStatus } from "@prisma/client";

export class ExecutePayrollRunDto {
  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiProperty({ example: 9, description: "1 to 12" })
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiPropertyOptional({ example: "September 2026 Payroll Run" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePayrollRunStatusDto {
  @ApiProperty({ enum: PayrollRunStatus })
  @IsEnum(PayrollRunStatus)
  status!: PayrollRunStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePayslipPaymentDto {
  @ApiProperty({ example: "PAID", enum: ["PENDING", "PAID"] })
  @IsString()
  paymentStatus!: "PENDING" | "PAID";

  @ApiPropertyOptional({ example: "NEFT-REF-99210" })
  @IsOptional()
  @IsString()
  paymentReference?: string;
}
