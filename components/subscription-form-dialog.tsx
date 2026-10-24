"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from "@/components/ui/form";
import type { Subscription } from "@/db/schema";
import { BILLING_CYCLES, REMINDER_MODES, SUBSCRIPTION_STATUSES } from "@/db/schema";
import { normalizeAutoRenew } from "@/lib/subscription-billing";
import {
  CATEGORY_OPTIONS,
  STATUS_OPTIONS,
  calcExpireDateFromStartDate,
  toDateInput,
} from "@/lib/subscription-utils";
import { getApiErrorMessage } from "@/lib/utils";

const formSchema = z.object({
  name: z.string().min(1, "请输入名称"),
  category: z.string().min(1, "请选择或输入分类"),
  url: z.string().optional(),
  notes: z.string().optional(),
  // 费用存字符串：一边输一边 Number() 会把小数点吃掉（9.99 变成 99），提交时再转数字
  cost: z.string().refine(
    (value) => value.trim() === "" || (Number.isFinite(Number(value)) && Number(value) >= 0),
    "请输入非负数字",
  ),
  currency: z.string().min(1),
  billingCycle: z.enum(BILLING_CYCLES),
  billingCycleCount: z.union([z.literal(""), z.number().int().min(1)]),
  autoRenew: z.boolean(),
  startDate: z.string().optional(),
  expireDate: z.string().min(1, "请选择到期日期"),
  reminderDays: z.union([
    z.literal(""),
    z.number().int().min(0).max(365),
  ]).refine((value) => value !== "", "请输入提醒天数"),
  reminderMode: z.enum(REMINDER_MODES),
  status: z.enum(SUBSCRIPTION_STATUSES),
}).superRefine((data, ctx) => {
  if (data.billingCycle !== "once" && data.billingCycleCount === "") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["billingCycleCount"],
      message: "请输入计费周期次数",
    });
  }
}).transform((data) => ({
  ...data,
  billingCycleCount: data.billingCycle === "once" ? 1 : data.billingCycleCount,
}));

type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

const createDefaultValues: FormInput = {
  name: "",
  category: "other",
  url: "",
  notes: "",
  cost: "",
  currency: "CNY",
  billingCycle: "yearly",
  billingCycleCount: 1,
  autoRenew: false,
  startDate: "",
  expireDate: "",
  reminderDays: 7,
  reminderMode: "daily_from_n_days",
  status: "active",
};

interface SubscriptionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: Subscription | null;
  onSuccess: (subscription: Subscription) => void;
}

const CURRENCY_OPTIONS = ["CNY", "USD", "EUR", "HKD"] as const;

const REMINDER_MODE_OPTIONS = [
  { value: "daily_from_n_days", label: "自第 n 天起每天通知" },
  { value: "once_on_nth_day", label: "仅在第 n 天通知一次" },
] as const;

function BillingCycleCountError({ message }: { message?: string }) {
  const { formMessageId } = useFormField();

  if (!message) return null;

  return <p id={formMessageId} className="text-destructive text-sm">{message}</p>;
}

