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

      <div className="relative mx-auto flex max-w-md flex-col gap-10 px-4 py-6">
        {level.books.map((book, idx) => {
          const side = idx % 2 === 0 ? "right" : "left";
          return (
            <div
              key={book.id}
              className="flex justify-center"
              style={{
                marginLeft: side === "right" ? "0" : "auto",
                marginRight: side === "right" ? "auto" : "0",
                paddingLeft: side === "right" ? "0" : "3rem",
                paddingRight: side === "right" ? "3rem" : "0",
              }}
            >
              <BookNode book={book} side={side} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
