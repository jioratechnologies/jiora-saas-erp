import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SalaryComponentType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CacheService } from "../../cache/cache.service";
import type {
  AssignSalaryDto,
  CreateSalaryComponentDto,
  CreateSalaryStructureDto,
  RecordSalaryRevisionDto,
  UpdateSalaryComponentDto,
} from "../dto/salary.dto";

@Injectable()
export class SalaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ==========================================
  // Salary Components
  // ==========================================

  async listComponents(tenantId: string) {
    const cacheKey = `tenant:${tenantId}:salary_components`;
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      let components = await tx.salaryComponent.findMany({
        where: { tenantId },
        orderBy: [{ type: "asc" }, { code: "asc" }],
      });

      // Seed defaults if empty for tenant
      if (components.length === 0) {
        await tx.salaryComponent.createMany({
          data: [
            { tenantId, name: "Basic Salary", code: "BASIC", type: SalaryComponentType.EARNING, isTaxable: true, isStatutory: true },
            { tenantId, name: "House Rent Allowance (HRA)", code: "HRA", type: SalaryComponentType.EARNING, isTaxable: true, isStatutory: false },
            { tenantId, name: "Conveyance Allowance", code: "CONVEYANCE", type: SalaryComponentType.EARNING, isTaxable: false, isStatutory: false },
            { tenantId, name: "Special Allowance", code: "SPECIAL", type: SalaryComponentType.EARNING, isTaxable: true, isStatutory: false },
            { tenantId, name: "Provident Fund (PF)", code: "PF", type: SalaryComponentType.DEDUCTION, isTaxable: false, isStatutory: true },
            { tenantId, name: "Professional Tax (PT)", code: "PT", type: SalaryComponentType.DEDUCTION, isTaxable: false, isStatutory: true },
            { tenantId, name: "Tax Deducted at Source (TDS)", code: "TDS", type: SalaryComponentType.DEDUCTION, isTaxable: false, isStatutory: true },
          ],
        });
        components = await tx.salaryComponent.findMany({
          where: { tenantId },
          orderBy: [{ type: "asc" }, { code: "asc" }],
        });
      }

      await this.cache.set(cacheKey, components, 3600);
      return components;
    });
  }

  async createComponent(tenantId: string, dto: CreateSalaryComponentDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      try {
        const component = await tx.salaryComponent.create({
          data: {
            tenantId,
            name: dto.name.trim(),
            code: dto.code.trim().toUpperCase(),
            type: dto.type,
            isTaxable: dto.isTaxable ?? true,
            isStatutory: dto.isStatutory ?? false,
            description: dto.description?.trim(),
          },
        });
        await this.cache.del(`tenant:${tenantId}:salary_components`);
        return component;
      } catch (err: any) {
        if (err?.code === "P2002") {
          throw new ConflictException(`A salary component with code "${dto.code.toUpperCase()}" already exists.`);
        }
        throw err;
      }
    });
  }

  async updateComponent(tenantId: string, id: string, dto: UpdateSalaryComponentDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const existing = await tx.salaryComponent.findFirst({ where: { id, tenantId } });
      if (!existing) throw new NotFoundException("Salary component not found.");

      const updated = await tx.salaryComponent.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          type: dto.type,
          isTaxable: dto.isTaxable,
          isStatutory: dto.isStatutory,
          description: dto.description?.trim(),
        },
      });
      await this.cache.del(`tenant:${tenantId}:salary_components`);
      return updated;
    });
  }

  // ==========================================
  // Salary Structures
  // ==========================================

  async listStructures(tenantId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      return tx.salaryStructure.findMany({
        where: { tenantId },
        include: { _count: { select: { assignments: true } } },
        orderBy: { name: "asc" },
      });
    });
  }

  async createStructure(tenantId: string, dto: CreateSalaryStructureDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      try {
        return await tx.salaryStructure.create({
          data: {
            tenantId,
            name: dto.name.trim(),
            description: dto.description?.trim(),
            isActive: dto.isActive ?? true,
            items: (dto.items || []) as any,
          },
        });
      } catch (err: any) {
        if (err?.code === "P2002") {
          throw new ConflictException(`A salary structure named "${dto.name.trim()}" already exists.`);
        }
        throw err;
      }
    });
  }

  // ==========================================
  // Employee Salary Assignment
  // ==========================================

  async getAssignmentByPerson(tenantId: string, personId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      return tx.employeeSalaryAssignment.findFirst({
        where: { tenantId, personId },
        include: {
          salaryStructure: true,
          person: { select: { id: true, firstName: true, lastName: true, email: true, personType: true, designation: true, department: true } },
        },
      });
    });
  }

  async listAssignments(tenantId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      return tx.employeeSalaryAssignment.findMany({
        where: { tenantId },
        include: {
          salaryStructure: true,
          person: { select: { id: true, firstName: true, lastName: true, email: true, personType: true, designation: true, department: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    });
  }

  async assignSalary(tenantId: string, dto: AssignSalaryDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const person = await tx.person.findFirst({ where: { id: dto.personId, tenantId } });
      if (!person) throw new NotFoundException("Employee not found.");

      if (person.personType === "VOLUNTEER") {
        throw new BadRequestException("Salary cannot be assigned to volunteers. Volunteers are unpaid.");
      }

      const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();

      return tx.employeeSalaryAssignment.upsert({
        where: { personId: dto.personId },
        create: {
          tenantId,
          personId: dto.personId,
          salaryStructureId: dto.salaryStructureId,
          baseGross: dto.baseGross,
          ctc: dto.ctc ?? dto.baseGross * 12,
          customItems: (dto.customItems || []) as any,
          effectiveFrom,
          paymentMode: dto.paymentMode || "BANK_TRANSFER",
          bankAccount: dto.bankAccount || person.bankAccount,
          bankIfsc: dto.bankIfsc || person.bankIfsc,
          panNumber: dto.panNumber || person.panNumber,
        },
        update: {
          salaryStructureId: dto.salaryStructureId,
          baseGross: dto.baseGross,
          ctc: dto.ctc ?? dto.baseGross * 12,
          customItems: (dto.customItems || []) as any,
          effectiveFrom,
          paymentMode: dto.paymentMode || "BANK_TRANSFER",
          bankAccount: dto.bankAccount || person.bankAccount,
          bankIfsc: dto.bankIfsc || person.bankIfsc,
          panNumber: dto.panNumber || person.panNumber,
        },
        include: {
          salaryStructure: true,
          person: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
    });
  }

  // ==========================================
  // Salary Revision & Appraisal History
  // ==========================================

  async recordRevision(tenantId: string, recordedByUserId: string, dto: RecordSalaryRevisionDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const person = await tx.person.findFirst({
        where: { id: dto.personId, tenantId },
        include: { salaryAssignment: true, designation: true },
      });
      if (!person) throw new NotFoundException("Employee not found.");

      const oldGross = person.salaryAssignment?.baseGross ?? 0;
      const oldDesignationId = person.designationId;

      const revision = await tx.salaryRevision.create({
        data: {
          tenantId,
          personId: dto.personId,
          oldGross,
          newGross: dto.newGross,
          oldDesignationId,
          newDesignationId: dto.newDesignationId || oldDesignationId,
          effectiveDate: new Date(dto.effectiveDate),
          remarks: dto.remarks?.trim(),
          promotedBy: recordedByUserId,
        },
      });

      // Update active assignment
      await tx.employeeSalaryAssignment.upsert({
        where: { personId: dto.personId },
        create: {
          tenantId,
          personId: dto.personId,
          baseGross: dto.newGross,
          ctc: dto.newGross * 12,
          effectiveFrom: new Date(dto.effectiveDate),
        },
        update: {
          baseGross: dto.newGross,
          ctc: dto.newGross * 12,
          effectiveFrom: new Date(dto.effectiveDate),
        },
      });

      // Update designation if specified
      if (dto.newDesignationId && dto.newDesignationId !== oldDesignationId) {
        await tx.person.update({
          where: { id: dto.personId },
          data: { designationId: dto.newDesignationId },
        });
      }

      return revision;
    });
  }

  async listRevisions(tenantId: string, personId?: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const where: Prisma.SalaryRevisionWhereInput = { tenantId };
      if (personId) where.personId = personId;

      return tx.salaryRevision.findMany({
        where,
        include: {
          person: { select: { id: true, firstName: true, lastName: true, email: true, designation: true } },
        },
        orderBy: { effectiveDate: "desc" },
      });
    });
  }
}
