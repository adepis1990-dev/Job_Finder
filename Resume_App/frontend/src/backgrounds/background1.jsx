import React from 'react'

/**
 * Kandinsky-style background with 3 abstract trees, 10 circles, 10 triangles, 10 squares.
 * Save different versions as background2.jsx, background3.jsx etc.
 * Import the one you want in Dashboard.jsx.
 */
export default function Background1() {
  return (
    <>
      {/* Shapes layer - 10 circles, 10 triangles, 10 squares */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.22, pointerEvents: 'none' }}
        viewBox="0 0 1400 900" fill="none" preserveAspectRatio="xMidYMid slice">

        {/* 10 Circles */}
        <circle cx="120" cy="130" r="75" fill="#a78bda" />
        <circle cx="1250" cy="100" r="60" fill="#f4a8b5" />
        <circle cx="200" cy="700" r="90" fill="#9cc4e8" />
        <circle cx="1050" cy="750" r="65" fill="#f9d89c" />
        <circle cx="700" cy="80" r="50" fill="#6bc4a8" />
        <circle cx="400" cy="450" r="55" fill="#e8a8d4" />
        <circle cx="900" cy="350" r="45" fill="#a8d8b9" />
        <circle cx="550" cy="650" r="40" fill="#f4c87a" />
        <circle cx="1300" cy="500" r="70" fill="#b8a9d4" />
        <circle cx="80" cy="450" r="48" fill="#e86b8a" />

        {/* 10 Triangles */}
        <polygon points="350,60 390,130 310,130" fill="#e86b8a" opacity="0.75" />
        <polygon points="800,150 845,220 755,220" fill="#6bc4a8" opacity="0.7" />
        <polygon points="150,550 195,620 105,620" fill="#f4c87a" opacity="0.75" />
        <polygon points="1100,300 1140,360 1060,360" fill="#a78bda" opacity="0.7" />
        <polygon points="600,400 635,455 565,455" fill="#9cc4e8" opacity="0.75" />
        <polygon points="950,600 990,660 910,660" fill="#e8a8d4" opacity="0.7" />
        <polygon points="450,200 485,255 415,255" fill="#a8d8b9" opacity="0.75" />
        <polygon points="1200,650 1235,705 1165,705" fill="#f4a8b5" opacity="0.7" />
        <polygon points="300,350 335,405 265,405" fill="#d89cf4" opacity="0.75" />
        <polygon points="700,750 735,805 665,805" fill="#f9d89c" opacity="0.7" />

        {/* 10 Squares (rotated) */}
        <rect x="500" y="100" width="35" height="35" fill="#e86b8a" opacity="0.7" transform="rotate(25 517 117)" />
        <rect x="1000" y="180" width="30" height="30" fill="#6bc4a8" opacity="0.7" transform="rotate(40 1015 195)" />
        <rect x="250" y="250" width="28" height="28" fill="#f4c87a" opacity="0.75" transform="rotate(15 264 264)" />
        <rect x="850" y="500" width="32" height="32" fill="#a78bda" opacity="0.7" transform="rotate(55 866 516)" />
        <rect x="650" y="300" width="26" height="26" fill="#9cc4e8" opacity="0.75" transform="rotate(35 663 313)" />
        <rect x="1150" y="420" width="30" height="30" fill="#e8a8d4" opacity="0.7" transform="rotate(20 1165 435)" />
        <rect x="100" y="320" width="24" height="24" fill="#a8d8b9" opacity="0.75" transform="rotate(50 112 332)" />
        <rect x="750" y="580" width="28" height="28" fill="#f4a8b5" opacity="0.7" transform="rotate(30 764 594)" />
        <rect x="400" y="700" width="32" height="32" fill="#d89cf4" opacity="0.75" transform="rotate(45 416 716)" />
        <rect x="1050" y="80" width="25" height="25" fill="#f9d89c" opacity="0.7" transform="rotate(60 1062 92)" />
      </svg>

      {/* Tree 1 - right side, large green */}
      <svg style={{ position: 'absolute', bottom: 0, right: '5%', width: '28%', height: '75%', opacity: 0.24, pointerEvents: 'none' }}
        viewBox="0 0 400 600" fill="none">
        <rect x="185" y="350" width="30" height="250" fill="#3d2e1e" rx="4" />
        <rect x="170" y="400" width="12" height="130" fill="#5a4030" rx="3" transform="rotate(-15 170 400)" />
        <rect x="218" y="370" width="10" height="110" fill="#5a4030" rx="3" transform="rotate(12 218 370)" />
        <circle cx="200" cy="180" r="95" fill="#4da875" />
        <circle cx="140" cy="220" r="65" fill="#5cb888" />
        <circle cx="265" cy="195" r="58" fill="#3d9865" />
        <circle cx="200" cy="115" r="55" fill="#6dc89a" />
        <circle cx="125" cy="155" r="42" fill="#80d8aa" />
        <circle cx="275" cy="135" r="38" fill="#4da875" />
        <circle cx="175" cy="280" r="48" fill="#5cb888" />
        <circle cx="245" cy="268" r="42" fill="#3d9865" />
        <polygon points="200,55 225,100 175,100" fill="#e05578" opacity="0.85" />
        <circle cx="140" cy="125" r="14" fill="#9070c8" opacity="0.85" />
        <rect x="280" y="155" width="22" height="22" fill="#e8b040" opacity="0.75" transform="rotate(30 291 166)" />
      </svg>

      {/* Tree 2 - left side, medium purple */}
      <svg style={{ position: 'absolute', bottom: 0, left: '3%', width: '22%', height: '62%', opacity: 0.2, pointerEvents: 'none' }}
        viewBox="0 0 300 500" fill="none">
        <rect x="138" y="300" width="24" height="200" fill="#3d2e1e" rx="3" />
        <rect x="128" y="340" width="10" height="90" fill="#5a4030" rx="2" transform="rotate(-12 128 340)" />
        <rect x="162" y="330" width="9" height="80" fill="#5a4030" rx="2" transform="rotate(10 162 330)" />
        <circle cx="150" cy="160" r="70" fill="#8b60c0" />
        <circle cx="110" cy="190" r="48" fill="#a078d0" />
        <circle cx="195" cy="175" r="44" fill="#7550b0" />
        <circle cx="150" cy="105" r="42" fill="#b090d8" />
        <circle cx="100" cy="140" r="32" fill="#c4a8e4" />
        <circle cx="200" cy="125" r="28" fill="#8b60c0" />
        <circle cx="135" cy="235" r="36" fill="#a078d0" />
        <polygon points="150,60 168,92 132,92" fill="#e8b040" opacity="0.85" />
        <circle cx="200" cy="100" r="10" fill="#e05578" opacity="0.8" />
        <rect x="85" y="180" width="14" height="14" fill="#5aaccf" opacity="0.8" transform="rotate(45 92 187)" />
      </svg>

      {/* Tree 3 - center-left, small warm/orange */}
      <svg style={{ position: 'absolute', bottom: 0, left: '32%', width: '14%', height: '45%', opacity: 0.16, pointerEvents: 'none' }}
        viewBox="0 0 200 400" fill="none">
        <rect x="90" y="240" width="20" height="160" fill="#3d2e1e" rx="3" />
        <rect x="82" y="270" width="8" height="70" fill="#5a4030" rx="2" transform="rotate(-10 82 270)" />
        <circle cx="100" cy="130" r="55" fill="#d87850" />
        <circle cx="72" cy="155" r="36" fill="#e89070" />
        <circle cx="132" cy="145" r="34" fill="#c06840" />
        <circle cx="100" cy="88" r="35" fill="#e8a888" />
        <circle cx="70" cy="115" r="25" fill="#f0c0a8" />
        <circle cx="130" cy="105" r="22" fill="#d87850" />
        <polygon points="100,50 114,75 86,75" fill="#5aaccf" opacity="0.85" />
        <circle cx="130" cy="80" r="7" fill="#9070c8" opacity="0.8" />
      </svg>
    </>
  )
}
