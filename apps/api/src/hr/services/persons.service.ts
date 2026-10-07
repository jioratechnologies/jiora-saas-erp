import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { LeaveStatus, Prisma, PersonStatus, PersonType } from "@prisma/client";
import { PageParams, toPaged } from "../../common/pagination";
import { PrismaService } from "../../prisma/prisma.service";
import { StorageService } from "../../storage/storage.service";
import { CacheService } from "../../cache/cache.service";
import { invalidateRef } from "../../cache/ref-cache";
import { AuthzCacheService } from "../../auth/authz-cache.service";
import { RbacService, type DesignationCaller } from "../../rbac/rbac.service";
import { MailService, type SendInvitationParams } from "../../mail/services/mail.service";
import { createInvitedUserInTx, sendInviteMail } from "../../admin/users.service";
import type { CreatePersonDto, ExitPersonDto, UpdatePersonDto, UploadDocumentDto, UpdateExitChecklistDto, BulkImportPersonsDto } from "../dto/person.dto";

@Injectable()
export class PersonsService {
  private static readonly MAX_MANAGER_DEPTH = 50;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly cache: CacheService,
    private readonly rbac: RbacService,
    private readonly mail: MailService,
    private readonly authzCache: AuthzCacheService,
  ) {}

  /**
   * Call AFTER a person write commits: the person's designation/user link/status feed the
   * cached guard identity + person context, and departments/designations lists embed people.
   */
  private async afterPersonWrite(tenantId: string) {
    await Promise.all([
      this.authzCache.invalidateTenantAuthz(tenantId),
      invalidateRef(this.cache, tenantId, "departments", "designations"),
    ]);
  }

  private static readonly NO_INVITE_PERMISSION = "You don't have permission to send invitations.";

  private static readonly NO_SALARY_PERMISSION = "Salary not set: you don't have permission.";

  private canManageSalary(caller: DesignationCaller) {
    return !!caller.isPlatform || caller.permissionKeys.has("payroll.salary.manage");
  }

  /** Mirrors SalaryService.assignSalary for a brand-new person (assignment + "Initial salary" revision). */
  private async createOnboardingSalary(
    tx: Prisma.TransactionClient,
    tenantId: string,
    person: { id: string; personType: PersonType; designationId: string | null },
    monthlyGross: number,
    userId: string,
  ) {
    if (person.personType === PersonType.VOLUNTEER) return "Salary not set: volunteers are unpaid.";
    const baseGross = Math.round(monthlyGross * 100) / 100;
    const effectiveFrom = new Date();
    await tx.employeeSalaryAssignment.create({
      data: { tenantId, personId: person.id, baseGross, ctc: Math.round(baseGross * 12 * 100) / 100, effectiveFrom, paymentMode: "BANK_TRANSFER" },
    });
    await tx.salaryRevision.create({
      data: {
        tenantId,
        personId: person.id,
        oldGross: null,
        newGross: baseGross,
        oldDesignationId: person.designationId,
        newDesignationId: person.designationId,
        effectiveDate: effectiveFrom,
        remarks: "Initial salary",
        promotedBy: userId,
      },
    });
    return undefined;
  }

  private canInvite(caller: DesignationCaller) {
    return !!caller.isPlatform || caller.permissionKeys.has("admin.user.invite");
  }

  /**
   * Inside the person's transaction: creates (or links) the login for `email`.
   * Returns the user id to set on the person plus the mail to send after commit, or a note when skipped.
   */
  private async prepareInvite(
    tx: Prisma.TransactionClient,
    tenantId: string,
    p: { email: string; displayName: string; departmentId: string | null; designationId: string | null },
  ): Promise<{ userId?: string; mail?: SendInvitationParams; note?: string }> {
    const existing = await tx.user.findUnique({ where: { tenantId_email: { tenantId, email: p.email } } });
    if (existing) {
      const linked = await tx.person.findFirst({ where: { userId: existing.id }, select: { id: true } });
      if (linked) return { note: "An account with this email already exists." };
      if (existing.zitadelSubjectId) {
        return { userId: existing.id, note: "An account with this email already exists and was linked." };
      }
    }
    const [tenant, department, designation] = await Promise.all([
      tx.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
      p.departmentId ? tx.department.findFirst({ where: { id: p.departmentId, tenantId }, select: { name: true } }) : null,
      p.designationId ? tx.designation.findFirst({ where: { id: p.designationId, tenantId }, select: { name: true } }) : null,
    ]);
    const user = existing ?? (await createInvitedUserInTx(tx, tenantId, p));
    return {
      userId: user.id,
      mail: {
        to: p.email,
        displayName: p.displayName,
        tenantName: tenant?.name || "Your Organization",
        roleNames: designation ? [designation.name] : [],
        departmentName: department?.name,
        designationName: designation?.name,
        isAdmin: false,
      },
    };
  }

  /** Sends the post-commit invitation; mail failures never fail the caller. */
  private async dispatchInvite(mail: SendInvitationParams | undefined): Promise<{ inviteSent: boolean; failNote?: string }> {
    if (!mail) return { inviteSent: false };
    const ok = await sendInviteMail(this.mail, mail);
    return ok ? { inviteSent: true } : { inviteSent: false, failNote: "The person was added, but the invitation email could not be sent." };
  }

  private buildListWhere(
    tenantId: string,
    query?: { personType?: PersonType; departmentId?: string; status?: PersonStatus; search?: string },
  ): Prisma.PersonWhereInput {
    const where: Prisma.PersonWhereInput = tenantId ? { tenantId } : {};

    if (query?.personType) where.personType = query.personType;
    if (query?.departmentId) where.departmentId = query.departmentId;
    if (query?.status) where.status = query.status;
    const term = query?.search?.trim();
    if (term) {
      where.OR = [
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { phone: { contains: term, mode: "insensitive" } },
      ];
    }
    return where;
  }

  async list(
    tenantId: string,
    query?: { personType?: PersonType; departmentId?: string; status?: PersonStatus; search?: string },
  ) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      return tx.person.findMany({
        where: this.buildListWhere(tenantId, query),
        include: {
          department: true,
          designation: true,
          manager: {
            select: {
              id: true,
              firstName: true, middleName: true,
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

  /** Paged directory listing: directory columns only, plus headline counts for the filtered set. */
  async listPaged(
    tenantId: string,
    query: { personType?: PersonType; departmentId?: string; status?: PersonStatus; search?: string } | undefined,
    paging: PageParams,
  ) {
    const where = this.buildListWhere(tenantId, query);
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const [items, total, groups] = await Promise.all([
        tx.person.findMany({
          where,
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
            personType: true,
            status: true,
            avatarUrl: true,
            departmentId: true,
            designationId: true,
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, name: true } },
            manager: { select: { id: true, firstName: true, middleName: true, lastName: true } },
          },
          orderBy: [{ status: "asc" }, { firstName: "asc" }, { id: "asc" }],
          skip: paging.skip,
          take: paging.take,
        }),
        tx.person.count({ where }),
        tx.person.groupBy({ by: ["personType", "status"], where, _count: { _all: true } }),
      ]);
      const counts = { employees: 0, volunteers: 0, active: 0 };
      for (const g of groups) {
        if (g.personType === PersonType.EMPLOYEE) counts.employees += g._count._all;
        if (g.personType === PersonType.VOLUNTEER) counts.volunteers += g._count._all;
        if (g.status === PersonStatus.ACTIVE) counts.active += g._count._all;
      }
      return { ...toPaged(items, total, paging), counts };
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
              firstName: true, middleName: true,
              lastName: true,
              email: true,
              department: true,
              designation: true,
            },
          },
          directReports: {
            select: {
              id: true,
              firstName: true, middleName: true,
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
      const person = await tx.person.findFirst({
        where: { userId, tenantId },
        include: { department: true, designation: true },
      });
      if (person?.status === PersonStatus.EXITED) {
        throw new ForbiddenException("Your account is no longer active. Please contact HR.");
      }
      return person;
    });
  }

  /** Verifies referenced records belong to the tenant, the user is not already linked, and the manager chain has no cycle. */
  private async validateRefs(
    tx: Prisma.TransactionClient,
    tenantId: string,
    refs: { departmentId?: string | null; designationId?: string | null; managerId?: string | null; userId?: string | null },
    selfId?: string,
  ) {
    const notFound = "Please check the highlighted fields and try again.";
    if (refs.departmentId && !(await tx.department.findFirst({ where: { id: refs.departmentId, tenantId }, select: { id: true } }))) {
      throw new BadRequestException(notFound);
    }
    if (refs.designationId && !(await tx.designation.findFirst({ where: { id: refs.designationId, tenantId }, select: { id: true } }))) {
      throw new BadRequestException(notFound);
    }
    if (refs.userId) {
      if (!(await tx.user.findFirst({ where: { id: refs.userId, tenantId }, select: { id: true } }))) {
        throw new BadRequestException(notFound);
      }
      const linked = await tx.person.findFirst({ where: { userId: refs.userId }, select: { id: true } });
      if (linked && linked.id !== selfId) {
        throw new ConflictException("This user account is already linked to another person.");
      }
    }
    if (refs.managerId) {
      if (selfId && refs.managerId === selfId) {
        throw new ConflictException("A person cannot be their own reporting manager.");
      }
      let cursor: string | null = refs.managerId;
      for (let depth = 0; cursor && depth < PersonsService.MAX_MANAGER_DEPTH; depth++) {
        if (selfId && cursor === selfId) {
          throw new ConflictException("This reporting line would create a loop. Please choose a different manager.");
        }
        const node: { managerId: string | null } | null = await tx.person.findFirst({ where: { id: cursor, tenantId }, select: { managerId: true } });
        if (!node) {
          if (cursor === refs.managerId) throw new BadRequestException(notFound);
          break;
        }
        cursor = node.managerId;
      }
      if (cursor) throw new ConflictException("The reporting chain is too long or contains a loop. Please choose a different manager.");
    }
  }

  async create(tenantId: string, dto: CreatePersonDto, caller: DesignationCaller) {
    let inviteNote: string | undefined;
    let salaryNote: string | undefined;
    let pendingMail: SendInvitationParams | undefined;
    const person = await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      await this.validateRefs(tx, tenantId, dto);
      await this.rbac.assertCanAssignDesignation(tx, tenantId, dto.designationId || null, caller, dto.userId || null);
      let inviteUserId: string | undefined;
      if (dto.sendInvite) {
        if (!this.canInvite(caller)) inviteNote = PersonsService.NO_INVITE_PERMISSION;
        else if (dto.userId) inviteNote = "A login is already linked to this person.";
        else {
          const prep = await this.prepareInvite(tx, tenantId, {
            email: dto.email.toLowerCase().trim(),
            displayName: [dto.firstName, dto.middleName, dto.lastName].map((x) => x?.trim()).filter(Boolean).join(" "),
            departmentId: dto.departmentId || null,
            designationId: dto.designationId || null,
          });
          inviteUserId = prep.userId;
          pendingMail = prep.mail;
          inviteNote = prep.note;
        }
      }
      try {
        const person = await tx.person.create({
          data: {
            tenantId,
            personType: dto.personType,
            firstName: dto.firstName.trim(),
            middleName: dto.middleName?.trim() || null,
            lastName: dto.lastName.trim(),
            email: dto.email.toLowerCase().trim(),
            phone: dto.phone.trim(),
            altPhone: dto.altPhone?.trim() || null,
            gender: dto.gender,
            dob: new Date(dto.dob),
            address: dto.currentAddress?.trim() || dto.address?.trim() || null,
            currentAddress: dto.currentAddress?.trim() || dto.address?.trim() || null,
            permanentAddress: dto.permanentAddress?.trim() || dto.currentAddress?.trim() || dto.address?.trim() || null,
            emergencyContact: dto.emergencyContact?.trim(),
            departmentId: dto.departmentId || null,
            designationId: dto.designationId || null,
            managerId: dto.managerId || null,
            joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : new Date(),
            userId: dto.userId || inviteUserId || null,
          },
          include: {
            department: true,
            designation: true,
            manager: true,
          },
        });

        if (dto.monthlyGross && dto.monthlyGross > 0) {
          if (!this.canManageSalary(caller)) salaryNote = PersonsService.NO_SALARY_PERMISSION;
          else salaryNote = await this.createOnboardingSalary(tx, tenantId, person, dto.monthlyGross, caller.userId);
        }

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

    await this.afterPersonWrite(tenantId);
    const { inviteSent, failNote } = await this.dispatchInvite(pendingMail);
    return { ...person, inviteSent, ...((failNote ?? inviteNote) ? { inviteNote: failNote ?? inviteNote } : {}), ...(salaryNote ? { salaryNote } : {}) };
  }

  async update(tenantId: string, id: string, dto: UpdatePersonDto, caller: DesignationCaller) {
    const updated = await this.updateInTx(tenantId, id, dto, caller);
    await this.afterPersonWrite(tenantId);
    return updated;
  }

  private async updateInTx(tenantId: string, id: string, dto: UpdatePersonDto, caller: DesignationCaller) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const existing = await tx.person.findFirst({ where: { id, tenantId } });
      if (!existing) throw new NotFoundException("Person record not found");

      await this.validateRefs(tx, tenantId, dto, id);
      if (dto.designationId && dto.designationId !== existing.designationId) {
        await this.rbac.assertCanAssignDesignation(tx, tenantId, dto.designationId, caller, existing.userId);
      }

      // DB columns stay nullable for legacy rows, so the saved record must end up complete.
      const missing = (dto.phone?.trim() || existing.phone) && (dto.gender || existing.gender) && (dto.dob || existing.dob);
      if (!missing) {
        throw new BadRequestException("Phone number, gender and date of birth are required. Please fill them in and try again.");
      }

      const updated = await tx.person.update({
        where: { id },
        data: {
          personType: dto.personType,
          firstName: dto.firstName?.trim(),
          middleName: dto.middleName !== undefined ? (dto.middleName?.trim() || null) : undefined,
          lastName: dto.lastName?.trim(),
          phone: dto.phone?.trim() || undefined,
          altPhone: dto.altPhone !== undefined ? (dto.altPhone?.trim() || null) : undefined,
          gender: dto.gender || undefined,
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

  private static readonly CHECKLIST_KEYS = ["assetReturn", "idCardReturn", "knowledgeHandover", "financeClearance"] as const;

  /** Moves a person to EXITED: cancels their pending leave, re-points reports/approvals, deactivates the linked login. */
  private async finalizeExit(
    tx: Prisma.TransactionClient,
    tenantId: string,
    person: { id: string; userId: string | null },
    exitDate: Date,
    exitReason: string,
    checklist: Record<string, any>,
    reassignTo?: string,
  ) {
    if (reassignTo) {
      const target = await tx.person.findFirst({ where: { id: reassignTo, tenantId }, select: { id: true, status: true, managerId: true } });
      if (!target || target.id === person.id || target.status === PersonStatus.EXITED) {
        throw new BadRequestException("Please choose an active person to take over the direct reports.");
      }
      // A deeper descendant of the leaver would end up managing its own ancestors (cycle).
      if (target.managerId !== person.id) {
        let cursor: string | null = target.managerId;
        for (let depth = 0; cursor && depth < PersonsService.MAX_MANAGER_DEPTH; depth++) {
          if (cursor === person.id) throw new BadRequestException("Please check the highlighted fields and try again.");
          const node: { managerId: string | null } | null = await tx.person.findFirst({ where: { id: cursor, tenantId }, select: { managerId: true } });
          cursor = node?.managerId ?? null;
        }
      }
    }
    const newManager = reassignTo || null;

    await tx.leaveRequest.updateMany({
      where: { tenantId, personId: person.id, status: LeaveStatus.PENDING },
      data: { status: LeaveStatus.CANCELLED, decisionNotes: "Cancelled automatically because the employee has exited.", decidedAt: new Date() },
    });
    await tx.leaveRequest.updateMany({
      where: { tenantId, approverId: person.id, status: LeaveStatus.PENDING },
      data: { approverId: newManager },
    });
    // Exclude the new manager itself (it may be a direct report): it inherits the leaver's own manager instead, avoiding a self-loop.
    await tx.person.updateMany({
      where: { tenantId, managerId: person.id, ...(reassignTo ? { id: { not: reassignTo } } : {}) },
      data: { managerId: newManager },
    });
    if (reassignTo) {
      const leaver = await tx.person.findFirst({ where: { id: person.id, tenantId }, select: { managerId: true } });
      const inherited = leaver?.managerId && leaver.managerId !== reassignTo ? leaver.managerId : null;
      await tx.person.updateMany({ where: { id: reassignTo, tenantId, managerId: person.id }, data: { managerId: inherited } });
    }
    if (person.userId) {
      await tx.user.updateMany({ where: { id: person.userId, tenantId, deactivatedAt: null }, data: { deactivatedAt: new Date() } });
    }

    const updated = await tx.person.update({
      where: { id: person.id },
      data: {
        status: PersonStatus.EXITED,
        exitDate,
        exitReason: exitReason.trim(),
        exitChecklist: { ...checklist, completedAt: new Date().toISOString() },
      },
      include: { department: true, designation: true },
    });
    await this.cache.del(`tenant:${tenantId}:org_structure`);
    return updated;
  }

  private assertExitReady(checklist: Record<string, any>, exitDate: Date | null | undefined, reason: string | null | undefined) {
    const complete = PersonsService.CHECKLIST_KEYS.every((k) => checklist?.[k] === true);
    if (!complete || !exitDate || Number.isNaN(exitDate.getTime()) || !reason?.trim()) {
      throw new BadRequestException("Please complete every exit checklist item and provide the exit date and reason before closing this record.");
    }
  }

  async exit(tenantId: string, id: string, dto: ExitPersonDto) {
    const updated = await this.exitInTx(tenantId, id, dto);
    await this.afterPersonWrite(tenantId);
    return updated;
  }

  private async exitInTx(tenantId: string, id: string, dto: ExitPersonDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const existing = await tx.person.findFirst({ where: { id, tenantId } });
      if (!existing) throw new NotFoundException("Person record not found");
      if (existing.status === PersonStatus.EXITED) throw new ConflictException("This person has already exited.");

      // Resignation only records the notice; EXITED is set solely by the checklist finalize.
      const exitDate = new Date(dto.exitDate);
      if (Number.isNaN(exitDate.getTime()) || !dto.exitReason?.trim()) {
        throw new BadRequestException("Please check the highlighted fields and try again.");
      }
      const updated = await tx.person.update({
        where: { id },
        data: { status: PersonStatus.NOTICE_PERIOD, exitDate, exitReason: dto.exitReason.trim() },
      });
      await this.cache.del(`tenant:${tenantId}:org_structure`);
      return updated;
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
      const previewUrl = await this.storage.getPresignedUrl(doc.fileKey, 900, undefined, {
        inline: true,
        contentType: doc.mimeType,
      });
      return { ...doc, downloadUrl, url: previewUrl };
    });
  }

  /** Raw bytes of a document, for in-app preview where the browser can't render the stored file itself. */
  async getDocumentContent(tenantId: string, personId: string, documentId: string) {
    const doc = await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, (tx) =>
      tx.personDocument.findFirst({ where: { id: documentId, personId, tenantId } }),
    );
    if (!doc) throw new NotFoundException("Document not found");
    const buffer = await this.storage.getFileBuffer(doc.fileKey);
    return { buffer, mimeType: doc.mimeType ?? "application/octet-stream" };
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
    const result = await this.updateExitChecklistInTx(tenantId, personId, dto);
    // Finalize deactivates the login and sets EXITED: both must take effect for the cached guard/person context.
    if (dto.isFinalized) await this.afterPersonWrite(tenantId);
    return result;
  }

  private async updateExitChecklistInTx(tenantId: string, personId: string, dto: UpdateExitChecklistDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const person = await tx.person.findFirst({ where: { id: personId, tenantId } });
      if (!person) throw new NotFoundException("Person not found");
      if (person.status === PersonStatus.EXITED) throw new ConflictException("This person has already exited.");

      const existingChecklist = (person.exitChecklist as any) || {};
      const updatedChecklist = {
        ...existingChecklist,
        assetReturn: dto.assetReturn ?? existingChecklist.assetReturn ?? false,
        idCardReturn: dto.idCardReturn ?? existingChecklist.idCardReturn ?? false,
        knowledgeHandover: dto.knowledgeHandover ?? existingChecklist.knowledgeHandover ?? false,
        financeClearance: dto.financeClearance ?? existingChecklist.financeClearance ?? false,
        notes: dto.notes !== undefined ? dto.notes : (existingChecklist.notes ?? ""),
        completedAt: existingChecklist.completedAt,
      };

      if (dto.isFinalized) {
        const exitDate = dto.exitDate ? new Date(dto.exitDate) : person.exitDate;
        const reason = dto.exitReason ?? person.exitReason;
        this.assertExitReady(updatedChecklist, exitDate, reason);
        return this.finalizeExit(tx, tenantId, person, exitDate!, reason!, updatedChecklist, dto.reassignReportsTo);
      }

      return tx.person.update({
        where: { id: personId },
        data: { exitChecklist: updatedChecklist },
        include: { department: true, designation: true },
      });
    });
  }

  async bulkImport(tenantId: string, dto: BulkImportPersonsDto, caller: DesignationCaller) {
    const rows = dto.records ?? [];
    if (rows.length > 500) throw new BadRequestException("You can import at most 500 people at a time.");

    const emails = [...new Set(rows.map((r) => String(r.email ?? "").toLowerCase().trim()).filter(Boolean))];
    const { deptMap, desigMap, existingEmails } = await this.prisma.runInTenantContext(
      { tenantId, isPlatformContext: false },
      async (tx) => {
        const [departments, designations, existing] = await Promise.all([
          tx.department.findMany({ where: { tenantId } }),
          tx.designation.findMany({ where: { tenantId } }),
          tx.person.findMany({ where: { tenantId, email: { in: emails } }, select: { email: true } }),
        ]);
        return {
          deptMap: new Map(departments.map((d) => [d.name.toLowerCase().trim(), d.id])),
          desigMap: new Map(designations.map((d) => [d.name.toLowerCase().trim(), d.id])),
          existingEmails: new Set(existing.map((e) => e.email.toLowerCase())),
        };
      },
    );

    const created: any[] = [];
    let invitedCount = 0;
    const mayInvite = !!dto.sendInvites && this.canInvite(caller);
    const failed: { row: number; email: string; reason: string }[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const item = rows[i];
      const row = i + 1;
      const email = String(item.email ?? "").toLowerCase().trim();
      const fail = (reason: string) => failed.push({ row, email, reason });

      if (existingEmails.has(email)) { fail("A person with this email already exists."); continue; }
      if (seen.has(email)) { fail("This email appears more than once in the file."); continue; }
      seen.add(email);

      const joiningDate = item.joiningDate ? new Date(item.joiningDate) : new Date();
      if (Number.isNaN(joiningDate.getTime())) { fail("The joining date is not valid."); continue; }

      try {
        const designationId = item.designationName ? desigMap.get(item.designationName.toLowerCase().trim()) || null : null;
        const departmentId = item.departmentName ? deptMap.get(item.departmentName.toLowerCase().trim()) || null : null;
        let rowNote: string | undefined;
        let rowSalaryNote: string | undefined;
        let rowMail: SendInvitationParams | undefined;
        const person = await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
          await this.rbac.assertCanAssignDesignation(tx, tenantId, designationId, caller, null);
          let inviteUserId: string | undefined;
          if (dto.sendInvites) {
            if (!mayInvite) rowNote = PersonsService.NO_INVITE_PERMISSION;
            else {
              const prep = await this.prepareInvite(tx, tenantId, {
                email,
                displayName: [item.firstName, item.middleName, item.lastName].map((x) => x?.trim()).filter(Boolean).join(" "),
                departmentId,
                designationId,
              });
              inviteUserId = prep.userId;
              rowMail = prep.mail;
              rowNote = prep.note;
            }
          }
          const newPerson = await tx.person.create({
            data: {
              tenantId,
              personType: item.personType || "EMPLOYEE",
              status: "ACTIVE",
              firstName: item.firstName.trim(),
              middleName: item.middleName?.trim() || null,
              lastName: item.lastName.trim(),
              email,
              phone: item.phone.trim(),
              altPhone: item.altPhone?.trim() || null,
              gender: item.gender,
              dob: new Date(item.dob),
              departmentId,
              designationId,
              joiningDate,
              userId: inviteUserId ?? null,
            },
            include: { department: true, designation: true },
          });
          if (item.monthlyGross && item.monthlyGross > 0) {
            if (!this.canManageSalary(caller)) rowSalaryNote = PersonsService.NO_SALARY_PERMISSION;
            else rowSalaryNote = await this.createOnboardingSalary(tx, tenantId, newPerson, item.monthlyGross, caller.userId);
          }
          return newPerson;
        });
        const { inviteSent, failNote } = await this.dispatchInvite(rowMail);
        if (inviteSent) invitedCount++;
        const note = failNote ?? rowNote;
        const salaryExtra = rowSalaryNote ? { salaryNote: rowSalaryNote } : {};
        created.push(dto.sendInvites ? { ...person, inviteSent, ...(note ? { inviteNote: note } : {}), ...salaryExtra } : { ...person, ...salaryExtra });
      } catch (err: any) {
        if (err instanceof ForbiddenException) { fail("You do not have permission to assign this designation."); continue; }
        fail(err?.code === "P2002" ? "A person with this email already exists." : "This row could not be saved. Please check it and try again.");
      }
    }

    if (created.length > 0) await this.afterPersonWrite(tenantId);
    return {
      total: rows.length,
      importedCount: created.length,
      failedCount: failed.length,
      invitedCount,
      created,
      failed,
      errors: failed, // kept for existing consumers
    };
  }
}
