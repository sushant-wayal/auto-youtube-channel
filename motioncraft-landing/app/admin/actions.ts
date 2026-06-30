"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const jar = await cookies();
  if (!isValidAdminToken(jar.get(ADMIN_COOKIE)?.value)) redirect("/admin/login");
}

export async function deleteWaitlistEntry(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");

  if (id) {
    await prisma.waitlistEntry.delete({ where: { id } }).catch(() => null);
  }

  revalidatePath("/admin");
}

export async function deleteFeedback(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");

  if (id) {
    await prisma.feedback.delete({ where: { id } }).catch(() => null);
  }

  revalidatePath("/admin");
}
