import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { cn } from "../utils/cn";
import { ChevronLeft, ChevronRight, CloseIcon, HelpIcon, InfoIcon, LockIcon, RobotIcon, SearchIcon, TicketIcon, WalletIcon } from "./Icons";

/* ---------------- types & help content ---------------- */
type LinkAction = "mybets" | "deposit" | "reset" | "code" | "casino" | "affiliate" | "responsible" | "requests" | "new" | "browse";
type Option = {
  label: string;
  reply?: string;
  options?: Option[];
  action?: LinkAction;
  ticket?: boolean;
  article?: string;
  browse?: boolean;
  icon?: Topic["icon"];
};
type TopicId = "bets" | "withdrawals" | "deposits" | "games" | "account" | "other";
type Topic = { id: TopicId; title: string; intro: string; icon: "bets" | "wallet" | "deposit" | "games" | "account" | "other"; options: Option[] };
type Article = { id: string; topic: TopicId; title: string; body: string };
type Message = { id: number; from: "bot" | "user"; text: string; options?: Option[]; articles?: Article[] };
type SupportRequest = { id: string; subject: string; message: string; at: number };

const backOption: Option = { label: "Back to help topics", action: "new" };
const requestsOption: Option = { label: "View my requests", action: "requests" };
const browseOption = (topic: TopicId): Option => ({ label: "Browse articles", browse: true, article: topic });
const moreOptions = [backOption, requestsOption];

const WITHDRAWAL_OPTIONS: Option[] = [
  {
    label: "My withdrawal is pending",
    reply: "A pending withdrawal usually means the request is waiting for review or payment processing. Please check your payment method and transaction reference, then allow the normal processing time. If it has been pending unusually long, I can save the details for you.",
    options: [
      { label: "Check my transactions", action: "mybets" },
      { label: "Save a withdrawal request", ticket: true },
      backOption,
    ],
  },
  {
    label: "My withdrawal has failed",
    reply: "I'm sorry your withdrawal failed. Could you share a little more so I can understand what happened?\n\n1) Does your withdrawal show as failed in your transaction history?\n2) When did you request it, and what error or reason was shown?\n3) Has the amount been returned to your balance, or is it still missing?",
    options: [
      { label: "It has been returned", reply: "That's good — the money is back in your wallet. You can check the details under Me → Transactions. If the method or account details were wrong, correct them before trying again.", options: [backOption, requestsOption] },
      { label: "It is still missing", reply: "Thanks for checking. Please save the withdrawal date, amount, method and any reference or error shown. That gives support the exact trail to investigate. I won't mark anything as resolved here.", ticket: true },
      { label: "I'm not sure", reply: "No problem. Open Me → Transactions and look for the withdrawal and any refund entry. If there is no refund and it still shows failed, save a request with the reference.", options: [{ label: "Open transactions", action: "mybets" }, { label: "Save a request", ticket: true }, backOption] },
      backOption,
    ],
  },
  { label: "My issue is not listed here", reply: "Tell me what happened in your own words. Include the date, amount, payment method and any reference shown, and I'll save a clear support request on this device.", ticket: true },
  browseOption("withdrawals"),
];

const TOPIC_ICON: Record<Topic["icon"], typeof TicketIcon> = { bets: TicketIcon, wallet: WalletIcon, deposit: WalletIcon, games: RobotIcon, account: LockIcon, other: HelpIcon };

