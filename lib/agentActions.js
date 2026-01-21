// AI Agent Action Handlers - Smart actions the agent can perform
import { userAPI, adminAPI } from "./api";

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/**
 * Smart Agent that understands user intent and performs actions
 */
export class SmartAgent {
  constructor(isAdmin, user) {
    this.isAdmin = isAdmin;
    this.user = user;
    this.context = {
      lastSearch: null,
      lastVoter: null,
      pendingAction: null,
      conversationHistory: [],
    };
  }

  /**
   * Process user message and determine action
   */
  async processMessage(message) {
    const lowerMessage = message.toLowerCase().trim();

    // Add to conversation history
    this.context.conversationHistory.push({ role: "user", content: message });

    // Quick responses for common confirmations
    if (this.context.pendingAction) {
      return this.handlePendingAction(lowerMessage);
    }

    // Detect intent
    const intent = await this.detectIntent(message);

    return this.executeIntent(intent, message);
  }

  /**
   * Detect user intent using patterns and AI
   */
  async detectIntent(message) {
    const lowerMessage = message.toLowerCase();

    // Greeting patterns
    if (
      /^(hi|hello|hey|namaste|good\s*(morning|afternoon|evening))/.test(
        lowerMessage,
      )
    ) {
      return { type: "greeting" };
    }

    // Help patterns
    if (
      /^(help|what can you do|capabilities|commands|options)/.test(lowerMessage)
    ) {
      return { type: "help" };
    }

    // Search voter by name
    if (
      /search|find|look\s*for|show me/.test(lowerMessage) &&
      /voter|person|name/.test(lowerMessage)
    ) {
      const nameMatch = message.match(
        /(?:named?|for|called)\s+["']?([^"'\n]+)["']?/i,
      );
      return { type: "search_voter", name: nameMatch?.[1] || null };
    }

    // Search by voter ID / EPIC
    if (/voter\s*id|epic|card\s*number/i.test(lowerMessage)) {
      const idMatch = message.match(/[A-Z]{2,3}\d{6,10}/i);
      return { type: "search_voter_id", voterId: idMatch?.[0] || null };
    }

    // Print voter slip
    if (/print|generate\s*slip|voter\s*slip|slip\s*for/.test(lowerMessage)) {
      const idMatch = message.match(/[A-Z]{2,3}\d{6,10}/i);
      return { type: "print_slip", voterId: idMatch?.[0] || null };
    }

    // Statistics
    if (/how\s*many|count|total|statistics|stats/.test(lowerMessage)) {
      if (/voter/.test(lowerMessage)) return { type: "stats_voters" };
      if (/male|female|gender/.test(lowerMessage))
        return { type: "stats_gender" };
      if (/assembly|constituency/.test(lowerMessage))
        return { type: "stats_assembly" };
      return { type: "stats_general" };
    }

    // View voter details
    if (/detail|information|info|show\s*voter/.test(lowerMessage)) {
      const idMatch = message.match(/[A-Z]{2,3}\d{6,10}/i);
      return { type: "voter_details", voterId: idMatch?.[0] || null };
    }

    // List/show voters
    if (
      /list|show\s*all|display/.test(lowerMessage) &&
      /voter/.test(lowerMessage)
    ) {
      return { type: "list_voters" };
    }

    // Check presence
    if (/present|available|marked|here/.test(lowerMessage)) {
      return { type: "check_presence" };
    }

    // Admin actions
    if (this.isAdmin) {
      if (/update|modify|change|edit/.test(lowerMessage)) {
        return { type: "admin_modify", message };
      }
      if (/delete|remove/.test(lowerMessage)) {
        return { type: "admin_delete", message };
      }
      if (/session|upload/.test(lowerMessage)) {
        return { type: "admin_sessions" };
      }
    }

    // Default - use AI to understand
    return { type: "ai_query", message };
  }

  /**
   * Execute the detected intent
   */
  async executeIntent(intent, originalMessage) {
    switch (intent.type) {
      case "greeting":
        return this.handleGreeting();

      case "help":
        return this.handleHelp();

      case "search_voter":
        return this.handleSearchVoter(intent.name, originalMessage);

      case "search_voter_id":
        return this.handleSearchVoterId(intent.voterId, originalMessage);

      case "print_slip":
        return this.handlePrintSlip(intent.voterId);

      case "stats_voters":
      case "stats_gender":
      case "stats_assembly":
      case "stats_general":
        return this.handleStatistics(intent.type);

      case "voter_details":
        return this.handleVoterDetails(intent.voterId);

      case "list_voters":
        return this.handleListVoters();

      case "check_presence":
        return this.handleCheckPresence();

      case "admin_modify":
        return this.handleAdminModify(originalMessage);

      case "admin_delete":
        return this.handleAdminDelete(originalMessage);

      case "admin_sessions":
        return this.handleAdminSessions();

      case "ai_query":
        return this.handleAIQuery(originalMessage);

      default:
        return this.handleUnknown();
    }
  }

