import { BookNode } from "./BookNode";
import { StageBanner } from "./StageBanner";
import type { LevelData } from "@/lib/db/queries/path";

export function PathSection({
  level,
  isLocked,
}: {
  level: LevelData;
  isLocked: boolean;
}) {
  const completedCount = level.books.filter((b) => b.status === "completed").length;

  return (
    <section>
      <StageBanner level={level} isLocked={isLocked} completedCount={completedCount} />

      <div className="relative mx-auto max-w-sm px-4 py-4">
        {/* Connector spine running down the middle of the winding path. */}
        <div
          aria-hidden
          className="absolute bottom-8 left-1/2 top-8 w-0.5 -translate-x-1/2 bg-border"
        />
        <div className="relative flex flex-col gap-7">
          {level.books.map((book, idx) => {
            const side = idx % 2 === 0 ? "right" : "left";
            return (
              <div
                key={book.id}
                className="flex"
                style={{ justifyContent: side === "right" ? "flex-start" : "flex-end" }}
              >
                <BookNode book={book} side={side} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
