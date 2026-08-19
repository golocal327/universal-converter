import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { UnixTimestampTool } from "@/components/tools/unix-timestamp-tool";
import { getTool } from "@/lib/content/tools";

const tool = getTool("unix-timestamp")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
  alternates: { canonical: "/tools/unix-timestamp" },
};

export default function UnixTimestampPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Tools", href: "/tools" }, { label: tool.name }]} />
      <h1 className="text-3xl font-semibold tracking-tight">{tool.name}</h1>
      <p className="mt-3 max-w-2xl text-muted">{tool.description}</p>
      <div className="mt-8">
        <UnixTimestampTool />
      </div>
    </div>
  );
}
