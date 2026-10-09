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

export interface JumbledItem {
  id: string;
  jumbled: string;
  solution: string;
}

export interface ShortAnswerItem {
  id: string;
  prompt: string;
  answer: string;
}

export const LISTEN_BANK: ListenItem[] = [
  { id: 's1', say: 'Your flight has been delayed by two hours. Please proceed to gate fourteen for further assistance.', question: 'Where should the passenger go?', options: ['Gate four', 'Gate fourteen', 'The ticket counter', 'The lounge'], answerIndex: 1, explanation: '“Fourteen”, not “four” — the classic SVAR trap. Gate fourteen.' },
  { id: 's2', say: 'The meeting has been moved from room three-oh-one to the conference hall on the ground floor.', question: 'Where is the meeting now?', options: ['Room 301', 'The first floor', 'The conference hall on the ground floor', 'It was cancelled'], answerIndex: 2, explanation: 'Moved FROM 301 TO the ground-floor conference hall.' },
  { id: 's3', say: 'Could you please spell your last name for me? I need it for the booking.', question: 'What does the speaker need?', options: ['A booking reference', 'The spelling of the last name', 'A phone number', 'An email address'], answerIndex: 1, explanation: 'Explicit request: spell the last name for the booking.' },
  { id: 's4', say: 'Our office hours are nine to six, Monday through Friday. We are closed on public holidays.', question: 'When is the office closed?', options: ['Only on Sundays', 'Weekends and public holidays', 'Only on holidays', 'Never'], answerIndex: 1, explanation: 'Open Mon–Fri only, so weekends plus public holidays are closed.' },
  { id: 's5', say: 'The refund of forty-five dollars will reflect in your account within five to seven business days.', question: 'How long will the refund take?', options: ['45 days', '5 to 7 business days', 'Immediately', 'One month'], answerIndex: 1, explanation: 'Five to seven BUSINESS days — weekends don’t count.' },
  { id: 's6', say: 'Please keep your passport and boarding pass ready. Boarding begins forty minutes before departure.', question: 'What should passengers keep ready?', options: ['Luggage tags', 'Passport and boarding pass', 'A pen', 'Their phones switched on'], answerIndex: 1, explanation: 'Passport and boarding pass, ready before boarding.' },
  { id: 's7', say: 'Press one for billing, press two for technical support, or stay on the line to speak to an agent.', question: 'How do you reach a human agent?', options: ['Press one', 'Press two', 'Stay on the line', 'Call back later'], answerIndex: 2, explanation: 'Stay on the line connects to an agent.' },
  { id: 's8', say: 'The package you ordered on Monday will arrive this Thursday between two and five in the afternoon.', question: 'When does the package arrive?', options: ['Monday', 'Thursday 2–5 pm', 'Thursday morning', 'Friday'], answerIndex: 1, explanation: 'Thursday afternoon, between two and five.' },
  { id: 's9', say: 'The supervisor confirmed that the new training session will begin on Monday morning at ten.', question: 'When will training begin?', options: ['Friday evening', 'Monday morning at 10', 'Monday afternoon at 2', 'Next month'], answerIndex: 1, explanation: 'Training begins Monday morning at ten.' },
  { id: 's10', say: 'Our customer service team is available from nine in the morning to six in the evening on all weekdays.', question: 'What are the team hours?', options: ['24/7', '9 AM to 6 PM', '10 AM to 5 PM', 'Nights only'], answerIndex: 1, explanation: 'Customer service is available 9 AM to 6 PM on weekdays.' },
  { id: 's11', say: 'The invoice was sent to the client yesterday, and payment is due within fifteen working days.', question: 'When is payment due?', options: ['Yesterday', 'Within 15 working days', 'In 30 days', 'Immediately today'], answerIndex: 1, explanation: 'Payment is due within 15 working days.' },
  { id: 's12', say: 'Due to severe weather conditions, the afternoon flight to Delhi has been rescheduled to tomorrow morning.', question: 'Why was the flight rescheduled?', options: ['Technical failure', 'Severe weather conditions', 'Pilot absence', 'Airport closure'], answerIndex: 1, explanation: 'Rescheduled due to severe weather conditions.' },
  { id: 's13', say: 'Your new debit card PIN will arrive by SMS within two hours. Please do not share it with anyone.', question: 'How will the PIN arrive?', options: ['By email', 'By SMS within two hours', 'By post', 'At the branch'], answerIndex: 1, explanation: 'The PIN arrives by SMS within two hours.' },
  { id: 's14', say: 'Flight AI-202 is now boarding at gate nine. Passengers in rows twenty to thirty may board first.', question: 'Who boards first?', options: ['Everyone together', 'First class only', 'Rows 20 to 30', 'Nobody yet'], answerIndex: 2, explanation: 'Rows twenty to thirty board first.' },
  { id: 's15', say: 'Please note our support line is closed this Friday for scheduled maintenance. We reopen Monday at nine.', question: 'When does support reopen?', options: ['Friday evening', 'Saturday', 'Sunday', 'Monday at nine'], answerIndex: 3, explanation: 'Closed Friday, reopening Monday at nine.' },
  { id: 's16', say: 'You have used eighty percent of your monthly data. Top up now to avoid reduced speeds.', question: 'What happens without a top-up?', options: ['Reduced speeds', 'Free bonus data', 'Account closure', 'Nothing'], answerIndex: 0, explanation: 'Without top-up, speeds reduce after the data ends.' },
  { id: 's17', say: 'Your interview is scheduled for Tuesday at eleven in the morning. Please bring one photo ID and your résumé.', question: 'What must you bring?', options: ['Two passport photos', 'One photo ID and résumé', 'Nothing', 'Lunch'], answerIndex: 1, explanation: 'Bring one photo ID and the résumé.' },
  { id: 's18', say: 'Due to heavy rain, the six PM metro will run fifteen minutes late. We apologise for the inconvenience.', question: 'How late is the metro?', options: ['On time', 'One hour', '15 minutes', 'Cancelled'], answerIndex: 2, explanation: 'Fifteen minutes late, not cancelled.' },
  { id: 's19', say: 'The store closes at ten PM on weekdays and at eleven on weekends.', question: 'When does it close on Saturday?', options: ['11 PM', '10 PM', '9 PM', 'Midnight'], answerIndex: 0, explanation: 'Saturday is a weekend — eleven PM.' },
  { id: 's20', say: 'Your warranty covers parts for one year but not accidental damage. Extended cover costs twelve dollars.', question: 'What is NOT covered?', options: ['Parts', 'Labour', 'Delivery', 'Accidental damage'], answerIndex: 3, explanation: 'Accidental damage is excluded from the standard warranty.' },
];

