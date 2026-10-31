"use client";

import { Check, Pipette } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, useState } from "react";

import { hexToHsv, hsvToHex, isLightColor } from "@/utils/color";

export const COLORS = [
  "#059669",
  "#0f766e",
  "#0ea5e9",
  "#0284c7",
  "#8b5cf6",
  "#7c3aed",
  "#db2777",
  "#e11d48",
  "#ea580c",
  "#f59e0b",
  "#ca8a04",
  "#64748b",
  "#334155",
] as const;

const HEX = /^#?([0-9a-f]{6})$/i;
const KEY_STEP = 0.02;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function ColorPicker({
  onChange,
  value,
}: {
  onChange: (color: string) => void;
  value: string;
}) {
  const isPreset = (COLORS as readonly string[]).includes(value);
  const [customOpen, setCustomOpen] = useState(!isPreset);
  const hsv = hexToHsv(value);
  // Gray and black have no hue of their own, so the slider keeps its place.
  const [hue, setHue] = useState(hsv.h);
  const [draft, setDraft] = useState<null | string>(null);

  function setShade(s: number, v: number) {
    onChange(hsvToHex({ h: hue, s: clamp(s), v: clamp(v) }));
  }

  function pickFromPointer(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    setShade(
      (event.clientX - box.left) / box.width,
      1 - (event.clientY - box.top) / box.height,
    );
  }

  function onShadeKey(event: KeyboardEvent) {
    const moves: Record<string, [number, number]> = {
      ArrowDown: [0, -KEY_STEP],
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, KEY_STEP],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setShade(hsv.s + move[0], hsv.v + move[1]);
  }

  function typeHex(text: string) {
    setDraft(text);
    const digits = text.trim().match(HEX)?.[1];
    if (!digits) return;
    const color = `#${digits.toLowerCase()}`;
    onChange(color);
    const typed = hexToHsv(color);
    if (typed.s > 0) setHue(typed.h);
  }

  const tick = (color: string) => ({
    color: isLightColor(color) ? "#0f172a" : "#fff",
  });

  return (
    <fieldset className="color-field color-picker">
      <legend>Color</legend>
      <div className="color-swatches">
        {COLORS.map((option) => (
          <button
            aria-label={`Color ${option}`}
            aria-pressed={value === option}
            className={value === option ? "active" : undefined}
            key={option}
            onClick={() => {
              onChange(option);
              setHue(hexToHsv(option).h);
            }}
            style={{ background: option, ...tick(option) }}
            type="button"
          >
            {value === option && (
              <Check aria-hidden="true" size={14} strokeWidth={3} />
            )}
          </button>
        ))}
        <button
          aria-expanded={customOpen}
          aria-label="Custom color"
          className={`color-custom-toggle ${isPreset ? "" : "active"}`}
          onClick={() => setCustomOpen(!customOpen)}
          style={isPreset ? undefined : { background: value, ...tick(value) }}
          title="Choose any color"
          type="button"
        >
          <Pipette aria-hidden="true" size={14} />
        </button>
      </div>

      {customOpen && (
        <div className="color-custom-panel">
          <div
            aria-label="Saturation and brightness"
            aria-valuenow={Math.round(hsv.s * 100)}
            aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
            className="color-shade"
            onKeyDown={onShadeKey}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              pickFromPointer(event);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                pickFromPointer(event);
              }
            }}
            role="slider"
            style={{ backgroundColor: `hsl(${hue} 100% 50%)` }}
            tabIndex={0}
          >
            <i
              style={{
                background: value,
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
              }}
            />
          </div>
          <input
            aria-label="Hue"
            className="color-hue"
            max={360}
            min={0}
            onChange={(event) => {
              const h = Number(event.target.value);
              setHue(h);
              onChange(hsvToHex({ ...hsv, h }));
            }}
            type="range"
            value={hue}
          />
          <div className="color-hex">
            <span style={{ background: value }} />
            <input
              aria-label="Hex color"
              maxLength={7}
              onBlur={() => setDraft(null)}
              onChange={(event) => typeHex(event.target.value)}
              onKeyDown={(event) => {
                // Enter here shouldn't submit the form around it.
                if (event.key === "Enter") event.preventDefault();
              }}
              spellCheck={false}
              value={draft ?? value}
            />
          </div>
        </div>
      )}
    </fieldset>
  );
}
