import { useEffect, useRef } from "react";

// Verbatim third-party markup - kept as a single constant rather than JSX because the informer's
// own script (below) fills it in by direct DOM manipulation. The stylesheet this markup depends
// on is loaded once, globally, via a <link> in index.html rather than injected here.
const INFORMER_HTML = `<div class="sin-informer sin-informer_font-Arial sin-informer_theme-light" data-lang="uk"><div class="sin-informer__header"><a class="sin-informer__logo-link" href="https://sinoptik.ua" target="_blank" rel="nofollow"><img class="sin-informer__logo-image" width="66" height="20" srcset="https://sinoptik.ua/resources/informer/assets/icons/logo.png, https://sinoptik.ua/resources/informer/assets/icons/logo2x.png 2x" src="https://sinoptik.ua/resources/informer/assets/icons/logo.png" alt="Sinoptik - logo"></a><p class="sin-informer__date">Погода на найближчий час</p><p class="sin-informer__time" data-format="24"><span class="sin-informer__time-icon"></span></p></div><div class="sin-informer__main sin-informer__main_inline"><a class="sin-informer__entry" href="https://sinoptik.ua/pohoda/zhytomyr" target="_blank" rel="nofollow"><p class="sin-informer__location"> Житомир </p><div class="sin-informer__primary" style="display: none"><p class="sin-informer__local-time"></p><p class="sin-informer__temp" data-unit="c"></p><div class="sin-informer__condition" data-icon-path="https://sinoptik.ua/resources/informer/assets/icons/conditions"></div></div><div class="sin-informer__secondary" style="display: none"><p class="sin-informer__marker sin-informer__marker_wind" data-unit="ms" data-suffix="м/с" data-directions="Західний,Північно-Західний,Північний,Північно-Східний,Східний,Південно-Східний,Південний,Південно-Західний,Штиль" title="Вітер"><span class="sin-informer__marker-icon"></span></p><p class="sin-informer__marker sin-informer__marker_humidity" title="Волога"><span class="sin-informer__marker-icon"></span></p><p class="sin-informer__marker sin-informer__marker_pressure" data-unit="mm-hg" data-suffix="мм" title="Тиск"><span class="sin-informer__marker-icon"></span></p></div></a></div><div class="sin-informer__footer"> Погода на 10 днів від <a class="sin-informer__domain-link" href="https://sinoptik.ua/pohoda/zhytomyr/10-dniv" target="_blank" rel="nofollow"> sinoptik.ua </a></div></div>`;

const INFORMER_SCRIPT_SRC =
  "https://sinoptik.ua/api/informer/content?loc=bwCOPwhOCUbebS3lbSVR2Q9o&cem=BQjHbU3SPhDSiKN6Zrx5GqYo2Kh4iM=5PU2UCMAlPwVOCUV";

export default function SinoptikWeatherWidget({ className = "" }) {
  const containerRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    // Guards against React StrictMode's dev-only mount -> cleanup -> mount double-invoke: the
    // informer's own script isn't idempotent (it writes values into the DOM rather than replacing
    // them), and removing its <script> tag from the document doesn't reliably abort an
    // already-in-flight fetch - so a naive cleanup-then-reinject cycle lets BOTH script instances
    // execute against the same surviving nodes and visibly duplicates every value. Skipping
    // reinitialization here means only one script instance ever runs per real mount. No unmount
    // cleanup is needed either: removing this component's own container node (which React does on
    // unmount) takes the injected markup and script with it.
    if (!container || initializedRef.current) return;
    initializedRef.current = true;

    container.innerHTML = INFORMER_HTML;

    // <script> tags inserted via innerHTML never execute - a real DOM node is required for the
    // informer's own script (which fetches and fills in the live weather data) to actually run.
    const script = document.createElement("script");
    script.src = INFORMER_SCRIPT_SRC;
    script.async = true;
    container.appendChild(script);
  }, []);

  return <div ref={containerRef} className={className} aria-label="Погода у Житомирі" />;
}
