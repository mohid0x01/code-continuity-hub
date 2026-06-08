import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DashboardSidebar, DashboardHeader } from "@/components/dashboard/DashboardLayout";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <div className="ml-60">
        <DashboardHeader />
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
