"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { AlertCircleIcon } from "lucide-react"
import { Card, CardContent } from "./ui/card"
import { Alert, AlertTitle, AlertDescription } from "./ui/alert"
import { Label } from "@radix-ui/react-label"
import { Input } from "./ui/input"
import { Button } from "./ui/button"


export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    console.log("Asdadasldbajsbdjabdjkfhd32uy12h3b")
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch("http://localhost:8000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.detail || "Login failed")
      }

      // On success, go to your app’s main page
      router.push("/chat")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form
            onSubmit={handleSubmit}
            noValidate
            className="p-6 md:p-8 space-y-6"
          >
            {error && (
              <Alert variant="destructive">
                <AlertCircleIcon className="h-5 w-5 text-red-400" />
                <AlertTitle>Login failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col items-center text-center">
              <h1 className="text-2xl font-bold">Welcome back</h1>
              <p className="text-muted-foreground text-balance">
                Login to your Secure Messaging App
              </p>
            </div>

            <div className="grid gap-3">
              <Label htmlFor="email">Username</Label>
              <Input
                id="email"
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="grid gap-3">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in…" : "Login"}
            </Button>

            <div className="text-center text-sm">
              Don't have an account?{" "}
              <a
                href="/register"
                className="underline underline-offset-4"
              >
                Sign up
              </a>
            </div>
          </form>

          <div className="bg-muted relative hidden md:block">
            <img
              src="/logo.jpg"
              alt="Illustration"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
            />
          </div>
        </CardContent>
      </Card>

      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
        By clicking continue, you agree to storing all your precious data on
        my servers.
      </div>
    </div>
  )
}
