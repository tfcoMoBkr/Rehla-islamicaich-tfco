import { describe, expect, it } from "vitest";

import { cleanSvg, prefixSvgIds, svgIds } from "./scene-svg";

const drawing = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" role="img" aria-labelledby="t" xmlns:c2pa="http://c2pa.org/manifest"><metadata><c2pa:manifest>AAAA</c2pa:manifest></metadata><title id="t">A sun</title><defs><linearGradient id="sky"/></defs><rect fill="url(#sky)"/><g id="sun"><circle r="2"/></g></svg>`;

describe("scene drawings", () => {
  it("drop their metadata and title and become decorative", () => {
    const svg = cleanSvg(drawing, "sun.svg");
    expect(svg).not.toContain("metadata");
    expect(svg).not.toContain("<title");
    expect(svg).not.toContain("aria-labelledby");
    expect(svg).toContain('aria-hidden="true"');
    expect(svgIds(svg)).toEqual(["sky", "sun"]);
  });

  it("refuse scripts, event handlers and external links", () => {
    for (const unsafe of [
      '<svg><script>alert(1)</script></svg>',
      '<svg onload="alert(1)"></svg>',
      '<svg><a href="https://example.org"><rect/></a></svg>',
      '<svg><foreignObject/></svg>',
    ]) {
      expect(() => cleanSvg(unsafe, "bad.svg")).toThrow();
    }
  });

  it("prefix ids and the references to them", () => {
    const svg = prefixSvgIds(cleanSvg(drawing, "sun.svg"), "scene-sun-");
    expect(svgIds(svg)).toEqual(["scene-sun-sky", "scene-sun-sun"]);
    expect(svg).toContain("url(#scene-sun-sky)");
  });
});
