import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';

const PAGE_W_MM = 210;
const PAGE_H_MM = 297;

/**
 * Export a report element to A4 PDF, one top-level section per page-set.
 *
 * Each immediate child (header, section) is rasterized separately so a
 * section is never split mid-content unless its own height exceeds one
 * page — in which case it tiles cleanly across pages from its start.
 * Adds an outline bookmark per section using its h2 title, plus PDF
 * metadata, so the document is browsable rather than one opaque scroll.
 *
 * Text remains rasterized (html2canvas) — Korean glyphs come through
 * because the browser already rendered them before capture.
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

    const imgWidth = PAGE_W_MM;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    if (!firstRendered) pdf.addPage();
    firstRendered = false;

    const startPage = pdf.getNumberOfPages();

    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(dataUrl, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= PAGE_H_MM;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(dataUrl, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= PAGE_H_MM;
    }

    const title = sectionTitle(section) ?? `Section ${pdf.getNumberOfPages()}`;
    pdf.outline.add(null, title, { pageNumber: startPage });
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
