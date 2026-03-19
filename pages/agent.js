import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { SmartAgent } from "../lib/agentActions";
import ReactMarkdown from "react-markdown";

export default function AgentPage() {
  const { isAuthenticated, isAdmin, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin w-10 h-10 border-3 border-neon-500 border-t-transparent rounded-full"></div>
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>AI Assistant | sabyasachi.online</title>
      </Head>
      <ChatInterface isAdmin={isAdmin} user={user} />
    </>
  );
}

function ChatInterface({ isAdmin, user }) {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const agent = useMemo(() => new SmartAgent(isAdmin, user), [isAdmin, user]);

  // Welcome message
  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: `👋 Hello${user?.name ? `, ${user.name}` : ""}! I'm your AI assistant.\n\nI can help you **search voters**, **view statistics**, and **print slips**.\n\nType a name to search, or try:\n• "Find voter Ramesh"\n• "Show statistics"\n• "Help"`,
        timestamp: new Date(),
      },
    ]);
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(
    async (text) => {
      if (!text.trim() || loading) return;

      setMessages((prev) => [
        ...prev,
        { role: "user", content: text, timestamp: new Date() },
      ]);
      setInput("");
      setLoading(true);

      try {
        const response = await agent.processMessage(text);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: response.content,
            data: response,
            timestamp: new Date(),
          },
        ]);

        if (response.action?.type === "print") {
          router.push(`/voter/${response.action.voterId}`);
        }
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `❌ Error: ${error.message}`,
            timestamp: new Date(),
          },
        ]);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [loading, agent, router],
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="min-h-screen bg-ink-50 flex flex-col">
      {/* Header */}
      <header className="bg-ink-100 border-b border-ink-400 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              router.push(isAdmin ? "/admin/dashboard" : "/search")
            }
            className="p-2 hover:bg-ink-200 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            <div>
              <h1 className="text-white font-semibold text-sm">AI Assistant</h1>
              <p className="text-xs text-slate-500">Gemini 2.0 Flash</p>
            </div>
          </div>
        </div>
        <span
          className={`px-2 py-1 rounded text-xs ${isAdmin ? "bg-purple-500/20 text-purple-300" : "bg-blue-500/20 text-blue-300"}`}
        >
          {isAdmin ? "Admin" : "User"}
        </span>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} onQuickReply={sendMessage} />
        ))}

        {loading && (
          <div className="flex gap-3">
            <span className="text-xl">🤖</span>
            <div className="bg-ink-200 rounded-lg px-4 py-2 flex gap-1">
              <span
                className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              ></span>
              <span
                className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              ></span>
              <span
                className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              ></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {["Search for a voter", "Show statistics", "Help"].map((q, i) => (
            <button
              key={i}
              onClick={() => sendMessage(q)}
              className="px-3 py-1.5 text-xs bg-ink-200 hover:bg-ink-300 text-slate-300 rounded-lg border border-ink-400 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-4 bg-ink-100 border-t border-ink-400"
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message or voter name..."
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-ink-200 border border-ink-400 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-neon-500 text-sm disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 bg-neon-500 hover:bg-neon-400 disabled:bg-ink-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}

function Message({ msg, onQuickReply }) {
  const isUser = msg.role === "user";
  const data = msg.data;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <span className="text-xl flex-shrink-0">{isUser ? "👤" : "🤖"}</span>

      <div className={`max-w-[85%] ${isUser ? "ml-auto" : ""}`}>
        <div
          className={`rounded-lg px-4 py-2.5 ${
            isUser ? "bg-neon-600 text-white" : "bg-ink-200 text-slate-200"
          }`}
        >
          {isUser ? (
            <p className="text-sm">{msg.content}</p>
          ) : (
            <div className="prose-sm">
              <ReactMarkdown
                components={{
                  p: ({ children }) => (
                    <p className="text-sm text-slate-200 mb-2 last:mb-0">
                      {children}
                    </p>
                  ),
                  strong: ({ children }) => (
                    <strong className="text-white font-semibold">
                      {children}
                    </strong>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside text-sm text-slate-300 space-y-1 my-2">
                      {children}
                    </ul>
                  ),
                  li: ({ children }) => <li>{children}</li>,
                  h1: ({ children }) => (
                    <h1 className="text-base font-bold text-white mb-2">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-sm font-semibold text-neon-300 mb-2 mt-3">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-sm font-medium text-slate-100 mb-1">
                      {children}
                    </h3>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="min-w-full text-xs">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="px-2 py-1 bg-ink-300 text-left text-slate-200 font-medium">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-2 py-1 border-t border-ink-400 text-slate-300">
                      {children}
                    </td>
                  ),
                  hr: () => <hr className="border-ink-400 my-3" />,
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Voter Cards */}
        {data?.voters && data.voters.length > 0 && (
          <div className="mt-2 space-y-2">
            {data.voters.map((v, i) => (
              <VoterCard key={i} voter={v} onAction={onQuickReply} />
            ))}
          </div>
        )}

        {/* Voter Detail */}
        {data?.voterDetail && (
          <VoterDetailCard voter={data.voterDetail} onAction={onQuickReply} />
        )}

        {/* Quick Replies */}
        {data?.showQuickReplies && (
          <div className="flex flex-wrap gap-2 mt-2">
            {data.showQuickReplies.map((reply, i) => (
              <button
                key={i}
                onClick={() => onQuickReply(reply)}
                className="px-2.5 py-1 text-xs bg-ink-300 hover:bg-ink-400 text-slate-300 hover:text-white rounded border border-ink-500 transition-colors"
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        <p className="text-[10px] text-slate-600 mt-1">
          {msg.timestamp?.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

function VoterCard({ voter, onAction }) {
  return (
    <div
      onClick={() => onAction(`Show details of voter ${voter.voterId}`)}
      className="bg-ink-300 border border-ink-500 rounded-lg p-3 cursor-pointer hover:border-neon-500/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-ink-400 rounded-full flex items-center justify-center text-lg">
          {voter.gender === "M" || voter.gender === "Male" ? "👨" : "👩"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm truncate">
            {voter.name}
          </p>
          <p className="text-xs text-slate-400">
            <span className="text-neon-400">{voter.voterId}</span> • {voter.age}{" "}
            yrs • {voter.gender}
          </p>
          <p className="text-xs text-slate-500 truncate">📍 {voter.assembly}</p>
        </div>
        <svg
          className="w-4 h-4 text-slate-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </div>
  );
}

function VoterDetailCard({ voter, onAction }) {
  return (
    <div className="mt-2 bg-gradient-to-br from-ink-300 to-ink-400 border border-ink-500 rounded-lg p-4">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 bg-ink-500 rounded-full flex items-center justify-center text-2xl border-2 border-neon-500/30">
          {voter.gender === "M" || voter.gender === "Male" ? "👨" : "👩"}
        </div>
        <div className="flex-1">
          <h3 className="text-white font-semibold">{voter.name}</h3>
          <p className="text-neon-400 text-sm font-mono">{voter.voterId}</p>

          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <div>
              <span className="text-slate-500">Father:</span>{" "}
              <span className="text-slate-300">{voter.fatherName || "—"}</span>
            </div>
            <div>
              <span className="text-slate-500">Age:</span>{" "}
              <span className="text-slate-300">{voter.age}</span>
            </div>
            <div>
              <span className="text-slate-500">Gender:</span>{" "}
              <span className="text-slate-300">{voter.gender}</span>
            </div>
            <div>
              <span className="text-slate-500">Part:</span>{" "}
              <span className="text-slate-300">{voter.partNumber}</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-500">Assembly:</span>{" "}
              <span className="text-slate-300">{voter.assembly}</span>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onAction("Print voter slip")}
              className="px-3 py-1.5 bg-neon-500 hover:bg-neon-400 text-white text-xs rounded transition-colors"
            >
              🖨️ Print Slip
            </button>
            <button
              onClick={() => onAction("Search another voter")}
              className="px-3 py-1.5 bg-ink-500 hover:bg-ink-400 text-slate-300 text-xs rounded transition-colors"
            >
              Search Another
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

AgentPage.getLayout = (page) => page;
