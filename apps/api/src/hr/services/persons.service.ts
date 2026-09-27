import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PersonStatus, PersonType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { StorageService } from "../../storage/storage.service";
import { CacheService } from "../../cache/cache.service";
import type { CreatePersonDto, ExitPersonDto, UpdatePersonDto, UploadDocumentDto, UpdateExitChecklistDto, BulkImportPersonsDto } from "../dto/person.dto";

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
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: true,
              designation: true,
            },
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
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: true,
              designation: true,
            },
          },
          directReports: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              designation: true,
              department: true,
              status: true,
            },
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
            whatsapp: dto.whatsapp?.trim() || dto.phone?.trim() || null,
            gender: dto.gender,
            dob: dto.dob ? new Date(dto.dob) : null,
            address: dto.currentAddress?.trim() || dto.address?.trim() || null,
            currentAddress: dto.currentAddress?.trim() || dto.address?.trim() || null,
            permanentAddress: dto.permanentAddress?.trim() || dto.currentAddress?.trim() || dto.address?.trim() || null,
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
          whatsapp: dto.whatsapp !== undefined ? (dto.whatsapp?.trim() || null) : undefined,
          gender: dto.gender,
          dob: dto.dob ? new Date(dto.dob) : undefined,
          address: dto.currentAddress !== undefined ? (dto.currentAddress?.trim() || null) : (dto.address?.trim() || undefined),
          currentAddress: dto.currentAddress !== undefined ? (dto.currentAddress?.trim() || null) : undefined,
          permanentAddress: dto.permanentAddress !== undefined ? (dto.permanentAddress?.trim() || null) : undefined,
          emergencyContact: dto.emergencyContact?.trim(),
          departmentId: dto.departmentId !== undefined ? (dto.departmentId || null) : undefined,
          designationId: dto.designationId !== undefined ? (dto.designationId || null) : undefined,
          managerId: dto.managerId !== undefined ? (dto.managerId || null) : undefined,
        },
        include: {
          department: true,
          designation: true,
          manager: {
            include: { department: true, designation: true },
          },
        },
      });

      // Invalidate org structure cache
      await this.cache.del(`tenant:${tenantId}:org_structure`);
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
          documentNumber: dto.documentNumber?.trim() || null,
          status: "PENDING",
        },
      });
    });
  }

  async getDocumentUrl(tenantId: string, personId: string, documentId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const doc = await tx.personDocument.findFirst({ where: { id: documentId, personId, tenantId } });
      if (!doc) throw new NotFoundException("Document not found");

      const downloadUrl = await this.storage.getPresignedUrl(doc.fileKey, 900, doc.name);
      return { ...doc, downloadUrl, url: downloadUrl };
    });
  }

  async reviewDocument(
    tenantId: string,
    personId: string,
    documentId: string,
    reviewerId: string,
    dto: { status: "APPROVED" | "REJECTED"; rejectionReason?: string },
  ) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const doc = await tx.personDocument.findFirst({ where: { id: documentId, personId, tenantId } });
      if (!doc) throw new NotFoundException("Document not found");

      return tx.personDocument.update({
        where: { id: documentId },
        data: {
          status: dto.status,
          rejectionReason: dto.status === "REJECTED" ? (dto.rejectionReason?.trim() || "Rejected by HR") : null,
          verifiedAt: new Date(),
          verifiedBy: reviewerId,
        },
      });
    });
  }

  async deleteDocument(tenantId: string, personId: string, documentId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const doc = await tx.personDocument.findFirst({ where: { id: documentId, personId, tenantId } });
      if (!doc) throw new NotFoundException("Document not found");

      if (doc.status === "APPROVED") {
        throw new BadRequestException("Approved KYC and compliance documents cannot be deleted.");
      }

      await this.storage.deleteFile(doc.fileKey);
      await tx.personDocument.delete({ where: { id: documentId } });
      return { success: true };
    });
  }

  async updateExitChecklist(tenantId: string, personId: string, dto: UpdateExitChecklistDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const person = await tx.person.findFirst({ where: { id: personId, tenantId } });
      if (!person) throw new NotFoundException("Person not found");

      const existingChecklist = (person.exitChecklist as any) || {};
      const updatedChecklist = {
        ...existingChecklist,
        assetReturn: dto.assetReturn ?? existingChecklist.assetReturn ?? false,
        idCardReturn: dto.idCardReturn ?? existingChecklist.idCardReturn ?? false,
        knowledgeHandover: dto.knowledgeHandover ?? existingChecklist.knowledgeHandover ?? false,
        financeClearance: dto.financeClearance ?? existingChecklist.financeClearance ?? false,
        notes: dto.notes !== undefined ? dto.notes : (existingChecklist.notes ?? ""),
        completedAt: dto.isFinalized ? new Date().toISOString() : existingChecklist.completedAt,
      };

      const updateData: any = { exitChecklist: updatedChecklist };
      if (dto.isFinalized) {
        updateData.status = "EXITED";
      }

      return tx.person.update({
        where: { id: personId },
        data: updateData,
        include: { department: true, designation: true },
      });
    });
  }

  async bulkImport(tenantId: string, dto: BulkImportPersonsDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const departments = await tx.department.findMany({ where: { tenantId } });
      const designations = await tx.designation.findMany({ where: { tenantId } });

      const deptMap = new Map(departments.map((d) => [d.name.toLowerCase().trim(), d.id]));
      const desigMap = new Map(designations.map((d) => [d.name.toLowerCase().trim(), d.id]));

      const created: any[] = [];
      const errors: { email: string; reason: string }[] = [];

      for (const item of dto.records) {
        const cleanEmail = item.email.toLowerCase().trim();
        const existing = await tx.person.findUnique({
          where: { tenantId_email: { tenantId, email: cleanEmail } },
        });

        if (existing) {
          errors.push({ email: cleanEmail, reason: "A person with this email already exists" });
          continue;
        }

        const departmentId = item.departmentName ? deptMap.get(item.departmentName.toLowerCase().trim()) || null : null;
        const designationId = item.designationName ? desigMap.get(item.designationName.toLowerCase().trim()) || null : null;

        const person = await tx.person.create({
          data: {
            tenantId,
            personType: item.personType || "EMPLOYEE",
            status: "ACTIVE",
            firstName: item.firstName.trim(),
            lastName: item.lastName.trim(),
            email: cleanEmail,
            phone: item.phone?.trim() || null,
            departmentId,
            designationId,
            joiningDate: item.joiningDate ? new Date(item.joiningDate) : new Date(),
          },
          include: { department: true, designation: true },
        });
        created.push(person);
      }

      return {
        total: dto.records.length,
        importedCount: created.length,
        failedCount: errors.length,
        created,
        errors,
      };
    });
  }
}
