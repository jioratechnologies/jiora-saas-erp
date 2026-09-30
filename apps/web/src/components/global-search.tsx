import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Users,
  Clock,
  PlaneTakeoff,
  CalendarDays,
  FileSpreadsheet,
  Banknote,
  CreditCard,
  Receipt,
  Network,
  Building2,
  ShieldCheck,
  X,
  ArrowRight,
} from "lucide-react";
import { api } from "../api/client";
import { Avatar } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";

interface SearchPerson {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  personType: string;
  status: string;
  department?: { name: string } | null;
  designation?: { name: string } | null;
}

const QUICK_PAGES = [
  { title: "Person Master", path: "/hr/people", icon: Users, category: "HR Core" },
  { title: "Attendance Portal", path: "/hr/attendance", icon: Clock, category: "HR Core" },
  { title: "Leave Management", path: "/hr/leave", icon: PlaneTakeoff, category: "HR Core" },
  { title: "Holiday Calendar", path: "/hr/holidays", icon: CalendarDays, category: "HR Core" },
  { title: "Department Teams & Managers", path: "/hr/departments", icon: Network, category: "HR Core" },
  { title: "Salary & CTC Structures", path: "/payroll/salary", icon: Banknote, category: "Payroll" },
  { title: "Monthly Payroll Runs", path: "/payroll/runs", icon: FileSpreadsheet, category: "Payroll" },
  { title: "Claims & Advances", path: "/payroll/claims", icon: CreditCard, category: "Payroll" },
  { title: "My Payslips & Compensation", path: "/payroll/my-payslips", icon: Receipt, category: "Payroll" },
  { title: "Organisation Profile", path: "/admin/org", icon: Building2, category: "Admin" },
  { title: "Roles & Permissions", path: "/admin/roles", icon: ShieldCheck, category: "Admin" },
];

export interface GlobalSearchProps {
  isMobileModal?: boolean;
  onClose?: () => void;
}

export function GlobalSearch({ isMobileModal = false, onClose }: GlobalSearchProps = {}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(isMobileModal);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isMobileModal) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isMobileModal]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Fetch people roster for live search
  const { data: people } = useQuery({
    queryKey: ["hr", "people", "search-index"],
    queryFn: () => api.get<SearchPerson[]>("/hr/persons"),
    staleTime: 60 * 1000,
  });

  const q = query.toLowerCase().trim();

  const filteredPages = QUICK_PAGES.filter(
    (p) => !q || p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
  ).slice(0, 5);

  const filteredPeople = (people || []).filter((p) => {
    if (!q) return false;
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    const email = p.email.toLowerCase();
    const dept = p.department?.name?.toLowerCase() || "";
    const desig = p.designation?.name?.toLowerCase() || "";
    return fullName.includes(q) || email.includes(q) || dept.includes(q) || desig.includes(q);
  }).slice(0, 6);

  const handleSelectPage = (path: string) => {
    navigate(path);
    setOpen(false);
    setQuery("");
    onClose?.();
  };

  const handleSelectPerson = (person: SearchPerson) => {
    navigate(`/hr/people?id=${person.id}`);
    setOpen(false);
    setQuery("");
    onClose?.();
  };

  if (isMobileModal) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col p-3 sm:p-4 pt-3 sm:pt-16 animate-in fade-in-0 duration-150">
        <div ref={containerRef} className="w-full max-w-lg mx-auto bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
          {/* Mobile Search Header */}
          <div className="flex items-center gap-2 p-3 border-b border-zinc-100 dark:border-zinc-800">
            <Search className="h-4 w-4 text-primary shrink-0 ml-1" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people, modules, or pages..."
              className="flex-1 h-9 px-2 text-sm bg-transparent outline-hidden placeholder:text-muted-foreground text-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
            >
              Done
            </button>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* People Section */}
            {q && (
              <div>
                <div className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Staff & Personnel ({filteredPeople.length})
                </div>
                {filteredPeople.length === 0 ? (
                  <p className="px-2.5 py-2 text-xs text-muted-foreground italic">
                    No staff members matching "{query}"
                  </p>
                ) : (
                  <div className="space-y-1">
                    {filteredPeople.map((person) => (
                      <button
                        key={person.id}
                        onClick={() => handleSelectPerson(person)}
                        className="w-full flex items-center justify-between gap-2.5 p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar
                            name={`${person.firstName} ${person.lastName}`}
                            src={person.avatarUrl}
                            size="sm"
                            className="h-8 w-8 text-xs shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {person.firstName} {person.lastName}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {person.designation?.name || "Staff"} • {person.department?.name || "General"}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={person.personType === "EMPLOYEE" ? "default" : "secondary"}
                          className="text-[9px] py-0 px-1 shrink-0"
                        >
                          {person.personType === "EMPLOYEE" ? "Emp" : "Vol"}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quick Pages & Modules */}
            <div>
              <div className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {q ? "Matching Modules" : "Quick Navigation"}
              </div>
              <div className="space-y-1">
                {filteredPages.map((page) => {
                  const Icon = page.icon;
                  return (
                    <button
                      key={page.path}
                      onClick={() => handleSelectPage(page.path)}
                      className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-medium text-foreground truncate">
                          {page.title}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{page.category}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-sm sm:max-w-md mx-2 sm:mx-4">
      {/* Search Input Trigger */}
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search people, modules, or pages..."
          className="w-full h-8 pl-8 pr-14 text-xs rounded-xl bg-zinc-100/80 hover:bg-zinc-100 focus:bg-white dark:bg-zinc-900/80 dark:hover:bg-zinc-900 dark:focus:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-hidden transition-all placeholder:text-muted-foreground/70"
        />
        <div className="absolute right-2 flex items-center gap-1">
          {query ? (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="p-0.5 text-muted-foreground hover:text-foreground rounded"
            >
              <X className="h-3 w-3" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/80 bg-zinc-200/60 dark:bg-zinc-800 rounded border border-zinc-300/60 dark:border-zinc-700/60">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {/* Floating Dropdown Search Palette */}
      {open && (
        <div className="absolute left-0 right-0 top-10 z-50 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-2xl p-2 animate-in fade-in-0 zoom-in-95 duration-100 max-h-[75vh] overflow-y-auto">
          {/* People Section (if query present) */}
          {q && (
            <div className="mb-2">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Staff & Personnel ({filteredPeople.length})
              </div>
              {filteredPeople.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground italic">
                  No staff members matching "{query}"
                </p>
              ) : (
                <div className="space-y-1 mt-1">
                  {filteredPeople.map((person) => (
                    <button
                      key={person.id}
                      onClick={() => handleSelectPerson(person)}
                      className="w-full flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          name={`${person.firstName} ${person.lastName}`}
                          src={person.avatarUrl}
                          size="sm"
                          className="h-7 w-7 text-[11px] shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {person.firstName} {person.lastName}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {person.designation?.name || "Staff"} • {person.department?.name || "General"}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={person.personType === "EMPLOYEE" ? "default" : "secondary"}
                        className="text-[9px] py-0 px-1 shrink-0"
                      >
                        {person.personType === "EMPLOYEE" ? "Emp" : "Vol"}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick Pages & Modules */}
          <div>
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {q ? "Matching Modules" : "Quick Navigation"}
            </div>
            <div className="space-y-1 mt-1">
              {filteredPages.map((page) => {
                const Icon = page.icon;
                return (
                  <button
                    key={page.path}
                    onClick={() => handleSelectPage(page.path)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-6 w-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors truncate">
                        {page.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{page.category}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
