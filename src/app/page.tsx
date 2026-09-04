import type { Metadata } from "next";
import { Hero } from "@/components/nexus/hero";
import { Marquee } from "@/components/nexus/marquee";
import { Manifesto } from "@/components/nexus/manifesto";
import { DepartmentsSection } from "@/components/nexus/departments-section";
import { Process } from "@/components/nexus/process";
import { Faq } from "@/components/nexus/faq";
import { CtaBand } from "@/components/nexus/cta-band";
import { getDepartment } from "@/lib/departments";

/** Structured data so search engines rich-render the drive. */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: "NEXUS - Student Tech Collective, VIT Chennai",
  url: "https://nexus.runs-on.dev",
  description:
    "Student tech collective at VIT Chennai. Recruitments '26 are open for the Technical, Management and Design & Social Media departments.",
  department: [
    { "@type": "OrganizationDepartment", name: "Technical" },
    { "@type": "OrganizationDepartment", name: "Management" },
    { "@type": "OrganizationDepartment", name: "Design and Social Media" },
  ],
};

/**
 * Domain-scoped unfurls: sharing /?dept=aiml (the dept-card copy-link target)
 * renders that domain's own OG card instead of the generic drive banner.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string }>;
}): Promise<Metadata> {
  const { dept: deptParam } = await searchParams;
  const dept = getDepartment(deptParam ?? "");

  if (!dept) {
    return {};
  }

  const title = `NEXUS '26 - ${dept.name}`;
  const description = `${dept.tagline}. Apply to the ${dept.name} domain of NEXUS - the Student Tech Collective at VIT Chennai.`;
  const image = `/api/og/dept/${dept.id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/?dept=${dept.id}`,
      images: [{ url: image, width: 1200, height: 630, alt: `${dept.name} - NEXUS Recruitments '26 domain card` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // static object - no user input, safe to inline
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero />
      <Marquee />
      <Manifesto />
      <DepartmentsSection />
      <Process />
      <Faq />
      <CtaBand />
    </>
  );
}
