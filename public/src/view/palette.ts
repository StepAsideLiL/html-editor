import { PALETTE } from "../constants.ts";
import { addElement } from "../controller.ts";
import { $ } from "../utils.ts";

export function renderPalette(): void {
  const bar = $<HTMLElement>("#palette")!;
  bar.innerHTML = "";

  for (const group of PALETTE) {
    const box = document.createElement("div");
    box.className = "palette-group";

    const label = document.createElement("span");
    label.className = "glabel";
    label.textContent = group.group;
    box.appendChild(label);

    for (const tag of group.tags) {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.textContent = tag;
      chip.title = `Add <${tag}>`;
      chip.addEventListener("click", () => addElement(tag));
      box.appendChild(chip);
    }

    bar.appendChild(box);
  }
}