  /**
   * Handle pending confirmation actions
   */
  async handlePendingAction(response) {
    const isYes =
      /^(yes|y|ok|sure|confirm|proceed|go ahead|do it|haan|हाँ)/.test(response);
    const isNo = /^(no|n|cancel|stop|don't|nahi|नहीं)/.test(response);

    if (!isYes && !isNo) {
      return {
        type: "clarification",
        content:
          "I didn't quite catch that. Please say **Yes** to confirm or **No** to cancel.",
        showQuickReplies: ["Yes, proceed", "No, cancel"],
      };
    }

    const action = this.context.pendingAction;
    this.context.pendingAction = null;

    if (isNo) {
      return {
        type: "cancelled",
        content:
          "No problem! Action cancelled. Is there anything else I can help you with?",
        showQuickReplies: ["Search for a voter", "Show statistics", "Help"],
      };
    }

    // Execute the pending action
    try {
      switch (action.type) {
        case "print":
          return {
            type: "action",
            content: `Printing voter slip for **${action.voter.name}** (${action.voter.voter_id})...\n\nThe print dialog should open shortly.`,
            action: { type: "print", voterId: action.voter.id },
            showQuickReplies: ["Search another voter", "Show statistics"],
          };

        case "mark_printed":
          await userAPI.markAsPrinted(action.voter.id);
          return {
            type: "success",
            content: `✅ **Done!** Voter **${action.voter.name}** has been marked as printed.`,
            showQuickReplies: ["Search another voter", "How many are printed?"],
          };

        case "modify":
          return {
            type: "admin_action",
            content: `⚙️ Modification mode activated. Please provide the updated details for this voter.`,
          };

        default:
          return {
            type: "error",
            content: "Unknown action. Please try again.",
          };
      }
    } catch (error) {
      return { type: "error", content: `❌ Error: ${error.message}` };
    }
  }

  // Handler implementations
  handleGreeting() {
    const hour = new Date().getHours();
    let timeGreeting = "Hello";
    if (hour >= 5 && hour < 12) timeGreeting = "Good morning";
    else if (hour >= 12 && hour < 17) timeGreeting = "Good afternoon";
    else if (hour >= 17 && hour < 21) timeGreeting = "Good evening";
    else timeGreeting = "Hello";

    const greetings = [
      `${timeGreeting}, ${this.user?.name || "there"}! 👋`,
      `${timeGreeting}! 🙏 Great to see you, ${this.user?.name || "friend"}!`,
      `Namaste ${this.user?.name || ""}! 🙏 ${timeGreeting}!`,
    ];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];

    return {
      type: "greeting",
      content:
        `${greeting}\n\n` +
        `I'm your **AI Voter Assistant** – ready to help!\n\n` +
        `## Quick Actions\n\n` +
        `| What you can do | Example |\n` +
        `|-----------------|--------|\n` +
        `| 🔍 Search voters | "Find voter Ramesh Kumar" |\n` +
        `| 📊 View stats | "Show statistics" |\n` +
        `| 🖨️ Print slip | "Print slip for ABC123456" |\n` +
        `| 📋 Get details | "Voter details" |\n` +
        (this.isAdmin ? `| 👑 Admin mode | Full access enabled |\n` : "") +
        `\nWhat would you like to do?`,
      showQuickReplies: [
        "Search for a voter",
        "Show statistics",
        "Print a voter slip",
      ],
    };
  }

  handleHelp() {
    const adminHelp = this.isAdmin
      ? `
### 👑 Admin Commands
- "Show all sessions"
- "Upload new voter list"
- "Modify voter [ID]"
- "Show system statistics"
- "List all users"`
      : "";

    return {
      type: "help",
      content: `# 🤖 AI Assistant Help

## What I Can Do

### 🔍 Search & Find
- "Search for voter named **Ramesh Kumar**"
- "Find voter with ID **ABC1234567**"
- "Show voters from **Rajarhat**"
- "List voters in part number **5**"

### 📊 Statistics & Reports
- "How many voters are there?"
- "Show gender distribution"
- "Statistics by assembly"
- "Show age-wise breakdown"

### 🖨️ Printing
- "Print slip for voter **ABC1234567**"
- "Generate voter slip"
- "Print all pending slips"

### 📋 Voter Details
- "Show details of voter **ABC1234567**"
- "Get information for **Ramesh Kumar**"
${adminHelp}

---
💡 **Tip**: You can ask me in natural language - I understand context!`,
      showQuickReplies: [
        "Search for a voter",
        "Show statistics",
        "Print a slip",
      ],
    };
  }

