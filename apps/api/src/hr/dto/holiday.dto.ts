import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateHolidayDto {
  @ApiProperty({ example: "Diwali" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: "2026-11-08" })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;
}
