import type { MetadataRoute } from "next";
import { guides } from "@/lib/content/guides";
import { tools } from "@/lib/content/tools";
import { getConversionPageDefinitions } from "@/lib/seo/conversion-pages";
import { siteConfig } from "@/lib/site-config";
import { categories } from "@/lib/units/registry";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteConfig.url, changeFrequency: "weekly", priority: 1 },
    { url: `${siteConfig.url}/convert`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteConfig.url}/converters`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteConfig.url}/tools`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteConfig.url}/guides`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteConfig.url}/about`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteConfig.url}/accuracy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteConfig.url}/contact`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${siteConfig.url}/converters/${category.id}`,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const conversionRoutes: MetadataRoute.Sitemap = getConversionPageDefinitions()
    .filter((d) => d.indexable)
    .map((definition) => ({
      url: `${siteConfig.url}/converters/${definition.slug}`,
      changeFrequency: "monthly",
      priority: 0.7,
    }));

  const toolRoutes: MetadataRoute.Sitemap = tools.map((tool) => ({
    url: `${siteConfig.url}/tools/${tool.slug}`,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  const guideRoutes: MetadataRoute.Sitemap = guides.map((guide) => ({
    url: `${siteConfig.url}/guides/${guide.slug}`,
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...categoryRoutes, ...conversionRoutes, ...toolRoutes, ...guideRoutes];
}
