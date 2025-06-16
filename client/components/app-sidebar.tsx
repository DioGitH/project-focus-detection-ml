/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"

import { Calendar, Home, Inbox, Search, Settings, TestTube } from "lucide-react"


// Menu items.
const items = [
    {
        title: "Dashboard",
        url: "/",
        icon: Home,
    },
    {
        title: "Focus Detection Test",
        url: "/example-cam",
        icon: TestTube,
    },
    // {
    //     title: "Admin Page",
    //     url: "/admin",
    //     icon: Calendar,
    // },
    {
        title: "Example Exam",
        url: "/example-quiz",
        icon: Search,
    },
]

export function AppSidebar() {
    return (
        <Sidebar>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Focus Detection</SidebarGroupLabel>
                    
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild>
                                        <a href={item.url}>
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    )
}
