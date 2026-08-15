export type BlackboardView = {
  showSource(source: string): void;
  showUnchanged(): void;
  showWaiting(): void;
  showDisconnected(): void;
};

type BlackboardPollState = { etag?: string };

export const pollBlackboard = async (
  state: BlackboardPollState,
  view: BlackboardView,
  fetchBoard: typeof fetch = fetch
): Promise<BlackboardPollState> => {
  try {
    const response = await fetchBoard("/board", {
      cache: "no-cache",
      headers: state.etag ? { "If-None-Match": state.etag } : undefined,
    });
    if (response.status === 304) {
      view.showUnchanged();
      return state;
    }
    if (response.status === 404) {
      view.showWaiting();
      return {};
    }
    if (!response.ok) {
      view.showDisconnected();
      return state;
    }
    view.showSource(await response.text());
    return { etag: response.headers.get("etag") ?? undefined };
  } catch {
    view.showDisconnected();
    return state;
  }
};

export const startBlackboardPolling = (
  view: BlackboardView,
  options: { intervalMs?: number; fetchBoard?: typeof fetch } = {}
) => {
  const intervalMs = options.intervalMs ?? 500;
  const fetchBoard = options.fetchBoard ?? fetch;
  let state: BlackboardPollState = {};
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    state = await pollBlackboard(state, view, fetchBoard);
    if (!stopped) timer = setTimeout(() => void run(), intervalMs);
  };
  void run();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
};
