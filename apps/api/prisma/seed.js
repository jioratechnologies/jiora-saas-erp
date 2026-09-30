const path = require("path");
const fs = require("fs");

// Load .env if present
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const { PrismaClient } = require("@prisma/client");
const {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} = require("@aws-sdk/client-s3");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL
    },
  },
});

async function main() {
  console.log("==========================================================");
  console.log("1. Cleaning Up Database (Truncating all operational tables)");
  console.log("==========================================================");

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      payslips,
      payroll_runs,
      salary_advances,
      expense_claims,
      salary_revisions,
      employee_salary_assignments,
      salary_structures,
      salary_components,
      attendances,
      leave_requests,
      leave_types,
      holidays,
      person_documents,
      persons,
      user_roles,
      role_permissions,
      roles,
      users,
      designations,
      departments,
      tenants
    CASCADE;
  `);
  console.log("✓ Database cleaned up successfully.");

  console.log("==========================================================");
  console.log("2. Initializing Tenant, Roles, and Core Zitadel Users");
  console.log("==========================================================");

  const targetSlug = process.env.SEED_TENANT_SLUG || "jiorasacchisahelitest1";
  const tenant = await prisma.tenant.create({
    data: {
      id: "3493aeac-97ac-44f8-9492-18b1a134a134",
      name: "Jiora Sacchi Saheli",
      slug: targetSlug,
      primaryColor: "#1F4E78",
      showPoweredBy: true,
    },
  });
  const tenantId = tenant.id;
  console.log(`✓ Target Tenant Created: ${tenant.name} (${tenantId})`);

  // Platform super_admin role
  const superAdminRole = await prisma.role.create({
    data: {
      id: "4f56de0f-f14d-443f-993e-42e6f91b9eb1",
      name: "super_admin",
      tenantId: null,
      isProtected: true,
    },
  });

  const platformPermissions = [
    "platform.tenant.read",
    "platform.tenant.write",
    "platform.tenant.suspend",
    "platform.tenant.impersonate",
  ];
  for (const perm of platformPermissions) {
    await prisma.rolePermission.create({
      data: { roleId: superAdminRole.id, permissionKey: perm },
    });
  }

  // Platform User: jioratechnologies@gmail.com
  const platformUser = await prisma.user.create({
    data: {
      id: "717f8031-4761-4300-88fc-411878157f5c",
      tenantId: null,
      zitadelSubjectId: "392937773176783363",
      email: "jioratechnologies@gmail.com",
      displayName: "Jiora Technologies Admin",
    },
  });

  await prisma.userRole.create({
    data: { userId: platformUser.id, roleId: superAdminRole.id },
  });
  console.log("✓ Platform super_admin user created: jioratechnologies@gmail.com (sub: 392937773176783363)");

  // Tenant Roles & Permissions
  const allPermissions = [
    // Admin & Org Structure Metadata
    "admin.org.read", "admin.org.write",
    "admin.department.read", "admin.department.write", "admin.department.delete",
    "admin.designation.read", "admin.designation.write", "admin.designation.delete",
    "admin.role.read", "admin.role.write", "admin.role.delete",
    "admin.user.read", "admin.user.invite", "admin.user.write", "admin.user.deactivate",
    // HR Core
    "hr.person.read", "hr.person.write", "hr.person.exit",
    "hr.attendance.checkin", "hr.attendance.read", "hr.attendance.manage",
    "hr.leave.apply", "hr.leave.read", "hr.leave.approve",
    "hr.holiday.read", "hr.holiday.write",
    // Phase 3 Payroll & Claims
    "payroll.salary.read", "payroll.salary.manage",
    "payroll.run.read", "payroll.run.manage",
    "payroll.payslip.read",
    "payroll.claim.apply", "payroll.claim.read", "payroll.claim.manage",
    "payroll.advance.apply", "payroll.advance.manage",
  ];

  const adminRole = await prisma.role.create({
    data: {
      id: "8bb34c4b-0d3d-4b21-b4c4-9a9548effd40",
      tenantId,
      name: "admin",
      isProtected: true,
    },
  });

  const hrRole = await prisma.role.create({
    data: { tenantId, name: "HR", isProtected: false },
  });

  const devRole = await prisma.role.create({
    data: { tenantId, name: "Developer", isProtected: false },
  });

  const empRole = await prisma.role.create({
    data: { tenantId, name: "Employee", isProtected: false },
  });

  for (const perm of allPermissions) {
    await prisma.rolePermission.create({
      data: { roleId: adminRole.id, permissionKey: perm },
    });
  }

  for (const perm of allPermissions) {
    if (perm.startsWith("hr.") || perm.startsWith("payroll.") || perm.includes(".read")) {
      await prisma.rolePermission.create({
        data: { roleId: hrRole.id, permissionKey: perm },
      });
    }
  }

  const selfServicePerms = [
    "admin.department.read", "admin.designation.read",
    "hr.attendance.checkin", "hr.attendance.read",
    "hr.leave.apply", "hr.leave.read", "hr.holiday.read",
    "payroll.payslip.read",
    "payroll.claim.apply", "payroll.claim.read",
    "payroll.advance.apply",
  ];
  for (const perm of selfServicePerms) {
    await prisma.rolePermission.create({
      data: { roleId: devRole.id, permissionKey: perm },
    });
    await prisma.rolePermission.create({
      data: { roleId: empRole.id, permissionKey: perm },
    });
  }
  console.log("✓ Tenant roles (admin, HR, Developer, Employee) and permissions configured");

  // Tenant Users
  const gauravUser = await prisma.user.create({
    data: {
      tenantId,
      email: "gaurav.12bhindwar@gmail.com",
      displayName: "Gaurav Bhindwar",
      phone: "+91 9988776655",
      avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80",
    },
  });
  await prisma.userRole.create({
    data: { userId: gauravUser.id, roleId: adminRole.id },
  });

  const hrUser = await prisma.user.create({
    data: {
      tenantId,
      email: "hr@saas-erp.local",
      displayName: "HR Administrator",
      phone: "+91 9876543210",
      avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80",
    },
  });
  await prisma.userRole.create({
    data: { userId: hrUser.id, roleId: hrRole.id },
  });
  console.log("✓ Tenant users seeded: gaurav.12bhindwar@gmail.com (admin) & hr@saas-erp.local (HR)");

  // ==========================================
  // 3. Departments Master
  // ==========================================
  const depts = [
    "Executive Leadership",
    "Technology & Engineering",
    "Human Resources",
    "Finance & Accounts",
    "Community & Volunteers",
    "Operations",
  ];

  const deptMap = {};
  for (const name of depts) {
    const d = await prisma.department.create({
      data: { tenantId, name },
    });
    deptMap[name] = d.id;
  }
  console.log("✓ Departments seeded:", Object.keys(deptMap).length);

  // ==========================================
  // 4. Designations Master
  // ==========================================
  const desigs = [
    "Executive Director",
    "Lead Developer",
    "HR Executive",
    "Finance Manager",
    "Software Engineer",
    "Senior Accountant",
    "Volunteer Lead",
    "Operations Coordinator",
  ];

  const desigMap = {};
  for (const name of desigs) {
    const d = await prisma.designation.create({
      data: { tenantId, name },
    });
    desigMap[name] = d.id;
  }
  console.log("✓ Designations seeded:", Object.keys(desigMap).length);

  // Update user department & designation assignments
  await prisma.user.update({
    where: { id: gauravUser.id },
    data: {
      departmentId: deptMap["Technology & Engineering"],
      designationId: desigMap["Lead Developer"],
    },
  });

  await prisma.user.update({
    where: { id: hrUser.id },
    data: {
      departmentId: deptMap["Human Resources"],
      designationId: desigMap["HR Executive"],
    },
  });

  // ==========================================
  // 5. Person Master & Organizational Hierarchy
  // ==========================================
  // Director
  let directorPerson = await prisma.person.create({
    data: {
      tenantId,
      firstName: "Dr. Surbhi",
      lastName: "Singh",
      email: "director@saas-erp.local",
      phone: "+91 9911223344",
      gender: "Female",
      dob: new Date("1980-04-12"),
      address: "Golf Links, Central Delhi, 110003",
      emergencyContact: "+91 9911223300 (Spouse: Rajeev Singh)",
      departmentId: deptMap["Executive Leadership"],
      designationId: desigMap["Executive Director"],
      managerId: null,
      status: "ACTIVE",
      personType: "EMPLOYEE",
      avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80",
    },
  });

  // HR Person (reports to Director)
  let hrPerson = await prisma.person.create({
    data: {
      tenantId,
      userId: hrUser.id,
      firstName: "HR",
      lastName: "Administrator",
      email: "hr@saas-erp.local",
      phone: "+91 9876543210",
      gender: "Female",
      dob: new Date("1992-06-14"),
      address: "Connaught Place, Central Delhi, 110001",
      emergencyContact: "+91 9876543299 (Spouse)",
      departmentId: deptMap["Human Resources"],
      designationId: desigMap["HR Executive"],
      managerId: directorPerson.id,
      status: "ACTIVE",
      personType: "EMPLOYEE",
      avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80",
    },
  });

  // Gaurav Person (reports to Director)
  let gauravPerson = await prisma.person.create({
    data: {
      tenantId,
      userId: gauravUser.id,
      firstName: "Gaurav",
      lastName: "Bhindwar",
      email: "gaurav.12bhindwar@gmail.com",
      phone: "+91 9988776655",
      gender: "Male",
      dob: new Date("1994-08-22"),
      address: "Vasant Kunj, South Delhi, 110070",
      emergencyContact: "+91 9988776600 (Father)",
      departmentId: deptMap["Technology & Engineering"],
      designationId: desigMap["Lead Developer"],
      managerId: directorPerson.id,
      status: "ACTIVE",
      personType: "EMPLOYEE",
      avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80",
    },
  });

  // Additional Employees & Volunteers
  const additionalPeople = [
    {
      firstName: "Ananya",
      lastName: "Verma",
      email: "ananya.verma@saas-erp.local",
      phone: "+91 9811223344",
      gender: "Female",
      dob: new Date("1996-03-10"),
      address: "Sector 62, Noida, UP",
      emergencyContact: "+91 9811223399 (Mother)",
      departmentId: deptMap["Technology & Engineering"],
      designationId: desigMap["Software Engineer"],
      managerId: gauravPerson.id,
      status: "ACTIVE",
      personType: "EMPLOYEE",
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80",
    },
    {
      firstName: "Vikram",
      lastName: "Malhotra",
      email: "vikram.m@saas-erp.local",
      phone: "+91 9822334455",
      gender: "Male",
      dob: new Date("1989-11-25"),
      address: "Cyber City, Gurugram, Haryana",
      emergencyContact: "+91 9822334400 (Brother)",
      departmentId: deptMap["Finance & Accounts"],
      designationId: desigMap["Senior Accountant"],
      managerId: directorPerson.id,
      status: "ACTIVE",
      personType: "EMPLOYEE",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
    },
    {
      firstName: "Priya",
      lastName: "Singh",
      email: "priya.s@saas-erp.local",
      phone: "+91 9833445566",
      gender: "Female",
      dob: new Date("1998-09-18"),
      address: "Lajpat Nagar, New Delhi",
      emergencyContact: "+91 9833445511 (Sister)",
      departmentId: deptMap["Operations"],
      designationId: desigMap["Operations Coordinator"],
      managerId: hrPerson.id, // Reports to HR!
      status: "PROBATION",
      personType: "EMPLOYEE",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
    },
    {
      firstName: "Rohit",
      lastName: "Joshi",
      email: "rohit.j@saas-erp.local",
      phone: "+91 9844556677",
      gender: "Male",
      dob: new Date("1993-01-30"),
      address: "Indirapuram, Ghaziabad",
      emergencyContact: "+91 9844556622 (Wife)",
      departmentId: deptMap["Technology & Engineering"],
      designationId: desigMap["Software Engineer"],
      managerId: gauravPerson.id,
      status: "NOTICE_PERIOD",
      personType: "EMPLOYEE",
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
    },
    {
      firstName: "Neha",
      lastName: "Kapoor",
      email: "neha.k@saas-erp.local",
      phone: "+91 9855667788",
      gender: "Female",
      dob: new Date("2000-07-04"),
      address: "Hauz Khas, New Delhi",
      emergencyContact: "+91 9855667733 (Father)",
      departmentId: deptMap["Community & Volunteers"],
      designationId: desigMap["Volunteer Lead"],
      managerId: hrPerson.id, // Reports to HR!
      status: "ACTIVE",
      personType: "VOLUNTEER",
      avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80",
    },
    {
      firstName: "Arjun",
      lastName: "Patel",
      email: "arjun.p@saas-erp.local",
      phone: "+91 9866778899",
      gender: "Male",
      dob: new Date("2001-12-15"),
      address: "Dwarka Sector 10, New Delhi",
      emergencyContact: "+91 9866778844 (Mother)",
      departmentId: deptMap["Community & Volunteers"],
      designationId: desigMap["Operations Coordinator"],
      managerId: hrPerson.id,
      status: "ACTIVE",
      personType: "VOLUNTEER",
      avatarUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80",
    },
  ];

  const peopleMap = {
    [directorPerson.email]: directorPerson,
    [hrPerson.email]: hrPerson,
    [gauravPerson.email]: gauravPerson,
  };

  for (const p of additionalPeople) {
    const existing = await prisma.person.findFirst({
      where: { tenantId, email: p.email },
    });
    if (!existing) {
      const created = await prisma.person.create({
        data: { tenantId, ...p },
      });
      peopleMap[p.email] = created;
    } else {
      const updated = await prisma.person.update({
        where: { id: existing.id },
        data: p,
      });
      peopleMap[p.email] = updated;
    }
  }

  // Update Arjun's manager to Neha Kapoor
  if (peopleMap["neha.k@saas-erp.local"] && peopleMap["arjun.p@saas-erp.local"]) {
    await prisma.person.update({
      where: { id: peopleMap["arjun.p@saas-erp.local"].id },
      data: { managerId: peopleMap["neha.k@saas-erp.local"].id },
    });
  }
  console.log("✓ Person Master seeded:", Object.keys(peopleMap).length);

  // ==========================================
  // 6. MinIO S3 Verification & KYC Documents
  // ==========================================
  const objectStorageUseSsl = process.env.OBJECT_STORAGE_USE_SSL === "true";
  const s3 = new S3Client({
    endpoint: `${objectStorageUseSsl ? "https" : "http"}://${process.env.OBJECT_STORAGE_ENDPOINT || "localhost"}:${process.env.OBJECT_STORAGE_PORT || "9010"}`,
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY || "saaserp",
      secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY || "saaserp_dev_password",
    },
    forcePathStyle: true,
  });

  const bucket = process.env.OBJECT_STORAGE_BUCKET || "saas-erp-documents";
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    } catch { }
  }

  const samplePdfBytes = Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF`
  );

  const documents = [
    {
      personId: hrPerson.id,
      name: "Government Aadhaar ID Card",
      category: "KYC",
      documentNumber: "5423-8891-1029",
      status: "APPROVED",
      fileKey: `tenants/${tenantId}/persons/${hrPerson.id}/KYC/seed-aadhaar.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1450200,
      verifiedBy: hrUser?.id,
      verifiedAt: new Date(),
    },
    {
      personId: hrPerson.id,
      name: "Permanent Account Number (PAN)",
      category: "KYC",
      documentNumber: "ABCDE1234F",
      status: "APPROVED",
      fileKey: `tenants/${tenantId}/persons/${hrPerson.id}/KYC/seed-pan.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 980400,
      verifiedBy: hrUser?.id,
      verifiedAt: new Date(),
    },
    {
      personId: gauravPerson.id,
      name: "National Passport",
      category: "KYC",
      documentNumber: "Z9876543",
      status: "APPROVED",
      fileKey: `tenants/${tenantId}/persons/${gauravPerson.id}/KYC/seed-passport.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 2150000,
      verifiedBy: hrUser?.id,
      verifiedAt: new Date(),
    },
    {
      personId: peopleMap["ananya.verma@saas-erp.local"]?.id,
      name: "Aadhaar Card",
      category: "KYC",
      documentNumber: "7891-2345-6789",
      status: "APPROVED",
      fileKey: `tenants/${tenantId}/persons/${peopleMap["ananya.verma@saas-erp.local"]?.id}/KYC/seed-aadhaar.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1200000,
      verifiedBy: hrUser?.id,
      verifiedAt: new Date(),
    },
    {
      personId: peopleMap["ananya.verma@saas-erp.local"]?.id,
      name: "Updated Resume - 2026.pdf",
      category: "RESUME",
      status: "APPROVED",
      fileKey: `tenants/${tenantId}/persons/${peopleMap["ananya.verma@saas-erp.local"]?.id}/RESUME/resume.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 650000,
    },
    {
      personId: peopleMap["priya.s@saas-erp.local"]?.id,
      name: "State Driving License",
      category: "KYC",
      documentNumber: "DL-0420110098765",
      status: "REJECTED",
      rejectionReason: "Document photograph is blurry and validity date is obscured. Please upload a high-resolution scan.",
      fileKey: `tenants/${tenantId}/persons/${peopleMap["priya.s@saas-erp.local"]?.id}/KYC/seed-dl.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 890000,
      verifiedBy: hrUser?.id,
      verifiedAt: new Date(),
    },
    {
      personId: peopleMap["neha.k@saas-erp.local"]?.id,
      name: "College Identity & Voter ID",
      category: "KYC",
      documentNumber: "VTR-9988772",
      status: "PENDING",
      fileKey: `tenants/${tenantId}/persons/${peopleMap["neha.k@saas-erp.local"]?.id}/KYC/seed-voter.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1100000,
    },
  ];

  for (const doc of documents) {
    if (!doc.personId) continue;
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: doc.fileKey,
          Body: samplePdfBytes,
          ContentType: doc.mimeType || "application/pdf",
        })
      );
    } catch { }

    const exists = await prisma.personDocument.findFirst({
      where: { tenantId, personId: doc.personId, name: doc.name },
    });
    if (!exists) {
      await prisma.personDocument.create({
        data: { tenantId, ...doc },
      });
    }
  }
  console.log("✓ KYC & Verification Documents seeded to MinIO");

  // ==========================================
  // 7. Leave Types & Holidays Master
  // ==========================================
  const leaveTypes = [
    { name: "Casual Leave", code: "CL", annualQuota: 12, applicableTo: "ALL" },
    { name: "Sick Leave", code: "SL", annualQuota: 10, applicableTo: "ALL" },
    { name: "Privilege / Earned Leave", code: "PL", annualQuota: 15, applicableTo: "EMPLOYEE_ONLY" },
  ];

  const leaveTypeMap = {};
  for (const lt of leaveTypes) {
    const created = await prisma.leaveType.upsert({
      where: { tenantId_code: { tenantId, code: lt.code } },
      update: {},
      create: { tenantId, ...lt },
    });
    leaveTypeMap[lt.code] = created.id;
  }
  console.log("✓ Leave Types seeded:", Object.keys(leaveTypeMap).length);

  const holidays = [
    { name: "Independence Day", date: new Date("2025-08-15"), isOptional: false },
    { name: "Gandhi Jayanti", date: new Date("2025-10-02"), isOptional: false },
    { name: "Diwali (Deepavali)", date: new Date("2025-10-21"), isOptional: false },
    { name: "Christmas Day", date: new Date("2025-12-25"), isOptional: false },
    { name: "Republic Day", date: new Date("2026-01-26"), isOptional: false },
    { name: "Holi", date: new Date("2026-03-04"), isOptional: false },
    { name: "Independence Day", date: new Date("2026-08-15"), isOptional: false },
    { name: "Gandhi Jayanti", date: new Date("2026-10-02"), isOptional: false },
    { name: "Dussehra", date: new Date("2026-10-20"), isOptional: false },
    { name: "Diwali (Deepavali)", date: new Date("2026-11-08"), isOptional: false },
    { name: "Christmas Day", date: new Date("2026-12-25"), isOptional: false },
  ];

  for (const h of holidays) {
    await prisma.holiday.upsert({
      where: { tenantId_date_name: { tenantId, date: h.date, name: h.name } },
      update: {},
      create: { tenantId, ...h },
    });
  }
  console.log("✓ Annual Holidays seeded");

  // ==========================================
  // 8. Leave Requests Across 18 Months
  // ==========================================
  const historicalLeaves = [
    // Subordinates of HR: Priya Singh (PENDING - Shows up in HR's Manager Approval Queue!)
    {
      personId: peopleMap["priya.s@saas-erp.local"].id,
      leaveTypeId: leaveTypeMap["CL"],
      startDate: new Date("2026-09-28"),
      endDate: new Date("2026-09-29"),
      daysCount: 2,
      reason: "Sister's wedding anniversary family gathering in Agra",
      status: "PENDING",
      approverId: hrPerson.id,
    },
    // Subordinates of HR: Neha Kapoor (PENDING - Shows up in HR's Manager Approval Queue!)
    {
      personId: peopleMap["neha.k@saas-erp.local"].id,
      leaveTypeId: leaveTypeMap["CL"],
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-01"),
      daysCount: 1,
      reason: "University final semester marksheet collection",
      status: "PENDING",
      approverId: hrPerson.id,
    },
    // Subordinates of HR: Priya Singh (Historical Approved)
    {
      personId: peopleMap["priya.s@saas-erp.local"].id,
      leaveTypeId: leaveTypeMap["SL"],
      startDate: new Date("2026-05-12"),
      endDate: new Date("2026-05-13"),
      daysCount: 2,
      reason: "Severe viral flu and medical rest",
      status: "APPROVED",
      approverId: hrPerson.id,
      decisionNotes: "Approved. Take care and submit prescription upon return.",
      decidedAt: new Date("2026-05-12T09:30:00Z"),
    },
    // HR Administrator's own requests (Shows up in "My Requests")
    {
      personId: hrPerson.id,
      leaveTypeId: leaveTypeMap["CL"],
      startDate: new Date("2026-09-26"),
      endDate: new Date("2026-09-28"),
      daysCount: 3,
      reason: "Personal family commitment and out-of-station travel",
      status: "PENDING",
      approverId: directorPerson.id,
    },
    {
      personId: hrPerson.id,
      leaveTypeId: leaveTypeMap["PL"],
      startDate: new Date("2025-12-22"),
      endDate: new Date("2025-12-26"),
      daysCount: 5,
      reason: "Annual family holiday & year-end winter break",
      status: "APPROVED",
      approverId: directorPerson.id,
      decisionNotes: "Approved. Enjoy your holidays!",
      decidedAt: new Date("2025-12-15T11:00:00Z"),
    },
    {
      personId: hrPerson.id,
      leaveTypeId: leaveTypeMap["SL"],
      startDate: new Date("2026-01-19"),
      endDate: new Date("2026-01-20"),
      daysCount: 2,
      reason: "Migraine and viral fever",
      status: "APPROVED",
      approverId: directorPerson.id,
      decisionNotes: "Approved. Get well soon.",
      decidedAt: new Date("2026-01-19T08:30:00Z"),
    },
    // Vikram Malhotra (Finance)
    {
      personId: peopleMap["vikram.m@saas-erp.local"].id,
      leaveTypeId: leaveTypeMap["CL"],
      startDate: new Date("2026-09-14"),
      endDate: new Date("2026-09-15"),
      daysCount: 2,
      reason: "Family function in hometown (Jaipur)",
      status: "APPROVED",
      approverId: directorPerson.id,
      decisionNotes: "Approved. Enjoy your time with family.",
      decidedAt: new Date("2026-09-10T11:00:00Z"),
    },
    {
      personId: peopleMap["vikram.m@saas-erp.local"].id,
      leaveTypeId: leaveTypeMap["SL"],
      startDate: new Date("2025-11-10"),
      endDate: new Date("2025-11-12"),
      daysCount: 3,
      reason: "Hospitalization of father and family support",
      status: "APPROVED",
      approverId: directorPerson.id,
      decisionNotes: "Approved under emergency medical welfare.",
      decidedAt: new Date("2025-11-10T09:00:00Z"),
    },
    // Gaurav Bhindwar (Lead Dev)
    {
      personId: gauravPerson.id,
      leaveTypeId: leaveTypeMap["PL"],
      startDate: new Date("2025-10-13"),
      endDate: new Date("2025-10-16"),
      daysCount: 4,
      reason: "Post-release vacation and downtime",
      status: "APPROVED",
      approverId: directorPerson.id,
      decisionNotes: "Well-deserved rest after Q3 release.",
      decidedAt: new Date("2025-10-05T10:00:00Z"),
    },
    // Ananya Verma
    {
      personId: peopleMap["ananya.verma@saas-erp.local"].id,
      leaveTypeId: leaveTypeMap["CL"],
      startDate: new Date("2026-10-05"),
      endDate: new Date("2026-10-05"),
      daysCount: 1,
      reason: "Personal urgent work at municipal authority office",
      status: "PENDING",
      approverId: gauravPerson.id,
    },
    // Rohit Joshi (Rejected)
    {
      personId: peopleMap["rohit.j@saas-erp.local"].id,
      leaveTypeId: leaveTypeMap["PL"],
      startDate: new Date("2026-09-21"),
      endDate: new Date("2026-09-25"),
      daysCount: 5,
      reason: "Personal travel and trekking vacation",
      status: "REJECTED",
      approverId: gauravPerson.id,
      decisionNotes: "Cannot approve 5 days during critical sprint delivery and notice period handover.",
      decidedAt: new Date("2026-09-18T16:30:00Z"),
    },
  ];

  for (const lv of historicalLeaves) {
    const existing = await prisma.leaveRequest.findFirst({
      where: {
        tenantId,
        personId: lv.personId,
        startDate: lv.startDate,
        endDate: lv.endDate,
      },
    });
    if (!existing) {
      await prisma.leaveRequest.create({
        data: { tenantId, ...lv },
      });
    }
  }
  console.log("✓ Historical Leave Requests seeded (including HR manager approval queue)");

  // ==========================================
  // 9. Salary Components & Structure Templates
  // ==========================================
  const components = [
    {
      code: "BASIC",
      name: "Basic Salary",
      type: "EARNING",
      isTaxable: true,
      isStatutory: true,
      description: "Primary compensation component (typically 50% of gross)",
    },
    {
      code: "HRA",
      name: "House Rent Allowance",
      type: "EARNING",
      isTaxable: true,
      isStatutory: false,
      description: "Housing rent support allowance (typically 25% of gross)",
    },
    {
      code: "CONVEYANCE",
      name: "Conveyance Allowance",
      type: "EARNING",
      isTaxable: false,
      isStatutory: false,
      description: "Local commute reimbursement allowance (10% of gross)",
    },
    {
      code: "SPECIAL",
      name: "Special Allowance",
      type: "EARNING",
      isTaxable: true,
      isStatutory: false,
      description: "Balancing flexible benefit allowance",
    },
    {
      code: "PF",
      name: "Provident Fund (Employee)",
      type: "DEDUCTION",
      isTaxable: false,
      isStatutory: true,
      description: "Statutory employee provident fund deduction (12% of basic)",
    },
    {
      code: "PT",
      name: "Professional Tax",
      type: "DEDUCTION",
      isTaxable: false,
      isStatutory: true,
      description: "State professional tax deduction",
    },
    {
      code: "TDS",
      name: "Tax Deducted at Source (TDS)",
      type: "DEDUCTION",
      isTaxable: false,
      isStatutory: true,
      description: "Monthly income tax withholding per Indian tax slabs",
    },
  ];

  for (const c of components) {
    await prisma.salaryComponent.upsert({
      where: { tenantId_code: { tenantId, code: c.code } },
      update: c,
      create: { tenantId, ...c },
    });
  }
  console.log("✓ Salary Components seeded:", components.length);

  const staffStructure = await prisma.salaryStructure.upsert({
    where: { tenantId_name: { tenantId, name: "Standard Staff Structure" } },
    update: {},
    create: {
      tenantId,
      name: "Standard Staff Structure",
      description: "Standard structure for full-time regular employees (50% Basic, 25% HRA, 10% Conveyance, 15% Special)",
      items: [
        { componentCode: "BASIC", calculationType: "PERCENTAGE_OF_BASIC", value: 50 },
        { componentCode: "HRA", calculationType: "PERCENTAGE_OF_BASIC", value: 25 },
        { componentCode: "CONVEYANCE", calculationType: "PERCENTAGE_OF_BASIC", value: 10 },
        { componentCode: "SPECIAL", calculationType: "PERCENTAGE_OF_BASIC", value: 15 },
        { componentCode: "PF", calculationType: "PERCENTAGE_OF_BASIC", value: 12 },
        { componentCode: "PT", calculationType: "FIXED", value: 200 },
      ],
    },
  });

  const execStructure = await prisma.salaryStructure.upsert({
    where: { tenantId_name: { tenantId, name: "Executive Leadership Structure" } },
    update: {},
    create: {
      tenantId,
      name: "Executive Leadership Structure",
      description: "Executive compensation template with higher allowances (50% Basic, 30% HRA, 5% Conveyance, 15% Special)",
      items: [
        { componentCode: "BASIC", calculationType: "PERCENTAGE_OF_BASIC", value: 50 },
        { componentCode: "HRA", calculationType: "PERCENTAGE_OF_BASIC", value: 30 },
        { componentCode: "CONVEYANCE", calculationType: "PERCENTAGE_OF_BASIC", value: 5 },
        { componentCode: "SPECIAL", calculationType: "PERCENTAGE_OF_BASIC", value: 15 },
        { componentCode: "PF", calculationType: "PERCENTAGE_OF_BASIC", value: 12 },
        { componentCode: "PT", calculationType: "FIXED", value: 200 },
      ],
    },
  });
  console.log("✓ Salary Structures seeded: Standard & Executive");

  // ==========================================
  // 10. Employee Salary Assignments (All 7 Staff)
  // ==========================================
  const salaryAssignments = [
    {
      personId: directorPerson.id,
      structureId: execStructure.id,
      baseGross: 120000,
      ctc: 1440000,
      paymentMode: "BANK_TRANSFER",
      bankAccount: "50100234567891",
      bankIfsc: "HDFC0001234",
      panNumber: "DRSBH1980E",
    },
    {
      personId: gauravPerson.id,
      structureId: staffStructure.id,
      baseGross: 85000,
      ctc: 1020000,
      paymentMode: "BANK_TRANSFER",
      bankAccount: "045601512345",
      bankIfsc: "ICIC0000456",
      panNumber: "GVRBH1994M",
    },
    {
      personId: hrPerson.id,
      structureId: staffStructure.id,
      baseGross: 45000,
      ctc: 540000,
      paymentMode: "BANK_TRANSFER",
      bankAccount: "20394857102",
      bankIfsc: "SBIN0007890",
      panNumber: "HRADM1992F",
    },
    {
      personId: peopleMap["vikram.m@saas-erp.local"].id,
      structureId: staffStructure.id,
      baseGross: 55000,
      ctc: 660000,
      paymentMode: "BANK_TRANSFER",
      bankAccount: "1234567890",
      bankIfsc: "KKBK0000123",
      panNumber: "VKRML1989K",
    },
    {
      personId: peopleMap["ananya.verma@saas-erp.local"].id,
      structureId: staffStructure.id,
      baseGross: 50000,
      ctc: 600000,
      paymentMode: "BANK_TRANSFER",
      bankAccount: "918020034567",
      bankIfsc: "UTIB0000345",
      panNumber: "ANYVR1996A",
    },
    {
      personId: peopleMap["rohit.j@saas-erp.local"].id,
      structureId: staffStructure.id,
      baseGross: 52000,
      ctc: 624000,
      paymentMode: "BANK_TRANSFER",
      bankAccount: "501009876543",
      bankIfsc: "HDFC0004321",
      panNumber: "RHTJS1993R",
    },
    {
      personId: peopleMap["priya.s@saas-erp.local"].id,
      structureId: staffStructure.id,
      baseGross: 35000,
      ctc: 420000,
      paymentMode: "BANK_TRANSFER",
      bankAccount: "012300150009876",
      bankIfsc: "PUNB0123400",
      panNumber: "PRYSN1998P",
    },
  ];

  for (const sa of salaryAssignments) {
    await prisma.employeeSalaryAssignment.upsert({
      where: { personId: sa.personId },
      update: {
        baseGross: sa.baseGross,
        ctc: sa.ctc,
        salaryStructureId: sa.structureId,
        paymentMode: sa.paymentMode,
        bankAccount: sa.bankAccount,
        bankIfsc: sa.bankIfsc,
        panNumber: sa.panNumber,
      },
      create: {
        tenantId,
        personId: sa.personId,
        salaryStructureId: sa.structureId,
        baseGross: sa.baseGross,
        ctc: sa.ctc,
        paymentMode: sa.paymentMode,
        bankAccount: sa.bankAccount,
        bankIfsc: sa.bankIfsc,
        panNumber: sa.panNumber,
        effectiveFrom: new Date("2025-04-01"),
      },
    });
  }
  console.log("✓ Employee Compensation Assignments seeded:", salaryAssignments.length);

  // ==========================================
  // 11. Salary Revisions & Promotion History
  // ==========================================
  const revisions = [
    {
      personId: gauravPerson.id,
      oldGross: 75000,
      newGross: 85000,
      effectiveDate: new Date("2026-07-01"),
      remarks: "Annual Performance Appraisal: Promoted to Lead Developer with superior engineering delivery rating.",
      promotedBy: directorPerson.id,
    },
    {
      personId: peopleMap["ananya.verma@saas-erp.local"].id,
      oldGross: 42000,
      newGross: 50000,
      effectiveDate: new Date("2026-08-01"),
      remarks: "Mid-Year Merit Appraisal: Commendable ownership of core backend modules.",
      promotedBy: gauravPerson.id,
    },
  ];

  for (const rev of revisions) {
    const existing = await prisma.salaryRevision.findFirst({
      where: {
        tenantId,
        personId: rev.personId,
        effectiveDate: rev.effectiveDate,
      },
    });
    if (!existing) {
      await prisma.salaryRevision.create({
        data: { tenantId, ...rev },
      });
    }
  }
  console.log("✓ Salary Revisions & Promotions seeded:", revisions.length);

  // ==========================================
  // 12. Emergency Salary Advances (Historical & Active)
  // ==========================================
  const advances = [
    // HR Administrator (Recovered in past)
    {
      personId: hrPerson.id,
      amountRequested: 25000,
      amountApproved: 25000,
      tenureMonths: 5,
      monthlyDeduction: 5000,
      amountRecovered: 25000,
      status: "RECOVERED",
      reason: "Home appliance and renovation repair advance",
      approverId: directorPerson.id,
      decisionNotes: "Approved under staff welfare policy.",
      decidedAt: new Date("2025-09-20T10:00:00Z"),
      disbursedAt: new Date("2025-09-25T11:00:00Z"),
      createdAt: new Date("2025-09-18T09:00:00Z"),
    },
    // Vikram Malhotra (Active / Recovering in Aug-Nov 2026)
    {
      personId: peopleMap["vikram.m@saas-erp.local"].id,
      amountRequested: 20000,
      amountApproved: 20000,
      tenureMonths: 4,
      monthlyDeduction: 5000,
      amountRecovered: 5000, // 1st EMI recovered in September
      status: "RECOVERING",
      reason: "Medical emergency hospital expense for father's cardiac check-up",
      approverId: directorPerson.id,
      decisionNotes: "Approved under emergency medical welfare quota.",
      decidedAt: new Date("2026-08-12T10:00:00Z"),
      disbursedAt: new Date("2026-08-15T12:00:00Z"),
      createdAt: new Date("2026-08-10T09:00:00Z"),
    },
    // Priya Singh (PENDING - Shows up in HR / Director Review Queue!)
    {
      personId: peopleMap["priya.s@saas-erp.local"].id,
      amountRequested: 15000,
      tenureMonths: 3,
      monthlyDeduction: 5000,
      amountRecovered: 0,
      status: "PENDING",
      reason: "Rental security deposit advance for apartment relocation closer to office",
      createdAt: new Date("2026-09-22T14:00:00Z"),
    },
  ];

  for (const adv of advances) {
    const existing = await prisma.salaryAdvance.findFirst({
      where: { tenantId, personId: adv.personId, reason: adv.reason },
    });
    if (!existing) {
      await prisma.salaryAdvance.create({
        data: { tenantId, ...adv },
      });
    }
  }
  console.log("✓ Emergency Salary Advances seeded (Recovered, Recovering, Pending)");

  // ==========================================
  // 13. Expense Claims Across 18 Months
  // ==========================================
  const claims = [
    // HR Administrator's own claims (Shows up in HR's "My Requests")
    {
      personId: hrPerson.id,
      title: "Annual Campus Recruitment Drive Travel & Booth Setup",
      category: "TRAVEL",
      amount: 6400,
      expenseDate: new Date("2025-06-15"),
      description: "Inter-city train tickets and local logistics for DU campus hiring fair.",
      receiptUrls: [`tenants/${tenantId}/claims/hr-campus-travel.pdf`],
      status: "SETTLED",
      approverId: directorPerson.id,
      decisionNotes: "Campus hiring logistics approved.",
      decidedAt: new Date("2025-06-18T10:00:00Z"),
      settledAt: new Date("2025-06-20T12:00:00Z"),
      settlementReference: "TXN-HR-202506-01",
    },
    {
      personId: hrPerson.id,
      title: "Annual Employee Engagement Gifts & Mementos",
      category: "SUPPLIES",
      amount: 12500,
      expenseDate: new Date("2025-12-18"),
      description: "Procurement of branded diaries, thermos flasks, and sweet boxes for year-end celebration.",
      receiptUrls: [`tenants/${tenantId}/claims/hr-gifts-receipt.pdf`],
      status: "SETTLED",
      approverId: directorPerson.id,
      decisionNotes: "Employee engagement budget approved.",
      decidedAt: new Date("2025-12-20T11:00:00Z"),
      settledAt: new Date("2025-12-22T15:00:00Z"),
      settlementReference: "TXN-HR-202512-09",
    },
    {
      personId: hrPerson.id,
      title: "POSH & Workplace Safety Workshop Refreshments",
      category: "FOOD",
      amount: 4200,
      expenseDate: new Date("2026-08-14"),
      description: "High tea and catering for 25 attendees during external POSH compliance trainer session.",
      receiptUrls: [`tenants/${tenantId}/claims/hr-posh-catering.pdf`],
      status: "SETTLED",
      approverId: directorPerson.id,
      decisionNotes: "Statutory workshop expense approved.",
      decidedAt: new Date("2026-08-16T10:00:00Z"),
      settledAt: new Date("2026-08-18T14:00:00Z"),
      settlementReference: "TXN-HR-202608-22",
    },
    {
      personId: hrPerson.id,
      title: "Emergency First Aid & Health Restocking",
      category: "SUPPLIES",
      amount: 2100,
      expenseDate: new Date("2026-09-24"),
      description: "Refilled office medical first aid kit, blood pressure monitor batteries, and sanitizers.",
      receiptUrls: [`tenants/${tenantId}/claims/hr-firstaid-pharmacy.pdf`],
      status: "SUBMITTED",
    },
    // Vikram Malhotra (Finance)
    {
      personId: peopleMap["vikram.m@saas-erp.local"].id,
      title: "Client Audit & Statutory Tax Filing Travel",
      category: "TRAVEL",
      amount: 4850,
      expenseDate: new Date("2026-09-08"),
      description: "Cab & express train travel to Appellate Tribunal and Registrar of Societies for statutory filing.",
      receiptUrls: [`tenants/${tenantId}/claims/seed-travel-ticket.pdf`],
      status: "APPROVED",
      approverId: directorPerson.id,
      decisionNotes: "Auditing travel receipts verified and approved.",
      decidedAt: new Date("2026-09-10T14:30:00Z"),
    },
    // Gaurav Bhindwar (Lead Dev)
    {
      personId: gauravPerson.id,
      title: "Dev Cloud Hardware & Biometric Readers",
      category: "SUPPLIES",
      amount: 7200,
      expenseDate: new Date("2026-09-12"),
      description: "Procured multi-port USB test fixtures and optical biometric scanner modules for mobile offline sync tests.",
      receiptUrls: [`tenants/${tenantId}/claims/seed-hardware-invoice.pdf`],
      status: "SETTLED",
      approverId: directorPerson.id,
      decisionNotes: "Essential R&D engineering equipment. Approved for immediate settlement.",
      decidedAt: new Date("2026-09-13T10:00:00Z"),
      settledAt: new Date("2026-09-15T15:00:00Z"),
      settlementReference: "TXN-SETTLE-889912",
    },
    // Priya Singh (Operations) - Reports to HR (Shows in HR's Review Queue!)
    {
      personId: peopleMap["priya.s@saas-erp.local"].id,
      title: "Field Volunteer Logistics Mobile SIM Recharges",
      category: "COMMUNICATION",
      amount: 1500,
      expenseDate: new Date("2026-09-20"),
      description: "Monthly 5G data packages for 3 community outreach coordinators.",
      receiptUrls: [`tenants/${tenantId}/claims/seed-sim-recharges.pdf`],
      status: "SUBMITTED",
    },
    // Ananya Verma (Tech)
    {
      personId: peopleMap["ananya.verma@saas-erp.local"].id,
      title: "Cloud Architecture Examination Fee",
      category: "OTHER",
      amount: 3200,
      expenseDate: new Date("2026-09-15"),
      description: "Upskilling reimbursement for AWS Certified Developer Associate examination voucher.",
      receiptUrls: [`tenants/${tenantId}/claims/seed-aws-exam.pdf`],
      status: "APPROVED",
      approverId: gauravPerson.id,
      decisionNotes: "Upskilling voucher approved per tech department policy.",
      decidedAt: new Date("2026-09-16T17:00:00Z"),
    },
  ];

  for (const claim of claims) {
    const existing = await prisma.expenseClaim.findFirst({
      where: { tenantId, personId: claim.personId, title: claim.title },
    });
    if (!existing) {
      if (claim.receiptUrls && claim.receiptUrls[0]) {
        try {
          await s3.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: claim.receiptUrls[0],
              Body: samplePdfBytes,
              ContentType: "application/pdf",
            })
          );
        } catch { }
      }
      await prisma.expenseClaim.create({
        data: { tenantId, ...claim },
      });
    }
  }
  console.log("✓ Expense Claims seeded across 18 months (Settled, Approved, Submitted)");

  // ==============================================================
  // 14. 18 Months of Payroll Runs & Detailed Itemized Payslips
  // Months: April 2025 (2025-04) to September 2026 (2026-09)
  // ==============================================================
  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const monthsToSeed = [];
  // 2025: Months 4 to 12
  for (let m = 4; m <= 12; m++) monthsToSeed.push({ year: 2025, month: m });
  // 2026: Months 1 to 9
  for (let m = 1; m <= 9; m++) monthsToSeed.push({ year: 2026, month: m });

  console.log(`Generating 18 payroll cycles and payslips across ${monthsToSeed.length} months...`);

  // Staff members eligible for payroll
  const staffMembers = [
    { person: directorPerson, base: 120000 },
    { person: gauravPerson, base: 85000 }, // Was 75k before July 2026
    { person: hrPerson, base: 45000 },
    { person: peopleMap["vikram.m@saas-erp.local"], base: 55000 },
    { person: peopleMap["ananya.verma@saas-erp.local"], base: 50000 }, // Was 42k before Aug 2026
    { person: peopleMap["rohit.j@saas-erp.local"], base: 52000 },
    { person: peopleMap["priya.s@saas-erp.local"], base: 35000 },
  ];

  let totalPayslipsSeeded = 0;

  for (const { year, month } of monthsToSeed) {
    const daysInMonth = new Date(year, month, 0).getDate();
    // Count weekdays
    let workingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(Date.UTC(year, month - 1, d));
      const dow = dt.getUTCDay();
      if (dow !== 0 && dow !== 6) workingDays++;
    }

    const isCurrentCycle = (year === 2026 && month === 9);
    const runStatus = isCurrentCycle ? "APPROVED" : "DISBURSED";
    const runTitle = `${MONTH_NAMES[month - 1]} ${year} Payroll Cycle`;

    let run = await prisma.payrollRun.findUnique({
      where: { tenantId_year_month: { tenantId, year, month } },
    });

    const approvedAt = new Date(Date.UTC(year, month - 1, daysInMonth, 17, 0, 0));
    const disbursedAt = isCurrentCycle ? null : new Date(Date.UTC(year, month - 1, daysInMonth, 18, 0, 0));

    if (!run) {
      run = await prisma.payrollRun.create({
        data: {
          tenantId,
          year,
          month,
          title: runTitle,
          status: runStatus,
          approvedBy: directorPerson.id,
          approvedAt,
          disbursedAt,
          notes: `Official monthly payroll cycle for ${MONTH_NAMES[month - 1]} ${year} with statutory deductions and attendance reconciliation.`,
        },
      });
    } else {
      run = await prisma.payrollRun.update({
        where: { id: run.id },
        data: {
          status: runStatus,
          approvedBy: directorPerson.id,
          approvedAt,
          disbursedAt,
        },
      });
    }

    let cycleGross = 0;
    let cycleDeductions = 0;
    let cycleNet = 0;

    for (const staff of staffMembers) {
      let baseGross = staff.base;
      // Account for past salary revisions:
      if (staff.person.id === gauravPerson.id && (year < 2026 || (year === 2026 && month < 7))) {
        baseGross = 75000;
      }
      if (staff.person.id === peopleMap["ananya.verma@saas-erp.local"].id && (year < 2026 || (year === 2026 && month < 8))) {
        baseGross = 42000;
      }

      // Attendance / LOP logic:
      let presentDays = workingDays;
      let lopDays = 0;

      // Special demonstration cases in Sept 2026:
      if (year === 2026 && month === 9) {
        if (staff.person.id === peopleMap["ananya.verma@saas-erp.local"].id) {
          lopDays = 1;
          presentDays = workingDays - 1;
        } else if (staff.person.id === peopleMap["rohit.j@saas-erp.local"].id) {
          lopDays = 2;
          presentDays = workingDays - 2;
        }
      }

      const payableDays = workingDays - lopDays;
      const attFactor = workingDays > 0 ? payableDays / workingDays : 1;

      // Earnings breakdown
      const basic = Math.round(baseGross * 0.5 * attFactor);
      const hra = Math.round(baseGross * 0.25 * attFactor);
      const conveyance = Math.round(baseGross * 0.1 * attFactor);
      const special = Math.max(0, Math.round(baseGross * attFactor) - (basic + hra + conveyance));
      const grossPay = basic + hra + conveyance + special;

      // Statutory deductions
      const pf = Math.round(basic * 0.12);
      const pt = baseGross > 20000 ? 200 : 0;
      const tds = baseGross > 50000 ? Math.round(baseGross * 0.05) : 0;

      const earnings = [
        { code: "BASIC", name: "Basic Salary", amount: basic },
        { code: "HRA", name: "House Rent Allowance", amount: hra },
        { code: "CONVEYANCE", name: "Conveyance Allowance", amount: conveyance },
        { code: "SPECIAL", name: "Special Allowance", amount: special },
      ];

      const deductions = [
        { code: "PF", name: "Provident Fund (Employee)", amount: pf },
        { code: "PT", name: "Professional Tax", amount: pt },
      ];
      if (tds > 0) {
        deductions.push({ code: "TDS", name: "TDS / Income Tax", amount: tds });
      }

      // Check for salary advance EMI recovery:
      // Vikram Malhotra: ₹5,000 EMI in Aug & Sep 2026
      if (staff.person.id === peopleMap["vikram.m@saas-erp.local"].id && year === 2026 && (month === 8 || month === 9)) {
        deductions.push({
          code: "ADVANCE_EMI",
          name: "Salary Advance Recovery (Medical Emergency)",
          amount: 5000,
        });
      }

      // HR Administrator: ₹5,000 EMI between Oct 2025 and Feb 2026
      if (staff.person.id === hrPerson.id && ((year === 2025 && month >= 10) || (year === 2026 && month <= 2))) {
        deductions.push({
          code: "ADVANCE_EMI",
          name: "Salary Advance Recovery (Staff Welfare)",
          amount: 5000,
        });
      }

      const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
      const netPay = grossPay - totalDeductions;

      cycleGross += grossPay;
      cycleDeductions += totalDeductions;
      cycleNet += netPay;

      const paymentStatus = isCurrentCycle ? "APPROVED" : "PAID";
      const paymentRef = isCurrentCycle ? null : `NEFT-${year}${String(month).padStart(2, "0")}-${Math.floor(100000 + Math.random() * 900000)}`;

      await prisma.payslip.upsert({
        where: {
          tenantId_payrollRunId_personId: {
            tenantId,
            payrollRunId: run.id,
            personId: staff.person.id,
          },
        },
        update: {
          totalWorkingDays: workingDays,
          presentDays,
          lopDays,
          earnings,
          deductions,
          grossPay,
          totalDeductions,
          netPay,
          paymentStatus,
          paymentReference: paymentRef,
        },
        create: {
          tenantId,
          payrollRunId: run.id,
          personId: staff.person.id,
          year,
          month,
          totalWorkingDays: workingDays,
          presentDays,
          lopDays,
          earnings,
          deductions,
          grossPay,
          totalDeductions,
          netPay,
          paymentStatus,
          paymentReference: paymentRef,
        },
      });

      totalPayslipsSeeded++;
    }

    await prisma.payrollRun.update({
      where: { id: run.id },
      data: {
        totalGross: cycleGross,
        totalDeductions: cycleDeductions,
        totalNet: cycleNet,
        processedStaffCount: staffMembers.length,
      },
    });
  }
  console.log(`✓ 18 Payroll Cycles & ${totalPayslipsSeeded} detailed payslips backfilled successfully!`);

  // ==============================================================
  // 15. 18 Months of Attendance Records Backfill
  // ==============================================================
  console.log("Generating weekday attendance punches for all staff across past 18 months...");
  const allPeople = Object.values(peopleMap);

  let attendanceCount = 0;
  for (const { year, month } of monthsToSeed) {
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month - 1, day));
      const dow = date.getUTCDay();
      if (dow === 0 || dow === 6) continue; // Skip weekends

      for (const p of allPeople) {
        let status = "PRESENT";
        let mode = p.personType === "VOLUNTEER" ? "FIELD" : "OFFICE";

        // Random realistic punch times:
        // Check-in between 09:10 and 09:35 AM
        const checkInMin = Math.floor(Math.random() * 25) + 10;
        const checkInTime = new Date(date.getTime() + (9 * 60 + checkInMin) * 60 * 1000);

        // Check-out between 18:05 and 18:40 PM
        const checkOutMin = Math.floor(Math.random() * 35) + 5;
        const checkOutTime = new Date(date.getTime() + (18 * 60 + checkOutMin) * 60 * 1000);

        // LOP cases in Sep 2026
        if (year === 2026 && month === 9) {
          if (p.email === "ananya.verma@saas-erp.local" && day === 18) {
            status = "ABSENT";
          } else if (p.email === "rohit.j@saas-erp.local" && (day === 24 || day === 25)) {
            status = "ABSENT";
          } else if (p.email === "vikram.m@saas-erp.local" && (day === 14 || day === 15)) {
            status = "ON_LEAVE";
          }
        }

        await prisma.attendance.upsert({
          where: { tenantId_personId_date: { tenantId, personId: p.id, date } },
          update: { status, mode, checkInTime, checkOutTime },
          create: {
            tenantId,
            personId: p.id,
            date,
            checkInTime,
            checkOutTime: status === "PRESENT" ? checkOutTime : null,
            status,
            mode,
            locationName: mode === "FIELD" ? "Community Outreach Centre, Delhi" : "Head Office, Delhi",
            verificationStatus: "VERIFIED",
            verificationMode: "ONLINE",
          },
        });
        attendanceCount++;
      }
    }
  }

  // Also seed today's live attendance
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const person of allPeople) {
    await prisma.attendance.upsert({
      where: { tenantId_personId_date: { tenantId, personId: person.id, date: today } },
      update: {},
      create: {
        tenantId,
        personId: person.id,
        date: today,
        checkInTime: new Date(today.getTime() + 9.3 * 3600 * 1000),
        checkOutTime: null,
        status: "PRESENT",
        mode: person.personType === "VOLUNTEER" ? "FIELD" : "OFFICE",
        locationName: person.personType === "VOLUNTEER" ? "Community Outreach Centre, Delhi" : "Head Office, Delhi",
        verificationStatus: "VERIFIED",
        verificationMode: "ONLINE",
      },
    });
  }
  console.log(`✓ Seeded ${attendanceCount} historical attendance punches + today's live status`);

  console.log("==========================================================");
  console.log("🎉 Complete 18-Month Dataset Successfully Backfilled!");
  console.log("==========================================================");
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
