const isHTMLElement = (element: Element | null): element is HTMLElement => {
  return element instanceof HTMLElement;
};

export const shouldIgnoreClipboardShortcut = (
  activeElement: Element | null,
  managedTextarea?: HTMLTextAreaElement | null
) => {
  if (!isHTMLElement(activeElement)) return false;
  const tagName = activeElement.tagName.toLowerCase();

  if (tagName === "input") return true;
  if (tagName === "textarea") {
    if (!managedTextarea) return true;
    return activeElement !== managedTextarea;
  }

  return activeElement.isContentEditable;
};
