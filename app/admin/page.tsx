import type { Metadata } from "next";
import { isAdmin } from "@/lib/server/auth";
import AdminLogin from "@/app/admin/_components/AdminLogin";
import AdminDashboard from "@/app/admin/_components/AdminDashboard";

// Reads the session cookie, so it must render per-request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "나폴리탄 룰 슬롯츠 | 관리자" };

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return <AdminLogin />;
  }
  return <AdminDashboard />;
}