  async handleSearchVoter(name, originalMessage) {
    if (!name) {
      return {
        type: "question",
        content:
          "Sure, I can help you search for a voter! 🔍\n\nPlease tell me the **name** of the voter you're looking for.",
        expectingInput: "voter_name",
      };
    }

    try {
      const result = await userAPI.searchVoters({ name, page: 1, limit: 10 });
      const voters = result.voters || result.data || [];

      if (voters.length === 0) {
        return {
          type: "no_results",
          content: `I couldn't find any voters matching "**${name}**". 😕\n\nWould you like to:\n- Try a different spelling?\n- Search by voter ID instead?`,
          showQuickReplies: ["Search by voter ID", "Try another name"],
        };
      }

      this.context.lastSearch = { name, voters };

      const voterCards = voters.slice(0, 5).map((v, i) => ({
        id: v.id,
        name: v.name,
        voterId: v.voter_id,
        age: v.age,
        gender: v.gender,
        assembly: v.assembly,
        partNumber: v.part_number,
      }));

      return {
        type: "search_results",
        content: `Found **${voters.length}** voter${voters.length > 1 ? "s" : ""} matching "**${name}**":`,
        voters: voterCards,
        totalCount: result.total || voters.length,
        showQuickReplies:
          voters.length > 0
            ? [
                `Show details of ${voters[0].name}`,
                "Print slip",
                "Search again",
              ]
            : ["Search again"],
      };
    } catch (error) {
      return { type: "error", content: `❌ Search failed: ${error.message}` };
    }
  }

  async handleSearchVoterId(voterId, originalMessage) {
    if (!voterId) {
      return {
        type: "question",
        content:
          "I can look up a voter by their EPIC/Voter ID! 🪪\n\nPlease provide the **Voter ID** (e.g., ABC1234567):",
        expectingInput: "voter_id",
      };
    }

    try {
      const result = await userAPI.searchVoters({
        voter_id: voterId.toUpperCase(),
      });
      const voters = result.voters || result.data || [];

      if (voters.length === 0) {
        return {
          type: "no_results",
          content: `No voter found with ID "**${voterId.toUpperCase()}**". 🔍\n\nPlease check the ID and try again.`,
          showQuickReplies: ["Search by name", "Try another ID"],
        };
      }

      const voter = voters[0];
      this.context.lastVoter = voter;

      return {
        type: "voter_found",
        content: `✅ **Voter Found!**`,
        voterDetail: {
          id: voter.id,
          name: voter.name,
          voterId: voter.voter_id,
          fatherName: voter.relation_name,
          age: voter.age,
          gender: voter.gender,
          assembly: voter.assembly,
          partNumber: voter.part_number,
          serialNumber: voter.serial_number,
          section: voter.section,
          isPrinted: voter.is_printed,
        },
        showQuickReplies: [
          "Print voter slip",
          "Search another voter",
          "Show statistics",
        ],
      };
    } catch (error) {
      return { type: "error", content: `❌ Search failed: ${error.message}` };
    }
  }

  async handlePrintSlip(voterId) {
    let voter = this.context.lastVoter;

    if (voterId) {
      try {
        const result = await userAPI.searchVoters({
          voter_id: voterId.toUpperCase(),
        });
        const voters = result.voters || result.data || [];
        if (voters.length > 0) voter = voters[0];
      } catch (e) {}
    }

    if (!voter) {
      return {
        type: "question",
        content:
          "I'd be happy to print a voter slip! 🖨️\n\nPlease provide the **Voter ID** of the person whose slip you want to print:",
        expectingInput: "voter_id_for_print",
      };
    }

    this.context.pendingAction = { type: "print", voter };

    return {
      type: "confirmation",
      content:
        `Ready to print voter slip for:\n\n` +
        `👤 **${voter.name}**\n` +
        `🪪 ${voter.voter_id}\n` +
        `📍 ${voter.assembly}\n\n` +
        `Would you like me to proceed with printing?`,
      showQuickReplies: ["Yes, print it", "No, cancel"],
    };
  }

