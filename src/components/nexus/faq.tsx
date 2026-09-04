"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionHeading } from "./section-heading";
import { DRIVE_DEADLINE } from "@/lib/drive";

const FAQS = [
  {
    q: "Who can apply?",
    a: "Any VIT Chennai student with an active vitstudent.ac.in email. Your sign-in email must match the pattern firstname.lastnameYYYY@vitstudent.ac.in - every year is welcome, from freshers to final-years.",
  },
  {
    q: "Why do I only see my email, name and year pre-filled?",
    a: "Because identity is derived from your email, not typed by hand. We parse firstname.lastnameYYYY from your VIT email to build your name and year of study - fewer typos, no fake identities, faster review.",
  },
  {
    q: "Can I apply to more than one department?",
    a: "One application, one department - depth beats breadth. Pick the domain you'd actually grind in. If you have a strong secondary interest, mention it inside your answers; cross-domain collaborators are loved.",
  },
  {
    q: "What if my browser crashes mid-form?",
    a: "Nothing is lost. Every keystroke auto-saves to your device (localStorage) and is mirrored to the server as you type. Reopen the page and your draft returns with a DRAFT_RECOVERED banner. You can also discard it manually.",
  },
  {
    q: "What happens after I submit?",
    a: "Your status goes to PENDING_REVIEW. Domain leads screen every answer, shortlisted builders get an interview call, and results roll out before onboarding. You'll see your application ID on submission - quote it in any queries.",
  },
  {
    q: "Can I edit my application after submitting?",
    a: `Yes - until the drive closes on ${DRIVE_DEADLINE.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} at 23:59 IST. Re-open the form, update your answers and re-submit; the new version overwrites the old one.`,
  },
];

export function Faq() {
  return (
    <section id="faq" className="border-b border-border grid-backdrop" aria-label="Frequently asked questions">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <SectionHeading
          index="04"
          tag="FAQ.DAT"
          title={
            <>
              Signals before you <span className="text-primary glow-soft">transmit</span>
            </>
          }
        />
        <Accordion type="single" collapsible className="w-full max-w-3xl border border-border">
          {FAQS.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-border">
              <AccordionTrigger className="px-4 py-4 text-left font-mono text-[13px] tracking-wide hover:text-primary hover:no-underline [&[data-state=open]>span>svg]:text-primary">
                <span className="flex items-baseline gap-2 text-left">
                  <span className="shrink-0 text-primary/70">
                    {String(i).padStart(2, "0")} $
                  </span>
                  <span>{item.q}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pl-10 font-sans text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
