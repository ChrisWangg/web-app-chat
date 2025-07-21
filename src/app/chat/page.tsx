"use client"
import React, { useState } from "react"
import useSWR from "swr"

import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { ChatInput } from "@/components/ui/chat/chat-input"
import { ChatMessageList } from "@/components/ui/chat/chat-message-list"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"

type Message = {
  id: number
  from_email: string
  to_email: string
  content: string
  timestamp: number
}

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((res) => {
    if (!res.ok) throw new Error("Fetch failed")
    return res.json()
  })

export default function Page() {
  /* ─────────────────────
     Local & remote state
  ────────────────────────*/
  const [input, setInput] = useState("")
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null)

  const { data: me, error: meError } = useSWR<{ email: string }>(
    "http://localhost:8000/api/auth/me",
    fetcher
  )

  const {
    data: messages,
    error,
    isLoading,
    mutate,
  } = useSWR<Message[]>(
    me ? "http://localhost:8000/api/messages" : null,
    fetcher,
    {
      refreshInterval: 5000,
      fallbackData: [],
    }
  )

  /* ─────────────────────
     Derived data – call hooks *before* any early returns
  ────────────────────────*/
  const myEmail = me?.email ?? "" // safe fallback while session loads

  const filteredMessages = React.useMemo(() => {
    if (!selectedFriend) return []
    const list = messages ?? []
    return list.filter(
      (m) =>
        (m.from_email === myEmail && m.to_email === selectedFriend) ||
        (m.from_email === selectedFriend && m.to_email === myEmail)
    )
  }, [messages, selectedFriend, myEmail])

  const transformedMessages = filteredMessages.map((msg) => ({
    id: msg.id,
    author: msg.from_email,
    content: msg.content,
    time: new Date(msg.timestamp * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    isOwn: msg.from_email === myEmail,
  }))

  /* ─────────────────────
     Early‑return states (after *all* hooks)
  ────────────────────────*/
  if (meError) return <div className="p-4 text-red-600">Please log in.</div>
  if (!me) return <div className="p-4">Checking session…</div>
  if (error) return <div className="p-4 text-red-600">Failed to load messages.</div>
  if (isLoading) return <div className="p-4">Loading messages…</div>

  /* ─────────────────────
     Handlers
  ────────────────────────*/
  const sendMessage = async () => {
    if (!selectedFriend) return
    const res = await fetch("http://localhost:8000/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        to_email: selectedFriend,
        content: input,
      }),
    })
    if (res.ok) {
      setInput("")
      mutate()
    }
  }

  /* ─────────────────────
     Render
  ────────────────────────*/
  return (
    <SidebarProvider style={{ "--sidebar-width": "350px" } as React.CSSProperties}>
      <AppSidebar
        onSelectFriend={setSelectedFriend}
        selectedFriend={selectedFriend}
      />

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
                <BreadcrumbLink href="#">All Chats</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {selectedFriend ?? "No Conversation"}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="flex flex-1 flex-col p-4 gap-4 pt-0">
          <div className="flex-1 flex flex-col border rounded-lg overflow-hidden">
            {/* ---------- Chat body / Empty state ---------- */}
            {!selectedFriend ? (
              <div className="m-auto text-sm text-muted-foreground">
                Select a friend to start chatting
              </div>
            ) : (
              <ChatMessageList className="flex-1">
                {transformedMessages.length === 0 ? (
                  <div className="m-auto text-sm text-muted-foreground">
                    No messages yet - say hi!
                  </div>
                ) : (
                  transformedMessages.map((msg) => (
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
                  ))
                )}
              </ChatMessageList>
            )}

            {/* ---------- Input area ---------- */}
            <div className="border-t p-3">
              <ChatInput
                placeholder={
                  selectedFriend ? "Type your message…" : "Pick a friend first…"
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!selectedFriend}
              />
              <div className="pt-2">
                <Button
                  className="w-full"
                  onClick={sendMessage}
                  disabled={!selectedFriend || !input.trim()}
                >
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
