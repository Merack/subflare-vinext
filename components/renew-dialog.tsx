"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Subscription } from "@/db/schema";
import { advanceExpireDate, toDateInput } from "@/lib/subscription-utils";

interface RenewDialogProps {
  target: Subscription | null;
  onClose: () => void;
  onSuccess: (subscription: Subscription) => void;
}

function calcNextExpireDate(sub: Subscription): string {
  return toDateInput(
    advanceExpireDate(
      new Date(sub.expireDate),
      sub.billingCycle ?? "yearly",
      sub.billingCycleCount ?? 1
    )
  );
}

export default function RenewDialog({ target, onClose, onSuccess }: RenewDialogProps) {
  // 用 key={target?.id ?? "closed"} 重挂载来重置表单，这里只需按初始 target 初始化一次
  const [renewDate, setRenewDate] = useState(() => (target ? calcNextExpireDate(target) : ""));
  const [renewCost, setRenewCost] = useState(() => (target?.cost != null ? String(target.cost) : ""));
  const [renewNotes, setRenewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRenew = async () => {
    if (!target || !renewDate) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/subscriptions/${target.id}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newExpireDate: renewDate,
          cost: renewCost ? parseFloat(renewCost) : null,
          notes: renewNotes || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json() as { subscription: Subscription };
      toast.success("续订成功");
      onClose();
      onSuccess(data.subscription);
    } catch {
      toast.error("续订失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>手动续订 — {target?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label htmlFor="renew-expire-date">新到期日期 *</Label>
            <Input id="renew-expire-date" type="date" value={renewDate} onChange={(e) => setRenewDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="renew-cost">续订费用</Label>
            <Input id="renew-cost" type="number" min={0} step={0.01} value={renewCost} onChange={(e) => setRenewCost(e.target.value)} placeholder={target?.currency ?? "可选"} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="renew-notes">备注</Label>
            <Input id="renew-notes" value={renewNotes} onChange={(e) => setRenewNotes(e.target.value)} placeholder="可选" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button onClick={() => void handleRenew()} disabled={!renewDate || submitting}>
              {submitting ? "处理中..." : "确认续订"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
