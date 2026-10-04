import { ApiProperty } from "@nestjs/swagger";
import { PayrollAdjustmentType } from "@prisma/client";
import { IsEnum, IsInt, IsNumber, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreatePayrollAdjustmentDto {
  @ApiProperty()
  @IsUUID()
  personId!: string;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiProperty({ example: 10, description: "1 to 12" })
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiProperty({ enum: PayrollAdjustmentType })
  @IsEnum(PayrollAdjustmentType)
  type!: PayrollAdjustmentType;

  @ApiProperty({ example: 1500, description: "0.01 to 10,000,000" })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10_000_000)
  amount!: number;

  @ApiProperty({ example: "Diwali bonus" })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  reason!: string;
}
