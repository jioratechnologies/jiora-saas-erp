import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsNotEmpty, IsNumber, Max, Min, IsOptional, IsString, Matches, MaxLength, ValidateNested, registerDecorator, ValidateIf } from "class-validator";
import { DocumentCategory, PersonType } from "@prisma/client";

export const PHONE_REGEX = /^\+?[0-9 ]{8,15}$/;
export const PHONE_MESSAGE = "Please enter a valid phone number (8 to 15 digits, optional leading +).";
export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
const GENDER_MESSAGE = "Please select a gender (Male, Female or Other).";
const upperTrim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toUpperCase() : value);

/** Date string must not be in the future. */
export function IsNotFutureDate() {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: "isNotFutureDate",
      target: target.constructor,
      propertyName,
      options: { message: "Date of birth cannot be in the future." },
      validator: {
        validate: (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v)) && Date.parse(v) <= Date.now(),
      },
    });
}

export class CreatePersonDto {
  @ApiPropertyOptional({ description: "Create a login for this person and email an invitation" })
  @IsOptional()
  @IsBoolean()
  sendInvite?: boolean;

  @ApiPropertyOptional({ example: 45000, description: "Monthly gross salary (INR). Applied only if the caller may manage salaries." })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: "Please enter a valid monthly salary." })
  @Min(0.01, { message: "Please enter a valid monthly salary." })
  @Max(10000000, { message: "Monthly salary cannot be more than 1,00,00,000." })
  monthlyGross?: number;

  @ApiProperty({ enum: PersonType, default: PersonType.EMPLOYEE })
  @IsEnum(PersonType)
  personType!: PersonType;

  @ApiProperty({ example: "Ramesh" })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: "Kumar" })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: "ramesh@sachhisaheli.org" })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: "Kumar" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @ApiProperty({ example: "+91 9876543210" })
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone!: string;

  @ApiPropertyOptional({ example: "+91 9876543211" })
  // Blank means "no alternate number"; only validate when a value is given.
  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== "")
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  altPhone?: string;

  @ApiProperty({ enum: GENDERS, example: "MALE" })
  @Transform(upperTrim)
  @IsIn(GENDERS, { message: GENDER_MESSAGE })
  gender!: string;

  @ApiProperty({ example: "1995-05-15" })
  @IsDateString()
  @IsNotFutureDate()
  dob!: string;

  @ApiPropertyOptional({ example: "New Delhi, India" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: "Flat 402, Sunshine Apts, Saket, New Delhi" })
  @IsOptional()
  @IsString()
  currentAddress?: string;

  @ApiPropertyOptional({ example: "House 12, Main Street, Varanasi, UP" })
  @IsOptional()
  @IsString()
  permanentAddress?: string;

  @ApiPropertyOptional({ example: "+91 9876543211 (Brother)" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  emergencyContact?: string;

  @ApiPropertyOptional({ example: "uuid-dept" })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ example: "uuid-desig" })
  @IsOptional()
  @IsString()
  designationId?: string;

  @ApiPropertyOptional({ example: "uuid-manager" })
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiPropertyOptional({ example: "2026-01-01" })
  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @ApiPropertyOptional({ example: "uuid-user-if-linked" })
  @IsOptional()
  @IsString()
  userId?: string;
}

export class UpdatePersonDto {
  @ApiPropertyOptional({ enum: PersonType })
  @IsOptional()
  @IsEnum(PersonType)
  personType?: PersonType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone?: string;

  @ApiPropertyOptional()
  // Blank means "no alternate number"; only validate when a value is given.
  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== "")
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  altPhone?: string;

  @ApiPropertyOptional({ enum: GENDERS })
  @IsOptional()
  @Transform(upperTrim)
  @IsIn(GENDERS, { message: GENDER_MESSAGE })
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  @IsNotFutureDate()
  dob?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currentAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  permanentAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  emergencyContact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  designationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class ExitPersonDto {
  @ApiProperty({ example: "2026-10-31" })
  @IsDateString()
  exitDate!: string;

  @ApiProperty({ example: "Relocation to another city" })
  @IsString()
  @IsNotEmpty()
  exitReason!: string;

  @ApiPropertyOptional({ description: "Person who takes over the direct reports. Reports are left without a manager if omitted." })
  @IsOptional()
  @IsString()
  reassignReportsTo?: string;
}

