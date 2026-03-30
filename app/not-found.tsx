import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Search className="h-10 w-10 text-muted-foreground" />
          </div>
          <CardTitle className="text-4xl font-bold">404</CardTitle>
          <p className="text-muted-foreground mt-2">页面未找到</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            抱歉，您访问的页面不存在或已被移除
          </p>
          <Link href="/">
            <Button className="w-full">
              <Home className="h-4 w-4 mr-2" />
              返回首页
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
