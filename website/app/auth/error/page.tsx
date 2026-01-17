import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function AuthErrorPage() {
    const session = await auth();
    
    // If not signed in at all, redirect to signin
    if (!session?.user) {
        redirect("/auth/signin");
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-red-600">Access Denied</CardTitle>
                    <CardDescription>
                        You are not authorized to access this application.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        You signed in with: <span className="font-semibold text-foreground">{session.user.email}</span>
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                        Only <span className="font-semibold">whythisintech@gmail.com</span> is allowed to access the dashboard.
                    </p>
                    <Link href="/auth/signin">
                        <Button variant="outline" className="w-full">
                            Try Again
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    )
}
