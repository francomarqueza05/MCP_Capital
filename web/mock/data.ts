// Test data for the visual pass. Projections, scores and goals come from the real
// Sherpas case files (see the JSON next to this file). The spoken lines are written
// by hand from each family's persona, so every figure here exists in the plan.
// When the backend lands, this file is replaced by /api/v1 responses of the same shape.
import michael from "./michael-carter.json";
import weah from "./timothy-melanie-weah.json";

export type YearPoint = { year: number; age: number; investable: number; netWorth: number };

export type RidgeFlag = { age: number; label: string; tone?: "attention"; icon?: "home" | "rest" | "alert" | "cap" };

export type Visual =
  | { kind: "figure"; amount: number; sentence: string; share: number; shareLabel: string }
  | { kind: "ridge"; toAge: number; flags: RidgeFlag[] }
  | { kind: "compare"; rows: { amount: number; label: string; tone?: "attention" }[] }
  | { kind: "step" };

export type Ctx = { name: string; worry: string | null };

export type Line = {
  say: string | ((ctx: Ctx) => string);
  /** undefined keeps what is on screen, null clears it */
  visual?: Visual | null;
};

export type Phase = {
  id: string;
  name: string;
  lines: Line[];
  ask?: { chips: string[]; remember?: "worry" };
  /** What the guide says when the family cuts in during this phase */
  interruptReply: string;
};

export type Camp = { title: string; why: string };

export type CaseMock = {
  slug: string;
  family: string;
  place: string;
  members: { id: string; name: string }[];
  score: number;
  yearly: YearPoint[];
  comingUp: { year: number; name: string }[];
  phases: Phase[];
  step: { title: string; detail: string };
  camps: Camp[];
};

const comingUp = (goals: { year: number; type: string; name: string }[]) =>
  goals.filter((g) => g.name && g.type !== "VACATION").map(({ year, name }) => ({ year, name }));

const michaelFlags: RidgeFlag[] = [
  { age: 38, label: "The house", icon: "home" },
  { age: 58, label: "You stop working", icon: "rest" },
  { age: 85, label: "Savings run out", tone: "attention", icon: "alert" },
];

const weahFlags: RidgeFlag[] = [
  { age: 44, label: "New home", icon: "home" },
  { age: 52, label: "College", icon: "cap" },
  { age: 62, label: "You stop working", icon: "rest" },
];

