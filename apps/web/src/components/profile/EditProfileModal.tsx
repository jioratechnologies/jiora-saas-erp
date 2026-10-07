import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Phone,
  Mail,
  ShieldCheck,
  FileText,
  UploadCloud,
  CheckCircle2,
  Clock,
  XCircle,
  Download,
  Trash2,
  AlertTriangle,
  Camera,
  MapPin,
  HeartHandshake,
  Users,
} from "lucide-react";
import { api } from "../../api/client";
import { useAuthStore } from "../../auth/auth-store";
import { useMe } from "../../auth/use-me";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Avatar } from "../ui/avatar";
import { Select } from "../ui/select";
import { DatePicker } from "../ui/date-picker";
import { PhoneInput } from "../ui/phone-input";
import { FileDropzone } from "../ui/file-dropzone";
import { toast } from "../ui/toast";
import { formatErrorMessage } from "../../lib/error-formatter";
import {
  INPUT_LIMITS,
  EMERGENCY_RELATIONS,
  parseEmergencyContact,
  formatEmergencyContact,
  GENDER_OPTIONS,
  normalizeGender,
  validatePersonContact,
  type EmergencyRelation,
} from "../../lib/input-constraints";
import type { PersonDocumentItem } from "@saas-erp/shared-types";
import { cn } from "../../lib/utils";
import { KYC_ID_TYPES, OTHER_ID_TYPE, kycHint } from "../../lib/kyc-types";

/** PhoneInput with a red-asterisk label and inline error (PhoneInput itself has no error slot). */
export function PhoneField({
  label,
  required,
  error,
  value,
  onChange,
  placeholder,
  id,
}: {
  label: string;
  required?: boolean;
  error?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-foreground block">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <div className={cn(error && "rounded-xl ring-1 ring-red-500")}>
        <PhoneInput id={id} value={value} onChange={onChange} placeholder={placeholder} />
      </div>
      {error && <p className="text-xs text-red-500 leading-tight">{error}</p>}
    </div>
  );
}

