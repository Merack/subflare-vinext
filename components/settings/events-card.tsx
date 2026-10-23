"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getApiErrorMessage } from "@/lib/utils";

type NotificationEventStatus = "sent" | "failed" | "skipped";

interface NotificationEventRecord {
  id: number;
  createdAt: string | null;
  sentAt: string | null;
  subscriptionName: string;
  channelName: string;
  status: NotificationEventStatus;
  offsetDays: number;
  error: string | null;
}

function formatEventTime(sentAt: string | null, createdAt: string | null): string {
  const raw = sentAt ?? createdAt;
  if (!raw) return "-";
  return new Date(raw).toLocaleString("zh-CN", { hour12: false });
}

function formatEventStatus(status: NotificationEventStatus): string {
  if (status === "sent") return "成功";
  if (status === "failed") return "失败";
  return "跳过";
}

function formatOffsetDays(offsetDays: number): string {
  return offsetDays === 0 ? "到期当天" : `提前 ${offsetDays} 天`;
}

export default function EventsCard() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [records, setRecords] = useState<NotificationEventRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [cleanupMonths, setCleanupMonths] = useState("6");
  const [cleaning, setCleaning] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const fetchEventRecords = async () => {
    setRecordsLoading(true);
    try {
      const res = await fetch("/api/settings/notification-events");
      if (!res.ok) throw new Error();
      const data = await res.json() as { items?: NotificationEventRecord[] };
      setRecords(data.items ?? []);
      setDialogOpen(true);
    } catch {
      toast.error("加载通知记录失败");
    } finally {
      setRecordsLoading(false);
    }
  };

  const handleCleanupEvents = async () => {
    const months = parseInt(cleanupMonths, 10);
    if (isNaN(months) || months < 1) {
      toast.error("请输入大于等于 1 的月份数");
      return;
    }

    setCleaning(true);
    try {
      const res = await fetch("/api/settings/notification-events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months }),
      });
      const data = await res.json().catch(() => null) as { deletedCount?: number; error?: unknown } | null;
      if (!res.ok) {
        toast.error(getApiErrorMessage(data?.error, "清理失败"));
        return;
      }
      toast.success(`已清理 ${data?.deletedCount ?? 0} 条通知记录`);
      setClearConfirmOpen(false);
      if (dialogOpen) {
        void fetchEventRecords();
      }
    } catch {
      toast.error("清理失败");
    } finally {
      setCleaning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">通知事件</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label>最近 50 条发送记录</Label>
            <p className="text-xs text-muted-foreground">
              查看最近通知发送结果，用于排查发送状态和错误信息
            </p>
          </div>
          <Button variant="outline" onClick={() => void fetchEventRecords()} disabled={recordsLoading}>
            {recordsLoading ? "加载中..." : "查看最近记录"}
          </Button>
        </div>

        <Separator />

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label>清理历史记录</Label>
            <p className="text-xs text-muted-foreground">
              删除指定月份之前的通知发送记录，此操作不可恢复
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={cleanupMonths}
              onChange={(e) => setCleanupMonths(e.target.value)}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">个月前</span>
            <Button variant="destructive" onClick={() => setClearConfirmOpen(true)} disabled={cleaning}>
              清理记录
            </Button>
          </div>
        </div>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>最近 50 条发送记录</DialogTitle>
            <DialogDescription>
              展示最近的通知发送结果与错误信息
            </DialogDescription>
          </DialogHeader>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无发送记录</p>
          ) : (
            <div className="overflow-y-auto min-h-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>订阅名称</TableHead>
                    <TableHead>渠道名称</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>提前天数</TableHead>
                    <TableHead>错误信息</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{formatEventTime(record.sentAt, record.createdAt)}</TableCell>
                      <TableCell>{record.subscriptionName}</TableCell>
                      <TableCell>{record.channelName}</TableCell>
                      <TableCell>{formatEventStatus(record.status)}</TableCell>
                      <TableCell>{formatOffsetDays(record.offsetDays)}</TableCell>
                      <TableCell className="max-w-48 truncate">{record.error || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清理历史记录</AlertDialogTitle>
            <AlertDialogDescription>
              确定要清理 {cleanupMonths || "0"} 个月前的通知发送记录吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleCleanupEvents();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cleaning ? "清理中..." : "确认清理"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
