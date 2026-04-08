import { Link, useLocation } from "wouter";
import {
  Search,
  Mail,
  Calendar,
  FileText,
  BrainCircuit,
  Activity,
  CheckSquare,
  Users,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const agents = [
  { title: "My Leads", url: "/lead-me", icon: Search, desc: "Lead Gen" },
  { title: "My Schedule", url: "/schedule-me", icon: Calendar, desc: "Outreach" },
  { title: "My Prep", url: "/prep-me", icon: FileText, desc: "Meeting Prep" },
  { title: "My Coach", url: "/coach-me", icon: BrainCircuit, desc: "Coaching" },
  { title: "My Engage", url: "/engage-me", icon: Activity, desc: "Live Intel" },
  { title: "My Follow up", url: "/follow-me", icon: CheckSquare, desc: "Tasks" },
  { title: "My Email", url: "/email-me", icon: Mail, desc: "Email" },
];

const data = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar variant="inset" className="border-r-white/5 bg-background">
      <SidebarContent>
        <div className="p-6 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30 shadow-[0_0_15px_rgba(13,148,136,0.3)]">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-white">Sales AI</span>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground font-medium uppercase tracking-wider text-xs">Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={`hover-elevate transition-all duration-200 ${isActive ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground hover:text-white'}`}
                    >
                      <Link href={item.url}>
                        <item.icon className={isActive ? "text-primary" : ""} />
                        <span className="font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-muted-foreground font-medium uppercase tracking-wider text-xs">AI Agents Pipeline</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {agents.map((agent) => {
                const isActive = location.startsWith(agent.url);
                return (
                  <SidebarMenuItem key={agent.title}>
                    <SidebarMenuButton
                      asChild
                      className={`hover-elevate transition-all duration-200 ${isActive ? 'bg-accent/15 text-accent border border-accent/30' : 'text-muted-foreground hover:text-white'}`}
                    >
                      <Link href={agent.url === '/schedule-me' ? '/leads' : agent.url}>
                        <agent.icon className={isActive ? "text-accent" : ""} />
                        <span className="font-medium">{agent.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
