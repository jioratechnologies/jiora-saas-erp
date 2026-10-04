import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SalaryComponentType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CacheService } from "../../cache/cache.service";
import { invalidateRef } from "../../cache/ref-cache";
import { AuthzCacheService } from "../../auth/authz-cache.service";
import { RbacService, type DesignationCaller } from "../../rbac/rbac.service";
import type {
  AssignSalaryDto,
  CreateSalaryComponentDto,
  CreateSalaryStructureDto,
  RecordSalaryRevisionDto,
  UpdateSalaryComponentDto,
} from "../dto/salary.dto";

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
import { maskLast4 } from "./payroll-calc";
const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class SalaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly rbac: RbacService,
    private readonly authzCache: AuthzCacheService,
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
          person: { select: { id: true, firstName: true, middleName: true, lastName: true, email: true, personType: true, designation: true, department: true } },
        },
      });
    });
  }

  async listAssignments(tenantId: string, canViewSensitive = false) {
    const rows = await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      return tx.employeeSalaryAssignment.findMany({
        where: { tenantId },
        include: {
          salaryStructure: true,
          person: { select: { id: true, firstName: true, middleName: true, lastName: true, email: true, personType: true, designation: true, department: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    });
    return canViewSensitive ? rows : rows.map((r) => ({ ...r, bankAccount: maskLast4(r.bankAccount), panNumber: maskLast4(r.panNumber) }));
  }

  async getSettings(tenantId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const t = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { workingDaysPerMonth: true, workHoursPerDay: true, salarySplit: true },
      });
      if (!t) throw new NotFoundException("The requested item could not be found.");
      return t;
    });
  }

  async listStaff(tenantId: string, canViewSensitive = false) {
    const rows = await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      return tx.person.findMany({
        where: { tenantId, personType: { not: "VOLUNTEER" }, status: "ACTIVE" },
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          email: true,
          designation: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          salaryAssignment: {
            select: { baseGross: true, ctc: true, paymentMode: true, bankAccount: true, bankIfsc: true, panNumber: true, effectiveFrom: true },
          },
        },
        orderBy: { firstName: "asc" },
      });
    });
    if (canViewSensitive) return rows;
    return rows.map((p) => ({
      ...p,
      salaryAssignment: p.salaryAssignment
        ? { ...p.salaryAssignment, bankAccount: maskLast4(p.salaryAssignment.bankAccount), panNumber: maskLast4(p.salaryAssignment.panNumber) }
        : p.salaryAssignment,
    }));
  }

  async assignSalary(tenantId: string, dto: AssignSalaryDto, recordedByUserId?: string) {
    const baseGross = round2(dto.baseGross);
    if (!(baseGross > 0)) throw new BadRequestException("Please enter a valid monthly salary.");
    const ctc = round2(dto.ctc ?? baseGross * 12);
    const bankAccount = dto.bankAccount?.trim() || null;
    const bankIfsc = dto.bankIfsc?.trim().toUpperCase() || null;
    const panNumber = dto.panNumber?.trim().toUpperCase() || null;
    if (bankIfsc && !IFSC_RE.test(bankIfsc)) throw new BadRequestException("Please enter a valid IFSC code (for example HDFC0001234).");
    if (panNumber && !PAN_RE.test(panNumber)) throw new BadRequestException("Please enter a valid PAN number (for example ABCDE1234F).");
    if (bankAccount && !/^[0-9]{6,20}$/.test(bankAccount)) throw new BadRequestException("Please enter a valid bank account number.");

    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const person = await tx.person.findFirst({ where: { id: dto.personId, tenantId } });
      if (!person) throw new NotFoundException("The requested item could not be found.");

      if (person.personType === "VOLUNTEER") {
        throw new BadRequestException("Salary cannot be assigned to volunteers. Volunteers are unpaid.");
      }

      const existing = await tx.employeeSalaryAssignment.findUnique({ where: { personId: dto.personId } });
      const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();
      const data = {
        baseGross,
        ctc,
        effectiveFrom,
        paymentMode: dto.paymentMode || "BANK_TRANSFER",
        bankAccount,
        bankIfsc,
        panNumber,
      };

      const saved = await tx.employeeSalaryAssignment.upsert({
        where: { personId: dto.personId },
        create: { tenantId, personId: dto.personId, ...data },
        update: data,
        include: {
          person: { select: { id: true, firstName: true, middleName: true, lastName: true, email: true } },
        },
      });

      if (!existing || existing.baseGross !== baseGross) {
        await tx.salaryRevision.create({
          data: {
            tenantId,
            personId: dto.personId,
            oldGross: existing ? existing.baseGross : null,
            newGross: baseGross,
            oldDesignationId: person.designationId,
            newDesignationId: person.designationId,
            effectiveDate: effectiveFrom,
            remarks: existing ? "Salary updated" : "Initial salary",
            promotedBy: recordedByUserId,
          },
        });
      }
      return saved;
    });
  }

  // ==========================================
  // Salary Revision & Appraisal History
  // ==========================================

  async recordRevision(tenantId: string, recordedByUserId: string, dto: RecordSalaryRevisionDto, caller: DesignationCaller) {
    const result = await this.recordRevisionInTx(tenantId, recordedByUserId, dto, caller);
    if (dto.newDesignationId) {
      // A designation change alters the person's permissions and the cached lists that count people per designation.
      await Promise.all([
        this.authzCache.invalidateTenantAuthz(tenantId),
        invalidateRef(this.cache, tenantId, "departments", "designations"),
      ]);
    }
    return result;
  }

  private async recordRevisionInTx(tenantId: string, recordedByUserId: string, dto: RecordSalaryRevisionDto, caller: DesignationCaller) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const person = await tx.person.findFirst({
        where: { id: dto.personId, tenantId },
        include: { salaryAssignment: true, designation: true },
      });
      if (!person) throw new NotFoundException("Employee not found.");

      const oldGross = person.salaryAssignment?.baseGross ?? 0;
      let newGross: number;
      if (typeof dto.incrementAmount === "number") newGross = round2(oldGross + dto.incrementAmount);
      else if (typeof dto.newGross === "number") newGross = round2(dto.newGross);
      else throw new BadRequestException("Please enter the increment amount.");
      if (!(newGross > 0)) throw new BadRequestException("The new salary must be greater than zero.");
      const oldDesignationId = person.designationId;
      if (dto.newDesignationId && dto.newDesignationId !== oldDesignationId) {
        await this.rbac.assertCanAssignDesignation(tx, tenantId, dto.newDesignationId, caller, person.userId);
      }

      const revision = await tx.salaryRevision.create({
        data: {
          tenantId,
          personId: dto.personId,
          oldGross,
          newGross,
          oldDesignationId,
          newDesignationId: dto.newDesignationId || oldDesignationId,
          effectiveDate: new Date(dto.effectiveDate),
          remarks: dto.remarks?.trim(),
          promotedBy: recordedByUserId,
        },
      });

      // A future-dated revision is only stored; payroll applies it from its effective date.
      // A current/past revision updates the active assignment now (effectiveFrom is the assignment start, left untouched).
      const effective = new Date(dto.effectiveDate);
      const now = new Date();
      const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const isFuture = effective > todayUtc;
      if (!isFuture || !person.salaryAssignment) {
        await tx.employeeSalaryAssignment.upsert({
          where: { personId: dto.personId },
          create: {
            tenantId,
            personId: dto.personId,
            baseGross: newGross,
            ctc: newGross * 12,
            effectiveFrom: effective,
          },
          update: {
            baseGross: newGross,
            ctc: newGross * 12,
          },
        });
      }

      // Update designation if specified
      if (dto.newDesignationId && dto.newDesignationId !== oldDesignationId) {
        await tx.person.update({
          where: { id: dto.personId },
          data: { designationId: dto.newDesignationId },
        });
      }

      return { ...revision, oldGross, incrementAmount: round2(newGross - oldGross), newGross };
    });
  }

  async listRevisions(tenantId: string, personId?: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const where: Prisma.SalaryRevisionWhereInput = { tenantId };
      if (personId) where.personId = personId;

      const rows = await tx.salaryRevision.findMany({
        where,
        include: {
          person: { select: { id: true, firstName: true, middleName: true, lastName: true, email: true, designation: true } },
        },
        orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
      });
      return rows.map((r) => ({ ...r, incrementAmount: round2(r.newGross - (r.oldGross ?? 0)) }));
    });
  }
}
