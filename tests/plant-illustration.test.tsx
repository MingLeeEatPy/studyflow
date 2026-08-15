import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlantIllustration } from "../src/components/PlantIllustration";

describe("多株植物 SVG", () => {
  it("每株树和花使用唯一渐变 ID，叶片与花瓣引用自己的定义", () => {
    const { container } = render(<>
      <PlantIllustration kind="tree" stage={4} />
      <PlantIllustration kind="tree" stage={4} />
      <PlantIllustration kind="flower" stage={4} />
      <PlantIllustration kind="flower" stage={4} />
      <PlantIllustration kind="flower" stage={3} />
    </>);
    const ids = [...container.querySelectorAll("[id]")].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const leaves of container.querySelectorAll<SVGGElement>(".tree-leaves")) {
      const reference = leaves.style.fill.match(/#([^)]+)/)?.[1];
      expect(reference).toBeTruthy();
      expect(container.querySelector(`[id="${reference}"]`)).not.toBeNull();
    }
    for (const petal of container.querySelectorAll<SVGElement>(".petal")) {
      const reference = petal.style.fill.match(/#([^)]+)/)?.[1];
      expect(reference).toBeTruthy();
      expect(container.querySelector(`[id="${reference}"]`)).not.toBeNull();
    }
    expect(container.querySelector(".bud")?.getAttribute("style")).toContain("url(#petal-");
    for (const element of container.querySelectorAll<SVGElement>("svg *")) {
      const references = [element.getAttribute("style"), element.getAttribute("stroke"), element.getAttribute("filter")]
        .flatMap((value) => [...(value ?? "").matchAll(/url\(#([^)]+)\)/g)].map((match) => match[1]));
      for (const reference of references) expect(container.querySelector(`[id="${reference}"]`)).not.toBeNull();
    }
  });
});
