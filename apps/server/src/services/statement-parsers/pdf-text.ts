import { HttpError } from "../../utils/http-error";

export interface PdfTextItem {
  page: number;
  text: string;
  x: number;
  y: number;
}

const PASSWORD_REQUIRED = 1;

/** Reads every piece of text with its position. The file and password stay in memory only. */
export async function readPdfText(file: Buffer, password?: string) {
  // pdfjs ships only as an ES module, and this server compiles to CommonJS.
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({
    data: new Uint8Array(file),
    disableFontFace: true,
    isEvalSupported: false,
    password,
    verbosity: 0,
  });
  try {
    const document = await task.promise;
    const items: PdfTextItem[] = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        items.push({
          page: number,
          text: item.str.trim(),
          x: item.transform[4] as number,
          y: item.transform[5] as number,
        });
      }
    }
    return items;
  } catch (error) {
    const { code, name } = error as { code?: number; name?: string };
    if (name === "PasswordException") {
      throw new HttpError(
        400,
        code === PASSWORD_REQUIRED
          ? "This PDF is locked. Enter its password."
          : "The PDF password is incorrect",
      );
    }
    throw new HttpError(422, "This file can't be read as a PDF");
  } finally {
    await task.destroy();
  }
}