export class UploadDocumentDto {
  @ApiProperty({ example: "Aadhaar Card" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: DocumentCategory, default: DocumentCategory.KYC })
  @IsEnum(DocumentCategory)
  category!: DocumentCategory;

  @ApiPropertyOptional({ example: "1234-5678-9012" })
  @IsOptional()
  @IsString()
  documentNumber?: string;
}

export class ReviewDocumentDto {
  @ApiProperty({ enum: ["APPROVED", "REJECTED"] })
  @IsEnum(["APPROVED", "REJECTED"])
  status!: "APPROVED" | "REJECTED";

  @ApiPropertyOptional({ example: "Document image is blurred, please upload a clear copy" })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class BulkImportItemDto {
  @ApiProperty({ example: "Ramesh" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: "Kumar" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ example: "ramesh@sachhisaheli.org" })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional({ example: "Kumar" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @ApiProperty({ example: "+91 9876543210" })
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone!: string;

  @ApiPropertyOptional({ example: "+91 9876543211" })
  // Blank means "no alternate number"; only validate when a value is given.
  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== "")
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  altPhone?: string;

  @ApiProperty({ enum: GENDERS, example: "MALE" })
  @Transform(upperTrim)
  @IsIn(GENDERS, { message: GENDER_MESSAGE })
  gender!: string;

  @ApiProperty({ example: "1995-05-15" })
  @IsDateString()
  @IsNotFutureDate()
  dob!: string;

  @ApiPropertyOptional({ enum: PersonType, default: PersonType.EMPLOYEE })
  @IsOptional()
  @IsEnum(PersonType)
  personType?: PersonType;

  @ApiPropertyOptional({ example: "Programmes" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  departmentName?: string;

  @ApiPropertyOptional({ example: "Project Coordinator" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  designationName?: string;

  @ApiPropertyOptional({ example: "2026-01-15" })
  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @ApiPropertyOptional({ example: 45000, description: "Monthly gross salary (INR). Applied only if the caller may manage salaries." })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: "Please enter a valid monthly salary." })
  @Min(0.01, { message: "Please enter a valid monthly salary." })
  @Max(10000000, { message: "Monthly salary cannot be more than 1,00,00,000." })
  monthlyGross?: number;
}

export class BulkImportPersonsDto {
  @ApiPropertyOptional({ description: "Create logins for imported people and email invitations" })
  @IsOptional()
  @IsBoolean()
  sendInvites?: boolean;

  @ApiProperty({ type: [BulkImportItemDto], description: "1 to 500 rows" })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500, { message: "You can import at most 500 people at a time." })
  @ValidateNested({ each: true })
  @Type(() => BulkImportItemDto)
  records!: BulkImportItemDto[];
}

export class UpdateExitChecklistDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  assetReturn?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  idCardReturn?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  knowledgeHandover?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  financeClearance?: boolean;

  @ApiPropertyOptional({ example: "All office keys, laptop and project folders handed over to Programme Director." })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isFinalized?: boolean;

  @ApiPropertyOptional({ example: "2026-10-31", description: "Required to finalize unless already recorded" })
  @IsOptional()
  @IsDateString()
  exitDate?: string;

  @ApiPropertyOptional({ description: "Required to finalize unless already recorded" })
  @IsOptional()
  @IsString()
  exitReason?: string;

  @ApiPropertyOptional({ description: "Person who takes over the direct reports on finalize" })
  @IsOptional()
  @IsString()
  reassignReportsTo?: string;
}
