import { useQueryClient } from "@tanstack/react-query";
import {
  useGetLeads,
  useCreateLead as useGeneratedCreateLead,
  useGetLead,
  getGetLeadsQueryKey,
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
