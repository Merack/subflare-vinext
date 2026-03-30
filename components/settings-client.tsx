"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Trash2, Plus, Send, Pencil, Power, PowerOff, X, Loader2, CodeXml } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  channelTypeOptions,
  getChannelDescriptor,
} from "@/lib/notifications/channel-descriptors";
import { Separator } from "./ui/separator";

type NotifyDeliveryMode = "every_slot" | "once_per_day";

type ChannelType = (typeof channelTypeOptions)[number]["value"];

type ChannelConfig = Record<string, string>;

interface Channel {
  id: number;
  type: string;
  name: string;
  enabled: boolean;
  hasConfig: boolean;
  summary: string | null;
}

interface SettingsPreferences {
  timezone: string;
  notifyHours: number[];
  notifyDeliveryMode: NotifyDeliveryMode;
}

interface SettingsClientProps {
  initialChannels: Channel[];
  initialPreferences: SettingsPreferences;
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
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(now);
  const offset = (parts.find((p) => p.type === "timeZoneName")?.value ?? "").replace("GMT", "UTC");
  return `${tz} (${offset})`;
}

function getDefaultChannelType(): ChannelType {
  return channelTypeOptions[0]?.value ?? "telegram";
}

function createEmptyConfig(type: string, mode: "create" | "edit" = "create"): ChannelConfig {
  const descriptor = getChannelDescriptor(type);
  if (!descriptor) return {};

  return Object.fromEntries(
    descriptor.fields.map((field) => [
      field.key,
      mode === "create" && field.inputType === "select" ? (field.options?.[0]?.value ?? "") : "",
    ])
  );
}

function hasAnyConfigValue(config: ChannelConfig): boolean {
  return Object.values(config).some((value) => value.trim() !== "");
}

