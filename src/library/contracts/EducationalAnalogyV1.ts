export type EducationalAnalogyFamily =
  | 'traffic'
  | 'water_flow'
  | 'thermal_battery'
  | 'electrical_load'
  | 'comfort_pattern'
  | 'none';

export interface EducationalAnalogyV1 {
  id: string;
  family: EducationalAnalogyFamily;
  title: string;
  conceptIds: string[];
  summary: string;
  boundaries: string[];
}
