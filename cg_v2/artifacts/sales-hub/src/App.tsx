import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setBaseUrl } from "@workspace/api-client-react";
import { MayaProvider } from "@/contexts/maya-context";
import { MayaFloat } from "@/components/maya-float";

if (import.meta.env.VITE_API_URL) {
  setBaseUrl(import.meta.env.VITE_API_URL);
}
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import LeadMe from "@/pages/lead-me";
import EmailMe from "@/pages/email-me";
import LeadsList from "@/pages/leads";
import LeadProfile from "@/pages/lead-profile";
import ScheduleMe from "@/pages/schedule-me";
import PrepMe from "@/pages/prep-me";
import CoachMe from "@/pages/coach-me";
import EngageMe from "@/pages/engage-me";
import FollowMe from "@/pages/follow-me";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/lead-me" component={LeadMe} />
      <Route path="/email-me" component={EmailMe} />
      <Route path="/leads" component={LeadsList} />
      <Route path="/leads/:id" component={LeadProfile} />
      <Route path="/schedule-me/:id" component={ScheduleMe} />
      <Route path="/prep-me" component={PrepMe} />
      <Route path="/coach-me" component={CoachMe} />
      <Route path="/engage-me" component={EngageMe} />
      <Route path="/follow-me" component={FollowMe} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <MayaProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
            <MayaFloat />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </MayaProvider>
  );
}

export default App;
