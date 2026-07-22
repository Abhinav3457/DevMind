export function exportAsCSV(data: Record<string, unknown>[], fileName: string): void {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0] as Record<string, unknown>);
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')
    ),
  ].join('\n');

  downloadBlob(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), `${fileName}.csv`);
}

export function exportAsJSON(data: unknown, fileName: string): void {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadBlob(new Blob([jsonContent], { type: 'application/json;charset=utf-8;' }), `${fileName}.json`);
}

export function exportAsText(content: string, fileName: string): void {
  downloadBlob(new Blob([content], { type: 'text/plain;charset=utf-8;' }), `${fileName}.txt`);
}

export function exportAsPNG(element: HTMLElement, fileName: string): void {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(element.offsetWidth * 2, 800);
  canvas.height = Math.max(element.offsetHeight * 2, 600);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Analytics Dashboard', 20, 50);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Generated: ${new Date().toLocaleString()}`, 20, 80);
    ctx.fillStyle = '#64748b';
    ctx.font = '12px sans-serif';
    ctx.fillText('For full PNG export, install html2canvas', 20, 110);
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${fileName}.png`);
    });
  }
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
