import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Instagram,
  MessageCircle,
  Send,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import {
  answerChatbot,
  CHATBOT_SUGGESTIONS,
} from "@/lib/chatbot-knowledge";

/** Update these URLs with your real social profiles. */
const SOCIAL_LINKS = {
  whatsapp: "https://wa.me/212600000000",
  instagram: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/",
} as const;

type ChatMessage = {
  id: string;
  role: "bot" | "user";
  text: string;
};

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.79a8.2 8.2 0 0 0 4.76 1.52V6.84a4.84 4.84 0 0 1-1-.15Z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.04-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35ZM12.05 21.8h-.01a9.78 9.78 0 0 1-4.97-1.36l-.36-.21-3.7.97 1-3.61-.23-.37a9.76 9.76 0 0 1-1.5-5.2 9.8 9.8 0 0 1 9.8-9.79c2.62 0 5.08 1.02 6.93 2.87a9.73 9.73 0 0 1 2.87 6.93 9.8 9.8 0 0 1-9.83 9.77Zm8.4-18.17A11.8 11.8 0 0 0 12.04 0C5.45 0 .1 5.35.1 11.94c0 2.1.55 4.15 1.6 5.96L0 24l6.27-1.64a11.9 11.9 0 0 0 5.76 1.47h.01c6.59 0 11.94-5.35 11.94-11.94 0-3.19-1.24-6.19-3.5-8.44Z" />
    </svg>
  );
}

const socialBtnClass =
  "flex h-9 w-9 items-center justify-center rounded-full text-white shadow-[0_10px_28px_-14px_rgba(0,0,0,0.55)] transition hover:scale-105 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--olive)]/50 sm:h-11 sm:w-11";

export function HomeFloatingWidgets() {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) {
      return;
    }
    bootstrapped.current = true;
    setMessages([
      {
        id: "welcome",
        role: "bot",
        text:
          language === "fr"
            ? "Bonjour ! Je suis l’assistant Maroc Résidences. Posez votre question ou choisissez une suggestion."
            : "Hello! I’m the Maroc Résidences assistant. Ask a question or pick a suggestion.",
      },
    ]);
  }, [language]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, typing, open]);

  const pushBotReply = (userText: string) => {
    setTyping(true);
    window.setTimeout(() => {
      const reply = answerChatbot(userText, language);
      setMessages((current) => [
        ...current,
        { id: `bot-${Date.now()}`, role: "bot", text: reply },
      ]);
      setTyping(false);
    }, 450 + Math.min(800, userText.length * 12));
  };

  const sendMessage = (raw: string) => {
    const text = raw.trim();
    if (!text || typing) return;

    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", text },
    ]);
    setInput("");
    pushBotReply(text);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    sendMessage(input);
  };

  const suggestions = CHATBOT_SUGGESTIONS[language];

  return (
    <>
      {/* Social rail — left on mobile, top-right on desktop */}
      <aside
        className="pointer-events-none fixed left-3 top-[4.75rem] z-[60] flex flex-col gap-2 sm:left-auto sm:right-6 sm:top-28 sm:gap-2.5"
        aria-label="Réseaux sociaux"
      >
        <a
          href={SOCIAL_LINKS.whatsapp}
          target="_blank"
          rel="noreferrer"
          className={cn(socialBtnClass, "pointer-events-auto bg-[#25D366]")}
          aria-label="WhatsApp"
          title="WhatsApp"
        >
          <WhatsAppIcon className="h-4 w-4 sm:h-5 sm:w-5" />
        </a>
        <a
          href={SOCIAL_LINKS.instagram}
          target="_blank"
          rel="noreferrer"
          className={cn(
            socialBtnClass,
            "pointer-events-auto bg-[linear-gradient(45deg,#f58529,#dd2a7b,#8134af)]",
          )}
          aria-label="Instagram"
          title="Instagram"
        >
          <Instagram className="h-4 w-4 sm:h-5 sm:w-5" />
        </a>
        <a
          href={SOCIAL_LINKS.tiktok}
          target="_blank"
          rel="noreferrer"
          className={cn(socialBtnClass, "pointer-events-auto bg-[#111111]")}
          aria-label="TikTok"
          title="TikTok"
        >
          <TikTokIcon className="h-4 w-4 sm:h-5 sm:w-5" />
        </a>
      </aside>

      {/* Chatbot — fixed bottom right */}
      <div className="fixed bottom-4 right-3 z-[60] sm:bottom-6 sm:right-6">
        {open ? (
          <div
            className="mb-3 flex h-[min(480px,65vh)] w-[min(380px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[22px] border border-black/5 bg-white shadow-[0_28px_70px_-28px_rgba(40,36,28,0.55)]"
            role="dialog"
            aria-label="Assistant"
          >
            <header
              className="flex items-center justify-between gap-3 px-4 py-3.5"
              style={{ background: "var(--olive-deep)", color: "var(--cream)" }}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-sm font-semibold tracking-wide">
                    {language === "fr" ? "Assistant MR" : "MR Assistant"}
                  </div>
                  <div className="text-[11px] opacity-80">
                    {language === "fr" ? "En ligne · réponses instantanées" : "Online · instant answers"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 transition hover:bg-white/15"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div
              ref={listRef}
              className="flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,#fbf8f3_0%,#f5f1ea_100%)] px-3.5 py-4"
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
                      message.role === "user"
                        ? "rounded-br-md text-[var(--cream)]"
                        : "rounded-bl-md border border-black/5 bg-white text-[var(--ink)]",
                    )}
                    style={
                      message.role === "user"
                        ? { background: "var(--olive-deep)" }
                        : undefined
                    }
                  >
                    {message.text}
                  </div>
                </div>
              ))}

              {typing ? (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md border border-black/5 bg-white px-3.5 py-2.5 text-sm text-muted-foreground shadow-sm">
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--olive-deep)] [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--olive-deep)] [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--olive-deep)] [animation-delay:240ms]" />
                    </span>
                  </div>
                </div>
              ) : null}

              {messages.length <= 2 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => sendMessage(suggestion)}
                      className="rounded-full border border-[color-mix(in_oklab,var(--olive)_25%,transparent)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--olive-deep)] transition hover:bg-[color-mix(in_oklab,var(--olive)_10%,white)]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <form
              onSubmit={onSubmit}
              className="flex items-center gap-2 border-t border-black/5 bg-white px-3 py-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  language === "fr" ? "Votre message…" : "Your message…"
                }
                className="h-10 flex-1 rounded-full border border-input bg-background px-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--olive)]/40"
              />
              <button
                type="submit"
                disabled={!input.trim() || typing}
                className="flex h-10 w-10 items-center justify-center rounded-full transition disabled:opacity-40"
                style={{ background: "var(--olive-deep)", color: "var(--cream)" }}
                aria-label="Envoyer"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "ml-auto flex h-12 w-12 items-center justify-center rounded-full shadow-[0_16px_40px_-16px_rgba(58,70,40,0.7)] transition hover:scale-105 hover:brightness-110 active:scale-95 sm:h-14 sm:w-14",
          )}
          style={{ background: "var(--terracotta)", color: "var(--cream)" }}
          aria-label={open ? "Fermer le chat" : "Ouvrir le chat"}
        >
          {open ? <X className="h-5 w-5 sm:h-6 sm:w-6" /> : <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />}
        </button>
      </div>
    </>
  );
}
