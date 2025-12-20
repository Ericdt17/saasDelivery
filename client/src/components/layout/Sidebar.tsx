import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Package,
  CreditCard,
  FileText,
  Truck,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  Building2,
  Users,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  requireSuperAdmin?: boolean;
}

const allNavItems: NavItem[] = [
  { title: "Tableau de bord", href: "/", icon: LayoutDashboard },
  { title: "Livraisons", href: "/livraisons", icon: Package },
  { title: "Groupes", href: "/groupes", icon: Users },
  { title: "Agences", href: "/agences", icon: Building2, requireSuperAdmin: true },
  { title: "Paiements", href: "/paiements", icon: CreditCard },
  { title: "Tarifs", href: "/tarifs", icon: Receipt },
  { title: "Rapports", href: "/rapports", icon: FileText },
  { title: "Expéditions", href: "/expeditions", icon: Truck },
  { title: "Modifications", href: "/modifications", icon: History },
  { title: "Paramètres", href: "/parametres", icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { isSuperAdmin } = useAuth();

  // Filter nav items based on role
  const navItems = allNavItems.filter(
    (item) => !item.requireSuperAdmin || isSuperAdmin
  );

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-6 border-b border-sidebar-border",
        collapsed && !isMobile && "justify-center px-2"
      )}>
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
          <Truck className="w-5 h-5 text-primary-foreground" />
        </div>
        {(!collapsed || isMobile) && (
          <div className="flex flex-col">
            <span className="font-bold text-sidebar-foreground text-lg">LivSight</span>
            <span className="text-xs text-sidebar-muted">Gestion des livraisons</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== "/" && location.pathname.startsWith(item.href));
          
          return (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={() => isMobile && setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                collapsed && !isMobile && "justify-center px-2",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 flex-shrink-0 transition-transform",
                !isActive && "group-hover:scale-110"
              )} />
              {(!collapsed || isMobile) && (
                <span className="font-medium text-sm">{item.title}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Toggle button - desktop only */}
      {!isMobile && (
        <div className="p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full justify-center text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Trigger */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-4 left-4 z-50 md:hidden bg-card shadow-md"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border">
          <SidebarContent isMobile />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 sticky top-0",
        collapsed ? "w-20" : "w-64"
      )}>
        <SidebarContent />
      </aside>
    </>
  );
}
