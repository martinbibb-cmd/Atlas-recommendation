export interface PhoneQaViewportV1 {
  readonly id: 'iphone' | 'android_narrow';
  readonly label: string;
  readonly width: number;
  readonly height: number;
}

export const PHONE_QA_VIEWPORTS: readonly PhoneQaViewportV1[] = [
  {
    id: 'iphone',
    label: 'iPhone width',
    width: 390,
    height: 844,
  },
  {
    id: 'android_narrow',
    label: 'Android narrow width',
    width: 360,
    height: 800,
  },
] as const;

export const PHONE_QA_SAFE_AREA_TOKENS = [
  '--customer-safe-top',
  '--customer-safe-right',
  '--customer-safe-bottom',
  '--customer-safe-left',
] as const;
