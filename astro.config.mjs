// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

import cloudflare from "@astrojs/cloudflare";
import { optimizeProjectGallery } from "./scripts/optimize-project-gallery.mjs";

// Generate responsive gallery images before Astro reads or copies public assets.
const projectGalleryOptimizer = {
  name: "andro-project-gallery-optimizer",
  hooks: { "astro:config:setup": optimizeProjectGallery },
};

// https://astro.build/config
export default defineConfig({
	site: "https://andro.co.nz",
	integrations: [projectGalleryOptimizer, mdx(), sitemap()],
	adapter: cloudflare({
		platformProxy: {
			enabled: true,
		},
	}),
});
