const fs = require("node:fs/promises");
const path = require("node:path");

/**
 * Generate native Docusaurus routes from the route manifest.
 * Entity lookup and page composition live in src/wiki; no hash router is used
 * by the Docusaurus build. The standalone preview has a separate entry point.
 */
module.exports = function wikiRoutesPlugin(context) {
  const manifestPath = path.join(context.siteDir, "content", "routes.json");

  return {
    name: "roco-wiki-routes",
    getPathsToWatch() {
      return [manifestPath];
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
      return normalized;
    },
    async contentLoaded({ content, actions }) {
      const { createData, addRoute } = actions;
      await Promise.all(
        content.map(async (route, index) => {
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
