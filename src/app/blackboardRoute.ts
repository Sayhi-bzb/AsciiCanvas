type BlackboardLocation = Readonly<{
  pathname: string;
  search: string;
}>;

export const isBlackboardRoute = ({ pathname }: Pick<BlackboardLocation, "pathname">) =>
  pathname === "/blackboard" || pathname.endsWith("/blackboard");

export const isLocalBlackboardReaderRoute = (location: BlackboardLocation) =>
  isBlackboardRoute(location) && new URLSearchParams(location.search).get("reader") === "1";
