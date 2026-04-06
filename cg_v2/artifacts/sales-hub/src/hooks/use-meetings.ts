import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  useGetMeetings,
  useCreateMeeting as useGeneratedCreateMeeting,
  getGetMeetingsQueryKey,
  getBaseUrl,
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

export function useResetSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const base = getBaseUrl();
      const url = base ? `${base}/api/agents/reset-meetings` : `/api/agents/reset-meetings`;
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset schedule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetMeetingsQueryKey() });
    },
  });
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (meetingId: string) => {
      const base = getBaseUrl();
      const url = base ? `${base}/api/meetings/${meetingId}` : `/api/meetings/${meetingId}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete meeting");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetMeetingsQueryKey() });
    },
  });
}
