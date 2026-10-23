import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 从接口返回体里取一条能给人看的错误信息
 *
 * 接口校验失败时返回的是 z.flatten() 结构 ({ formErrors, fieldErrors })，直接 toast 出来会是 [object Object]
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error;

  const flattened = error as
    | { formErrors?: string[]; fieldErrors?: Record<string, string[]> }
    | null
    | undefined;

  const message =
    flattened?.formErrors?.[0]
    ?? Object.values(flattened?.fieldErrors ?? {}).flat()[0];

  return message ?? fallback;
}
