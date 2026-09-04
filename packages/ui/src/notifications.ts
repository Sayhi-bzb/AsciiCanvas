import type * as React from "react";
import { toast } from "sonner";

export type UiNotificationOptions = {
  id?: string | number;
  description?: React.ReactNode;
  duration?: number;
  action?: {
    label: React.ReactNode;
    onClick: () => void;
  };
};

export const notify = {
  success(message: string, options?: UiNotificationOptions) {
    return toast.success(message, options);
  },
  error(message: string, options?: UiNotificationOptions) {
    return toast.error(message, options);
  },
  warning(message: string, options?: UiNotificationOptions) {
    return toast.warning(message, options);
  },
  dismiss(id?: string | number) {
    toast.dismiss(id);
  },
};
