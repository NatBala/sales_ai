import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  useGetLeads,
  useCreateLead as useGeneratedCreateLead,
  useGetLead,
  getGetLeadsQueryKey,
  getBaseUrl,
} from "@workspace/api-client-react";

export const useLeads = useGetLeads;
export const useLead = useGetLead;

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useGeneratedCreateLead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
      },
    },
  });
}

export function useResetLeads() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const base = getBaseUrl();
      const url = base ? `${base}/api/agents/reset-leads` : `/api/agents/reset-leads`;
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset leads");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
    },
  });
}
