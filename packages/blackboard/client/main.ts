import "@chardesk/fonts/fonts.css";
import "@chardesk/viewer/register";
import type { CharDeskViewerElement } from "@chardesk/viewer";
import { startBlackboardPolling, type BlackboardView } from "./poller";
import "./styles.css";

const viewer = document.querySelector<CharDeskViewerElement>("#board");
const status = document.querySelector<HTMLElement>("#status");
if (!viewer || !status) throw new Error("Blackboard page is incomplete.");

let readableState: { state: "current" | "warning"; text: string } = {
  state: "current",
  text: "Current",
};

const setStatus = (state: string, text: string) => {
  status.dataset.state = state;
  status.textContent = text;
};

const view: BlackboardView = {
  showSource(source) {
    viewer.source = source;
    const diagnostics = viewer.parsedDocument?.diagnostics ?? [];
    readableState = diagnostics.length === 0
      ? { state: "current", text: "Current" }
      : {
          state: "warning",
          text: `${diagnostics.length} protocol warning${diagnostics.length === 1 ? "" : "s"}: ${diagnostics[0]!.message}`,
        };
    setStatus(readableState.state, readableState.text);
  },
  showUnchanged() {
    setStatus(readableState.state, readableState.text);
  },
  showWaiting() {
    viewer.source = "";
    readableState = { state: "current", text: "Current" };
    setStatus("waiting", "Waiting for the board");
  },
  showDisconnected() {
    setStatus("disconnected", "Reader disconnected; showing the last board");
  },
};

startBlackboardPolling(view);
