/* Themes. Each one gives new values to the color names used across the site.
   "wine" is the look you have now. Load this file in the <head> of every page. */

const THEME_KEY = "whimzyy-theme";

const THEMES = {
  wine: {
    name: "Wine & Candle",
    colors: {
      "bg": "#1F0508", "dark-cherry-red": "#2E0A10", "marron-red": "#4A0E17",
      "wine": "#5A0F1E", "dark-red": "#6B1520", "wine-soft": "#8A2A3A",
      "bright-deep-yellow": "#C9941A", "butter": "#C9941A", "candle": "#E8B86D",
      "gold": "#F2B83D", "soft-gold": "#D4A24C",
      "text": "#f7e7a9", "peach": "#f8c9a0", "warm-beige": "#F3E7D3"
    }
  },
  plum: {
    name: "Midnight Plum",
    colors: {
      "bg": "#12081A", "dark-cherry-red": "#1C0E2A", "marron-red": "#2E1747",
      "wine": "#3B1F5C", "dark-red": "#4B2A73", "wine-soft": "#5E3C8C",
      "bright-deep-yellow": "#C9941A", "butter": "#C9941A", "candle": "#E8B86D",
      "gold": "#F2B83D", "soft-gold": "#D4A24C",
      "text": "#F3E6B0", "peach": "#D9C6F2", "warm-beige": "#EFE8F6"
    }
  },
  moss: {
    name: "Moss & Mist",
    colors: {
      "bg": "#07140F", "dark-cherry-red": "#0D1F17", "marron-red": "#17352A",
      "wine": "#1F4534", "dark-red": "#29583F", "wine-soft": "#245A3F",
      "bright-deep-yellow": "#C9A227", "butter": "#C9A227", "candle": "#E3CF8B",
      "gold": "#EDD56B", "soft-gold": "#CDB86A",
      "text": "#EDE9B8", "peach": "#BFD8B8", "warm-beige": "#E8F0DF"
    }
  },
  navy: {
    name: "Dark Night",
    colors: {
      "bg": "#050A1A", "dark-cherry-red": "#0A1330", "marron-red": "#12214A",
      "wine": "#172B5C", "dark-red": "#1F3A73", "wine-soft": "#2E4F94",
      "bright-deep-yellow": "#C9A64A", "butter": "#C9A64A", "candle": "#E3C98A",
      "gold": "#EBC95E", "soft-gold": "#C7AE6B",
      "text": "#DCE6F7", "peach": "#AFC4E8", "warm-beige": "#E6ECF7"
    }
  },
  rose: {
    name: "Rose Dusk",
    colors: {
      "bg": "#1C0512", "dark-cherry-red": "#2D0A1F", "marron-red": "#4A1034",
      "wine": "#5E1544", "dark-red": "#7A1D58", "wine-soft": "#A03478",
      "bright-deep-yellow": "#C98BA0", "butter": "#C98BA0", "candle": "#EDB8CB",
      "gold": "#F2A9C4", "soft-gold": "#D993AF",
      "text": "#FBE3EE", "peach": "#F5B8D0", "warm-beige": "#F8E6EE"
    }
  },

  /* ---- Special themes (shop only, over 100 stars each) ---- */
  sp_mint: {
    name: "Mint Condition", special: true,
    colors: {
      "bg": "#062220", "dark-cherry-red": "#122C2B", "marron-red": "#193836",
      "wine": "#204442", "dark-red": "#27504E", "wine-soft": "#315F5D",
      "bright-deep-yellow": "#3CC4B4", "butter": "#3CC4B4", "candle": "#68D1C6", "gold": "#27BEAD", "soft-gold": "#42AEA2",
      "text": "#CFF2EE", "peach": "#9AE2DA", "warm-beige": "#F9FFFE"
    }
  },
  sp_grape: {
    name: "Grape Escape", special: true,
    colors: {
      "bg": "#1D0945", "dark-cherry-red": "#2A1060", "marron-red": "#38187E",
      "wine": "#47209C", "dark-red": "#5628BA", "wine-soft": "#6631DB",
      "bright-deep-yellow": "#AA9CC7", "butter": "#AA9CC7", "candle": "#E5D9FF", "gold": "#DAC8FF", "soft-gold": "#C4B1ED",
      "text": "#FDFDFF", "peach": "#E5D9FE", "warm-beige": "#EEE7FE"
    }
  },
  sp_matcha: {
    name: "Matcha Mood", special: true,
    colors: {
      "bg": "#081710", "dark-cherry-red": "#112216", "marron-red": "#1A2F1E",
      "wine": "#233B25", "dark-red": "#2D472C", "wine-soft": "#375534",
      "bright-deep-yellow": "#8C9A8E", "butter": "#8C9A8E", "candle": "#CAD7CC", "gold": "#B3C6B6", "soft-gold": "#A4B5A6",
      "text": "#E5EEDE", "peach": "#CFDDC9", "warm-beige": "#E6F0D8"
    }
  },
  sp_latte: {
    name: "Cozy Latte Arc", special: true,
    colors: {
      "bg": "#201711", "dark-cherry-red": "#2F2118", "marron-red": "#3E2C1F",
      "wine": "#4E3727", "dark-red": "#5E422F", "wine-soft": "#6F4E37",
      "bright-deep-yellow": "#AA9B8F", "butter": "#AA9B8F", "candle": "#E5D8CD", "gold": "#DAC7B8", "soft-gold": "#C5B5A8",
      "text": "#FBF8F3", "peach": "#EEE3D7", "warm-beige": "#FFFAF2"
    }
  },
  sp_sunset: {
    name: "Sunset Rizz", special: true,
    colors: {
      "bg": "#2A1022", "dark-cherry-red": "#3A152A", "marron-red": "#4C1B32",
      "wine": "#5F213B", "dark-red": "#712744", "wine-soft": "#852E4E",
      "bright-deep-yellow": "#BA8991", "butter": "#BA8991", "candle": "#F3C8CF", "gold": "#EEB0BA", "soft-gold": "#D6A2AD",
      "text": "#FDE8E2", "peach": "#F8CECB", "warm-beige": "#FFE7D8"
    }
  },
  sp_oldmoney: {
    name: "Old Money Fr", special: true,
    colors: {
      "bg": "#2F0F14", "dark-cherry-red": "#3E171C", "marron-red": "#4E1F25",
      "wine": "#5E282E", "dark-red": "#6F3138", "wine-soft": "#833C44",
      "bright-deep-yellow": "#9B8F7F", "butter": "#9B8F7F", "candle": "#D8CDBF", "gold": "#C7B7A3", "soft-gold": "#B49E91",
      "text": "#E3D5C2", "peach": "#DACBB8", "warm-beige": "#EADCCA"
    }
  },
  sp_stealth: {
    name: "Stealth Mode", special: true,
    colors: {
      "bg": "#030B0F", "dark-cherry-red": "#101A1F", "marron-red": "#1E2A31",
      "wine": "#2C3A44", "dark-red": "#3A4A56", "wine-soft": "#4A5C6A",
      "bright-deep-yellow": "#9BA1A2", "butter": "#9BA1A2", "candle": "#D8DDDE", "gold": "#C7CED0", "soft-gold": "#B3BABD",
      "text": "#FCFCFC", "peach": "#CDD2D2", "warm-beige": "#D1D5D3"
    }
  },
  sp_honey: {
    name: "Honey Aura", special: true,
    colors: {
      "bg": "#231B00", "dark-cherry-red": "#2F2500", "marron-red": "#3B3005",
      "wine": "#473A0B", "dark-red": "#544610", "wine-soft": "#655417",
      "bright-deep-yellow": "#AF955D", "butter": "#AF955D", "candle": "#E9D2A0", "gold": "#E0BF77", "soft-gold": "#C9B178",
      "text": "#F9EAC8", "peach": "#F1DCAF", "warm-beige": "#FFF4DC"
    }
  },
  sp_pookie: {
    name: "Hot Pink Pookie", special: true,
    colors: {
      "bg": "#460012", "dark-cherry-red": "#510F28", "marron-red": "#631533",
      "wine": "#751B3E", "dark-red": "#882249", "wine-soft": "#9F2C57",
      "bright-deep-yellow": "#DB8FB4", "butter": "#DB8FB4", "candle": "#FFBADC", "gold": "#FF9CCE", "soft-gold": "#E490B8",
      "text": "#FFD8D9", "peach": "#FFC5D5", "warm-beige": "#FFE7DC"
    }
  },
  sp_goblin: {
    name: "Goblin Mode", special: true,
    colors: {
      "bg": "#08110D", "dark-cherry-red": "#121E16", "marron-red": "#1D2D20",
      "wine": "#273B2A", "dark-red": "#324A34", "wine-soft": "#3E5A3F",
      "bright-deep-yellow": "#9B9E90", "butter": "#9B9E90", "candle": "#D8DBCD", "gold": "#C7CBB8", "soft-gold": "#B2B8A8",
      "text": "#F4F5F2", "peach": "#DBDDD1", "warm-beige": "#EBECE5"
    }
  },
  sp_cobalt: {
    name: "Cobalt Crashout", special: true,
    colors: {
      "bg": "#000521", "dark-cherry-red": "#03123B", "marron-red": "#052158",
      "wine": "#082F75", "dark-red": "#0B3E92", "wine-soft": "#0E4EB2",
      "bright-deep-yellow": "#819DB8", "butter": "#819DB8", "candle": "#C1D9F2", "gold": "#A6C9EC", "soft-gold": "#96B5D9",
      "text": "#F1F7FC", "peach": "#ABCCED", "warm-beige": "#AFCEEE"
    }
  },
  sp_villain: {
    name: "Villain Arc Neon", special: true,
    colors: {
      "bg": "#0E0819", "dark-cherry-red": "#220F29", "marron-red": "#37173A",
      "wine": "#4D1E4B", "dark-red": "#62265C", "wine-soft": "#7A2E6F",
      "bright-deep-yellow": "#C78181", "butter": "#C78181", "candle": "#FFC0C0", "gold": "#FFA5A5", "soft-gold": "#DE9AA2",
      "text": "#FAE3E2", "peach": "#FAC3C1", "warm-beige": "#F5DBD8"
    }
  },
  sp_sigma: {
    name: "Sigma Forest", special: true,
    colors: {
      "bg": "#060807", "dark-cherry-red": "#101711", "marron-red": "#1B271C",
      "wine": "#273828", "dark-red": "#324833", "wine-soft": "#3E5A3F",
      "bright-deep-yellow": "#A5957E", "butter": "#A5957E", "candle": "#E0D2BD", "gold": "#D3BFA1", "soft-gold": "#BAB099",
      "text": "#F8F5EF", "peach": "#E4D7C3", "warm-beige": "#F1EBDE"
    }
  },
  sp_mauve: {
    name: "Mauve Mafia", special: true,
    colors: {
      "bg": "#190019", "dark-cherry-red": "#2C0E28", "marron-red": "#421E39",
      "wine": "#582E49", "dark-red": "#6D3E5A", "wine-soft": "#854F6C",
      "bright-deep-yellow": "#B59E9C", "butter": "#B59E9C", "candle": "#EFDAD8", "gold": "#E8CBC8", "soft-gold": "#D4BBBE",
      "text": "#FEFDFC", "peach": "#F3DAD3", "warm-beige": "#FBE7DC"
    }
  }
};

// gives the page the colors of a theme (inline values beat the colors in the CSS files)
function applyTheme(id) {
  const theme = THEMES[id] || THEMES.wine;
  const root = document.documentElement;

  Object.keys(theme.colors).forEach(function (variable) {
    root.style.setProperty("--" + variable, theme.colors[variable]);
  });
}

// use the saved theme as the page loads (this file sits in the <head>, so there is no flash)
applyTheme(localStorage.getItem(THEME_KEY) || "wine");

// if the theme is changed in another tab, follow it here
window.addEventListener("storage", function (event) {
  if (event.key === THEME_KEY) {
    applyTheme(event.newValue || "wine");
  }
});