export default function SettingsClient({ initialChannels, initialPreferences }: SettingsClientProps) {
  const defaultChannelType = getDefaultChannelType();
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Channel | null>(null);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [testingChannelId, setTestingChannelId] = useState<number | null>(null);
  const [channelType, setChannelType] = useState<ChannelType>(defaultChannelType);
  const [channelName, setChannelName] = useState("");
  const [channelConfig, setChannelConfig] = useState<ChannelConfig>(() => createEmptyConfig(defaultChannelType, "create"));

  const [timezone, setTimezone] = useState(initialPreferences.timezone);
  const [notifyHours, setNotifyHours] = useState<number[]>(initialPreferences.notifyHours);
  const [notifyDeliveryMode, setNotifyDeliveryMode] = useState<NotifyDeliveryMode>(initialPreferences.notifyDeliveryMode);
  const [hourInput, setHourInput] = useState("");
  const [savingPrefs, setSavingPrefs] = useState(false);

  const activeDescriptor = useMemo(() => getChannelDescriptor(channelType), [channelType]);

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/channels");
      const data = await res.json() as Channel[];
      setChannels(data);
    } catch {
      toast.error("加载通知渠道失败");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setChannelName("");
    setChannelType(defaultChannelType);
    setChannelConfig(createEmptyConfig(defaultChannelType, "create"));
    setEditingChannel(null);
    setShowAddChannel(false);
  };

  const handleChangeChannelType = (value: string) => {
    const nextType = value as ChannelType;
    setChannelType(nextType);
    setChannelConfig(createEmptyConfig(nextType, editingChannel ? "edit" : "create"));
  };

  const handleEditChannel = (channel: Channel) => {
    setEditingChannel(channel);
    setChannelType(channel.type as ChannelType);
    setChannelName(channel.name);
    setChannelConfig(createEmptyConfig(channel.type, "edit"));
    setShowAddChannel(true);
  };

  const handleConfigChange = (key: string, value: string) => {
    setChannelConfig((current) => ({ ...current, [key]: value }));
  };

  const buildConfigPayload = () => {
    if (!activeDescriptor) return null;

    const payload = Object.fromEntries(
      activeDescriptor.fields
        .map((field) => {
          const rawValue = channelConfig[field.key] ?? "";
          const value = field.inputType === "select" ? rawValue : rawValue.trim();
          return [field.key, value];
        })
        .filter(([, value]) => value !== "")
    );

    return payload;
  };

  const handleSaveChannel = async () => {
    if (!channelName.trim()) {
      toast.error("请填写渠道名称");
      return;
    }

    if (!activeDescriptor) {
      toast.error("不支持的渠道类型");
      return;
    }

    const configPayload = buildConfigPayload();
    if (!configPayload) {
      toast.error("配置生成失败");
      return;
    }

    if (!editingChannel && !activeDescriptor.validateConfig(configPayload)) {
      toast.error("请填写完整且合法的配置");
      return;
    }

    if (editingChannel && hasAnyConfigValue(channelConfig) && !activeDescriptor.validateConfig(configPayload)) {
      toast.error("如需更新配置，请填写完整且合法的字段");
      return;
    }

    try {
      if (editingChannel) {
        const payload: {
          type: string;
          name: string;
          config?: Record<string, string>;
        } = {
          type: channelType,
          name: channelName.trim(),
        };

        if (hasAnyConfigValue(channelConfig)) {
          payload.config = configPayload;
        }

        const res = await fetch(`/api/settings/channels/${editingChannel.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        toast.success("通知渠道已更新");
      } else {
        const res = await fetch("/api/settings/channels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: channelType,
            name: channelName.trim(),
            config: configPayload,
            enabled: true,
          }),
        });
        if (!res.ok) throw new Error();
        toast.success("通知渠道已添加");
      }
      resetForm();
      void fetchChannels();
    } catch {
      toast.error(editingChannel ? "更新失败" : "添加失败");
    }
  };

  const handleDeleteChannel = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/settings/channels/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("已删除");
      setDeleteTarget(null);
      void fetchChannels();
    } catch {
      toast.error("删除失败");
    }
  };

  const handleToggleChannel = async (channel: Channel) => {
    try {
      const res = await fetch(`/api/settings/channels/${channel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !channel.enabled }),
      });
      if (!res.ok) throw new Error();
      toast.success(channel.enabled ? "已禁用" : "已启用");
      void fetchChannels();
    } catch {
      toast.error("操作失败");
    }
  };

  const handleTestChannel = async (channel: Channel) => {
    setTestingChannelId(channel.id);
    try {
      const res = await fetch(`/api/settings/channels/${channel.id}/test`, { method: "POST" });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        toast.error(data.error || "发送失败，请检查配置");
        return;
      }
      toast.success("测试消息已发送");
    } catch {
      toast.error("发送失败，请检查配置");
    } finally {
      setTestingChannelId(null);
    }
  };

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

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    try {
      const res = await fetch("/api/settings/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone, notifyHours, notifyDeliveryMode }),
      });
      if (!res.ok) throw new Error();
      toast.success("偏好设置已保存");
    } catch {
      toast.error("保存失败");
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">设置</h1>

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

          <Separator/>

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

          <Separator/>

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

          <Button onClick={handleSavePreferences} disabled={savingPrefs}>
            {savingPrefs ? "保存中..." : "保存偏好"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">通知渠道</CardTitle>
          <Button
            variant="outline"
            onClick={() => {
              if (showAddChannel && !editingChannel) {
                resetForm();
              } else {
                resetForm();
                setShowAddChannel(true);
              }
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            添加
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddChannel && activeDescriptor && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">
                  {editingChannel ? "编辑通知渠道" : "添加通知渠道"}
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>渠道类型</Label>
                  <Select value={channelType} onValueChange={handleChangeChannelType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {channelTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>名称</Label>
                  <Input
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    placeholder={activeDescriptor.namePlaceholder}
                  />
                </div>
                {activeDescriptor.fields.map((field) => (
                  <div key={field.key} className="space-y-1 sm:col-span-2">
                    <Label>
                      {editingChannel && field.allowBlankOnEdit && field.inputType !== "select"
                        ? `${field.label}（留空则不修改）`
                        : field.label}
                    </Label>
                    {field.inputType === "select" ? (
                      <Select
                        value={channelConfig[field.key] || undefined}
                        onValueChange={(value) => handleConfigChange(field.key, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={field.placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={field.inputType === "password" ? "password" : "text"}
                        value={channelConfig[field.key] ?? ""}
                        onChange={(e) => handleConfigChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        spellCheck={false}
                        autoComplete="off"
                      />
                    )}
                    {field.description && (
                      <p className="text-xs text-muted-foreground">{field.description}</p>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveChannel}>
                  {editingChannel ? "更新" : "保存"}
                </Button>
                <Button variant="ghost" onClick={resetForm}>取消</Button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无通知渠道</p>
          ) : (
            <div className="space-y-2">
              {channels.map((ch) => (
                <div key={ch.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-3 ${!ch.enabled ? "opacity-60" : ""}`}>
                  <div>
                    <p className="text-sm font-medium">{ch.name}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{ch.type}</Badge>
                      {!ch.enabled && <Badge variant="outline" className="text-xs">已禁用</Badge>}
                      {ch.hasConfig && ch.summary && <Badge variant="outline" className="text-xs">{ch.summary}</Badge>}
                      {!ch.hasConfig && <Badge variant="destructive" className="text-xs">配置不完整</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1 self-end sm:self-auto">
                    <Button
                      size="icon"
                      variant="ghost"
                      title={ch.enabled ? "禁用" : "启用"}
                      onClick={() => handleToggleChannel(ch)}
                      disabled={!!editingChannel}
                    >
                      {ch.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4 text-green-600" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEditChannel(ch)}
                      disabled={editingChannel?.id === ch.id}
                      title="编辑"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleTestChannel(ch)}
                      disabled={!!editingChannel || testingChannelId !== null || !ch.hasConfig}
                      title="测试"
                    >
                      {testingChannelId === ch.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setDeleteTarget(ch)}
                      disabled={!!editingChannel}
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除通知渠道「{deleteTarget?.name}」吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteChannel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex justify-center border-t pt-6">
        <Link
          href="https://github.com/Merack/subflare-vinext"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <CodeXml className="h-4 w-4" />
          <span>subflare-vinext</span>
        </Link>
      </div>
    </div>
  );
}
