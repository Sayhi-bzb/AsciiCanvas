# @chardesk/rendering

Shared CharDesk render models and Canvas 2D primitives. The root entry resolves
protocol cells without depending on a rendering backend; `./canvas` owns the
pixel metrics, font loading, DPR surface preparation, and cell painter.

```ts
import { createCharDeskRenderModel } from "@chardesk/rendering";

const model = createCharDeskRenderModel("A界🙂");
```

```ts
import { drawCharDeskCanvasDocument } from "@chardesk/rendering/canvas";

drawCharDeskCanvasDocument(context, model, {
  palette: { color: "#111827", background: "#ffffff" },
  zoom: 1.25,
});
```

`zoom` rasterizes at the requested character size; hosts should size the DPR
backing surface to the returned scaled document layout instead of applying a
CSS bitmap transform.

`@chardesk/protocol` owns parsing and Unicode cell layout. Hosts retain
interaction, viewport, and application state.
