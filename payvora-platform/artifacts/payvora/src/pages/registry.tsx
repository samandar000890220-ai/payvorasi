import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";

/**
 * Label → page component registry for the App shell router.
 * Each page owns its own file; the shell only knows the label and path.
 */
const entries: Record<string, { path: string; Component: LazyExoticComponent<ComponentType> }> = {
  Templates: { path: "/templates", Component: lazy(() => import("./Templates")) },
  Projects: { path: "/projects", Component: lazy(() => import("./Projects")) },
  Integrations: { path: "/integrations", Component: lazy(() => import("./Integrations")) },
};

export const PAGE_PATHS: Record<string, string> = Object.fromEntries(
  Object.entries(entries).map(([label, { path }]) => [label, path]),
);

export function labelForPath(pathname: string): string | undefined {
  return Object.keys(entries).find(label => entries[label].path === pathname);
}

export function RegistryPage({ label }: { label: string }) {
  const entry = entries[label];
  if (!entry) return null;
  const { Component } = entry;
  return (
    <Suspense fallback={<div className="pv-page" style={{ padding: 24, color: "var(--pv-text-muted)" }}>Loading…</div>}>
      <Component />
    </Suspense>
  );
}

export const isRegistryLabel = (label: string) => label in entries;
