import { useMemo } from "react";
import { useRouter } from "next/router";

const PAGE_OVERVIEW_CONFIG = {
  "/": {
    title: "Election Data Service Portal",
    summary:
      "Access voter search, election records, affidavit processing, and analytics from one secure portal.",
    image: "/page-overviews/home-overview.png",
  },
  "/admin/dashboard": {
    title: "Administrative Dashboard",
    summary:
      "Monitor operational metrics, review recent voter lists, and manage election data workflows in real time.",
    image: "/page-overviews/admin/dashboard-overview.png",
  },
  "/search": {
    title: "Voter Search Workspace",
    summary:
      "Find voter records by name, ID, assembly, and other filters with high-speed query tools.",
    image: "/page-overviews/search-overview.png",
  },
  "/upload": {
    title: "Document Upload Center",
    summary:
      "Upload electoral documents for processing, extraction, and secure storage in approved formats.",
    image: "/page-overviews/upload-overview.png",
  },
  "/sessions": {
    title: "Voter List Management",
    summary:
      "Track processing voter lists, inspect extracted records, and verify output quality for each batch.",
    image: "/page-overviews/sessions/index-overview.png",
  },
  "/profile": {
    title: "User Profile",
    summary:
      "Review account details, role assignment, and personal access information.",
    image: "/page-overviews/profile-overview.png",
  },
  "/agent": {
    title: "AI Assistant Workspace",
    summary:
      "Use guided AI assistance for record analysis, quick insights, and workflow support.",
    image: "/page-overviews/agent-overview.png",
  },
  "/admin/users": {
    title: "User Administration",
    summary:
      "Manage user accounts, permissions, and role-based access control securely.",
    image: "/page-overviews/admin/users-overview.png",
  },
  "/admin/api-keys": {
    title: "API Key Control Panel",
    summary:
      "Supervise API key lifecycle, availability status, and integration readiness.",
    image: "/page-overviews/admin/api-keys-overview.png",
  },
  "/admin/stats": {
    title: "Election Analytics",
    summary:
      "Inspect constituency metrics, demographic summaries, and trend dashboards.",
    image: "/page-overviews/admin/stats-overview.png",
  },
  "/admin/map": {
    title: "Constituency Map Console",
    summary:
      "Visualize electoral geography, constituency boundaries, and map-linked insights.",
    image: "/page-overviews/admin/map-overview.png",
  },
  "/admin/election-results": {
    title: "Election Results Management",
    summary:
      "Access result records, process uploaded forms, and review booth-level outcomes.",
    image: "/page-overviews/admin/election-results/index-overview.png",
  },
  "/affidavits": {
    title: "Affidavit Processing",
    summary:
      "Create, review, and maintain affidavit records with structured data capture.",
    image: "/page-overviews/affidavits/index-overview.png",
  },
  "/nominations": {
    title: "Nomination Management",
    summary:
      "Prepare and validate nomination entries for election documentation workflows.",
    image: "/page-overviews/nominations/index-overview.png",
  },
  "/login": {
    title: "Secure Sign-In",
    summary:
      "Authenticate with protected credentials to access election management services.",
    image: "/page-overviews/login-overview.png",
  },
  "/register": {
    title: "Account Registration",
    summary:
      "Create a secure account to access authorized election data operations.",
    image: "/page-overviews/register-overview.png",
  },
  "/unauthorized": {
    title: "Access Restricted",
    summary:
      "This section requires additional permission based on your assigned role.",
    image: "/page-overviews/unauthorized-overview.png",
  },
};

function getOverviewByPath(pathname) {
  if (PAGE_OVERVIEW_CONFIG[pathname]) {
    return PAGE_OVERVIEW_CONFIG[pathname];
  }

  if (pathname.startsWith("/sessions/")) {
    return {
      title: "Voter List Detail Review",
      summary:
        "Inspect extracted voter records, quality checks, and processing history for the selected voter list.",
      image: "/page-overviews/sessions/detail-overview.png",
    };
  }

  if (pathname.startsWith("/voter/")) {
    return {
      title: "Voter Detail View",
      summary:
        "Review voter-level data, generated slip output, and linked metadata.",
      image: "/page-overviews/voter/detail-overview.png",
    };
  }

  if (pathname.startsWith("/affidavits/manual-entry")) {
    return {
      title: "Affidavit Manual Entry",
      summary:
        "Capture affidavit information manually in a structured format for reliable storage.",
      image: "/page-overviews/affidavits/manual-entry-overview.png",
    };
  }

  if (pathname.startsWith("/affidavits/")) {
    return {
      title: "Affidavit Detail",
      summary:
        "View, verify, and edit affidavit record details for the selected file.",
      image: "/page-overviews/affidavits/detail-overview.png",
    };
  }

  if (pathname.startsWith("/nominations/manual-entry")) {
    return {
      title: "Nomination Manual Entry",
      summary:
        "Enter nomination details accurately for downstream verification and reporting.",
      image: "/page-overviews/nominations/manual-entry-overview.png",
    };
  }

  if (pathname.startsWith("/nominations/")) {
    return {
      title: "Nomination Workspace",
      summary: "Access nomination data entry and record management tools.",
      image: "/page-overviews/nominations/index-overview.png",
    };
  }

  if (pathname.startsWith("/admin/election-results/upload")) {
    return {
      title: "Election Result Upload",
      summary:
        "Upload Form 20 result files for automated parsing and consolidation.",
      image: "/page-overviews/admin/election-results/upload-overview.png",
    };
  }

  if (pathname.startsWith("/admin/election-results/stats/")) {
    return {
      title: "Election Result Analytics",
      summary:
        "Analyze result-specific trends and seat-level performance indicators.",
      image: "/page-overviews/admin/election-results/stats-detail-overview.png",
    };
  }

  if (pathname.startsWith("/admin/election-results/")) {
    return {
      title: "Election Result Detail",
      summary:
        "Inspect uploaded result sheets, parsed values, and validation summaries.",
      image: "/page-overviews/admin/election-results/detail-overview.png",
    };
  }

  return {
    title: "Election Service Overview",
    summary:
      "Use this page to complete election-related tasks with secure and structured workflows.",
    image: "/page-overviews/default-overview.png",
  };
}

export default function PageOverviewBanner() {
  const router = useRouter();

  const overview = useMemo(
    () => getOverviewByPath(router.pathname || "/"),
    [router.pathname],
  );

  return (
    <section className="overview-banner" aria-label="Page overview banner">
      <img
        src={overview.image}
        alt={`${overview.title} overview`}
        className="overview-banner-image"
      />
      <div className="overview-banner-overlay" />
      <div className="overview-banner-content">
        <p className="overview-banner-kicker">Election Commission Service</p>
        <h1 className="overview-banner-title">{overview.title}</h1>
        <p className="overview-banner-summary">{overview.summary}</p>
      </div>
    </section>
  );
}
