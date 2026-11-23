import { clueSet, runs } from "../../../shared/clues";
import type { Mark, Puzzle } from "../../../shared/types";

/**
 * Satisfied state for every row and column of the full puzzle. This is always
 * computed over complete lines -- clipping to a region would make a run that
 * crosses the border look finished when it is not.
 */
export function lineStatuses(puzzle: Puzzle, marks: Mark[]): boolean[] {
  const clues = clueSet(puzzle.size, puzzle.solution);
  return clues.map((clue, line) => {
    const values = Array.from({ length: puzzle.size }, (_, i) =>
      marks[
        line < puzzle.size
          ? line * puzzle.size + i
          : i * puzzle.size + line - puzzle.size
      ] === "filled"
        ? 1
        : 0,
    );
    return JSON.stringify(runs(values)) === JSON.stringify(clue);
  });
}
