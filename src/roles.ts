import type { RoleEntry, UserInfo } from "./types";

export function extractRoles(userInfo: UserInfo): RoleEntry[] {
  const roles: RoleEntry[] = [];

  for (const [groupId, role] of Object.entries(userInfo.groups ?? {})) {
    roles.push({
      role,
      source: "groups",
      group: groupId
    });
  }

  for (const group of userInfo.detailed_groups ?? []) {
    const detailedRoles = Array.isArray(group.roles)
      ? group.roles
      : [group.roles];

    for (const detailedRole of detailedRoles) {
      roles.push({
        role: detailedRole.role,
        label: detailedRole.label,
        source: "detailed_groups",
        group: group.label,
        scope: group.scope
      });
    }
  }

  return roles;
}

export function formatRoleSource(entry: RoleEntry): string {
  if (entry.source === "groups") {
    return `groups[${entry.group ?? ""}]`;
  }

  return [entry.group, entry.scope].filter(Boolean).join(" · ");
}