const TOPICS: Topic[] = [
  {
    id: "bets",
    title: "Bets and cash out",
    intro: "Please select the option that is closest to your betting concern.",
    icon: "bets",
    options: [
      { label: "My bet is still open", reply: "An open bet is waiting for the match to finish and be settled. Once the result is confirmed, it moves to Bet History automatically. You can follow it in My Bets, including the live score and possible win.", options: [{ label: "Open My Bets", action: "mybets" }, backOption] },
      { label: "Cash out is unavailable", reply: "Cash out may be unavailable when a market is suspended, a selection has already lost, the match has finished, or the bet type is not eligible (for example, some virtual or jackpot bets). Try again when the market reopens.", options: [{ label: "Check my open bets", action: "mybets" }, backOption] },
      { label: "I want to cancel my bet", reply: "Once a bet is accepted it cannot simply be cancelled. If cash out is available, you can settle it early at the value shown in My Bets. Otherwise it will be settled when the match ends.", options: [{ label: "Open My Bets", action: "mybets" }, backOption] },
      { label: "My bet was settled incorrectly", reply: "Please note the bet ID and the match. Settled bets cannot be changed silently; any correction needs an authorised reason and leaves an audit trail. Save a request with the bet ID and what you believe is wrong.", ticket: true },
      browseOption("bets"),
    ],
  },
  {
    id: "withdrawals",
    title: "Withdrawals",
    intro: "Please select the option that is closest to your withdrawal concern.",
    icon: "wallet",
    options: WITHDRAWAL_OPTIONS,
  },
  {
    id: "deposits",
    title: "Deposits",
    intro: "Please select the option that is closest to your deposit concern.",
    icon: "deposit",
    options: [
      { label: "My deposit has not arrived", reply: "First check that the payment was approved in your mobile money or bank app, then note the reference and time. Don't pay twice while the first payment is being checked. If it still hasn't arrived, save a request with that reference.", options: [{ label: "View deposit methods", action: "deposit" }, { label: "Save a deposit request", ticket: true }, backOption] },
      { label: "My deposit failed", reply: "Check your balance, PIN/approval prompt and network connection, then try once more. If money left your bank or mobile money account but didn't reach your wallet, don't retry repeatedly — save the reference so it can be traced.", ticket: true },
      { label: "My bonus was not added", reply: "The welcome bonus applies only to an eligible first deposit. Check that your deposit meets the promotion's minimum amount and that the promotion is still active. The bonus is credited separately in your transaction history.", options: [{ label: "Check my transactions", action: "mybets" }, backOption] },
      { label: "Which payment methods can I use?", reply: "You can choose MTN MoMo, Telecel Cash, AirtelTigo Money or Visa/Mastercard from the deposit screen. Available methods and limits may depend on your account and region.", options: [{ label: "Open deposit methods", action: "deposit" }, backOption] },
      browseOption("deposits"),
    ],
  },
  {
    id: "games",
    title: "Games and virtuals",
    intro: "Please select the option that is closest to your game concern.",
    icon: "games",
    options: [
      { label: "A game won't load", reply: "Try closing and reopening the game, then refresh the page. Check your connection and make sure your browser is up to date. You can also try demo mode first — it uses no real balance. If one game keeps failing, tell me its name and device.", ticket: true },
      { label: "Crash / cash-out question", reply: "For crash games such as Aviator and Rocket Rush, a bet placed during a flight joins the next round. Cash out only works while your bet is active in the current round. Auto cash out triggers when your chosen multiplier is reached, if the plane is still flying.", options: [{ label: "Open casino", action: "casino" }, backOption] },
      { label: "Are the games fair?", reply: "The current games are local SportStake Originals demo games, not third-party providers or a live casino server. Each round uses its own random outcome. When real-money gaming is connected, results must come from the licensed provider and server-side RNG, not from your browser.", options: [{ label: "Read game information", action: "casino" }, backOption] },
      { label: "How do virtual sports work?", reply: "Virtual fixtures run on a timed simulated engine, with scheduled kick-offs, live clocks and settlement when the match ends. They are not real teams or televised matches. Results are generated for the current demo, and real match data should replace them when a provider is connected.", options: [{ label: "Open sportsbook", action: "casino" }, backOption] },
      browseOption("games"),
    ],
  },
  {
    id: "account",
    title: "Account security",
    intro: "Please select the option that is closest to your account concern.",
    icon: "account",
    options: [
      { label: "I forgot my password", reply: "Use Forgot Password on the login page and enter your email. A reset link will be sent if an account exists. For security, admin accounts also need their authenticator code before changing a password.", options: [{ label: "Reset my password", action: "reset" }, backOption] },
      { label: "I can't log in", reply: "Check that you're using the email and password you registered with. Agents can also use their username. Too many failed attempts temporarily lock the account for 15 minutes for your protection.", options: [{ label: "Reset my password", action: "reset" }, backOption] },
      { label: "My account is locked", reply: "After 5 failed sign-in attempts, the account is locked for 15 minutes. Please wait for the lock to expire before trying again. If you didn't make those attempts, reset your password and save a security request.", options: [{ label: "Reset password", action: "reset" }, { label: "Save a security request", ticket: true }, backOption] },
      { label: "Can I change my currency?", reply: "Your wallet currency is chosen once at registration and is locked so balances cannot be mixed up. Ghana accounts use GH₵ and Nigeria accounts use ₦. A different currency would require a separate account with different registration details.", options: [backOption] },
      { label: "Account closure & responsible gaming", reply: "You can take a break at any time. Set a budget before playing, never chase losses and never use money needed for bills or essentials. If gambling stops being fun, pause and talk to someone you trust or a professional counsellor.", options: [{ label: "Responsible gaming guidance", action: "responsible" }, { label: "Request account closure", ticket: true }, backOption] },
      browseOption("account"),
    ],
  },
  {
    id: "other",
    title: "Any Other Queries",
    intro: "Choose a topic, or tell me what you need help with in your own words.",
    icon: "other",
    options: [
      { label: "Booking codes", reply: "Share a bet from the betslip to get a booking code and link. A friend can open the link or choose Load Code and enter it to load the same selections, then stake from their own account.", options: [{ label: "Load a booking code", action: "code" }, backOption] },
      { label: "Agents and referrals", reply: "Your referral link records new customers under your agent account. Commissions depend on qualified activity — real deposits and settled bets — not on sign-ups alone. Open Refer & Earn for your link, referrals, commissions and withdrawals.", options: [{ label: "Open Refer & Earn", action: "affiliate" }, backOption] },
      { label: "Responsible gambling", reply: "Only play if you're 18 or older. Set a time and money limit, never borrow to bet and never chase losses. If betting is affecting your mood, relationships or finances, take a break and seek professional support.", options: [{ label: "Responsible gaming guidance", action: "responsible" }, backOption] },
      { label: "Talk to someone", reply: "There isn't a live agent connected to this chat yet, but you can describe your issue and I'll save a clear support request on this device. You can then share that request with your support team.", ticket: true },
      browseOption("other"),
    ],
  },
];

