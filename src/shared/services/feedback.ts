import { toast } from "sonner";

type ToastOptions = Parameters<typeof toast.success>[1];

export const feedback = {
  success(message: string, options?: ToastOptions) {
    toast.success(message, options);
  },
  error(message: string, options?: ToastOptions) {
    toast.error(message, options);
  },
  warning(message: string, options?: ToastOptions) {
    toast.warning(message, options);
  },
  dismiss() {
    toast.dismiss();
  },
};
