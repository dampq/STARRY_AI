export function BookArt() {
  return (
    <div className="book-universe" aria-hidden="true">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="book-halo" />
      <svg className="magic-book" viewBox="0 0 620 570" fill="none">
        <defs>
          <linearGradient
            id="pages"
            x1="180"
            y1="280"
            x2="430"
            y2="450"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#f8e6bc" />
            <stop offset=".5" stopColor="#b8a2cd" />
            <stop offset="1" stopColor="#73549c" />
          </linearGradient>
          <linearGradient id="cover">
            <stop stopColor="#6e4c92" />
            <stop offset="1" stopColor="#30234f" />
          </linearGradient>
          <radialGradient id="light">
            <stop stopColor="#fff5cf" stopOpacity=".9" />
            <stop offset="1" stopColor="#bb7cff" stopOpacity="0" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>
        <ellipse
          cx="315"
          cy="465"
          rx="170"
          ry="28"
          fill="#070718"
          opacity=".5"
        />
        <path
          d="M313 377C260 329 197 304 105 333L79 410C169 387 232 414 310 465C383 412 454 392 542 408L511 326C435 307 367 331 313 377Z"
          fill="url(#cover)"
          stroke="#c7a2ec"
          strokeWidth="2"
        />
        <path
          d="M313 365C250 310 180 302 115 322L94 394C169 376 241 398 313 449C382 398 450 378 529 394L507 318C433 303 374 321 313 365Z"
          fill="url(#pages)"
          stroke="#f4ddbc"
          strokeWidth="2"
        />
        <path
          d="M313 365V449M119 386C195 376 254 404 302 437M325 435C384 394 443 377 510 384"
          stroke="#5d437d"
          strokeWidth="2"
          opacity=".65"
        />
        <path
          d="M134 340C185 331 233 348 272 372M130 354C185 346 227 363 267 387M126 368C185 360 222 377 263 400M355 370C405 340 450 330 490 335M356 384C405 354 450 345 494 349M354 400C405 370 450 359 497 364"
          stroke="#766285"
          opacity=".6"
          strokeWidth="2"
        />
        <ellipse cx="313" cy="294" rx="166" ry="170" fill="url(#light)" />
        <path
          d="M313 365C311 287 242 267 263 203C278 155 359 171 350 117C409 185 298 207 330 259C353 294 333 335 313 365Z"
          fill="url(#light)"
        />
        <path
          d="M291 312C230 228 302 233 282 162M334 306C398 232 311 214 355 153"
          stroke="#f5d78e"
          strokeOpacity=".5"
          strokeWidth="2"
          strokeDasharray="2 8"
        />
        <path
          d="M178 221l7-17 7 17-7 17-7-17ZM435 241l5-12 5 12-5 12-5-12ZM310 124l6-18 6 18-6 18-6-18Z"
          fill="#f5d78e"
        />
        <path
          d="M208 165L271 113L344 154L415 102M271 113L292 55"
          stroke="#c8b8ed"
          strokeOpacity=".4"
        />
        {[
          [208, 165],
          [271, 113],
          [344, 154],
          [415, 102],
          [292, 55],
          [145, 287],
          [456, 190],
          [395, 298],
          [233, 260],
        ].map(([cx, cy], i) => (
          <g key={i}>
            <circle
              cx={cx}
              cy={cy}
              r="7"
              fill="#e8d4ff"
              opacity=".5"
              filter="url(#glow)"
            />
            <circle cx={cx} cy={cy} r="2.5" fill="#fff1ce" />
          </g>
        ))}
        <path
          d="M393 184l24-13 17 33-24 13zM197 283l-23-8-10 29 24 8z"
          fill="#d3bce2"
          fillOpacity=".65"
          stroke="#ead5c1"
        />
      </svg>
      <span className="art-spark spark-one">✦</span>
      <span className="art-spark spark-two">✧</span>
      <span className="art-spark spark-three">✦</span>
      <span className="art-caption">
        A little imagination. Infinite possibilities.
      </span>
    </div>
  );
}
export function CoverArt({ variant = 0 }: { variant?: number }) {
  return (
    <div className={`cover-art cover-${variant % 4}`} aria-hidden="true">
      <div className="cover-moon" />
      <div className="cover-orbit" />
      <div className="cover-mountain mountain-back" />
      <div className="cover-mountain" />
      <span className="cover-star">✦</span>
      <span className="cover-star second">✧</span>
      <div className="cover-grain" />
    </div>
  );
}