export default function SubscriptionFormDialog({
  open,
  onOpenChange,
  subscription,
  onSuccess,
}: SubscriptionFormDialogProps) {
  const isEdit = !!subscription;
  const [categoryInput, setCategoryInput] = useState("");

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: createDefaultValues,
  });

  const { handleSubmit, reset, setValue, watch, control, getFieldState, formState, formState: { isSubmitting } } = form;

  const billingCycle = watch("billingCycle");
  const billingCycleCount = watch("billingCycleCount");
  const startDate = watch("startDate");
  const category = watch("category");
  const currency = watch("currency");
  const status = watch("status");
  const reminderMode = watch("reminderMode");
  const billingCycleCountError = getFieldState("billingCycleCount", formState).error?.message;

  useEffect(() => {
    if (billingCycle === "once") {
      setValue("autoRenew", false, { shouldDirty: true });
      return;
    }

    // 编辑时到期日以库里为准, 不能再用 开始日期+周期 覆盖（会把到期日改回第一个周期）
    if (isEdit) return;

    if (!startDate || typeof billingCycleCount !== "number") {
      return;
    }

    const computed = calcExpireDateFromStartDate(startDate, billingCycle, billingCycleCount);
    if (!computed) {
      return;
    }

    setValue("expireDate", computed, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [billingCycle, billingCycleCount, isEdit, startDate, setValue]);

  useEffect(() => {
    if (!open) return;

    if (subscription) {
      const cat = subscription.category;
      setCategoryInput(CATEGORY_OPTIONS.find((item) => item.value === cat) ? "" : cat);
      reset({
        name: subscription.name,
        category: cat,
        url: subscription.url ?? "",
        notes: subscription.notes ?? "",
        cost: subscription.cost != null ? String(subscription.cost) : "",
        currency: subscription.currency,
        billingCycle: subscription.billingCycle,
        billingCycleCount: subscription.billingCycleCount,
        autoRenew: subscription.autoRenew,
        startDate: toDateInput(subscription.startDate),
        expireDate: toDateInput(subscription.expireDate),
        reminderDays: subscription.reminderDays,
        reminderMode: subscription.reminderMode,
        status: subscription.status,
      });
      return;
    }

    setCategoryInput("");
    reset(createDefaultValues);
  }, [open, subscription, reset]);

  const onSubmit = async (data: FormOutput) => {
    try {
      const url = isEdit ? `/api/subscriptions/${subscription!.id}` : "/api/subscriptions";
      const method = isEdit ? "PUT" : "POST";

      const payload = {
        ...data,
        autoRenew: normalizeAutoRenew(data),
        cost: data.cost.trim() === "" ? null : Number(data.cost),
        reminderDays: Number(data.reminderDays),
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: unknown } | null;
        toast.error(getApiErrorMessage(body?.error, "操作失败"));
        return;
      }

      const savedSubscription = await res.json() as Subscription;
      toast.success(isEdit ? "已更新" : "已添加");
      onSuccess(savedSubscription);
    } catch {
      toast.error("网络错误");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0">
        <div className="max-h-[90vh] overflow-y-auto p-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "编辑订阅" : "新增订阅"}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
              <FormField
                control={control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名称 *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="例：阿里云" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="category"
                render={() => (
                  <FormItem>
                    <FormLabel>分类</FormLabel>
                    <Select
                      value={categoryInput !== "" ? "__custom__" : (category || "other")}
                      onValueChange={(value) => {
                        if (value === "__custom__") {
                          setCategoryInput(" ");
                          setValue("category", "", { shouldValidate: true });
                          return;
                        }
                        setCategoryInput("");
                        setValue("category", value, { shouldValidate: true });
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                        ))}
                        <SelectItem value="__custom__">自定义...</SelectItem>
                      </SelectContent>
                    </Select>
                    {categoryInput !== "" && (
                      <FormControl>
                        <Input
                          className="mt-2"
                          placeholder="输入自定义分类"
                          value={categoryInput.trim()}
                          autoFocus
                          onChange={(event) => {
                            const value = event.target.value;
                            setCategoryInput(value || " ");
                            setValue("category", value.trim(), { shouldValidate: true });
                          }}
                        />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="billingCycle"
                render={() => (
                  <FormItem>
                    <FormLabel>计费周期</FormLabel>
                    <div className="flex gap-2">
                      <Select
                        value={billingCycle}
                        onValueChange={(value) => setValue("billingCycle", value as FormInput["billingCycle"], { shouldValidate: true })}
                      >
                        <FormControl>
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">天</SelectItem>
                          <SelectItem value="monthly">月付</SelectItem>
                          <SelectItem value="quarterly">季付</SelectItem>
                          <SelectItem value="yearly">年付</SelectItem>
                          <SelectItem value="once">一次性</SelectItem>
                        </SelectContent>
                      </Select>
                      {billingCycle !== "once" && (
                        <FormField
                          control={control}
                          name="billingCycleCount"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  className="w-20"
                                  min={1}
                                  placeholder="1"
                                  value={field.value}
                                  aria-invalid={!!billingCycleCountError}
                                  onChange={(event) => field.onChange(event.target.value === "" ? "" : Number(event.target.value))}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                    <BillingCycleCountError message={billingCycleCountError} />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>开始日期</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="expireDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>到期日期 *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ""} />
                    </FormControl>
                    {!isEdit && billingCycle !== "once" && startDate && (
                      <FormDescription>已根据开始日期自动计算</FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="autoRenew"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-2 pt-8">
                      <FormControl>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input"
                          checked={field.value}
                          onChange={(event) => field.onChange(event.target.checked)}
                          disabled={billingCycle === "once"}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">自动续期</FormLabel>
                    </div>
                    <FormDescription>
                      {billingCycle === "once" ? "一次性订阅不支持自动续期" : "到期后自动顺延到期日"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>费用</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={field.value}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="currency"
                render={() => (
                  <FormItem>
                    <FormLabel>货币</FormLabel>
                    <Select value={currency} onValueChange={(value) => setValue("currency", value, { shouldValidate: true })}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map((item) => (
                          <SelectItem key={item} value={item}>{item}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="reminderDays"
                render={({ field }) => (
                  <FormItem className="self-start">
                    <FormLabel>提前提醒（天）</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={365}
                        value={field.value}
                        onChange={(event) => {
                          const value = event.target.value;
                          field.onChange(value === "" ? "" : Number(value));
                        }}
                      />
                    </FormControl>
                    <FormDescription>填 0 表示到期当天提醒</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="reminderMode"
                render={() => (
                  <FormItem className="self-start">
                    <FormLabel>提醒方式</FormLabel>
                    <Select value={reminderMode} onValueChange={(value) => setValue("reminderMode", value as FormInput["reminderMode"], { shouldValidate: true })}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {REMINDER_MODE_OPTIONS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {reminderMode === "daily_from_n_days"
                        ? "从提前第 n 天开始，到到期当天为止每天按照通知时间段通知"
                        : "仅在距离到期还剩第 n 天时按照通知时间段通知"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="status"
                render={() => (
                  <FormItem>
                    <FormLabel>状态</FormLabel>
                    <Select value={status} onValueChange={(value) => setValue("status", value as FormInput["status"], { shouldValidate: true })}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STATUS_OPTIONS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="url"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>网址</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="https://..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>备注</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value ?? ""} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "保存中..." : "保存"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
