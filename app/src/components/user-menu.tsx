"use client";

import { useAuth } from "@/components/auth-provider";
import { logout } from "@/app/login/actions";
import { LogIn, LogOut, User } from "lucide-react";
import Link from "next/link";

export default function UserMenu() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 text-xs text-stone-400 transition-colors hover:text-stone-600"
      >
        <LogIn className="h-3.5 w-3.5" />
        <span>Sign in</span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 text-xs text-stone-400">
        <User className="h-3.5 w-3.5" />
        <span className="max-w-[120px] truncate">{user.email}</span>
      </div>
      <form action={logout}>
        <button
          type="submit"
          className="flex items-center gap-1 text-xs text-stone-400 transition-colors hover:text-stone-600"
        >
          <LogOut className="h-3 w-3" />
        </button>
      </form>
    </div>
  );
}
