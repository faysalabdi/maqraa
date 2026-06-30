import {
  Award,
  BookOpen,
  Flame,
  Footprints,
  Languages,
  ScrollText,
  Shuffle,
  Snowflake,
  Trophy,
  type LucideIcon,
} from "lucide-react";

// Maps the `icon` strings stored on the seeded achievements to lucide icons.
const MAP: Record<string, LucideIcon> = {
  footprints: Footprints,
  "book-open": BookOpen,
  "scroll-text": ScrollText,
  languages: Languages,
  trophy: Trophy,
  flame: Flame,
  snowflake: Snowflake,
  shuffle: Shuffle,
};

export function BadgeIcon({ name, className }: { name: string; className?: string }) {
  const Icon = MAP[name] ?? Award;
  return <Icon className={className} />;
}
