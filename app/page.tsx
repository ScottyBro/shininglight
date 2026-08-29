import Link from "next/link"
import { CalendarCheck, MessageCircle, Receipt } from "lucide-react"

import { getProfile, homePathForRole } from "@/lib/auth"
import { BrandLockup, BrandMark } from "@/components/brand"
import { Button } from "@/components/ui/button"

export default async function Home() {
  const profile = await getProfile()

  return (
    <div className="min-h-screen p-3 sm:p-4">
      <div className="relative isolate min-h-[calc(100vh-1.5rem)] overflow-hidden rounded-[2.5rem] sm:min-h-[calc(100vh-2rem)]">
        {/* Hero backdrop: a stylised "sunrise" evoking the sun brand mark, in
            place of photography — kept context-appropriate for a preschool. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(1200px 700px at 20% 15%, oklch(0.9 0.09 90 / 90%), transparent 60%)," +
              "radial-gradient(900px 700px at 85% 0%, oklch(0.78 0.12 300 / 70%), transparent 55%)," +
              "radial-gradient(1000px 800px at 90% 100%, oklch(0.55 0.16 291 / 85%), transparent 60%)," +
              "linear-gradient(160deg, oklch(0.88 0.08 210) 0%, oklch(0.62 0.12 260) 45%, oklch(0.4 0.14 291) 100%)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-24 -z-10 size-[28rem] rounded-full bg-[oklch(0.92_0.1_80_/_70%)] blur-3xl"
        />

        <header className="glass-strong sticky top-4 z-20 mx-4 mt-4 flex items-center justify-between rounded-full px-5 py-3 shadow-[0_8px_30px_-8px_rgb(0_0_0_/_0.25)] sm:mx-6 sm:mt-6">
          <BrandLockup />
          <div className="flex items-center gap-2">
            {profile ? (
              <Button asChild>
                <Link href={homePathForRole(profile.role)}>Open app</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </header>

        <main className="relative px-6 pt-16 pb-28 sm:px-10 sm:pt-24 lg:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 flex justify-center">
              <BrandMark size={64} className="shadow-[0_8px_30px_-6px_rgb(0_0_0_/_0.35)]" />
            </div>
            <h1 className="font-heading text-5xl leading-[1.05] font-extrabold tracking-tight text-white drop-shadow-sm sm:text-6xl">
              A Calmer Day,
              <br />
              Every Day
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/85">
              Attendance, daily reports, billing and family messaging — in one
              gentle, mobile-first place for teachers and parents at Shining
              Light Pre-School.
            </p>
            {!profile ? (
              <div className="mt-8 flex justify-center">
                <Button asChild size="lg">
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
            ) : null}
          </div>

          {/* Floating feature cards, echoing the reference's overlaid glass
              panels — reinterpreted around what the app actually does. */}
          <div className="relative mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-3">
            <FeatureCard
              icon={<CalendarCheck className="size-5" />}
              title="Attendance & reports"
              body="One-tap check-in/out and warm daily updates from your child's teacher."
            />
            <FeatureCard
              icon={<MessageCircle className="size-5" />}
              title="Family messaging"
              body="A private, per-child thread with your teacher — translated on request."
            />
            <FeatureCard
              icon={<Receipt className="size-5" />}
              title="Billing, simplified"
              body="Invoices, payments and receipts, always visible to families."
            />
          </div>
        </main>

        <footer className="relative px-6 pb-8 text-center text-sm text-white/70">
          © {new Date().getFullYear()} Shining Light Pre-School
        </footer>
      </div>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="glass-strong rounded-3xl p-5 text-left shadow-[0_8px_30px_-8px_rgb(0_0_0_/_0.25)]">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
        {icon}
      </div>
      <div className="font-heading font-bold text-white">{title}</div>
      <p className="mt-1 text-sm text-white/75">{body}</p>
    </div>
  )
}
