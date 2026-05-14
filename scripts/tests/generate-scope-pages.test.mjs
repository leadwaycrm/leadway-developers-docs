import { test } from "node:test";
import assert from "node:assert/strict";
import { renderCategory } from "../generate-scope-pages.mjs";

const fixture = {
  slug: "contacts",
  name: "Contacts",
  summary: "Read, create, and modify contacts in your account.",
  scopes: [
    {
      name: "contacts.readonly",
      type: "read",
      description: "Read the list of contacts and any contact's details.",
    },
    {
      name: "contacts.write",
      type: "write",
      description: "Create, update, and delete contacts.",
    },
  ],
  endpointsHint: "These scopes enable endpoints under /contacts/.",
};

test("renderCategory produces valid Mintlify MDX with frontmatter", () => {
  const out = renderCategory(fixture);
  assert.match(out, /^---\n/, "starts with frontmatter");
  assert.match(out, /title: "Contacts"/, "has the right title");
  assert.match(
    out,
    /description: "Read, create, and modify contacts in your account\."/
  );
  assert.match(out, /\n---\n/, "frontmatter closes");
});

test("renderCategory includes a scopes table with each scope as a row", () => {
  const out = renderCategory(fixture);
  assert.match(out, /\| Scope \| Type \| What it does \|/);
  assert.match(out, /\| `contacts\.readonly` \| `read` \| Read the list/);
  assert.match(out, /\| `contacts\.write` \| `write` \| Create, update/);
});

test("renderCategory includes endpointsHint in a Note callout", () => {
  const out = renderCategory(fixture);
  assert.match(
    out,
    /<Note>\n  These scopes enable endpoints under \/contacts\/\.\n<\/Note>/
  );
});

test("renderCategory omits the Note when endpointsHint is missing", () => {
  const noHint = { ...fixture, endpointsHint: undefined };
  const out = renderCategory(noHint);
  assert.doesNotMatch(out, /<Note>/);
});

test("renderCategory escapes pipe characters in descriptions", () => {
  const withPipe = {
    ...fixture,
    scopes: [
      {
        name: "x.readonly",
        type: "read",
        description: "Filter by status: open | closed.",
      },
    ],
  };
  const out = renderCategory(withPipe);
  assert.match(out, /open \\\| closed/, "pipes are escaped for markdown tables");
});
