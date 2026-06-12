/* Minimal stroke icons. <Icon name="cart" size={18} /> */
(function () {
  const S = ({ children, size = 18, stroke = 1.75, ...rest }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
      strokeLinejoin="round" {...rest}>{children}</svg>
  );

  const paths = {
    // category icons
    cart: <><circle cx="9" cy="20" r="1.3" /><circle cx="18" cy="20" r="1.3" /><path d="M2.5 3h2l2.2 11.2a1.6 1.6 0 0 0 1.6 1.3h8.1a1.6 1.6 0 0 0 1.6-1.3L21 7H6" /></>,
    cup: <><path d="M5 9h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V9Z" /><path d="M16 10h2.2a2.3 2.3 0 0 1 0 4.6H16" /><path d="M7 3v2M10.5 2.5v2.5M14 3v2" /></>,
    car: <><path d="M3 13l1.6-4.4A2 2 0 0 1 6.5 7h11a2 2 0 0 1 1.9 1.6L21 13" /><path d="M3 13h18v4a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1H6.5v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4Z" /><path d="M6.5 15.5h.01M17.5 15.5h.01" /></>,
    home: <><path d="M4 11l8-6.5L20 11" /><path d="M6 9.8V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.8" /><path d="M10 20v-5h4v5" /></>,
    bolt: <path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l0-8Z" />,
    bag: <><path d="M5 8h14l-1 12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
    heart: <path d="M12 20s-7-4.4-7-9.3A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7 2.7C19 15.6 12 20 12 20Z" />,
    play: <><circle cx="12" cy="12" r="9" /><path d="M10 8.5l6 3.5-6 3.5v-7Z" /></>,
    plane: <path d="M10.2 13.8L3 12l-1 2 4 2 2 4 2-1-1.8-7.2L17 8.5a2 2 0 1 0-1.5-1.5L10.2 13.8Z" />,
    wallet: <><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" /><path d="M3 7v10a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-2" /><path d="M21 11v4h-4a2 2 0 0 1 0-4h4Z" /></>,
    dots: <><circle cx="6" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="18" cy="12" r="1.4" /></>,
    // nav icons
    overview: <><rect x="3.5" y="3.5" width="7" height="9" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="5" rx="1.5" /><rect x="13.5" y="11.5" width="7" height="9" rx="1.5" /><rect x="3.5" y="15.5" width="7" height="5" rx="1.5" /></>,
    list: <><path d="M8 6h12M8 12h12M8 18h12" /><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></>,
    upload: <><path d="M12 16V4" /><path d="M7.5 8.5L12 4l4.5 4.5" /><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" /></>,
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7L5.3 5.3" /></>,
    // ui
    search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.2-3.2" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    chevDown: <path d="M6 9l6 6 6-6" />,
    chevRight: <path d="M9 6l6 6-6 6" />,
    arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
    arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M9.5 19a2.5 2.5 0 0 0 5 0" /></>,
    spark: <path d="M12 3l1.6 5.2L19 10l-5.4 1.8L12 17l-1.6-5.2L5 10l5.4-1.8L12 3Z" />,
    tag: <><path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Z" /><circle cx="8" cy="8" r="1.4" /></>,
  };

  function Icon({ name, size = 18, stroke = 1.75, ...rest }) {
    const p = paths[name] || paths.dots;
    return <S size={size} stroke={stroke} {...rest}>{p}</S>;
  }
  window.Icon = Icon;
})();