export const READ_BANK: SpeechItem[] = [
  { id: 'r1', text: 'Good morning, thank you for calling customer support. How may I assist you today?', tip: 'Smile while you speak — it lifts the tone. Stress the greeting, not every word.' },
  { id: 'r2', text: 'I understand your concern, and I will do my best to resolve this as quickly as possible.', tip: 'Slow down on “resolve this as quickly as possible” — empathy lines must never sound rushed.' },
  { id: 'r3', text: 'Could you please confirm your registered email address and phone number for verification?', tip: 'Rise slightly on “please” — requests sound polite, not demanding.' },
  { id: 'r4', text: 'Your refund has been processed and should reflect within five to seven business days.', tip: 'Numbers carry the message — say each one clearly with a tiny pause.' },
  { id: 'r5', text: 'The supervisor confirmed that the training session will begin on Monday morning.', tip: 'Pronounce word endings clearly (-ed in confirmed, -ing in training).' },
  { id: 'r6', text: 'Our customer service team is available from nine in the morning to six in the evening.', tip: 'Keep a steady cadence across numbers and time prepositions.' },
  { id: 'r7', text: 'Your order will be delivered within five to seven working days by express courier.', tip: 'Enunciate consonants cleanly: express courier, working days.' },
  { id: 'r8', text: 'The weather has been unpredictable this week, so several regional flights were delayed.', tip: 'Stress the key words: unpredictable, regional flights, delayed.' },
  { id: 'r9', text: 'For security reasons, please do not share your one-time password with anyone.', tip: 'Firm but kind: this is a security reminder wrapped in professional courtesy.' },
  { id: 'r10', text: 'I have escalated your case to our senior team, and someone will call you back within twenty-four hours.', tip: 'End on a promise kept upbeat — reassure the caller of prompt follow-up.' },
  { id: 'r11', text: 'Please hold the line for a brief moment while I check your account details in the database.', tip: 'Warm and unhurried — holds are where callers evaluate agent confidence.' },
  { id: 'r12', text: 'Is there anything else I can assist you with before we conclude our call today?', tip: 'The standard Concentrix closer — open, unhurried, genuinely helpful.' },
];

