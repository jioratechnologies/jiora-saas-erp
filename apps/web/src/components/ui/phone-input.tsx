import { useState, useEffect, useRef } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { PopoverPortal, useFloatingPosition } from "./popover-portal";
import { INPUT_LIMITS } from "../../lib/input-constraints";

export interface Country {
  code: string;       // 2-letter ISO
  shortCode: string;  // 3-letter display code (e.g. IND, USA)
  name: string;
  dialCode: string;
  flag: string;
  pinned?: boolean;
}

export const COUNTRIES: Country[] = [
  // ─── Pinned / Default Top Country ──────────────────────────
  { code: "IN", shortCode: "IND", name: "India", dialCode: "+91", flag: "🇮🇳", pinned: true },

  // ─── Major Global & Regional Countries ────────────────────
  { code: "US", shortCode: "USA", name: "United States", dialCode: "+1", flag: "🇺🇸" },
  { code: "GB", shortCode: "GBR", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧" },
  { code: "AE", shortCode: "UAE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪" },
  { code: "CA", shortCode: "CAN", name: "Canada", dialCode: "+1", flag: "🇨🇦" },
  { code: "AU", shortCode: "AUS", name: "Australia", dialCode: "+61", flag: "🇦🇺" },
  { code: "SG", shortCode: "SGP", name: "Singapore", dialCode: "+65", flag: "🇸🇬" },
  { code: "SA", shortCode: "SAU", name: "Saudi Arabia", dialCode: "+966", flag: "🇸🇦" },
  { code: "DE", shortCode: "DEU", name: "Germany", dialCode: "+49", flag: "🇩🇪" },
  { code: "FR", shortCode: "FRA", name: "France", dialCode: "+33", flag: "🇫🇷" },
  { code: "JP", shortCode: "JPN", name: "Japan", dialCode: "+81", flag: "🇯🇵" },
  { code: "NP", shortCode: "NPL", name: "Nepal", dialCode: "+977", flag: "🇳🇵" },
  { code: "BD", shortCode: "BGD", name: "Bangladesh", dialCode: "+880", flag: "🇧🇩" },
  { code: "LK", shortCode: "LKA", name: "Sri Lanka", dialCode: "+94", flag: "🇱🇰" },
  { code: "QA", shortCode: "QAT", name: "Qatar", dialCode: "+974", flag: "🇶🇦" },
  { code: "OM", shortCode: "OMN", name: "Oman", dialCode: "+968", flag: "🇴🇲" },
  { code: "KW", shortCode: "KWT", name: "Kuwait", dialCode: "+965", flag: "🇰🇼" },
  { code: "BH", shortCode: "BHR", name: "Bahrain", dialCode: "+973", flag: "🇧🇭" },
  { code: "MY", shortCode: "MYS", name: "Malaysia", dialCode: "+60", flag: "🇲🇾" },
  { code: "ID", shortCode: "IDN", name: "Indonesia", dialCode: "+62", flag: "🇮🇩" },
  { code: "TH", shortCode: "THA", name: "Thailand", dialCode: "+66", flag: "🇹🇭" },
  { code: "PH", shortCode: "PHL", name: "Philippines", dialCode: "+63", flag: "🇵🇭" },
  { code: "VN", shortCode: "VNM", name: "Vietnam", dialCode: "+84", flag: "🇻🇳" },
  { code: "NZ", shortCode: "NZL", name: "New Zealand", dialCode: "+64", flag: "🇳🇿" },
  { code: "ZA", shortCode: "ZAF", name: "South Africa", dialCode: "+27", flag: "🇿🇦" },
  { code: "NG", shortCode: "NGA", name: "Nigeria", dialCode: "+234", flag: "🇳🇬" },
  { code: "KE", shortCode: "KEN", name: "Kenya", dialCode: "+254", flag: "🇰🇪" },
  { code: "EG", shortCode: "EGY", name: "Egypt", dialCode: "+20", flag: "🇪🇬" },
  { code: "CH", shortCode: "CHE", name: "Switzerland", dialCode: "+41", flag: "🇨🇭" },
  { code: "NL", shortCode: "NLD", name: "Netherlands", dialCode: "+31", flag: "🇳🇱" },
  { code: "IT", shortCode: "ITA", name: "Italy", dialCode: "+39", flag: "🇮🇹" },
  { code: "ES", shortCode: "ESP", name: "Spain", dialCode: "+34", flag: "🇪🇸" },
  { code: "SE", shortCode: "SWE", name: "Sweden", dialCode: "+46", flag: "🇸🇪" },
  { code: "NO", shortCode: "NOR", name: "Norway", dialCode: "+47", flag: "🇳🇴" },
  { code: "DK", shortCode: "DNK", name: "Denmark", dialCode: "+45", flag: "🇩🇰" },
  { code: "PL", shortCode: "POL", name: "Poland", dialCode: "+48", flag: "🇵🇱" },
  { code: "BR", shortCode: "BRA", name: "Brazil", dialCode: "+55", flag: "🇧🇷" },
  { code: "MX", shortCode: "MEX", name: "Mexico", dialCode: "+52", flag: "🇲🇽" },
  { code: "AR", shortCode: "ARG", name: "Argentina", dialCode: "+54", flag: "🇦🇷" },
  { code: "PK", shortCode: "PAK", name: "Pakistan", dialCode: "+92", flag: "🇵🇰" },
  { code: "CN", shortCode: "CHN", name: "China", dialCode: "+86", flag: "🇨🇳" },
  { code: "HK", shortCode: "HKG", name: "Hong Kong", dialCode: "+852", flag: "🇭🇰" },
  { code: "KR", shortCode: "KOR", name: "South Korea", dialCode: "+82", flag: "🇰🇷" },
  { code: "TR", shortCode: "TUR", name: "Turkey", dialCode: "+90", flag: "🇹🇷" },
  { code: "IE", shortCode: "IRL", name: "Ireland", dialCode: "+353", flag: "🇮🇪" },
  { code: "PT", shortCode: "PRT", name: "Portugal", dialCode: "+351", flag: "🇵🇹" },
  { code: "AT", shortCode: "AUT", name: "Austria", dialCode: "+43", flag: "🇦🇹" },
  { code: "BE", shortCode: "BEL", name: "Belgium", dialCode: "+32", flag: "🇧🇪" },
  { code: "GR", shortCode: "GRC", name: "Greece", dialCode: "+30", flag: "🇬🇷" },
  { code: "IL", shortCode: "ISR", name: "Israel", dialCode: "+972", flag: "🇮🇱" },
];

export interface PhoneInputProps {
  label?: string;
  value?: string;
  onChange: (fullPhoneNumber: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  defaultCountryCode?: string;
}

export function PhoneInput({
  label,
  value = "",
  onChange,
  id,
  placeholder = "98765 43210",
  disabled = false,
  required = false,
  className,
  defaultCountryCode = "+91",
}: PhoneInputProps) {
  // Parse incoming value
  const parseValue = (raw: string) => {
    if (!raw) return { dialCode: defaultCountryCode, number: "" };
    const trimmed = raw.trim();
    const matchedCountry = COUNTRIES.find((c) => trimmed.startsWith(c.dialCode));
    if (matchedCountry) {
      const numberPart = trimmed.slice(matchedCountry.dialCode.length).trim();
      return { dialCode: matchedCountry.dialCode, number: numberPart };
    }
    return { dialCode: defaultCountryCode, number: trimmed };
  };

  const initial = parseValue(value);
  const [selectedCountry, setSelectedCountry] = useState<Country>(
    () => COUNTRIES.find((c) => c.dialCode === initial.dialCode) || COUNTRIES[0],
  );
  const [nationalNumber, setNationalNumber] = useState(initial.number);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Synchronize when external value changes
  useEffect(() => {
    const parsed = parseValue(value);
    const country = COUNTRIES.find((c) => c.dialCode === parsed.dialCode);
    if (country) setSelectedCountry(country);
    setNationalNumber(parsed.number);
  }, [value]);

  const handleCountrySelect = (c: Country) => {
    setSelectedCountry(c);
    setIsOpen(false);
    setSearch("");
    const formatted = nationalNumber.trim() ? `${c.dialCode} ${nationalNumber.trim()}` : "";
    onChange(formatted);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Digits, spaces, and hyphens only
    const clean = e.target.value.replace(/[^\d\s-]/g, "").slice(0, INPUT_LIMITS.PHONE_NUMBER_MAX);
    setNationalNumber(clean);
    const formatted = clean.trim() ? `${selectedCountry.dialCode} ${clean.trim()}` : "";
    onChange(formatted);
  };

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dialCode.includes(search) ||
      c.shortCode.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()),
  );

  const coords = useFloatingPosition(buttonRef, isOpen, 280);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const inputNode = (
    <div className={cn("relative flex items-center rounded-xl border border-input bg-background shadow-xs transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20", className)}>
      {/* Country Code Trigger with Flag, Short Name (e.g. IND) & Dial Code */}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-foreground border-r border-input/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors rounded-l-xl cursor-pointer select-none shrink-0"
        title={`${selectedCountry.name} (${selectedCountry.shortCode} ${selectedCountry.dialCode})`}
        aria-label="Select country code"
      >
        <span className="text-base leading-none">{selectedCountry.flag}</span>
        <span className="font-semibold text-xs text-foreground tracking-wide">{selectedCountry.shortCode}</span>
        <span className="font-mono text-xs text-muted-foreground">{selectedCountry.dialCode}</span>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {/* Floating Country Code Dropdown Portal */}
      {isOpen && coords && (
        <PopoverPortal isOpen={isOpen}>
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: coords.top !== undefined ? `${coords.top}px` : undefined,
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
              left: `${coords.left}px`,
              width: "300px",
              maxWidth: "calc(100vw - 24px)",
              zIndex: 99999,
            }}
            className="max-h-76 p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Search Box */}
            <div className="relative mb-2 px-1">
              <Search className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country, code (IND, +91)…"
                className="w-full h-8 pl-8 pr-7 text-xs bg-zinc-100 dark:bg-zinc-900 border border-transparent rounded-lg focus:outline-hidden focus:border-primary text-foreground placeholder:text-muted-foreground"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Listbox */}
            <div className="overflow-y-auto max-h-60 space-y-0.5 pr-1 divide-y divide-zinc-100 dark:divide-zinc-900">
              {filteredCountries.length === 0 ? (
                <p className="p-3 text-xs text-center text-muted-foreground">No country found</p>
              ) : (
                <>
                  {/* Pinned India indicator if in list */}
                  {!search && (
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Pinned Country
                    </div>
                  )}

                  {filteredCountries.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleCountrySelect(c)}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-xl transition-colors cursor-pointer text-left",
                        c.code === selectedCountry.code
                          ? "bg-primary/10 text-primary font-bold"
                          : "text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900",
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-base leading-none shrink-0">{c.flag}</span>
                        <span className="truncate">{c.name}</span>
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded-md bg-zinc-100 dark:bg-zinc-800 text-muted-foreground shrink-0">
                          {c.shortCode}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground shrink-0 pl-2">{c.dialCode}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </PopoverPortal>
      )}

      {/* National Phone Number Input */}
      <input
        id={id}
        type="tel"
        value={nationalNumber}
        onChange={handleNumberChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        maxLength={INPUT_LIMITS.PHONE_NUMBER_MAX}
        className="flex-1 h-9 px-3 text-xs font-mono bg-transparent placeholder:text-muted-foreground focus:outline-hidden text-foreground"
      />
    </div>
  );

  if (label) {
    return (
      <div className="space-y-1.5">
        <label htmlFor={id} className="text-xs font-medium text-foreground block">
          {label}
        </label>
        {inputNode}
      </div>
    );
  }

  return inputNode;
}
