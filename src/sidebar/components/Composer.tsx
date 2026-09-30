// Implements: ADR 0031 (the messenger composer), ADR 0032 (live composer)
//
// A pill field that grows to about six lines, with one round action at its
// baseline: send, or stop while a turn streams. Enter sends and Shift+Enter
// breaks the line. It stays enabled while a turn streams (disabling it dropped
// focus every turn); Enter mid-stream is simply ignored upstream.
import type { RefObject } from "react";

export default function Composer({
  value,
  onChange,
  onSend,
  onStop,
  loading,
  disabled,
  placeholder,
  textareaRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  loading: boolean;
  disabled: boolean;
  placeholder: string;
  textareaRef: RefObject<HTMLTextAreaElement>;
}) {
  return (
    <div className="shrink-0 border-t border-line bg-paper px-3 pb-3 pt-2">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault(); // even mid-stream, or Enter types newlines into the next draft
              onSend();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Message the advisor"
          className="focus-ring max-h-36 flex-1 resize-none rounded-[18px] border border-line-2 bg-raised px-3.5 py-[7px] text-sm leading-relaxed text-ink [field-sizing:content] placeholder:text-ink-4 disabled:opacity-50"
        />
        {loading ? (
          <button
            onClick={onStop}
            aria-label="Stop generating"
            className="focus-ring inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-ink text-paper transition-[background-color,transform] duration-200 ease-spring hover:bg-ink-2 active:scale-90"
          >
            <span aria-hidden className="block h-2.5 w-2.5 rounded-[2px] bg-current" />
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={disabled || !value.trim()}
            aria-label="Send message"
            className="focus-ring inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-fordham-maroon text-white transition-[background-color,opacity,transform] duration-200 ease-spring hover:bg-fordham-maroon/90 active:scale-90 disabled:bg-ink-4 disabled:opacity-40"
          >
            <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 12.5V3.5M8 3.5L3.75 7.75M8 3.5l4.25 4.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
