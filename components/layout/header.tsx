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
    <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-surface/50 backdrop-blur-sm">
      <Link href="/" className="text-xl font-semibold text-white">
        Flux Interior Studio
      </Link>

      {showSteps && (
        <div className="hidden md:flex items-center gap-2">
          {steps.map((step, idx) => (
            <div key={step.num} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                  currentStep === step.num
                    ? "bg-accent-warm text-white"
                    : currentStep > step.num
                    ? "bg-white/20 text-white"
                    : "bg-white/5 text-white/50"
                }`}
              >
                {currentStep > step.num ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/10 text-xs">
                    {step.num}
                  </span>
                )}
                <span>{step.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <div className="w-8 h-px bg-white/20 mx-1" />
              )}
            </div>
          ))}
        </div>
      )}

      {userName ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 text-white/80 hover:text-white transition-colors">
            <span className="text-sm">{userName}</span>
            <ChevronDown className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-surface border-white/10">
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
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
