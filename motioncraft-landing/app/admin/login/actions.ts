"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, createAdminToken, getAdminPasswordCandidates } from "@/lib/admin-auth";

export async function login(formData: FormData) {
  const password = String(formData.get("password") || "").trim();
  const configuredPasswords = getAdminPasswordCandidates();

  if (!configuredPasswords.length) redirect("/admin/login?error=missing");
  if (!configuredPasswords.includes(password)) redirect("/admin/login?error=1");

  const jar = await cookies();
  jar.set(ADMIN_COOKIE, createAdminToken(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 12, path: "/" });
  redirect("/admin");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
