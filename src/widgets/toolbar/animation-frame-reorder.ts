export function getMovingFrameIds(
  frameOrder: string[],
  selectedFrameIds: string[],
  activeFrameId: string
) {
  if (!selectedFrameIds.includes(activeFrameId)) return [activeFrameId];

  const selectedIds = new Set(selectedFrameIds);
  return frameOrder.filter((frameId) => selectedIds.has(frameId));
}

export function moveFrameBlock(
  frameOrder: string[],
  movingFrameIds: string[],
  activeFrameId: string,
  overFrameId: string
) {
  const movingIds = new Set(movingFrameIds);
  if (
    !movingIds.has(activeFrameId) ||
    movingIds.has(overFrameId) ||
    !frameOrder.includes(overFrameId)
  ) {
    return frameOrder;
  }

  const activeIndex = frameOrder.indexOf(activeFrameId);
  const overIndex = frameOrder.indexOf(overFrameId);
  if (activeIndex === -1 || overIndex === -1) return frameOrder;

  const orderedMovingIds = frameOrder.filter((frameId) => movingIds.has(frameId));
  const stationaryIds = frameOrder.filter((frameId) => !movingIds.has(frameId));
  const stationaryOverIndex = stationaryIds.indexOf(overFrameId);
  const insertIndex =
    stationaryOverIndex + (activeIndex < overIndex ? 1 : 0);
  const nextOrder = [...stationaryIds];
  nextOrder.splice(insertIndex, 0, ...orderedMovingIds);

  return nextOrder.every((frameId, index) => frameId === frameOrder[index])
    ? frameOrder
    : nextOrder;
}

export function areFrameOrdersEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((frameId, index) => frameId === right[index])
  );
}
