export async function convertPdfToImages(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const images: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const unscaledViewport = page.getViewport({ scale: 1.0 });

    // Calculate scale factor so maximum long-edge dimension is capped at 1500px
    const maxDimension = Math.max(unscaledViewport.width, unscaledViewport.height);
    const targetScale = maxDimension > 1500 ? 1500 / maxDimension : 1.5;

    const viewport = page.getViewport({ scale: targetScale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) continue;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    }).promise;

    images.push(canvas.toDataURL("image/jpeg", 0.85));
  }

  return images;
}

export async function extractPdfText(file: File): Promise<string> {
  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: unknown) => (item && typeof item === "object" && "str" in item ? String((item as { str: unknown }).str) : ""))
        .join(" ");
      fullText += pageText + "\n";
    }

    return fullText.trim();
  } catch (err) {
    console.warn("Failed to extract text from PDF directly:", err);
    return "";
  }
}
