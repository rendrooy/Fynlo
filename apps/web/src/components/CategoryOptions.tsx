import type { CategoryInterface } from "@fynlo/types";

/** Select options for categories, listed under their groups. */
export function CategoryOptions({
  categories,
}: {
  categories: CategoryInterface[];
}) {
  const groupIds = [...new Set(categories.map((c) => c.groupId))];
  return groupIds.map((groupId) => {
    const members = categories.filter((c) => c.groupId === groupId);
    return (
      <optgroup key={groupId} label={members[0]?.groupName}>
        {members.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </optgroup>
    );
  });
}
