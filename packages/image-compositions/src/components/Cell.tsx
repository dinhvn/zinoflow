import React from "react";
import { Img } from "remotion";
import {
  formatPriceVnd,
  formatDiscountPercent,
  resolveImageFit,
  type ProductCell,
  type ImageStyle,
  type VisibilityFlags,
  type ImageFit,
  type CellLayout,
} from "@zinoflow/contracts";

/**
 * 1 o san pham trong grid — spec §7, §7.1.
 * Anh dung object-fit cover + objectPosition (pan) + scale (zoom) tu imageFit da resolve
 * (override rieng o > global). Tat ca theo % -> parity Player/worker o moi size.
 */
export const Cell: React.FC<{
  product: ProductCell;
  style: ImageStyle;
  visibility: VisibilityFlags;
  batchFit: ImageFit;
  cellLayout: CellLayout;
}> = ({ product, style, visibility, batchFit, cellLayout }) => {
  const fit = resolveImageFit(product, batchFit);
  // offset -1..1 -> object-position 0..100% (pan truc bi cover crop, vd anh dai).
  const posX = ((fit.offsetX + 1) / 2) * 100;
  const posY = ((fit.offsetY + 1) / 2) * 100;
  // Khi zoom (scale>1), anh duoc phong to o giua -> objectPosition khong pan duoc.
  // Translate trong vung overflow do zoom tao ra (gap-free, clamp toi bien) de keo
  // duoc CA HAI truc khi zoom. panFraction = (s-1)/(2s) tinh theo kich thuoc element.
  const panFraction = fit.scale > 1 ? (fit.scale - 1) / (2 * fit.scale) : 0;
  const tx = -fit.offsetX * panFraction * 100;
  const ty = -fit.offsetY * panFraction * 100;

  const price = formatPriceVnd(product.salePrice ?? product.originalPrice);
  const original = formatPriceVnd(product.originalPrice);
  const showStrike =
    visibility.showOriginalPrice && product.salePrice != null && product.originalPrice != null && product.salePrice < product.originalPrice;
  const discount = formatDiscountPercent(product.discountPercent);

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#fff",
        border: visibility.showCellBorder && style.borderWidth > 0 ? `${style.borderWidth}px solid ${style.borderColor}` : undefined,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <Img
          src={product.imageUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: `${posX}% ${posY}%`,
            transform: `scale(${fit.scale}) translate(${tx}%, ${ty}%)`,
            transformOrigin: "center",
          }}
        />

        {visibility.showBadge && discount && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              backgroundColor: style.accentColor,
              color: "#fff",
              fontWeight: 700,
              fontSize: 22,
              padding: "2px 10px",
              borderRadius: 6,
            }}
          >
            {discount}
          </div>
        )}

        {cellLayout === "price-overlay" && (visibility.showName || (visibility.showSalePrice && price)) && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "8px 10px",
              background: "linear-gradient(transparent, rgba(0,0,0,0.72))",
              color: "#fff",
            }}
          >
            {visibility.showName && (
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  lineHeight: 1.2,
                  marginBottom: 2,
                  maxHeight: "2.4em",
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {product.name}
              </div>
            )}
            {visibility.showSalePrice && price && (
              <div style={{ fontWeight: 700, fontSize: 26 }}>
                <span style={{ color: "#fff" }}>{price}</span>
                {showStrike && (
                  <span style={{ marginLeft: 8, fontSize: 18, opacity: 0.8, textDecoration: "line-through" }}>{original}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {cellLayout === "caption-below" && (
        <div style={{ padding: "6px 8px", backgroundColor: style.backgroundColor }}>
          {visibility.showName && (
            <div
              style={{
                fontSize: 20,
                lineHeight: 1.2,
                maxHeight: "2.4em",
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {product.name}
            </div>
          )}
          {visibility.showSalePrice && price && (
            <div style={{ marginTop: 2 }}>
              <span style={{ color: style.priceColor, fontWeight: 700, fontSize: 24 }}>{price}</span>
              {showStrike && (
                <span style={{ marginLeft: 6, fontSize: 16, color: "#888", textDecoration: "line-through" }}>{original}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
