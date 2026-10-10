import { jsPDF } from 'jspdf';
import { SECTIONS } from '../types';
import { MATH_TOPICS, mathTopicName } from '../data/mathTopics';
import type { ScoreSheet } from './store';
import type { MathSession } from './mathStore';
import type { SpeakingReport } from './speakingStore';
import type { MockSession, MockTest } from '../data/mockInterview';

type RGB = [number, number, number];

const INK: RGB = [10, 22, 51];
const DARK: RGB = [22, 33, 58];
const BLUE: RGB = [27, 79, 160];
const BRIGHT: RGB = [77, 124, 254];
const GREEN: RGB = [30, 158, 98];
const RED: RGB = [214, 69, 69];
const MUTED: RGB = [91, 107, 136];
const FAINT: RGB = [182, 193, 214];
const BORDER: RGB = [223, 230, 242];
const PAGE_BG: RGB = [241, 244, 250];
const WHY_BG: RGB = [230, 237, 251];
const BODY: RGB = [60, 66, 80];

const PM = 12;
const PW = 210 - PM * 2;
const BOTTOM = 283;

function paintPage(doc: jsPDF) {
  doc.setFillColor(...PAGE_BG);
  doc.rect(0, 0, 210, 297, 'F');
}

function header(doc: jsPDF, title: string, sub: string) {
  doc.setFillColor(...INK);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setFillColor(...BRIGHT);
  doc.rect(0, 30, 210, 2.2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, PM, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(185, 199, 228);
  const subLines = (doc.splitTextToSize(sub, PW) as string[]).slice(0, 2);
  doc.text(subLines, PM, 21.5);
  doc.setTextColor(0, 0, 0);
  return 40;
}

function footer(doc: jsPDF) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Concentrix AMCAT Practice • page ${i}/${n}`, PM, 290);
  }
}

function sectionName(id: string): string {
  return SECTIONS.find((s) => s.id === id)?.name || id;
}

function ensureSpace(doc: jsPDF, y: number, need: number): number {
  if (y + need > BOTTOM) {
    doc.addPage();
    paintPage(doc);
    return 14;
  }
  return y;
}

/** One-page style result card: score, section table, verdict. */
export function downloadReport(sheet: ScoreSheet) {
  const doc = new jsPDF();
  let y = header(doc, 'AMCAT Practice — Test Report', `${sheet.username} • ${new Date(sheet.createdAt).toLocaleString()} • Set ${sheet.setId} • ${sheet.difficulty || 'medium'} • ${(sheet.origin || 'offline') === 'pyq' ? 'PYQ papers' : (sheet.origin || 'offline')}`);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...INK);
  doc.text(`${sheet.pct}%`, PM, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text(`${sheet.correct} correct out of ${sheet.total}  •  source: ${sheet.source}`, PM + 30, y + 11);
  doc.setTextColor(0, 0, 0);
  y += 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Section breakdown', PM, y);
  y += 6;
  for (const [id, s] of Object.entries(sheet.sections)) {
    const pct = s.t ? Math.round((s.c / s.t) * 100) : 0;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`${sectionName(id)}: ${s.c}/${s.t} (${pct}%)`, PM, y);
    doc.setDrawColor(200, 200, 200);
    doc.rect(PM + 90, y - 4, 80, 5);
    doc.setFillColor(pct >= 70 ? 30 : pct >= 50 ? 240 : 214, pct >= 70 ? 158 : pct >= 50 ? 180 : 69, pct >= 70 ? 98 : pct >= 50 ? 30 : 69);
    doc.rect(PM + 90, y - 4, Math.max(1, (80 * pct) / 100), 5, 'F');
    y += 9;
  }
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const verdict = sheet.pct >= 70 ? 'Excellent — ready for the real drive.' : sheet.pct >= 50 ? 'Good — revise weak sections and retry a new set.' : 'Keep practising — review the Q&A sheet, then retry.';
  doc.text(doc.splitTextToSize(`Verdict: ${verdict}`, PW), PM, y);
  footer(doc);
  doc.save(`amcat-report-${sheet.setId}.pdf`);
}

/** Designed answer script: score hero, section bands, option badges, why-boxes. */
export function downloadAnswerSheet(sheet: ScoreSheet) {
  const doc = new jsPDF();
  paintPage(doc);
  let y = header(
    doc,
    'AMCAT Practice — Answer Script',
    `${sheet.username} • ${new Date(sheet.createdAt).toLocaleString()} • Set ${sheet.setId} • ${sheet.difficulty || 'medium'} • ${(sheet.origin || 'offline') === 'pyq' ? 'PYQ papers' : (sheet.origin || 'offline')}`
  );

  // ---- score hero ----
  const heroH = 26;
  y = ensureSpace(doc, y, heroH + 4);
  doc.setDrawColor(...BORDER);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(PM, y, PW, heroH, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...INK);
  doc.text(`${sheet.pct}%`, PM + 6, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`${sheet.correct} correct out of ${sheet.total}`, PM + 30, y + 11);
  doc.setFontSize(9);
  doc.text('green = correct   •   red = your wrong pick', PM + 30, y + 17.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const diffLabel = sheet.difficulty || 'medium';
  const originLabel = (sheet.origin || 'offline') === 'pyq' ? 'PYQ papers' : sheet.origin || 'offline';
  const chip1 = diffLabel;
  const chip2 = originLabel;
  doc.setFontSize(8.5);
  const w2 = doc.getTextWidth(chip2) + 8;
  const w1 = doc.getTextWidth(chip1) + 8;
  let cx = PM + PW - 6 - w2;
  doc.setFillColor(...BLUE);
  doc.roundedRect(cx, y + 13.5, w2, 6.5, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(chip2, cx + 4, y + 18);
  cx -= w1 + 4;
  doc.setFillColor(...WHY_BG);
  doc.roundedRect(cx, y + 13.5, w1, 6.5, 3, 3, 'F');
  doc.setTextColor(...BLUE);
  doc.text(chip1, cx + 4, y + 18);
  y += heroH + 6;

  // ---- questions, grouped by section ----
  const indexed = sheet.questions.map((q, i) => ({ q, i }));
  for (const s of SECTIONS) {
    const group = indexed.filter(({ q }) => q.section === s.id);
    if (!group.length) continue;
    const correct = group.filter(({ q }) => sheet.answers[q.id] === q.answerIndex).length;
    const pct = Math.round((correct / group.length) * 100);

    const bandH = 11;
    y = ensureSpace(doc, y, bandH + 4);
    doc.setFillColor(...BLUE);
    doc.roundedRect(PM, y, PW, bandH, 2.5, 2.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(s.name, PM + 5, y + 7.4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const right = `${correct}/${group.length} • ${pct}%`;
    doc.text(right, PM + PW - 5 - doc.getTextWidth(right), y + 7.4);
    y += bandH + 4;

    for (const { q, i } of group) {
      y = questionCard(doc, q, i, sheet.answers[q.id], y);
    }
  }

  footer(doc);
  doc.save(`amcat-answers-${sheet.setId}.pdf`);
}

function questionCard(doc: jsPDF, q: any, qi: number, mine: number | undefined, y: number): number {
  const ok = mine === q.answerIndex;
  const pad = 5;
  const inner = PW - pad * 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const promptLines = doc.splitTextToSize(q.prompt, inner) as string[];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const optBlocks: string[][] = q.options.map((op: string) => doc.splitTextToSize(op, inner - 12) as string[]);

  doc.setFontSize(9.5);
  const whyLines = doc.splitTextToSize(q.explanation, inner - 6) as string[];

  const headH = 9;
  const promptH = promptLines.length * 5.3;
  const optsH = optBlocks.reduce((a: number, b: string[]) => a + b.length * 4.8 + 2.5, 0);
  const whyH = 3.5 + 4.5 + 1 + whyLines.length * 4.7 + 3.5;
  const total = 5 + headH + 2 + promptH + 3 + optsH + 3 + whyH + 5 + 4; // +4 slack

  y = ensureSpace(doc, y, total);
  const top = y;

  doc.setDrawColor(...BORDER);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(PM, y, PW, total, 3, 3, 'FD');
  doc.setFillColor(...(ok ? GREEN : RED));
  doc.rect(PM, y + 3, 1.8, total - 6, 'F');

  let cy = top + 5;

  // header row: Q pill + meta + status
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const qtag = `Q${qi + 1}`;
  const qw = doc.getTextWidth(qtag) + 8;
  doc.setFillColor(...INK);
  doc.roundedRect(PM + pad, cy - 4.4, qw, 6.4, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(qtag, PM + pad + 4, cy);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(`${sectionName(q.section)} • ${q.topic}`, PM + pad + qw + 3, cy);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...(ok ? GREEN : RED));
  const status = ok ? '✓ Correct' : '✗ Wrong';
  doc.text(status, PM + PW - pad - doc.getTextWidth(status), cy);
  cy += headH + 2;

  // prompt
  doc.setTextColor(...DARK);
  doc.setFontSize(11);
  doc.text(promptLines, PM + pad, cy, { lineHeightFactor: 1.35 } as any);
  cy += promptH + 3;

  // options
  q.options.forEach((op: string, oi: number) => {
    const lines = optBlocks[oi];
    const isRight = oi === q.answerIndex;
    const isMine = oi === mine;
    const ccx = PM + pad + 3;
    const ccy = cy + 2.6;
    if (isRight) {
      doc.setFillColor(...GREEN);
      doc.circle(ccx, ccy, 2.7, 'F');
      doc.setTextColor(255, 255, 255);
    } else if (isMine) {
      doc.setFillColor(...RED);
      doc.circle(ccx, ccy, 2.7, 'F');
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setDrawColor(...FAINT);
      doc.setFillColor(255, 255, 255);
      doc.circle(ccx, ccy, 2.7, 'FD');
      doc.setTextColor(...MUTED);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('ABCD'[oi], ccx - doc.getTextWidth('ABCD'[oi]) / 2, ccy + 1.1);
    doc.setFont('helvetica', isRight || isMine ? 'bold' : 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...(isRight ? GREEN : isMine ? RED : BODY));
    doc.text(lines, PM + pad + 9, cy + 1, { lineHeightFactor: 1.35 } as any);
    cy += lines.length * 4.8 + 2.5;
  });
  cy += 3;

  // why box
  const boxH = 3.5 + 4.5 + 1 + whyLines.length * 4.7 + 3.5;
  doc.setFillColor(...WHY_BG);
  doc.roundedRect(PM + pad, cy, inner, boxH, 2.5, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...BLUE);
  doc.text('WHY THIS ANSWER', PM + pad + 3, cy + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...DARK);
  doc.text(whyLines, PM + pad + 3, cy + 5 + 5.5, { lineHeightFactor: 1.4 } as any);

  return top + total;
}

/** Maths practice sheet: score hero, your-answer-vs-actual cards, speed tricks. */
export function downloadMathSheet(s: MathSession) {
  const doc = new jsPDF();
  paintPage(doc);
  let y = header(doc, 'Maths Practice — Answer Sheet', `${s.username} • ${new Date(s.at).toLocaleString()} • 40 questions • 10 AMCAT topics`);

  // hero
  const heroH = 26;
  y = ensureSpace(doc, y, heroH + 4);
  doc.setDrawColor(...BORDER);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(PM, y, PW, heroH, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...INK);
  doc.text(`${s.pct}%`, PM + 6, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`${s.correct} correct out of ${s.total}`, PM + 30, y + 11);
  doc.setFontSize(9);
  doc.text('green = correct   •   red = your wrong pick', PM + 30, y + 17.5);
  y += heroH + 6;

  // questions grouped by topic
  const indexed = s.questions.map((q, i) => ({ q: { ...q, topic: mathTopicName(q.topic) }, i }));
  for (const t of MATH_TOPICS) {
    const group = indexed.filter(({ q }) => q.section === 'quant' && s.questions.find((o) => o.id === (q as any).id && o.topic === t.id));
    if (!group.length) continue;
    const correct = group.filter(({ q }) => s.answers[(q as any).id] === (q as any).answerIndex).length;
    const pct = group.length ? Math.round((correct / group.length) * 100) : 0;
    const bandH = 11;
    y = ensureSpace(doc, y, bandH + 4);
    doc.setFillColor(...BLUE);
    doc.roundedRect(PM, y, PW, bandH, 2.5, 2.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(t.name, PM + 5, y + 7.4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const right = `${correct}/${group.length} • ${pct}%`;
    doc.text(right, PM + PW - 5 - doc.getTextWidth(right), y + 7.4);
    y += bandH + 4;
    for (const { q, i } of group) {
      y = questionCard(doc, q, i, s.answers[(q as any).id], y);
    }
  }

  // speed tricks
  const present = MATH_TOPICS.filter((t) => s.questions.some((q) => q.topic === t.id));
  if (present.length) {
    const rows = present.flatMap((t) => [
      doc.splitTextToSize(`${t.name}: ${t.trick}`, PW - 10) as string[],
    ]);
    const need = 12 + rows.reduce((a, r) => a + r.length * 5, 0) + 8;
    y = ensureSpace(doc, y, Math.min(need, 120));
    doc.setFillColor(...BLUE);
    doc.roundedRect(PM, y, PW, 11, 2.5, 2.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Speed tricks to keep', PM + 5, y + 7.4);
    y += 15;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    for (const lines of rows) {
      y = ensureSpace(doc, y, lines.length * 5 + 4);
      doc.text(lines, PM + 5, y);
      y += lines.length * 5 + 3;
    }
  }

  footer(doc);
  doc.save(`amcat-maths-${new Date(s.at).toISOString().slice(0, 10)}.pdf`);
}

/** Speaking session report: overall marks, per-item transcripts + marks + improvements. */
export function downloadSpeakingReport(r: SpeakingReport) {
  const doc = new jsPDF();
  paintPage(doc);
  let y = header(doc, 'Speaking Lab — Session Report', `${r.username} • ${new Date(r.at).toLocaleString()} • ${r.items.length} items`);

  const heroH = 26;
  y = ensureSpace(doc, y, heroH + 4);
  doc.setDrawColor(...BORDER);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(PM, y, PW, heroH, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...INK);
  doc.text(`${r.marks}/10`, PM + 6, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const scored = r.items.filter((i) => i.review).length;
  doc.text(`${scored} of ${r.items.length} items scored`, PM + 34, y + 11);
  doc.setFontSize(9);
  doc.text('clarity = pronunciation proxy, not an accent classifier', PM + 34, y + 17.5);
  y += heroH + 6;

  r.items.forEach((it, n) => {
    const rev = it.review;
    const head = `Item ${n + 1} • ${it.kind === 'read' ? 'Read aloud' : 'Repeat'} • ${it.secs}s${rev ? ` • ${rev.marks}/10` : ' • not scored'}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const headLines = doc.splitTextToSize(head, PW) as string[];
    const targetLines = doc.splitTextToSize(`Target: ${it.text}`, PW) as string[];
    const heardLines = doc.splitTextToSize(rev ? `Heard: ${rev.transcript}` : 'Heard: — (no recording submitted)', PW) as string[];
    const impLines = rev
      ? rev.improvements.slice(0, 3).flatMap((im) => doc.splitTextToSize(`• ${im}`, PW - 6) as string[])
      : [];
    const need = 6 + headLines.length * 5 + targetLines.length * 5 + heardLines.length * 5 + (impLines.length ? 6 + impLines.length * 5 : 0) + 8;
    y = ensureSpace(doc, y, Math.min(need, 140));
    const top = y;
    doc.setDrawColor(...BORDER);
    doc.setFillColor(255, 255, 255);
    // draw now, fill exact height after measuring (approx via need)
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(headLines, PM + 5, y + 5);
    y += 5 + headLines.length * 5;
    doc.setFont('helvetica', 'normal');
    doc.text(targetLines, PM + 5, y);
    y += targetLines.length * 5 + 2;
    doc.setTextColor(...MUTED);
    doc.text(heardLines, PM + 5, y);
    y += heardLines.length * 5 + 2;
    if (impLines.length) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...BLUE);
      doc.text('Improve:', PM + 5, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DARK);
      doc.text(impLines, PM + 5, y);
      y += impLines.length * 5;
    }
    const h = y - top + 4;
    doc.setDrawColor(...BORDER);
    doc.roundedRect(PM, top, PW, h, 3, 3, 'D');
    doc.setFillColor(...(rev && rev.marks >= 7 ? GREEN : rev ? RED : FAINT));
    doc.rect(PM, top + 3, 1.8, h - 6, 'F');
    y += 6;
  });

  footer(doc);
  doc.save(`amcat-speaking-${new Date(r.at).toISOString().slice(0, 10)}.pdf`);
}

