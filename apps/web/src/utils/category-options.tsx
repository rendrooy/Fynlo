import type { CategoryInterface } from "@fynlo/types";
import type { SelectOption } from "@fynlo/ui/components/select";

import { CategoryIcon, categoryStyle } from "@/components/CategoryIcon";

/** Dropdown options for categories, listed under their groups. */
export function categoryOptions(
  categories: CategoryInterface[],
): SelectOption[] {
  const groupIds = [...new Set(categories.map((c) => c.groupId))];
  return groupIds.flatMap((groupId) =>
    categories
      .filter((c) => c.groupId === groupId)
      .map((category) => ({
        group: category.groupName,
        icon: (
          <span className="select-icon" style={categoryStyle(category.color)}>
            <CategoryIcon className="size-3.5" icon={category.icon} />
          </span>
        ),
        label: category.name,
        value: category.id,
      })),
  );
}
