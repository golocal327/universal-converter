// `||` (not `??`) on purpose: Vercel and other platforms can inject an env var
// that exists but is an empty string, which `??` would treat as "set" and pass
// straight to `new URL()`, crashing the build. Empty is treated as unset here.
export const siteConfig = {
  name: "Universal Converter",
  tagline: "Convert anything.",
  description:
    "Fast, accurate and free unit conversions for science, engineering, everyday life and more.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  github: "https://github.com/golocal327/universal-converter",
};

export const adsenseConfig = {
  // The site-ownership verification tag Google's AdSense onboarding asks you to
  // paste into <head> ("ca-pub-..."). This is separate from `client` below: the
  // verification tag can be published as soon as the account exists, while
  // `client`/`slots` (which actually turn ad units on) should stay unset until
  // slot IDs exist too. Falls back to the account ID the user provided directly
  // so the tag ships even before NEXT_PUBLIC_ADSENSE_ACCOUNT is set on Vercel.
  account: process.env.NEXT_PUBLIC_ADSENSE_ACCOUNT || "ca-pub-4834969820835281",
  client: process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "",
  slots: {
    top: process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP ?? "",
    content: process.env.NEXT_PUBLIC_ADSENSE_SLOT_CONTENT ?? "",
    afterConverter: process.env.NEXT_PUBLIC_ADSENSE_SLOT_AFTER_CONVERTER ?? "",
    sidebar: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR ?? "",
    beforeFaq: process.env.NEXT_PUBLIC_ADSENSE_SLOT_BEFORE_FAQ ?? "",
    bottom: process.env.NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM ?? "",
  },
  get enabled() {
    return Boolean(this.client);
  },
};

export const analyticsConfig = {
  gaId: process.env.NEXT_PUBLIC_GA_ID ?? "",
  get enabled() {
    return Boolean(this.gaId);
  },
};
