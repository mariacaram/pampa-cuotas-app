import AppRoot from "@/components/AppRoot";
import LoginScreen from "@/components/auth/LoginScreen";
import PendingScreen from "@/components/auth/PendingScreen";
import { getCurrentUsuario } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const authConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Si el login todavía no está configurado, la app queda abierta (como antes).
  if (!authConfigured) return <AppRoot usuario={null} />;

  const usuario = await getCurrentUsuario();
  if (!usuario) return <LoginScreen />;
  if (usuario.estado === "rechazado") return <PendingScreen email={usuario.email} rechazado />;
  if (usuario.estado !== "aprobado") return <PendingScreen email={usuario.email} />;

  return (
    <AppRoot
      usuario={{ email: usuario.email, nombre: usuario.nombre, rol: usuario.rol }}
    />
  );
}
