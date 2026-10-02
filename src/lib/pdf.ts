import { jsPDF } from 'jspdf';
import { SECTIONS } from '../types';
import type { ScoreSheet } from './store';

const M = 14;
const W = 210 - M * 2;

function header(doc: jsPDF, title: string, sub: string) {
  doc.setFillColor(27, 79, 160);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(title, M, 13);
  doc.setFontSize(10);
  doc.text(sub, M, 21);
  doc.setTextColor(0, 0, 0);
  return 38;
}

function footer(doc: jsPDF) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Concentrix AMCAT Practice • page ${i}/${n}`, M, 290);
  }
}

function sectionName(id: string): string {
  return SECTIONS.find((s) => s.id === id)?.name || id;
}

/** One-page style result card: score, section table, verdict. */
export function downloadReport(sheet: ScoreSheet) {
  const doc = new jsPDF();
  let y = header(doc, 'AMCAT Practice — Test Report', `${sheet.username} • ${new Date(sheet.createdAt).toLocaleString()} • Set ${sheet.setId} • ${sheet.difficulty || 'medium'} • ${(sheet.origin || 'offline') === 'pyq' ? 'PYQ papers' : (sheet.origin || 'offline')}`);
  doc.setFontSize(26);
  doc.text(`${sheet.pct}%`, M, y + 12);
  doc.setFontSize(11);
  doc.text(`${sheet.correct} correct out of ${sheet.total}  •  source: ${sheet.source}`, M + 30, y + 11);
  y += 22;
  doc.setFontSize(12);
  doc.text('Section breakdown', M, y);
  y += 6;
  for (const [id, s] of Object.entries(sheet.sections)) {
    const pct = s.t ? Math.round((s.c / s.t) * 100) : 0;
    doc.setFontSize(11);
    doc.text(`${sectionName(id)}: ${s.c}/${s.t} (${pct}%)`, M, y);
    doc.setDrawColor(200, 200, 200);
    doc.rect(M + 90, y - 4, 80, 5);
    doc.setFillColor(pct >= 70 ? 30 : pct >= 50 ? 240 : 214, pct >= 70 ? 158 : pct >= 50 ? 180 : 69, pct >= 70 ? 98 : pct >= 50 ? 30 : 69);
    doc.rect(M + 90, y - 4, Math.max(1, (80 * pct) / 100), 5, 'F');
    y += 9;
  }
  y += 4;
  doc.setFontSize(11);
  const verdict = sheet.pct >= 70 ? 'Excellent — ready for the real drive.' : sheet.pct >= 50 ? 'Good — revise weak sections and retry a new set.' : 'Keep practising — review the Q&A sheet, then retry.';
  doc.text(doc.splitTextToSize(`Verdict: ${verdict}`, W), M, y);
  footer(doc);
  doc.save(`amcat-report-${sheet.setId}.pdf`);
}

/** Full Q&A study sheet: every question, options (correct marked), your answer, explanation. */
export function downloadAnswerSheet(sheet: ScoreSheet) {
  const doc = new jsPDF();
  let y = header(doc, 'AMCAT Practice — Answer Sheet', `${sheet.username} • Set ${sheet.setId} • ${sheet.correct}/${sheet.total} (${sheet.pct}%) • ${sheet.difficulty || 'medium'}`);
  sheet.questions.forEach((q, i) => {
    const mine = sheet.answers[q.id];
    const lines: string[] = [];
    lines.push(`Q${i + 1} [${sectionName(q.section)} • ${q.topic}] ${mine === q.answerIndex ? '(correct)' : '(wrong)'}`);
    lines.push(q.prompt);
    q.options.forEach((op, oi) => {
      const mark = oi === q.answerIndex ? '[CORRECT]' : oi === mine ? '[YOUR ANSWER]' : '           ';
      lines.push(`${mark} ${'ABCD'[oi]}. ${op}`);
    });
    lines.push(`Why: ${q.explanation}`);
    const block = doc.splitTextToSize(lines.join('\n'), W) as string[];
    const need = block.length * 5 + 4;
    if (y + need > 282) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(10);
    doc.text(block, M, y);
    y += need;
    doc.setDrawColor(220, 220, 220);
    doc.line(M, y - 2, M + W, y - 2);
    y += 2;
  });
  footer(doc);
  doc.save(`amcat-answers-${sheet.setId}.pdf`);
}
