"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export interface SelectOption {
  group?: string;
  icon?: ReactNode;
  label: string;
  value: string;
}

interface SelectProps {
  "aria-label"?: string;
  className?: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  value: string;
}

const GAP = 6;
const MAX_MENU_HEIGHT = 320;
const SEARCHABLE_FROM = 5;
const SEARCHABLE_MIN_WIDTH = 220;

/** A styled dropdown with the keyboard behavior of a native select, searchable when long. */
export function Select({
  "aria-label": ariaLabel,
  className = "",
  onChange,
  options,
  placeholder = "Select",
  value,
}: SelectProps) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const searchable = options.length >= SEARCHABLE_FROM;
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? options.filter((option) =>
        `${option.label} ${option.group ?? ""}`.toLowerCase().includes(needle),
      )
    : options;

  function show() {
    setQuery("");
    setActive(Math.max(options.indexOf(selected as SelectOption), 0));
    setOpen(true);
  }

  function choose(option?: SelectOption) {
    setOpen(false);
    trigger.current?.focus();
    if (option && option.value !== value) onChange(option.value);
  }

  function place() {
    const list = menu.current;
    const button = trigger.current;
    if (!list || !button) return;
    const rect = button.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - GAP * 2;
    const above = rect.top - GAP * 2;
    list.style.maxHeight = "";
    const height = Math.min(list.scrollHeight, MAX_MENU_HEIGHT);
    const flip = below < height && above > below;
    const width = Math.min(
      Math.max(rect.width, searchable ? SEARCHABLE_MIN_WIDTH : 0),
      window.innerWidth - GAP * 2,
    );
    list.style.left = `${Math.max(GAP, Math.min(rect.left, window.innerWidth - width - GAP))}px`;
    list.style.maxHeight = `${Math.min(MAX_MENU_HEIGHT, flip ? above : below)}px`;
    // Anchored to the side facing the trigger, so filtering never detaches it.
    list.style.top = flip ? "auto" : `${rect.bottom + GAP}px`;
    list.style.bottom = flip
      ? `${window.innerHeight - rect.top + GAP}px`
      : "auto";
    list.style.width = `${width}px`;
  }

  // The top layer keeps the menu above dialogs and free of their overflow clipping.
  useLayoutEffect(() => {
    const list = menu.current;
    if (!open || !list) return;
    if (!list.matches(":popover-open")) list.showPopover();
    place();
    // On touch screens the keyboard only opens if the person taps the search.
    if (window.matchMedia("(pointer: fine)").matches) {
      search.current?.focus({ preventScroll: true });
    }
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const isInside = (target: EventTarget | null) =>
      target instanceof Node &&
      (menu.current?.contains(target) || trigger.current?.contains(target));
    const onPointerDown = (event: PointerEvent) => {
      if (!isInside(event.target)) setOpen(false);
    };
    // A fixed menu would drift away from its trigger.
    const onMove = (event: Event) => {
      if (
        event.target instanceof Node &&
        menu.current?.contains(event.target)
      ) {
        return;
      }
      // Opening a phone's keyboard moves the page, which shouldn't end the search.
      if (search.current && document.activeElement === search.current) place();
      else setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${id}-${active}`)?.scrollIntoView({
      block: "nearest",
    });
  }, [active, id, open]);

  function onKeyDown(event: KeyboardEvent) {
    const last = Math.max(visible.length - 1, 0);
    // While searching, these keys belong to the text.
    const isTyping = event.target === search.current;
    if (isTyping && [" ", "End", "Home"].includes(event.key)) return;
    if (!open) {
      if ([" ", "ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
        event.preventDefault();
        show();
      }
      return;
    }
    if (event.key === "Tab") {
      if (isTyping) {
        event.preventDefault();
        choose();
      } else {
        setOpen(false);
      }
      return;
    }
    const moves: Record<string, number> = {
      ArrowDown: Math.min(active + 1, last),
      ArrowUp: Math.max(active - 1, 0),
      End: last,
      Home: 0,
    };
    const next = moves[event.key];
    if (next !== undefined) {
      event.preventDefault();
      setActive(next);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (visible[active]) choose(visible[active]);
    } else if (event.key === "Escape") {
      // Escape closes only the menu, not the dialog around it.
      event.preventDefault();
      event.stopPropagation();
      choose();
    }
  }

  return (
    <>
      <button
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        aria-controls={open ? `${id}-menu` : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={`select-trigger ${open ? "open" : ""} ${className}`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        ref={trigger}
        role="combobox"
        type="button"
      >
        {selected?.icon}
        <span
          className={selected ? "select-value" : "select-value placeholder"}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown aria-hidden="true" size={16} />
      </button>
      {open && (
        <div
          className="select-menu"
          // Inside a label, a click would otherwise reactivate the trigger.
          onClick={(event) => event.preventDefault()}
          popover="manual"
          ref={menu}
        >
          {searchable && (
            <div className="select-search">
              <Search aria-hidden="true" size={14} />
              <input
                aria-activedescendant={
                  visible.length > 0 ? `${id}-${active}` : undefined
                }
                aria-controls={`${id}-menu`}
                aria-label="Search options"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Search"
                ref={search}
                type="search"
                value={query}
              />
            </div>
          )}
          <ul className="select-list" id={`${id}-menu`} role="listbox">
            {visible.length === 0 && (
              <li className="select-empty" role="presentation">
                {needle ? "No matches" : "No options available"}
              </li>
            )}
            {visible.map((option, index) => (
              <li key={option.value} role="presentation">
                {option.group && option.group !== visible[index - 1]?.group && (
                  <div className="select-group">{option.group}</div>
                )}
                <div
                  aria-selected={option.value === value}
                  className={`select-option ${index === active ? "active" : ""}`}
                  id={`${id}-${index}`}
                  onClick={() => choose(option)}
                  onPointerMove={() => setActive(index)}
                  role="option"
                >
                  {option.icon}
                  <span>{option.label}</span>
                  {option.value === value && (
                    <Check aria-hidden="true" size={15} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
