const fs = require("node:fs/promises");
const path = require("node:path");
const {catalogAliases} = require("../../../../packages/wiki-schema/src/catalog-routes.ts");

/**
 * Generate native Docusaurus routes from the route manifest.
 * Entity lookup and page composition live in src/wiki; no hash router is used
 * by the Docusaurus build. The standalone preview has a separate entry point.
 */
module.exports = function wikiRoutesPlugin(context) {
  const manifestPath = path.join(context.siteDir, "content", "routes.json");
  const catalogPaths = ["pets", "skills"].map(kind => path.join(context.siteDir, "content", `official-${kind}.json`));

  return {
    name: "roco-wiki-routes",
    getPathsToWatch() {
      return [manifestPath, ...catalogPaths, path.resolve(__dirname, '../../../../packages/wiki-schema/src/catalog-routes.ts')];
    },
    async loadContent() {
      let manifest;
      try {
        manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
      } catch (error) {
        if (error.code === "ENOENT") return [];
        throw new Error(`Cannot load content/routes.json: ${error.message}`);
      }
      if (
        !Array.isArray(manifest) ||
        manifest.some((route) => typeof route !== "string")
      ) {
        throw new TypeError(
          "content/routes.json must contain an array of route strings.",
        );
      }
      const normalized = manifest.map((route) => {
        if (
          !route.startsWith("/") ||
          route.includes("?") ||
          route.includes("#") ||
          route.includes("..")
        ) {
          throw new TypeError(`Invalid static Wiki route: ${route}`);
        }
        return route === "/" ? "/" : `${route.replace(/\/+$/, "")}/`;
      });
      if (new Set(normalized).size !== normalized.length) {
        throw new Error(
          "content/routes.json contains duplicate normalized routes.",
        );
      }
      // Direct visits and refreshes receive real static HTML, without an SPA fallback.
      for (const [index, kind] of ["pets", "skills"].entries()) {
        const snapshot = JSON.parse(await fs.readFile(catalogPaths[index], "utf8"));
        const ids = new Set();
        for (const entry of snapshot[kind]) {
          if (!Number.isSafeInteger(entry.id) || entry.id <= 0) throw new TypeError(`Invalid ${kind} route ID`);
          if (ids.has(entry.id)) throw new Error(`Duplicate ${kind} route ID`);
          ids.add(entry.id);
        }
        // A future source omission must not break an independently retained legacy article.
        for (const id of Object.values(catalogAliases[kind])) ids.add(id);
        for (const id of ids) normalized.push(`/${kind}/${id}/`);
      }
      if (new Set(normalized).size !== normalized.length) throw new Error("Duplicate catalogue routes");
      return normalized;
    },
    async contentLoaded({ content, actions }) {
      const { createData, addRoute } = actions;
      await Promise.all(
        content.map(async (route, index) => {
          if (/^\/(pets|skills)\/[1-9]\d*\/$/.test(route)) {
            // Share one module across all IDs instead of emitting a data chunk for each entry.
            actions.addRoute({path: `${context.baseUrl.replace(/\/$/, "")}${route}`, component: "@site/src/wiki/WikiPage.jsx", exact: true});
            return;
          }
          const dataPath = await createData(
            `wiki-route-${index}.json`,
            JSON.stringify({ path: route }),
          );
          const base = context.baseUrl.replace(/\/$/, "");
          addRoute({
            path: `${base}${route}`,
            component: "@site/src/wiki/WikiPage.jsx",
            modules: { routeData: dataPath },
            exact: true,
          });
        }),
      );
    },
    async postBuild({ outDir, routesPaths, baseUrl }) {
      // A successful bundler exit is not sufficient: validate the emitted pages.
      // This also covers native docs and the 404 page registered by other plugins.
      const failures = [];
      for (const route of routesPaths) {
        const relative = route.startsWith(baseUrl)
          ? route.slice(baseUrl.length)
          : route.replace(/^\/+/, "");
        const filename = /\.html?$/i.test(relative)
          ? relative
          : path.join(relative, "index.html");
        try {
          const html = await fs.readFile(path.join(outDir, filename), "utf8");
          if (!/<html[\s>]/i.test(html) || !/<body[\s>]/i.test(html)) {
            failures.push(route);
          }
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          failures.push(route);
        }
      }
      if (failures.length) {
        throw new Error(
          `Static HTML validation failed for ${failures.length} route(s):\n${failures.join("\n")}`,
        );
      }
      console.log(
        `Static HTML check passed: ${routesPaths.length} complete pages.`,
      );
    },
  };
};
