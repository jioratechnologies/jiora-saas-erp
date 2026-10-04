import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMaxSize, IsUUID, Matches, IsArray, IsDateString, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { AttendanceMode } from "@prisma/client";

export class CheckInDto {
  @ApiProperty({ enum: AttendanceMode, default: AttendanceMode.OFFICE })
  @IsEnum(AttendanceMode)
  mode!: AttendanceMode;

  @ApiPropertyOptional({ example: 28.6139 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 77.2090 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
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
  @IsNotEmpty()
  @MaxLength(100)
  offlineAttendanceId!: string;

  @ApiProperty({ example: "2026-09-27" })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: "2026-09-27T09:30:00.000Z" })
  @IsDateString()
  checkInTime!: string;

  @ApiPropertyOptional({ example: "2026-09-27T18:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  checkOutTime?: string;

  @ApiProperty({ enum: AttendanceMode, default: AttendanceMode.OFFICE })
  @IsEnum(AttendanceMode)
  mode!: AttendanceMode;

  @ApiPropertyOptional({ example: 28.6139 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 77.2090 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
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
  @Min(0)
  accuracyMeters?: number;
}

// Items are validated one by one in the service (SyncAttendanceItemDto) so one bad item does not reject the batch.
export class SyncAttendanceBatchDto {
  @ApiPropertyOptional({ type: [SyncAttendanceItemDto], description: "Max 200 items" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200, { message: "You can sync at most 200 records at a time." })
  records?: any[];

  @ApiPropertyOptional({ type: [SyncAttendanceItemDto], description: "Alias of records. Max 200 items" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200, { message: "You can sync at most 200 records at a time." })
  items?: any[];
}

export class RegularizeAttendanceDto {
  @ApiProperty({ enum: ["PRESENT", "HALF_DAY", "ABSENT", "ON_LEAVE"] })
  @IsIn(["PRESENT", "HALF_DAY", "ABSENT", "ON_LEAVE"])
  status!: "PRESENT" | "HALF_DAY" | "ABSENT" | "ON_LEAVE";

  @ApiPropertyOptional({ example: "2026-09-27T09:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  checkInTime?: string;

  @ApiPropertyOptional({ example: "2026-09-27T18:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  checkOutTime?: string;

  @ApiProperty({ example: "Field duty biometric device was offline, confirmed by Programme Director" })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class ManualAttendanceDto {
  @ApiProperty()
  @IsUUID()
  personId!: string;

  @ApiProperty({ example: "2026-09-27" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Please enter a valid date (YYYY-MM-DD)." })
  date!: string;

  @ApiProperty({ enum: ["PRESENT", "HALF_DAY", "ABSENT", "ON_LEAVE"] })
  @IsIn(["PRESENT", "HALF_DAY", "ABSENT", "ON_LEAVE"])
  status!: "PRESENT" | "HALF_DAY" | "ABSENT" | "ON_LEAVE";

  @ApiPropertyOptional({ example: "2026-09-27T04:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  checkInTime?: string;

  @ApiPropertyOptional({ example: "2026-09-27T12:30:00.000Z" })
  @IsOptional()
  @IsDateString()
  checkOutTime?: string;

  @ApiProperty({ example: "Employee forgot to check in; confirmed by manager" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
