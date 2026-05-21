import { Suspense } from "react";
import LoginCard from "./login-card";

export const metadata = {
  title: "Finance Brain — Sign in",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen grid place-items-center bg-background px-4">
      <Suspense fallback={null}>
        <LoginCard />
      </Suspense>
    </main>
  );
}
