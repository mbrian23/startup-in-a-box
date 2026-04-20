'use client';

import { QRCodeSVG } from 'qrcode.react';
import { palette } from '@/lib/palette';

type Props = { url: string; size?: number; label?: string };

export default function QrCode({ url, size = 220, label }: Props) {
  return (
    <div className="inline-flex flex-col items-center gap-2">
      <div className="p-3 dialog-box">
        <span className="pip-bl" />
        <span className="pip-br" />
        <QRCodeSVG
          value={url}
          size={size}
          bgColor={palette.bg}
          fgColor={palette.cream}
          level="M"
          marginSize={2}
        />
      </div>
      {label && <div className="font-pixel text-[11px] text-cream/90">{label}</div>}
    </div>
  );
}
