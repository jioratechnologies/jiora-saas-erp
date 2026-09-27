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

export class SyncAttendanceItemDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsString()
  offlineAttendanceId!: string;

  @ApiProperty({ example: "2026-09-27" })
  @IsString()
  date!: string;

  @ApiProperty({ example: "2026-09-27T09:30:00.000Z" })
  @IsString()
  checkInTime!: string;

  @ApiPropertyOptional({ example: "2026-09-27T18:00:00.000Z" })
  @IsOptional()
  @IsString()
  checkOutTime?: string;

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

  @ApiPropertyOptional({ example: "Community Center" })
  @IsOptional()
  @IsString()
  locationName?: string;

  @ApiPropertyOptional({ example: "Selfie URL or S3 key" })
  @IsOptional()
  @IsString()
  selfieUrl?: string;

  @ApiPropertyOptional({ example: "Captured offline via Android app" })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: { mockLocation: false, rootRisk: false } })
  @IsOptional()
  deviceSignals?: any;

  @ApiPropertyOptional({ example: 12.5 })
  @IsOptional()
  @IsNumber()
  accuracyMeters?: number;
}

export class SyncAttendanceBatchDto {
  @ApiProperty({ type: [SyncAttendanceItemDto] })
  records!: SyncAttendanceItemDto[];
}

export class RegularizeAttendanceDto {
  @ApiProperty({ enum: ["PRESENT", "HALF_DAY", "ABSENT", "ON_LEAVE"] })
  @IsString()
  status!: "PRESENT" | "HALF_DAY" | "ABSENT" | "ON_LEAVE";

  @ApiPropertyOptional({ example: "2026-09-27T09:00:00.000Z" })
  @IsOptional()
  @IsString()
  checkInTime?: string;

  @ApiPropertyOptional({ example: "2026-09-27T18:00:00.000Z" })
  @IsOptional()
  @IsString()
  checkOutTime?: string;

  @ApiProperty({ example: "Field duty biometric device was offline, confirmed by Programme Director" })
  @IsString()
  reason!: string;
}
