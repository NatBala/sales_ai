import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMeetingTasks,
  useCreateTask as useGeneratedCreateTask,
  useCompleteTask as useGeneratedCompleteTask,
  getGetMeetingTasksQueryKey,
  getMeetingTasks,
} from "@workspace/api-client-react";
import type { UseQueryOptions } from "@tanstack/react-query";

export function useMeetingTasks(meetingId: string) {
  return useGetMeetingTasks(meetingId, {
    query: {
      enabled: !!meetingId,
      queryKey: getGetMeetingTasksQueryKey(meetingId),
      queryFn: () => getMeetingTasks(meetingId),
    } as UseQueryOptions<Awaited<ReturnType<typeof getMeetingTasks>>>,
  });
}

export function useCreateTask(meetingId: string) {
  const queryClient = useQueryClient();
  return useGeneratedCreateTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeetingTasksQueryKey(meetingId) });
      },
    },
  });
}

export function useCompleteTask(meetingId: string) {
  const queryClient = useQueryClient();
  return useGeneratedCompleteTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeetingTasksQueryKey(meetingId) });
      },
    },
  });
}
