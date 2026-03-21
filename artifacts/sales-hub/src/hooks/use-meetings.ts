import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMeetings,
  useCreateMeeting as useGeneratedCreateMeeting,
  getGetMeetingsQueryKey,
} from "@workspace/api-client-react";

export const useMeetings = useGetMeetings;

export function useCreateMeeting() {
  const queryClient = useQueryClient();
  return useGeneratedCreateMeeting({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeetingsQueryKey() });
      },
    },
  });
}