const ARTICLES: Article[] = [
  { id: "bets-open", topic: "bets", title: "Open bets and settlement", body: "Open bets stay open until every selection has a result. A multiple can remain open while one match is still running. If a selection loses, the whole multiple loses immediately; if a match is cancelled, that selection is normally voided and the stake is returned according to the market rules." },
  { id: "bets-cashout", topic: "bets", title: "When cash out is available", body: "Cash out is a way to settle an eligible open bet early for the value shown. The offer changes with the match situation and is not guaranteed. It can disappear when markets are suspended, a selection is decided, the match ends, or the bet type is not supported." },
  { id: "bets-boost", topic: "bets", title: "Multiple boost and combined odds", body: "Multiples multiply the odds of every selection. The Multiple Boost adds a percentage to eligible multiples with three or more selections, increasing with the number of legs. The betslip shows total odds, boost, stake and possible win before you place the bet." },
  { id: "wd-pending", topic: "withdrawals", title: "Pending withdrawals", body: "Pending means the withdrawal has been requested but has not finished processing. Check your KYC status, payment details and the transaction reference. If the request is rejected, the amount is returned to your wallet automatically. Pending does not mean your money is lost." },
  { id: "wd-failed", topic: "withdrawals", title: "Failed withdrawals", body: "If a withdrawal fails, check whether it appears as failed in your transaction history, the date and reason shown, and whether a refund has arrived. If it is still missing, save a support request with the amount, method, date and reference. Do not make repeated withdrawal attempts while the first is being checked." },
  { id: "dep-missing", topic: "deposits", title: "Missing or delayed deposits", body: "Confirm that the payment was approved and note the transaction reference, amount and time. A successful payment normally credits automatically after the provider confirms it. Never send a second payment while the first is unconfirmed. If it remains missing, save the reference for support." },
  { id: "dep-bonus", topic: "deposits", title: "Welcome bonus eligibility", body: "The first-deposit bonus applies only to the first eligible deposit. It is capped by the current promotion and credited separately as a bonus transaction. Later deposits do not qualify. Check the promotion's current terms before depositing." },
  { id: "games-crash", topic: "games", title: "Crash games and round timing", body: "Crash rounds move from waiting to flying to crashed. A bet placed while the plane is already flying is queued for the next round and can be cancelled before that round begins. Once active, you can cash out manually or set an automatic multiplier." },
  { id: "games-demo", topic: "games", title: "Demo and real-money play", body: "Demo mode lets you practise without a deposit and keeps its own demo balance. Real mode uses your account wallet. Game outcomes in the current SportStake Originals demo are local and are not a live provider feed. Always confirm which mode is selected before staking." },
  { id: "account-login", topic: "account", title: "Login and password recovery", body: "Use the email and password you registered with. Use Forgot Password to receive a reset link. Five failed attempts lock the account for 15 minutes. Administrators must also verify with their authenticator app before entering the dashboard or changing a password." },
  { id: "account-currency", topic: "account", title: "Your wallet currency", body: "Choose GHS for Ghana or NGN for Nigeria at registration. That single currency is used for balances, bets, wins and limits. It cannot be changed later, which prevents accidental conversion or mixed-currency balances." },
  { id: "other-code", topic: "other", title: "Share and load booking codes", body: "Open your betslip and choose Share Bet to generate a code. Share the code or link with a friend. They open Load Code, enter it and the selections appear in their own betslip. They still need to log in and stake from their own balance." },
  { id: "other-responsible", topic: "other", title: "Play responsibly", body: "Gambling is for adults 18+ and should be entertainment, not a way to solve financial problems. Set limits, take breaks and never chase losses. If you feel out of control, stop playing and speak to someone you trust or a qualified counsellor." },
];

