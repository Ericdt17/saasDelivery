import { Sidebar } from "./Sidebar";
import { Outlet } from "react-router-dom";

export function DashboardLayout() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <div className="container mx-auto px-4 py-6 md:px-6 lg:px-8 max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
