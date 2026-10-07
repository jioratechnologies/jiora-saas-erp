import { Type } from "class-transformer";
import { ArrayUnique, IsArray, IsEmail, IsInt, IsNumber, IsOptional, Max, Min, ValidateIf, ValidateNested, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateDepartmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

export class CreateDesignationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

export class CreateRoleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionKeys!: string[];
}

export class UpdateRoleDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionKeys!: string[];
}

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  displayName!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  designationId?: string;

  /** Only the protected organisation admin role can be assigned here; everything else comes from the designation. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  roleIds?: string[];
}

export class AssignDepartmentMemberDto {
  @IsUUID()
  personId!: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  managerId?: string | null;
}

export class SetDepartmentHeadDto {
  @IsUUID()
  personId!: string;
}

export class SalarySplitDto {
  @IsInt({ message: "Salary split must be whole numbers." })
  @Min(0, { message: "Salary split cannot be negative." })
  basic!: number;

  @IsInt({ message: "Salary split must be whole numbers." })
  @Min(0, { message: "Salary split cannot be negative." })
  hra!: number;

  @IsInt({ message: "Salary split must be whole numbers." })
  @Min(0, { message: "Salary split cannot be negative." })
  other!: number;
}

export class UpdateWorkScheduleDto {
  @IsInt({ message: "Working days must be a whole number between 1 and 31." })
  @Min(1, { message: "Working days must be between 1 and 31." })
  @Max(31, { message: "Working days must be between 1 and 31." })
  workingDaysPerMonth!: number;

  @IsNumber({}, { message: "Hours per day must be between 1 and 24." })
  @Min(1, { message: "Hours per day must be between 1 and 24." })
  @Max(24, { message: "Hours per day must be between 1 and 24." })
  workHoursPerDay!: number;

  @ValidateNested()
  @Type(() => SalarySplitDto)
  salarySplit!: SalarySplitDto;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  officeInTime?: string;

  @IsOptional()
  @IsString()
  officeOutTime?: string;

  @IsOptional()
  @IsNumber({}, { message: "Maximum work hours must be between 1 and 24." })
  @Min(1)
  @Max(24)
  maxWorkHours?: number;
}
