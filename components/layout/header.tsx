"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  userName?: string;
  showSteps?: boolean;
  currentStep?: 1 | 2 | 3;
}

const steps = [
  { num: 1, label: "Upload" },
  { num: 2, label: "Design" },
  { num: 3, label: "Finalize" },
];

export function Header({ userName, showSteps = false, currentStep = 1 }: HeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-[rgba(0,255,157,0.1)] bg-[rgba(10,14,20,0.8)] backdrop-blur-xl">
      <Link href="/" className="text-2xl font-bold text-white flex items-center group">
        <span className="bg-gradient-to-r from-[#00ff9d] to-[#00cc7d] bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(0,255,157,0.3)]">
          InteriorMaxi
        </span>
      </Link>

      {showSteps && (
        <div className="hidden md:flex items-center gap-2">
          {steps.map((step, idx) => (
            <div key={step.num} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all duration-300 ${
                  currentStep === step.num
                    ? "bg-gradient-to-r from-[#00ff9d] to-[#00cc7d] text-[#030508] shadow-[0_0_15px_rgba(0,255,157,0.3)]"
                    : currentStep > step.num
                    ? "bg-[rgba(0,255,157,0.15)] text-[#00ff9d] border border-[rgba(0,255,157,0.3)]"
                    : "bg-white/5 text-white/50 border border-white/10"
                }`}
              >
                {currentStep > step.num ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs ${
                    currentStep === step.num 
                      ? "bg-[#030508]/20" 
                      : "bg-white/10"
                  }`}>
                    {step.num}
                  </span>
                )}
                <span className="font-medium">{step.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`w-8 h-px mx-1 transition-colors duration-300 ${
                  currentStep > step.num 
                    ? "bg-[rgba(0,255,157,0.4)]" 
                    : "bg-white/15"
                }`} />
              )}
            </div>
          ))}
        </div>
      )}

      {userName ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 text-white/70 hover:text-[#00ff9d] transition-colors duration-200 px-3 py-1.5 rounded-lg hover:bg-[rgba(0,255,157,0.05)]">
            <span className="text-sm font-medium">{userName}</span>
            <ChevronDown className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="bg-[rgba(13,17,23,0.95)] backdrop-blur-xl border-[rgba(0,255,157,0.15)] shadow-[0_0_30px_rgba(0,255,157,0.1)]"
          >
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-white/70 hover:text-[#00ff9d] hover:bg-[rgba(0,255,157,0.1)] cursor-pointer transition-colors duration-200"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="w-8" />
      )}
    </header>
  );
}
