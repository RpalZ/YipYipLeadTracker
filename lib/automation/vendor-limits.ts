export const RESEARCH_MAX_WEB_SEARCH_CALLS = 3;
export const SOURCE_SCOUT_MAX_WEB_SEARCH_CALLS = 6;

export function openAIWebSearchProviderData(maxToolCalls?: number) {
  return {
    include: ["web_search_call.action.sources"],
    ...(maxToolCalls === undefined ? {} : { max_tool_calls: maxToolCalls }),
  };
}
