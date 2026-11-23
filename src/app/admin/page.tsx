import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) redirect("/");

  return (
    <AdminDashboard
      currentUserId={user.id}
      canManageSuperAdmins={user.role === "SUPER_ADMIN"}
    />
  );
}
