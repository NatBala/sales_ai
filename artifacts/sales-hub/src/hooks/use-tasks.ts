import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMeetingTasks,
  useCreateTask as useGeneratedCreateTask,
  useCompleteTask as useGeneratedCompleteTask,
  getGetMeetingTasksQueryKey,
} from "@workspace/api-client-react";

export const useMeetingTasks = useGetMeetingTasks;

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
        // Also invalidate the specific meeting's tasks to reflect the completed state
        queryClient.invalidateQueries({ queryKey: getGetMeetingTasksQueryKey(meetingId) });
      },
    },
  });
}
