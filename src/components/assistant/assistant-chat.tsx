"use client";

import { useEffect, useRef, useState } from "react";

import {
  askAssistant,
  type AskResult,
  type AssistantSource,
} from "@/lib/ai/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * AI financial assistant chat.
 *
 * Conversation history is held in React state only, so it lives for the
 * current session and is never persisted. Each request re-retrieves the user's
 * current data, so answers and their source counts stay accurate as data
 * changes during the session.
 */

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Present on assistant messages: transparency line + source chips. */
  sourceSummary?: string;
  sources?: AssistantSource[];
  periodLabel?: string;
  /** True when the assistant turn represents an error. */
  isError?: boolean;
};

const EXAMPLE_QUESTIONS = [
  "How much did I spend this month?",
  "Where is most of my money going?",
  "How am I doing against my budgets?",
  "Can I afford to spend 100,000 TZS?",
];

let messageCounter = 0;
function nextId(): string {
  messageCounter += 1;
  return `msg-${messageCounter}`;
}

export function AssistantChat({
  configured,
}: {
  configured: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pending]);

  async function send(question: string) {
    const trimmed = question.trim();
    if (trimmed === "" || pending) return;

    const userMessage: ChatMessage = {
      id: nextId(),
      role: "user",
      content: trimmed,
    };

    // History sent to the server excludes the message we just added; the server
    // attaches the new question together with fresh context.
    const history = messages
      .filter((message) => !message.isError)
      .map((message) => ({ role: message.role, content: message.content }));

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setPending(true);

    try {
      const result: AskResult = await askAssistant({
        question: trimmed,
        history,
      });

      if (result.ok) {
        setMessages((current) => [
          ...current,
          {
            id: nextId(),
            role: "assistant",
            content: result.answer,
            sourceSummary: result.sourceSummary,
            sources: result.sources,
            periodLabel: result.periodLabel,
          },
        ]);
      } else {
        setMessages((current) => [
          ...current,
          {
            id: nextId(),
            role: "assistant",
            content: result.error,
            isError: true,
          },
        ]);
      }
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: nextId(),
          role: "assistant",
          content: "Something went wrong reaching the assistant. Please try again.",
          isError: true,
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {!configured && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning">
          The assistant is not configured. Set <code>GEMINI_API_KEY</code> to
          enable it.
        </div>
      )}

      {/* The scroll area grows to fill the panel; the composer stays pinned. */}
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <EmptyConversation disabled={!configured || pending} onPick={send} />
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {pending && <ThinkingBubble />}
          </>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
        className="flex shrink-0 items-end gap-2"
      >
        <label htmlFor="assistant-input" className="sr-only">
          Ask a financial question
        </label>
        <Textarea
          id="assistant-input"
          rows={2}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(input);
            }
          }}
          placeholder="Ask about your spending, budgets, or balances…"
          disabled={!configured || pending}
          className="min-h-[3rem] resize-none"
        />
        <Button
          type="submit"
          disabled={!configured || pending || input.trim() === ""}
        >
          {pending ? "Thinking…" : "Send"}
        </Button>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : message.isError
              ? "border border-negative/30 bg-negative/5 text-negative"
              : "border border-border bg-surface text-foreground"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>

        {!isUser && message.sourceSummary && (
          <div className="mt-2 border-t border-border/60 pt-2">
            <p className="text-[11px] text-muted-foreground">
              {message.sourceSummary}
              {message.periodLabel ? ` · ${message.periodLabel}` : ""}
            </p>
            {message.sources && message.sources.some((s) => s.count > 0) && (
              <div className="mt-1 flex flex-wrap gap-1">
                {message.sources
                  .filter((source) => source.count > 0)
                  .map((source) => (
                    <span
                      key={source.label}
                      className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      {source.count} {source.label}
                    </span>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl border border-border bg-surface px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
          <span className="ml-1">Reading your financial data…</span>
        </span>
      </div>
    </div>
  );
}

function EmptyConversation({
  onPick,
  disabled,
}: {
  onPick: (question: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center">
      <h2 className="text-base font-semibold">
        Ask about your money
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Answers are based on your own accounts, transactions and budgets — not
        general advice. Nothing you type is used to train anything.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {EXAMPLE_QUESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            disabled={disabled}
            onClick={() => onPick(question)}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
