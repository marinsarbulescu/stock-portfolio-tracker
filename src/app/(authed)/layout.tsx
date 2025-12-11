"use client";

import { useAuthenticator, Authenticator } from "@aws-amplify/ui-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (authStatus !== "authenticated") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">
            Stock Portfolio Tracker
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user?.signInDetails?.loginId}
            </span>
            <button
              onClick={signOut}
              className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1 rounded border hover:bg-gray-50"
            >
              Sign Out
            </button>
          </div>
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
