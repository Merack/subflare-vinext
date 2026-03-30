import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default async function HomePage() {
  // console.log(process);

  // 检查是否设置了 PASSWORD 环境变量
  if (!process.env.PASSWORD) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle>需要配置密码</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              系统检测到您尚未设置账户密码, 请前往 Cloudflare Dashboard 配置以下环境变量：
            </p>
            <div className="bg-muted p-3 rounded-md space-y-2">
              <div>
                <code className="text-xs font-mono">USERNAME</code>
                <p className="text-xs text-muted-foreground mt-1">登录用户名（可选，默认 admin）</p>
              </div>
              <div>
                <code className="text-xs font-mono">PASSWORD</code>
                <p className="text-xs text-muted-foreground mt-1">登录密码（必填）</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              配置路径：Cloudflare Dashboard → Workers & Pages → 选择您的项目 → Settings → Environment Variables
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const session = await getSession();
  if (!session) redirect("/login");
  redirect("/dashboard");
}
