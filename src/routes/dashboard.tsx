import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { DashboardSidebar, DashboardHeader } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  // Session lives in localStorage, so the gate must run client-side only.
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
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
