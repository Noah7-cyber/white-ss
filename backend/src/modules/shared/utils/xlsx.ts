import { Response } from "express";
import ExcelJS from "exceljs";

export interface XlsxColumn {
  header: string;
  // Optional preferred column width (in Excel character units). Defaults to 22.
  width?: number;
}

export interface BuildXlsxOptions {
  sheetName?: string;
  columns: XlsxColumn[];
  rows: unknown[][];
  // Optional metadata that ends up in the workbook properties.
  creator?: string;
  title?: string;
}

export interface XlsxSheet {
  name: string;
  columns: XlsxColumn[];
  rows: unknown[][];
}

export interface BuildMultiSheetXlsxOptions {
  sheets: XlsxSheet[];
  creator?: string;
  title?: string;
}

// Excel cells generally cap text at 32,767 characters; trim long values so the
// workbook always opens cleanly.
const MAX_CELL_LENGTH = 32_000;

/**
 * Coerce arbitrary values into something Excel can render. Dates stay as Date
 * objects (so Excel formats them as dates), nullish values become empty
 * strings, and objects/arrays get JSON-stringified as a fallback.
 */
function normalizeCell(value: unknown): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.length > MAX_CELL_LENGTH ? value.slice(0, MAX_CELL_LENGTH) : value;
  }
  try {
    const json = JSON.stringify(value);
    return json.length > MAX_CELL_LENGTH ? json.slice(0, MAX_CELL_LENGTH) : json;
  } catch {
    return String(value);
  }
}

/**
 * Build an .xlsx workbook with a single styled sheet and return the raw bytes
 * ready to be written to the HTTP response.
 *
 * Style choices match the rest of the app's brand:
 *   - dark navy header row with white bold text
 *   - frozen header row + auto-filter so admins can sort/filter inside Excel
 *   - dates rendered as YYYY-MM-DD HH:MM
 */
export async function buildXlsxBuffer(options: BuildXlsxOptions): Promise<Buffer> {
  return buildMultiSheetXlsxBuffer({
    sheets: [
      {
        name: options.sheetName ?? "Sheet1",
        columns: options.columns,
        rows: options.rows,
      },
    ],
    ...(options.creator ? { creator: options.creator } : {}),
    ...(options.title ? { title: options.title } : {}),
  });
}

/**
 * Build an .xlsx workbook with one or more styled sheets. Used for reports
 * that need multiple tabs (e.g. summary + trend + per-student breakdown).
 */
export async function buildMultiSheetXlsxBuffer(
  options: BuildMultiSheetXlsxOptions,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = options.creator ?? "WhitePenguin";
  workbook.created = new Date();
  if (options.title) workbook.title = options.title;

  for (const sheetSpec of options.sheets) {
    const sheet = workbook.addWorksheet(sheetSpec.name || "Sheet1", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    sheet.columns = sheetSpec.columns.map((col) => ({
      header: col.header,
      width: col.width ?? 22,
    }));

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF02273A" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "left" };
    headerRow.height = 22;
    headerRow.commit();

    for (const row of sheetSpec.rows) {
      const normalized = sheetSpec.columns.map((_, idx) => normalizeCell(row[idx]));
      const added = sheet.addRow(normalized);
      normalized.forEach((value, idx) => {
        if (value instanceof Date) {
          added.getCell(idx + 1).numFmt = "yyyy-mm-dd hh:mm";
        }
      });
    }

    if (sheetSpec.columns.length > 0 && sheetSpec.rows.length > 0) {
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheetSpec.columns.length },
      };
    }

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      row.alignment = { vertical: "top", wrapText: false };
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function sanitizeXlsxFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function sendXlsx(res: Response, filename: string, buffer: Buffer): void {
  res.setHeader("Content-Type", XLSX_CONTENT_TYPE);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", String(buffer.byteLength));
  res.status(200).send(buffer);
}
