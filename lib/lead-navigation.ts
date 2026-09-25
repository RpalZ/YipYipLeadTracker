export function buildLeadHref(
  pathname: string,
  currentSearch: string,
  leadId: string | null,
  tab?: "review",
) {
  const params = new URLSearchParams(currentSearch);

  if (leadId) {
    params.set("lead", leadId);
    if (tab) params.set("tab", tab);
    else params.delete("tab");
  } else {
    params.delete("lead");
    params.delete("tab");
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function resolveLeadId(
  candidate: string | null,
  validIds: Iterable<string>,
) {
  if (!candidate) return null;
  return new Set(validIds).has(candidate) ? candidate : null;
}
