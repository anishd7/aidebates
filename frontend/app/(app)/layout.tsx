import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import AppInitializer from "@/components/layout/AppInitializer";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

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
