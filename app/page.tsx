import Link from "next/link"

import { getProfile, homePathForRole } from "@/lib/auth"
import { BrandLockup } from "@/components/brand"
import { Button } from "@/components/ui/button"

export default async function Home() {
  const profile = await getProfile()

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-secondary/60 to-background">
      <header className="flex items-center justify-between p-5">
        <BrandLockup />
        <div className="flex items-center gap-2">
          {profile ? (
            <Button asChild>
              <Link href={homePathForRole(profile.role)}>Open app</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <h1 className="font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">
            A calmer day at Shining Light
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Attendance, daily reports, billing and family messaging — in one
            gentle, mobile-first place for teachers and parents.
          </p>
          {!profile ? (
            <div className="mt-8 flex justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/signup">Create an account</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </main>

      <footer className="p-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Shining Light Pre-School
      </footer>
    </div>
  )
}
