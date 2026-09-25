import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNumber, IsOptional, IsString } from "class-validator";
import { AttendanceMode } from "@prisma/client";

export class CheckInDto {
  @ApiProperty({ enum: AttendanceMode, default: AttendanceMode.OFFICE })
  @IsEnum(AttendanceMode)
  mode!: AttendanceMode;

  @ApiPropertyOptional({ example: 28.6139 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 77.2090 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ example: "Community Center, Ward 12" })
  @IsOptional()
  @IsString()
  locationName?: string;

  @ApiPropertyOptional({ example: "Field visit for youth health programme" })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CheckOutDto {
  @ApiPropertyOptional({ example: "Completed field work" })
  @IsOptional()
  @IsString()
  notes?: string;
}
