# Contributing to Maximus

Thanks for wanting to help. Maximus is a local AI workspace for macOS. It is
free and open source under the Apache-2.0 license.

## Before you start

- Read [docs/development.md](docs/development.md). It covers building, running,
  testing and the code conventions. For how the parts fit together, read
  [docs/architecture.md](docs/architecture.md).
- For anything larger than a fix, open an issue first so we can agree on the
  direction before you spend the time.

## The rules

1. **Tests must pass.** Run `npm test` before you open a pull request. Several
   tests read the source as text: no `px` above hairlines, every called
   function defined, and the data-boundary rules.
   UI changes should come with a browser test run against
   `sh scripts/provserver.sh start`.
2. **Nothing leaves the machine silently.** Any new outbound path must go
   through the masking gate and write to the ledger. A change that weakens
   that won't be merged.
3. **Follow the code's conventions.** Identifiers and comments are in Swedish.
   Comments say *why*, with a date when they record a bug. Keep functions
   short. The UI has no build step.
4. **Keep pull requests small and focused**, with a description of what
   changed and how you tested it.

## License

By contributing, you agree that your contribution is licensed under the
[Apache License 2.0](LICENSE), the same as the rest of the project. You don't
need to sign anything else.

## Be kind

Assume good intent, give concrete feedback, and remember that there's a
person on the other end. Harassment of any kind isn't welcome here.
