import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Link from "next/link";
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
      <div className="fixed inset-0 bg-ink-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full"></div>
          <p className="text-slate-400">Loading AI Assistant...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>AI Assistant | Voter List Console</title>
      </Head>
      <SmartAgentInterface isAdmin={isAdmin} user={user} />
    </>
  );
}

function SmartAgentInterface({ isAdmin, user }) {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Initialize the smart agent
  const agent = useMemo(() => new SmartAgent(isAdmin, user), [isAdmin, user]);

  // Add welcome message on mount
  useEffect(() => {
    const welcomeMessage = {
      role: "assistant",
      content: `# 👋 Welcome, ${user?.name || "there"}!

I'm your **AI-powered Voter Assistant** – here to make your work easier and faster.

## What I can do for you:

| 🔍 **Search** | 📊 **Analyze** | 🖨️ **Print** |
|---------------|----------------|---------------|
| Find any voter by name, ID, or location | View statistics and reports | Generate voter slips instantly |

${isAdmin ? "\n👑 **Admin Mode Active** – You have full access to all features including data modification." : ""}

---
**Try saying:** "Search for voters named Ramesh" or just type **help** for more options!`,
      type: "welcome",
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  }, [user, isAdmin]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(
    async (text) => {
      if (!text.trim() || loading) return;

      const userMessage = {
        role: "user",
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setLoading(true);
      setIsTyping(true);

      try {
        // Simulate typing delay for natural feel
        await new Promise((r) => setTimeout(r, 500));

        const response = await agent.processMessage(text);

        setIsTyping(false);

        const assistantMessage = {
          role: "assistant",
          content: response.content,
          type: response.type,
          data: response,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Handle special actions
        if (response.action) {
          handleAction(response.action);
        }
      } catch (error) {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `❌ **Error:** ${error.message}\n\nPlease try again or type **help** for assistance.`,
            type: "error",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [loading, agent],
  );

  const handleAction = (action) => {
    switch (action.type) {
      case "print":
        router.push(`/voter/${action.voterId}`);
        break;
      case "navigate":
        router.push(action.path);
        break;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickReply = (reply) => {
    sendMessage(reply);
  };

  const clearChat = () => {
    setMessages([
      {
        role: "assistant",
        content: `Chat cleared! 🧹 How can I help you?`,
        type: "info",
        timestamp: new Date(),
      },
    ]);
  };

  const handleBack = () => {
    router.push(isAdmin ? "/admin/dashboard" : "/search");
  };

  const showWelcome = messages.length <= 1;

  // Quick action buttons for empty state
  const quickActions = isAdmin
    ? [
        { icon: "🔍", label: "Search Voters", action: "Search for a voter" },
        { icon: "📊", label: "View Statistics", action: "Show me statistics" },
        {
          icon: "🖨️",
          label: "Print Slip",
          action: "I want to print a voter slip",
        },
        { icon: "📁", label: "Manage Sessions", action: "Show all sessions" },
        {
          icon: "👥",
          label: "Gender Stats",
          action: "Show gender distribution",
        },
        { icon: "🗺️", label: "By Assembly", action: "Show voters by assembly" },
      ]
    : [
        { icon: "🔍", label: "Search Voters", action: "Search for a voter" },
        { icon: "🪪", label: "Find by ID", action: "Search by voter ID" },
        {
          icon: "🖨️",
          label: "Print Slip",
          action: "I want to print a voter slip",
        },
        { icon: "❓", label: "Get Help", action: "What can you do?" },
      ];

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-[#0a0e1a] via-[#0f1528] to-[#151d35]">
      {/* Header */}
      <header className="flex-shrink-0 h-16 border-b border-white/5 bg-black/20 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2.5 hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-white group"
          >
            <svg
              className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform"
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
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-700 flex items-center justify-center text-xl shadow-lg shadow-purple-500/25">
                🤖
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0f1528] animate-pulse"></span>
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">
                AI Voter Assistant
              </h1>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-emerald-400">●</span>
                <span className="text-slate-400">
                  Gemini 2.0 Flash • {isAdmin ? "Admin" : "User"} Mode
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`hidden sm:inline-flex px-3 py-1 rounded-lg text-xs font-medium ${
              isAdmin
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
            }`}
          >
            {isAdmin ? "👑 Admin Access" : "👤 User Access"}
          </span>
          {messages.length > 1 && (
            <button
              onClick={clearChat}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="hidden sm:inline">New Chat</span>
            </button>
          )}
        </div>
      </header>

      {/* Chat Area */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
        {showWelcome ? (
          <WelcomeScreen
            user={user}
            isAdmin={isAdmin}
            quickActions={quickActions}
            onActionClick={handleQuickReply}
            messages={messages}
          />
        ) : (
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                message={msg}
                isAdmin={isAdmin}
                onQuickReply={handleQuickReply}
              />
            ))}

            {isTyping && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-white/5 bg-black/30 backdrop-blur-xl p-4 md:p-6">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="relative group">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything about voters..."
              disabled={loading}
              className="w-full px-5 py-4 pr-14 bg-white/[0.05] border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 focus:outline-none focus:bg-white/[0.07] disabled:opacity-50 transition-all text-sm"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white rounded-xl transition-all flex items-center justify-center shadow-lg shadow-purple-500/20 disabled:shadow-none"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
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
                    d="M5 12h14M12 5l7 7-7 7"
                  />
                </svg>
              )}
            </button>
          </div>
          <div className="flex items-center justify-center gap-4 mt-3">
            <p className="text-xs text-slate-600">
              Powered by Gemini AI • Press Enter to send
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

function WelcomeScreen({
  user,
  isAdmin,
  quickActions,
  onActionClick,
  messages,
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-4 py-8">
      {/* Hero Section */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-700 flex items-center justify-center text-5xl shadow-2xl shadow-purple-500/30">
          🤖
        </div>
        <div className="absolute -inset-4 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-[2rem] blur-2xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-400 rounded-full border-4 border-[#0f1528] flex items-center justify-center">
          <span className="text-xs">✓</span>
        </div>
      </div>

      <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 text-center">
        Your Smart Voter Assistant
      </h2>
      <p className="text-slate-400 text-center max-w-lg mb-2 text-base md:text-lg">
        {isAdmin
          ? "Full database access with admin privileges. Ask anything!"
          : "Search, find, and manage voter information with ease."}
      </p>

      {/* Show welcome message content */}
      {messages.length > 0 && messages[0].content && (
        <div className="max-w-2xl w-full mt-6 p-6 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="text-xl font-bold text-white mb-4">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-lg font-semibold text-purple-300 mb-3 mt-4">
                    {children}
                  </h2>
                ),
                p: ({ children }) => (
                  <p className="text-slate-300 text-sm mb-2">{children}</p>
                ),
                strong: ({ children }) => (
                  <strong className="text-white font-semibold">
                    {children}
                  </strong>
                ),
                table: ({ children }) => (
                  <table className="w-full text-sm my-4">{children}</table>
                ),
                th: ({ children }) => (
                  <th className="px-3 py-2 bg-white/5 text-left text-purple-300 font-medium rounded-t-lg">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-2 text-slate-300 border-t border-white/5">
                    {children}
                  </td>
                ),
                hr: () => <hr className="border-white/10 my-4" />,
              }}
            >
              {messages[0].content}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-w-3xl w-full mt-8 px-4">
        {quickActions.map((action, i) => (
          <button
            key={i}
            onClick={() => onActionClick(action.action)}
            className="group p-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-purple-500/40 rounded-xl text-center transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/5 hover:-translate-y-0.5"
          >
            <span className="text-2xl mb-2 block group-hover:scale-110 transition-transform">
              {action.icon}
            </span>
            <span className="text-xs text-slate-300 group-hover:text-white transition-colors">
              {action.label}
            </span>
          </button>
        ))}
      </div>

      {/* Tips */}
      <div className="mt-10 max-w-xl text-center">
        <p className="text-xs text-slate-500">
          💡 <strong className="text-slate-400">Pro tip:</strong> You can ask in
          natural language like "Find me all female voters from Rajarhat"
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message, isAdmin, onQuickReply }) {
  const { role, content, type, data, timestamp } = message;
  const isUser = role === "user";
  const isError = type === "error";

  return (
    <div
      className={`flex gap-4 ${isUser ? "flex-row-reverse" : ""} animate-fadeIn`}
    >
      {/* Avatar */}
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 shadow-lg mt-1 ${
          isUser
            ? "bg-gradient-to-br from-slate-600 to-slate-700"
            : isError
              ? "bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/20"
              : "bg-gradient-to-br from-purple-500 to-indigo-600 shadow-purple-500/20"
        }`}
      >
        {isUser ? "👤" : isError ? "⚠️" : "🤖"}
      </div>

      {/* Message Content */}
      <div className={`flex-1 min-w-0 ${isUser ? "flex justify-end" : ""}`}>
        <div
          className={`inline-block max-w-full ${
            isUser
              ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white px-5 py-3 rounded-2xl rounded-tr-md shadow-lg shadow-purple-500/10"
              : ""
          }`}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed">{content}</p>
          ) : (
            <div className="space-y-4">
              {/* Markdown Content */}
              <div
                className={`prose prose-sm prose-invert max-w-none ${isError ? "text-red-300" : ""}`}
              >
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-lg font-semibold text-purple-300 mb-2 mt-4">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-base font-medium text-slate-200 mb-2 mt-3">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p
                        className={`text-sm leading-relaxed mb-2 last:mb-0 ${isError ? "text-red-300" : "text-slate-200"}`}
                      >
                        {children}
                      </p>
                    ),
                    strong: ({ children }) => (
                      <strong className="text-white font-semibold">
                        {children}
                      </strong>
                    ),
                    em: ({ children }) => (
                      <em className="text-purple-300 not-italic">{children}</em>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside space-y-1 text-slate-300 text-sm my-2">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside space-y-1 text-slate-300 text-sm my-2">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-slate-300">{children}</li>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-4 rounded-xl border border-white/10">
                        <table className="min-w-full text-sm">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-white/5">{children}</thead>
                    ),
                    th: ({ children }) => (
                      <th className="px-4 py-2 text-left text-purple-300 font-medium whitespace-nowrap">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="px-4 py-2 text-slate-300 border-t border-white/5">
                        {children}
                      </td>
                    ),
                    hr: () => <hr className="border-white/10 my-4" />,
                    code: ({ inline, children }) =>
                      inline ? (
                        <code className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs font-mono">
                          {children}
                        </code>
                      ) : (
                        <pre className="p-4 bg-black/30 rounded-xl overflow-x-auto my-3 border border-white/5">
                          <code className="text-xs text-slate-200 font-mono">
                            {children}
                          </code>
                        </pre>
                      ),
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>

              {/* Voter Cards */}
              {data?.voters && data.voters.length > 0 && (
                <VoterCardList
                  voters={data.voters}
                  onQuickReply={onQuickReply}
                />
              )}

              {/* Single Voter Detail */}
              {data?.voterDetail && (
                <VoterDetailCard
                  voter={data.voterDetail}
                  onQuickReply={onQuickReply}
                />
              )}

              {/* Quick Replies */}
              {data?.showQuickReplies && data.showQuickReplies.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {data.showQuickReplies.map((reply, i) => (
                    <button
                      key={i}
                      onClick={() => onQuickReply(reply)}
                      className="px-3 py-1.5 text-xs bg-white/5 hover:bg-purple-500/20 text-slate-300 hover:text-purple-300 border border-white/10 hover:border-purple-500/30 rounded-lg transition-all"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div
          className={`text-[10px] text-slate-600 mt-1 ${isUser ? "text-right" : ""}`}
        >
          {timestamp?.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}

function VoterCardList({ voters, onQuickReply }) {
  return (
    <div className="space-y-2">
      {voters.map((voter, i) => (
        <div
          key={i}
          className="p-4 bg-white/[0.03] border border-white/10 rounded-xl hover:bg-white/[0.05] transition-all cursor-pointer group"
          onClick={() => onQuickReply(`Show details of voter ${voter.voterId}`)}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center">
              <span className="text-lg">👤</span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-white truncate group-hover:text-purple-300 transition-colors">
                {voter.name}
              </h4>
              <div className="flex flex-wrap gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                  {voter.voterId}
                </span>
                <span className="text-xs text-slate-400">
                  {voter.age} yrs • {voter.gender}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 truncate">
                📍 {voter.assembly} • Part {voter.partNumber}
              </p>
            </div>
            <div className="text-slate-500 group-hover:text-purple-400 transition-colors">
              →
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function VoterDetailCard({ voter, onQuickReply }) {
  return (
    <div className="p-5 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-xl">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/30 to-indigo-500/30 border-2 border-purple-500/50 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl">👤</span>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">{voter.name}</h3>
          <p className="text-purple-300 font-mono text-sm">{voter.voterId}</p>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-sm">
            <div>
              <span className="text-slate-500">Father/Husband:</span>
              <span className="text-slate-300 ml-2">
                {voter.fatherName || "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Age:</span>
              <span className="text-slate-300 ml-2">{voter.age} years</span>
            </div>
            <div>
              <span className="text-slate-500">Gender:</span>
              <span className="text-slate-300 ml-2 capitalize">
                {voter.gender}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Part No:</span>
              <span className="text-slate-300 ml-2">{voter.partNumber}</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-500">Assembly:</span>
              <span className="text-slate-300 ml-2">{voter.assembly}</span>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => onQuickReply("Print voter slip")}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              🖨️ Print Slip
            </button>
            <button
              onClick={() => onQuickReply("Search another voter")}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-sm transition-colors"
            >
              Search Another
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-4">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-lg flex-shrink-0 shadow-lg shadow-purple-500/20">
        🤖
      </div>
      <div className="flex items-center gap-2 pt-3">
        <div className="flex gap-1">
          <span
            className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
            style={{ animationDelay: "0ms" }}
          ></span>
          <span
            className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          ></span>
          <span
            className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          ></span>
        </div>
        <span className="text-xs text-slate-500 ml-2">AI is thinking...</span>
      </div>
    </div>
  );
}

// Override layout for this page
AgentPage.getLayout = (page) => page;
