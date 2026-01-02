"use client";

import { useAuthenticator, Authenticator } from "@aws-amplify/ui-react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { MobileNav } from "@/components/MobileNav";
import { PriceProvider } from "@/contexts/PriceContext";

function AuthedLayoutContent({ children }: { children: React.ReactNode }) {
  const { authStatus, signOut, user } = useAuthenticator((context) => [
    context.authStatus,
    context.user,
  ]);
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = user?.signInDetails?.loginId === "marin.sarbulescu@gmail.com";

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    }
  }, [authStatus, router]);

  if (authStatus === "configuring") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (authStatus !== "authenticated") {
    return null;
  }

  return (
    <PriceProvider>
      <div className="min-h-screen bg-muted">
        <header className="bg-card shadow-sm border-b border-border">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-semibold text-card-foreground">
                Stock Portfolio Tracker
              </h1>
              <nav className="hidden md:flex items-center gap-4">
                <Link
                  href="/dashboard"
                  data-testid="nav-dashboard"
                  className={`text-sm ${
                    pathname === "/dashboard"
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/assets"
                  data-testid="nav-assets"
                  className={`text-sm ${
                    pathname === "/assets" || pathname?.startsWith("/assets/")
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Assets
                </Link>
                {isAdmin && (
                  <Link
                    href="/e2e-runner"
                    data-testid="nav-e2e"
                    className={`text-sm ${
                      pathname === "/e2e-runner"
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    E2E
                  </Link>
                )}
              </nav>
            </div>
            <div className="hidden md:flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user?.signInDetails?.loginId}
              </span>
              <button
                onClick={signOut}
                data-testid="btn-signout"
                className="text-sm text-muted-foreground hover:text-foreground px-3 py-1 rounded border border-border hover:bg-muted"
              >
                Sign Out
              </button>
            </div>
            <MobileNav
              userEmail={user?.signInDetails?.loginId}
              onSignOut={signOut}
              isAdmin={isAdmin}
            />
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </div>
    </PriceProvider>
  );
}

export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Authenticator.Provider>
      <AuthedLayoutContent>{children}</AuthedLayoutContent>
    </Authenticator.Provider>
  );
}
