import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ZitadelAuthGuard } from "./zitadel-auth.guard";
import { CurrentUser } from "./current-user.decorator";
import type { AuthContext } from "./auth-context";
import { IsDateString, IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { Transform } from "class-transformer";
import { GENDERS, IsNotFutureDate } from "../hr/dto/person.dto";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { DOCUMENT_UPLOAD, IMAGE_UPLOAD } from "../common/upload-rules";

export class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(160) displayName?: string;
  @IsOptional() @IsString() @MaxLength(100) middleName?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value))
  @IsIn(GENDERS, { message: "Please select a gender (Male, Female or Other)." })
  gender?: string;
  @IsOptional() @IsDateString() @IsNotFutureDate() dob?: string;
  @IsOptional() @IsString() @Matches(/^\+?[0-9 ]{8,15}$/, { message: "Please enter a valid phone number (8 to 15 digits, optional leading +)." }) altPhone?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(500) currentAddress?: string;
  @IsOptional() @IsString() @MaxLength(500) permanentAddress?: string;
  @IsOptional() @IsString() @MaxLength(300) emergencyContact?: string;
}

export class UploadKycDocumentDto {
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(80) documentNumber?: string;
}

@ApiTags("profile")
@ApiBearerAuth()
@UseGuards(ZitadelAuthGuard)
@Controller("auth/profile")
export class ProfileController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get current logged-in user profile, linked person, and KYC documents" })
  async getProfile(@CurrentUser() auth: AuthContext) {
    if (!auth.tenantId) {
      // Platform admin
      return this.prisma.runInTenantContext(
        { tenantId: null, isPlatformContext: true },
        async (tx) => {
          const user = await tx.user.findUnique({
            where: { id: auth.userId },
            include: {
              roles: { include: { role: true } },
            },
          });
          return {
            user: user
              ? {
                  id: user.id,
                  email: user.email,
                  displayName: user.displayName,
                  phone: user.phone,
                  avatarUrl: user.avatarUrl,
                  department: null,
                  designation: null,
                  roles: user.roles.map((r) => r.role.name),
                }
              : null,
            person: null,
            documents: [],
          };
        },
      );
    }

    return this.prisma.runInTenantContext(
      { tenantId: auth.tenantId, isPlatformContext: false },
      async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: auth.userId },
          include: {
            department: true,
            designation: true,
            roles: { include: { role: true } },
          },
        });

        if (!user) throw new NotFoundException("User record not found");

        // Try to find linked person by userId or by matching email
        let person = await tx.person.findFirst({
          where: { tenantId: auth.tenantId!, userId: user.id },
          include: {
            department: true,
            designation: true,
            documents: {
              orderBy: { uploadedAt: "desc" },
            },
          },
        });

        if (!person) {
          // Check by email
          const matchingPerson = await tx.person.findFirst({
            where: { tenantId: auth.tenantId!, email: user.email },
          });

          if (matchingPerson) {
            person = await tx.person.update({
              where: { id: matchingPerson.id },
              data: { userId: user.id },
              include: {
                department: true,
                designation: true,
                documents: {
                  orderBy: { uploadedAt: "desc" },
                },
              },
            });
          }
        }

        return {
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            phone: user.phone,
            avatarUrl: user.avatarUrl,
            department: user.department?.name,
            designation: user.designation?.name,
            roles: user.roles.map((r) => r.role.name),
          },
          person: person
            ? {
                id: person.id,
                firstName: person.firstName,
                middleName: person.middleName,
                lastName: person.lastName,
                email: person.email,
                phone: person.phone,
                altPhone: person.altPhone,
                gender: person.gender,
                dob: person.dob,
                address: person.address,
                currentAddress: person.currentAddress || person.address,
                permanentAddress: person.permanentAddress || person.currentAddress || person.address,
                emergencyContact: person.emergencyContact,
                status: person.status,
                personType: person.personType,
                avatarUrl: person.avatarUrl,
                department: person.department?.name,
                designation: person.designation?.name,
                joiningDate: person.joiningDate,
              }
            : null,
          documents: person?.documents || [],
        };
      },
    );
  }

  @Patch()
  @ApiOperation({ summary: "Update current user profile info" })
  async updateProfile(
    @CurrentUser() auth: AuthContext,
    @Body() dto: UpdateProfileDto,
  ) {
    if (!auth.tenantId) {
      if (dto.displayName || dto.phone) {
        await this.prisma.runInTenantContext(
          { tenantId: null, isPlatformContext: true },
          async (tx) => {
            await tx.user.update({
              where: { id: auth.userId },
              data: {
                displayName: dto.displayName,
                phone: dto.phone,
              },
            });
          },
        );
      }
      return { success: true };
    }

    return this.prisma.runInTenantContext(
      { tenantId: auth.tenantId, isPlatformContext: false },
      async (tx) => {
        const user = await tx.user.update({
          where: { id: auth.userId },
          data: {
            displayName: dto.displayName,
            phone: dto.phone,
          },
        });

        // Also update linked person
        let person = await tx.person.findFirst({
          where: { tenantId: auth.tenantId!, userId: user.id },
        });

        if (!person) {
          person = await tx.person.findFirst({
            where: { tenantId: auth.tenantId!, email: user.email },
          });
        }

        if (person) {
          // DB columns stay nullable for legacy rows, so the saved profile must end up complete.
          const complete = (dto.phone || person.phone) && (dto.gender || person.gender) && (dto.dob || person.dob);
          if (!complete) throw new BadRequestException("Please check the highlighted fields and try again.");

          const names = dto.displayName ? dto.displayName.trim().split(" ") : null;
          const firstName = names ? names[0] : undefined;
          const lastName = names && names.length > 1 ? names.slice(1).join(" ") : undefined;

          await tx.person.update({
            where: { id: person.id },
            data: {
              ...(firstName ? { firstName } : {}),
              ...(lastName !== undefined ? { lastName } : {}),
              ...(dto.phone ? { phone: dto.phone } : {}),
              ...(dto.middleName !== undefined ? { middleName: dto.middleName.trim() || null } : {}),
              ...(dto.gender ? { gender: dto.gender } : {}),
              ...(dto.dob ? { dob: new Date(dto.dob) } : {}),
              ...(dto.altPhone !== undefined ? { altPhone: dto.altPhone.trim() || null } : {}),
              ...(dto.currentAddress !== undefined ? { currentAddress: dto.currentAddress, address: dto.currentAddress } : (dto.address !== undefined ? { address: dto.address } : {})),
              ...(dto.permanentAddress !== undefined ? { permanentAddress: dto.permanentAddress } : {}),
              ...(dto.emergencyContact !== undefined ? { emergencyContact: dto.emergencyContact } : {}),
            },
          });
        }

        return { success: true };
      },
    );
  }

  @Post("avatar")
  @UseInterceptors(FileInterceptor("file", IMAGE_UPLOAD))
  @ApiOperation({ summary: "Upload profile picture for current user" })
  async uploadAvatar(
    @CurrentUser() auth: AuthContext,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No image file provided");

    const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileKey = `tenants/${auth.tenantId || "platform"}/avatars/${auth.userId}-${Date.now()}-${cleanFileName}`;

    await this.storage.uploadFile(fileKey, file.buffer, file.mimetype);
    const avatarUrl = await this.storage.getPresignedUrl(fileKey, 604800); // 7 days

    return this.prisma.runInTenantContext(
      { tenantId: auth.tenantId, isPlatformContext: auth.isPlatformContext },
      async (tx) => {
        const user = await tx.user.update({
          where: { id: auth.userId },
          data: { avatarUrl },
        });

        if (auth.tenantId) {
          const person = await tx.person.findFirst({
            where: {
              tenantId: auth.tenantId,
              OR: [{ userId: auth.userId }, { email: user.email }],
            },
          });

          if (person) {
            await tx.person.update({
              where: { id: person.id },
              data: { avatarUrl },
            });
          }
        }

        return { avatarUrl };
      },
    );
  }

  @Post("kyc")
  @UseInterceptors(FileInterceptor("file", DOCUMENT_UPLOAD))
  @ApiOperation({ summary: "Upload KYC document for current user" })
  async uploadKycDocument(
    @CurrentUser() auth: AuthContext,
    @Body() body: UploadKycDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!auth.tenantId) throw new BadRequestException("Tenant required for KYC document upload");
    if (!file) throw new BadRequestException("No document file provided");
    if (!body.name || !body.name.trim()) throw new BadRequestException("Document title is required");

    return this.prisma.runInTenantContext(
      { tenantId: auth.tenantId, isPlatformContext: false },
      async (tx) => {
        const user = await tx.user.findUnique({ where: { id: auth.userId } });
        if (!user) throw new NotFoundException("User not found");

        let person = await tx.person.findFirst({
          where: { tenantId: auth.tenantId!, OR: [{ userId: user.id }, { email: user.email }] },
        });

        if (!person) {
          const names = user.displayName.trim().split(" ");
          const firstName = names[0] || "User";
          const lastName = names.slice(1).join(" ") || "";
          person = await tx.person.create({
            data: {
              tenantId: auth.tenantId!,
              userId: user.id,
              firstName,
              lastName,
              email: user.email,
              phone: user.phone,
              avatarUrl: user.avatarUrl,
            },
          });
        } else if (!person.userId) {
          person = await tx.person.update({
            where: { id: person.id },
            data: { userId: user.id },
          });
        }

        const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileKey = `tenants/${auth.tenantId}/persons/${person.id}/KYC/${Date.now()}-${cleanFileName}`;

        await this.storage.uploadFile(fileKey, file.buffer, file.mimetype);

        const doc = await tx.personDocument.create({
          data: {
            tenantId: auth.tenantId!,
            personId: person.id,
            name: body.name.trim(),
            category: "KYC",
            documentNumber: body.documentNumber?.trim() || null,
            status: "PENDING",
            fileKey,
            mimeType: file.mimetype,
            sizeBytes: file.size,
          },
        });

        const downloadUrl = await this.storage.getPresignedUrl(doc.fileKey, 900);
        return { ...doc, downloadUrl, url: downloadUrl };
      },
    );
  }

  @Delete("kyc/:docId")
  @ApiOperation({ summary: "Delete KYC document unless approved" })
  async deleteKycDocument(
    @CurrentUser() auth: AuthContext,
    @Param("docId") docId: string,
  ) {
    if (!auth.tenantId) throw new BadRequestException("Tenant required");

    return this.prisma.runInTenantContext(
      { tenantId: auth.tenantId, isPlatformContext: false },
      async (tx) => {
        const user = await tx.user.findUnique({ where: { id: auth.userId } });
        if (!user) throw new NotFoundException("User not found");

        const person = await tx.person.findFirst({
          where: { tenantId: auth.tenantId!, OR: [{ userId: user.id }, { email: user.email }] },
        });
        if (!person) throw new NotFoundException("Person record not found");

        const doc = await tx.personDocument.findFirst({
          where: { id: docId, personId: person.id, tenantId: auth.tenantId! },
        });
        if (!doc) throw new NotFoundException("Document not found");

        if (doc.status === "APPROVED") {
          throw new BadRequestException("Approved KYC documents are verified and cannot be deleted.");
        }

        await this.storage.deleteFile(doc.fileKey);
        await tx.personDocument.delete({ where: { id: docId } });
        return { success: true };
      },
    );
  }

  @Get("documents/:docId/url")
  @ApiOperation({ summary: "Get download link for user's own document" })
  async getDocumentUrl(
    @CurrentUser() auth: AuthContext,
    @Param("docId") docId: string,
  ) {
    if (!auth.tenantId) throw new BadRequestException("Tenant required");

    return this.prisma.runInTenantContext(
      { tenantId: auth.tenantId, isPlatformContext: false },
      async (tx) => {
        const user = await tx.user.findUnique({ where: { id: auth.userId } });
        if (!user) throw new NotFoundException("User not found");

        const person = await tx.person.findFirst({
          where: { tenantId: auth.tenantId!, OR: [{ userId: user.id }, { email: user.email }] },
        });
        if (!person) throw new NotFoundException("Person record not found");

        const doc = await tx.personDocument.findFirst({
          where: { id: docId, personId: person.id, tenantId: auth.tenantId! },
        });
        if (!doc) throw new NotFoundException("Document not found");

        const downloadUrl = await this.storage.getPresignedUrl(doc.fileKey, 900, doc.name);
        const previewUrl = await this.storage.getPresignedUrl(doc.fileKey, 900, undefined, {
          inline: true,
          contentType: doc.mimeType,
        });
        return { ...doc, downloadUrl, url: previewUrl };
      },
    );
  }
}