/** Mock interview: session report (answers, time, flags, extempore marks) + full answer key. */
export function downloadMockReport(s: MockSession, test: MockTest) {
  const doc = new jsPDF();
  paintPage(doc);
  let y = header(doc, 'Mock Interview — Report & Answer Key', `${new Date(s.at).toLocaleString()} • ${s.testId || test.test_id}`);

  const heroH = 26;
  y = ensureSpace(doc, y, heroH + 4);
  doc.setDrawColor(...BORDER);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(PM, y, PW, heroH, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...INK);
  doc.text(`${s.answers}`, PM + 6, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text('answers recorded', PM + 30, y + 11);
  doc.setFontSize(9);
  const mins = Math.floor(s.durationSec / 60);
  doc.text(`${mins}m ${s.durationSec % 60}s run${s.flags ? ` • ${s.flags} tab ${s.flags === 1 ? 'switch' : 'switches'}` : ''}`, PM + 30, y + 17.5);
  y += heroH + 6;

  if (s.grades?.length) {
    y = ensureSpace(doc, y, 20);
    doc.setFillColor(...BLUE);
    doc.roundedRect(PM, y, PW, 11, 2.5, 2.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Extempore marks', PM + 5, y + 7.4);
    y += 15;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    for (const g of s.grades) {
      const lines = doc.splitTextToSize(`${g.label}: ${g.marks}/10`, PW - 10) as string[];
      y = ensureSpace(doc, y, lines.length * 5 + 3);
      doc.text(lines, PM + 5, y);
      y += lines.length * 5 + 2;
    }
    y += 4;
  }

  const secs = test.sections;
  const blocks: { title: string; lines: string[] }[] = [
    {
      title: 'Parts A–B • Expected answers',
      lines: [...secs.part_a, ...secs.part_b].flatMap((sc) =>
        sc.questions.map((qq, i) => `${sc.id.toUpperCase()} Q${i + 1}. ${qq.q} → ${qq.expected}`)
      ),
    },
    {
      title: 'Part F • Missing words',
      lines: secs.part_f.map((f) => `${f.id.toUpperCase()}. missing: ${f.missing.join(' / ')} → ${f.full}`),
    },
    {
      title: 'Part G • Corrections',
      lines: secs.part_g.map((g) => `${g.id.toUpperCase()}. ${g.corrected} — ${g.rule}`),
    },
  ];
  for (const b of blocks) {
    if (!b.lines.length) continue;
    y = ensureSpace(doc, y, 16);
    doc.setFillColor(...BLUE);
    doc.roundedRect(PM, y, PW, 11, 2.5, 2.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(b.title, PM + 5, y + 7.4);
    y += 15;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...DARK);
    for (const ln of b.lines) {
      const lines = doc.splitTextToSize(ln, PW - 10) as string[];
      y = ensureSpace(doc, y, lines.length * 4.8 + 2);
      doc.text(lines, PM + 5, y);
      y += lines.length * 4.8 + 1.5;
    }
    y += 4;
  }

  footer(doc);
  doc.save(`amcat-mock-${new Date(s.at).toISOString().slice(0, 10)}.pdf`);
}
