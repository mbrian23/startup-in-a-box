# Contributing

Thanks for your interest in Startup in a Box! This started as a demo, but contributions that make it more useful, more reliable, or more fun are welcome.

## Getting started

1. Fork the repo and clone your fork.
2. Copy the `.env.example` files and fill in your API keys (see the README).
3. Run `make install && make dev` to spin up the stack locally.

## Submitting changes

- Open an issue first for anything non-trivial so we can discuss the approach.
- Keep PRs focused — one feature or fix per PR.
- Make sure `make lint` passes and existing tests aren't broken.
- Write tests for new behavior when practical.

## Code style

- **Python**: formatted with `ruff`. Run `ruff check` and `ruff format` before committing.
- **TypeScript**: ESLint via `make lint`. Prefer named exports and explicit types.
- **Commits**: short imperative subject line ("add X", "fix Y"), not "added" or "fixes".

## What's especially welcome

- Test coverage (the factory has none — easy wins there).
- Documentation improvements.
- New themes for the boardroom (see the `new-theme` skill in `.claude/skills/`).
- Bug reports with reproduction steps.

## What to avoid

- Large refactors without prior discussion.
- New dependencies unless they earn their weight.
- Changes to the orchestrator↔factory protocol without updating both sides.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
