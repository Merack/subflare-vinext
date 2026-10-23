import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Subscription } from "@/db/schema";
import { getDaysLeft } from "@/lib/subscription-utils";

interface RecentSubscriptionsProps {
  subscriptions: Subscription[];
}

export default function RecentSubscriptions({ subscriptions }: RecentSubscriptionsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">即将到期订阅</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/subscriptions">查看全部</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {subscriptions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">暂无订阅</p>
        ) : (
          <div className="space-y-3">
            {subscriptions.map((sub) => {
              const daysLeft = getDaysLeft(sub.expireDate);
              const isExpired = daysLeft < 0;
              const isUrgent = daysLeft >= 0 && daysLeft <= 7;

              return (
                <div key={sub.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{sub.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(sub.expireDate).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                  <Badge
                    variant={isExpired ? "destructive" : isUrgent ? "outline" : "secondary"}
                    className={isUrgent && !isExpired ? "border-yellow-500 text-yellow-600" : ""}
                  >
                    {isExpired ? "已过期" : `${daysLeft} 天后`}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