export const cases: Record<string, CaseMock> = {
  "michael-carter": {
    slug: "michael-carter",
    family: "Michael Carter",
    place: `${michael.city}, ${michael.state}`,
    members: [{ id: "michael", name: "Michael" }],
    score: michael.score.value,
    yearly: michael.yearly,
    comingUp: comingUp(michael.goals),
    phases: [
      {
        id: "discovery",
        name: "Before the numbers",
        interruptReply: "Of course. Take your time, I'm listening.",
        lines: [
          {
            say: (c) =>
              `Hi ${c.name}. I'm the guide your advisor's team set up to walk you through your plan. I'm an AI, and you can cut in whenever you like.`,
            visual: null,
          },
          { say: "Before any numbers. When you think about money, what sits in the back of your mind?" },
        ],
        ask: { chips: ["Buying the house", "Retiring at 58", "Whether I'm doing okay"], remember: "worry" },
      },
      {
        id: "today",
        name: "Where you stand",
        interruptReply: "Yes, that includes your employer's seven thousand. The rest is all you.",
        lines: [
          {
            say: (c) =>
              c.worry === "Whether I'm doing okay"
                ? "You asked whether you're doing okay. Start here."
                : `${c.worry ?? "That"}. We'll get there in a minute. First, something most people can't say.`,
          },
          {
            say: "You put away forty-three thousand dollars a year. That is close to a quarter of what you earn.",
            visual: { kind: "figure", amount: 43000, sentence: "saved every year", share: 0.239, shareLabel: "of your income" },
          },
          { say: "So this was never about effort. It's about the order your money moves in." },
        ],
      },
      {
        id: "route",
        name: "The route ahead",
        interruptReply:
          "Short version: the house and retirement are pulling on the same dollars. Let me finish the line and you'll see where.",
        lines: [
          {
            say: "This line is your savings and investments, year by year, starting today at thirty-seven.",
            visual: { kind: "ridge", toAge: 37, flags: [] },
          },
          {
            say: "January 2027, the house. The down payment is a hundred and thirteen thousand dollars and you hold thirty thousand in cash, so most of it comes out of your investments.",
            visual: { kind: "ridge", toAge: 38, flags: michaelFlags.slice(0, 1) },
          },
          {
            say: "Then twenty years of climbing, to fifty-eight, where you want to stop working.",
            visual: { kind: "ridge", toAge: 58, flags: michaelFlags.slice(0, 2) },
          },
          {
            say: "From there you live off it. On today's path it runs out at eighty-five, six years before the plan ends.",
            visual: { kind: "ridge", toAge: 91, flags: michaelFlags },
          },
        ],
      },
      {
        id: "tension",
        name: "What pulls against what",
        interruptReply: "Both can happen. That part is good news, and it's why the next step matters.",
        lines: [
          {
            say: "So the house and retiring at fifty-eight compete for the same dollars. Both can happen. They can't both happen by accident.",
          },
          { say: "Does that match what you expected?" },
        ],
        ask: { chips: ["Yes, roughly", "No, that's news to me"] },
      },
      {
        id: "step",
        name: "Your first step",
        interruptReply: "It costs nothing and takes one sitting. That's why it comes first.",
        lines: [
          {
            say: "One step for this week, and it costs nothing. Decide which money is for the house, and keep it apart from your long-term investments.",
            visual: { kind: "step" },
          },
          { say: "Shall I put it in your calendar for Saturday?" },
        ],
        ask: { chips: ["Yes, Saturday", "Not yet"] },
      },
    ],
    step: {
      title: "Set the house money apart",
      detail: "Decide which dollars are for the January 2027 down payment and keep them separate from your long-term investments.",
    },
    camps: [
      {
        title: "Set the house money apart",
        why: "Money you need in January 2027 is short-term money. Keeping it separate protects the down payment.",
      },
      { title: "Keep the 20% card on track", why: "At $200 a month the $3,500 balance clears by July 2028. It is your most expensive debt." },
      { title: "Look at life and umbrella cover", why: "Your salary is the only income, and cover today is $180,000." },
      { title: "Decide how much more goes to retirement", why: "Closing the gap takes about $20,231 more a year, from a budget that is already tight." },
      { title: "Check your mix against Growth", why: "About 72% is in stocks today, against the 80% of the profile you chose." },
    ],
  },

  "timothy-melanie-weah": {
    slug: "timothy-melanie-weah",
    family: "Timothy and Melanie Weah",
    place: `${weah.city}, ${weah.state}`,
    members: [
      { id: "timothy", name: "Timothy" },
      { id: "melanie", name: "Melanie" },
    ],
    score: weah.score.value,
    yearly: weah.yearly,
    comingUp: comingUp(weah.goals),
    phases: [
      {
        id: "discovery",
        name: "Before the numbers",
        interruptReply: "Of course. Take your time, I'm listening.",
        lines: [
          {
            say: (c) =>
              `Hi ${c.name}. I'm the guide your advisor's team set up to walk you through your family's plan. I'm an AI, and you can cut in whenever you like.`,
            visual: null,
          },
          { say: "Before any numbers. With Liam and Josh at home, what do you most want your money to do?" },
        ],
        ask: { chips: ["Keep the kids safe", "Pay for college", "Stop worrying about it"], remember: "worry" },
      },
      {
        id: "today",
        name: "Where you stand",
        interruptReply: "That's the cash in your bank accounts, about sixteen months of essentials.",
        lines: [
          { say: (c) => `${c.worry ?? "That"}. Good, we'll build toward it. First, the solid ground.` },
          {
            say: "Your retirement is on track. And you hold a hundred and fifty thousand dollars in cash, well above what you need in reserve.",
            visual: { kind: "ridge", toAge: 93, flags: weahFlags },
          },
        ],
      },
      {
        id: "route",
        name: "Where the money leaks",
        interruptReply: "Yes, the same cash. That's the whole point of the next step.",
        lines: [
          {
            say: "Here is the odd part. Your card costs you about three thousand two hundred and forty dollars a year in interest.",
            visual: {
              kind: "compare",
              rows: [{ amount: 3240, label: "a year in interest on the 18% card", tone: "attention" }],
            },
          },
          {
            say: "And all that cash earns you about a hundred and fifty.",
            visual: {
              kind: "compare",
              rows: [
                { amount: 3240, label: "a year in interest on the 18% card", tone: "attention" },
                { amount: 150, label: "a year earned on $150,000 of cash" },
              ],
            },
          },
        ],
      },
      {
        id: "step",
        name: "Your first step",
        interruptReply: "You'd still hold well over your reserve afterwards. Nothing about your safety net changes.",
        lines: [
          {
            say: "So the first step is the simplest one. Use part of the cash you hold above your reserve to pay down the card.",
            visual: { kind: "step" },
          },
          { say: "Shall I put it in your calendar for Saturday, for the two of you?" },
        ],
        ask: { chips: ["Yes, Saturday", "Let me talk to my partner first"] },
      },
    ],
    step: {
      title: "Pay down the 18% card from spare cash",
      detail: "You hold about $60,000 above your reserve. The card costs $3,240 a year; the cash earns about $150.",
    },
    camps: [
      { title: "Pay down the 18% card", why: "It costs $3,240 a year in interest while your spare cash earns about $150." },
      { title: "Life insurance for both of you", why: "Two young children rely on both incomes, and cover is short by $1.1 million combined." },
      { title: "Consider an umbrella policy", why: "A liability claim could reach well beyond what is covered today." },
      { title: "Start saving for college", why: "Nothing is set aside yet. Liam starts in August 2038." },
      { title: "Agree on your mix, together", why: "Timothy is comfortable with more risk than Melanie. The portfolio should sit where you both are." },
    ],
  },
};

export const caseSlugs = Object.keys(cases);
