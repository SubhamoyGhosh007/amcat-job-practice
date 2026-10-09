"use client";

import { useState } from "react";

// shadcn
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

// third-party
import {
  Book1,
  Calculator,
  Crown,
  Keyboard,
  Microphone2,
  Setting2,
  Speedometer,
  TaskSquare,
  UserSquare,
} from "iconsax-reactjs";

// project-imports
import Logo from "@/components/ui/sidebar-5-utils/logo";

// assets
import { Bell, Search, Sparkles } from "lucide-react";

//  ------------------------------ | COMPONENT - SIDEBAR 5 (Landing Page Theme) | ------------------------------  //

const mainNav = [
  { icon: Speedometer, label: "Exam Practice", id: "practice", badge: "30Q", badgeColor: "blue" },
  { icon: Keyboard, label: "Typing Arena", id: "typing", badge: "WPM", badgeColor: "green" },
  { icon: Microphone2, label: "Speaking Lab", id: "speaking", badge: "SVAR", badgeColor: "purple" },
  { icon: Calculator, label: "Maths Sprint", id: "maths", badge: "40Q", badgeColor: "amber" },
  { icon: TaskSquare, label: "Mock Interview", id: "interview", badge: "7 Parts", badgeColor: "blue" },
];

const secondaryNav = [
  { icon: Book1, label: "Playbook Guides", id: "guides", badge: "Free" },
  { icon: UserSquare, label: "Score Sheets", id: "sheets" },
  { icon: Setting2, label: "Settings", id: "settings" },
];

