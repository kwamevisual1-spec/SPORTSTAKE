import { useState, type ReactNode } from "react";
import { COMPANY } from "../config";
import { Sheet } from "./ui";

export type InfoPage = "about" | "terms" | "faq" | "rg" | "app";

const TITLES: Record<InfoPage, string> = {
  about: "About SportStake",
  terms: "Terms & Privacy",
  faq: "FAQs",
  rg: "Responsible Gambling",
  app: "Get the App",
};

const H = ({ children }: { children: ReactNode }) => <h4 className="mb-1 mt-4 text-[13.5px] font-black text-brand-ink first:mt-0">{children}</h4>;
const P = ({ children }: { children: ReactNode }) => <p className="text-[12.5px] font-medium leading-relaxed text-brand-ink/65">{children}</p>;

const FAQ: [string, string][] = [
  ["Which currencies do you support?", "Ghana cedis (GHS) and Nigerian naira (NGN). You choose one when you register. All your balances, bets and winnings are shown in that currency only."],
  ["Can I change my currency later?", "No. For security and accurate accounting your wallet currency is fixed at registration. If you need the other currency, register a separate account with a different phone number and email."],
  ["I forgot my password. What do I do?", "Tap Forgot Password on the login page, enter your email and we will send you a link to set a new password."],
  ["How do booking codes work?", "Tap Share Bet on your betslip to get a code. Anyone can enter it under Load Code to load the same selections and stake from their own account."],
  ["How does Cash Out work?", "Open My Bets. When Cash Out is available on an open bet, tap it to settle the bet early for the amount shown."],
  ["How old do I have to be?", "You must be 18 or older to register and play."],
];

function Content({ page }: { page: InfoPage }) {
  switch (page) {
    case "about":
      return (
        <div className="space-y-2">
          <P>SportStake is an online sports betting and casino platform for players in Ghana and Nigeria.</P>
          <H>What you can do</H>
          <P>Bet on football and basketball, play virtual sports, try our Aviator and Mini Mines games, and share booking codes with friends.</P>
          <H>Your wallet</H>
          <P>Choose Ghana cedis (GHS) or Nigerian naira (NGN) when you register. Your account uses that one currency everywhere.</P>
          <H>Play responsibly</H>
          <P>Betting should be fun. Only stake what you can afford to lose, and never chase losses.</P>
        </div>
      );
    case "terms":
      return (
        <div>
          <H>1. Eligibility</H>
          <P>You must be at least 18 years old and legally allowed to gamble where you live. You may hold one account only, and the details you give must be accurate.</P>
          <H>2. Your account</H>
          <P>You are responsible for keeping your password safe and for all activity on your account. Your wallet currency (GHS or NGN) is set at registration and cannot be changed.</P>
          <H>3. Deposits and withdrawals</H>
          <P>Deposits and withdrawals are made in your account currency. We may ask you to verify your identity before a withdrawal.</P>
          <H>4. Bets</H>
          <P>Odds can change until your bet is accepted. Bets are settled using the official result of the event. Maximum stakes and payouts apply and are shown on the betslip.</P>
          <H>5. Fair play</H>
          <P>Fraud, abuse, multiple accounts and attempts to exploit errors may lead to bets being voided and accounts being closed.</P>
          <H>6. Privacy</H>
          <P>We collect your phone number, email address, currency, and your betting and transaction history to run your account, prevent fraud and meet legal duties. We do not sell your personal data. You can ask us to correct or delete your data, subject to legal record-keeping rules.</P>
          <H>7. Changes</H>
          <P>We may update these terms. Continuing to use SportStake after a change means you accept the updated terms.</P>
        </div>
      );
    case "faq":
      return (
        <div className="divide-y divide-black/[0.07]">
          {FAQ.map(([q, a]) => (
            <div key={q} className="py-3 first:pt-0">
              <p className="text-[13px] font-black text-brand-ink">{q}</p>
              <p className="mt-1 text-[12.5px] font-medium leading-relaxed text-brand-ink/65">{a}</p>
            </div>
          ))}
        </div>
      );
    case "rg":
      return (
        <div className="space-y-2">
          <P>Gambling is strictly for persons aged 18 and above. Please gamble responsibly. Gambling can be addictive.</P>
          <H>Stay in control</H>
          <ul className="list-disc space-y-1 pl-5 text-[12.5px] font-medium leading-relaxed text-brand-ink/65">
            <li>Set a budget before you play and stick to it.</li>
            <li>Never bet money you need for rent, food, school fees or bills.</li>
            <li>Do not chase losses. Take regular breaks.</li>
            <li>Never gamble when angry, upset or under the influence.</li>
            <li>Keep track of the time and money you spend.</li>
          </ul>
          <H>Warning signs</H>
          <P>Hiding your gambling, borrowing to gamble, or feeling anxious when you are not betting are signs of a problem.</P>
          <H>Need a break?</H>
          <P>You can ask support to set deposit limits or to close your account for a period. If gambling is affecting your life, please talk to someone you trust or a professional counsellor.</P>
          {COMPANY.supportEmail || COMPANY.supportPhone ? (
            <P>
              Support: {COMPANY.supportEmail} {COMPANY.supportPhone}
            </P>
          ) : null}
        </div>
      );
    case "app":
      return (
        <div className="space-y-2">
          <P>SportStake works in your phone browser and can be added to your home screen like an app.</P>
          <H>iPhone (Safari)</H>
          <P>Tap the Share button, then “Add to Home Screen”, then “Add”.</P>
          <H>Android (Chrome)</H>
          <P>Tap the ⋮ menu, then “Install app” or “Add to Home screen”.</P>
        </div>
      );
  }
}

