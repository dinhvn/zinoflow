import React from "react";
import { resolveGrid, type ImageProps, type CellLayout } from "@zinoflow/contracts";
import { Cell } from "./Cell";

/**
 * Grid dong theo perImage (k) — spec §6. rows*cols tu resolveGrid (single source of truth).
 * O thieu (anh cuoi N khong chia het k) -> de trong, giu khung grid.
 */
export const Grid: React.FC<{ props: ImageProps; cellLayout: CellLayout; gap: number }> = ({ props, cellLayout, gap }) => {
  const grid = resolveGrid(props.perImage, props.aspect);
  const totalCells = grid.rows * grid.cols;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
        gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
        gap,
        padding: gap,
      }}
    >
      {Array.from({ length: totalCells }, (_, i) => {
        const product = props.products[i];
        if (!product) return <div key={i} />;
        return (
          <Cell
            key={product.id}
            product={product}
            style={props.style}
            visibility={props.visibility}
            batchFit={props.imageFit}
            cellLayout={cellLayout}
          />
        );
      })}
    </div>
  );
};
