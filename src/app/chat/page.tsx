"use client"
import { AppSidebar } from "@/components/app-sidebar"
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb"
import { ChatInput } from "@/components/ui/chat/chat-input"
import { ChatMessageList } from "@/components/ui/chat/chat-message-list"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"


type Message = {
  id: number
  author: string
  content: string
  time: string
  isOwn: boolean
}

const dummyMessages: Message[] = [
  { id: 1, author: "Alice", content: "Hey Chris, how's the project going?", time: "09:00 AM", isOwn: false },
  { id: 2, author: "You",   content: "Pretty good! Just wiring up the UI now.",   time: "09:02 AM", isOwn: true },
  { id: 3, author: "Alice", content: "Nice—don't forget the scroll-to-bottom button!", time: "09:03 AM", isOwn: false },
  { id: 4, author: "You",   content: "Haha, it's in there. Testing it out now.",     time: "09:05 AM", isOwn: true },
]


export default function Page() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "350px",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        <header className="bg-background sticky top-0 flex shrink-0 items-center gap-2 border-b p-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">All Inboxes</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Inbox</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col p-4 gap-4 pt-0">
          {/* Chat area */}
          <div className="flex-1 flex flex-col border rounded-lg overflow-hidden">
            <ChatMessageList className="flex-1">
              {dummyMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.isOwn ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-xs px-3 py-2 rounded-lg ${
                      msg.isOwn
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-900"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <span className="block text-xs mt-1 opacity-70">
                      {msg.time}
                    </span>
                  </div>
                </div>
              ))}
            </ChatMessageList>

            <div className="border-t p-3">
              <ChatInput placeholder="Type your message…" />
              <div className="pt-2">
                <Button className="w-full">Send</Button>
              </div>
            </div>
            
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
