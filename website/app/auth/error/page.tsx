import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AuthErrorPage() {
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
                        Only whythisintech@gmail.com is allowed to access the dashboard.
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
