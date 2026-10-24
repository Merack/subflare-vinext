"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Pencil, Plus, Power, PowerOff, Send, Trash2 } from "lucide-react";
import { channelTypeOptions, getChannelDescriptor } from "@/lib/notifications/channel-descriptors";
import { getApiErrorMessage } from "@/lib/utils";

export interface Channel {
  id: number;
  type: string;
  name: string;
  enabled: boolean;
  hasConfig: boolean;
  summary: string | null;
}

type ChannelType = (typeof channelTypeOptions)[number]["value"];

type ChannelConfig = Record<string, string>;

function getDefaultChannelType(): ChannelType {
  return channelTypeOptions[0]?.value ?? "telegram";
}

function createEmptyConfig(type: string, mode: "create" | "edit" = "create"): ChannelConfig {
  const descriptor = getChannelDescriptor(type);
  if (!descriptor) return {};

  return Object.fromEntries(
    descriptor.fields.map((field) => {
      if (mode === "create" && type === "bark" && field.key === "serverUrl") {
        return [field.key, "https://api.day.app"];
      }

      return [
        field.key,
        mode === "create" && field.inputType === "select" ? (field.options?.[0]?.value ?? "") : "",
      ];
    })
  );
}

function hasAnyConfigValue(config: ChannelConfig): boolean {
  return Object.values(config).some((value) => value.trim() !== "");
}

interface ChannelsCardProps {
  initialChannels: Channel[];
}

export default function ChannelsCard({ initialChannels }: ChannelsCardProps) {
  const defaultChannelType = getDefaultChannelType();
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Channel | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [testingChannelId, setTestingChannelId] = useState<number | null>(null);
  const [channelType, setChannelType] = useState<ChannelType>(defaultChannelType);
  const [channelName, setChannelName] = useState("");
  const [channelConfig, setChannelConfig] = useState<ChannelConfig>(() => createEmptyConfig(defaultChannelType, "create"));

  const activeDescriptor = useMemo(() => getChannelDescriptor(channelType), [channelType]);

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/channels");
      if (!res.ok) throw new Error();
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
    setShowForm(false);
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
    setShowForm(true);
  };

  const handleConfigChange = (key: string, value: string) => {
    setChannelConfig((current) => ({ ...current, [key]: value }));
  };

  const buildConfigPayload = () => {
    if (!activeDescriptor) return null;

    return Object.fromEntries(
      activeDescriptor.fields
        .map((field) => {
          const rawValue = channelConfig[field.key] ?? "";
          const value = field.inputType === "select" ? rawValue : rawValue.trim();
          return [field.key, value];
        })
        .filter(([, value]) => value !== "")
    );
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

    // 编辑时留空的字段表示“保持原值”，所以只在有内容时才把 config 发上去
    const payload: { type: string; name: string; config?: Record<string, string> } = {
      type: channelType,
      name: channelName.trim(),
    };
    if (hasAnyConfigValue(channelConfig)) {
      payload.config = configPayload;
    }

    try {
      const res = editingChannel
        ? await fetch(`/api/settings/channels/${editingChannel.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/settings/channels", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, config: configPayload, enabled: true }),
          });

      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: unknown } | null;
        toast.error(getApiErrorMessage(body?.error, editingChannel ? "更新失败" : "添加失败"));
        return;
      }

      toast.success(editingChannel ? "通知渠道已更新" : "通知渠道已添加");
      resetForm();
      void fetchChannels();
    } catch {
      toast.error(editingChannel ? "更新失败" : "添加失败");
    }
  };

  const handleDeleteChannel = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/settings/channels/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">通知渠道</CardTitle>
        <Button
          variant="outline"
          onClick={() => {
            if (showForm && !editingChannel) {
              resetForm();
            } else {
              resetForm();
              setShowForm(true);
            }
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          添加
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && activeDescriptor && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">
                {editingChannel ? "编辑通知渠道" : "添加通知渠道"}
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>渠道类型</Label>
                <Select
                  value={channelType}
                  onValueChange={handleChangeChannelType}
                  disabled={!!editingChannel}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {channelTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editingChannel && (
                  <p className="text-xs text-muted-foreground">类型创建后不可更改</p>
                )}
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
    </Card>
  );
}
