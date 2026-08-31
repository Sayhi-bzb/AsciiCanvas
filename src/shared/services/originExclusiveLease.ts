export type OriginExclusiveLease = Readonly<{
  release: () => void;
  completion: Promise<void>;
}>;

type AcquireOriginExclusiveLeaseOptions = Readonly<{
  manager: LockManager;
  name: string;
  wait?: boolean;
  signal?: AbortSignal;
}>;

export const acquireOriginExclusiveLease = ({
  manager,
  name,
  wait = false,
  signal,
}: AcquireOriginExclusiveLeaseOptions): Promise<OriginExclusiveLease | null> => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let resolveAcquired!: (lease: OriginExclusiveLease | null) => void;
  let rejectAcquired!: (error: unknown) => void;
  let settled = false;
  const acquired = new Promise<OriginExclusiveLease | null>((resolve, reject) => {
    resolveAcquired = resolve;
    rejectAcquired = reject;
  });
  const options: LockOptions = wait
    ? { mode: "exclusive", ...(signal ? { signal } : {}) }
    : { mode: "exclusive", ifAvailable: true };
  let completion!: Promise<void>;
  completion = manager.request(name, options, async (lock) => {
    settled = true;
    if (!lock) {
      resolveAcquired(null);
      return;
    }
    resolveAcquired({ release, completion });
    await held;
  }).then(() => undefined);
  void completion.catch((error) => {
    if (!settled) rejectAcquired(error);
  });
  return acquired;
};
