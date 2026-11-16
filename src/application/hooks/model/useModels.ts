import { useQuery } from "@tanstack/react-query";
import { modelApi } from "@/infrastructure/api/model/modelApi";

/** List of the authenticated user's metadata-only model catalog. */
export function useModels() {
  return useQuery({
    queryKey: ["models"],
    queryFn: () => modelApi.listModels(),
  });
}
