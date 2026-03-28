import structuredClone from "@ungap/structured-clone";
import { Platform } from "react-native";

if (Platform.OS !== "web") {
  const setupPolyfills = async () => {
    const { polyfillGlobal } = await import("react-native/Libraries/Utilities/PolyfillFunctions");
    const { TextDecoderStream, TextEncoderStream } = await import("@stardazed/streams-text-encoding");

    if (!("structuredClone" in global)) {
      polyfillGlobal("structuredClone", () => structuredClone);
    }

    polyfillGlobal("TextDecoderStream", () => TextDecoderStream);
    polyfillGlobal("TextEncoderStream", () => TextEncoderStream);
  };

  setupPolyfills();
}

export {};
