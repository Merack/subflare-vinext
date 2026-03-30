"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, History, RefreshCw, PowerOff, Power, Search, SlidersHorizontal, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Subscription, SubscriptionHistoryRecord } from "@/db/schema";
import SubscriptionFormDialog from "./subscription-form-dialog";
import RenewDialog from "./renew-dialog";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  getCycleLabel,
  getEffectiveStatus,
  getStatusBadgeVariant,
  getStatusLabel,
} from "@/lib/subscription-utils";

interface SubscriptionsClientProps {
  initialSubscriptions: Subscription[];
}

export default function SubscriptionsClient({ initialSubscriptions }: SubscriptionsClientProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(initialSubscriptions);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Subscription | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subscription | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Subscription | null>(null);
  const [history, setHistory] = useState<SubscriptionHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [renewTarget, setRenewTarget] = useState<Subscription | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategories, setFilterCategories] = useState<Set<string>>(new Set());
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());

  const upsertSubscription = (subscription: Subscription) => {
    setSubscriptions((prev) => {
      const index = prev.findIndex((item) => item.id === subscription.id);
      if (index === -1) {
        return [...prev, subscription].sort((a, b) => new Date(a.expireDate).getTime() - new Date(b.expireDate).getTime());
      }

      const next = [...prev];
      next[index] = subscription;
      return next.sort((a, b) => new Date(a.expireDate).getTime() - new Date(b.expireDate).getTime());
    });
  };

  const removeSubscription = (id: number) => {
    setSubscriptions((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/subscriptions/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      removeSubscription(deleteTarget.id);
      toast.success("已删除");
      setDeleteTarget(null);
    } catch {
      toast.error("删除失败");
    }
  };

  const handleFormSuccess = (subscription: Subscription) => {
    setFormOpen(false);
    setEditTarget(null);
    upsertSubscription(subscription);
  };

  const handleToggleStatus = async (sub: Subscription) => {
    const newStatus = sub.status === "disabled" ? "active" : "disabled";
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json() as Subscription;
      upsertSubscription(updated);
      toast.success(newStatus === "active" ? "已启用" : "已停用");
    } catch {
      toast.error("操作失败");
    }
  };

  const handleOpenHistory = async (sub: Subscription) => {
    setHistoryTarget(sub);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}/history`);
      const data = await res.json() as SubscriptionHistoryRecord[];
      setHistory(data);
    } catch {
      toast.error("加载历史失败");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenRenew = (sub: Subscription) => {
    setRenewTarget(sub);
  };

  const handleRenewSuccess = (subscription: Subscription) => {
    upsertSubscription(subscription);
  };

  const filteredSubscriptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subscriptions.filter((sub) => {
      if (q) {
        const haystack = [
          sub.name,
          CATEGORY_LABELS[sub.category] ?? sub.category,
          sub.url ?? "",
          sub.notes ?? "",
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filterCategories.size > 0 && !filterCategories.has(sub.category)) return false;
      if (filterStatuses.size > 0) {
        const { effectiveStatus } = getEffectiveStatus(sub);
        if (!filterStatuses.has(effectiveStatus)) return false;
      }
      return true;
    });
  }, [subscriptions, search, filterCategories, filterStatuses]);

  const allCategories = useMemo(() => {
    const cats = new Set(subscriptions.map((s) => s.category));
    return Array.from(cats);
  }, [subscriptions]);

  const hasActiveFilters = filterCategories.size > 0 || filterStatuses.size > 0;

  const toggleCategory = (cat: string) => {
    setFilterCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const toggleStatus = (status: string) => {
    setFilterStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setFilterCategories(new Set());
    setFilterStatuses(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">订阅管理</h1>
        <Button onClick={() => { setEditTarget(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          新增订阅
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8"
            placeholder="搜索名称、类型、网址或备注..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={hasActiveFilters ? "default" : "outline"} title="过滤">
              <span className="mr-2">筛选</span>
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>类型</span>
              {hasActiveFilters && (
                <button className="hover:bg-border rounded-sm p-1 text-primary" onClick={clearFilters}>清除</button>
              )}
            </DropdownMenuLabel>
            {allCategories.map((cat) => (
              <DropdownMenuCheckboxItem
                key={cat}
                checked={filterCategories.has(cat)}
                onCheckedChange={() => toggleCategory(cat)}
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>状态</DropdownMenuLabel>
            {(["active", "paused", "disabled", "expired"] as const).map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={filterStatuses.has(s)}
                onCheckedChange={() => toggleStatus(s)}
              >
                {STATUS_LABELS[s]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <>
          <div className="md:hidden space-y-3">
            {filteredSubscriptions.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 border rounded-lg bg-card">
                {subscriptions.length === 0 ? "暂无订阅，点击右上角新增" : "没有匹配的订阅"}
              </div>
            ) : (
              filteredSubscriptions.map((sub) => {
                const { daysLeft, isExpired, isUrgent, isDisabled } = getEffectiveStatus(sub);
                const cycleLabel = getCycleLabel(sub);

                return (
                  <div key={sub.id} className={`p-4 border rounded-lg bg-card space-y-3 ${isDisabled ? "opacity-60" : ""}`}>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-base">{sub.name}</span>
                          <Badge variant={getStatusBadgeVariant(sub.status, isExpired)}>
                            {getStatusLabel(sub.status, isExpired)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px] px-1 py-0">{CATEGORY_LABELS[sub.category] ?? sub.category}</Badge>
                          {cycleLabel && <span>{cycleLabel}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">{sub.cost != null ? `${sub.cost} ${sub.currency}` : "-"}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-end">
                      <div className="space-y-0.5">
                        <p className="text-sm">{new Date(sub.expireDate).toLocaleDateString("zh-CN")}</p>
                        {!isDisabled && (
                          <p className={`text-xs ${isExpired ? "text-destructive font-medium" : isUrgent ? "text-yellow-600 font-medium" : "text-muted-foreground"}`}>
                            {isExpired ? `已过期 ${Math.abs(daysLeft)} 天` : daysLeft === 0 ? "今天到期" : `${daysLeft} 天后到期`}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenRenew(sub)}>
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <SlidersHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>操作</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { setEditTarget(sub); setFormOpen(true); }}>
                              <Pencil className="h-4 w-4 mr-2" /> 编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenHistory(sub)}>
                              <History className="h-4 w-4 mr-2" /> 历史记录
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(sub)}>
                              {isDisabled ? <><Power className="h-4 w-4 mr-2 text-green-600" /> 启用</> : <><PowerOff className="h-4 w-4 mr-2" /> 停用</>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeleteTarget(sub)} className="text-destructive focus:text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> 删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden md:block border rounded-lg overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>类型 / 周期</TableHead>
                  <TableHead>到期日期</TableHead>
                  <TableHead>费用</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="w-36">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscriptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {subscriptions.length === 0 ? "暂无订阅，点击右上角新增" : "没有匹配的订阅"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubscriptions.map((sub) => {
                    const { daysLeft, isExpired, isUrgent, isDisabled } = getEffectiveStatus(sub);
                    const cycleLabel = getCycleLabel(sub);

                    return (
                      <TableRow key={sub.id} className={isDisabled ? "opacity-60" : ""}>
                        <TableCell className="font-medium">{sub.name}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant="outline">{CATEGORY_LABELS[sub.category] ?? sub.category}</Badge>
                            {cycleLabel && <p className="text-xs text-muted-foreground">{cycleLabel}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{new Date(sub.expireDate).toLocaleDateString("zh-CN")}</p>
                            {!isDisabled && (
                              <p className={`text-xs ${isExpired ? "text-destructive" : isUrgent ? "text-yellow-600" : "text-muted-foreground"}`}>
                                {isExpired ? `已过期 ${Math.abs(daysLeft)} 天` : `${daysLeft} 天后`}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {sub.cost != null ? `${sub.cost} ${sub.currency}` : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(sub.status, isExpired)}>
                            {getStatusLabel(sub.status, isExpired)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="续订"
                              onClick={() => handleOpenRenew(sub)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="历史记录"
                              onClick={() => handleOpenHistory(sub)}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title={isDisabled ? "启用" : "停用"}
                              onClick={() => handleToggleStatus(sub)}
                            >
                              {isDisabled ? <Power className="h-4 w-4 text-green-600" /> : <PowerOff className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setEditTarget(sub); setFormOpen(true); }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(sub)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </>

      <SubscriptionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        subscription={editTarget}
        onSuccess={handleFormSuccess}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除订阅「{deleteTarget?.name}」吗？此操作不可撤销
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RenewDialog
        target={renewTarget}
        onClose={() => setRenewTarget(null)}
        onSuccess={handleRenewSuccess}
      />

      <Dialog open={!!historyTarget} onOpenChange={(open) => !open && setHistoryTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>订阅历史 — {historyTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-3 pt-2">
            {historyLoading ? (
              <p className="text-sm text-muted-foreground">加载中...</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无续订历史</p>
            ) : (
              history.map((item) => (
                <div key={item.id} className="border rounded-lg p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="outline">{item.renewalType === "manual" ? "手动续订" : "自动续订"}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("zh-CN")}</span>
                  </div>
                  <p>到期日：{new Date(item.previousExpireDate).toLocaleDateString("zh-CN")} → {new Date(item.newExpireDate).toLocaleDateString("zh-CN")}</p>
                  {item.cost != null && <p>费用：{item.cost}</p>}
                  {item.notes && <p className="text-muted-foreground">备注：{item.notes}</p>}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
