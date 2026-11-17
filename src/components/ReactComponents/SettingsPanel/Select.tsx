import "../../../css/UpstreamSettings.css";
import React, {useEffect,useLayoutEffect,useId,useState,useRef} from "react";
import {useStore} from "@nanostores/react";
import {$uiLanguage} from "../../../utils/stores.ts";
import {translateUi} from "../../../utils/i18n/translate.ts";
// Keys the settings controls handle themselves. Spotify's own shortcuts listen on the document
// (Space plays/pauses, Escape leaves Cinema View), so a handled key goes no further.
function consume(event: React.KeyboardEvent) {
  event.preventDefault();
  event.stopPropagation();
}

const isPrintable = (event: React.KeyboardEvent) =>
  event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

// Room kept between the list and the window edge, and between the list and its button.
const LISTBOX_EDGE = 8;
const LISTBOX_GAP = 6;

/**
 * A select-only combobox. The list is a top-layer popover, so the pane and modal can't clip it;
 * focus stays on the button and follows the list through aria-activedescendant. */
export function Select({
  value,
  options,
  labels,
  onChange,
  disabled,
  label,
}: {
  value: string;
  options: string[];
  labels?: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const listId = `sl-sp-listbox-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const optionId = (i: number) => `${listId}-${i}`;
  const language = useStore($uiLanguage);
  const labelOf = (i: number) => translateUi(labels?.[i] ?? options[i], language);
  const selected = Math.max(0, options.indexOf(value));

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selected);
  // Opened from the keyboard: the list appears at once instead of scaling in.
  const [instant, setInstant] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", at: 0 });

  const show = (fromKeyboard: boolean, at = selected) => {
    setInstant(fromKeyboard);
    setActive(at);
    setOpen(true);
  };
  const commit = (i: number) => {
    typeahead.current.at = 0;
    setOpen(false);
    if (options[i] !== undefined && options[i] !== value) onChange(options[i]);
  };

  // Typing jumps to the next option starting with what was typed. Repeating one letter cycles.
  const findTyped = (char: string, from: number): number | undefined => {
    const now = Date.now();
    const state = typeahead.current;
    state.text = now - state.at > 500 ? char : state.text + char;
    state.at = now;
    const text = state.text.toLowerCase();
    const cycling = [...text].every((c) => c === text[0]);
    const needle = cycling ? text[0] : text;
    for (let step = cycling ? 1 : 0; step < options.length + (cycling ? 1 : 0); step++) {
      const i = (from + step) % options.length;
      if (labelOf(i).toLowerCase().startsWith(needle)) return i;
    }
    return undefined;
  };

  const place = () => {
    const trigger = triggerRef.current;
    const list = listRef.current;
    if (!trigger || !list) return;
    const view = trigger.ownerDocument.defaultView ?? window;
    const box = trigger.getBoundingClientRect();
    list.style.minWidth = `${box.width}px`;
    const { offsetWidth: width, offsetHeight: height } = list;
    const roomBelow = view.innerHeight - box.bottom - LISTBOX_GAP - LISTBOX_EDGE;
    const roomAbove = box.top - LISTBOX_GAP - LISTBOX_EDGE;
    const above = height > roomBelow && roomAbove > roomBelow;
    list.dataset.placement = above ? "above" : "below";
    list.style.maxHeight = `${Math.max(120, above ? roomAbove : roomBelow)}px`;
    // Trailing edges line up: the button sits at the end of its row.
    const left = Math.min(Math.max(LISTBOX_EDGE, box.right - width), view.innerWidth - width - LISTBOX_EDGE);
    list.style.left = `${left}px`;
    list.style.top = above
      ? `${box.top - LISTBOX_GAP - Math.min(height, roomAbove)}px`
      : `${box.bottom + LISTBOX_GAP}px`;
  };

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (open) {
      if (!list.matches(":popover-open")) list.showPopover();
      place();
    } else if (list.matches(":popover-open")) {
      list.hidePopover();
    }
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (open) listRef.current?.querySelector(`#${optionId(active)}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  // Closes without a change, as a native select does, on an outside press, a scroll that moves
  // the button (not the lyrics scrolling behind the panel), a resize or the window losing focus.
  useEffect(() => {
    const trigger = triggerRef.current;
    if (!open || !trigger) return;
    const doc = trigger.ownerDocument;
    const view = doc.defaultView ?? window;
    const close = () => setOpen(false);
    const onPress = (event: Event) => {
      const target = event.target as Node;
      if (!trigger.contains(target) && !listRef.current?.contains(target)) close();
    };
    const onScroll = (event: Event) => {
      if ((event.target as Node).contains?.(trigger)) close();
    };
    // The settings panel closes on Escape from a capturing listener on the document, which
    // would run before the button's own. The window's capture phase comes first.
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    };
    view.addEventListener("keydown", onEscape, true);
    doc.addEventListener("pointerdown", onPress, true);
    doc.addEventListener("scroll", onScroll, true);
    view.addEventListener("resize", close);
    view.addEventListener("blur", close);
    return () => {
      view.removeEventListener("keydown", onEscape, true);
      doc.removeEventListener("pointerdown", onPress, true);
      doc.removeEventListener("scroll", onScroll, true);
      view.removeEventListener("resize", close);
      view.removeEventListener("blur", close);
    };
  }, [open]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        consume(event);
        show(true);
      } else if (event.key === "Home" || event.key === "End") {
        consume(event);
        show(true, event.key === "Home" ? 0 : last);
      } else if (isPrintable(event)) {
        consume(event);
        show(true, findTyped(event.key, selected) ?? selected);
      }
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        consume(event);
        setActive((i) => Math.min(last, i + 1));
        return;
      case "ArrowUp":
        consume(event);
        if (event.altKey) commit(active);
        else setActive((i) => Math.max(0, i - 1));
        return;
      case "Home":
      case "PageUp":
        consume(event);
        setActive(0);
        return;
      case "End":
      case "PageDown":
        consume(event);
        setActive(last);
        return;
      case "Enter":
        consume(event);
        commit(active);
        return;
      case "Tab":
        // Focus moves on as usual, taking the highlighted choice with it.
        commit(active);
        return;
      case " ":
        consume(event);
        // A space inside a word being typed is part of the search.
        if (Date.now() - typeahead.current.at < 500) {
          const match = findTyped(" ", active);
          if (match !== undefined) setActive(match);
        } else {
          commit(active);
        }
        return;
      default:
        if (isPrintable(event)) {
          consume(event);
          const match = findTyped(event.key, active);
          if (match !== undefined) setActive(match);
        }
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="sl-sp-select"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(active) : undefined}
        disabled={disabled}
        // Ahead of the click that opens the list, so its entrance isn't skipped (see Segmented).
        onPointerDown={() => setInstant(false)}
        onClick={() => (open ? setOpen(false) : show(false))}
        onKeyDown={onKeyDown}
      >
        {/* Every label sits in one grid cell, so the button is as wide as the longest one and
            never changes width when the choice does. */}
        <span className="sl-sp-select-value">
          {options.map((opt, i) => (
            <span key={opt} data-current={i === selected || undefined} aria-hidden={i !== selected || undefined}>
              {labelOf(i)}
            </span>
          ))}
        </span>
        <svg className="sl-sp-select-chevron" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 3.75 5 6.75 8 3.75" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <ul
        ref={listRef}
        id={listId}
        className="sl-sp-listbox"
        role="listbox"
        aria-label={label}
        popover="manual"
        data-instant={instant || undefined}
        // Keeps focus on the button while an option is pressed.
        onMouseDown={(event) => event.preventDefault()}
      >
        {options.map((opt, i) => (
          <li
            key={opt}
            id={optionId(i)}
            role="option"
            className="sl-sp-option"
            aria-selected={i === selected}
            data-active={(open && i === active) || undefined}
            onPointerMove={() => active !== i && setActive(i)}
            onClick={() => commit(i)}
          >
            <span>{labelOf(i)}</span>
            <svg className="sl-sp-option-check" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2.5 6.25 5 8.75 9.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </li>
        ))}
      </ul>
    </>
  );
}
