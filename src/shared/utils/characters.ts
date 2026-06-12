import { getFirstGrapheme as getFirstMetricGrapheme } from "@/shared/metrics";

export const getFirstGrapheme = (value: string) => {
  return getFirstMetricGrapheme(value);
};

export const normalizeBrushChar = (value: string, fallback: string) => {
  const first = getFirstGrapheme(value);
  return first || fallback;
};
