import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function SignInPage() {
    const session = await auth()

    if (session?.user) {
        redirect("/dashboard")
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Sign In</CardTitle>
                    <CardDescription>
                        Sign in with your authorized Google account to access the dashboard
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        action={async () => {
                            "use server"
                            const { signIn } = await import("@/auth")
                            await signIn("google", { redirectTo: "/dashboard" })
                        }}
                    >
                        <Button type="submit" className="w-full">
                            Sign in with Google
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
