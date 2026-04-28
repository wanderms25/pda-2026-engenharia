"use client";
import { useEffect } from "react";
import { LoginScreen } from "@/components/auth/login-screen";
import { isAuthenticated } from "@/lib/api";

export default function LoginPage() {
  useEffect(() => {
    if (isAuthenticated()) {
      window.location.href = "/dashboard";
    }
  }, []);
  return <LoginScreen />;
}
