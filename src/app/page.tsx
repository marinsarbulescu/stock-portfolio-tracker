"use client";

import { useAuthenticator, Authenticator } from "@aws-amplify/ui-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function HomeContent() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);
  const router = useRouter();

  useEffect(() => {
    if (authStatus === "authenticated") {
      router.replace("/dashboard");
    } else if (authStatus === "unauthenticated") {
      router.replace("/login");
    }
  }, [authStatus, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-500">Loading...</div>
    </div>
  );
}

export default function Home() {
  return (
    <Authenticator.Provider>
      <HomeContent />
    </Authenticator.Provider>
  );
}