export const REPEAT_BANK: SpeechItem[] = [
  { id: 'p1', text: 'The class starts at nine o\'clock.', tip: 'Short and crisp — match the exact rhythm and time.' },
  { id: 'p2', text: 'Could you please send me the details by this evening?', tip: 'Polite rising intonation on the request.' },
  { id: 'p3', text: 'The customer has requested a refund for the damaged product.', tip: 'Clear past participle: requested, damaged product.' },
  { id: 'p4', text: 'Although it was raining heavily, the team completed the delivery on time.', tip: 'Pause lightly after the comma clause; maintain momentum.' },
  { id: 'p5', text: 'We will review your application and get back to you within three working days.', tip: 'Land the commitment clearly: three working days.' },
  { id: 'p6', text: 'The bank opens at ten o\'clock every morning.', tip: 'Keep numbers and schedule crisp.' },
  { id: 'p7', text: 'Please confirm your address before we dispatch the parcel.', tip: 'Clear verb: confirm and dispatch.' },
  { id: 'p8', text: 'The manager has asked everyone to attend the training session on Thursday.', tip: 'Match the formal office cadence.' },
  { id: 'p9', text: 'Even though the traffic was heavy, she reached the office before the meeting began.', tip: 'Longer compound sentence — focus on the sequence of ideas.' },
  { id: 'p10', text: 'If you have any questions about your order, please contact our support team.', tip: 'Support team condition — speak with clarity.' },
  { id: 'p11', text: 'The new software update will be installed over the weekend.', tip: 'Clean passive voice: will be installed.' },
  { id: 'p12', text: 'The meeting has been rescheduled to Thursday afternoon.', tip: 'Notice “rescheduled to Thursday afternoon” — avoid saying prepone.' },
  { id: 'p13', text: 'Please hold the line while I check your account details.', tip: 'Standard call-centre hold phrase.' },
  { id: 'p14', text: 'Please keep your documents ready before the interview.', tip: 'Direct imperative: documents ready before the interview.' },
  { id: 'p15', text: 'Could you tell me where the nearest pharmacy is?', tip: 'Indirect question form with natural sentence rhythm.' },
  { id: 'p16', text: 'The package arrives on Thursday afternoon.', tip: 'Match the rhythm, not just the words.' },
];

export const SHORT_ANSWER_BANK: ShortAnswerItem[] = [
  { id: 'sa1', prompt: 'What do you use to write on a whiteboard?', answer: 'A marker.' },
  { id: 'sa2', prompt: 'How many days are in a week?', answer: 'Seven.' },
  { id: 'sa3', prompt: 'What do you wear on your feet?', answer: 'Shoes or socks.' },
  { id: 'sa4', prompt: 'Is ice hot or cold?', answer: 'Cold.' },
  { id: 'sa5', prompt: 'What device do you use to measure time?', answer: 'A clock or watch.' },
  { id: 'sa6', prompt: 'Which meal do you eat in the morning?', answer: 'Breakfast.' },
  { id: 'sa7', prompt: 'What do you drink in the morning?', answer: 'Tea or coffee.' },
  { id: 'sa8', prompt: 'How many legs does a dog have?', answer: 'Four.' },
  { id: 'sa9', prompt: 'What colour is the sky on a clear day?', answer: 'Blue.' },
  { id: 'sa10', prompt: 'Which device do you use to call someone?', answer: 'A phone.' },
  { id: 'sa11', prompt: 'What do you open a door with?', answer: 'A key.' },
  { id: 'sa12', prompt: 'How many months are in a year?', answer: 'Twelve.' },
  { id: 'sa13', prompt: 'What do you write with?', answer: 'A pen.' },
  { id: 'sa14', prompt: 'Is water wet or dry?', answer: 'Wet.' },
  { id: 'sa15', prompt: 'What do you eat soup with?', answer: 'A spoon.' },
  { id: 'sa16', prompt: 'Which day comes after Monday?', answer: 'Tuesday.' },
  { id: 'sa17', prompt: 'What do you wear in the rain?', answer: 'A raincoat.' },
  { id: 'sa18', prompt: 'How many wheels does a car have?', answer: 'Four.' },
];

