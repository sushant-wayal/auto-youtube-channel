import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import DashboardClient from "./DashboardClient"
import ForkSyncNotice from "./ForkSyncNotice"

export default async function DashboardPage() {
  const isAuthEnforced = Boolean(process.env.GOOGLE_CLIENT_ID) && process.env.DISABLE_AUTH !== "true";
  let session = null;

  if (isAuthEnforced) {
    session = await auth()
    if (!session?.user) {
      redirect("/auth/signin")
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <div className="border-b bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              ▶
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Channel Pilot Control Plane</h2>
              <p className="text-xs text-muted-foreground">
                {session?.user?.email ? `Signed in as ${session.user.email}` : "Autonomous Video Orchestrator"}
              </p>
            </div>
          </div>
          {session?.user && (
            <form
              action={async () => {
                "use server"
                await signOut({ redirectTo: "/auth/signin" })
              }}
            >
              <Button type="submit" variant="outline" size="sm">
                Sign Out
              </Button>
            </form>
          )}
        </div>
      </div>
      <ForkSyncNotice />
      <DashboardClient />
    </div>
  )
}
