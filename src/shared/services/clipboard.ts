const hasClipboard = () =>
  typeof navigator !== "undefined" && typeof navigator.clipboard !== "undefined";

export const clipboard = {
  async writeText(text: string) {
    if (!hasClipboard()) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  },
  async writeItems(items: ClipboardItem[]) {
    if (!hasClipboard() || items.length === 0) return false;
    try {
      await navigator.clipboard.write(items);
      return true;
    } catch {
      return false;
    }
  },
  async readItems() {
    if (!hasClipboard()) return null;
    try {
      return await navigator.clipboard.read();
    } catch {
      return null;
    }
  },
  async readText() {
    if (!hasClipboard()) return null;
    try {
      return await navigator.clipboard.readText();
    } catch {
      return null;
    }
  },
};
