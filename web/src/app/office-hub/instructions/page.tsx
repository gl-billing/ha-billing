"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { FirmBrandHeader } from "@/components/FirmBrandHeader";
import { FirmCopyright } from "@/components/FirmCopyright";
import { SameWindowLink } from "@/components/SameWindowLink";
import { firmAppHref } from "@/lib/firm-apps";
import { formatStaffDisplayName } from "@/lib/user-display";

function InstructionsQuestion({
  id,
  question,
  children
}: {
  id: string;
  question: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="office-hub-instructions__card">
      <h2 className="office-hub-instructions__question">{question}</h2>
      <div className="office-hub-instructions__answer">{children}</div>
    </section>
  );
}

function InstructionsOptions({ children }: { children: ReactNode }) {
  return <div className="office-hub-instructions__options">{children}</div>;
}

function InstructionsOption({
  label,
  title,
  children,
  recommended
}: {
  label: string;
  title: string;
  children: ReactNode;
  recommended?: boolean;
}) {
  return (
    <div className="office-hub-instructions__option">
      <h3 className="office-hub-instructions__option-heading">
        {label} — {title}
        {recommended ? (
          <span className="office-hub-instructions__option-badge">Recommended</span>
        ) : null}
      </h3>
      {children}
    </div>
  );
}

function InstructionsTip({ children }: { children: ReactNode }) {
  return <p className="office-hub-instructions__note">{children}</p>;
}

