import {
  useGenerateLeads,
  useGenerateEmail,
  useGenerateMeetingPrep,
  useGenerateCoachingPlan,
  useGenerateEngagementIntelligence,
  useGenerateFollowUpTasks,
} from "@workspace/api-client-react";

// Re-exporting agent hooks for consistency
export const useAgentLeadMe = useGenerateLeads;
export const useAgentScheduleMe = useGenerateEmail;
export const useAgentPrepMe = useGenerateMeetingPrep;
export const useAgentCoachMe = useGenerateCoachingPlan;
export const useAgentEngageMe = useGenerateEngagementIntelligence;
export const useAgentFollowMe = useGenerateFollowUpTasks;
