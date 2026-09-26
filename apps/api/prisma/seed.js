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
      url: process.env.DIRECT_URL || "postgresql://saaserp:saaserp_dev_password@localhost:5433/saaserp?schema=public",
    },
  },
});

async function main() {
  console.log("Starting data seeding...");

  // Find target tenant
  const tenant = await prisma.tenant.findFirst({
    where: { slug: "jiorasacchisahelitest1" },
    include: { users: true },
  });

  if (!tenant) {
    console.error("Target tenant jiorasacchisahelitest1 not found.");
    return;
  }

  const tenantId = tenant.id;
  console.log(`Seeding data for tenant: ${tenant.name} (${tenantId})`);

  // 1. Departments
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
    const d = await prisma.department.upsert({
      where: { tenantId_name: { tenantId, name } },
      update: {},
      create: { tenantId, name },
    });
    deptMap[name] = d.id;
  }
  console.log("✓ Departments seeded:", Object.keys(deptMap).length);

  // 2. Designations
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
    const d = await prisma.designation.upsert({
      where: { tenantId_name: { tenantId, name } },
      update: {},
      create: { tenantId, name },
    });
    desigMap[name] = d.id;
  }
  console.log("✓ Designations seeded:", Object.keys(desigMap).length);

  // 3. Update existing users with avatar & phone
  const hrUser = tenant.users.find((u) => u.email === "hr@saas-erp.local");
  const gauravUser = tenant.users.find((u) => u.email === "gaurav@saas-erp.local");

  if (hrUser) {
    await prisma.user.update({
      where: { id: hrUser.id },
      data: {
        phone: "+91 9876543210",
        departmentId: deptMap["Human Resources"],
        designationId: desigMap["HR Executive"],
        avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80",
      },
    });
  }

  if (gauravUser) {
    await prisma.user.update({
      where: { id: gauravUser.id },
      data: {
        phone: "+91 9988776655",
        departmentId: deptMap["Technology & Engineering"],
        designationId: desigMap["Lead Developer"],
        avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80",
      },
    });
  }

  // 4. Seed Persons
  // Director / Top Executive (Reporting Manager: None)
  let directorPerson = await prisma.person.findFirst({
    where: { tenantId, email: "director@saas-erp.local" },
  });
  if (!directorPerson) {
    directorPerson = await prisma.person.create({
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
  } else {
    directorPerson = await prisma.person.update({
      where: { id: directorPerson.id },
      data: {
        departmentId: deptMap["Executive Leadership"],
        designationId: desigMap["Executive Director"],
        managerId: null,
      },
    });
  }

  // HR Person (reports to Director)
  let hrPerson = await prisma.person.findFirst({
    where: { tenantId, email: "hr@saas-erp.local" },
  });
  if (!hrPerson) {
    hrPerson = await prisma.person.create({
      data: {
        tenantId,
        userId: hrUser?.id,
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
  } else {
    hrPerson = await prisma.person.update({
      where: { id: hrPerson.id },
      data: {
        userId: hrUser?.id,
        departmentId: deptMap["Human Resources"],
        designationId: desigMap["HR Executive"],
        managerId: directorPerson.id,
        phone: "+91 9876543210",
        avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80",
      },
    });
  }

  // Gaurav Person (Lead Developer, reports to Director)
  let gauravPerson = await prisma.person.findFirst({
    where: { tenantId, email: "gaurav@saas-erp.local" },
  });
  if (!gauravPerson) {
    gauravPerson = await prisma.person.create({
      data: {
        tenantId,
        userId: gauravUser?.id,
        firstName: "Gaurav",
        lastName: "Sharma",
        email: "gaurav@saas-erp.local",
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
  } else {
    gauravPerson = await prisma.person.update({
      where: { id: gauravPerson.id },
      data: {
        userId: gauravUser?.id,
        departmentId: deptMap["Technology & Engineering"],
        designationId: desigMap["Lead Developer"],
        managerId: directorPerson.id,
      },
    });
  }

  // Employees & Volunteers
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
      managerId: hrPerson.id,
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
      managerId: hrPerson.id,
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

  // Update Arjun Patel's manager to Neha Kapoor (Volunteer Lead)
  if (peopleMap["neha.k@saas-erp.local"] && peopleMap["arjun.p@saas-erp.local"]) {
    await prisma.person.update({
      where: { id: peopleMap["arjun.p@saas-erp.local"].id },
      data: { managerId: peopleMap["neha.k@saas-erp.local"].id },
    });
  }
  console.log("✓ Person Master seeded:", Object.keys(peopleMap).length);

  // 5. Seed KYC & Other Documents
  const s3 = new S3Client({
    endpoint: `http://${process.env.MINIO_ENDPOINT || "localhost"}:${process.env.MINIO_PORT || "9010"}`,
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY || "saaserp",
      secretAccessKey: process.env.MINIO_SECRET_KEY || "saaserp_dev_password",
    },
    forcePathStyle: true,
  });

  const bucket = process.env.MINIO_BUCKET || "saas-erp-documents";
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    } catch {}
  }

  const samplePdfBytes = Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF`
  );

  const documents = [
    // HR person
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
      status: "PENDING",
      fileKey: `tenants/${tenantId}/persons/${hrPerson.id}/KYC/seed-pan.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 980400,
    },
    // Gaurav person
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
    // Ananya Verma
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
    // Priya Singh (Rejected KYC demo)
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
    // Neha Kapoor (Volunteer)
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
    } catch (err) {
      console.warn("Could not upload seed doc to MinIO:", err.message);
    }

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

  // 6. Seed Leave Types
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

  // 7. Seed Holidays
  const holidays = [
    { name: "Gandhi Jayanti", date: new Date("2026-10-02"), isOptional: false },
    { name: "Dussehra", date: new Date("2026-10-20"), isOptional: false },
    { name: "Diwali (Deepavali)", date: new Date("2026-11-08"), isOptional: false },
    { name: "Govardhan Puja", date: new Date("2026-11-09"), isOptional: true },
    { name: "Christmas Day", date: new Date("2026-12-25"), isOptional: false },
    { name: "New Year's Day", date: new Date("2027-01-01"), isOptional: true },
  ];

  for (const h of holidays) {
    await prisma.holiday.upsert({
      where: { tenantId_date_name: { tenantId, date: h.date, name: h.name } },
      update: {},
      create: { tenantId, ...h },
    });
  }
  console.log("✓ Holidays seeded:", holidays.length);

  // 8. Seed Attendance for today and yesterday
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const p of Object.values(peopleMap)) {
    // Yesterday's attendance
    await prisma.attendance.upsert({
      where: { tenantId_personId_date: { tenantId, personId: p.id, date: yesterday } },
      update: {},
      create: {
        tenantId,
        personId: p.id,
        date: yesterday,
        checkInTime: new Date(yesterday.getTime() + 9.5 * 3600 * 1000), // 09:30 AM
        checkOutTime: new Date(yesterday.getTime() + 18.5 * 3600 * 1000), // 06:30 PM
        status: "PRESENT",
        mode: "OFFICE",
        locationName: "Head Office, Delhi",
      },
    });

    // Today's attendance
    await prisma.attendance.upsert({
      where: { tenantId_personId_date: { tenantId, personId: p.id, date: today } },
      update: {},
      create: {
        tenantId,
        personId: p.id,
        date: today,
        checkInTime: new Date(today.getTime() + 9.25 * 3600 * 1000), // 09:15 AM
        checkOutTime: null,
        status: "PRESENT",
        mode: p.personType === "VOLUNTEER" ? "FIELD" : "OFFICE",
        locationName: p.personType === "VOLUNTEER" ? "Community Centre, Delhi" : "Head Office, Delhi",
      },
    });
  }
  console.log("✓ Attendance records seeded");

  console.log("All seed data successfully injected into the system!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
