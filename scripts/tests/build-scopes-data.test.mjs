import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCookbook, isAgencyOnlyScope, slugify } from "../build-scopes-data.mjs";

test("applyCookbook rewrites sub-account to account", () => {
  assert.equal(
    applyCookbook("Read contacts in your sub-account."),
    "Read contacts in your account."
  );
});

test("applyCookbook rewrites your location to your account", () => {
  assert.equal(
    applyCookbook("Manage settings of your location."),
    "Manage settings of your account."
  );
});

test("applyCookbook rewrites HighLevel and GoHighLevel to Leadway", () => {
  assert.equal(applyCookbook("HighLevel uses webhooks."), "Leadway uses webhooks.");
  assert.equal(applyCookbook("GoHighLevel uses webhooks."), "Leadway uses webhooks.");
});

test("applyCookbook is case-insensitive but preserves the casing of the replacement", () => {
  assert.equal(applyCookbook("Sub-account settings"), "Account settings");
  assert.equal(applyCookbook("your Location"), "your account");
});

test("applyCookbook does not touch wire-level identifiers", () => {
  assert.equal(
    applyCookbook("Pass `locationId` as a query parameter."),
    "Pass `locationId` as a query parameter."
  );
  assert.equal(applyCookbook("Scope: contacts.readonly"), "Scope: contacts.readonly");
});

test("isAgencyOnlyScope flags oauth scopes and company scopes", () => {
  assert.equal(isAgencyOnlyScope({ name: "oauth.write" }), true);
  assert.equal(isAgencyOnlyScope({ name: "oauth.readonly" }), true);
  assert.equal(isAgencyOnlyScope({ name: "companies.readonly" }), true);
  assert.equal(isAgencyOnlyScope({ name: "contacts.readonly" }), false);
});

test("slugify produces kebab-case", () => {
  assert.equal(slugify("Ad Manager"), "ad-manager");
  assert.equal(slugify("Chat Widget"), "chat-widget");
  assert.equal(slugify("LC Email"), "lc-email");
  assert.equal(slugify("AI Agent"), "ai-agent");
});