/* ---------------- small building blocks ---------------- */
const uid = () => Date.now() + Math.floor(Math.random() * 1000);

function SendIcon({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 4 16 8-16 8 3-8z" /><path d="M7 12h13" /></svg>;
}

function Bubble({ children, from }: { children: React.ReactNode; from: "bot" | "user" }) {
  return <div className={cn("flex animate-float-up gap-2", from === "user" && "justify-end")}>
    {from === "bot" ? <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-green text-[18px] font-black italic text-brand-yellow shadow-sm">S</span> : null}
    <div className={cn("max-w-[86%] rounded-2xl px-3 py-2.5 text-[13px] font-medium leading-relaxed shadow-sm", from === "bot" ? "rounded-tl-sm bg-white text-brand-ink ring-1 ring-black/[0.04]" : "rounded-br-sm bg-[#e8f6e9] text-brand-ink ring-1 ring-brand-green/15")}>
      {children}
    </div>
  </div>;
}

function getRequests(): SupportRequest[] {
  try { return JSON.parse(localStorage.getItem("ss-support-requests-v1") || "[]"); } catch { return []; }
}

/* ---------------- main widget ---------------- */
export function SupportWidget() {
  const store = useStore();
  const { open: openOverlay, go } = store;
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"chat" | "requests">("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [pendingTopic, setPendingTopic] = useState<TopicId | null>(null);
  const [requests, setRequests] = useState<SupportRequest[]>(getRequests);
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [activeTopic, setActiveTopic] = useState<TopicId | null>(null);
  const timers = useRef<number[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const rootOptions = useMemo<Option[]>(() => TOPICS.map((t) => ({ label: t.title, reply: t.intro, options: t.options, article: t.id, icon: t.icon })), []);
  const allOptions = useMemo(() => {
    const walk = (opts: Option[]): Option[] => opts.flatMap((o) => [o, ...(o.options ? walk(o.options) : [])]);
    return walk(rootOptions);
  }, [rootOptions]);

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("ss-support", handler);
    return () => window.removeEventListener("ss-support", handler);
  }, []);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  useEffect(() => { localStorage.setItem("ss-support-requests-v1", JSON.stringify(requests)); }, [requests]);
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{ id: uid(), from: "bot", text: "Hi! I'm StakeBot, your virtual assistant. I'll help you today and point you to the right next step. Please select a subject below:", options: rootOptions }]);
    }
  }, [isOpen, messages.length, rootOptions]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, typing, view]);

  const push = (from: "bot" | "user", text: string, options?: Option[], articles?: Article[]) => setMessages((m) => [...m, { id: uid(), from, text, options, articles }]);
  const bot = (text: string, options?: Option[], articles?: Article[]) => {
    setTyping(true);
    const id = window.setTimeout(() => { setTyping(false); push("bot", text, options, articles); }, 350);
    timers.current.push(id);
  };

  const resetChat = () => {
    setMessages([{ id: uid(), from: "bot", text: "No problem — what would you like help with?", options: rootOptions }]);
    setActiveTopic(null);
    setPendingTopic(null);
    setQuery("");
    setView("chat");
  };

  const navigate = (action: LinkAction) => {
    if (action === "new") return resetChat();
    if (action === "requests") { setView("requests"); return; }
    setIsOpen(false);
    if (action === "mybets") go({ name: "mybets" });
    else if (action === "deposit") openOverlay({ type: "deposit" });
    else if (action === "reset") openOverlay({ type: "auth", mode: "reset" });
    else if (action === "code") openOverlay({ type: "loadCode" });
    else if (action === "casino") go({ name: "casino" });
    else if (action === "affiliate") go({ name: "affiliate" });
    else if (action === "responsible") {
      setIsOpen(true);
      bot("Responsible play matters. Set a limit before you start, never borrow to bet and take regular breaks. If gambling stops being fun, pause and speak to someone you trust or a professional counsellor. You must be 18+ to play.", [backOption, requestsOption]);
    }
  };

  const openArticle = (article: Article) => {
    bot(article.body, [{ label: "Browse more articles", browse: true, article: article.topic }, backOption]);
  };

  const choose = (opt: Option) => {
    push("user", opt.label);
    if (opt.action) { navigate(opt.action); return; }
    const parentTopic = TOPICS.find((t) => t.title === opt.label);
    if (parentTopic) setActiveTopic(parentTopic.id);
    if (opt.options?.length) {
      bot(opt.reply ?? "How else can I help?", opt.options);
      return;
    }
    if (opt.ticket) {
      const topic = activeTopic ?? "other";
      setPendingTopic(topic);
      bot("Please describe what happened in your own words. Include the date, amount and any reference or error shown. I'll save it as a support request on this device.", []);
      return;
    }
    if (opt.article) {
      const article = ARTICLES.find((a) => a.id === opt.article);
      if (article) { openArticle(article); return; }
      const topic = opt.article as TopicId;
      const list = ARTICLES.filter((a) => a.topic === topic);
      bot("Or you can read our help articles:", list.map((a) => ({ label: a.title, article: a.id } as Option)), list);
      return;
    }
    if (opt.browse) {
      const list = ARTICLES.filter((a) => a.topic === (activeTopic ?? "other"));
      bot("Or you can read our help articles:", list.map((a) => ({ label: a.title, article: a.id } as Option)), list);
      return;
    }
    bot(opt.reply ?? "How else can I help?", opt.options?.length ? opt.options : moreOptions);
  };

  const createRequest = (message: string) => {
    const topic = TOPICS.find((t) => t.id === (pendingTopic ?? "other"));
    const req: SupportRequest = { id: `SS-${Date.now().toString(36).toUpperCase().slice(-6)}${Math.random().toString(36).slice(2, 4).toUpperCase()}`, subject: topic?.title ?? "General support", message, at: Date.now() };
    setRequests((r) => [req, ...r]);
    setPendingTopic(null);
    bot(`Thank you — I've saved support request ${req.id} on this device. It includes “${message}”. Keep that reference with your details. This chat does not send anything to a live agent yet.`, [requestsOption, backOption]);
  };

  const replyFor = (raw: string): { text: string; options?: Option[] } => {
    const q = raw.toLowerCase();
    if (/pending|wait|long time|not arrived/.test(q) && /withdraw|cash.?out|money/.test(q)) return { text: "If a withdrawal is pending, please check the payment method, KYC status and reference first. It may still be under review. If it's been pending unusually long, I can save a request with the date and amount.", options: [{ label: "Save a withdrawal request", ticket: true }, backOption] };
    if (/fail|missing|lost/.test(q) && /withdraw|money|deposit/.test(q)) return { text: "I'm sorry that happened. Please check whether the amount has been refunded to your wallet, and note the date, amount and error shown. If it's still missing, save those details rather than trying repeatedly.", options: [{ label: "Save a request", ticket: true }, backOption] };
    if (/deposit|top.?up|fund|payment|momo|mobile money/.test(q)) return { text: "For a deposit issue, first confirm the payment was approved in your mobile money or bank app and keep the reference. If your wallet hasn't updated, don't pay again — save a request with that reference.", options: [{ label: "Open deposit methods", action: "deposit" }, { label: "Save a deposit request", ticket: true }, backOption] };
    if (/cash.?out/.test(q)) return { text: "Cash out is only offered on eligible open bets and can disappear when a market is suspended or a selection has already lost. Check My Bets to see whether the button and current value are available.", options: [{ label: "Open My Bets", action: "mybets" }, backOption] };
    if (/password|forgot|reset/.test(q)) return { text: "You can reset your password from the login page using your email. If the account is locked after repeated attempts, wait 15 minutes before trying again.", options: [{ label: "Reset my password", action: "reset" }, backOption] };
    if (/code|booking|share/.test(q)) return { text: "Booking codes let someone load your exact selections. Open the betslip and tap Share Bet, then send the code or link. Your friend chooses Load Code and stakes from their own account.", options: [{ label: "Load a booking code", action: "code" }, backOption] };
    if (/aviator|rocket|plane|crash/.test(q)) return { text: "In crash games, the multiplier rises until the round ends. Cash out before the plane leaves. A bet placed during a flight starts next round, not the current one.", options: [{ label: "Open casino", action: "casino" }, backOption] };
    if (/mine|slot|keno|roulette|blackjack|chicken|game/.test(q)) return { text: "Every tile in the casino opens a real playable game with its own rules. Try demo mode first if you're unsure how a game works, and check the RTP and game information shown.", options: [{ label: "Open casino", action: "casino" }, backOption] };
    if (/agent|referral|commission|affiliate/.test(q)) return { text: "Referral links record who invited each customer. Commissions are based on qualified betting activity, not just registrations or deposits. You can track referrals and payouts under Refer & Earn.", options: [{ label: "Open Refer & Earn", action: "affiliate" }, backOption] };
    if (/bonus|promo|free bet/.test(q)) return { text: "The welcome bonus applies only to the first eligible deposit and is capped by the promotion. Check the promotion's terms and your transaction history to see the separate bonus credit.", options: [backOption] };
    if (/human|person|agent|support|contact|help/.test(q) && !/agent|referral|commission|affiliate/.test(q)) return { text: "I'm here to help. There isn't a live agent connected to this chat yet, but I can save a support request on this device with the details support would need.", options: [{ label: "Create a support request", ticket: true }, backOption] };
    if (/hi|hello|hey|good morning|good afternoon|good evening/.test(q)) return { text: "Hello! I'm StakeBot. How can I help you today? You can choose a topic below or describe your issue in your own words.", options: rootOptions };
    return { text: "Thanks for explaining. To point you to the right answer, please choose the closest topic below. If you'd like me to save the details for support, include the date, amount and any reference shown.", options: rootOptions };
  };

  const send = () => {
    const value = text.trim();
    if (!value || typing) return;
    setText("");
    push("user", value);
    if (pendingTopic) createRequest(value);
    else {
      const reply = replyFor(value);
      bot(reply.text, reply.options);
    }
  };

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return [
      ...allOptions.filter((o) => o.label.toLowerCase().includes(q)).map((o) => ({ label: o.label, run: () => choose(o) })),
      ...ARTICLES.filter((a) => `${a.title} ${a.body}`.toLowerCase().includes(q)).map((a) => ({ label: a.title, run: () => openArticle(a) })),
    ].slice(0, 8);
  }, [query, allOptions]);

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} aria-label="Open customer service" className="absolute bottom-[82px] left-3 z-30 flex h-[58px] w-[58px] flex-col items-center justify-center rounded-full bg-brand-green text-white shadow-[0_12px_24px_-8px_rgba(23,163,74,0.7)] ring-2 ring-white transition active:scale-95 lg:bottom-5 lg:left-5">
        <HelpIcon className="h-5 w-5" strokeWidth={2.2} />
        <span className="text-[9px] font-black uppercase tracking-wide">Help</span>
      </button>
    );
  }

  return (
    <div className="absolute inset-0 z-[85] flex flex-col bg-[#f3f4f6] md:items-center md:justify-center md:p-6">
      <button aria-label="Close customer service" className="absolute inset-0 hidden bg-brand-ink/35 md:block" onClick={() => setIsOpen(false)} />
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#f3f4f6] shadow-2xl md:h-[86%] md:max-w-[560px] md:rounded-[1.75rem]">
        {/* header */}
        <div className="flex h-14 shrink-0 items-center gap-2 bg-brand-yellow px-3 text-brand-ink shadow-[0_6px_18px_-8px_rgba(16,19,26,0.45)]">
          <button onClick={() => view === "requests" ? setView("chat") : setIsOpen(false)} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full active:bg-black/10"><ChevronLeft className="h-6 w-6" strokeWidth={2.5} /></button>
          <h1 className="min-w-0 flex-1 text-[19px] font-black tracking-tight">StakeHelp</h1>
          <button onClick={() => setView(view === "requests" ? "chat" : "requests")} className="rounded-full bg-white px-3 py-1.5 text-[12px] font-black shadow-sm active:scale-95">{view === "requests" ? "Back to chat" : "My requests"}</button>
          <button onClick={() => setIsOpen(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full active:bg-black/10"><CloseIcon className="h-5 w-5" strokeWidth={2.3} /></button>
        </div>

        {/* search */}
        <div className="flex shrink-0 items-center gap-2 bg-brand-green-soft px-4 py-3">
          <h2 className="flex-1 text-[17px] font-black tracking-tight text-brand-ink">Search help topics</h2>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-brand-ink/35" />
            <input aria-label="Search help topics" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="h-9 w-[132px] rounded-xl bg-white pl-8 pr-2 text-[12px] font-semibold text-brand-ink outline-none ring-1 ring-black/10 placeholder:text-brand-ink/35" />
          </div>
        </div>

        {view === "requests" ? (
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[16px] font-black text-brand-ink">My support requests</h2>
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-brand-ink/50">{requests.length}</span>
            </div>
            {requests.length === 0 ? (
              <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
                <TicketIcon className="mx-auto h-9 w-9 text-brand-green" strokeWidth={1.8} />
                <p className="mt-3 text-[14px] font-black text-brand-ink">No requests yet</p>
                <p className="mt-1 text-[12px] font-semibold text-brand-ink/50">When you save a support request, it appears here with its reference and details.</p>
                <button onClick={() => setView("chat")} className="mt-4 rounded-full bg-brand-green px-4 py-2 text-[12px] font-black text-white">Start a chat</button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {selectedRequest ? (
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <button onClick={() => setSelectedRequest(null)} className="mb-2 text-[11px] font-black text-brand-green-deep">‹ All requests</button>
                    <p className="text-[16px] font-black text-brand-ink">{selectedRequest.id}</p>
                    <p className="mt-1 text-[12px] font-bold text-brand-ink/50">{selectedRequest.subject} · {new Date(selectedRequest.at).toLocaleString()}</p>
                    <p className="mt-3 whitespace-pre-wrap text-[13px] font-medium leading-relaxed text-brand-ink">{selectedRequest.message}</p>
                    <span className="mt-3 inline-block rounded-full bg-brand-green-soft px-2 py-1 text-[10px] font-black text-brand-green-deep">Saved on this device</span>
                  </div>
                ) : requests.map((r) => (
                  <button key={r.id} onClick={() => setSelectedRequest(r)} className="w-full rounded-2xl bg-white p-3.5 text-left shadow-sm transition active:scale-[0.99]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-black text-brand-ink">{r.id}</span>
                      <ChevronRight className="h-4 w-4 text-brand-ink/35" />
                    </div>
                    <p className="mt-0.5 text-[11.5px] font-bold text-brand-ink/50">{r.subject}</p>
                    <p className="mt-1 line-clamp-2 text-[12px] font-medium text-brand-ink/65">{r.message}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-3.5">
              {query.trim().length >= 2 ? (
                <Bubble from="bot">
                  {searchResults.length ? (
                    <>
                      <p className="mb-2 font-bold">Help topics for “{query.trim()}”</p>
                      <div className="space-y-1.5">
                        {searchResults.map((r, i) => <button key={i} onClick={() => { setQuery(""); r.run(); }} className="flex w-full items-center justify-between rounded-xl bg-[#f1f3f5] px-3 py-2 text-left text-[12px] font-bold text-brand-ink active:bg-brand-green-soft"><span>{r.label}</span><ChevronRight className="h-4 w-4 text-brand-ink/35" /></button>)}
                      </div>
                    </>
                  ) : <p>No topics found for “{query.trim()}”. Try withdrawals, cash out, deposits, password, aviator, bonus or responsible gambling.</p>}
                </Bubble>
              ) : messages.map((m) => (
                <div key={m.id}>
                  <Bubble from={m.from}>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    {m.options?.length ? (
                      <div className="mt-2.5 space-y-1.5 border-t border-black/[0.06] pt-2.5">
                        {m.options.map((o, i) => (
                          <button key={i} onClick={() => choose(o)} className="flex w-full items-center justify-between gap-3 rounded-xl bg-[#f1f3f5] px-3 py-2.5 text-left text-[12px] font-bold text-brand-ink transition hover:bg-brand-green-soft active:scale-[0.99]">
                            <span className="flex min-w-0 items-center gap-2">
                              {o.icon ? (() => { const Icon = TOPIC_ICON[o.icon]; return <Icon className="h-4 w-4 shrink-0 text-brand-green" strokeWidth={2} />; })() : null}
                              <span className="truncate">{o.label}</span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-brand-ink/35" />
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {m.articles?.length ? (
                      <div className="mt-2.5 space-y-1.5 border-t border-black/[0.06] pt-2.5">
                        {m.articles.map((a) => <button key={a.id} onClick={() => openArticle(a)} className="flex w-full items-center gap-2 rounded-xl bg-[#f1f3f5] px-3 py-2 text-left text-[12px] font-bold text-brand-ink active:bg-brand-green-soft"><InfoIcon className="h-4 w-4 shrink-0 text-brand-green" />{a.title}</button>)}
                      </div>
                    ) : null}
                  </Bubble>
                </div>
              ))}
              {typing ? <Bubble from="bot"><span className="flex gap-1 py-1"><i className="h-1.5 w-1.5 animate-live rounded-full bg-brand-ink/40" /><i className="h-1.5 w-1.5 animate-live rounded-full bg-brand-ink/40 [animation-delay:150ms]" /><i className="h-1.5 w-1.5 animate-live rounded-full bg-brand-ink/40 [animation-delay:300ms]" /></span></Bubble> : null}
            </div>

            <div className="shrink-0 border-t border-black/[0.07] bg-white px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5">
              <div className="flex items-center gap-2">
                <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={pendingTopic ? "Describe your issue and include a reference…" : "Type your message here…"} aria-label="Message StakeBot" className="min-w-0 flex-1 rounded-xl bg-[#f4f5f6] px-3 py-3 text-[13px] font-medium text-brand-ink outline-none placeholder:text-brand-ink/35 focus:ring-2 focus:ring-brand-green/15" />
                <button onClick={send} disabled={!text.trim() || typing} aria-label="Send message" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-green text-white shadow-sm transition active:scale-95 disabled:opacity-40"><SendIcon className="h-5 w-5" /></button>
              </div>
              <p className="mt-1.5 text-center text-[9px] font-semibold text-brand-ink/35">Automated help centre · support requests are saved on this device</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
