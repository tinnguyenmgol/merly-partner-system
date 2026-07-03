"use client";

export function CopyButton({ value }: { value: string }) {
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={() => navigator.clipboard.writeText(value)}
    >
      Copy
    </button>
  );
}
