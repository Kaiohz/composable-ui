import { useQuery } from "@tanstack/react-query";
import { cronApi } from "@/infrastructure/api/cron/cronApi";

/** List of the user's crons with enabled state, next run and last-run summary. */
export function useCrons() {
  return useQuery({
    queryKey: ["crons"],
    queryFn: () => cronApi.listCrons(),
  });
}