  async handleStatistics(type) {
    try {
      // Try to get stats from API
      let stats = null;
      let genderStats = null;
      let assemblyStats = null;

      if (this.isAdmin) {
        try {
          stats = await adminAPI.getDashboardStats();
        } catch (e) {
          console.log("Stats fetch failed:", e);
        }

        if (type === "stats_gender") {
          try {
            genderStats = await adminAPI.getStats("gender");
          } catch (e) {}
        }

        if (type === "stats_assembly") {
          try {
            assemblyStats = await adminAPI.getStats("assembly");
          } catch (e) {}
        }
      }

      // Build formatted statistics response
      let content = `# 📊 Voter Statistics\n\n`;

      if (stats) {
        const totalVoters = stats.totalVoters || stats.voters || 0;
        const sessions = stats.sessions || stats.totalSessions || 0;
        const assemblies = stats.assemblies || 0;

        content += `| Metric | Count |\n`;
        content += `|--------|-------|\n`;
        content += `| 👥 **Total Voters** | **${totalVoters.toLocaleString()}** |\n`;
        content += `| 📁 **Sessions** | ${sessions} |\n`;
        content += `| 🏛️ **Assemblies** | ${assemblies} |\n\n`;
      }

      if (genderStats && type === "stats_gender") {
        content += `## 👫 Gender Distribution\n\n`;
        content += `| Gender | Count | Percentage |\n`;
        content += `|--------|-------|------------|\n`;

        const genders = Array.isArray(genderStats)
          ? genderStats
          : genderStats.data || [];
        genders.forEach((g) => {
          const pct = (
            (g.count / genders.reduce((a, b) => a + b.count, 0)) *
            100
          ).toFixed(1);
          content += `| ${g.gender === "M" ? "👨 Male" : g.gender === "F" ? "👩 Female" : "⚧ Other"} | ${g.count.toLocaleString()} | ${pct}% |\n`;
        });
      }

      if (assemblyStats && type === "stats_assembly") {
        content += `## 🏛️ Voters by Assembly\n\n`;
        content += `| Assembly | Voters |\n`;
        content += `|----------|--------|\n`;

        const assemblies = Array.isArray(assemblyStats)
          ? assemblyStats
          : assemblyStats.data || [];
        assemblies.slice(0, 10).forEach((a) => {
          content += `| ${a.assembly || a.name} | ${(a.count || a.voters || 0).toLocaleString()} |\n`;
        });
        if (assemblies.length > 10) {
          content += `\n*...and ${assemblies.length - 10} more assemblies*`;
        }
      }

      if (!stats && !genderStats && !assemblyStats) {
        content += `Currently gathering statistics...\n\n`;
        content += `Try searching for voters to see their details, or ask about:\n`;
        content += `- Gender distribution\n`;
        content += `- Voters by assembly\n`;
        content += `- Age-wise breakdown`;
      }

      return {
        type: "statistics",
        content,
        showQuickReplies: [
          "Show by assembly",
          "Gender breakdown",
          "Search for a voter",
        ],
      };
    } catch (error) {
      return {
        type: "error",
        content: `❌ Failed to load statistics: ${error.message}`,
      };
    }
  }

  async handleVoterDetails(voterId) {
    if (!voterId && !this.context.lastVoter) {
      return {
        type: "question",
        content:
          "I can show you detailed information about any voter! 📋\n\nPlease provide the **Voter ID**:",
        expectingInput: "voter_id",
      };
    }

    const voter = this.context.lastVoter;
    if (!voter) {
      return this.handleSearchVoterId(voterId, "");
    }

    return {
      type: "voter_detail",
      content:
        `# 📋 Voter Details\n\n` +
        `| Field | Value |\n` +
        `|-------|-------|\n` +
        `| **Name** | ${voter.name} |\n` +
        `| **Voter ID** | ${voter.voter_id} |\n` +
        `| **Father/Husband** | ${voter.relation_name || "—"} |\n` +
        `| **Age** | ${voter.age} years |\n` +
        `| **Gender** | ${voter.gender} |\n` +
        `| **Assembly** | ${voter.assembly} |\n` +
        `| **Part No.** | ${voter.part_number} |\n` +
        `| **Serial No.** | ${voter.serial_number} |\n` +
        `| **Section** | ${voter.section || "—"} |\n` +
        `| **Printed** | ${voter.is_printed ? "✅ Yes" : "❌ No"} |`,
      voter: voter,
      showQuickReplies: ["Print voter slip", "Search another voter"],
    };
  }

