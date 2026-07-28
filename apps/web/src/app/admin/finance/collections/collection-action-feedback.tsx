import { AlertCircle, CheckCircle2 } from "lucide-react";

export function CollectionActionFeedback({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  if (!error && !success) {
    return null;
  }

  if (error) {
    return (
      <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{error}</span>
      </p>
    );
  }

  return (
    <p className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{success}</span>
    </p>
  );
}
