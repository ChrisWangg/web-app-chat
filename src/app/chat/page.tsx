"use client"
import React, { useState, useEffect, useMemo } from "react"
import useSWR from "swr"
import {
  encryptForBoth,
  decryptWithKey,
  getOrCreateKeyPair,
  exportPublicKey,
  importPublicKey,
} from "@/lib/crypto"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
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

/* ── Types ──────────────────────────────────────────────────────────────── */
type RawMsg = {
  id: number
  from_email: string
  to_email: string
  ciphertext: string
  encrypted_key: string
  encrypted_key_self?: string
  iv: string
  tag: string
  timestamp: number
}

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error("Fetch failed")
    return r.json()
  })

/* ── Component ───────────────────────────────────────────────────────────── */
export default function Page() {
  /* Local state ------------------------------------------------------------*/
  const [input, setInput] = useState("")
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null)
  const [publicKeyCache, setPublicKeyCache] = useState<Record<string, CryptoKey>>({})
  const [plaintextCache, setPlaintextCache] = useState<Record<number, string>>({})

  /* Session & messages -----------------------------------------------------*/
  const { data: me, error: meErr } = useSWR<{ email: string }>("http://localhost:8000/api/auth/me", fetcher)
  const myEmail = me?.email ?? ""

  const {
    data: msgs = [],
    error: msgErr,
    isLoading,
    mutate,
  } = useSWR<RawMsg[]>(
    me ? "http://localhost:8000/api/messages" : null,
    fetcher,
    { refreshInterval: 5000, fallbackData: [] }
  )

  /* Upload key once per session -------------------------------------------*/
  useEffect(() => {
    if (!myEmail) return
    ;(async () => {
      await getOrCreateKeyPair()
      const pub = await exportPublicKey()
      fetch("http://localhost:8000/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key: pub }),
      }).catch(() => {})
    })()
  }, [myEmail])

  /* Helper: fetch/cached recipient key -------------------------------------*/
  const getRecipientKey = async (email: string) => {
    if (publicKeyCache[email]) return publicKeyCache[email]
    const res = await fetch(`http://localhost:8000/api/keys/${email}`, { credentials: "include" })
    if (!res.ok) throw new Error("Recipient has not uploaded a key yet")
    const { key } = await res.json()
    const pub = await importPublicKey(key)
    setPublicKeyCache((c) => ({ ...c, [email]: pub }))
    return pub
  }

  /* Decrypt all unseen messages (both incoming & own after refresh) --------*/
  useEffect(() => {
    const undec = msgs.filter((m) => !(m.id in plaintextCache))
    if (undec.length === 0) return

    ;(async () => {
      const arr = await Promise.all(
        undec.map(async (m) => {
          const encKey =
            m.from_email === myEmail && m.encrypted_key_self
              ? m.encrypted_key_self
              : m.encrypted_key
          try {
            const text = await decryptWithKey(
              { ciphertext: m.ciphertext, iv: m.iv, tag: m.tag },
              encKey
            )
            return { id: m.id, text }
          } catch {
            return { id: m.id, text: "[decrypt-failed]" }
          }
        })
      )
      setPlaintextCache((p) => arr.reduce((acc, { id, text }) => ({ ...acc, [id]: text }), p))
    })()
  }, [msgs, myEmail, plaintextCache])

  /* Send message -----------------------------------------------------------*/
  const sendMessage = async () => {
    if (!selectedFriend || !input.trim()) return
    try {
      const recipientPub = await getRecipientKey(selectedFriend)
      const myPub       = (await getOrCreateKeyPair()).publicKey
      const pack        = await encryptForBoth(input, recipientPub, myPub)

      const res = await fetch("http://localhost:8000/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ to_email: selectedFriend, ...pack }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || "Send failed")
      }
      const newMsg: RawMsg = await res.json()

      // cache own plaintext so UI shows instantly and after refresh
      setPlaintextCache((p) => ({ ...p, [newMsg.id]: input }))
      setInput("")
      mutate()
    } catch (e: any) {
      alert(e.message)
    }
  }

  /* Derived + transformed list for UI -------------------------------------*/
  const filt = useMemo(() => {
    if (!selectedFriend) return []
    return msgs.filter(
      (m) =>
        (m.from_email === myEmail && m.to_email === selectedFriend) ||
        (m.from_email === selectedFriend && m.to_email === myEmail)
    )
  }, [msgs, selectedFriend, myEmail])

  const uiMsgs = filt.map((m) => ({
    id: m.id,
    author: m.from_email,
    content: plaintextCache[m.id] ?? "…",
    time: new Date(m.timestamp * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    isOwn: m.from_email === myEmail,
  }))

  /* Early returns ----------------------------------------------------------*/
  if (meErr)       return <div className="p-4 text-red-600">Please log in.</div>
  if (!me)         return <div className="p-4">Checking session…</div>
  if (msgErr)      return <div className="p-4 text-red-600">Failed to load messages.</div>
  if (isLoading)   return <div className="p-4">Loading messages…</div>

  /* Render -----------------------------------------------------------------*/
  return (
    <SidebarProvider style={{ "--sidebar-width": "350px" } as React.CSSProperties}>
      <AppSidebar onSelectFriend={setSelectedFriend} selectedFriend={selectedFriend} />

      <SidebarInset>
        <header className="bg-background sticky top-0 flex shrink-0 items-center gap-2 border-b p-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">All Chats</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{selectedFriend ?? "No Conversation"}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="flex flex-1 flex-col p-4 gap-4 pt-0">
          <div className="flex-1 flex flex-col border rounded-lg overflow-hidden">
            {/* Chat body */}
            {!selectedFriend ? (
              <div className="m-auto text-sm text-muted-foreground">Select a friend to start chatting</div>
            ) : (
              <ChatMessageList className="flex-1">
                {uiMsgs.length === 0 ? (
                  <div className="m-auto text-sm text-muted-foreground">No messages yet – say hi!</div>
                ) : (
                  uiMsgs.map((m) => (
                    <div key={m.id} className={`flex ${m.isOwn ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-xs px-3 py-2 rounded-lg ${
                          m.isOwn ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-900"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.content}</p>
                        <span className="block text-xs mt-1 opacity-70">{m.time}</span>
                      </div>
                    </div>
                  ))
                )}
              </ChatMessageList>
            )}

            {/* Input area */}
            <div className="border-t p-3">
              <ChatInput
                placeholder={selectedFriend ? "Type your message…" : "Pick a friend first…"}
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
