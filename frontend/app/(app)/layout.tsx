import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import AppInitializer from "@/components/layout/AppInitializer";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <AppInitializer />
      <AppShell>{children}</AppShell>
    </>
  );
}
