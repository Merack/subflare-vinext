"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/utils";

export type NotifyDeliveryMode = "every_slot" | "once_per_day";

export interface NotificationPreferences {
  timezone: string;
  notifyHours: number[];
  notifyDeliveryMode: NotifyDeliveryMode;
}

const COMMON_TIMEZONES = [
  "UTC",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Taipei",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function formatTzOffset(tz: string): string {
  if (tz === "UTC") return "UTC (UTC+0)";
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(now);
    const offset = (parts.find((p) => p.type === "timeZoneName")?.value ?? "").replace("GMT", "UTC");
    return `${tz} (${offset})`;
  } catch {
    // 库里存了非法时区时别把整页炸掉，和 cron 一样退回 UTC
    return `${tz}（无效时区，按 UTC 处理）`;
  }
}

interface PreferencesCardProps {
  initialPreferences: NotificationPreferences;
}

export default function PreferencesCard({ initialPreferences }: PreferencesCardProps) {
  const [timezone, setTimezone] = useState(initialPreferences.timezone);
  const [notifyHours, setNotifyHours] = useState<number[]>(initialPreferences.notifyHours);
  const [notifyDeliveryMode, setNotifyDeliveryMode] = useState<NotifyDeliveryMode>(initialPreferences.notifyDeliveryMode);
  const [hourInput, setHourInput] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAddHour = () => {
    const h = parseInt(hourInput, 10);
    if (isNaN(h) || h < 0 || h > 23) {
      toast.error("请输入 0-23 之间的整数");
      return;
    }
    if (notifyHours.includes(h)) {
      toast.error("该小时已存在");
      return;
    }
    setNotifyHours([...notifyHours, h].sort((a, b) => a - b));
    setHourInput("");
  };

  const handleRemoveHour = (h: number) => {
    const next = notifyHours.filter((v) => v !== h);
    if (next.length === 0) {
      toast.error("至少保留一个通知时间");
      return;
    }
    setNotifyHours(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone, notifyHours, notifyDeliveryMode }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: unknown } | null;
        toast.error(getApiErrorMessage(body?.error, "保存失败"));
        return;
      }
      toast.success("偏好设置已保存");
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">通知偏好</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>时区</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger><SelectValue>{formatTzOffset(timezone)}</SelectValue></SelectTrigger>
            <SelectContent>
              {COMMON_TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>{formatTzOffset(tz)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            影响通知发送时间和日期计算. 系统会根据此时区判断是否在通知时间段内
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>通知时间段（小时）</Label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {notifyHours.map((h) => (
              <Badge key={h} variant="secondary" className="gap-1 pr-1">
                {String(h).padStart(2, "0")}:00
                <button
                  type="button"
                  onClick={() => handleRemoveHour(h)}
                  className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                  aria-label={`移除 ${h} 点`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              max={23}
              value={hourInput}
              onChange={(e) => setHourInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddHour()}
              placeholder="0-23"
              className="w-24"
            />
            <Button variant="outline" onClick={handleAddHour}>
              <Plus className="h-4 w-4 mr-1" />
              添加
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            仅在这些小时（基于所选时区）发送通知，默认为 0 时
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>通知频率</Label>
          <Select value={notifyDeliveryMode} onValueChange={(value) => setNotifyDeliveryMode(value as NotifyDeliveryMode)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="every_slot">每个通知时段都通知</SelectItem>
              <SelectItem value="once_per_day">当天只通知一次</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            选择“每个通知时段都通知”时, 命中多个时段会多次发送; 选择“当天只通知一次”时, 同一订阅同一天只发送一次
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? "保存中..." : "保存偏好"}
        </Button>
      </CardContent>
    </Card>
  );
}
