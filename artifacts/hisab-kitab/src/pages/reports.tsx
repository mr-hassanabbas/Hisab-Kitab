import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { BarChart3, ChevronDown, FileDown, FileSpreadsheet, MessageCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PKR = (n: unknown) => `PKR ${Number(n || 0).toLocaleString("en-PK")}`;
const COLORS = ["#F59E0B", "#3B82F6", "#10B981", "#EF4444", "#8B5CF6", "#EC4899"];

function styleHeader(row: ExcelJS.Row, bgColor = "FF1E293B") {
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF94A3B8" } },
    };
  });
  row.height = 22;
}

function styleAmberHeader(row: ExcelJS.Row) {
  styleHeader(row, "FFF59E0B");
  row.eachCell((cell) => { cell.font = { bold: true, color: { argb: "FF1E293B" }, size: 11 }; });
}

import { useLanguage } from "@/hooks/use-language";

export default function Reports() {
  const { t } = useLanguage();
  const [projectId, setProjectId] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [excelLoading, setExcelLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: projectsData } = useQuery({ queryKey: ["projects"], queryFn: () => fetchApi("/projects?limit=100") });

  const { data: reportData, isLoading } = useQuery({
    queryKey: ["report", projectId, dateRange.start, dateRange.end],
    queryFn: () => fetchApi(`/reports/project/${projectId}?${dateRange.start ? `start_date=${dateRange.start}&` : ""}${dateRange.end ? `end_date=${dateRange.end}` : ""}`),
    enabled: !!projectId,
  });

  const projects: Record<string, unknown>[] = projectsData?.data ?? [];
  const report = reportData?.data;
  const fin = report?.financials as Record<string, unknown> | undefined;

  const costData = fin ? [
    { name: "Labour", value: Number(fin.total_wages ?? 0) },
    { name: "Materials", value: Number(fin.total_materials ?? 0) },
    { name: "Expenses", value: Number(fin.total_expenses ?? 0) },
    { name: "Equipment", value: Number(fin.total_equipment ?? 0) },
  ].filter((d) => d.value > 0) : [];

  const labourRows: Record<string, unknown>[] = report?.labour ?? [];
  const materialRows: Record<string, unknown>[] = report?.materials ?? [];
  const expenseRows: Record<string, unknown>[] = report?.expenses ?? [];
  const equipmentRows: Record<string, unknown>[] = report?.equipment ?? [];
  const paymentRows: Record<string, unknown>[] = report?.owner_payments ?? report?.payments ?? [];

  const selectedProject = projects.find((p) => String(p.id) === projectId);

  // ── Excel Export ────────────────────────────────────────────────
  const handleExportExcel = async () => {
    if (!report || !fin) return;
    setExcelLoading(true);
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = "Hisab Kitab";
      wb.created = new Date();

      const projectName = String(selectedProject?.name ?? "Project");
      const projectCode = String(selectedProject?.project_code ?? "");
      const dateLabel = dateRange.start
        ? `${dateRange.start}${dateRange.end ? " to " + dateRange.end : ""}`
        : "All time";

      // ── Sheet 1: Summary ────────────────────────────────────────
      const ws0 = wb.addWorksheet(t("summary"));
      ws0.columns = [{ width: 32 }, { width: 22 }];
      const titleRow = ws0.addRow(["Hisab Kitab — حساب کتاب", ""]);
      titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: "FFF59E0B" } };
      ws0.addRow([projectName, projectCode]);
      ws0.addRow(["Period", dateLabel]);
      ws0.addRow([]);
      const sumHeader = ws0.addRow([t("category"), t("agreement") + " (PKR)"]);
      styleAmberHeader(sumHeader);
      const sumRows: [string, number][] = [
        [t("labour_wages"), Number(fin.total_wages ?? 0)],
        [t("materials_title"), Number(fin.total_materials ?? 0)],
        [t("equipment_title"), Number(fin.total_equipment ?? 0)],
        [t("daily_expenses"), Number(fin.total_expenses ?? 0)],
        ["", 0],
        [t("total_cost"), Number(fin.total_cost ?? 0)],
        [t("received"), Number(fin.total_received ?? 0)],
        [t("balance"), Number(fin.profit ?? 0)],
        [t("agreement"), Number(fin.agreement_amount ?? 0)],
      ];
      sumRows.forEach(([label, val]) => {
        if (!label) { ws0.addRow([]); return; }
        const r = ws0.addRow([label, val]);
        r.getCell(2).numFmt = "#,##0";
        if (label === t("total_cost")) r.getCell(2).font = { bold: true, color: { argb: "FFDC2626" } };
        if (label === t("received")) r.getCell(2).font = { bold: true, color: { argb: "FF16A34A" } };
        if (label === t("balance")) {
          const isPositive = Number(fin.profit ?? 0) >= 0;
          r.getCell(2).font = { bold: true, color: { argb: isPositive ? "FF16A34A" : "FFDC2626" } };
        }
      });

      // ── Sheet 2: Labour ─────────────────────────────────────────
      if (labourRows.length > 0) {
        const ws1 = wb.addWorksheet("Labour");
        ws1.columns = [
          { header: "Worker", width: 24 },
          { header: "Phone", width: 16 },
          { header: "Daily Wage (PKR)", width: 18 },
          { header: "Present Days", width: 14 },
          { header: "Half Days", width: 12 },
          { header: "Absent Days", width: 12 },
          { header: "Total Wages (PKR)", width: 18 },
          { header: "Advance (PKR)", width: 16 },
        ];
        styleHeader(ws1.getRow(1));
        labourRows.forEach((l) => {
          const r = ws1.addRow([
            String(l.name ?? ""),
            String(l.phone ?? ""),
            Number(l.daily_wage ?? 0),
            Number(l.present_days ?? 0),
            Number(l.half_days ?? 0),
            Number(l.absent_days ?? 0),
            Number(l.total_wages ?? 0),
            Number(l.total_advance ?? 0),
          ]);
          [3, 7, 8].forEach((ci) => { r.getCell(ci).numFmt = "#,##0"; });
        });
        // Totals row
        const totalsR = ws1.addRow([
          "TOTAL", "", "",
          labourRows.reduce((s, l) => s + Number(l.present_days ?? 0), 0),
          labourRows.reduce((s, l) => s + Number(l.half_days ?? 0), 0),
          labourRows.reduce((s, l) => s + Number(l.absent_days ?? 0), 0),
          labourRows.reduce((s, l) => s + Number(l.total_wages ?? 0), 0),
          labourRows.reduce((s, l) => s + Number(l.total_advance ?? 0), 0),
        ]);
        totalsR.font = { bold: true };
        [7, 8].forEach((ci) => { totalsR.getCell(ci).numFmt = "#,##0"; });
      }

      // ── Sheet 3: Materials ──────────────────────────────────────
      if (materialRows.length > 0) {
        const ws2 = wb.addWorksheet("Materials");
        ws2.columns = [
          { header: "Material Type", width: 28 },
          { header: "Total Quantity", width: 18 },
          { header: "Total Cost (PKR)", width: 20 },
        ];
        styleHeader(ws2.getRow(1));
        materialRows.forEach((m) => {
          const r = ws2.addRow([
            String(m.material_type ?? ""),
            Number(m.total_qty ?? 0),
            Number(m.total_cost ?? 0),
          ]);
          r.getCell(3).numFmt = "#,##0";
        });
        const totR = ws2.addRow([
          "TOTAL", "",
          materialRows.reduce((s, m) => s + Number(m.total_cost ?? 0), 0),
        ]);
        totR.font = { bold: true };
        totR.getCell(3).numFmt = "#,##0";
      }

      // ── Sheet 4: Equipment ──────────────────────────────────────
      if (equipmentRows.length > 0) {
        const ws3 = wb.addWorksheet("Equipment");
        ws3.columns = [
          { header: "Equipment", width: 28 },
          { header: "Total Days", width: 14 },
          { header: "Total Cost (PKR)", width: 20 },
        ];
        styleHeader(ws3.getRow(1));
        equipmentRows.forEach((e) => {
          const r = ws3.addRow([
            String(e.equipment_name ?? ""),
            Number(e.total_days ?? 0),
            Number(e.total_cost ?? 0),
          ]);
          r.getCell(3).numFmt = "#,##0";
        });
        const totR = ws3.addRow([
          "TOTAL", "",
          equipmentRows.reduce((s, e) => s + Number(e.total_cost ?? 0), 0),
        ]);
        totR.font = { bold: true };
        totR.getCell(3).numFmt = "#,##0";
      }

      // ── Sheet 5: Expenses ───────────────────────────────────────
      if (expenseRows.length > 0) {
        const ws4 = wb.addWorksheet("Expenses");
        ws4.columns = [
          { header: "Category", width: 28 },
          { header: "Total (PKR)", width: 20 },
        ];
        styleHeader(ws4.getRow(1));
        expenseRows.forEach((e) => {
          const r = ws4.addRow([String(e.category ?? ""), Number(e.total ?? 0)]);
          r.getCell(2).numFmt = "#,##0";
        });
        const totR = ws4.addRow([
          "TOTAL",
          expenseRows.reduce((s, e) => s + Number(e.total ?? 0), 0),
        ]);
        totR.font = { bold: true };
        totR.getCell(2).numFmt = "#,##0";
      }

      // ── Download ────────────────────────────────────────────────
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectCode || "report"}-${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExcelLoading(false);
    }
  };

  // ── PDF Export (jsPDF + autoTable) ──────────────────────────────
  const handleExportPdf = () => {
    if (!report || !fin) return;
    setPdfLoading(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const projectName = String(selectedProject?.name ?? "Project");
      const projectCode = String(selectedProject?.project_code ?? "");
      const ownerName = String(selectedProject?.owner_name ?? "");
      const dateLabel = dateRange.start
        ? `${dateRange.start}${dateRange.end ? " to " + dateRange.end : ""}`
        : "All time";
      const generated = new Date().toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" });
      const agreementAmt = Number(fin.agreement_amount ?? 0);

      const addHeaderFooter = (data: any) => {
        const pageW = doc.internal.pageSize.width;
        const pageH = doc.internal.pageSize.height;
        
        // Header Banner
        doc.setFillColor(245, 158, 11); // Amber #F59E0B
        doc.rect(0, 0, pageW, 18, "F");
        
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text("Hisab Kitab", 14, 12);
        
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text("حساب کتاب", pageW - 14, 12, { align: "right" });
        
        // Footer
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        const pageNumber = 1; // Simple page number for now
        doc.text(
          `Hisab Kitab — Construction Management  |  Generated: ${generated}  |  Page ${pageNumber}`,
          pageW / 2, pageH - 8, { align: "center" }
        );
      };

      let y = 25;

      // Better Project Info Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.roundedRect(14, y, 182, 28, 2, 2, "FD");
      
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.text(projectName, 19, (y += 8));
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`Code: ${projectCode}  |  Owner: ${ownerName || "N/A"}  |  Period: ${dateLabel}`, 19, (y += 7));
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(`Agreement Amount: PKR ${agreementAmt.toLocaleString("en-PK")}`, 19, (y += 7));
      
      y += 12;

      // Profit/Loss Callout Box
      const balance = Number(fin.total_received ?? 0) - Number(fin.total_cost ?? 0);
      const isProfit = balance >= 0;
      doc.setFillColor(isProfit ? 240 : 254, isProfit ? 253 : 242, isProfit ? 244 : 242); // green-50 / red-50
      doc.setDrawColor(isProfit ? 187 : 252, isProfit ? 247 : 165, isProfit ? 208 : 165); // green-200 / red-200
      doc.roundedRect(14, y, 182, 16, 2, 2, "FD");
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(isProfit ? 22 : 220, isProfit ? 163 : 38, isProfit ? 74 : 38); // green-600 / red-600
      const balanceText = `${isProfit ? 'Surplus / Balance' : 'Deficit / Shortfall'}: PKR ${Math.abs(balance).toLocaleString("en-PK")}`;
      doc.text(balanceText, 105, y + 10, { align: "center" });
      
      y += 24;

      const tableOptions = {
        headStyles: { fillColor: [245, 158, 11] as [number, number, number], textColor: [30, 41, 59] as [number, number, number], fontStyle: "bold" as any, fontSize: 9 }, // Amber header
        alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] }, // slate-50
        footStyles: { fillColor: [226, 232, 240] as [number, number, number], textColor: [30, 41, 59] as [number, number, number], fontStyle: "bold" as any, fontSize: 9 }, // slate-200 for totals
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14, top: 22, bottom: 20 },
        didDrawPage: addHeaderFooter,
      };

      // Financial summary table
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text(t("summary"), 14, y);
      y += 3;
      autoTable(doc, {
        startY: y,
        head: [[t("category"), `${t("total")} (PKR)`]],
        body: [
          [t("labour_wages"), Number(fin.total_wages ?? 0).toLocaleString("en-PK")],
          [t("materials_title"), Number(fin.total_materials ?? 0).toLocaleString("en-PK")],
          [t("equipment_title"), Number(fin.total_equipment ?? 0).toLocaleString("en-PK")],
          [t("daily_expenses"), Number(fin.total_expenses ?? 0).toLocaleString("en-PK")],
          [t("total_cost"), Number(fin.total_cost ?? 0).toLocaleString("en-PK")],
          [t("received"), Number(fin.total_received ?? 0).toLocaleString("en-PK")],
          [t("balance"), (Number(fin.total_received ?? 0) - Number(fin.total_cost ?? 0)).toLocaleString("en-PK")],
          [t("agreement"), Number(fin.agreement_amount ?? 0).toLocaleString("en-PK")],
        ],
        ...tableOptions,
        columnStyles: { 1: { halign: "right" } },
        didParseCell: (data) => {
          if (data.section === "body" && data.row.index === 4) { // total cost
            data.cell.styles.fontStyle = "bold" as any;
            data.cell.styles.textColor = [220, 38, 38] as [number, number, number];
          }
          if (data.section === "body" && data.row.index === 5) { // received
            data.cell.styles.fontStyle = "bold" as any;
            data.cell.styles.textColor = [22, 163, 74] as [number, number, number];
          }
        },
      });

      // Owner Payments table
      if (paymentRows.length > 0) {
        const afterFin = (doc as any).lastAutoTable.finalY + 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.text(t("owner_payments") || "Owner Payments", 14, afterFin);
        autoTable(doc, {
          startY: afterFin + 3,
          head: [[t("date"), t("payment_method"), t("notes"), `${t("amount_pkr")} (PKR)`]],
          body: paymentRows.map((p) => [
            String(p.date ?? ""),
            String(p.payment_method ?? ""),
            String(p.notes ?? ""),
            Number(p.amount ?? 0).toLocaleString("en-PK")
          ]),
          foot: [[
            t("total"), "", "", 
            paymentRows.reduce((s, p) => s + Number(p.amount ?? 0), 0).toLocaleString("en-PK")
          ]],
          ...tableOptions,
          columnStyles: { 3: { halign: "right" } },
        });
      }

      // Labour table
      if (labourRows.length > 0) {
        const afterPrev = (doc as any).lastAutoTable.finalY + 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.text(`${t("labour")} ${t("summary")}`, 14, afterPrev);
        autoTable(doc, {
          startY: afterPrev + 3,
          head: [[t("worker"), t("present"), t("half_days"), t("absent"), `${t("total_cost")} (PKR)`, `${t("advance")} (PKR)`]],
          body: labourRows.map((l) => [
            String(l.name ?? ""),
            String(Number(l.present_days ?? 0)),
            String(Number(l.half_days ?? 0)),
            String(Number(l.absent_days ?? 0)),
            Number(l.total_wages ?? 0).toLocaleString("en-PK"),
            Number(l.total_advance ?? 0).toLocaleString("en-PK"),
          ]),
          foot: [[
            t("total"), "", "", "",
            labourRows.reduce((s, l) => s + Number(l.total_wages ?? 0), 0).toLocaleString("en-PK"),
            labourRows.reduce((s, l) => s + Number(l.total_advance ?? 0), 0).toLocaleString("en-PK"),
          ]],
          ...tableOptions,
          columnStyles: { 4: { halign: "right" }, 5: { halign: "right" } },
        });
      }

      // Materials table
      if (materialRows.length > 0) {
        const afterPrev = (doc as any).lastAutoTable.finalY + 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.text(t("materials_title"), 14, afterPrev);
        autoTable(doc, {
          startY: afterPrev + 3,
          head: [[t("materials_title"), `${t("total_cost")} (PKR)`]],
          body: materialRows.map((m) => [String(m.material_type ?? ""), Number(m.total_cost ?? 0).toLocaleString("en-PK")]),
          foot: [[
            t("total"),
            materialRows.reduce((s, m) => s + Number(m.total_cost ?? 0), 0).toLocaleString("en-PK"),
          ]],
          ...tableOptions,
          columnStyles: { 1: { halign: "right" } },
        });
      }

      // Equipment table
      if (equipmentRows.length > 0) {
        const afterPrev = (doc as any).lastAutoTable.finalY + 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.text(t("equipment_title"), 14, afterPrev);
        autoTable(doc, {
          startY: afterPrev + 3,
          head: [[t("equipment_title"), `${t("total_cost")} (PKR)`]],
          body: equipmentRows.map((e) => [String(e.equipment_name ?? ""), Number(e.total_cost ?? 0).toLocaleString("en-PK")]),
          foot: [[
            t("total"),
            equipmentRows.reduce((s, e) => s + Number(e.total_cost ?? 0), 0).toLocaleString("en-PK"),
          ]],
          ...tableOptions,
          columnStyles: { 1: { halign: "right" } },
        });
      }

      // Expenses table
      if (expenseRows.length > 0) {
        const afterPrev = (doc as any).lastAutoTable.finalY + 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.text(`${t("expenses_title")} — ${t("category")}`, 14, afterPrev);
        autoTable(doc, {
          startY: afterPrev + 3,
          head: [[t("category"), `${t("total")} (PKR)`]],
          body: expenseRows.map((e) => [String(e.category ?? ""), Number(e.total ?? 0).toLocaleString("en-PK")]),
          foot: [[
            t("total"),
            expenseRows.reduce((s, e) => s + Number(e.total ?? 0), 0).toLocaleString("en-PK"),
          ]],
          ...tableOptions,
          columnStyles: { 1: { halign: "right" } },
        });
      }

      // Signature Lines
      const finalY = (doc as any).lastAutoTable.finalY + 30;
      // Ensure there's space for signatures
      if (finalY > doc.internal.pageSize.height - 40) {
        doc.addPage();
        // The header/footer is drawn automatically by didDrawPage except on manual addPage if we don't call it ourselves, 
        // actually didDrawPage is only called by autoTable. So we should call it manually here.
        addHeaderFooter({ doc });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        
        doc.line(20, 50, 80, 50);
        doc.text("Owner Signature", 35, 56);
        
        doc.line(130, 50, 190, 50);
        doc.text("Thekedar Signature", 143, 56);
      } else {
        doc.setDrawColor(156, 163, 175);
        doc.line(20, finalY, 80, finalY);
        doc.text("Owner Signature", 35, finalY + 6);
        
        doc.line(130, finalY, 190, finalY);
        doc.text("Thekedar Signature", 143, finalY + 6);
      }

      const safeName = projectName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      doc.save(`hisab-kitab_${safeName}_${dateRange.start || "report"}.pdf`);
    } finally {
      setPdfLoading(false);
    }
  };


  // ── WhatsApp Share ──────────────────────────────────────────────
  const handleWhatsAppShare = () => {
    if (!report || !fin) return;
    const projectName = String(selectedProject?.name ?? 'Project');
    const projectCode = String(selectedProject?.project_code ?? '');
    const ownerName   = String(selectedProject?.owner_name ?? '');
    const dateLabel   = dateRange.start
      ? dateRange.start + (dateRange.end ? ' to ' + dateRange.end : '')
      : 'All time';
    const balance = Number(fin.total_received ?? 0) - Number(fin.total_cost ?? 0);
    const balanceLabel = balance >= 0
      ? 'Surplus: PKR ' + balance.toLocaleString('en-PK')
      : 'Deficit: PKR ' + Math.abs(balance).toLocaleString('en-PK');
    const lines = [
      '*Hisab Kitab — Project Report*',
      '━━━━━━━━━━━━━━━━━━━━━━━━',
      '📋 *' + projectName + '* (' + projectCode + ')',
      ownerName ? '👤 Owner: ' + ownerName : '',
      '📅 Period: ' + dateLabel,
      '',
      '*Financial Summary*',
      '💰 Received from Owner: PKR ' + Number(fin.total_received ?? 0).toLocaleString('en-PK'),
      '👷 Labour Wages:    PKR ' + Number(fin.total_wages ?? 0).toLocaleString('en-PK'),
      '🧱 Materials:       PKR ' + Number(fin.total_materials ?? 0).toLocaleString('en-PK'),
      '🏗️ Equipment:       PKR ' + Number(fin.total_equipment ?? 0).toLocaleString('en-PK'),
      '🧾 Expenses:        PKR ' + Number(fin.total_expenses ?? 0).toLocaleString('en-PK'),
      '📊 Total Cost:      PKR ' + Number(fin.total_cost ?? 0).toLocaleString('en-PK'),
      '',
      '*' + balanceLabel + '*',
    ];
    if (labourRows.length > 0) {
      lines.push('', '*Labour (' + labourRows.length + ' workers)*');
      labourRows.slice(0, 5).forEach((l) => {
        lines.push('• ' + l.name + ': ' + l.present_days + 'd present — PKR ' + Number(l.total_wages ?? 0).toLocaleString('en-PK'));
      });
      if (labourRows.length > 5) lines.push('  … and ' + (labourRows.length - 5) + ' more');
    }
    lines.push('', '_Generated by Hisab Kitab — حساب کتاب_');
    const text = lines.filter(Boolean).join("\n");
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-foreground">{t("project_reports")}</h1>
        {report && (
          <div className="flex gap-2 flex-wrap justify-end">
            <Button size="sm" variant="outline" onClick={handleWhatsAppShare} data-testid="btn-whatsapp-report"
              className="text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20">
              <MessageCircle className="w-4 h-4 mr-1.5" /> {t("whatsapp")}
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={excelLoading} data-testid="btn-export-excel">
              <FileSpreadsheet className="w-4 h-4 mr-1.5" />
              {excelLoading ? "Generating…" : t("export_excel")}
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportPdf} disabled={pdfLoading} data-testid="btn-export-pdf">
              <FileDown className="w-4 h-4 mr-1.5" />
              {pdfLoading ? "Generating…" : t("export_pdf")}
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-foreground mb-1">Project</label>
          <div className="relative">
            <select data-testid="select-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}
              className="w-full pl-3 pr-8 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none appearance-none">
              <option value="">Select project...</option>
              {projects.map((p: Record<string, unknown>) => <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">From</label>
          <input type="date" value={dateRange.start} onChange={(e) => setDateRange((r) => ({ ...r, start: e.target.value }))}
            className="px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">To</label>
          <input type="date" value={dateRange.end} onChange={(e) => setDateRange((r) => ({ ...r, end: e.target.value }))}
            className="px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none" />
        </div>
      </div>

      {!projectId ? (
        <div className="text-center py-16 text-muted-foreground">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Select a project to generate report</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">{[1,2,3].map((i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : report && fin ? (
        <div className="space-y-5">
          <div ref={printRef} id="print-report">
            {/* Header */}
            <div className="bg-card border border-border rounded-xl p-4 mb-5">
              <h2 className="font-bold text-foreground text-base mb-0.5">{String(selectedProject?.name ?? "")}</h2>
              <div className="text-xs text-muted-foreground font-mono">
                {String(selectedProject?.project_code ?? "")} · Owner: {String(selectedProject?.owner_name ?? "")}
                {dateRange.start && ` · ${dateRange.start}${dateRange.end ? " → " + dateRange.end : ""}`}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: "Total Cost", value: fin.total_cost ?? 0, color: "text-red-600" },
                { label: "Received", value: fin.total_received ?? 0, color: "text-green-600" },
                { label: "Balance", value: Number(fin.total_received ?? 0) - Number(fin.total_cost ?? 0), color: Number(fin.total_received ?? 0) >= Number(fin.total_cost ?? 0) ? "text-green-600" : "text-red-600" },
                { label: "Agreement", value: fin.agreement_amount ?? 0, color: "text-primary" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-card border border-border rounded-xl p-3 text-center">
                  <div className={`text-lg font-bold ${color}`}>{PKR(Math.abs(Number(value)))}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Cost Breakdown */}
            <div className="bg-card border border-border rounded-xl p-4 mb-5">
              <h3 className="font-semibold text-foreground text-sm mb-3">Cost Breakdown</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Labour Wages", value: fin.total_wages ?? 0 },
                  { label: "Materials", value: fin.total_materials ?? 0 },
                  { label: "Daily Expenses", value: fin.total_expenses ?? 0 },
                  { label: "Equipment", value: fin.total_equipment ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <div className="text-sm font-semibold text-foreground">{PKR(value)}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
              {costData.length > 0 && (
                <div className="grid md:grid-cols-2 gap-6 items-center">
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={costData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {costData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => PKR(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={costData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                        <Tooltip formatter={(v: number) => PKR(v)} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {costData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Labour */}
            {labourRows.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4 mb-5">
                <h3 className="font-semibold text-foreground text-sm mb-3">Labour Summary</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {["Worker","Present","Half Days","Absent","Total Wages","Advance"].map((h) => (
                          <th key={h} className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground last:pr-0">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {labourRows.map((l, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="py-2 pr-4 font-medium text-foreground">{String(l.name)}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{Number(l.present_days ?? 0)}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{Number(l.half_days ?? 0)}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{Number(l.absent_days ?? 0)}</td>
                          <td className="py-2 pr-4 font-medium">{PKR(l.total_wages)}</td>
                          <td className="py-2 text-orange-600">{PKR(l.total_advance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Materials */}
            {materialRows.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4 mb-5">
                <h3 className="font-semibold text-foreground text-sm mb-3">Materials</h3>
                <div className="space-y-2">
                  {materialRows.map((m, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <span className="text-sm text-foreground">{String(m.material_type)}</span>
                      <span className="text-sm font-medium">{PKR(m.total_cost)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Equipment */}
            {equipmentRows.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4 mb-5">
                <h3 className="font-semibold text-foreground text-sm mb-3">Equipment</h3>
                <div className="space-y-2">
                  {equipmentRows.map((e, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <span className="text-sm text-foreground">{String(e.equipment_name)}</span>
                      <span className="text-sm font-medium">{PKR(e.total_cost)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expenses */}
            {expenseRows.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="font-semibold text-foreground text-sm mb-3">Expenses by Category</h3>
                <div className="space-y-2">
                  {expenseRows.map((e, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <span className="text-sm text-foreground">{String(e.category)}</span>
                      <span className="text-sm font-medium">{PKR(e.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
