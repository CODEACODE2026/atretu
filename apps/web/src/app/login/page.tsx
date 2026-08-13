import { LoginForm } from "./login-form";
import { adminTheme } from "../admin/admin-theme";

export default function LoginPage() {
  return (
    <main className={`flex min-h-screen items-center justify-center px-4 py-8 ${adminTheme.appBackground}`}>
      <LoginForm />
    </main>
  );
}