interface ProfileResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
    phone?: string | null;
    avatarUrl?: string | null;
    department?: string | null;
    designation?: string | null;
    roles: string[];
  } | null;
  person?: {
    id: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    email: string;
    phone?: string | null;
    altPhone?: string | null;
    gender?: string | null;
    dob?: string | null;
    address?: string | null;
    currentAddress?: string | null;
    permanentAddress?: string | null;
    emergencyContact?: string | null;
    status: string;
    personType: string;
    avatarUrl?: string | null;
    department?: string | null;
    designation?: string | null;
    joiningDate?: string | null;
  } | null;
  documents: PersonDocumentItem[];
}

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.user?.access_token);
  const [activeTab, setActiveTab] = useState<"info" | "avatar" | "kyc">("info");

  // Profile data query
  const { data: profileData, isLoading, refetch } = useQuery({
    queryKey: ["auth", "profile"],
    queryFn: () => api.get<ProfileResponse>("/auth/profile"),
    enabled: isOpen,
  });

  // Form states
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [currentAddress, setCurrentAddress] = useState("");
  const [permanentAddress, setPermanentAddress] = useState("");
  const [sameAsCurrentAddress, setSameAsCurrentAddress] = useState(true);
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState<EmergencyRelation>("Spouse");
  const [emergencyName, setEmergencyName] = useState("");

  // Avatar upload states
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // KYC upload states
  const [kycType, setKycType] = useState("");
  const [kycName, setKycName] = useState("");
  const [kycDocNumber, setKycDocNumber] = useState("");
  const [kycFile, setKycFile] = useState<File | null>(null);
  const [uploadingKyc, setUploadingKyc] = useState(false);

  useEffect(() => {
    if (profileData) {
      setDisplayName(profileData.user?.displayName || "");
      const pPhone = profileData.person?.phone || profileData.user?.phone || "";
      setPhone(pPhone);
      setMiddleName(profileData.person?.middleName || "");
      setAltPhone(profileData.person?.altPhone || "");
      const pGender = normalizeGender(profileData.person?.gender);
      const pDob = profileData.person?.dob ? profileData.person.dob.slice(0, 10) : "";
      setGender(pGender);
      setDob(pDob);
      // Legacy records missing required details are highlighted straight away.
      setShowErrors(
        !!profileData.person &&
          Object.keys(validatePersonContact({ phone: pPhone, gender: pGender, dob: pDob })).length > 0,
      );

      const pCurrentAddr = profileData.person?.currentAddress || profileData.person?.address || "";
      const pPermAddr = profileData.person?.permanentAddress || pCurrentAddr;
      setCurrentAddress(pCurrentAddr);
      setPermanentAddress(pPermAddr);
      setSameAsCurrentAddress(!profileData.person?.permanentAddress || profileData.person?.permanentAddress === pCurrentAddr);

      const parsed = parseEmergencyContact(profileData.person?.emergencyContact);
      setEmergencyPhone(parsed.phone);
      setEmergencyRelation((parsed.relation as EmergencyRelation) || "Spouse");
      setEmergencyName(parsed.name);
    }
  }, [profileData]);

  // Required person details only apply when the account is linked to a person record.
  const contactErrors = profileData?.person
    ? validatePersonContact({ phone, altPhone, gender, dob, emergencyPhone })
    : {};

  // Save profile info mutation
  const saveInfoMutation = useMutation({
    mutationFn: () => {
      const emergencyContact = formatEmergencyContact(emergencyPhone, emergencyRelation, emergencyName);
      const finalPermAddr = sameAsCurrentAddress ? currentAddress.trim() : permanentAddress.trim();
      return api.patch("/auth/profile", {
        displayName: displayName.trim(),
        phone: phone.trim(),
        ...(profileData?.person
          ? { middleName: middleName.trim(), altPhone: altPhone.trim(), gender, dob }
          : {}),
        currentAddress: currentAddress.trim(),
        permanentAddress: finalPermAddr,
        address: currentAddress.trim(),
        emergencyContact,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "profile"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      queryClient.invalidateQueries({ queryKey: ["hr", "people"] });
      toast.success("Profile updated", "Your profile details have been saved.");
    },
    onError: (err: any) => {
      toast.error("Save failed", formatErrorMessage(err));
    },
  });

  // Avatar upload
  const handleAvatarUpload = async (file: File | null) => {
    setAvatarFile(file);
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      await api.upload<{ avatarUrl: string }>("/auth/profile/avatar", formData);

      await queryClient.invalidateQueries({ queryKey: ["auth", "profile"] });
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      await queryClient.invalidateQueries({ queryKey: ["hr", "people"] });
      refetch();
      toast.success("Avatar updated", "Your new profile picture is active across the system.");
    } catch (err: any) {
      toast.error("Upload failed", err.message || "Could not upload profile picture.");
    } finally {
      setUploadingAvatar(false);
      setAvatarFile(null);
    }
  };

  // KYC document upload
  const handleKycUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kycFile) {
      toast.error("File required", "Please choose a KYC document file to upload.");
      return;
    }
    if (!kycType) {
      toast.error("Document type required", "Please choose the type of ID you are uploading.");
      return;
    }
    if (kycType === OTHER_ID_TYPE && !kycName.trim()) {
      toast.error("Document name required", "Please enter a name for this document.");
      return;
    }
    if (!kycDocNumber.trim()) {
      toast.error("Document Number required", "Please provide the unique document/ID number.");
      return;
    }

    setUploadingKyc(true);
    try {
      const formData = new FormData();
      formData.append("file", kycFile);
      formData.append("name", kycType === OTHER_ID_TYPE ? kycName.trim() : kycType);
      formData.append("documentNumber", kycDocNumber.trim());

      await api.upload("/auth/profile/kyc", formData);

      setKycType("");
      setKycName("");
      setKycDocNumber("");
      setKycFile(null);
      await queryClient.invalidateQueries({ queryKey: ["auth", "profile"] });
      await queryClient.invalidateQueries({ queryKey: ["hr", "people"] });
      refetch();
      toast.success("KYC Document uploaded", "Your document is submitted for HR verification.");
    } catch (err: any) {
      toast.error("Upload failed", err.message || "Could not upload KYC document.");
    } finally {
      setUploadingKyc(false);
    }
  };

  // Download document
  const handleDownloadDoc = async (docId: string, docName: string) => {
    try {
      const data = await api.get<{ downloadUrl?: string; url?: string }>(
        `/auth/profile/documents/${docId}/url`,
      );
      const targetUrl = data?.downloadUrl || data?.url;
      if (targetUrl) {
        const link = document.createElement("a");
        link.href = targetUrl;
        link.download = docName || "document";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        toast.error("Download failed", "Download URL could not be generated.");
      }
    } catch (err: any) {
      toast.error("Download failed", err.message || "Could not download document.");
    }
  };

  // Delete KYC document (unless approved)
  const handleDeleteDoc = async (docId: string) => {
    try {
      await api.delete(`/auth/profile/kyc/${docId}`);
      await queryClient.invalidateQueries({ queryKey: ["auth", "profile"] });
      await queryClient.invalidateQueries({ queryKey: ["hr", "people"] });
      refetch();
      toast.success("Document removed", "KYC document has been deleted.");
    } catch (err: any) {
      toast.error("Action denied", err.message || "Approved KYC documents cannot be deleted.");
    }
  };

  const { data: me } = useMe();
  const user = profileData?.user;
  const person = profileData?.person;
  const isPlatformAdmin = Boolean(me?.isPlatformContext || !person);
  const documents = profileData?.documents || [];
  const kycDocs = documents.filter((d) => d.category === "KYC");

  const avatarUrl = user?.avatarUrl || person?.avatarUrl;
  const userRoles = user?.roles || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="My Account Profile"
      description={
        isPlatformAdmin
          ? "Manage your platform administrator account profile details and avatar."
          : "Manage your personal details, profile picture, and official KYC documents."
      }
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* User Summary Header Card */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800">
          <div className="relative group shrink-0">
            <Avatar
              name={user?.displayName || "User"}
              src={avatarUrl || undefined}
              size="lg"
              isBordered
              className="h-16 w-16 text-lg shadow-sm"
            />
            <button
              type="button"
              onClick={() => setActiveTab("avatar")}
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow-md hover:scale-110 active:scale-95 transition-all cursor-pointer"
              title="Change profile picture"
            >
              <Camera className="h-3 w-3" />
            </button>
          </div>

          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h3 className="font-bold text-base text-foreground truncate">
                {isLoading ? "Loading…" : (user?.displayName || (user?.email ? user.email.split("@")[0] : "Account Profile"))}
              </h3>
              {userRoles.length > 0 ? (
                userRoles.map((role) => (
                  <Badge key={role} variant="outline" className="text-[10px] uppercase font-semibold">
                    {role}
                  </Badge>
                ))
              ) : (
                <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                  Administrator
                </Badge>
              )}
              {person?.status && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  ● {person.status}
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-0.5 truncate">{user?.email || "Platform Administrator"}</p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-2 text-xs text-muted-foreground">
              {(person?.department || user?.department) && (
                <span>Dept: <strong className="text-foreground">{person?.department || user?.department}</strong></span>
              )}
              {(person?.designation || user?.designation) && (
                <span>Role: <strong className="text-foreground">{person?.designation || user?.designation}</strong></span>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 pb-px">
          <button
            type="button"
            onClick={() => setActiveTab("info")}
            className={cn(
              "px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-2",
              activeTab === "info"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900",
            )}
          >
            <User className="h-3.5 w-3.5" />
            <span>Personal Info</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("avatar")}
            className={cn(
              "px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-2",
              activeTab === "avatar"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900",
            )}
          >
            <Camera className="h-3.5 w-3.5" />
            <span>Profile Photo</span>
          </button>

          {/* KYC Documents only for Tenant Employees */}
          {!isPlatformAdmin && person && (
            <button
              type="button"
              onClick={() => setActiveTab("kyc")}
              className={cn(
                "px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-2",
                activeTab === "kyc"
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900",
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>KYC Documents</span>
              {kycDocs.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
                  {kycDocs.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Tab 1: Personal Info */}
        {activeTab === "info" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (Object.keys(contactErrors).length > 0) {
                setShowErrors(true);
                toast.error("Missing details", "Please check the highlighted fields and try again.");
                return;
              }
              saveInfoMutation.mutate();
            }}
            className="space-y-4 pt-1"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="profile-name">Full Display Name</Label>
                <Input
                  id="profile-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your full name"
                  maxLength={INPUT_LIMITS.PERSON_NAME_MAX}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-email">Email Address</Label>
                <Input id="profile-email" value={user?.email || ""} disabled className="bg-muted opacity-80" />
              </div>

              {!isPlatformAdmin && profileData?.person && (
                <div className="space-y-1.5">
                  <Label htmlFor="profile-middle-name">Middle Name</Label>
                  <Input
                    id="profile-middle-name"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="Optional"
                    maxLength={INPUT_LIMITS.PERSON_NAME_MAX}
                  />
                </div>
              )}

              {!isPlatformAdmin && profileData?.person && (
                <Select
                  label="Gender"
                  required
                  placeholder="Select gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  options={GENDER_OPTIONS.map((g) => ({ value: g.value, label: g.label }))}
                  error={showErrors ? contactErrors.gender : undefined}
                />
              )}

              {!isPlatformAdmin && profileData?.person && (
                <DatePicker
                  label="Date of Birth"
                  isRequired
                  value={dob}
                  onChange={(val) => setDob(val)}
                  maxDate={new Date()}
                  error={showErrors ? contactErrors.dob : undefined}
                />
              )}

              <PhoneField
                id="profile-phone"
                label="Phone Number"
                required={!isPlatformAdmin && !!profileData?.person}
                value={phone}
                onChange={setPhone}
                placeholder="Enter mobile number"
                error={showErrors ? contactErrors.phone : undefined}
              />

              {!isPlatformAdmin && profileData?.person && (
                <>
                  <div className="sm:col-span-2">
                    <PhoneField
                      id="profile-alt-phone"
                      label="Alternate Mobile Number"
                      value={altPhone}
                      onChange={setAltPhone}
                      placeholder="Optional alternate number"
                      error={showErrors ? contactErrors.altPhone : undefined}
                    />
                  </div>

                  <div className="sm:col-span-2 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
                    <div className="flex items-center gap-2">
                      <HeartHandshake className="h-4 w-4 text-primary" />
                      <span className="text-xs font-bold text-foreground">Emergency Contact Details</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-3">
                        <PhoneField
                          id="emergency-phone"
                          label="Emergency Phone Number"
                          value={emergencyPhone}
                          onChange={setEmergencyPhone}
                          placeholder="Emergency contact phone"
                          error={showErrors ? contactErrors.emergencyPhone : undefined}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="emergency-relation">Relation</Label>
                        <Select
                          value={emergencyRelation}
                          onChange={(e) => setEmergencyRelation(e.target.value as EmergencyRelation)}
                          options={EMERGENCY_RELATIONS.map((r) => ({ value: r, label: r }))}
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1.5">
                        <Label htmlFor="emergency-name">Contact Person Name</Label>
                        <Input
                          id="emergency-name"
                          value={emergencyName}
                          onChange={(e) => setEmergencyName(e.target.value)}
                          placeholder="e.g. Sunita Sharma"
                          maxLength={INPUT_LIMITS.EMERGENCY_NAME_MAX}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Addresses: Current & Permanent */}
                  <div className="sm:col-span-2 space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="current-address">Current Residential Address</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="current-address"
                          value={currentAddress}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCurrentAddress(val);
                            if (sameAsCurrentAddress) {
                              setPermanentAddress(val);
                            }
                          }}
                          placeholder="Current address: Flat/House, Street, City, State, Pincode"
                          maxLength={INPUT_LIMITS.ADDRESS_MAX}
                          className="pl-9"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="permanent-address">Permanent Address</Label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-foreground select-none">
                          <input
                            type="checkbox"
                            checked={sameAsCurrentAddress}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSameAsCurrentAddress(checked);
                              if (checked) setPermanentAddress(currentAddress);
                            }}
                            className="rounded-md border-input h-3.5 w-3.5 text-primary focus:ring-primary cursor-pointer"
                          />
                          <span>Same as Current address</span>
                        </label>
                      </div>
                      {!sameAsCurrentAddress ? (
                        <div className="relative">
                          <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="permanent-address"
                            value={permanentAddress}
                            onChange={(e) => setPermanentAddress(e.target.value)}
                            placeholder="Permanent address: Hometown / Official permanent address"
                            maxLength={INPUT_LIMITS.ADDRESS_MAX}
                            className="pl-9"
                          />
                        </div>
                      ) : (
                        <div className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs text-muted-foreground flex items-center justify-between">
                          <span className="truncate">{currentAddress || "Same as current residential address"}</span>
                          <span className="text-[11px] font-sans font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 shrink-0">
                            Synced with Current
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" disabled={saveInfoMutation.isPending} className="px-6">
                {saveInfoMutation.isPending ? "Saving changes…" : "Save Details"}
              </Button>
            </div>
          </form>
        )}

        {/* Tab 2: Profile Photo Upload */}
        {activeTab === "avatar" && (
          <div className="space-y-5 pt-1">
            <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800">
              <Avatar
                name={user?.displayName || "User"}
                src={avatarUrl || undefined}
                size="lg"
                isBordered
                className="h-20 w-20 text-2xl shadow-md ring-4 ring-primary/20 shrink-0"
              />
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="text-sm font-bold text-foreground">Current Profile Picture</h4>
                <p className="text-xs text-muted-foreground">
                  Your photo appears in the sidebar, header, employee directory, and attendance logs across the system.
                </p>
                {uploadingAvatar && <p className="text-xs text-primary font-semibold animate-pulse">Uploading and applying avatar…</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Upload New Photo</Label>
              <FileDropzone
                file={avatarFile}
                onFileSelect={handleAvatarUpload}
                accept="image/png,image/jpeg,image/webp"
                maxSizeBytes={5 * 1024 * 1024}
                disabled={uploadingAvatar}
              />
            </div>
          </div>
        )}

        {/* Tab 3: KYC & Official Documents */}
        {activeTab === "kyc" && (
          <div className="space-y-6 pt-1">
            {/* Existing Documents List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  My KYC Documents ({kycDocs.length})
                </h4>
                <span className="text-xs text-muted-foreground">HR verifies uploaded records</span>
              </div>

              {kycDocs.length === 0 ? (
                <div className="p-6 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                  <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-foreground">No KYC documents uploaded yet</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Please upload your official government ID (Aadhaar, PAN, Passport, Driving License) below.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {kycDocs.map((doc) => {
                    const isApproved = doc.status === "APPROVED";
                    const isRejected = doc.status === "REJECTED";
                    const isPending = doc.status === "PENDING";

                    return (
                      <div
                        key={doc.id}
                        className={cn(
                          "p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3",
                          isApproved && "border-emerald-500/30 bg-emerald-500/5",
                          isRejected && "border-red-500/40 bg-red-500/5",
                          isPending && "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50",
                        )}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                              isApproved && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                              isRejected && "bg-red-500/10 text-red-600 dark:text-red-400",
                              isPending && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                            )}
                          >
                            {isApproved && <CheckCircle2 className="h-5 w-5" />}
                            {isRejected && <XCircle className="h-5 w-5" />}
                            {isPending && <Clock className="h-5 w-5" />}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-bold text-foreground truncate">{doc.name}</p>
                              {isApproved && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                  ✓ Verified by HR
                                </span>
                              )}
                              {isPending && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                  ⏳ Verification Pending
                                </span>
                              )}
                              {isRejected && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-700 dark:text-red-300">
                                  ✕ Rejected
                                </span>
                              )}
                            </div>

                            {doc.documentNumber && (
                              <p className="text-xs font-mono font-medium text-foreground/80 mt-0.5">
                                ID No: <span className="font-semibold text-primary">{doc.documentNumber}</span>
                              </p>
                            )}

                            {isRejected && doc.rejectionReason && (
                              <div className="mt-2 p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-600 dark:text-red-400">
                                <strong>HR Feedback:</strong> {doc.rejectionReason} — Please upload a corrected copy below.
                              </div>
                            )}

                            <p className="text-[10px] text-muted-foreground mt-1">
                              Uploaded on {new Date(doc.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadDoc(doc.id, doc.name)}
                            className="h-8 gap-1.5 text-xs rounded-xl"
                            title="Download document file"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Download</span>
                          </Button>

                          {!isApproved && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDoc(doc.id)}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-xl"
                              title="Delete this document"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {isApproved && (
                            <span className="text-[10px] text-muted-foreground px-1" title="Approved documents are locked">
                              Locked
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Form to Upload New KYC Document */}
            <form onSubmit={handleKycUpload} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h5 className="text-xs font-bold text-foreground">Upload Another KYC Document</h5>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Select
                    label="Document Type *"
                    value={kycType}
                    onChange={(e) => setKycType(e.target.value)}
                  >
                    <option value="">Select ID type</option>
                    {KYC_ID_TYPES.map((t) => (
                      <option key={t.label} value={t.label}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {kycType === OTHER_ID_TYPE && (
                  <div className="space-y-1.5">
                    <Label htmlFor="kyc-doc-title">Document Name *</Label>
                    <Input
                      id="kyc-doc-title"
                      value={kycName}
                      onChange={(e) => setKycName(e.target.value)}
                      placeholder="e.g. Ration Card"
                      maxLength={INPUT_LIMITS.DOC_TITLE_MAX}
                      required
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="kyc-doc-num">{kycType && kycType !== OTHER_ID_TYPE ? `${kycType} Number *` : "ID Number *"}</Label>
                  <Input
                    id="kyc-doc-num"
                    value={kycDocNumber}
                    onChange={(e) => setKycDocNumber(e.target.value)}
                    placeholder={kycHint(kycType)}
                    maxLength={INPUT_LIMITS.DOC_NUMBER_MAX}
                    required
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Document File (PDF or Image) *</Label>
                  <FileDropzone
                    file={kycFile}
                    onFileSelect={setKycFile}
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    maxSizeBytes={10 * 1024 * 1024}
                    disabled={uploadingKyc}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button type="submit" disabled={uploadingKyc} className="gap-2">
                  <UploadCloud className="h-4 w-4" />
                  <span>{uploadingKyc ? "Uploading…" : "Upload KYC Document"}</span>
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Modal>
  );
}
