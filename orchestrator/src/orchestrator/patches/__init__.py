"""Runtime patches applied at orchestrator startup.

Importing this package installs every patch module listed below. Patches
are intentionally narrow and version-pinned — each one is a workaround
for a specific gap in a third-party dependency, with a comment pointing
at the upstream issue it tracks.
"""

from __future__ import annotations

from orchestrator.patches import ag_ui_adk_author  # noqa: F401  (import side-effect)
