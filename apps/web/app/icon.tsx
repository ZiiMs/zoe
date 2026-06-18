import { ImageResponse } from "next/og";

export const alt = "Zoe";
export const size = {
  width: 32,
  height: 32
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#181817",
        color: "#f4dca8",
        display: "flex",
        fontSize: 20,
        fontWeight: 800,
        height: "100%",
        justifyContent: "center",
        width: "100%"
      }}
    >
      Z
    </div>,
    size
  );
}
