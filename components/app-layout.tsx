"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, List, Settings, LogOut, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
  { href: "/subscriptions", label: "订阅管理", icon: List },
  { href: "/settings", label: "设置", icon: Settings },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("已退出登录");
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <span className="font-semibold text-lg">Subflare</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={handleLogout} title="退出登录">
            <LogOut className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 border-r flex-col sticky top-0 h-screen">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg">Subflare</span>
          </div>
          <ThemeToggle />
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                pathname === href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground w-full transition-colors"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-6 overflow-auto pb-20 md:pb-6">{children}</main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background flex justify-around p-2 pb-[calc(0.5rem_+_env(safe-area-inset-bottom))] z-10">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center w-full py-1 text-xs transition-colors",
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5 mb-1", isActive ? "text-primary" : "")} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
