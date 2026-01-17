import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import DashboardClient from "./DashboardClient"

export default async function DashboardPage() {
  const session = await auth()
  
  if (!session?.user) {
    redirect("/auth/signin")
  }

  return (
    <div className="min-h-screen">
      <div className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium">Signed in as</h2>
            <p className="text-sm text-muted-foreground">{session.user.email}</p>
          </div>
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
        </div>
      </div>
      <DashboardClient />
    </div>
  )
}
