export interface ListenItem {
  id: string;
  /** Spoken by the voice server — hidden until after answering. */
  say: string;
  question: string;
  options: [string, string, string, string];
  answerIndex: number;
  explanation: string;
}

export interface SpeechItem {
  id: string;
  text: string;
  tip: string;
}

export const LISTEN_BANK: ListenItem[] = [
  { id: 's1', say: 'Your flight has been delayed by two hours. Please proceed to gate fourteen for further assistance.', question: 'Where should the passenger go?', options: ['Gate four', 'Gate fourteen', 'The ticket counter', 'The lounge'], answerIndex: 1, explanation: '“Fourteen”, not “four” — the classic SVAR trap. Gate fourteen.' },
  { id: 's2', say: 'The meeting has been moved from room three-oh-one to the conference hall on the ground floor.', question: 'Where is the meeting now?', options: ['Room 301', 'The first floor', 'The conference hall on the ground floor', 'It was cancelled'], answerIndex: 2, explanation: 'Moved FROM 301 TO the ground-floor conference hall.' },
  { id: 's3', say: 'Could you please spell your last name for me? I need it for the booking.', question: 'What does the speaker need?', options: ['A booking reference', 'The spelling of the last name', 'A phone number', 'An email address'], answerIndex: 1, explanation: 'Explicit request: spell the last name for the booking.' },
  { id: 's4', say: 'Our office hours are nine to six, Monday through Friday. We are closed on public holidays.', question: 'When is the office closed?', options: ['Only on Sundays', 'Weekends and public holidays', 'Only on holidays', 'Never'], answerIndex: 1, explanation: 'Open Mon–Fri only, so weekends plus public holidays are closed.' },
  { id: 's5', say: 'The refund of forty-five dollars will reflect in your account within five to seven business days.', question: 'How long will the refund take?', options: ['45 days', '5 to 7 business days', 'Immediately', 'One month'], answerIndex: 1, explanation: 'Five to seven BUSINESS days — weekends don\u2019t count.' },
  { id: 's6', say: 'Please keep your passport and boarding pass ready. Boarding begins forty minutes before departure.', question: 'What should passengers keep ready?', options: ['Luggage tags', 'Passport and boarding pass', 'A pen', 'Their phones switched on'], answerIndex: 1, explanation: 'Passport and boarding pass, ready before boarding.' },
  { id: 's7', say: 'Press one for billing, press two for technical support, or stay on the line to speak to an agent.', question: 'How do you reach a human agent?', options: ['Press one', 'Press two', 'Stay on the line', 'Call back later'], answerIndex: 2, explanation: 'Stay on the line connects to an agent.' },
  { id: 's8', say: 'The package you ordered on Monday will arrive this Thursday between two and five in the afternoon.', question: 'When does the package arrive?', options: ['Monday', 'Thursday 2–5 pm', 'Thursday morning', 'Friday'], answerIndex: 1, explanation: 'Thursday afternoon, between two and five.' },
];

export const READ_BANK: SpeechItem[] = [
  { id: 'r1', text: 'Good morning, thank you for calling support. How may I help you today?', tip: 'Smile while you speak — it lifts the tone. Stress the greeting, not every word.' },
  { id: 'r2', text: 'I understand how frustrating this delay must be, and I sincerely apologise for the inconvenience.', tip: 'Slow down on “sincerely apologise” — empathy lines must never sound rushed.' },
  { id: 'r3', text: 'Could you please confirm the spelling of your email address so I can update our records?', tip: 'Rise slightly on “please” — requests sound polite, not demanding.' },
  { id: 'r4', text: 'Your refund has been processed and should reflect within five to seven business days.', tip: 'Numbers carry the message — say each one clearly, with a tiny pause before them.' },
  { id: 'r5', text: 'For security reasons, please do not share your one-time password with anyone, including our staff.', tip: 'Firm but kind: this is a warning wrapped in courtesy.' },
  { id: 'r6', text: 'I have escalated your case to our senior team, and someone will call you back within twenty-four hours.', tip: 'End on a promise kept upbeat — the caller should feel relief, not process.' },
  { id: 'r7', text: 'Please hold the line for a brief moment while I retrieve your account details.', tip: 'Short, warm, confident — holds are where callers judge you.' },
  { id: 'r8', text: 'Is there anything else I can assist you with before we end this call?', tip: 'The classic closer — open, unhurried, genuine.' },
];

export const REPEAT_BANK: SpeechItem[] = [
  { id: 'p1', text: 'The package arrives on Thursday.', tip: 'Match the rhythm, not just the words.' },
  { id: 'p2', text: 'Please spell your last name slowly.', tip: 'Copy the polite stress on “slowly”.' },
  { id: 'p3', text: 'Boarding begins forty minutes early.', tip: 'Catch “forty” vs “fourteen” — the exam loves this pair.' },
  { id: 'p4', text: 'Your refund is on its way.', tip: 'Short and reassuring — keep it that way.' },
  { id: 'p5', text: 'Stay on the line for an agent.', tip: 'Clear instructions, steady pace.' },
  { id: 'p6', text: 'The meeting moved to the ground floor.', tip: 'Land the key detail: ground floor.' },
  { id: 'p7', text: 'We close at six on weekdays.', tip: 'Numbers first, everything else after.' },
  { id: 'p8', text: 'I will call you back tomorrow morning.', tip: 'A promise — sound like you mean it.' },
];
