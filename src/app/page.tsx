import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0f1117] px-6">
      <div className="max-w-xl w-full text-center space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold tracking-widest text-[#4f7ef5] uppercase">
            PI Report Writer
          </p>
          <h1 className="text-4xl font-bold text-[#e8eaf0] leading-tight">
            Professional reports.
            <br />
            Built for investigators.
          </h1>
          <p className="text-[#8b90a0] text-base">
            Turn source documents and guided forms into clean, printable
            investigation reports in minutes.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-[#4f7ef5] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#3d6de0] transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-md border border-[#2a2f42] text-[#e8eaf0] px-6 py-2.5 text-sm font-medium hover:bg-[#1e2130] transition-colors"
          >
            Create Account
          </Link>
        </div>
      </div>
    </main>
  );
}
