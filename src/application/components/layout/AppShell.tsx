import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "@/application/components/layout/Sidebar";
import MainHeader from "@/application/components/layout/MainHeader";

interface AppShellProps {
  children: ReactNode;
  /**
   * Routes that provide their own in-view header (e.g. the documentation
   * area) omit the standard MainHeader. Defaults to false so every existing
   * page keeps rendering MainHeader unchanged.
   */
  hideHeader?: boolean;
  /**
   * Render a view container whose identity is stable across pathname changes
   * (no per-navigation remount and no view-enter replay). Required by views
   * that reuse one component across sibling routes (documentation sections)
   * so in-view state and DOM identity survive navigation. Existing pages keep
   * the default remount-per-view behavior.
   */
  stableView?: boolean;
}

const MAIN_ID = "main-content";

function SkipLink() {
  return (
    <a
      href={`#${MAIN_ID}`}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-surface focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:uppercase focus:text-accent"
    >
      Skip to content
    </a>
  );
}

export default function AppShell({
  children,
  hideHeader = false,
  stableView = false,
}: Readonly<AppShellProps>) {
  const { pathname } = useLocation();
  return (
    <div className="grid h-screen grid-cols-1 overflow-hidden bg-bg text-fg md:grid-cols-[220px_1fr]">
      <SkipLink />
      <Sidebar />
      <div className="main-area flex flex-col overflow-hidden">
        {!hideHeader && <MainHeader />}
        <main
          id={MAIN_ID}
          tabIndex={-1}
          className="flex-1 overflow-hidden outline-none scroll-mt-14"
        >
          <div
            key={stableView ? undefined : pathname}
            className="flex h-full min-h-0 flex-col view-enter"
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