export const JUMBLED_SENTENCES_BANK: JumbledItem[] = [
  { id: 'j1', jumbled: 'report / submit / the / please / by Friday', solution: 'Please submit the report by Friday.' },
  { id: 'j2', jumbled: 'postponed / was / meeting / the / due to rain', solution: 'The meeting was postponed due to rain.' },
  { id: 'j3', jumbled: 'ever / Have / visited / you / Hyderabad', solution: 'Have you ever visited Hyderabad?' },
  { id: 'j4', jumbled: 'waiting / the customer / for / is / a reply', solution: 'The customer is waiting for a reply.' },
  { id: 'j5', jumbled: 'the invoice / sent / was / to / client / the', solution: 'The invoice was sent to the client.' },
  { id: 'j6', jumbled: 'working / been / have / for / three / years / I / here', solution: 'I have been working here for three years.' },
  { id: 'j7', jumbled: 'attend / can / you / the / call / tomorrow', solution: 'Can you attend the call tomorrow?' },
  { id: 'j8', jumbled: 'delayed / because / flight / the / was / of / fog', solution: 'The flight was delayed because of fog.' },
  { id: 'j9', jumbled: 'not / the / answer / did / know / she', solution: 'She did not know the answer.' },
  { id: 'j10', jumbled: 'completed / has / she / training / the', solution: 'She has completed the training.' },
  { id: 'j11', jumbled: 'the bill / please / send / me', solution: 'Please send me the bill.' },
  { id: 'j12', jumbled: 'traffic / late / due / was / to / he', solution: 'He was late due to traffic.' },
  { id: 'j13', jumbled: 'new / joined / has / team / our / Rahul', solution: 'Rahul has joined our team.' },
  { id: 'j14', jumbled: 'the package / delivered / will / be / tomorrow', solution: 'The package will be delivered tomorrow.' },
  { id: 'j15', jumbled: 'speak / you / slowly / more / can', solution: 'Can you speak more slowly?' },
  { id: 'j16', jumbled: 'carefully / report / the / I / read', solution: 'I read the report carefully.' },
  { id: 'j17', jumbled: 'meeting / the / at / starts / ten', solution: 'The meeting starts at ten.' },
  { id: 'j18', jumbled: 'your / confirm / please / booking', solution: 'Please confirm your booking.' },
];

