// Turn a stand-alone "Reading Lab" HTML page into lesson data for reading.html.
// Usage: node extract_lab.js src.html out.json
const fs = require("fs");
const [src, outp] = process.argv.slice(2);
const s = fs.readFileSync(src, "utf8");
const js = s.slice(s.indexOf("const CHUNKS ="), s.indexOf("/* ============ STORAGE"));
const { CHUNKS, CHART } = new Function(js + ";return {CHUNKS,CHART};")();
const model = s.match(/id="final-model"><span class="lbl">[^<]*<\/span>([\s\S]*?)<\/div>/)[1];
const out = {
  meta: {
    kicker: "Reading & Writing · Upper B2 → C1",
    title: "The winners and losers of Trumponomics",
    lede: "The president vowed to help ordinary Americans. He achieved something different.",
    pills: ["Source: The Economist, 31 October 2026", "6 chunks + final paragraph", "≈ 2–3 lessons"],
    footer: "Reading text: “The winners and losers of Trumponomics”, <i>The Economist</i>, 31 October 2026 (United States section). For private classroom study only. Chart redrawn from approximate values in the original (sources: Yale Budget Lab; CBO; EIA; BLS). The article was written a few days before the 3 November 2026 elections.",
  },
  chart: {
    title: "Win some, lose more",
    sub: "Estimated net change in after-tax income from Trump's policies, by income decile, US, 2026 (%)",
    src: "Approximate values read from The Economist's chart (net of tariffs, energy shock and OBBBA). <b>Decile</b> = one of ten equal income groups.",
    ...CHART,
  },
  chunks: CHUNKS,
  final: {
    title: "Final task: build an argument",
    sub: "Put everything together in one well-organised paragraph",
    question: "According to the article, who are the real winners and losers of Trumponomics, and do you find the writer's argument convincing?",
    model,
  },
};
fs.writeFileSync(outp, JSON.stringify(out));
console.log(CHUNKS.length, CHUNKS.map((c) => c.comp.length + "/" + c.gap.items.length).join(" "), model.slice(0, 50));
