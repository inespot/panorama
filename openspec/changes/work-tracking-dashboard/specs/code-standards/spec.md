# Spec: Code Standards

## Context

Panorama is designed to be modular and easy to extend. The codebase must reflect that — code should be approachable for future contributors (or future-you), simple to navigate, and consistent across all packages.

## Requirements

### Requirement: Simplicity and conciseness
Code SHALL be as simple and concise as possible. Prefer straightforward implementations over clever abstractions. Avoid premature generalization — only introduce abstractions when there are two or more concrete use cases.

#### Scenario: Choosing between approaches
- **WHEN** there are multiple ways to implement a feature
- **THEN** prefer the approach that is easiest to read and has the fewest moving parts

### Requirement: Readability and navigability
Files SHALL be small and focused — each file should have a single clear responsibility. Related files SHALL be co-located in descriptive directory structures. Imports SHALL be organized consistently (external dependencies first, then internal modules).

#### Scenario: File size
- **WHEN** a file exceeds ~200 lines
- **THEN** it SHOULD be split into smaller, focused modules

### Requirement: Modularity
Each major concern (connectors, sync engine, AI agent, API routes, frontend views) SHALL live in its own module with a clear boundary. Modules SHALL communicate through well-defined interfaces, not by reaching into each other's internals. Shared types and interfaces SHALL live in `packages/shared`.

#### Scenario: Adding a new connector
- **WHEN** a developer adds a new source connector
- **THEN** they should only need to implement the `Connector` interface and register it — no changes to the core sync engine or database layer

### Requirement: Function documentation
All exported functions and public APIs SHALL have JSDoc (TypeScript) or equivalent documentation comments explaining:
- What the function does (one sentence)
- Parameters and return values when not obvious from types alone
- Side effects, if any

Internal helper functions do not require doc comments unless their behavior is non-obvious.

#### Scenario: Utility function
- **GIVEN** an exported `encrypt(plaintext: string): string` function
- **THEN** it SHALL have a doc comment explaining the algorithm used and what format the output is in

### Requirement: API contract clarity
All REST API endpoints SHALL have clearly defined request/response shapes using TypeScript types in `packages/shared`. Error responses SHALL follow a consistent format (`{ error: string }`) with appropriate HTTP status codes.

#### Scenario: New API endpoint
- **WHEN** a new endpoint is added
- **THEN** its request params, body shape, and response type SHALL be defined as shared types

### Requirement: Language best practices
Code SHALL follow established conventions for each language and framework used:
- **TypeScript**: strict mode, no `any` unless unavoidable (with a comment explaining why), prefer `const` over `let`, use enums or union types for fixed value sets
- **React**: functional components only, hooks for state and effects, avoid prop drilling via lightweight context where appropriate
- **Express**: route handlers SHALL be thin — delegate business logic to service modules
- **SQL/Drizzle**: use parameterized queries (Drizzle handles this), never interpolate user input

### Requirement: Consistent naming
Names SHALL be descriptive and consistent across the codebase:
- Files and directories: `kebab-case`
- TypeScript variables, functions, parameters: `camelCase`
- TypeScript types, interfaces, enums, classes: `PascalCase`
- Database columns: `snake_case` (as defined by the Drizzle schema)
- Environment variables: `UPPER_SNAKE_CASE`

### Requirement: Error handling
Functions SHALL handle errors explicitly rather than letting exceptions propagate silently. Errors SHALL be logged with enough context to diagnose the problem. User-facing error messages SHALL be helpful without exposing internals.

#### Scenario: External API failure
- **WHEN** a connector's API call fails
- **THEN** the error SHALL be logged with the source name and HTTP status, and the sync SHALL continue with remaining sources

### Requirement: Property-based testing
Core logic modules SHALL have minimal property-based tests using a library such as `fast-check`. Property-based tests are particularly valuable for functions that transform, normalize, or validate data — where edge cases are hard to enumerate by hand. Priority targets include: status mapping, priority extraction from labels, linked-item URL parsing (both GitHub-to-Jira and Jira-to-GitHub), encryption round-trips, and todo ordering logic.

Unit tests using example-based assertions are acceptable elsewhere, but property-based tests SHALL be preferred for any pure function with a non-trivial input domain.

#### Scenario: Status mapping correctness
- **WHEN** property-based tests run against the status-mapping function
- **THEN** they SHALL verify that every possible source status maps to a valid normalized status and that the mapping is deterministic

#### Scenario: Encryption round-trip
- **WHEN** property-based tests run against the encrypt/decrypt utilities
- **THEN** they SHALL verify that `decrypt(encrypt(plaintext)) === plaintext` for arbitrary input strings

#### Scenario: Linked-item URL parsing
- **WHEN** property-based tests run against the GitHub PR URL regex or Jira key regex
- **THEN** they SHALL verify that valid patterns are matched and invalid patterns are rejected across a wide range of generated inputs
