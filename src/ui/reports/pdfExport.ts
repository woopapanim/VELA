import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';

const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const PAGE_MARGIN_MM = 0;
const CONTENT_H_MM = PAGE_H_MM - PAGE_MARGIN_MM * 2;

/**
 * Export a report element to A4 PDF.
 *
 * Greedy-packs top-level sections onto each page: stacks the next section
 * on the current page if it still fits within A4, otherwise starts a new
 * page. Sections taller than a full page tile across consecutive pages.
 *
 * Keeps text rasterized (html2canvas) so Korean glyphs come through.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  filename: string,
  meta?: { title?: string; subject?: string },
): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({
    title: meta?.title ?? filename,
    subject: meta?.subject ?? 'VELA Spatial Simulation Report',
    creator: 'VELA',
    author: 'VELA',
  });

  const sections = Array.from(element.children) as HTMLElement[];
  let cursorY = PAGE_MARGIN_MM;
  let firstRendered = true;

  for (const section of sections) {
    if (!section.offsetHeight || !section.offsetWidth) continue;
    if (section.dataset.pdfSkip === 'true') continue;

    const canvas = await html2canvas(section, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: section.scrollWidth,
      windowHeight: section.scrollHeight,
    });

    const imgWidth = PAGE_W_MM - PAGE_MARGIN_MM * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    const title = sectionTitle(section);

    // Tall section: always starts a fresh page, then tiles.
    if (imgHeight > CONTENT_H_MM) {
      if (!firstRendered) pdf.addPage();
      firstRendered = false;
      const startPage = pdf.getNumberOfPages();

      let heightLeft = imgHeight;
      let position = PAGE_MARGIN_MM;
      pdf.addImage(dataUrl, 'JPEG', PAGE_MARGIN_MM, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= CONTENT_H_MM;
      while (heightLeft > 0) {
        position = PAGE_MARGIN_MM + (heightLeft - imgHeight);
        pdf.addPage();
        pdf.addImage(dataUrl, 'JPEG', PAGE_MARGIN_MM, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= CONTENT_H_MM;
      }
      cursorY = PAGE_H_MM; // force next section onto a new page
      if (title) pdf.outline.add(null, title, { pageNumber: startPage });
      continue;
    }

    // Regular section: pack on current page if it fits, else new page.
    const fitsOnCurrent = cursorY + imgHeight <= PAGE_H_MM - PAGE_MARGIN_MM;
    if (!fitsOnCurrent) {
      if (!firstRendered) pdf.addPage();
      cursorY = PAGE_MARGIN_MM;
    }
    firstRendered = false;

    const currentPage = pdf.getNumberOfPages();
    pdf.addImage(dataUrl, 'JPEG', PAGE_MARGIN_MM, cursorY, imgWidth, imgHeight, undefined, 'FAST');
    if (title) pdf.outline.add(null, title, { pageNumber: currentPage });
    cursorY += imgHeight;
  }

  pdf.save(filename);
}

function sectionTitle(section: HTMLElement): string | null {
  if (section.dataset.pdfTitle) return section.dataset.pdfTitle;
  const h2 = section.querySelector('h2');
  if (h2 && h2.textContent?.trim()) return h2.textContent.trim();
  const h1 = section.querySelector('h1');
  if (h1 && h1.textContent?.trim()) return h1.textContent.trim();
  return null;
}
