import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PersonStatus, PersonType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { CacheService } from "../cache/cache.service";
import type { CreatePersonDto, ExitPersonDto, UpdatePersonDto, UploadDocumentDto } from "./dto/person.dto";

@Injectable()
export class PersonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly cache: CacheService,
  ) {}

  async list(
    tenantId: string,
    query?: { personType?: PersonType; departmentId?: string; status?: PersonStatus; search?: string },
  ) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const where: Prisma.PersonWhereInput = { tenantId };

      if (query?.personType) where.personType = query.personType;
      if (query?.departmentId) where.departmentId = query.departmentId;
      if (query?.status) where.status = query.status;
      if (query?.search) {
        const term = query.search.trim();
        where.OR = [
          { firstName: { contains: term, mode: "insensitive" } },
          { lastName: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
          { phone: { contains: term, mode: "insensitive" } },
        ];
      }

      return tx.person.findMany({
        where,
        include: {
          department: true,
          designation: true,
          manager: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: [{ status: "asc" }, { firstName: "asc" }],
      });
    });
  }

  async getById(tenantId: string, id: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const person = await tx.person.findFirst({
        where: { id, tenantId },
        include: {
          department: true,
          designation: true,
          manager: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          directReports: {
            select: { id: true, firstName: true, lastName: true, email: true, designation: true },
          },
          documents: {
            orderBy: { uploadedAt: "desc" },
          },
        },
      });

      if (!person) throw new NotFoundException("Person record not found");
      return person;
    });
  }

  async getByUserId(tenantId: string, userId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      return tx.person.findFirst({
        where: { userId, tenantId },
        include: { department: true, designation: true },
      });
    });
  }

  async create(tenantId: string, dto: CreatePersonDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      try {
        const person = await tx.person.create({
          data: {
            tenantId,
            personType: dto.personType,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            email: dto.email.toLowerCase().trim(),
            phone: dto.phone?.trim(),
            gender: dto.gender,
            dob: dto.dob ? new Date(dto.dob) : null,
            address: dto.address?.trim(),
            emergencyContact: dto.emergencyContact?.trim(),
            departmentId: dto.departmentId || null,
            designationId: dto.designationId || null,
            managerId: dto.managerId || null,
            joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : new Date(),
            userId: dto.userId || null,
          },
          include: {
            department: true,
            designation: true,
            manager: true,
          },
        });

        // Invalidate org structure cache
        await this.cache.del(`tenant:${tenantId}:org_structure`);
        return person;
      } catch (err: any) {
        if (err?.code === "P2002") {
          throw new ConflictException(`A person with email "${dto.email}" already exists.`);
        }
        throw err;
      }
    });
  }

  async update(tenantId: string, id: string, dto: UpdatePersonDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const existing = await tx.person.findFirst({ where: { id, tenantId } });
      if (!existing) throw new NotFoundException("Person record not found");

      // Prevent self-referencing hierarchy loop
      if (dto.managerId && dto.managerId === id) {
        throw new ConflictException("A person cannot be their own reporting manager.");
      }

      const updated = await tx.person.update({
        where: { id },
        data: {
          personType: dto.personType,
          status: dto.status,
          firstName: dto.firstName?.trim(),
          lastName: dto.lastName?.trim(),
          phone: dto.phone?.trim(),
          gender: dto.gender,
          dob: dto.dob ? new Date(dto.dob) : undefined,
          address: dto.address?.trim(),
          emergencyContact: dto.emergencyContact?.trim(),
          departmentId: dto.departmentId,
          designationId: dto.designationId,
          managerId: dto.managerId,
        },
        include: {
          department: true,
          designation: true,
          manager: true,
        },
      });

      return updated;
    });
  }

  async exit(tenantId: string, id: string, dto: ExitPersonDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const existing = await tx.person.findFirst({ where: { id, tenantId } });
      if (!existing) throw new NotFoundException("Person record not found");

      return tx.person.update({
        where: { id },
        data: {
          status: PersonStatus.EXITED,
          exitDate: new Date(dto.exitDate),
          exitReason: dto.exitReason.trim(),
        },
      });
    });
  }

  async uploadDocument(
    tenantId: string,
    personId: string,
    dto: UploadDocumentDto,
    file: { originalname: string; buffer: Buffer; mimetype: string; size: number },
  ) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const person = await tx.person.findFirst({ where: { id: personId, tenantId } });
      if (!person) throw new NotFoundException("Person record not found");

      const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileKey = `tenants/${tenantId}/persons/${personId}/${dto.category}/${Date.now()}-${cleanFileName}`;

      await this.storage.uploadFile(fileKey, file.buffer, file.mimetype);

      return tx.personDocument.create({
        data: {
          tenantId,
          personId,
          name: dto.name.trim() || file.originalname,
          fileKey,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          category: dto.category,
        },
      });
    });
  }

  async getDocumentUrl(tenantId: string, personId: string, documentId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const doc = await tx.personDocument.findFirst({ where: { id: documentId, personId, tenantId } });
      if (!doc) throw new NotFoundException("Document not found");

      const downloadUrl = await this.storage.getPresignedUrl(doc.fileKey, 900);
      return { ...doc, downloadUrl };
    });
  }

  async deleteDocument(tenantId: string, personId: string, documentId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const doc = await tx.personDocument.findFirst({ where: { id: documentId, personId, tenantId } });
      if (!doc) throw new NotFoundException("Document not found");

      await this.storage.deleteFile(doc.fileKey);
      await tx.personDocument.delete({ where: { id: documentId } });
      return { success: true };
    });
  }
}