export const EXTEMPORE_TOPICS = [
  {
    topic: 'Punctuality in the Workplace',
    prepSec: 30,
    speakSec: 60,
    structure: 'Opening line → 2 points → 1 example → Closing line',
    modelAnswer: 'Punctuality means being on time for every task and commitment. It shows respect for other people\'s time and reflects a responsible attitude. In a workplace, being punctual helps teams complete work smoothly and builds trust with managers and customers. To conclude, being on time is a small habit that creates a big impression.',
  },
  {
    topic: 'Healthy Food Habits',
    prepSec: 30,
    speakSec: 60,
    structure: 'Opening line → 2 points → 1 example → Closing line',
    modelAnswer: 'Healthy eating keeps us active and focused throughout the day. Eating fruits and vegetables gives us long-lasting energy, while avoiding junk food protects our long-term health. When my cousin started eating home-cooked meals, his stamina improved significantly. Small daily food changes make a massive difference.',
  },
  {
    topic: 'Social Media: Boon or Bane?',
    prepSec: 30,
    speakSec: 60,
    structure: 'Opening line → 2 points → 1 example → Closing line',
    modelAnswer: 'Social media is a powerful tool with both advantages and disadvantages. On one hand, it connects friends and provides educational updates instantly. On the other hand, excessive screen time causes distractions and reduced sleep. If used with discipline and purpose, social media is a great boon.',
  },
  {
    topic: 'Handling an Angry Customer',
    prepSec: 30,
    speakSec: 60,
    structure: 'Opening line → 2 points → 1 example → Closing line',
    modelAnswer: 'Customer service requires patience and active empathy under pressure. When a caller is upset, the first step is listening without interrupting and validating their frustration. Once the customer feels heard, offering a prompt, transparent solution rebuilds their trust in the brand.',
  },
  {
    topic: 'Work From Home vs Work From Office',
    prepSec: 30,
    speakSec: 60,
    structure: 'Opening line → 2 points → 1 example → Closing line',
    modelAnswer: 'Both work models offer distinct advantages for employees. Remote work saves commuting hours and provides flexibility, while the office fosters immediate collaboration and strong team bonding. A balanced hybrid structure provides the best of both productivity and culture.',
  },
  {
    topic: 'A Skill You Want to Learn',
    prepSec: 30,
    speakSec: 60,
    structure: 'Opening line → why it matters → your plan → Closing line',
    modelAnswer: 'The skill I most want to learn is effective public speaking. It matters because clear speakers earn trust faster in every meeting and interview. My plan is simple: practise one short talk every week and record myself to track progress. Within months, nervousness turns into confidence.',
  },
  {
    topic: 'Importance of Teamwork',
    prepSec: 30,
    speakSec: 60,
    structure: 'Opening line → 2 points → 1 example → Closing line',
    modelAnswer: 'No meaningful work happens alone, which makes teamwork a career superpower. Good teams divide work by strength and catch each other’s mistakes early. During my college fest, our crew split stalls by skill and finished setup a day early. Teams win where individuals stall.',
  },
  {
    topic: 'My Favourite Festival',
    prepSec: 30,
    speakSec: 60,
    structure: 'Opening line → what happens → why it matters → Closing line',
    modelAnswer: 'My favourite festival is Diwali, the festival of lights. Homes glow with diyas, families share sweets, and entire streets feel celebratory for days. Beyond the fun, it reminds us that light always follows darkness. That message of hope is why I love it most.',
  },
  {
    topic: 'Dealing With Failure',
    prepSec: 30,
    speakSec: 60,
    structure: 'Opening line → 2 points → 1 example → Closing line',
    modelAnswer: 'Failure stings, but it teaches faster than any classroom. First, it exposes exactly which preparation gap caused the miss. Second, it builds the resilience every career demands. I once failed a mock test badly, fixed the weak chapters, and scored far higher next month.',
  },
  {
    topic: 'Why Customer Feedback Matters',
    prepSec: 30,
    speakSec: 60,
    structure: 'Opening line → 2 points → 1 example → Closing line',
    modelAnswer: 'Customer feedback is free consulting that companies ignore at their peril. It reveals pain points no internal meeting can surface. It also tells loyal customers their voice shapes the product. Firms that act on feedback keep customers; firms that don’t, lose them.',
  },
  {
    topic: 'Morning Routine of Successful People',
    prepSec: 30,
    speakSec: 60,
    structure: 'Opening line → 2 points → 1 example → Closing line',
    modelAnswer: 'Successful people treat mornings as launchpads, not snooze buttons. Waking early creates quiet hours for exercise and planning before chaos begins. Even thirty focused minutes compounds into hundreds of extra productive hours yearly. Win the morning and the day usually follows.',
  },
  {
    topic: 'Online Shopping: Pros and Cons',
    prepSec: 30,
    speakSec: 60,
    structure: 'Opening line → 2 points → 1 example → Closing line',
    modelAnswer: 'Online shopping trades instant gratification for unbeatable convenience and choice. Prices compare in seconds and reviews warn you before buying. The downsides are delivery waits and occasional quality surprises. Shop smart: check ratings, prefer easy returns, and never rush.',
  },
  {
    topic: 'A Leader You Admire',
    prepSec: 30,
    speakSec: 60,
    structure: 'Opening line → 2 qualities → 1 example → Closing line',
    modelAnswer: 'The leader I admire most is defined by calm ownership in crises. First, such leaders listen fully before deciding anything. Second, they credit the team for wins and absorb blame for losses. That combination earns loyalty no title alone can command.',
  },
  {
    topic: 'Importance of Listening',
    prepSec: 30,
    speakSec: 60,
    structure: 'Opening line → 2 points → 1 example → Closing line',
    modelAnswer: 'Listening is the most underrated professional skill in existence. Most people hear words while planning replies; great listeners absorb meaning and emotion. In support calls, thirty seconds of real listening defuses anger faster than any script. Listen first, solve second.',
  },
  {
    topic: 'My Hometown',
    prepSec: 30,
    speakSec: 60,
    structure: 'Opening line → what it looks like → why it matters → Closing line',
    modelAnswer: 'My hometown blends busy markets with unexpectedly quiet green corners. Mornings smell of fresh breakfast stalls and evening streets fill with familiar faces. Growing up there taught me community values no metro can replicate. Wherever I work, its lessons travel with me.',
  },
];

