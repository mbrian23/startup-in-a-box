"""Stub search tool for non-Gemini models.

ADK's built-in ``google_search`` is a Gemini-native grounding tool that
raises ``ValueError`` when used with any other provider.  This module
provides a lightweight ``FunctionTool`` fallback that instructs the LLM
to use its training knowledge instead of live search results.
"""

from __future__ import annotations

from google.adk.tools import FunctionTool


def web_search(query: str) -> str:
    """Search the web for information about a topic.

    Args:
        query: The search query string.

    Returns:
        A message indicating that live search is unavailable and the agent
        should rely on its training knowledge.
    """
    return (
        f"[Live web search unavailable for query: {query!r}] "
        "Use your training knowledge to provide market analysis. "
        "Focus on well-known competitors, general market trends, "
        "and reasonable size estimates based on what you know."
    )


stub_search_tool = FunctionTool(func=web_search)
