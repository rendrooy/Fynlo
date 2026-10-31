export interface Hsv {
  /** 0 to 360. */
  h: number;
  /** 0 to 1. */
  s: number;
  /** 0 to 1. */
  v: number;
}

const channels = (hex: string) =>
  [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255) as [
    number,
    number,
    number,
  ];

export function hexToHsv(hex: string): Hsv {
  const [r, g, b] = channels(hex);
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta + 6) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  return { h: h * 60, s: max === 0 ? 0 : delta / max, v: max };
}

export function hsvToHex({ h, s, v }: Hsv) {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    const value = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`;
}

/** Whether dark marks read better than white ones on this color. */
export function isLightColor(hex: string) {
  const [r, g, b] = channels(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.65;
}
