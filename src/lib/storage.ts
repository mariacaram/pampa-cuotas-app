import { Dataset } from "./types";

const KEY = "pampa-cuotas-dataset";

export function loadDataset(): Dataset | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Dataset;
  } catch {
    return null;
  }
}

export function saveDataset(dataset: Dataset): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(dataset));
}

export function clearDataset(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
