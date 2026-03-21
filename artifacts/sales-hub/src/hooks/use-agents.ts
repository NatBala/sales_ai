import {
  useGenerateLeads,
  useGenerateEmail,
  useGenerateMeetingPrep,
  useGenerateEngagementIntelligence,
  useGenerateFollowUpTasks,
} from "@workspace/api-client-react";

// Re-exporting agent hooks for consistency
export const useAgentLeadMe = useGenerateLeads;
export const useAgentScheduleMe = useGenerateEmail;
export const useAgentPrepMe = useGenerateMeetingPrep;
export const useAgentEngageMe = useGenerateEngagementIntelligence;
export const useAgentFollowMe = useGenerateFollowUpTasks;
