export namespace JSONUtils {
  const SUSPECT_PROTO_RX = /"__proto__"\s*:/;
  const SUSPECT_CONSTRUCTOR_RX = /"constructor"\s*:/;

  export const secureParse = <T = unknown>(text: string): T => {
    const data = JSON.parse(text);

    if (data === null || typeof data !== "object") {
      return data;
    }

    if (!SUSPECT_PROTO_RX.test(text) && !SUSPECT_CONSTRUCTOR_RX.test(text)) {
      return data;
    }

    let next = [data];

    while (next.length) {
      const nodes = next;
      next = [];

      for (const node of nodes) {
        if (Object.hasOwn(node, "__proto__")) {
          throw new SyntaxError("Object contains forbidden prototype property");
        }

        if (Object.hasOwn(node, "constructor") && Object.hasOwn(node.constructor, "prototype")) {
          throw new SyntaxError("Object contains forbidden prototype property");
        }

        for (const key in node) {
          const value = node[key];
          if (value && typeof value === "object") {
            next.push(value);
          }
        }
      }
    }

    return data;
  };

  export const isParseable = (text: string) => {
    try {
      secureParse(text);
    } catch {
      return false;
    }

    return true;
  };
}
