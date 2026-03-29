import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-6">
      <Card className="w-full max-w-sm border-border/60 shadow-sm sm:max-w-md">
        <CardHeader className="space-y-2 px-6 pt-6 sm:px-8 sm:pt-8">
          <CardTitle className="text-center text-2xl">Subflare</CardTitle>
          <p className="text-center text-sm text-muted-foreground">订阅提醒管理</p>
        </CardHeader>
        <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
