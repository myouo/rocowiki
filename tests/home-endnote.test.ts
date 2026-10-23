// SPDX-License-Identifier: GPL-3.0-only
import { afterEach, expect, it, vi } from "vitest";
import React, { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { createRequire } from "node:module";
import HomeEndnote from "../apps/web/src/wiki/HomeEndnote";
import Acknowledgements from "../apps/web/src/wiki/legal/Acknowledgements";

const route = vi.hoisted(() => ({ pathname: "/", baseUrl: "/" }));
const anchors = vi.hoisted(() => [] as string[]);
vi.mock("@docusaurus/useBrokenLinks", () => ({ default: () => ({ collectAnchor: (id: string) => anchors.push(id) }) }));
vi.mock("@docusaurus/router", () => ({ useLocation: () => ({ pathname: route.pathname, search: "", hash: "" }) }));
vi.mock("@docusaurus/useBaseUrl", () => ({ default: () => route.baseUrl }));
vi.mock("@docusaurus/Link", () => ({
  default: ({ to, ...props }: React.ComponentProps<"a"> & { to: string }) => createElement("a", { ...props, href: to }),
}));
afterEach(() => {
  route.pathname = route.baseUrl = "/";
  anchors.length = 0;
  vi.unstubAllGlobals();
});

function harness(url = "https://wiki.test/") {
  const { JSDOM } = createRequire(import.meta.url)("jsdom");
  const dom = new JSDOM('<div id="root"></div>', { url });
  const document: Document = dom.window.document;
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", document);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const root = createRoot(document.getElementById("root")!);
  return {
    dom, document,
    async render() { await act(async () => root.render(createElement(HomeEndnote))); },
    async close() { await act(async () => root.unmount()); dom.window.close(); },
  };
}

it("does not emit counting requests into static HTML or non-home routes", () => {
  const html = renderToString(createElement(HomeEndnote));
  expect(html).toContain("/copyright/#credits");
  expect(html).not.toContain("count.getloli.com");
  for (const path of ["/pets/", "/copyright/", "/copyright/en/"]) {
    route.pathname = path;
    expect(renderToString(createElement(HomeEndnote))).toBe("");
  }
});

it("counts homepage visits under a base path using the shared project counter", async () => {
  route.baseUrl = route.pathname = "/wiki/";
  const h = harness("https://wiki.test/wiki/");
  try {
    await h.render();
    const image = h.document.querySelector("img")!;
    const url = new URL(image.src);
    expect(url.pathname).toBe("/@rocowiki");
    expect(url.searchParams.get("theme")).toBe("miku");
    expect(url.searchParams.has("num")).toBe(false);
    expect(image.closest("a")).toBeNull();
    route.pathname = "/wiki/pets/";
    await h.render();
    expect(h.document.querySelector("img")).toBeNull();
    expect(h.document.querySelector(".rw-home-endnote")).toBeNull();
  } finally { await h.close(); }
});

it("handles counter failure without retrying and recovers on the next homepage visit", async () => {
  const h = harness();
  try {
    await h.render();
    const image = h.document.querySelector("img")!;
    await act(async () => image.dispatchEvent(new h.dom.window.Event("error")));
    await h.render();
    expect(h.document.querySelector("img")).toBeNull();
    expect(h.document.querySelector('[role="status"]')?.textContent).toBe("访问计数暂时无法加载");
    expect(h.document.querySelector('a[href="/copyright/#credits"]')).not.toBeNull();
    route.pathname = "/pets/";
    await h.render();
    route.pathname = "/";
    await h.render();
    expect(h.document.querySelector("img")).not.toBeNull();
  } finally { await h.close(); }
});

it("leaves the standalone file preview offline without sending counting requests", async () => {
  const h = harness("file:///tmp/rocowiki-preview.html");
  try {
    await h.render();
    expect(h.document.querySelector('a[href="/copyright/#credits"]')).not.toBeNull();
    expect(h.document.querySelector("img")).toBeNull();
    expect(h.document.querySelector('[role="status"]')).toBeNull();
  } finally { await h.close(); }
});

it.each([false, true])("registers the rendered credits anchor during static rendering (English: %s)", english => {
  const html = renderToString(createElement(Acknowledgements, { english }));
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  expect(ids).toContain("credits");
  expect(anchors).toEqual(ids);
});
