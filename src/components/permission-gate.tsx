"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentSessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export function PermissionGate({
  permission,
  children,
  fallback,
}: {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAccess() {
      const session = await getCurrentSessionUser();

      if (!isMounted) {
        return;
      }

      if (!session || !hasPermission(session.role, permission)) {
        router.replace("/dashboard");
        setAllowed(false);
        return;
      }

      setAllowed(true);
    }

    loadAccess();

    return () => {
      isMounted = false;
    };
  }, [permission, router]);

  if (allowed === null) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Verificando acesso...
      </div>
    );
  }

  if (!allowed) {
    return fallback ?? null;
  }

  return <>{children}</>;
}