export default function OfficeHubInstructionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const billingAccess = session?.user?.billingAccess !== false;
  const displayLabel =
    formatStaffDisplayName(session?.user?.name, session?.user?.email) || "team";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="office-hub office-hub--loading">
        <p className="office-hub__loading-text">Loading instructions…</p>
      </div>
    );
  }

  return (
    <div className="office-hub">
      <div className="office-hub__shell">
        <FirmBrandHeader
          className="office-hub__header"
          subtitle="Instructions · staff guide"
          name={session?.user?.name}
          email={session?.user?.email}
          displayName={displayLabel}
          billingAccess={billingAccess}
        />

        <main className="office-hub__main office-hub__main--instructions">
          <SameWindowLink href="/office-hub" className="office-hub-instructions__back">
            ← Back to Office Hub
          </SameWindowLink>

          <h1 className="office-hub-instructions__title">HA Office — staff guide</h1>
          <p className="office-hub-instructions__lead">
            Common questions about Tasks &amp; calendar, billing, and client matters. Sign in once with your firm
            Google account. Use <strong>Office hub</strong> in the header to switch between Tasks and Billing without
            signing out again.
          </p>

          <section id="cheatsheet" className="office-hub-instructions__card office-hub-instructions__cheatsheet">
            <h2 className="office-hub-instructions__question">Quick cheat sheet — Andrea &amp; Jas</h2>
            <p className="office-hub-instructions__cheatsheet-lead">
              Print or keep this open on a second tab. Full explanations are in the questions below.
            </p>

            <div className="office-hub-instructions__cheatsheet-grid">
              <div className="office-hub-instructions__cheatsheet-block">
                <h3>Every morning (both)</h3>
                <ol>
                  <li>
                    <SameWindowLink href={firmAppHref("/app?tab=today")}>Tasks → My work</SameWindowLink> → clear{" "}
                    <strong>Overdue</strong> first
                  </li>
                  <li>
                    Tap 🔔 bell → work through overdue tasks &amp; hearings
                  </li>
                  <li>Mark <strong>Done</strong> or <strong>Submitted</strong> when finished</li>
                </ol>
              </div>

              <div className="office-hub-instructions__cheatsheet-block">
                <h3>Task or Event?</h3>
                <p>
                  <strong>Event (+ Event)</strong> — on the calendar: hearing, consultation, meeting, filing/submission
                  deadline, drafting deadline.
                </p>
                <p>
                  <strong>Task (+ Task)</strong> — to-do with a due date: serve letter, go to court/agency, follow-up,
                  research, errands.
                </p>
                <p>
                  <em>Not interchangeable — pick the form that matches the work.</em>
                </p>
              </div>

              <div className="office-hub-instructions__cheatsheet-block">
                <h3>Andrea — desk &amp; billing</h3>
                <p className="office-hub-instructions__note">
                  Sign in as <strong>info@hernandezassociates.com</strong> for the simplified desk view — core tabs only
                  (no Week, Team, Tools, Reports, or History).
                </p>
                <ul>
                  <li>
                    <strong>Walk-in</strong> → Billing → Walk-ins (Bill now if paid today)
                  </li>
                  <li>
                    <strong>New retained client</strong> → Billing → Intake (not Walk-ins)
                  </li>
                  <li>
                    <strong>Consultation only</strong> → Walk-in + plot Event; no Intake yet
                  </li>
                  <li>
                    <strong>Client hires firm</strong> → Walk-ins → Promote
                  </li>
                  <li>
                    <strong>Charge / payment</strong> → Option A: Billing → Billing tab
                  </li>
                  <li>
                    <strong>SOA / AR</strong> → matter page Step 3 (or Billing → SOA / AR)
                  </li>
                </ul>
              </div>

              <div className="office-hub-instructions__cheatsheet-block">
                <h3>Jas — calendar &amp; field</h3>
                <ul>
                  <li>
                    <strong>Hearing / consultation / deadline</strong> → Tasks → + Event
                  </li>
                  <li>
                    <strong>Go to court, serve papers, follow-up</strong> → Tasks → + Task
                  </li>
                  <li>
                    Turn on <strong>Calendar sync</strong> for Google Calendar when needed
                  </li>
                  <li>
                    <strong>Started</strong> on overdue = finish within 7 days of date assigned
                  </li>
                  <li>
                    <strong>Waiting</strong> = client has not replied yet; keep on list
                  </li>
                </ul>
              </div>

              <div className="office-hub-instructions__cheatsheet-block office-hub-instructions__cheatsheet-block--wide">
                <h3>Office procedures</h3>
                <p>
                  <strong>App / system</strong> → Atty. Janine · <strong>Files / SOA / walk-ins</strong> → Andrea + assigned
                  attorney · <strong>Calendar / hearings / field</strong> → Jas + assigned attorney
                </p>
              </div>
            </div>
          </section>

          <section className="office-hub-instructions__card">
            <h2 className="office-hub-instructions__question">Jump to a question</h2>
            <nav className="office-hub-instructions__toc" aria-label="Questions">
              <a href="#cheatsheet">Quick cheat sheet</a>
              <a href="#roles">Who does what on the team?</a>
              <a href="#daily">What should I do first each morning?</a>
              <a href="#bell">What does the bell show?</a>
              <a href="#tasks-tabs">What are the Tasks &amp; calendar tabs for?</a>
              <a href="#billing-tabs">What are the Billing system tabs for?</a>
              <a href="#matter">How do I use the client matter page?</a>
              <a href="#consultation">How do I handle consultations and walk-ins?</a>
              <a href="#task-vs-event">What is the difference between a task and an event?</a>
              <a href="#hearings">How do I plot a task or event?</a>
              <a href="#charges">How do I add a charge?</a>
              <a href="#payment">How do I record a payment?</a>
              <a href="#soa">How do I send an SOA?</a>
              <a href="#ar">How do I send an AR?</a>
              <a href="#admin">What are Advanced settings?</a>
              <a href="#help">Who do I contact for help?</a>
            </nav>
          </section>

          <InstructionsQuestion id="roles" question="Who does what on the team?">
            <p>
              HA Office is shared — everyone signs in with their firm Google account. Knowing who usually handles what
              helps you know who to coordinate with and what to plot on the calendar vs record in billing.
            </p>
            <ul>
              <li>
                <strong>Andrea — secretary.</strong> Client intake and walk-ins, consultation logging, SOA/AR,
                calendar coordination, and promoting walk-ins to client files when a matter is retained.
              </li>
              <li>
                <strong>James Bryan — liaison officer.</strong> Plots hearings, consultations, and tasks on the
                calendar; updates status and follow-ups; court liaison and field coordination with the assigned
                attorney.
              </li>
              <li>
                <strong>Attorneys.</strong> Client strategy, approvals, and assigned matters. Assigned attorney is
                shown on each client profile.
              </li>
              <li>
                <strong>Firm admins</strong> (listed in server settings) see{" "}
                <strong>Advanced settings</strong> on a client matter — edit client details, void ledger lines,
                rename code, close/reopen file, or permanently delete a client.
              </li>
            </ul>
            <InstructionsTip>
              <strong>Tip:</strong> The assigned attorney on each client profile is the lead on that matter. Andrea and
              Jas handle day-to-day plotting and desk work; attorneys approve strategy and sign off on major steps.
            </InstructionsTip>
          </InstructionsQuestion>

          <InstructionsQuestion id="daily" question="What should I do first each morning?">
            <p>
              The firm task sheet drives the bell, My work, and overdue counts. If overdue items pile up, the whole team
              loses visibility on what is urgent. Start every day by clearing or updating overdue work before new entries.
            </p>
            <ol>
              <li>
                Open <SameWindowLink href={firmAppHref("/app?tab=today")}>Tasks → My work</SameWindowLink> every
                morning. Work the <strong>Overdue</strong> section before anything else.
              </li>
              <li>
                Check the <strong>bell</strong> in the top header — it lists all overdue tasks and hearings
                firm-wide.
              </li>
              <li>
                If an overdue item truly cannot be finished today, open the ⋯ menu on the item and set status to{" "}
                <strong>Started</strong>. You must complete it within <strong>7 calendar days from the task&apos;s
                date assigned</strong> (creation date on the sheet). Do not leave it Started indefinitely.
              </li>
              <li>
                Items marked <strong>Waiting</strong> stay on your follow-up list until the client responds — they
                are not treated as done.
              </li>
              <li>
                Mark <strong>Done</strong> (or <strong>Submitted</strong> for filings) as soon as work is finished so
                the team sees accurate counts.
              </li>
            </ol>
            <InstructionsTip>
              <strong>Statuses in plain terms:</strong> <strong>Done</strong> = finished. <strong>Submitted</strong> =
              filed with the court/agency. <strong>Waiting</strong> = blocked on the client. <strong>Started</strong> =
              in progress but was overdue — you have 7 days from the date assigned to finish it.
            </InstructionsTip>
          </InstructionsQuestion>

          <InstructionsQuestion id="bell" question="What does the bell show?">
            <p>
              The bell is a firm-wide overdue list — not billing alerts. It pulls from the same task sheet as Tasks → My
              work, so anything red on the bell should be worked or updated that day.
            </p>
            <p>
              The 🔔 in the brand header (next to your name) opens a list of <strong>overdue tasks and hearings</strong>{" "}
              pulled from the office task sheet. The red badge shows how many are open.
            </p>
            <ul>
              <li>Tap an item to open that client&apos;s matter page (or Tasks if there is no billing file).</li>
              <li>Clear overdue items by completing work and updating status — the bell refreshes when you reopen it.</li>
            </ul>
            <InstructionsTip>
              The badge number goes down only when you complete work and update the item&apos;s status — not when you
              simply open or read the item.
            </InstructionsTip>
          </InstructionsQuestion>

          <InstructionsQuestion id="tasks-tabs" question="What are the Tasks & calendar tabs for?">
            <p>
              Tasks &amp; calendar is where Jas plots hearings and deadlines and where everyone checks what is due. Think
              of it as the firm&apos;s shared to-do and calendar board. Billing lives in a separate app — use Office hub
              in the header to switch.
            </p>
            <p>
              Open from Office Hub → <strong>Tasks &amp; calendar</strong> or the header link. Tabs are along the top
              of the page.
            </p>

            <h3>What is My work?</h3>
            <p>
              Your personal board for today: overdue (first), waiting/started, due today, and this week. Use{" "}
              <strong>Print</strong> for a paper copy. A billing strip (follow-ups, overdue SOA) may appear here when
              relevant.
            </p>
            <InstructionsTip>
              If you only open one tab each day, make it <strong>My work</strong> — overdue is always at the top.
            </InstructionsTip>

            <h3>What is Calendar?</h3>
            <p>
              Month view of hearings, deadlines, and dated tasks. Click a day to see what is scheduled. Good for seeing
              the big picture — e.g. how many hearings are in a week.
            </p>

            <h3>What is Week?</h3>
            <p>
              Seven-day planner — use for hearings, deadlines, and firm planning. Helpful when coordinating with Jas or
              prepping for a busy week.
            </p>

            <h3>When do I use + Task vs + Event?</h3>
            <p>
              These are <strong>not</strong> two ways to do the same thing — pick the one that matches the work. See{" "}
              <a href="#task-vs-event">What is the difference between a task and an event?</a> for a full list, then{" "}
              <a href="#hearings">How do I plot a task or event?</a> for steps.
            </p>
            <p>
              <strong>+ Task</strong> — office or field work assigned to someone with a due date (serve demand letter,
              go to a court or agency, follow-ups, research, admin).
            </p>
            <p>
              <strong>+ Event</strong> — something on the calendar with a date and time (hearing, consultation,
              meeting, court filing deadline, submission deadline, drafting/submission of pleadings).
            </p>

            <h3>What is All items?</h3>
            <p>
              Search and browse every open task and event. Use the search bar (or ⌘K / Ctrl+K) to find a client, code,
              or keyword. Click a client/case name to open the matter view.
            </p>

            <h3>What is Team?</h3>
            <p>Workload by staff member — who has how many open, overdue, and due-this-week items.</p>

            <h3>What is History?</h3>
            <p>Recently completed items for reference.</p>

            <h3>What is Tools?</h3>
            <p>
              Refresh sheet views, sync Google Calendar, print lists, BIR tax deadlines, and (admins only) staff reminder
              emails. Use when maintaining the calendar or running firm-wide tools.
            </p>
          </InstructionsQuestion>

          <InstructionsQuestion id="billing-tabs" question="What are the Billing system tabs for?">
            <p>
              Billing system is where Andrea records money in and out, opens new client files, and sends SOA/AR. Most
              tabs are for a specific job — use the cheat sheet above if you are unsure which tab to open.
            </p>
            <p>
              Open from Office Hub → <strong>Billing system</strong>. For charges and payments, the{" "}
              <strong>Billing</strong> tab is Option A — you can also use the{" "}
              <a href="#matter">client matter page</a> (Option B).
            </p>

            <h3>What is the Billing tab?</h3>
            <p>
              Quick ledger form: switch <strong>Add Charge</strong> or <strong>Add Payment</strong>, pick client code,
              enter amount and details. This is Option A for daily charge and payment entry — see{" "}
              <a href="#charges">How do I add a charge?</a> and <a href="#payment">How do I record a payment?</a>.
            </p>

            <h3>When do I use Intake?</h3>
            <p>
              Register a <strong>new retained client</strong>: wizard for code, name, case title, contact info,
              conflict check, and optional engagement letter. Creates the billing sheet tab and starter tasks. Use
              for full matters — not for same-day walk-in consultations (use Walk-ins).
            </p>
            <InstructionsTip>
              <strong>Walk-in vs Intake:</strong> Walk-in = person came today, may or may not hire the firm. Intake =
              client has decided to retain counsel and needs a full file and billing code.
            </InstructionsTip>

            <h3>When do I use Walk-ins?</h3>
            <p>
              Same-day consultations and one-off visitors. Log name and topic; optionally bill consultation fee
              immediately. <strong>Promote</strong> to a full client file when the matter is retained. See{" "}
              <a href="#consultation">How do I handle consultations and walk-ins?</a>.
            </p>

            <h3>What is Client Directory?</h3>
            <p>Open any client&apos;s billing file — click code or name to go to the matter page.</p>

            <h3>When do I use SOA / AR?</h3>
            <p>
              Generate statement of account or acknowledgment receipt when you are not already on the matter page.
              Normally use the matter page → <strong>Send SOA or AR</strong> instead.
            </p>

            <h3>What is Firm overview?</h3>
            <p>Firm-wide totals, batch SOA, document log, and aging overview — not for single-client daily entry.</p>

            <h3>What is History?</h3>
            <p>Billing audit / document history across clients.</p>

            <h3>What is Reports?</h3>
            <p>Export and reporting tools for partners and admin.</p>
          </InstructionsQuestion>

          <InstructionsQuestion id="matter" question="How do I use the client matter page?">
            <p>
              The matter page is one stop for a single client: profile, balance, billing steps, tasks, hearings, and
              timeline. Andrea often uses it for SOA/AR and reviewing a file; Jas uses it to see what is open on that
              client. You can open it two ways:
            </p>
            <InstructionsOptions>
              <InstructionsOption label="Option A" title="Search the client code" recommended>
                <ol>
                  <li>
                    Type the code (e.g. <strong>BACUS</strong>) in the search bar under the header.
                  </li>
                  <li>Press Enter or pick the client from the results.</li>
                </ol>
              </InstructionsOption>
              <InstructionsOption label="Option B" title="Client Directory">
                <ol>
                  <li>
                    Open <strong>Billing system → Client Directory</strong>.
                  </li>
                  <li>Click the client code or name to open the matter page.</li>
                </ol>
              </InstructionsOption>
            </InstructionsOptions>
            <p>Once open, the page is one long scroll — top to bottom:</p>
            <ul>
              <li>
                <strong>Client profile</strong> — code, name, case title, balance, contact, open task counts.
              </li>
              <li>
                <strong>What do you need to do?</strong> — shortcuts to add billing or send documents.
              </li>
              <li>
                <strong>Step 1</strong> — add charge or payment inline.
              </li>
              <li>
                <strong>Step 2</strong> — billing history (read-only for staff; admins can edit/void in Advanced
                settings).
              </li>
              <li>
                <strong>Step 3</strong> — send SOA or AR by email.
              </li>
              <li>Payment request link and client portal link when balance is due.</li>
              <li>
                Collapsible <strong>Tasks</strong> and <strong>Hearings &amp; events</strong> columns for this client.
              </li>
              <li>Matter timeline — billing, documents, tasks, and hearings in one feed.</li>
            </ul>
            <InstructionsTip>
              <strong>Step 1 vs Billing tab:</strong> Both record charges and payments the same way. Option A is Billing
              → Billing tab; Option B is search the client and use Step 1 on the matter page. Use whichever you have open
              already.
            </InstructionsTip>
          </InstructionsQuestion>

          <InstructionsQuestion id="consultation" question="How do I handle consultations and walk-ins?">
            <p>
              Consultations are usually Andrea&apos;s desk workflow; Jas plots them on the calendar so the team sees
              date and time. A walk-in who has not hired the firm yet stays on Walk-ins — do not run Intake until they
              retain.
            </p>

            <h3>How do I plot a consultation for a client already on file?</h3>
            <p>
              A consultation is an <strong>event</strong> — use <strong>Tasks → + Event</strong>, not + Task.
            </p>
            <ol>
              <li>
                Open <strong>Tasks → + Event</strong>.
              </li>
              <li>
                In <strong>Client / case</strong>, select the existing client from the Master List dropdown.
              </li>
              <li>
                Category: <strong>Consultation</strong>. Set event date, time, responsible person, and notes.
              </li>
              <li>
                If a fee is collected at the desk, record it — see{" "}
                <a href="#payment">How do I record a payment?</a> or <a href="#charges">How do I add a charge?</a>.
              </li>
            </ol>

            <h3>How do I handle a walk-in who is not yet a client file?</h3>
            <p>
              Log them first so the consultation is on record even if they do not hire the firm. You can log a walk-in
              two ways:
            </p>
            <InstructionsOptions>
              <InstructionsOption label="Option A" title="Billing → Walk-ins" recommended>
                <ol>
                  <li>
                    Open <strong>Billing → Walk-ins</strong>.
                  </li>
                  <li>Add name, consultation topic, and phone/email.</li>
                  <li>
                    Turn on <strong>Bill now</strong> if they pay today (see payment below).
                  </li>
                </ol>
              </InstructionsOption>
              <InstructionsOption label="Option B" title="Tasks → + Event">
                <ol>
                  <li>
                    Open <strong>Tasks → + Event</strong>.
                  </li>
                  <li>
                    Under <strong>Client / case</strong>, choose <strong>+ Add walk-in consultation</strong>.
                  </li>
                  <li>Fill name and topic, then save — the walk-in is created automatically.</li>
                </ol>
              </InstructionsOption>
            </InstructionsOptions>
            <p>
              When they retain the firm: <strong>Walk-ins → Promote</strong> — enter new client code, name, and case
              title. The system opens the full matter page.
            </p>

            <h3>How does payment work at consultation?</h3>
            <p>
              Record payment as soon as money is received so the ledger matches the desk. If they pay only part of the
              fee, add the charge first, then record the payment for the amount received.
            </p>
            <ul>
              <li>
                <strong>Walk-in, paid on the spot:</strong> On Walk-ins form, enable <strong>Bill now</strong> — enter
                service type (e.g. Professional Fee), charge amount, payment amount, and method (Cash, GCash, etc.).
                Status shows paid vs unpaid.
              </li>
              <li>
                <strong>Walk-in, bill later:</strong> Save without Bill now, or use <strong>Bill</strong> on the row
                when they pay.
              </li>
              <li>
                <strong>Existing client:</strong> Record payment via Billing or the matter page — see{" "}
                <a href="#payment">How do I record a payment?</a>. For partial pay, add the charge first. Send{" "}
                <strong>AR</strong> after payment.
              </li>
              <li>
                <strong>Payment link:</strong> On the matter page, use Payment request to email a secure pay link
                (GCash / bank instructions).
              </li>
            </ul>

            <h3>What if it is consultation only — no retention yet?</h3>
            <p>
              Keep them as a <strong>walk-in</strong> only. Plot the consultation on the calendar (Category:
              Consultation). Record the consultation fee if paid. Do <strong>not</strong> run full Intake until the
              client decides to hire the firm.
            </p>

            <h3>What if they need a consultation plus a demand letter?</h3>
            <ol>
              <li>
                Plot the <strong>consultation</strong> as an <strong>event</strong> (+ Event → Category: Consultation).
              </li>
              <li>
                Plot <strong>drafting the demand letter / pleading</strong> as an <strong>event</strong> (+ Event →
                Category: <strong>Submission</strong> or <strong>Court Filing</strong>, or related submission
                category) with the drafting deadline on the calendar.
              </li>
              <li>
                Plot <strong>serving the demand letter</strong> as a <strong>task</strong> (+ Task → e.g.{" "}
                <strong>Court Follow-up</strong> or <strong>Task</strong>) — assign who will go out or send it, with a
                due date.
              </li>
              <li>Bill the professional fee if not yet charged — see <a href="#charges">How do I add a charge?</a>.</li>
              <li>
                Optional: add a <strong>Client Follow-up</strong> <strong>task</strong> to track the client&apos;s
                response after sending.
              </li>
            </ol>
          </InstructionsQuestion>

          <InstructionsQuestion id="task-vs-event" question="What is the difference between a task and an event?">
            <p>
              This is the most common mix-up. A <strong>task</strong> and an <strong>event</strong> are not two ways to
              enter the same thing — they are two different kinds of work. Pick the form first, then fill it in.
            </p>
            <p>
              Ask yourself: <em>Does the team need to see this on the calendar at a specific date or time?</em> If yes →{" "}
              <strong>+ Event</strong>. If it is action work assigned to someone with a due date but no fixed appointment
              → <strong>+ Task</strong>.
            </p>
            <p>
              Before plotting anything, decide whether it is a <strong>task</strong> or an <strong>event</strong>. They
              use different forms (<strong>+ Task</strong> vs <strong>+ Event</strong>) and show up differently on the
              calendar and My work board.
            </p>

            <div className="office-hub-instructions__kind office-hub-instructions__kind--task">
              <h3>Use + Task for</h3>
              <p>Work assigned to a person with a due date — usually office or field action, not a calendar appointment.</p>
              <ul>
                <li>Serving demand letters and other documents</li>
                <li>Going to court, registries, or government agencies (follow-up, filing trip, pickup)</li>
                <li>Client follow-up (call, email, chase documents)</li>
                <li>Court follow-up and liaison work in the field</li>
                <li>Research, admin, and internal office work</li>
                <li>Any errand or action item without a fixed calendar time slot</li>
              </ul>
              <p>
                Common task types: <strong>Task</strong>, <strong>Client Follow-up</strong>,{" "}
                <strong>Court Follow-up</strong>, <strong>Research</strong>, <strong>Administrative</strong>,{" "}
                <strong>Other</strong>.
              </p>
            </div>

            <div className="office-hub-instructions__kind office-hub-instructions__kind--event">
              <h3>Use + Event for</h3>
              <p>Something scheduled on the calendar — a date, and usually a time, that the team needs to see at a glance.</p>
              <ul>
                <li>Hearings</li>
                <li>Consultations and client meetings</li>
                <li>Internal meetings and client calls</li>
                <li>Court filing deadlines</li>
                <li>Submissions and submission deadlines</li>
                <li>Drafting of pleadings and submission documents (plot the drafting deadline on the calendar)</li>
                <li>Other fixed appointments or deadlines</li>
              </ul>
              <p>
                Common event categories: <strong>Hearing</strong>, <strong>Consultation</strong>,{" "}
                <strong>Meeting</strong>, <strong>Client Call</strong>, <strong>Submission</strong>,{" "}
                <strong>Court Filing</strong>, <strong>Deadline</strong>, <strong>Internal Meeting</strong>,{" "}
                <strong>Other</strong>.
              </p>
            </div>

            <p className="office-hub-instructions__note">
              <strong>Example — demand letter:</strong> consultation = <strong>event</strong>; drafting the pleading =
              <strong> event</strong> (submission deadline); physically serving the letter = <strong>task</strong>.
            </p>
          </InstructionsQuestion>

          <InstructionsQuestion id="hearings" question="How do I plot a task or event?">
            <p>
              After you know task vs event (see above), go to Tasks and open <strong>+ Task</strong> or{" "}
              <strong>+ Event</strong>. Every entry needs a client/case so it links to the right matter and shows on the
              bell and matter page when overdue. Review{" "}
              <a href="#task-vs-event">task vs event</a> first if you are unsure which form to use.
            </p>

            <h3>How do I plot a task (+ Task)?</h3>
            <p>Use when someone needs to <em>do</em> something — go somewhere, send something, follow up, research.</p>
            <ol>
              <li>
                Open <strong>Tasks → + Task</strong>.
              </li>
              <li>Pick client/case, assignee, and due date.</li>
              <li>
                Choose task type — e.g. <strong>Task</strong>, <strong>Client Follow-up</strong>,{" "}
                <strong>Court Follow-up</strong>, <strong>Research</strong>, <strong>Administrative</strong>.
              </li>
              <li>Describe the work in Task description and Next action.</li>
              <li>When finished, set status to <strong>Done</strong>.</li>
            </ol>

            <h3>How do I plot an event (+ Event)?</h3>
            <p>
              Use when something happens <em>on</em> a date — hearing, consultation, meeting, or a deadline the calendar
              should show.
            </p>
            <ol>
              <li>
                Open <strong>Tasks → + Event</strong>.
              </li>
              <li>Pick client/case, event date, and (if applicable) start time.</li>
              <li>Choose category — e.g. <strong>Hearing</strong>, <strong>Consultation</strong>,{" "}
                <strong>Submission</strong>, <strong>Court Filing</strong>, <strong>Meeting</strong>.</li>
              <li>Set responsible person, venue or details, and filing deadline if relevant.</li>
              <li>Turn on <strong>Calendar sync</strong> if it should appear on Google Calendar.</li>
              <li>
                When a filing is complete, set status to <strong>Submitted</strong>; for other events, update status
                when done.
              </li>
            </ol>

            <h3>Examples — which form do I use?</h3>
            <p>When in doubt, match your situation to one of these:</p>
            <ul>
              <li>
                <strong>Hearing on March 12, 9:00 AM, RTC Branch 45</strong> → <strong>Event</strong> (Hearing)
              </li>
              <li>
                <strong>Client consultation Friday 2:00 PM</strong> → <strong>Event</strong> (Consultation)
              </li>
              <li>
                <strong>Deadline to file motion — April 5</strong> → <strong>Event</strong> (Court Filing or
                Submission)
              </li>
              <li>
                <strong>Draft and finalize complaint for submission</strong> → <strong>Event</strong> (Submission —
                drafting deadline on calendar)
              </li>
              <li>
                <strong>Go to RTC to file motion and get OR</strong> → <strong>Task</strong> (Court Follow-up or
                Task)
              </li>
              <li>
                <strong>Serve demand letter to respondent</strong> → <strong>Task</strong> (Task or Court Follow-up)
              </li>
              <li>
                <strong>Follow up client for signed SPA</strong> → <strong>Task</strong> (Client Follow-up)
              </li>
              <li>
                <strong>Research jurisprudence on annulment</strong> → <strong>Task</strong> (Research)
              </li>
            </ul>
          </InstructionsQuestion>

          <InstructionsQuestion id="charges" question="How do I add a charge?">
            <p>
              A charge adds fees to what the client owes (professional fee, filing fee, notarial fee, etc.). Always pick
              the correct client code so the balance on the matter page stays accurate.
            </p>
            <p>You can add a charge two ways:</p>
            <InstructionsOptions>
              <InstructionsOption label="Option A" title="Billing → Billing tab" recommended>
                <ol>
                  <li>
                    Open <strong>Billing system → Billing</strong>.
                  </li>
                  <li>Switch to <strong>Add Charge</strong>.</li>
                  <li>Pick the client code, then enter date, amount, category, and description.</li>
                  <li>Save — the ledger and client balance update.</li>
                </ol>
              </InstructionsOption>
              <InstructionsOption label="Option B" title="Client matter page">
                <ol>
                  <li>Search the client code to open the <strong>matter page</strong>.</li>
                  <li>
                    In Step 1, ensure mode is <strong>Charge</strong> (not Payment).
                  </li>
                  <li>Enter date, amount, category (Professional Fee, Filing Fee, Notarial Fee, etc.), and description.</li>
                  <li>Save — balance updates on the profile and ledger history.</li>
                </ol>
              </InstructionsOption>
            </InstructionsOptions>
            <InstructionsTip>
              Both options update the same ledger. Use Option A from the Billing tab when you are already in Billing; use
              Option B when you already have the client&apos;s matter page open.
            </InstructionsTip>
          </InstructionsQuestion>

          <InstructionsQuestion id="payment" question="How do I record a payment?">
            <p>
              Record a payment when the firm receives money. After saving, send an <strong>AR</strong> if the client
              needs an acknowledgment receipt (see below).
            </p>
            <p>You can record a payment two ways:</p>
            <InstructionsOptions>
              <InstructionsOption label="Option A" title="Billing → Billing tab" recommended>
                <ol>
                  <li>
                    Open <strong>Billing system → Billing</strong>.
                  </li>
                  <li>Switch to <strong>Add Payment</strong>.</li>
                  <li>Pick the client code, then enter date, amount, method, and reference/OR details.</li>
                  <li>Save — send <strong>AR</strong> afterward if the client needs a receipt (see below).</li>
                </ol>
              </InstructionsOption>
              <InstructionsOption label="Option B" title="Client matter page">
                <ol>
                  <li>Search the client code to open the <strong>matter page</strong>.</li>
                  <li>
                    In Step 1, switch to <strong>Payment</strong>.
                  </li>
                  <li>Enter date, amount, method (Cash, GCash, Bank Transfer, Maya, Check), and reference/OR details.</li>
                  <li>
                    Save — then send <strong>AR</strong> from Step 3 if the client needs an acknowledgment receipt.
                  </li>
                </ol>
              </InstructionsOption>
            </InstructionsOptions>
            <InstructionsTip>
              Partial payment? Add the full <strong>charge</strong> first, then record the <strong>payment</strong> for
              the amount actually received. The balance will show what is still due.
            </InstructionsTip>
          </InstructionsQuestion>

          <InstructionsQuestion id="soa" question="How do I send an SOA?">
            <p>
              An SOA (statement of account) tells the client what they owe and what work has been done. Send when billing
              is due or when the client asks for an update. The client needs an email on file for Send Now.
            </p>
            <p>You can send an SOA two ways:</p>
            <InstructionsOptions>
              <InstructionsOption label="Option A" title="Client matter page — Step 3" recommended>
                <ol>
                  <li>Search the client code to open the <strong>matter page</strong>.</li>
                  <li>Go to Step 3 → select <strong>SOA</strong>.</li>
                  <li>Review greeting and optional status report text.</li>
                  <li>
                    Choose <strong>Send Now</strong> to email the client (requires email on file) or generate PDF only.
                  </li>
                  <li>SOA date is logged on the client timeline.</li>
                </ol>
              </InstructionsOption>
              <InstructionsOption label="Option B" title="Billing → SOA / AR tab">
                <ol>
                  <li>
                    Open <strong>Billing system → SOA / AR</strong>.
                  </li>
                  <li>Select the client and <strong>SOA</strong>.</li>
                  <li>Review greeting and optional status report text.</li>
                  <li>Send Now or generate PDF — same result as on the matter page.</li>
                </ol>
              </InstructionsOption>
            </InstructionsOptions>
          </InstructionsQuestion>

          <InstructionsQuestion id="ar" question="How do I send an AR (acknowledgment receipt)?">
            <p>
              An AR confirms payment received. Send one after each payment when the client needs a receipt — usually
              right after recording the payment on the matter page or Billing tab.
            </p>
            <p>You can send an AR two ways:</p>
            <InstructionsOptions>
              <InstructionsOption label="Option A" title="Client matter page — Step 3" recommended>
                <ol>
                  <li>Search the client code to open the <strong>matter page</strong>.</li>
                  <li>Go to Step 3 → <strong>AR</strong> tab.</li>
                  <li>Select the payment row to acknowledge.</li>
                  <li>Confirm method and details → Send Now or PDF.</li>
                  <li>Each payment can only have one AR — system tracks AR pending on the dashboard.</li>
                </ol>
              </InstructionsOption>
              <InstructionsOption label="Option B" title="Billing → SOA / AR tab">
                <ol>
                  <li>
                    Open <strong>Billing system → SOA / AR</strong>.
                  </li>
                  <li>Select the client and <strong>AR</strong>.</li>
                  <li>Select the payment row to acknowledge.</li>
                  <li>Confirm details → Send Now or PDF.</li>
                </ol>
              </InstructionsOption>
            </InstructionsOptions>
          </InstructionsQuestion>

          <InstructionsQuestion id="admin" question="What are Advanced settings?">
            <p>
              Only firm admins see this section. It is for correcting mistakes or closing files — not for everyday
              billing. If you entered a charge wrong and are not an admin, ask Atty. Janine or a firm admin instead of
              trying to work around it.
            </p>
            <p>
              On a client <strong>matter page</strong>, expand the gold box{" "}
              <strong>Advanced settings — edit client, billing lines, delete</strong> (only if your email is an
              admin).
            </p>
            <ul>
              <li>Change client details, contact, case info.</li>
              <li>Close or reopen client file.</li>
              <li>Edit or void incorrect ledger lines.</li>
              <li>Rename client code.</li>
              <li>Permanently delete client (with confirmation — irreversible).</li>
            </ul>
            <p>
              Staff without admin access do not see this section — contact Atty. Janine or a firm admin for
              corrections.
            </p>
          </InstructionsQuestion>

          <InstructionsQuestion id="help" question="Who do I contact for help?">
            <p>Use this list so questions go to the right person the first time:</p>
            <p>
              System access, balances, or how to use the app: contact{" "}
              <strong>Atty. Hernandez & Associates</strong>.
            </p>
            <p>
              Intake, walk-ins, SOA/AR, and client files: <strong>Andrea</strong> (secretary) with the assigned
              attorney.
            </p>
            <p>
              Hearings, consultations on the calendar, and court follow-ups: <strong>James Bryan</strong> (liaison)
              with the responsible attorney and assignee on each task.
            </p>
          </InstructionsQuestion>
        </main>

        <footer className="office-hub__footer">
          <p className="office-hub__footer-brand">Hernandez &amp; Associates · Law Office</p>
          <FirmCopyright className="office-hub__footer-copyright" />
        </footer>
      </div>
    </div>
  );
}
