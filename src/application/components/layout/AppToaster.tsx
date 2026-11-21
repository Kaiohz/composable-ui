import { Toaster } from "sonner";
import { useSettingsStore } from "@/application/stores/useSettingsStore";

/**
 * App-level toast host. Lives in its own component module so `main.tsx`
 * contains no component declarations (react-refresh/only-export-components)
 * and fast refresh keeps working.
 */
export default function AppToaster() {
  const theme = useSettingsStore((s) => s.theme);
  return <Toaster position="bottom-right" theme={theme} duration={2500} />;
}