export default function Sidebar5() {
  const [activeItem, setActiveItem] = useState("practice");

  const getBadgeClass = (color?: string, isActive?: boolean) => {
    if (isActive) {
      return "bg-white/20 text-white border-transparent";
    }
    switch (color) {
      case "green":
        return "bg-[#e6f7ee] text-[#16a34a] border-[#bbf7d0]/80";
      case "purple":
        return "bg-[#f3e8fd] text-[#7c3aed] border-[#ddd6fe]/80";
      case "amber":
        return "bg-[#fef3e2] text-[#d97706] border-[#fde68a]/80";
      case "blue":
      default:
        return "bg-[#e8f1fe] text-[#2563eb] border-[#bfdbfe]/80";
    }
  };

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "18.5rem" } as React.CSSProperties}
      className="relative min-h-[660px] w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-[#fffdf9] font-['Inter',system-ui,sans-serif] shadow-xl shadow-slate-900/5"
    >
      <Sidebar className="absolute z-10 h-full border-r border-slate-200/80 bg-white/90 backdrop-blur-md">
        <SidebarHeader className="border-b border-slate-200/70 px-5 py-4">
          <div className="flex items-center justify-between">
            <Logo />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              title="Notifications"
            >
              <Bell className="size-4" />
            </Button>
          </div>
          <div className="relative mt-3.5 w-full">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search tests, guides, topics..."
              className="h-9 rounded-xl border-slate-200 bg-[#f4f6f9] pl-9 text-xs text-slate-900 shadow-none placeholder:text-slate-400 transition-all hover:bg-white focus:border-[#20a9e0] focus:bg-white focus:ring-2 focus:ring-[#20a9e0]/20"
            />
          </div>
        </SidebarHeader>

        <SidebarContent className="px-3.5 py-4">
          <SidebarGroup>
            <SidebarGroupLabel className="px-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              AMCAT Arena
            </SidebarGroupLabel>
            <SidebarGroupContent className="mt-1.5">
              <SidebarMenu className="gap-1">
                {mainNav.map((item) => {
                  const isActive = activeItem === item.id;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setActiveItem(item.id)}
                        className={`group flex h-10 w-full items-center justify-between rounded-xl px-3 transition-all ${
                          isActive
                            ? "bg-gradient-to-r from-[#20a9e0] to-[#3b82f6] text-white font-semibold shadow-md shadow-[#20a9e0]/25"
                            : "text-slate-700 hover:bg-[#f4f6f9] hover:text-slate-900"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon
                            className={`h-[18px] w-[18px] transition-transform group-hover:scale-105 ${
                              isActive ? "text-white" : "text-slate-500 group-hover:text-slate-900"
                            }`}
                          />
                          <span className="text-[13.5px] font-medium tracking-tight">
                            {item.label}
                          </span>
                        </div>
                        {item.badge && (
                          <Badge
                            variant="secondary"
                            className={`h-5 rounded-md px-1.5 text-[10.5px] font-semibold border ${getBadgeClass(
                              item.badgeColor,
                              isActive
                            )}`}
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="mt-3">
            <SidebarGroupLabel className="px-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Learning & Records
            </SidebarGroupLabel>
            <SidebarGroupContent className="mt-1.5">
              <SidebarMenu className="gap-1">
                {secondaryNav.map((item) => {
                  const isActive = activeItem === item.id;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setActiveItem(item.id)}
                        className={`group flex h-10 w-full items-center justify-between rounded-xl px-3 transition-all ${
                          isActive
                            ? "bg-gradient-to-r from-[#20a9e0] to-[#3b82f6] text-white font-semibold shadow-md shadow-[#20a9e0]/25"
                            : "text-slate-700 hover:bg-[#f4f6f9] hover:text-slate-900"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon
                            className={`h-[18px] w-[18px] transition-transform group-hover:scale-105 ${
                              isActive ? "text-white" : "text-slate-500 group-hover:text-slate-900"
                            }`}
                          />
                          <span className="text-[13.5px] font-medium tracking-tight">
                            {item.label}
                          </span>
                        </div>
                        {item.badge && (
                          <Badge
                            variant="secondary"
                            className={`h-5 rounded-md px-1.5 text-[10.5px] font-semibold border ${getBadgeClass(
                              "blue",
                              isActive
                            )}`}
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-slate-200/70 p-3.5">
          <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-[#f4f6f9]/80 p-2.5 transition-colors hover:bg-[#f4f6f9]">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-9 w-9 border border-white shadow-sm ring-1 ring-slate-200/60">
                <AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" />
                <AvatarFallback className="bg-gradient-to-br from-[#20a9e0] to-[#3b82f6] text-xs font-bold text-white">
                  AM
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-900">Aspirant @User</span>
                <span className="text-[10px] font-medium text-slate-500">Free Tier • 5/5 Sets</span>
              </div>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 border border-amber-200/60">
              <Crown className="h-4 w-4 text-amber-500" />
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      <main className="flex-1 p-6 sm:p-8 pl-[19.5rem]">
        <header className="flex items-center justify-between border-b border-slate-200/70 pb-4">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1 h-8 w-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100" />
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span>App</span>
              <span>/</span>
              <span className="font-semibold text-slate-800 capitalize">{activeItem}</span>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/70 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
            <Sparkles className="h-3.5 w-3.5 text-[#20a9e0]" />
            <span>Concentrix Hiring Pattern 2026</span>
          </div>
        </header>

        <div className="mt-6 max-w-2xl">
          <h2 className="font-['Space_Grotesk',sans-serif] text-2xl font-bold tracking-tight text-slate-900 capitalize">
            {activeItem} Module
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Styled with the official Concentrix AMCAT Practice design system (warm editorial canvas, sky-to-royal gradient accents, and sharp typography).
          </p>

          <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Interactive Practice Sandbox
              </span>
              <span className="rounded-full bg-[#e6f7ee] px-2 py-0.5 text-[11px] font-bold text-[#16a34a]">
                Live Ready
              </span>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-slate-800">
                A caller asks about late delivery status. What is the Concentrix protocol?
              </p>
              <div className="grid gap-2 pt-2">
                <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-700 transition hover:border-[#20a9e0] hover:bg-sky-50/50 cursor-pointer">
                  A. “Calm down, it is not our fault.”
                </div>
                <div className="rounded-xl border border-[#20a9e0] bg-sky-50/70 p-3 text-xs font-medium text-sky-950">
                  B. “I understand this delay upset you. Let me track it right now.”
                </div>
                <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-700 transition hover:border-[#20a9e0] hover:bg-sky-50/50 cursor-pointer">
                  C. “There is nothing I can do.”
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
}
