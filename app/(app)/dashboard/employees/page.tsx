import { EmptyState } from "@/components/EmptyState";
import { requireTenant } from "@/lib/auth/require-tenant";

export default async function Page() {
  const { t } = await requireTenant();
  return (
    <EmptyState
      title={t("dashboard.nav.employees")}
      message={t("dashboard.employees.empty")}
      action={t("dashboard.employees.action")}
      unavailable={t("dashboard.unavailable")}
    />
  );
}