export function InfoSheet({ page, onClose }: { page: InfoPage; onClose: () => void }) {
  return (
    <Sheet z="z-[98]" title={TITLES[page]} onClose={onClose}>
      <div className="p-4 pb-8">
        <Content page={page} />
      </div>
    </Sheet>
  );
}

/** Footer used on the registration page and the home page. */
export function SiteFooter({ className = "" }: { className?: string }) {
  const [page, setPage] = useState<InfoPage | null>(null);
  const licensed = COMPANY.legalName && COMPANY.regulator;
  const links: [string, InfoPage][] = [
    ["About", "about"],
    ["T&Cs", "terms"],
    ["FAQS", "faq"],
    ["Responsible Gambling", "rg"],
    ["App", "app"],
  ];

  return (
    <footer className={`bg-white px-5 pb-8 pt-6 ${className}`}>
      <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
        {links.map(([label, p]) => (
          <button key={p} onClick={() => setPage(p)} className="text-[14px] font-semibold text-brand-ink/80 underline-offset-4 hover:underline">
            {label}
          </button>
        ))}
      </nav>

      {licensed ? (
        <p className="mt-5 text-[13px] font-medium leading-relaxed text-brand-ink/65">
          {COMPANY.brand} is officially the trading name of {COMPANY.legalName}, a company licensed by {COMPANY.regulator}
          {COMPANY.law ? ` under ${COMPANY.law}` : ""}.
          {COMPANY.licences.length ? ` ${COMPANY.licences.map((l) => `${l.label} ${l.number}`).join(", ")}.` : ""}
        </p>
      ) : null}

      <div className="mt-5 flex items-start gap-3">
        <p className="flex-1 text-[13px] font-medium leading-relaxed text-brand-ink/65">
          Players must be 18 or older. Be Responsible.
          <br />
          The addiction to gambling can cause psychological harm.
        </p>
        <span aria-label="18 plus" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-[2.5px] border-brand-ink text-[13px] font-black text-brand-ink">
          18+
        </span>
      </div>

      <p className="mt-6 text-[13px] font-medium text-brand-ink/65">
        © {new Date().getFullYear()} {COMPANY.brand}. All rights reserved.
      </p>

      {page ? <InfoSheet page={page} onClose={() => setPage(null)} /> : null}
    </footer>
  );
}
