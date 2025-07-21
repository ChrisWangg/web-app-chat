"use client"

import * as React from "react"
import {
  AlertCircleIcon,
  ArchiveX,
  Command,
  File,
  Inbox,
  Send,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"

import { NavUser } from "@/components/nav-user"
import { Label } from "@/components/ui/label"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog"
import { Button } from "./ui/button"
import { Alert, AlertTitle } from "./ui/alert"

// ── Type Definitions ─────────────────────────────────────────────────────────
interface Mail {
  name: string
  email: string
  subject: string
  date: string
  teaser: string
}

interface NavItem {
  title: string
  url: string
  icon: React.ComponentType<any>
  isActive: boolean
}

interface SidebarData {
  user: { name: string; email: string; avatar: string }
  navMain: NavItem[]
  mails: Mail[]
}

// ── Sample Data (trimmed for brevity) ────────────────────────────────────────
const data: SidebarData = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    { title: "Inbox", url: "#", icon: Inbox, isActive: true },
    { title: "Drafts", url: "#", icon: File, isActive: false },
    { title: "Sent", url: "#", icon: Send, isActive: false },
    { title: "Junk", url: "#", icon: ArchiveX, isActive: false },
    { title: "Trash", url: "#", icon: Trash2, isActive: false },
  ],
  mails: [],
}

// ── Component ────────────────────────────────────────────────────────────────
export function AppSidebar(
  {
    onSelectFriend,
    selectedFriend,
    ...props
  }: React.ComponentProps<typeof Sidebar> & {
    onSelectFriend?: (email: string) => void
    selectedFriend?: string | null
  }
) {
  const [activeItem, setActiveItem] = React.useState<NavItem>(data.navMain[0])
  const [mails, setMails] = React.useState<Mail[]>(data.mails)
  const { setOpen } = useSidebar()

  // Pull out the friend‐loading logic
  const fetchFriends = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/friends", {
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to load friends")
      const friends: string[] = await res.json()
      setMails(
        friends.map((e) => ({
          name: e.split("@")[0],
          email: e,
          subject: "",
          date: "",
          teaser: "",
        }))
      )
    } catch (err) {
      console.error(err)
    }
  }

  React.useEffect(() => {
    fetchFriends()
  }, [])

  const [friendUsername, setFriendUsername] = React.useState("")
  const [friendError, setFriendError] = React.useState<string | null>(null)

  const handleAddFriend = async () => {
    setFriendError(null)
    try {
      const res = await fetch("http://localhost:8000/api/add-friend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: friendUsername,
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.detail || "Add friend failed")
      }
      setFriendUsername("")
      await fetchFriends()
    } catch (err: any) {
      setFriendError(err.message)
    }
  }

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      {...props}
    >
      {/* ── Left icon‑only bar ───────────────────────────────────────────── */}
      <Sidebar collapsible="none" className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
                <a href="#">
                  <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                    <Command className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">Acme Inc</span>
                    <span className="truncate text-xs">Enterprise</span>
                  </div>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {data.navMain.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={{ children: item.title, hidden: false }}
                      onClick={() => {
                        setActiveItem(item)
                        setOpen(true)
                      }}
                      isActive={activeItem.title === item.title}
                      className="px-2.5 md:px-2"
                    >
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <NavUser user={data.user} />
        </SidebarFooter>
      </Sidebar>

      {/* ── Right sidebar with friend list ─────────────────────────────── */}
      <Sidebar collapsible="none" className="hidden flex-1 md:flex">
        <SidebarHeader className="gap-3.5 border-b p-4">
          <div className="flex w-full items-center justify-between">
            <div className="text-foreground text-base font-medium">
              {activeItem.title}
            </div>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Add Friend
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>Add Friend</DialogTitle>
                <DialogDescription>
                  Enter username (email) to add a new friend.
                </DialogDescription>

                {friendError && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircleIcon />
                    <AlertTitle>{friendError}</AlertTitle>
                  </Alert>
                )}

                <div className="mt-4 space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="friend-username">Username</Label>
                    <input
                      id="friend-username"
                      className="block w-full rounded-md border p-2"
                      value={friendUsername}
                      onChange={(e) => setFriendUsername(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-2">
                  <DialogClose asChild>
                    <Button variant="outline" size="sm">
                      Cancel
                    </Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button
                      size="sm"
                      onClick={handleAddFriend}
                    >
                      Add
                    </Button>
                  </DialogClose>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <SidebarInput placeholder="Type to search..." className="mt-3" />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="px-0">
            <SidebarGroupContent>
              {mails.map((mail) => (
                <button
                  type="button"
                  key={mail.email}
                  onClick={() => onSelectFriend?.(mail.email)}
                  className={cn(
                    "flex w-full flex-col items-start gap-2 border-b p-4 text-left text-sm leading-tight last:border-b-0",
                    mail.email === selectedFriend
                      ? "bg-muted text-foreground font-semibold"
                      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <div className="flex w-full items-center gap-2">
                    <span>{mail.name}</span>
                  </div>
                </button>
              ))}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </Sidebar>
  )
}
