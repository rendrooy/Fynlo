"use client";

import type { CategoryInterface, CategoryType } from "@fynlo/types";

import { Button } from "@fynlo/ui/components/button";
import { Select } from "@fynlo/ui/components/select";
import { Pipette } from "lucide-react";
import { type FormEvent, useState } from "react";

import {
  CategoryIcon,
  categoryIconNames,
  categoryStyle,
  searchCategoryIcons,
} from "@/components/CategoryIcon";
import { useFinance } from "@/providers/finance-provider";
import { ApiError } from "@/services/api";

const COLORS = [
  "#059669",
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#e11d48",
  "#64748b",
  "#0f766e",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#ca8a04",
];

export function CategoryForm({
  defaultGroupId,
  editing,
  onCancel,
  onSaved,
  type,
}: {
  defaultGroupId?: string;
  editing?: CategoryInterface;
  onCancel: () => void;
  onSaved: (message: string) => void;
  type: CategoryType;
}) {
  const { categoryGroups, createCategory, updateCategory } = useFinance();
  const groups = categoryGroups.filter((g) => g.type === type);
  const [name, setName] = useState(editing?.name ?? "");
  const [groupId, setGroupId] = useState(
    editing?.groupId ?? defaultGroupId ?? groups[0]?.id ?? "",
  );
  const [icon, setIcon] = useState<string>(editing?.icon ?? "tag");
  const [color, setColor] = useState<string>(
    editing?.color ?? (COLORS[0] as string),
  );
  const [iconQuery, setIconQuery] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // The current icon stays visible, so a search never hides what's selected.
  const matches = searchCategoryIcons(iconQuery);
  const visibleIcons = iconQuery.trim()
    ? matches
    : [icon, ...categoryIconNames.filter((name) => name !== icon)];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!name.trim() || !groupId) return;
    const input = { color, groupId, icon, name: name.trim() };
    setError("");
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id, input);
        onSaved("Category updated");
      } else {
        await createCategory(input);
        onSaved("Category added");
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Something went wrong. Please try again.",
      );
      setSaving(false);
    }
  }

  return (
    <form noValidate onSubmit={submit}>
      <label>
        Category name
        <input
          autoFocus
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
          placeholder="Example: Groceries"
          value={name}
        />
        {submitted && !name.trim() && (
          <span className="field-error">Enter a category name</span>
        )}
      </label>

      <label>
        Group
        <Select
          onChange={setGroupId}
          options={groups.map((group) => ({
            label: group.name,
            value: group.id,
          }))}
          placeholder="Add a group first"
          value={groupId}
        />
        {submitted && !groupId && (
          <span className="field-error">Add a group first</span>
        )}
      </label>

      <fieldset className="color-field">
        <legend>Icon</legend>
        <input
          aria-label="Search icons"
          className="icon-search"
          onChange={(event) => setIconQuery(event.target.value)}
          placeholder="Search icons, such as kopi or gym"
          type="search"
          value={iconQuery}
        />
        <div className="icon-grid">
          {visibleIcons.length === 0 && (
            <span className="icon-empty">No icons found</span>
          )}
          {visibleIcons.map((option) => (
            <button
              aria-label={`Icon ${option}`}
              aria-pressed={icon === option}
              className={`tx-icon ${icon === option ? "active" : ""}`}
              key={option}
              onClick={() => setIcon(option)}
              style={icon === option ? categoryStyle(color) : undefined}
              title={option}
              type="button"
            >
              <CategoryIcon icon={option} />
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="color-field">
        <legend>Color</legend>
        <div>
          {COLORS.map((option) => (
            <button
              aria-label={`Color ${option}`}
              aria-pressed={color === option}
              className={color === option ? "active" : undefined}
              key={option}
              onClick={() => setColor(option)}
              style={{ background: option }}
              type="button"
            />
          ))}
          <label
            className={`color-custom ${COLORS.includes(color) ? "" : "active"}`}
            style={{ background: color }}
            title="Choose any color"
          >
            <Pipette aria-hidden="true" size={14} />
            <input
              aria-label="Custom color"
              onChange={(event) => setColor(event.target.value)}
              type="color"
              value={color}
            />
          </label>
        </div>
      </fieldset>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <div className="modal-actions">
        <Button kind="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={saving} type="submit">
          {saving ? "Saving..." : "Save Category"}
        </Button>
      </div>
    </form>
  );
}
