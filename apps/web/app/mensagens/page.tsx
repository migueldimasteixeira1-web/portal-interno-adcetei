"use client";

import { MessageCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import LoadingScreen from "@/components/LoadingScreen";
import PageHeader from "@/components/PageHeader";
import SearchParamsSuspense from "@/components/SearchParamsSuspense";
import { Alert, Card, EmptyState, cn } from "@/components/ui";
import ChatConversationList from "@/features/chat/ChatConversationList";
import ChatThread from "@/features/chat/ChatThread";
import NewConversationDialog from "@/features/chat/NewConversationDialog";
import { api } from "@/lib/api";
import type { ChatContact, ChatConversation, ChatMessage } from "@/lib/types";

const MESSAGE_POLL_MS = 4000;
const CONVERSATION_POLL_MS = 10000;

function MensagensContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const lastMessageIdRef = useRef<number | null>(null);
  const deepLinkHandled = useRef(false);

  const loadConversations = useCallback(() => {
    return api
      .chatConversations()
      .then(setConversations)
      .catch((err) => setError(err instanceof Error ? err.message : "Não foi possível carregar as conversas."));
  }, []);

  useEffect(() => {
    void loadConversations().finally(() => setInitialLoading(false));
    const timer = setInterval(() => void loadConversations(), CONVERSATION_POLL_MS);
    return () => clearInterval(timer);
  }, [loadConversations]);

  const openConversation = useCallback(
    (contact: ChatContact) => {
      setSelectedContact(contact);
      setMessages([]);
      lastMessageIdRef.current = null;
      setNewConversationOpen(false);
      router.replace(`/mensagens?with=${contact.id}`);
    },
    [router],
  );

  useEffect(() => {
    if (initialLoading || deepLinkHandled.current) return;
    const withId = Number(searchParams.get("with"));
    if (!withId) {
      deepLinkHandled.current = true;
      return;
    }
    deepLinkHandled.current = true;
    const existing = conversations.find((item) => item.contact.id === withId);
    if (existing) {
      setSelectedContact(existing.contact);
      return;
    }
    void api.chatContacts().then((contacts) => {
      const contact = contacts.find((item) => item.id === withId);
      if (contact) setSelectedContact(contact);
    });
  }, [initialLoading, searchParams, conversations]);

  useEffect(() => {
    if (!selectedContact) return;
    let cancelled = false;
    setThreadLoading(true);
    api
      .chatMessages(selectedContact.id)
      .then((result) => {
        if (cancelled) return;
        setMessages(result);
        lastMessageIdRef.current = result.length ? result[result.length - 1].id : null;
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Não foi possível carregar as mensagens."))
      .finally(() => {
        if (!cancelled) setThreadLoading(false);
      });
    void api
      .markChatRead(selectedContact.id)
      .then(() => {
        setConversations((current) =>
          current.map((item) => (item.contact.id === selectedContact.id ? { ...item, unread_count: 0 } : item)),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedContact]);

  useEffect(() => {
    if (!selectedContact) return;
    const timer = setInterval(() => {
      void api.chatMessages(selectedContact.id, lastMessageIdRef.current ?? undefined).then((incoming) => {
        if (!incoming.length) return;
        setMessages((current) => [...current, ...incoming]);
        lastMessageIdRef.current = incoming[incoming.length - 1].id;
        if (incoming.some((message) => message.sender_id === selectedContact.id)) {
          void api
            .markChatRead(selectedContact.id)
            .then(() => {
              setConversations((current) =>
                current.map((item) => (item.contact.id === selectedContact.id ? { ...item, unread_count: 0 } : item)),
              );
            })
            .catch(() => {});
        }
      });
    }, MESSAGE_POLL_MS);
    return () => clearInterval(timer);
  }, [selectedContact]);

  const handleSend = useCallback(
    async (body: string) => {
      if (!selectedContact) return;
      setSending(true);
      try {
        const message = await api.sendChatMessage(selectedContact.id, body);
        setMessages((current) => [...current, message]);
        lastMessageIdRef.current = message.id;
        void loadConversations();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível enviar a mensagem.");
      } finally {
        setSending(false);
      }
    },
    [selectedContact, loadConversations],
  );

  if (initialLoading || !user) return <LoadingScreen label="Carregando mensagens..." />;

  return (
    <>
      <PageHeader eyebrow="Portal" title="Mensagens" subtitle="Converse diretamente com outros servidores do portal." />
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <Card className="grid h-[calc(100vh-15rem)] min-h-[420px] overflow-hidden md:grid-cols-[320px_minmax(0,1fr)]">
        <div className={cn("min-h-0 border-[var(--border-subtle)] md:block md:border-r", selectedContact ? "hidden" : "block")}>
          <ChatConversationList
            conversations={conversations}
            selectedContactId={selectedContact?.id ?? null}
            onSelect={(contactId) => {
              const conversation = conversations.find((item) => item.contact.id === contactId);
              if (conversation) openConversation(conversation.contact);
            }}
            onNewConversation={() => setNewConversationOpen(true)}
          />
        </div>
        <div className={cn("min-h-0 md:block", selectedContact ? "block" : "hidden")}>
          {selectedContact ? (
            <ChatThread
              contact={selectedContact}
              messages={messages}
              loading={threadLoading}
              currentUser={user}
              sending={sending}
              onSend={handleSend}
              onBack={() => {
                setSelectedContact(null);
                router.replace("/mensagens");
              }}
            />
          ) : (
            <EmptyState
              className="h-full items-center justify-center"
              icon={<MessageCircle size={20} />}
              title="Selecione uma conversa"
              description="Escolha alguém na lista ao lado ou inicie uma nova conversa."
            />
          )}
        </div>
      </Card>

      <NewConversationDialog open={newConversationOpen} onOpenChange={setNewConversationOpen} onSelect={openConversation} />
    </>
  );
}

export default function MensagensPage() {
  return (
    <SearchParamsSuspense>
      <MensagensContent />
    </SearchParamsSuspense>
  );
}
