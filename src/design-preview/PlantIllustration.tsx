type PlantKind = "tree" | "flower";

export function PlantIllustration({ kind, stage, variant = 0, overtime = false }: {
  kind: PlantKind;
  stage: 0 | 1 | 2 | 3 | 4;
  variant?: number;
  overtime?: boolean;
}) {
  const hueClass = `plant-variant-${variant % 3}`;
  if (kind === "flower") {
    return <svg className={`plant-illustration flower-stage stage-${stage} ${hueClass}${overtime ? " is-overtime" : ""}`} viewBox="0 0 280 300" role="img" aria-label={["花种", "花芽", "幼苗", "花苞", "盛开的花"][stage]}>
      <defs>
        <linearGradient id="flower-stem" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#9ab9a8"/><stop offset="1" stopColor="#527665"/></linearGradient>
        <radialGradient id="petal" cx="45%" cy="35%"><stop stopColor="#f4eee0"/><stop offset="1" stopColor="#c7b88f"/></radialGradient>
        <filter id="flower-glow"><feGaussianBlur stdDeviation="8"/></filter>
      </defs>
      <ellipse className="plant-shadow" cx="140" cy="273" rx="76" ry="13"/>
      <path className="plant-soil" d="M70 260 Q140 230 210 260 Q194 290 140 294 Q86 290 70 260Z"/>
      {stage === 0 && <g className="seed"><ellipse cx="140" cy="250" rx="15" ry="10" transform="rotate(-18 140 250)"/><path d="M141 243q6-13 16-16"/></g>}
      {stage >= 1 && <path className="plant-stem" d={`M140 253 Q${stage > 2 ? 128 : 145} ${225 - stage * 27} 140 ${205 - stage * 28}`} stroke="url(#flower-stem)"/>}
      {stage >= 1 && <path className="plant-leaf" d="M139 229q-31-26-43 5 22 11 43-5Z"/>}
      {stage >= 2 && <path className="plant-leaf secondary" d="M136 205q31-28 44 1-19 14-44-1Z"/>}
      {stage >= 3 && <g className="flower-head" transform={`translate(140 ${116 - (stage - 3) * 23})`}>
        {stage === 3 ? <path className="bud" d="M0 20c-24-14-18-46 0-55 18 9 24 41 0 55Z"/> : <>
          <circle className="plant-glow" r="67" fill="#d7b77a" filter="url(#flower-glow)"/>
          {[0,60,120,180,240,300].map(angle => <ellipse key={angle} className="petal" rx="19" ry="43" cy="-31" transform={`rotate(${angle})`}/>) }
          <circle className="flower-center" r="20"/>
        </>}
      </g>}
      {overtime && stage === 4 && <g className="overtime-specks"><circle cx="78" cy="98" r="3"/><circle cx="208" cy="126" r="2"/><circle cx="201" cy="69" r="3"/></g>}
    </svg>;
  }

  return <svg className={`plant-illustration tree-stage stage-${stage} ${hueClass}${overtime ? " is-overtime" : ""}`} viewBox="0 0 320 320" role="img" aria-label={["种子", "嫩芽", "幼苗", "小树", "成熟树"][stage]}>
    <defs>
      <linearGradient id="trunk" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#9b8061"/><stop offset="1" stopColor="#4f4637"/></linearGradient>
      <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#9ab9a8"/><stop offset="1" stopColor="#456c5a"/></linearGradient>
      <filter id="tree-glow"><feGaussianBlur stdDeviation="10"/></filter>
    </defs>
    <ellipse className="plant-shadow" cx="160" cy="286" rx="91" ry="14"/>
    <path className="plant-soil" d="M65 273 Q160 239 255 273 Q235 309 160 311 Q85 309 65 273Z"/>
    {stage === 0 && <g className="seed"><ellipse cx="159" cy="261" rx="17" ry="11" transform="rotate(-18 159 261)"/><path d="M160 253q8-15 20-18"/></g>}
    {stage >= 1 && <path className="tree-trunk" fill="none" stroke="url(#trunk)" strokeWidth={stage >= 4 ? 15 : stage >= 3 ? 11 : 7} d={`M160 274 Q${stage >= 3 ? 150 : 164} ${233 - stage * 16} 160 ${210 - stage * 31}`} />}
    {stage >= 2 && <path className="tree-branch" d="M158 219q-22-24-38-31M157 204q24-25 45-32"/>}
    {stage >= 3 && <path className="tree-branch" d="M154 178q-28-28-49-31M160 161q24-25 44-29"/>}
    {stage >= 4 && <path className="tree-branch" d="M157 132q-21-25-39-29M163 118q20-20 37-24"/>}
    {stage >= 1 && <g className="tree-leaves">
      <ellipse cx="137" cy={213 - stage * 26} rx={stage >= 3 ? 34 : 22} ry={stage >= 3 ? 27 : 18}/>
      {stage >= 2 && <ellipse cx="183" cy={207 - stage * 26} rx="30" ry="24"/>}
      {stage >= 3 && <><ellipse cx="111" cy="142" rx="38" ry="30"/><ellipse cx="159" cy="119" rx="45" ry="35"/><ellipse cx="208" cy="143" rx="40" ry="31"/></>}
      {stage >= 4 && <><ellipse cx="126" cy="87" rx="38" ry="28"/><ellipse cx="188" cy="80" rx="42" ry="31"/><ellipse cx="81" cy="171" rx="30" ry="24"/><ellipse cx="238" cy="174" rx="31" ry="25"/></>}
    </g>}
    {overtime && stage === 4 && <><circle className="plant-glow" cx="160" cy="130" r="97" fill="#d7b77a" filter="url(#tree-glow)"/><g className="overtime-leaves"><ellipse cx="83" cy="102" rx="6" ry="12"/><ellipse cx="239" cy="119" rx="6" ry="12"/><ellipse cx="221" cy="66" rx="5" ry="10"/></g></>}
  </svg>;
}
