import { useState } from "react";

export default function HelpBanner({ className = "" }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className={`help-banner card bg-gradient-to-r from-purple-500/10 to-neon-500/10 border-purple-400/30 ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💡</span>
          <div className="text-center sm:text-left">
            <h4 className="text-sm font-semibold text-purple-200">
              Need Help?
            </h4>
            <p className="text-xs text-slate-400">
              Contact us for any website functionality related queries
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="mailto:acodernamedsubhro@gmail.com"
            className="btn btn-secondary text-xs py-2 px-3"
          >
            <span className="mr-1">✉️</span>
            <span className="hidden sm:inline">
              acodernamedsubhro@gmail.com
            </span>
            <span className="sm:hidden">Email Us</span>
          </a>
          <button
            onClick={() => setDismissed(true)}
            className="p-2 text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-ink-200/50"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// Quick Actions Component for user convenience
export function QuickActions({ actions = [] }) {
  if (!actions.length) return null;

  return (
    <div className="quick-actions-grid">
      {actions.map((action, idx) => (
        <a
          key={idx}
          href={action.href}
          className="quick-action-card"
          onClick={action.onClick}
        >
          <span className="quick-action-icon">{action.icon}</span>
          <span className="quick-action-label">{action.label}</span>
          {action.badge && (
            <span className="quick-action-badge">{action.badge}</span>
          )}
        </a>
      ))}
    </div>
  );
}

// Contact Support Button (floating or inline)
export function ContactSupportButton({ floating = false }) {
  if (floating) {
    return (
      <a
        href="mailto:acodernamedsubhro@gmail.com"
        className="fixed bottom-36 right-4 z-30 w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-lg shadow-purple-500/30 flex items-center justify-center text-xl hover:scale-110 transition-transform"
        title="Contact Support"
      >
        📧
      </a>
    );
  }

  return (
    <a
      href="mailto:acodernamedsubhro@gmail.com"
      className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-neon-200 transition-colors"
    >
      <span>📧</span>
      <span>Need help? Contact us</span>
    </a>
  );
}

// Empty State Component
export function EmptyState({
  icon = "📭",
  title = "No Data",
  description = "There's nothing here yet.",
  action = null,
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// Loading Skeleton for Voter Cards
export function VoterCardSkeleton() {
  return (
    <div className="voter-card-mobile animate-pulse">
      <div className="voter-card-mobile-header">
        <div className="w-12 h-12 rounded-full bg-ink-300/50"></div>
        <div className="voter-card-mobile-info flex-1">
          <div className="h-4 w-3/4 bg-ink-300/50 rounded mb-2"></div>
          <div className="h-3 w-1/2 bg-ink-300/50 rounded"></div>
        </div>
        <div className="w-12 h-12 bg-ink-300/50 rounded-lg"></div>
      </div>
      <div className="voter-card-mobile-details">
        <div className="h-3 w-full bg-ink-300/50 rounded"></div>
        <div className="h-3 w-full bg-ink-300/50 rounded"></div>
      </div>
    </div>
  );
}

// Confirmation Dialog
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm",
  message = "Are you sure?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger", // danger, warning, info
}) {
  if (!isOpen) return null;

  const variants = {
    danger: "bg-rose-600 hover:bg-rose-500",
    warning: "bg-amber-600 hover:bg-amber-500",
    info: "bg-blue-600 hover:bg-blue-500",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="card max-w-md w-full">
        <h3 className="text-lg font-semibold text-slate-100 mb-2">{title}</h3>
        <p className="text-sm text-slate-300 mb-4">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn btn-secondary text-sm">
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`btn text-sm text-white ${variants[variant]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