  async handleListVoters() {
    return {
      type: "info",
      content:
        `To list voters, please specify a search criteria:\n\n` +
        `- "Show voters from **assembly name**"\n` +
        `- "List voters in part **number**"\n` +
        `- "Find voters with name **partial name**"`,
      showQuickReplies: [
        "Search by name",
        "Search by assembly",
        "Show statistics",
      ],
    };
  }

  handleCheckPresence() {
    return {
      type: "info",
      content:
        `The presence/attendance feature helps track which voters have arrived at the polling booth.\n\n` +
        `To mark presence:\n` +
        `- "Mark voter **ID** as present"\n` +
        `- Search for a voter and mark them present\n\n` +
        `Would you like to search for a voter to mark their presence?`,
      showQuickReplies: ["Search for a voter", "Show attendance stats"],
    };
  }

  handleAdminModify(message) {
    if (!this.isAdmin) {
      return {
        type: "error",
        content: "⚠️ Sorry, only administrators can modify voter data.",
      };
    }

    return {
      type: "admin_confirm",
      content:
        `⚙️ **Admin Action Required**\n\n` +
        `You're about to modify voter data. This action will be logged.\n\n` +
        `Please confirm you want to proceed with modifications.`,
      showQuickReplies: ["Yes, proceed", "No, cancel"],
    };
  }

  handleAdminDelete(message) {
    if (!this.isAdmin) {
      return {
        type: "error",
        content: "⚠️ Sorry, only administrators can delete data.",
      };
    }

    return {
      type: "admin_warning",
      content:
        `🚨 **Warning: Delete Operation**\n\n` +
        `Deletion is a permanent action and cannot be undone.\n\n` +
        `Are you absolutely sure you want to proceed?`,
      showQuickReplies: ["Yes, I'm sure", "No, cancel"],
    };
  }

  handleAdminSessions() {
    return {
      type: "redirect",
      content:
        `📁 **Session Management**\n\n` +
        `I can help you manage upload sessions. What would you like to do?\n\n` +
        `- View all sessions\n` +
        `- Upload new voter list\n` +
        `- Delete a session`,
      showQuickReplies: [
        "View all sessions",
        "Upload new list",
        "Go to sessions page",
      ],
      action: { type: "navigate", path: "/sessions" },
    };
  }

  async handleAIQuery(message) {
    // Use Gemini to understand and respond
    if (!GEMINI_API_KEY) {
      return {
        type: "fallback",
        content:
          `I understand you're asking about: "${message}"\n\n` +
          `I can help you with:\n` +
          `- Searching for voters\n` +
          `- Viewing statistics\n` +
          `- Printing voter slips\n\n` +
          `Could you please rephrase your request?`,
        showQuickReplies: ["Search for a voter", "Show statistics", "Help"],
      };
    }

    try {
      const prompt = `You are a helpful assistant for a Voter List Console application in India. 
The user said: "${message}"

Context:
- User role: ${this.isAdmin ? "Admin" : "User"}
- User name: ${this.user?.name || "Unknown"}
- This is a voter management system for election purposes

Respond helpfully and professionally. If the user is asking about voters, suggest they search by name or ID. 
If asking about statistics, offer to show available stats.
Keep response concise (under 100 words). Use markdown formatting.`;

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
        }),
      });

      if (!response.ok) throw new Error("AI service unavailable");

      const data = await response.json();
      const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      return {
        type: "ai_response",
        content: aiResponse,
        showQuickReplies: ["Search for a voter", "Show statistics", "Help"],
      };
    } catch (error) {
      return {
        type: "fallback",
        content:
          `I'm here to help! Here are some things you can ask me:\n\n` +
          `🔍 "Search for voter named [name]"\n` +
          `📊 "Show me statistics"\n` +
          `🖨️ "Print voter slip for [ID]"`,
        showQuickReplies: ["Search for a voter", "Show statistics", "Help"],
      };
    }
  }

  handleUnknown() {
    return {
      type: "unknown",
      content:
        `I'm not sure I understood that. 🤔\n\n` +
        `Try asking me to:\n` +
        `- **Search** for a voter by name or ID\n` +
        `- **Show statistics** about voters\n` +
        `- **Print** a voter slip\n` +
        `- **Help** for all available commands`,
      showQuickReplies: ["Search for a voter", "Show statistics", "Help"],
    };
  }
}

export default SmartAgent;
