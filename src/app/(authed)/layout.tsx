"use client";

import { useAuthenticator, Authenticator } from "@aws-amplify/ui-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { MobileNav } from "@/components/MobileNav";

function AuthedLayoutContent({ children }: { children: React.ReactNode }) {
  const { authStatus, signOut, user } = useAuthenticator((context) => [
    context.authStatus,
    context.user,
  ]);
  const router = useRouter();

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
    <div className="min-h-screen bg-muted">
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-card-foreground">
            Stock Portfolio Tracker
          </h1>
          <div className="hidden md:flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.signInDetails?.loginId}
            </span>
            <button
              onClick={signOut}
              className="text-sm text-muted-foreground hover:text-foreground px-3 py-1 rounded border border-border hover:bg-muted"
            >
              Sign Out
            </button>
          </div>
          <MobileNav
            userEmail={user?.signInDetails?.loginId}
            onSignOut={signOut}
          />
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
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
