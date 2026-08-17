(function (global) {
  "use strict";

  const commonDefs = (monster) => {
    const [light, mid, accent] = monster.palette;
    return `<defs>
      <radialGradient id="body-${monster.id}" cx="38%" cy="28%" r="72%"><stop offset="0" stop-color="${light}"/><stop offset=".48" stop-color="${mid}"/><stop offset="1" stop-color="#151216"/></radialGradient>
      <linearGradient id="edge-${monster.id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${light}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="#171318"/></linearGradient>
      <radialGradient id="aura-${monster.id}"><stop stop-color="${accent}" stop-opacity=".36"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
      <filter id="rough-${monster.id}"><feTurbulence baseFrequency=".025 .07" numOctaves="2" seed="${monster.order}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5"/></filter>
      <filter id="glow-${monster.id}"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>`;
  };

  const base = (
    monster,
    body,
  ) => `<svg viewBox="0 0 420 330" role="img" aria-label="${monster.name}">
    ${commonDefs(monster)}
    <ellipse cx="210" cy="275" rx="155" ry="35" fill="#000" opacity=".48"/>
    <circle cx="210" cy="178" r="152" fill="url(#aura-${monster.id})" opacity=".55"/>
    <g class="monster-breathe">${body}</g>
  </svg>`;

  function fox(monster) {
    return base(
      monster,
      `<g opacity=".94">
      <path d="M265 242C355 230 377 145 313 91c49 80-9 116-58 121" fill="none" stroke="url(#edge-${monster.id})" stroke-width="38" stroke-linecap="round"/>
      <path d="M271 250c106 9 131-49 92-116 3 77-48 83-102 88" fill="none" stroke="url(#edge-${monster.id})" stroke-width="34" stroke-linecap="round"/>
      <path d="M248 234c90-35 88-112 23-145 50 61 6 101-39 113" fill="none" stroke="url(#edge-${monster.id})" stroke-width="31" stroke-linecap="round"/>
    </g>
    <ellipse cx="207" cy="222" rx="104" ry="64" fill="url(#body-${monster.id})"/>
    <path d="M129 205l20-98 57 42 49-36 29 94-35 48-87 5z" fill="url(#body-${monster.id})"/>
    <path d="M149 108l31 25-44 13zM254 114l-30 25 45 9z" fill="#d8d1c7" stroke="#4a423b" stroke-width="5"/>
    <path d="M174 179q34 25 69 0-12 62-36 62t-33-62" fill="#e7e0d5" opacity=".72"/>
    <g class="monster-eyes" fill="#ff4438" filter="url(#glow-${monster.id})"><path d="M163 165q18-12 31 2-17 8-31-2"/><path d="M226 166q17-13 31 0-16 9-31 0"/></g>
    <path d="M202 187l13 0-7 9z" fill="#151116"/><path d="M207 192q0 20-23 23m23-23q2 19 23 22" fill="none" stroke="#403833" stroke-width="4"/>
    <path d="M108 256q-21 5-35 25M287 259q31 3 47 20" fill="none" stroke="#6d655c" stroke-width="17" stroke-linecap="round"/>
    <path d="M206 127l-9 18 13 8-11 12" fill="none" stroke="#a52f2d" stroke-width="5"/>
    `,
    );
  }

  function ink(monster) {
    return base(
      monster,
      `<g filter="url(#rough-${monster.id})">
      <path d="M91 265c25-51 3-84 39-117 26-24 33-79 82-81 55-3 62 51 90 80 30 32 12 74 42 118-72 23-179 25-253 0z" fill="url(#body-${monster.id})"/>
      <path d="M143 179c-44 5-64-42-97-24 44 3 39 53 85 57M282 185c48 4 59-49 96-26-46 3-36 55-86 59" fill="none" stroke="#181922" stroke-width="19" stroke-linecap="round"/>
      <path d="M155 99q56-48 112 0l-22 107h-69z" fill="#080a11" opacity=".8"/>
      <path d="M165 123q45-30 91 0l-12 69-70 1z" fill="#d6cfbf" opacity=".86"/>
      <g class="monster-eyes" fill="#b52831"><circle cx="188" cy="147" r="8"/><circle cx="234" cy="147" r="8"/></g>
      <path d="M193 174q18 14 37 0" fill="none" stroke="#231921" stroke-width="5"/>
      <path d="M111 252c-35 13-56 31-70 58M310 249c38 12 59 33 72 60M169 262c-12 29-14 47-5 64M253 261c15 26 16 45 8 65" fill="none" stroke="#11131b" stroke-width="16" stroke-linecap="round"/>
      <circle cx="211" cy="228" r="35" fill="none" stroke="${monster.palette[2]}" stroke-width="3" opacity=".6"/>
      <path d="M190 229q20-25 41 0-20 22-41 0" fill="#381d28"/>
    </g>`,
    );
  }

  function crow(monster) {
    return base(
      monster,
      `<path d="M204 195C146 103 65 88 27 154c71-25 94 37 150 75z" fill="url(#edge-${monster.id})"/>
      <path d="M215 194c63-95 142-103 180-38-75-27-98 40-153 76z" fill="url(#edge-${monster.id})"/>
      <path d="M79 143l74 29-47 8 64 28M340 145l-72 30 45 8-61 27" fill="none" stroke="#8491b0" stroke-width="4" opacity=".55"/>
      <ellipse cx="211" cy="221" rx="68" ry="74" fill="url(#body-${monster.id})"/>
      <path d="M170 155q39-63 81 0l-12 73-58 0z" fill="#161b2b"/>
      <path d="M199 178l-55 16 61 17z" fill="#d39f43"/>
      <g class="monster-eyes"><circle cx="199" cy="171" r="6" fill="#ff4b3b"/><circle cx="227" cy="171" r="6" fill="#ff4b3b"/></g>
      <path d="M176 268l-42 39 59-27 18 42 17-42 57 28-39-42" fill="#121625"/>
      <path d="M184 285l-24 29M232 285l25 29" stroke="#a67835" stroke-width="7"/>
      <circle cx="210" cy="91" r="45" fill="none" stroke="${monster.palette[2]}" stroke-width="3" opacity=".45"/>
      <path d="M179 91h62M210 60v62" stroke="${monster.palette[2]}" stroke-width="2" opacity=".4"/>`,
    );
  }

  function spider(monster) {
    const legs = [
      "M169 194Q104 132 41 143",
      "M166 210Q91 181 35 213",
      "M168 229Q91 238 51 285",
      "M178 244Q121 278 105 323",
      "M251 194Q316 132 380 143",
      "M254 210Q330 181 387 213",
      "M252 229Q330 238 369 285",
      "M242 244Q299 278 315 323",
    ]
      .map(
        (d) =>
          `<path d="${d}" fill="none" stroke="#4b271f" stroke-width="13" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#a0603f" stroke-width="3" opacity=".65"/>`,
      )
      .join("");
    return base(
      monster,
      `${legs}
      <ellipse cx="210" cy="226" rx="69" ry="82" fill="url(#body-${monster.id})"/>
      <ellipse cx="210" cy="155" rx="52" ry="45" fill="#4a2723"/>
      <path d="M174 212l72 0M182 239l56 0" stroke="#e1a65c" stroke-width="6" opacity=".65"/>
      <g class="monster-eyes" fill="#ffb35a" filter="url(#glow-${monster.id})">
        <circle cx="184" cy="150" r="6"/><circle cx="200" cy="143" r="7"/><circle cx="220" cy="143" r="7"/><circle cx="236" cy="150" r="6"/>
        <circle cx="190" cy="165" r="5"/><circle cx="230" cy="165" r="5"/>
      </g>
      <path d="M194 177l16 20 16-20" fill="#1c1010"/>
      <circle cx="210" cy="232" r="25" fill="none" stroke="${monster.palette[2]}" stroke-width="4"/><path d="M210 207v50M185 232h50" stroke="${monster.palette[2]}" stroke-width="3"/>`,
    );
  }

  function child(monster) {
    return base(
      monster,
      `<path d="M140 290q24-151 70-151t70 151z" fill="url(#body-${monster.id})"/>
      <path d="M151 207l-55-63M267 207l55-63" stroke="#4b3449" stroke-width="21" stroke-linecap="round"/>
      <path d="M89 134l13-35 27 23-13 35zM327 134l-13-35-27 23 13 35z" fill="#c6ae88"/>
      <circle cx="210" cy="124" r="59" fill="#c8b38e"/>
      <path d="M151 118q5-72 59-72t59 72c-32-22-85-22-118 0" fill="#201823"/>
      <path d="M159 119q51-28 101 0v50q-48 20-101 0z" fill="#e0cbaa"/>
      <ellipse cx="210" cy="146" rx="39" ry="26" fill="#e9dbc3"/>
      <path d="M177 137q15-8 27 2M216 139q14-10 28-1" fill="none" stroke="#47333c" stroke-width="5"/>
      <path d="M198 160q12 8 24 0" fill="none" stroke="#8d383c" stroke-width="4"/>
      <g class="monster-eyes" fill="#a52735"><circle cx="193" cy="142" r="5"/><circle cx="229" cy="142" r="5"/></g>
      <path d="M177 219l33 21 33-21M210 240v50" fill="none" stroke="#bfa86f" stroke-width="5"/>
      <path d="M157 87l-45-55M263 87l45-55" stroke="#4c384d" stroke-width="5" opacity=".65"/>`,
    );
  }

  function serpent(monster) {
    return base(
      monster,
      `<path d="M95 276C59 210 111 181 172 219c59 36 139 14 121-47-11-38-61-39-81-9" fill="none" stroke="#152c32" stroke-width="67" stroke-linecap="round"/>
      <path d="M95 276C59 210 111 181 172 219c59 36 139 14 121-47-11-38-61-39-81-9" fill="none" stroke="url(#edge-${monster.id})" stroke-width="52" stroke-linecap="round"/>
      <path d="M204 172q10-70 72-78l55 41-42 74z" fill="url(#body-${monster.id})"/>
      <path d="M281 100l25-33 5 45M246 106l-10-42 35 35" fill="${monster.palette[1]}" stroke="#153039" stroke-width="5"/>
      <path d="M292 139l73 5-69 22z" fill="#b7a16b"/>
      <g class="monster-eyes" fill="#ffe169"><circle cx="264" cy="132" r="7"/><circle cx="300" cy="128" r="7"/></g>
      <path d="M349 149l35-16M350 150l35 13" stroke="#e9b253" stroke-width="3"/>
      <path d="M101 252l38 7M133 211l35 18M180 215l25 27M242 218l17 19" stroke="#c7b26f" stroke-width="4" opacity=".65"/>
      <circle cx="207" cy="244" r="24" fill="none" stroke="${monster.palette[2]}" stroke-width="3" opacity=".7"/>`,
    );
  }

  function oni(monster) {
    return base(
      monster,
      `<path d="M137 289q-2-110 31-142l42 21 43-21q35 33 29 142z" fill="url(#body-${monster.id})"/>
      <path d="M159 174l-69 87M261 174l70 87" stroke="#7d2e28" stroke-width="35" stroke-linecap="round"/>
      <path d="M79 270l-18 42M341 270l18 42" stroke="#d59c57" stroke-width="18" stroke-linecap="round"/>
      <path d="M158 120q-7-59 52-72 61 14 53 72l-20 64-67 0z" fill="#a64335"/>
      <path d="M165 77l-18-54 47 39M255 76l18-53-47 39" fill="#d7aa60" stroke="#4c241b" stroke-width="6"/>
      <path d="M173 116q37-31 74 0l-8 56-58 0z" fill="#be5740"/>
      <g class="monster-eyes" fill="#ffde63"><path d="M178 124l28 5-26 10z"/><path d="M243 124l-28 5 26 10z"/></g>
      <path d="M191 151l19-10 20 10-20 27z" fill="#4a1d1c"/>
      <path d="M179 186l-22 103M241 187l21 102" stroke="#d29a4e" stroke-width="7"/>
      <path d="M110 191l-28-27M310 191l29-27" stroke="#e6b25f" stroke-width="12"/>
      <path d="M302 272l42-173" stroke="#32271f" stroke-width="25"/><path d="M314 224l29 9M322 190l29 8M331 154l29 8" stroke="#8e704d" stroke-width="7"/>`,
    );
  }

  function deer(monster) {
    return base(
      monster,
      `<ellipse cx="210" cy="224" rx="110" ry="61" fill="url(#body-${monster.id})"/>
      <path d="M134 236l-24 73M177 254l-7 65M252 254l7 65M293 235l26 74" stroke="#4a372c" stroke-width="16" stroke-linecap="round"/>
      <path d="M225 194q-24-88 27-106 55 15 35 101z" fill="url(#edge-${monster.id})"/>
      <path d="M246 106l-28-63M251 90l-47-25M263 91l14-66M271 71l36-35M280 104l52-47" fill="none" stroke="#c0a574" stroke-width="9" stroke-linecap="round"/>
      <path d="M246 114l-34-24 27-13M280 113l35-25-29-13" fill="#725744"/>
      <g class="monster-eyes" fill="#ffd867"><circle cx="248" cy="137" r="6"/><circle cx="279" cy="137" r="6"/></g>
      <path d="M254 158l17 0-8 10z" fill="#251b17"/>
      <circle cx="242" cy="45" r="9" fill="${monster.palette[2]}" filter="url(#glow-${monster.id})"/>
      <circle cx="277" cy="27" r="7" fill="${monster.palette[2]}" filter="url(#glow-${monster.id})"/>
      <circle cx="309" cy="37" r="8" fill="${monster.palette[2]}" filter="url(#glow-${monster.id})"/>
      <path d="M110 208q-21-9-31 9 17 20 37 9" fill="#574131"/>`,
    );
  }

  function moth(monster) {
    return base(
      monster,
      `<path d="M197 160C141 70 48 81 50 205c46-52 83-8 133 39z" fill="url(#edge-${monster.id})"/>
      <path d="M223 160c56-90 149-79 147 45-46-52-83-8-133 39z" fill="url(#edge-${monster.id})"/>
      <path d="M177 176c-64-36-111-7-93 82 27-27 58-8 96 17M243 176c64-36 111-7 93 82-27-27-58-8-96 17" fill="${monster.palette[1]}" opacity=".82"/>
      <path d="M82 136q52 1 89 57M339 136q-52 1-89 57M99 226q35-12 70 27M321 226q-35-12-70 27" fill="none" stroke="#e3c172" stroke-width="5" opacity=".75"/>
      <ellipse cx="210" cy="213" rx="30" ry="86" fill="#2c2030"/>
      <circle cx="210" cy="127" r="38" fill="#4f3854"/>
      <path d="M200 103l-28-54M220 103l28-54" stroke="#a98eaa" stroke-width="5"/>
      <g class="monster-eyes" fill="#ffd96b"><circle cx="198" cy="127" r="7"/><circle cx="222" cy="127" r="7"/></g>
      <path d="M195 150q15 11 30 0" fill="none" stroke="#211823" stroke-width="5"/>
      <circle cx="121" cy="156" r="27" fill="none" stroke="${monster.palette[2]}" stroke-width="4" opacity=".65"/><circle cx="299" cy="156" r="27" fill="none" stroke="${monster.palette[2]}" stroke-width="4" opacity=".65"/>`,
    );
  }

  function centipede(monster) {
    const segments = Array.from({ length: 10 }, (_, i) => {
      const x = 78 + i * 30;
      const y = 224 - Math.sin(i * 0.8) * 37;
      return `<g transform="translate(${x} ${y}) rotate(${Math.cos(i * 0.8) * 22})"><ellipse rx="26" ry="31" fill="url(#body-${monster.id})" stroke="#bd8b49" stroke-width="3"/><path d="M-12 20l-27 25M12 20l27 25M-15-15l-31-20M15-15l31-20" stroke="#7c5a3d" stroke-width="7" stroke-linecap="round"/></g>`;
    }).join("");
    return base(
      monster,
      `${segments}
      <path d="M330 164q54-32 69 22l-24 67-58-13z" fill="#5b4430" stroke="#bd8b49" stroke-width="5"/>
      <path d="M350 174l-18-51M372 177l17-53" stroke="#c5964c" stroke-width="8"/>
      <g class="monster-eyes" fill="#ffb43c"><circle cx="351" cy="196" r="7"/><circle cx="378" cy="199" r="7"/></g>
      <path d="M334 218l-29 17M390 225l25 25" stroke="#d9a554" stroke-width="7"/>
      <ellipse cx="213" cy="183" rx="61" ry="44" fill="#3d3027" stroke="#a88152" stroke-width="6"/>
      <ellipse cx="213" cy="183" rx="39" ry="28" fill="#171514"/><path d="M184 183h58M213 155v56" stroke="#d09a45" stroke-width="4"/>`,
    );
  }

  function boss(monster) {
    return base(
      monster,
      `<circle cx="210" cy="138" r="105" fill="none" stroke="${monster.palette[2]}" stroke-width="4" opacity=".55"/>
      <circle cx="210" cy="138" r="86" fill="#e4c975" opacity=".18" filter="url(#glow-${monster.id})"/>
      <path d="M90 301q26-151 74-166h92q48 15 74 166z" fill="url(#body-${monster.id})"/>
      <path d="M117 279l53-127 40 49 40-49 53 127" fill="none" stroke="#ad8abb" stroke-width="22" opacity=".72"/>
      <path d="M170 142q-8-75 40-91 48 16 40 91l-10 55h-60z" fill="#d2b08c"/>
      <path d="M164 97h92l-11-46h-70z" fill="#241b2d"/><path d="M176 52l13-31 21 28 21-28 13 31" fill="#3c294a" stroke="#cda95b" stroke-width="4"/>
      <path d="M174 112q36-20 72 0v55q-35 22-72 0z" fill="#e0c6a7"/>
      <g class="monster-eyes" fill="#9f2e39"><path d="M181 128q14-9 27 0-14 8-27 0"/><path d="M212 128q14-9 27 0-14 8-27 0"/></g>
      <path d="M198 151q12 7 24 0" fill="none" stroke="#6c3840" stroke-width="4"/>
      <path d="M142 229l-65 74M278 229l65 74" stroke="#4e385a" stroke-width="32" stroke-linecap="round"/>
      <path d="M91 287l-27 28M329 287l27 28" stroke="#d8b485" stroke-width="15" stroke-linecap="round"/>
      <path d="M180 206l30 24 30-24v85h-60z" fill="#2b2037" stroke="#d6b55c" stroke-width="5"/>
      <path d="M210 230v61M180 249h60" stroke="#d6b55c" stroke-width="3" opacity=".7"/>
      <g opacity=".65" fill="${monster.palette[2]}"><circle cx="113" cy="101" r="4"/><circle cx="310" cy="89" r="5"/><circle cx="84" cy="171" r="3"/><circle cx="338" cy="165" r="4"/></g>`,
    );
  }

  const renderers = {
    fox,
    ink,
    crow,
    spider,
    child,
    serpent,
    oni,
    deer,
    moth,
    centipede,
    boss,
  };

  function monsterSvg(monster) {
    return (renderers[monster.archetype] || ink)(monster);
  }

  global.HyakushuArt = { monsterSvg };
})(typeof window !== "undefined" ? window : globalThis);
