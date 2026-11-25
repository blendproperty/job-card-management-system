import { useRef, useState } from "react";
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";
import { color, T } from "./ui";
import { tokens } from "./theme/tokens";

/** components.md SignaturePad. Draws with react-native-svg so it works on iOS, Android and web. */
export function SignaturePad({ onChange, disabled }: { onChange: (svg: string | null) => void; disabled?: boolean }) {
  const [paths, setPaths] = useState<string[]>([]);
  const current = useRef<string>("");
  const size = useRef({ w: 300, h: 140 });
  const pathsRef = useRef<string[]>([]);

  const emit = (all: string[]) => {
    const { w, h } = size.current;
    onChange(all.length
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(w)} ${Math.round(h)}" width="${Math.round(w)}" height="${Math.round(h)}">` +
        all.map((d) => `<path d="${d}" fill="none" stroke="${tokens.color.text}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`).join("") +
        `</svg>`
      : null);
  };

  // View responder props directly (no PanResponder): works on iOS, Android and web.
  const point = (e: GestureResponderEvent) => `${e.nativeEvent.locationX.toFixed(1)} ${e.nativeEvent.locationY.toFixed(1)}`;
  const handlers = {
    onStartShouldSetResponder: () => !disabled,
    onMoveShouldSetResponder: () => !disabled,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      current.current = `M${point(e)}`;
      setPaths([...pathsRef.current, current.current]);
    },
    onResponderMove: (e: GestureResponderEvent) => {
      current.current += ` L${point(e)}`;
      setPaths([...pathsRef.current, current.current]);
    },
    onResponderRelease: () => {
      pathsRef.current = [...pathsRef.current, current.current];
      current.current = "";
      setPaths(pathsRef.current);
      emit(pathsRef.current);
    },
  };

  const clear = () => { pathsRef.current = []; setPaths([]); emit([]); };
  const onLayout = (e: LayoutChangeEvent) => { size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; };

  return (
    <View style={{ gap: 6 }}>
      <View
        accessibilityLabel="Customer signature. Draw with your finger."
        onLayout={onLayout}
        style={st.pad}
        {...handlers}
      >
        <Svg width="100%" height="100%" pointerEvents="none">
          {paths.map((d, i) => (
            <Path key={i} d={d} fill="none" stroke={color.text} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </Svg>
        {paths.length === 0 && <T muted style={st.hint} pointerEvents="none">Sign here</T>}
      </View>
      {paths.length > 0 && !disabled && (
        <T variant="sm" weight="semibold" style={{ color: color["accent-text"], alignSelf: "flex-end", padding: 6 }} onPress={clear} accessibilityRole="button">
          Clear
        </T>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  pad: {
    height: 140, borderWidth: 1.5, borderStyle: "dashed", borderColor: color["border-input"],
    borderRadius: tokens.radius.md, backgroundColor: color.bg, overflow: "hidden",
    // @ts-expect-error web-only: stop the page scrolling while signing
    touchAction: "none", userSelect: "none",
  },
  hint: { position: "absolute", alignSelf: "center", top: 58 },
});
