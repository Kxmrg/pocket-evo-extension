import QRCode from 'qrcode';
import { QR_ERROR_CORRECTION_LEVEL } from '../domain/payload';

export async function drawQrCanvas(canvas: HTMLCanvasElement, text: string, width: number): Promise<void> {
  await QRCode.toCanvas(canvas, text, {
    width,
    margin: 4,
    errorCorrectionLevel: QR_ERROR_CORRECTION_LEVEL,
    color: { dark: '#17233a', light: '#fff' },
  });
}
