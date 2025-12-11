"use client";

import { Authenticator, useAuthenticator } from "@aws-amplify/ui-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function LoginContent() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);
  const router = useRouter();

  useEffect(() => {
    if (authStatus === "authenticated") {
      router.push("/dashboard");
    }
  }, [authStatus, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-8 text-gray-900">
          Stock Portfolio Tracker
        </h1>
        <Authenticator hideSignUp={true} />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Authenticator.Provider>
      <LoginContent />
    </Authenticator.Provider>
  );
}
