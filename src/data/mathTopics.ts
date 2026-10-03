/** Every maths family the AMCAT quant section draws from. 4 questions each = 40. */
export interface MathTopic {
  id: string;
  name: string;
  what: string;
  /** The speed trick shown on the sheet and in the PDF. */
  trick: string;
}

export const MATH_TOPICS: MathTopic[] = [
  {
    id: 'percent',
    name: 'Percentages',
    what: 'Discounts, hikes, cuts, and reverse-percentage traps.',
    trick: 'x% of y = y% of x. 28% of 75 is 75% of 28 = 21. Use whichever side is easier.',
  },
  {
    id: 'profit',
    name: 'Profit & Loss',
    what: 'Cost, selling price, marked price, discount chains.',
    trick: 'Profit % is always on COST, discount % always on MARKED price. Mixing the two bases is the trap.',
  },
  {
    id: 'interest',
    name: 'Simple & Compound Interest',
    what: 'SI vs CI, rate gymnastics, doubling questions.',
    trick: 'CI − SI (2 yrs) = P·(r/100)². If that gap is given, P falls out in one step.',
  },
  {
    id: 'average',
    name: 'Averages',
    what: 'Batsmen, ages, missing-test-score puzzles.',
    trick: 'New average × new count − old average × old count = the added value. Never expand the full sum.',
  },
  {
    id: 'ratio',
    name: 'Ratio & Proportion',
    what: 'Splitting money, mixtures, income–expenditure.',
    trick: 'Total parts = total money ÷ one part. Convert every ratio to "one part" first.',
  },
  {
    id: 'tsd',
    name: 'Time–Speed–Distance',
    what: 'Trains, boats, relative speed, late–early puzzles.',
    trick: 'Same distance ⇒ speeds and times are inverse. Double the speed, half the time — no formula needed.',
  },
  {
    id: 'work',
    name: 'Time & Work',
    what: 'Pipes, efficiency ratios, work-and-wages.',
    trick: 'Rate = 1/days. Add rates, never days: 1/12 + 1/15 = 3/20 ⇒ 20/3 days together.',
  },
  {
    id: 'number',
    name: 'Number System',
    what: 'LCM/HCF, divisibility, remainders, unit digits.',
    trick: 'LCM = the number divisible by all of them; HCF divides all of them. Read which direction the question wants.',
  },
  {
    id: 'ages',
    name: 'Ages',
    what: 'Present–past–future age equations in disguise.',
    trick: 'Anchor every statement to ONE present age (say father = F). Two statements, two equations, done.',
  },
  {
    id: 'alligation',
    name: 'Mixtures & Alligation',
    what: 'Blending prices, milk–water, average-price mixes.',
    trick: 'Alligation cross: (dearer − mean) : (mean − cheaper) = cheaper qty : dearer qty. Draw the X.',
  },
];

export function mathTopicName(id: string): string {
  return MATH_TOPICS.find((t) => t.id === id)?.name || id;
}
