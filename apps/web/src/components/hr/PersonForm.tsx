import { useMemo, useState, type ReactNode } from "react";
import { Briefcase, HeartHandshake, MapPin, Phone, User, UserCheck } from "lucide-react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { DatePicker } from "../ui/date-picker";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { PhoneField } from "../profile/EditProfileModal";
import { toast } from "../ui/toast";
import {
  EMERGENCY_RELATIONS,
  GENDER_OPTIONS,
  INPUT_LIMITS,
  REGEX_PATTERNS,
  formatEmergencyContact,
  fullName,
  normalizeGender,
  parseEmergencyContact,
  validatePersonContact,
} from "../../lib/input-constraints";
import { cn } from "../../lib/utils";
import { useMe } from "../../auth/use-me";

export interface PersonFormOption {
  id: string;
  name: string;
}

export interface PersonFormManager {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email?: string;
  status?: string;
  departmentId?: string | null;
  department?: { name: string } | null;
  designation?: { name: string } | null;
}

/** Existing person (edit mode). Extra fields on the caller's type are fine. */
export interface PersonFormPerson {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email?: string;
  phone?: string | null;
  altPhone?: string | null;
  gender?: string | null;
  dob?: string | null;
  address?: string | null;
  currentAddress?: string | null;
  permanentAddress?: string | null;
  emergencyContact?: string | null;
  departmentId?: string | null;
  designationId?: string | null;
  managerId?: string | null;
  directReports?: { id: string }[];
}

export interface PersonFormProps {
  mode: "create" | "edit";
  person?: PersonFormPerson;
  departments?: PersonFormOption[];
  designations?: PersonFormOption[];
  /** Candidate managers; the form excludes the person being edited and their direct reports. */
  managers?: PersonFormManager[];
  /** Preset and lock the department (create mode). */
  lockedDepartmentId?: string;
  isSubmitting?: boolean;
  submitLabel?: string;
  onCancel: () => void;
  /** Receives the request body for POST /hr/persons (create) or PATCH /hr/persons/:id (edit). */
  onSubmit: (payload: Record<string, unknown>) => void;
}

function Section({ icon: Icon, title, children }: { icon: typeof User; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">{title}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-xs font-medium text-foreground block">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-500 leading-tight">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground leading-tight">{hint}</p>
      ) : null}
    </div>
  );
}

const invalid = (err?: string) => (err ? "border-red-500 focus-visible:border-red-500" : "");

