import type { NotificationStrategy } from "./types";
import { TelegramStrategy } from "./telegram";
import { WebhookStrategy } from "./webhook";
import { WecomBotStrategy } from "./wecombot";
import { BarkStrategy } from "./bark";
import { NotifyXStrategy } from "./notifyx";
import { ResendStrategy } from "./resend";
import { SmtpStrategy } from "./smtp";

class StrategyRegistry {
  private readonly strategies = new Map<string, NotificationStrategy>();

  register(strategy: NotificationStrategy): void {
    this.strategies.set(strategy.type, strategy);
  }

  get(type: string): NotificationStrategy | undefined {
    return this.strategies.get(type);
  }
}

export const registry = new StrategyRegistry();
registry.register(new TelegramStrategy());
registry.register(new WebhookStrategy());
registry.register(new WecomBotStrategy());
registry.register(new BarkStrategy());
registry.register(new NotifyXStrategy());
registry.register(new ResendStrategy());
registry.register(new SmtpStrategy());
