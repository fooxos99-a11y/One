"use client";

import { useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasPermissionAccess } from "@/lib/admin-permissions";

interface AdminAuthState {
  isLoading: boolean;
  isVerified: boolean;
  role: string;
  isFullAccess: boolean;
}

/**
 * Verifies that the current user is a valid admin by fetching their role
 * directly from the database (not from localStorage).
 * Also checks that their role still exists in the valid roles list from /api/roles.
 * If permissionKey is provided, also checks that the role has access to that specific page.
 * Redirects to /login if not authorized.
 */
export function useAdminAuth(permissionKey?: string): AdminAuthState {
  const router = useRouter();
  const [state, setState] = useState<AdminAuthState>({
    isLoading: true,
    isVerified: false,
    role: "",
    isFullAccess: false,
  });

  useLayoutEffect(() => {
    let cancelled = false;

    async function verify() {
      try {
        const authResponse = await fetch("/api/auth", { cache: "no-store" });
        if (!authResponse.ok) {
          localStorage.removeItem("isLoggedIn");
          localStorage.removeItem("userRole");
          router.replace("/login");
          return;
        }

        const authData = await authResponse.json();
        const sessionUser = authData.user as { role?: string; roleName?: string; accountNumber?: string | number } | undefined;
        const normalizedRole = String(sessionUser?.role || "").trim();
        const roleName = String(sessionUser?.roleName || "").trim();
        const freshRole = roleName || normalizedRole;
        const accountNumber = String(sessionUser?.accountNumber || "").trim();

        if (!normalizedRole || !accountNumber) {
          localStorage.removeItem("isLoggedIn");
          localStorage.removeItem("userRole");
          router.replace("/login");
          return;
        }

        localStorage.setItem("isLoggedIn", "true");

        // 2. Reject students and teachers immediately
        if (normalizedRole === "student" || normalizedRole === "teacher" || normalizedRole === "deputy_teacher") {
          localStorage.setItem("userRole", normalizedRole);
          router.replace("/login");
          return;
        }

        // 3. account_number=2 always has full access to everything
        if (Number(accountNumber) === 2) {
          localStorage.setItem("userRole", freshRole);
          if (!cancelled) {
            setState({ isLoading: false, isVerified: true, role: freshRole, isFullAccess: true });
          }
          return;
        }

        // 4. Fetch valid roles AND their permissions from API
        let validRoles: string[] = [];
        let permissionsMap: Record<string, string[]> = {};
        try {
          const res = await fetch("/api/roles");
          const data = await res.json();
          validRoles = data.roles || [];
          permissionsMap = data.permissions || {};
        } catch {
          validRoles = ["مدير", "سكرتير", "مشرف تعليمي", "مشرف تربوي", "مشرف برامج"];
        }

        const allAdminRoles = ["admin", "مدير", ...validRoles];
        const isKnownAdminRole = allAdminRoles.includes(freshRole) || normalizedRole === "admin" || normalizedRole === "supervisor";

        if (!isKnownAdminRole) {
          localStorage.setItem("userRole", freshRole);
          router.replace("/login");
          return;
        }

        const isFullAccess = freshRole === "مدير" || freshRole === "admin";
        const rolePermissions: string[] = permissionsMap[freshRole] || permissionsMap[normalizedRole] || [];
        const hasAll = isFullAccess || rolePermissions.includes("all");

        // 5. If a specific permission key is required, check it
        if (permissionKey && !hasPermissionAccess(rolePermissions, permissionKey, hasAll)) {
          localStorage.setItem("userRole", freshRole);
          // Redirect to home — they are an admin but don't have this page's permission
          router.replace("/");
          return;
        }

        localStorage.setItem("userRole", freshRole);

        if (!cancelled) {
          setState({ isLoading: false, isVerified: true, role: freshRole, isFullAccess: hasAll });
        }
      } catch {
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("userRole");
        router.replace("/login");
      }
    }

    verify();
    return () => { cancelled = true; };
  }, [router, permissionKey]);

  return state;
}