export function PersonForm({
  mode,
  person,
  departments,
  designations,
  managers,
  lockedDepartmentId,
  isSubmitting,
  submitLabel,
  onCancel,
  onSubmit,
}: PersonFormProps) {
  const isEdit = mode === "edit";
  const init = useMemo(() => {
    const currentAddr = person?.currentAddress || person?.address || "";
    const permAddr = person?.permanentAddress || "";
    const parsed = parseEmergencyContact(person?.emergencyContact);
    return {
      firstName: person?.firstName || "",
      middleName: person?.middleName || "",
      lastName: person?.lastName || "",
      gender: normalizeGender(person?.gender),
      dob: person?.dob ? person.dob.slice(0, 10) : "",
      email: person?.email || "",
      phone: person?.phone || "",
      altPhone: person?.altPhone || "",
      currentAddress: currentAddr,
      permanentAddress: permAddr,
      sameAddress: !permAddr || permAddr === currentAddr,
      emergencyPhone: parsed.phone,
      emergencyRelation: parsed.relation || "Spouse",
      emergencyName: parsed.name,
      departmentId: lockedDepartmentId || person?.departmentId || "",
      designationId: person?.designationId || "",
      managerId: person?.managerId || "",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [personType, setPersonType] = useState<"EMPLOYEE" | "VOLUNTEER">("EMPLOYEE");
  const [firstName, setFirstName] = useState(init.firstName);
  const [middleName, setMiddleName] = useState(init.middleName);
  const [lastName, setLastName] = useState(init.lastName);
  const [gender, setGender] = useState(init.gender);
  const [dob, setDob] = useState(init.dob);
  const [email, setEmail] = useState(init.email);
  const [phone, setPhone] = useState(init.phone);
  const [altPhone, setAltPhone] = useState(init.altPhone);
  const [currentAddress, setCurrentAddress] = useState(init.currentAddress);
  const [permanentAddress, setPermanentAddress] = useState(init.permanentAddress);
  const [sameAddress, setSameAddress] = useState(init.sameAddress);
  const [emergencyPhone, setEmergencyPhone] = useState(init.emergencyPhone);
  const [emergencyRelation, setEmergencyRelation] = useState<string>(init.emergencyRelation);
  const [emergencyName, setEmergencyName] = useState(init.emergencyName);
  const [departmentId, setDepartmentId] = useState(init.departmentId);
  const [designationId, setDesignationId] = useState(init.designationId);
  const [managerId, setManagerId] = useState(init.managerId);
  const [joiningDate, setJoiningDate] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const { data: me } = useMe();
  const canSetSalary = !isEdit && personType === "EMPLOYEE" && !!me?.permissionKeys?.includes("payroll.salary.manage");
  const [monthlyGross, setMonthlyGross] = useState("");
  const grossNum = Number(monthlyGross);
  const grossValid = monthlyGross === "" || (Number.isFinite(grossNum) && grossNum >= 0 && grossNum <= 10000000);

  const contactErrors = validatePersonContact({ phone, altPhone, gender, dob, emergencyPhone });
  const errors: Record<string, string> = { ...contactErrors };
  if (canSetSalary && !grossValid) errors.monthlyGross = "Please enter a valid monthly salary.";
  if (!firstName.trim()) errors.firstName = "Please enter the first name.";
  if (!lastName.trim()) errors.lastName = "Please enter the last name.";
  if (!isEdit && !REGEX_PATTERNS.EMAIL.test(email.trim())) errors.email = "Please enter a valid email address.";

  // Legacy records missing required details are highlighted straight away.
  const [showErrors, setShowErrors] = useState(
    () =>
      isEdit &&
      Object.keys(
        validatePersonContact({ phone: init.phone, gender: init.gender, dob: init.dob }),
      ).length > 0,
  );
  const err = (k: string) => (showErrors ? errors[k] : undefined);

  const managerOptions = useMemo(() => {
    const blocked = new Set<string>(person?.directReports?.map((r) => r.id) ?? []);
    if (person?.id) blocked.add(person.id);
    return (managers ?? []).filter((m) => m.status !== "EXITED" && !blocked.has(m.id));
  }, [managers, person]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      toast.error("Missing details", "Please check the highlighted fields and try again.");
      return;
    }
    const emergencyContact = formatEmergencyContact(emergencyPhone, emergencyRelation, emergencyName);
    const curr = currentAddress.trim();
    const perm = sameAddress ? curr : permanentAddress.trim();

    if (isEdit) {
      onSubmit({
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        altPhone: altPhone.trim(),
        gender,
        dob,
        departmentId: departmentId || null,
        designationId: designationId || null,
        managerId: managerId || null,
        currentAddress: curr,
        permanentAddress: perm,
        address: curr,
        emergencyContact,
      });
      return;
    }
    onSubmit({
      personType,
      firstName: firstName.trim(),
      middleName: middleName.trim() || undefined,
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      altPhone: altPhone.trim() || undefined,
      gender,
      dob,
      currentAddress: curr || undefined,
      permanentAddress: perm || undefined,
      address: curr || undefined,
      emergencyContact: emergencyContact || undefined,
      departmentId: departmentId || undefined,
      designationId: designationId || undefined,
      managerId: managerId || undefined,
      joiningDate: joiningDate ? new Date(joiningDate).toISOString() : undefined,
      sendInvite,
      monthlyGross: canSetSalary && grossNum > 0 ? Math.round(grossNum * 100) / 100 : undefined,
    });
  };

  const typeBtn = (value: "EMPLOYEE" | "VOLUNTEER", Icon: typeof User, text: string) => (
    <button
      type="button"
      onClick={() => setPersonType(value)}
      aria-pressed={personType === value}
      className={cn(
        "flex items-center justify-center gap-2 h-9 rounded-xl border text-sm font-medium transition-colors cursor-pointer",
        personType === value
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {text}
    </button>
  );

  const managerLabel = (m: PersonFormManager) =>
    `${fullName(m)} — ${m.designation?.name || m.email || "No designation"}${m.department?.name ? ` (${m.department.name})` : ""}`;

  return (
    <form onSubmit={submit} noValidate className="space-y-6 pt-1">
      <Section icon={User} title="Basic details">
        <Field label="First name" required error={err("firstName")}>
          <Input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={INPUT_LIMITS.PERSON_NAME_MAX}
            className={invalid(err("firstName"))}
            placeholder="Ramesh"
          />
        </Field>
        <Field label="Middle name">
          <Input
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
            maxLength={INPUT_LIMITS.PERSON_NAME_MAX}
            placeholder="Optional"
          />
        </Field>
        <Field label="Last name" required error={err("lastName")}>
          <Input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            maxLength={INPUT_LIMITS.PERSON_NAME_MAX}
            className={invalid(err("lastName"))}
            placeholder="Kumar"
          />
        </Field>
        <Select label="Gender" required value={gender} onChange={(e) => setGender(e.target.value)} error={err("gender")}>
          <option value="">Select gender</option>
          {GENDER_OPTIONS.map((g) => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </Select>
        <DatePicker
          label="Date of birth"
          isRequired
          value={dob}
          onChange={(val) => setDob(val)}
          maxDate={new Date()}
          error={err("dob")}
        />
        {!isEdit && (
          <Field label="Person type">
            <div className="grid grid-cols-2 gap-2">
              {typeBtn("EMPLOYEE", Briefcase, "Employee")}
              {typeBtn("VOLUNTEER", UserCheck, "Volunteer")}
            </div>
          </Field>
        )}
      </Section>

      <Section icon={Phone} title="Contact">
        <Field label="Email" required error={err("email")} className={isEdit ? "md:col-span-2" : undefined}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={INPUT_LIMITS.EMAIL_MAX}
            disabled={isEdit}
            className={invalid(err("email"))}
            placeholder="ramesh@example.org"
          />
        </Field>
        <PhoneField label="Phone" required value={phone} onChange={setPhone} placeholder="Mobile number" error={err("phone")} />
        <PhoneField
          label="Alternate mobile"
          value={altPhone}
          onChange={setAltPhone}
          placeholder="Optional"
          error={err("altPhone")}
        />
      </Section>

      <Section icon={MapPin} title="Address">
        <Field label="Current address" className="md:col-span-2">
          <Input
            value={currentAddress}
            onChange={(e) => setCurrentAddress(e.target.value)}
            maxLength={INPUT_LIMITS.ADDRESS_MAX}
            placeholder="Flat/House, Street, City, State, Pincode"
          />
        </Field>
        <div className="md:col-span-2 space-y-2">
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none w-fit">
            <Checkbox checked={sameAddress} onChange={(e) => setSameAddress(e.target.checked)} />
            Same as current address
          </label>
          {!sameAddress && (
            <Field label="Permanent address">
              <Input
                value={permanentAddress}
                onChange={(e) => setPermanentAddress(e.target.value)}
                maxLength={INPUT_LIMITS.ADDRESS_MAX}
                placeholder="Hometown / permanent address"
              />
            </Field>
          )}
        </div>
      </Section>

      <Section icon={HeartHandshake} title="Emergency contact (optional)">
        <PhoneField
          label="Phone"
          value={emergencyPhone}
          onChange={setEmergencyPhone}
          placeholder="Emergency contact phone"
          error={err("emergencyPhone")}
        />
        <Select label="Relation" value={emergencyRelation} onChange={(e) => setEmergencyRelation(e.target.value)}>
          {EMERGENCY_RELATIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </Select>
        <Field label="Contact person name" className="md:col-span-2">
          <Input
            value={emergencyName}
            onChange={(e) => setEmergencyName(e.target.value)}
            maxLength={INPUT_LIMITS.EMERGENCY_NAME_MAX}
            placeholder="e.g. Priya Sharma"
          />
        </Field>
      </Section>

      <Section icon={Briefcase} title="Work">
        <Select
          label="Department"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          disabled={Boolean(lockedDepartmentId)}
        >
          <option value="">None</option>
          {departments?.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </Select>
        <Select label="Designation" value={designationId} onChange={(e) => setDesignationId(e.target.value)}>
          <option value="">None</option>
          {designations?.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </Select>
        <Select
          label="Reports to"
          value={managerId}
          onChange={(e) => setManagerId(e.target.value)}
          helperText="Who this person reports to."
        >
          <option value="">No one</option>
          {managerOptions.map((m) => (
            <option key={m.id} value={m.id}>{managerLabel(m)}</option>
          ))}
        </Select>
        {!isEdit && <DatePicker label="Joining date" value={joiningDate} onChange={(val) => setJoiningDate(val)} />}
        {canSetSalary && (
          <Field label="Monthly salary (₹)" error={err("monthlyGross")}>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              max={10000000}
              step="0.01"
              value={monthlyGross}
              onChange={(e) => setMonthlyGross(e.target.value)}
              placeholder="Optional"
            />
            {grossValid && grossNum > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Annual CTC ₹{(grossNum * 12).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </p>
            )}
          </Field>
        )}
      </Section>

      {!isEdit && (
        <label className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-3 text-sm text-foreground cursor-pointer select-none">
          <Checkbox className="mt-0.5" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} />
          <span>Send login invitation by email</span>
        </label>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : submitLabel || (isEdit ? "Save changes" : "Create")}
        </Button>
      </div>
    </form>
  );
}
