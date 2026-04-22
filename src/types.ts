// Core data model for the Before/After Visual Planner

export type ImageSide = "before" | "after";

export type AnnotationStatus =
  | "included"
  | "excluded"
  | "attention"
  | "completed"
  | "optional";

export type PinKind =
  | "standard"
  | "numbered"
  | "warning"
  | "check"
  | "issue";

export type ZoneShape = "rect" | "roundedRect";

export type AnnotationType = "pin" | "callout" | "zone";

export interface Annotation {
  id: string;
  imageSide: ImageSide;
  type: AnnotationType;
  // For pins / callouts: the anchor point. For zones: top-left.
  x: number;
  y: number;
  // Zones use width/height. Pins ignore.
  width?: number;
  height?: number;
  // Callouts: the position of the label box (x,y is the anchor point)
  labelX?: number;
  labelY?: number;
  // Pin-specific
  pinKind?: PinKind;
  pinNumber?: number;
  // Zone-specific
  zoneShape?: ZoneShape;
  opacity?: number;
  // Common
  title: string;
  note: string;
  status: AnnotationStatus;
  color: string;
  createdAt: number;
  updatedAt: number;
}

export type ProjectType =
  | "cleaning"
  | "landscaping"
  | "moving"
  | "organization"
  | "punchlist"
  | "general";

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  createdAt: number;
  updatedAt: number;
  beforeImageId?: string;
  afterImageId?: string;
  annotations: Annotation[];
  settings?: {
    defaultStatus?: AnnotationStatus;
  };
}

export const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: "cleaning", label: "Cleaning walkthrough" },
  { value: "landscaping", label: "Landscaping scope" },
  { value: "moving", label: "Moving prep" },
  { value: "organization", label: "Home organization" },
  { value: "punchlist", label: "Contractor punch list" },
  { value: "general", label: "General service review" },
];

export const STATUS_META: Record<
  AnnotationStatus,
  { label: string; color: string; badge: "success" | "error" | "warning" | "processing" | "default" }
> = {
  included: { label: "Included", color: "#1677ff", badge: "processing" },
  excluded: { label: "Excluded", color: "#8c8c8c", badge: "default" },
  attention: { label: "Needs attention", color: "#faad14", badge: "warning" },
  completed: { label: "Completed", color: "#52c41a", badge: "success" },
  optional: { label: "Optional", color: "#722ed1", badge: "default" },
};

export const PIN_KIND_META: Record<PinKind, { label: string; color: string }> = {
  standard: { label: "Pin", color: "#1677ff" },
  numbered: { label: "Numbered", color: "#1677ff" },
  warning: { label: "Warning", color: "#faad14" },
  check: { label: "Complete", color: "#52c41a" },
  issue: { label: "Issue", color: "#ff4d4f" },
};