export interface MockCallStep {
  customer: string;
  agentOptions: {
    text: string;
    isCorrect: boolean;
    feedback: string;
  }[];
}

export interface MockCallScenario {
  id: string;
  title: string;
  description: string;
  steps: MockCallStep[];
}

export const MOCK_CALL_SCENARIOS: MockCallScenario[] = [
  {
    id: 'call-1',
    title: 'Delayed Phone Order (#458921)',
    description: 'A customer calls frustrated because their mobile phone has not arrived after a week.',
    steps: [
      {
        customer: 'Hello, I ordered a phone last week and it still has not arrived. What is going on?',
        agentOptions: [
          {
            text: 'I am sorry to hear that, and I understand how frustrating a delay can be. May I please have your order number so I can check the status right away?',
            isCorrect: true,
            feedback: 'Perfect! Acknowledged the feeling, apologised sincerely, and took immediate ownership.',
          },
          {
            text: 'It is not our fault, couriers get delayed. What is your order number?',
            isCorrect: false,
            feedback: 'Defensive and dismissive. Never blame third-party couriers to a customer.',
          },
          {
            text: 'Please hold the line.',
            isCorrect: false,
            feedback: 'Abrupt and impolite. Always ask permission and give a timeframe before placing a customer on hold.',
          },
        ],
      },
      {
        customer: 'My order number is 458921. I need it before Friday for my sister’s birthday.',
        agentOptions: [
          {
            text: 'Thank you for providing that. Please allow me a moment while I review your tracking status... I see the parcel has reached the local hub and is scheduled for out-for-delivery by Thursday afternoon. Would you like me to send you the live SMS tracking link?',
            isCorrect: true,
            feedback: 'Great! Reassured the customer, gave a verified concrete date, and provided extra proactive assistance.',
          },
          {
            text: 'Just track it online on the website yourself.',
            isCorrect: false,
            feedback: 'Unhelpful. Support agents must investigate the account rather than redirecting callers away.',
          },
          {
            text: 'I promise it will 100% come tomorrow morning.',
            isCorrect: false,
            feedback: 'Never make promises you cannot guarantee. Provide realistic verified information.',
          },
        ],
      },
      {
        customer: 'Yes, please send the SMS link. That is very reassuring, thank you.',
        agentOptions: [
          {
            text: 'I have sent the link to your registered mobile number. Is there anything else I can assist you with today? Thank you for contacting customer support, and have a wonderful day!',
            isCorrect: true,
            feedback: 'Exemplary closing! Confirmed execution, asked if anything else is needed, and closed warmly.',
          },
          {
            text: 'Okay, bye.',
            isCorrect: false,
            feedback: 'Too blunt. Always ask if further help is needed and thank the customer.',
          },
        ],
      },
    ],
  },
  {
    id: 'call-2',
    title: 'Damaged Product Replacement',
    description: 'A customer received a cracked tablet screen and demands an immediate replacement or refund.',
    steps: [
      {
        customer: 'I opened my package today and the tablet screen is completely cracked! I need an exchange immediately!',
        agentOptions: [
          {
            text: 'I am truly sorry to hear that your tablet arrived damaged. I completely understand your disappointment. Let me guide you through our expedited replacement process right now.',
            isCorrect: true,
            feedback: 'Excellent 4-step model response: active empathy followed by immediate action.',
          },
          {
            text: 'Did you open it carefully? Our warehouse packs everything safely.',
            isCorrect: false,
            feedback: 'Accusatory. Never question the customer’s integrity.',
          },
          {
            text: 'You have to email pictures and wait 14 days.',
            isCorrect: false,
            feedback: 'Cold and discouraging. Guide them through the fastest available resolution path.',
          },
        ],
      },
      {
        customer: 'How quickly can you dispatch a replacement unit?',
        agentOptions: [
          {
            text: 'Once we generate your prepaid return label, our priority dispatch will send out the replacement within 24 to 48 hours. I am creating that return request for you right now.',
            isCorrect: true,
            feedback: 'Clear, transparent timeline that builds confidence and eases anxiety.',
          },
          {
            text: 'Whenever the old one arrives back at our central depot.',
            isCorrect: false,
            feedback: 'Vague and evasive.',
          },
        ],
      },
    ],
  },
];

