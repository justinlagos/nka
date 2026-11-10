// A page-wide way to open the project view, from the sky or from any section below it.
export type OpenRect = { x: number; y: number; w: number; h: number };
export type OpenDetail = { id: string; index?: number; rect?: OpenRect | null };

export const OPEN_EVENT = "nka:project-open";
export const CLOSE_EVENT = "nka:project-close";

export function openProject(detail: OpenDetail) {
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}
