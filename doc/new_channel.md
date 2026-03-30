# 通知渠道架构

当前内置渠道为 Telegram, 通知系统主要由以下几部分组成：

- `src/lib/notifications/types.ts`：通知策略与表单描述接口
- `src/lib/notifications/telegram.ts`：Telegram 渠道发送实现
- `src/lib/notifications/registry.ts`：运行时策略注册表
- `src/lib/notifications/channel-descriptors.ts`：渠道表单描述与摘要展示
- `src/lib/notifications/dispatcher.ts`：定时任务发送时的统一分发入口
- `src/components/settings-client.tsx`：根据 descriptor 动态渲染配置表单
- `src/app/api/settings/channels/route.ts`：创建/读取渠道
- `src/app/api/settings/channels/[id]/route.ts`：更新/删除渠道
- `src/app/api/settings/channels/[id]/test/route.ts`：发送测试消息

只要新渠道复用现有策略接口和描述符接口，设置页与接口层大多可以直接复用

# 新增通知渠道示例

下面以新增一个 `webhook` 渠道为例，展示最小接入方式

## 1. 扩展渠道类型

在 `src/db/schema.ts` 中扩展 `CHANNEL_TYPES`：

```ts
export const CHANNEL_TYPES = ["telegram", "webhook"] as const;
```

## 2. 新增策略实现

参考 `src/lib/notifications/telegram.ts` 新建 `src/lib/notifications/webhook.ts`：

```ts
import type { NotificationStrategy, SendResult } from "./types";

export class WebhookStrategy implements NotificationStrategy {
  readonly type = "webhook";

  validateConfig(config: Record<string, unknown>): boolean {
    return typeof config.url === "string" && config.url.length > 0;
  }

  async send(message: string, config: Record<string, unknown>): Promise<SendResult> {
    const url = config.url as string | undefined;
    if (!url) {
      return { success: false, error: "Webhook URL not configured" };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });

    return res.ok
      ? { success: true }
      : { success: false, error: `Webhook request failed: ${res.status}` };
  }
}
```

## 3. 注册策略

在 `src/lib/notifications/registry.ts` 中注册：

```ts
import { WebhookStrategy } from "./webhook";

registry.register(new WebhookStrategy());
```

## 4. 提供设置页表单描述

在 `src/lib/notifications/channel-descriptors.ts` 中增加 descriptor：

```ts
const webhookDescriptor: NotificationChannelDescriptor = {
  type: "webhook",
  label: "Webhook",
  namePlaceholder: "我的 Webhook",
  fields: [
    {
      key: "url",
      label: "Webhook URL",
      placeholder: "https://example.com/webhook",
      requiredOnCreate: true,
      allowBlankOnEdit: true,
    },
  ],
  validateConfig(config) {
    return typeof config.url === "string" && config.url.trim().length > 0;
  },
  getSummary(config) {
    return {
      hasConfig: typeof config.url === "string" && config.url.length > 0,
      // 这里需要对敏感信息脱敏处理后才能返回给前端
      summary: typeof config.url === "string" ? config.url : null,
    };
  },
};

export const channelDescriptors = {
  telegram: telegramDescriptor,
  webhook: webhookDescriptor,
};
```

完成这几步后：

- 设置页会自动出现新的渠道类型
- 创建、编辑、测试渠道的接口会继续复用现有逻辑
- `dispatcher.ts` 会在定时发送时按 `channel.type` 自动找到对应策略
