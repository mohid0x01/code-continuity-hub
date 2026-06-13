import { jsPDF } from "jspdf";

export interface CourtReportData {
  caseNumber: string;
  incidentType?: string | null;
  incidentDate?: string | null;
  city?: string | null;
  area?: string | null;
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  narrative: string;
  entities: Array<{ label: string; entity_type: string; entity_role: string | null; confidence: number | null }>;
  events: Array<{ sequence_number: number; description: string | null; action_label?: string | null }>;
  videoUrl?: string | null;
  createdAt?: string;
}

export function exportCourtReportPDF(d: CourtReportData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const MARGIN = 48;
  let y = MARGIN;

  const line = (text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number } = {}) => {
    const { size = 10, bold = false, color = [20, 20, 20], gap = 4 } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const split = doc.splitTextToSize(text, PAGE_W - MARGIN * 2);
    for (const ln of split) {
      if (y > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; }
      doc.text(ln, MARGIN, y);
      y += size + gap;
    }
  };
  const rule = () => {
    doc.setDrawColor(180, 150, 60);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 12;
  };

  // Header
  doc.setFillColor(8, 8, 8);
  doc.rect(0, 0, PAGE_W, 70, "F");
  doc.setTextColor(201, 168, 76);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("SCENEIQ — OFFICIAL COURT REPORT", MARGIN, 42);
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 180);
  doc.text("Government of Pakistan · Police Department", MARGIN, 58);
  y = 100;

  line(`Case Number: ${d.caseNumber}`, { bold: true, size: 12 });
  line(`Incident Type: ${(d.incidentType ?? "—").toUpperCase()}`);
  line(`Incident Date: ${d.incidentDate ?? "—"}`);
  line(`Report Generated: ${d.createdAt ?? new Date().toISOString()}`);
  y += 6; rule();

  line("LOCATION", { bold: true, size: 11, color: [180, 150, 60] });
  line(`City / District: ${d.city ?? "—"}`);
  line(`Area: ${d.area ?? "—"}`);
  line(`Address: ${d.formattedAddress ?? "—"}`);
  if (d.latitude && d.longitude) line(`Coordinates: ${d.latitude.toFixed(6)}, ${d.longitude.toFixed(6)}`);
  y += 6; rule();

  line("FIR NARRATIVE", { bold: true, size: 11, color: [180, 150, 60] });
  line(d.narrative || "—");
  y += 6; rule();

  line("SCENE ENTITIES", { bold: true, size: 11, color: [180, 150, 60] });
  if (d.entities.length === 0) line("None extracted.");
  for (const e of d.entities) {
    line(`• ${e.label} — ${e.entity_type}${e.entity_role ? ` (${e.entity_role})` : ""} · confidence ${((e.confidence ?? 0) * 100).toFixed(0)}%`);
  }
  y += 6; rule();

  line("EVENT TIMELINE", { bold: true, size: 11, color: [180, 150, 60] });
  if (d.events.length === 0) line("No events reconstructed.");
  for (const ev of d.events) {
    line(`${ev.sequence_number}. ${ev.action_label ?? ""} — ${ev.description ?? ""}`);
  }

  if (d.videoUrl) {
    y += 6; rule();
    line("AI 3D RECONSTRUCTION VIDEO", { bold: true, size: 11, color: [180, 150, 60] });
    line(d.videoUrl);
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`SceneIQ Court Report · ${d.caseNumber} · Page ${i} of ${pageCount}`, MARGIN, PAGE_H - 20);
  }

  doc.save(`court-report-${d.caseNumber}.pdf`);
}